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
} from '../lib/taskStorage';

import { generateTaskAuditReport } from '../lib/taskReconciliation';
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
  // Final Results
  // ---------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
