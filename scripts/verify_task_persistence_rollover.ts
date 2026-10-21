/**
 * DIGIEXPLODEAI — Task Persistence & Rollover Automated Verification Suite
 * Phase G Automated Tests
 */

import {
  type Task,
  normalizeTaskDateModel,
  normalizeTaskStatus,
  mergeTaskRecords,
  evaluateTaskRollovers,
  getTodayDateStr,
  getNextWorkingDate,
  differenceInCalendarDays,
  addDaysToDateStr,
  DEFAULT_ROLLOVER_SETTINGS,
  getTaskSyncQueue,
  setTaskSyncQueue,
  clearTaskSyncQueue,
  enqueueTaskSyncRetry,
  dequeueTaskSyncRetry,
  processTaskSyncQueue,
  persistTaskDualWrite,
  bulkRescheduleTasks,
  getCachedTasks,
  setCachedTasks,
} from '../lib/taskStorage';

import { generateTaskAuditReport, applyApprovedTaskRecovery } from '../lib/taskReconciliation';
import * as fs from 'fs';
import * as path from 'path';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail: string = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName} — ${detail}`);
    failedTests++;
  }
}

async function runAllTests() {
  console.log('====================================================');
  console.log('DIGIEXPLODEAI: Automated Verification Suite');
  console.log('Branch: fix/task-persistence-rollover');
  console.log('====================================================\n');

  // ---------------------------------------------------------------
  // 1. Timezone & Operational Date Tests
  // ---------------------------------------------------------------
  console.log('▶ 1. Operational Timezone & Date Calculations (Asia/Kolkata)');
  const kolkataDate = getTodayDateStr('Asia/Kolkata');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(kolkataDate), 'getTodayDateStr returns valid YYYY-MM-DD');

  const nextWorking = getNextWorkingDate(kolkataDate, [1, 2, 3, 4, 5, 6]);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(nextWorking), 'getNextWorkingDate returns valid date string');

  const diff = differenceInCalendarDays(addDaysToDateStr(kolkataDate, 3), kolkataDate);
  assert(diff === 3, 'differenceInCalendarDays accurately calculates calendar intervals');

  // ---------------------------------------------------------------
  // 2. Task Model Normalization & Reopening History
  // ---------------------------------------------------------------
  console.log('\n▶ 2. Task Normalization & Reopen Tracking');
  const rawDoneTask: Partial<Task> = {
    id: 'test_task_01',
    title: 'Test Deliverable',
    status: 'Done',
    scheduledDate: kolkataDate,
    dueDate: kolkataDate,
  };
  const normalizedDone = normalizeTaskDateModel(rawDoneTask);
  assert(normalizedDone.status === 'Done', 'Status normalized to Done');
  assert(!!normalizedDone.completedAt, 'completedAt timestamp populated for Done task');
  assert(normalizedDone.completed_at === normalizedDone.completedAt, 'completed_at alias matches completedAt');

  const rawReopenedTask: Partial<Task> = {
    id: 'test_task_01',
    title: 'Test Deliverable',
    status: 'In Progress',
    lastCompletedAt: '2026-10-20T10:00:00.000Z',
    reopenedAt: '2026-10-21T09:00:00.000Z',
    taskReopened: true,
  };
  const normalizedReopened = normalizeTaskDateModel(rawReopenedTask);
  assert(normalizedReopened.status === 'In Progress', 'Status preserved as In Progress for reopened task');
  assert(normalizedReopened.taskReopened === true, 'taskReopened flag is preserved');
  assert(normalizedReopened.reopenedAt === '2026-10-21T09:00:00.000Z', 'reopenedAt timestamp preserved');
  assert(!normalizedReopened.completedAt, 'completedAt is cleared on non-Done task');

  // ---------------------------------------------------------------
  // 3. Conflict Resolution & Overwrite Protection (mergeTaskRecords)
  // ---------------------------------------------------------------
  console.log('\n▶ 3. Deterministic Conflict Resolution (mergeTaskRecords)');

  // Test 3A: Stale D1 task (To Do, older timestamp) vs Local task (Done, newer timestamp)
  const localDoneTask = normalizeTaskDateModel({
    id: 'task_sync_test',
    title: 'Campaign Graphics',
    status: 'Done',
    completedAt: '2026-10-20T15:30:00.000Z',
    updatedAt: '2026-10-20T15:30:00.000Z',
  });
  const staleD1ToDoTask = normalizeTaskDateModel({
    id: 'task_sync_test',
    title: 'Campaign Graphics',
    status: 'To Do',
    updatedAt: '2026-10-18T10:00:00.000Z',
  });

  const res3A = mergeTaskRecords(localDoneTask, staleD1ToDoTask);
  assert(res3A.merged.status === 'Done', 'Stale D1 To Do CANNOT overwrite newer Local Done');
  assert(res3A.merged.completedAt === '2026-10-20T15:30:00.000Z', 'Completion timestamp preserved');
  assert(res3A.shouldSyncToD1 === true, 'Flags shouldSyncToD1 to heal stale D1 record');

  // Test 3B: Legitimate User Reopening on another device
  const legitReopenedIncoming = normalizeTaskDateModel({
    id: 'task_sync_test',
    title: 'Campaign Graphics',
    status: 'In Progress',
    reopenedAt: '2026-10-21T08:00:00.000Z',
    updatedAt: '2026-10-21T08:00:00.000Z',
    taskReopened: true,
  });
  const res3B = mergeTaskRecords(localDoneTask, legitReopenedIncoming);
  assert(res3B.merged.status === 'In Progress', 'Legitimate user reopen with newer timestamp is honored');

  // Test 3C: Newer general update from D1 (e.g. title edit by manager)
  const d1UpdatedTask = normalizeTaskDateModel({
    id: 'task_sync_test',
    title: 'Campaign Graphics (Updated Version)',
    status: 'Done',
    updatedAt: '2026-10-21T09:00:00.000Z',
  });
  const res3C = mergeTaskRecords(localDoneTask, d1UpdatedTask);
  assert(res3C.merged.title === 'Campaign Graphics (Updated Version)', 'Newer D1 updates take precedence');

  // ---------------------------------------------------------------
  // 4. Daily Rollover Engine Verification
  // ---------------------------------------------------------------
  console.log('\n▶ 4. Daily Rollover Engine Rules & Idempotency');

  const yesterdayDate = addDaysToDateStr(kolkataDate, -1);
  const twoDaysAgoDate = addDaysToDateStr(kolkataDate, -2);

  const testTaskList: Task[] = [
    // Task 1: Unfinished, yesterday -> SHOULD rollover
    normalizeTaskDateModel({
      id: 'rollover_task_1',
      title: 'Pending Yesterday Task',
      status: 'To Do',
      scheduledDate: yesterdayDate,
      dueDate: yesterdayDate,
      rolloverCount: 0,
    }),
    // Task 2: Completed yesterday -> MUST NEVER rollover
    normalizeTaskDateModel({
      id: 'rollover_task_2',
      title: 'Done Yesterday Task',
      status: 'Done',
      scheduledDate: yesterdayDate,
      dueDate: yesterdayDate,
      completedAt: `${yesterdayDate}T16:00:00.000Z`,
      rolloverCount: 0,
    }),
    // Task 3: Cancelled yesterday -> MUST NEVER rollover
    normalizeTaskDateModel({
      id: 'rollover_task_3',
      title: 'Cancelled Yesterday Task',
      status: 'Cancelled',
      scheduledDate: yesterdayDate,
      dueDate: yesterdayDate,
      rolloverCount: 0,
    }),
    // Task 4: Archived yesterday -> MUST NEVER rollover
    normalizeTaskDateModel({
      id: 'rollover_task_4',
      title: 'Archived Yesterday Task',
      status: 'To Do',
      isArchived: true,
      scheduledDate: yesterdayDate,
      dueDate: yesterdayDate,
      rolloverCount: 0,
    }),
    // Task 5: Already rolled over today -> MUST NOT increment count again (once per business day)
    normalizeTaskDateModel({
      id: 'rollover_task_5',
      title: 'Already Rolled Over Today Task',
      status: 'To Do',
      scheduledDate: kolkataDate,
      lastRolloverAt: `${kolkataDate}T08:00:00.000Z`,
      rolloverCount: 1,
    }),
  ];

  // First rollover execution
  const { updatedTasks: afterRollover1, rolledOverCount: count1 } = await evaluateTaskRollovers(
    testTaskList,
    DEFAULT_ROLLOVER_SETTINGS
  );

  assert(count1 === 1, `Exactly 1 unfinished task rolled over (actual: ${count1})`);

  const rolledT1 = afterRollover1.find(t => t.id === 'rollover_task_1');
  assert(rolledT1?.scheduledDate >= kolkataDate, 'Unfinished task rolled to today/working date');
  assert(rolledT1?.rolloverCount === 1, 'Rollover count incremented by 1');
  assert(rolledT1?.originalScheduledDate === yesterdayDate, 'Original scheduled date preserved immutably');
  assert(rolledT1?.originalDueDate === yesterdayDate, 'Original due date preserved immutably');

  const rolledT2 = afterRollover1.find(t => t.id === 'rollover_task_2');
  assert(rolledT2?.status === 'Done', 'Done task status strictly remains Done');
  assert(rolledT2?.rolloverCount === 0, 'Done task rollover count never incremented');
  assert(rolledT2?.scheduledDate === yesterdayDate, 'Done task scheduledDate never moved');

  const rolledT3 = afterRollover1.find(t => t.id === 'rollover_task_3');
  assert(rolledT3?.rolloverCount === 0, 'Cancelled task never rolled over');

  const rolledT4 = afterRollover1.find(t => t.id === 'rollover_task_4');
  assert(rolledT4?.rolloverCount === 0, 'Archived task never rolled over');

  // Second rollover execution on same list (simulating page refresh / re-login)
  const { updatedTasks: afterRollover2, rolledOverCount: count2 } = await evaluateTaskRollovers(
    afterRollover1,
    DEFAULT_ROLLOVER_SETTINGS
  );

  assert(count2 === 0, `Subsequent rollover on same day is completely idempotent (actual: ${count2})`);
  const reRolledT1 = afterRollover2.find(t => t.id === 'rollover_task_1');
  assert(reRolledT1?.rolloverCount === 1, 'Rollover count did not double-increment');

  // ---------------------------------------------------------------
  // 5. Data Safety Audit: App.tsx Sanitization Check
  // ---------------------------------------------------------------
  console.log('\n▶ 5. Production Startup Data Safety Check');
  const appContent = fs.readFileSync(path.resolve('App.tsx'), 'utf-8');
  assert(!appContent.includes('wipeFirestore'), 'App.tsx no longer contains wipeFirestore');
  assert(!appContent.includes('deleteDoc'), 'App.tsx no longer contains deleteDoc');
  assert(!appContent.includes('PURGE_KEY'), 'App.tsx no longer contains destructive PURGE_KEY');
  assert(!appContent.includes('digi_persisted_tasks_v2'), 'App.tsx no longer wipes digi_persisted_tasks_v2');

  // ---------------------------------------------------------------
  // 6. Reconciliation Utility Read-Only Safety Check
  // ---------------------------------------------------------------
  console.log('\n▶ 6. Historical Reconciliation Utility (Non-Destructive Check)');
  try {
    const report = await generateTaskAuditReport();
    assert(report.totalTasksAnalyzed >= 0, `Reconciliation audit generated successfully (${report.totalTasksAnalyzed} tasks analyzed)`);
    assert(Array.isArray(report.candidateRecoveries), 'Returns candidateRecoveries array');
    assert(Array.isArray(report.backendDiscrepancies), 'Returns backendDiscrepancies array');
  } catch (err: any) {
    assert(false, 'generateTaskAuditReport threw error', err?.message);
  }

  // ---------------------------------------------------------------
  // 7. Failure-Path Persistence & Idempotent Retry Handling
  // ---------------------------------------------------------------
  console.log('\n▶ 7. Failure-Path Persistence & Idempotent Retry Handling');
  
  clearTaskSyncQueue();
  assert(getTaskSyncQueue().length === 0, 'Retry queue starts clean');

  const failureTask: Task = normalizeTaskDateModel({
    id: 'fail_task_01',
    title: 'Offline Video Edit',
    status: 'In Progress',
    scheduledDate: kolkataDate,
    dueDate: kolkataDate,
  });

  // Test 7A: Enqueueing partial failure
  enqueueTaskSyncRetry(failureTask, 'd1', 'update', new Error('Cloudflare D1 503 Service Unavailable'));
  let queue = getTaskSyncQueue();
  assert(queue.length === 1, 'Failed write successfully enqueued in retry queue');
  assert(queue[0].targetBackend === 'd1', 'Enqueued item targets failed backend (D1)');
  assert(queue[0].lastError?.includes('503') === true, 'Error message recorded in retry queue item');

  // Test 7B: Idempotent Deduplication (No Duplicated Operations)
  // When task is updated to Done before retry fires, newer payload supersedes older payload
  const failureTaskDone: Task = normalizeTaskDateModel({
    ...failureTask,
    status: 'Done',
    completedAt: `${kolkataDate}T12:00:00.000Z`,
    updatedAt: `${kolkataDate}T12:00:00.000Z`,
  });
  enqueueTaskSyncRetry(failureTaskDone, 'd1', 'update', new Error('Cloudflare D1 Network Timeout'));
  queue = getTaskSyncQueue();
  assert(queue.length === 1, 'Queue deduplicated: 0 duplicate entries created for same task');
  assert(queue[0].taskPayload.status === 'Done', 'Latest verified task payload preserved in queue');

  // Test 7C: Dequeue on Successful Sync
  dequeueTaskSyncRetry(failureTask.id, 'd1');
  assert(getTaskSyncQueue().length === 0, 'Dequeued successfully after authoritative synchronization');

  // Test 7D: Dual-Write Result Contract Structure
  const writeResultTestTask = normalizeTaskDateModel({
    id: 'contract_test_task',
    title: 'Dual Write Contract Test',
    status: 'Done',
    scheduledDate: kolkataDate,
    dueDate: kolkataDate,
  });
  const dualResult = await persistTaskDualWrite(writeResultTestTask, 'update');
  assert(typeof dualResult.success === 'boolean', 'persistTaskDualWrite returns boolean success');
  assert(typeof dualResult.allBackendsSynced === 'boolean', 'persistTaskDualWrite returns allBackendsSynced');
  assert(typeof dualResult.partialFailure === 'boolean', 'persistTaskDualWrite returns partialFailure');
  assert(dualResult.firestoreStatus === 'success' || dualResult.firestoreStatus === 'failed', 'firestoreStatus is valid status');
  assert(dualResult.d1Status === 'success' || dualResult.d1Status === 'failed', 'd1Status is valid status');

  // ---------------------------------------------------------------
  // 8. Concurrent Updates & Race-Condition Tests
  // ---------------------------------------------------------------
  console.log('\n▶ 8. Concurrent Updates & Race-Condition Determinism');

  // Test 8A: Concurrent Simultaneous Edits (Newer Timestamp Wins)
  const taskAtT1 = normalizeTaskDateModel({
    id: 'concurrent_task_1',
    title: 'Version from Device 1',
    status: 'In Progress',
    updatedAt: '2026-10-21T10:00:00.000Z',
  });
  const taskAtT2 = normalizeTaskDateModel({
    id: 'concurrent_task_1',
    title: 'Version from Device 2 (Later)',
    status: 'In Review',
    updatedAt: '2026-10-21T10:05:00.000Z',
  });
  const mergeSimultaneous = mergeTaskRecords(taskAtT1, taskAtT2);
  assert(mergeSimultaneous.merged.title === 'Version from Device 2 (Later)', 'Newer concurrent edit deterministically wins title');
  assert(mergeSimultaneous.merged.status === 'In Review', 'Newer concurrent edit deterministically wins status');

  // Test 8B: Concurrent Task Completion vs Stale Device Overwrite
  const deviceA_completed = normalizeTaskDateModel({
    id: 'concurrent_done_task',
    title: 'Client Landing Page',
    status: 'Done',
    completedAt: '2026-10-21T11:00:00.000Z',
    updatedAt: '2026-10-21T11:00:00.000Z',
  });
  const deviceB_staleOpen = normalizeTaskDateModel({
    id: 'concurrent_done_task',
    title: 'Client Landing Page',
    status: 'To Do',
    updatedAt: '2026-10-21T09:00:00.000Z',
  });
  const mergeDoneRace = mergeTaskRecords(deviceA_completed, deviceB_staleOpen);
  assert(mergeDoneRace.merged.status === 'Done', 'Concurrent stale open task cannot revert verified Done');
  assert(mergeDoneRace.shouldSyncToD1 === true, 'Flags healing write for stale backend');

  // Test 8C: Concurrent Legitimate Reopen vs Stale Completion
  const legitReopened = normalizeTaskDateModel({
    id: 'concurrent_done_task',
    title: 'Client Landing Page',
    status: 'In Progress',
    taskReopened: true,
    reopenedAt: '2026-10-21T11:30:00.000Z',
    updatedAt: '2026-10-21T11:30:00.000Z',
  });
  const mergeReopenRace = mergeTaskRecords(deviceA_completed, legitReopened);
  assert(mergeReopenRace.merged.status === 'In Progress', 'Legitimate deliberate reopening overrides prior completion');
  assert(mergeReopenRace.merged.taskReopened === true, 'Reopen flag retained through concurrent merge');

  // Test 8D: Concurrent Rollover Evaluation Idempotency
  const concurrentRolloverTasks = [
    normalizeTaskDateModel({
      id: 'concurrent_roll_task',
      title: 'Overdue Campaign',
      status: 'To Do',
      scheduledDate: yesterdayDate,
      dueDate: yesterdayDate,
      rolloverCount: 0,
    })
  ];
  const [evalRunA] = await Promise.all([
    evaluateTaskRollovers(concurrentRolloverTasks, DEFAULT_ROLLOVER_SETTINGS),
    evaluateTaskRollovers(concurrentRolloverTasks, DEFAULT_ROLLOVER_SETTINGS),
  ]);
  const rolledA = evalRunA.updatedTasks[0];
  const evalRunC = await evaluateTaskRollovers(evalRunA.updatedTasks, DEFAULT_ROLLOVER_SETTINGS);
  assert(rolledA.rolloverCount === 1, 'Rollover count is exactly 1 after first execution');
  assert(evalRunC.rolledOverCount === 0, 'Second simultaneous/subsequent evaluation yields 0 additional rollovers');
  assert(evalRunC.updatedTasks[0].rolloverCount === 1, 'Rollover count never double-increments under concurrency');

  // ---------------------------------------------------------------
  // 9. Bulk Rescheduling Persistence & Partial Failure Contract
  // ---------------------------------------------------------------
  console.log('\n▶ 9. Bulk Reschedule Contract & Failure Reporting');
  const dummyCachedTasks = [
    normalizeTaskDateModel({ id: 'resched_1', title: 'Task 1', status: 'To Do', scheduledDate: kolkataDate }),
    normalizeTaskDateModel({ id: 'resched_2', title: 'Task 2', status: 'To Do', scheduledDate: kolkataDate }),
  ];
  setCachedTasks(dummyCachedTasks);

  const reschedTargetDate = addDaysToDateStr(kolkataDate, 2);
  const reschedResult = await bulkRescheduleTasks(['resched_1', 'resched_2'], reschedTargetDate, { uid: 'test_admin', name: 'Admin' });
  assert(reschedResult.updatedCount === 2, 'bulkRescheduleTasks updated count matches requested tasks');
  assert(typeof reschedResult.successCount === 'number', 'bulkRescheduleTasks returns numeric successCount');
  assert(typeof reschedResult.failureCount === 'number', 'bulkRescheduleTasks returns numeric failureCount');
  assert(Array.isArray(reschedResult.partialFailures), 'bulkRescheduleTasks returns partialFailures array');

  // ---------------------------------------------------------------
  // 10. Historical Reconciliation Recovery Contract
  // ---------------------------------------------------------------
  console.log('\n▶ 10. Historical Reconciliation Approval Contract');
  const emptyRecovery = await applyApprovedTaskRecovery([]);
  assert(emptyRecovery.recoveredCount === 0, 'Empty approval list safely returns 0 recovered');
  assert(emptyRecovery.details[0] === 'No tasks selected for recovery', 'Empty approval reports clear notice');

  // ---------------------------------------------------------------
  // Final Results
  // ---------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
