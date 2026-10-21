/**
 * DigiExplodeAI — Task & Work Log Historical Reconciliation Utility
 * 
 * Safely analyzes and reconciles task states across:
 * - Cloudflare D1 database
 * - LocalStorage persistent caches
 * - Firestore database (when available)
 * - Work Logs historical deliverable records
 * 
 * Non-destructive: Analysis runs in read-only mode by default.
 * No data is modified without explicit function call and approval.
 */

import { type Task, getCachedTasks, setCachedTasks, normalizeTaskDateModel, normalizeTaskStatus } from './taskStorage';
import { cfGetTasks, cfGetWorkLogs, cfUpdateTask } from './cloudflareApi';
import { db, sanitizeFirestorePayload } from './firebase';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';

export interface TaskCandidateRecovery {
  taskId: string;
  taskTitle: string;
  clientName: string;
  assigneeName: string;
  currentStatusD1: string;
  currentStatusLocal: string;
  workLogId: string;
  workLogDate: string;
  workLogCompletedAt: string;
  scheduledDate: string;
  rolloverCount: number;
  reason: string;
  confidence: 'HIGH' | 'MEDIUM';
}

export interface TaskBackendDiscrepancy {
  taskId: string;
  taskTitle: string;
  statusD1: string;
  statusLocal: string;
  updatedAtD1?: string;
  updatedAtLocal?: string;
  issue: string;
}

export interface TaskAuditReport {
  timestamp: string;
  totalTasksAnalyzed: number;
  totalWorkLogsAnalyzed: number;
  candidateRecoveries: TaskCandidateRecovery[];
  backendDiscrepancies: TaskBackendDiscrepancy[];
  summary: {
    totalCandidates: number;
    highConfidenceCandidates: number;
    discrepantBackends: number;
    consistentTasks: number;
  };
}

/**
 * Runs a complete, read-only audit of tasks across storage backends and linked work logs.
 * Does NOT modify any production data.
 */
export async function generateTaskAuditReport(): Promise<TaskAuditReport> {
  const timestamp = new Date().toISOString();

  // 1. Fetch data from Cloudflare D1
  let cfTasks: any[] = [];
  let cfWorkLogs: any[] = [];

  try {
    cfTasks = await cfGetTasks();
  } catch (err) {
    console.warn('[Audit] Could not fetch D1 tasks:', err);
  }

  try {
    cfWorkLogs = await cfGetWorkLogs();
  } catch (err) {
    console.warn('[Audit] Could not fetch D1 worklogs:', err);
  }

  // 2. Fetch data from Local Storage
  const localTasks = getCachedTasks();
  let localWorkLogs: any[] = [];
  try {
    const raw = localStorage.getItem('digi_persisted_worklogs_v2');
    if (raw) localWorkLogs = JSON.parse(raw);
  } catch {}

  // 3. Index all work logs by taskId
  const workLogMap = new Map<string, any>();

  // Add local logs
  for (const log of localWorkLogs) {
    const tId = log.taskId || log.task_id;
    if (tId) {
      workLogMap.set(tId, log);
    }
    if (log.id && log.id.startsWith('worklog_task_')) {
      const extractedId = log.id.replace('worklog_task_', '');
      workLogMap.set(extractedId, log);
    }
  }

  // Add D1 logs (preferring completed logs)
  for (const log of cfWorkLogs) {
    const tId = log.taskId || log.task_id;
    if (tId && (!workLogMap.has(tId) || log.status === 'completed' || log.status === 'Completed')) {
      workLogMap.set(tId, log);
    }
    if (log.id && log.id.startsWith('worklog_task_')) {
      const extractedId = log.id.replace('worklog_task_', '');
      if (!workLogMap.has(extractedId) || log.status === 'completed') {
        workLogMap.set(extractedId, log);
      }
    }
  }

  // 4. Index all tasks by ID
  const allTaskIds = new Set<string>();
  const d1TaskMap = new Map<string, any>();
  const localTaskMap = new Map<string, Task>();

  for (const t of cfTasks) {
    allTaskIds.add(t.id);
    d1TaskMap.set(t.id, t);
  }

  for (const t of localTasks) {
    allTaskIds.add(t.id);
    localTaskMap.set(t.id, t);
  }

  const candidateRecoveries: TaskCandidateRecovery[] = [];
  const backendDiscrepancies: TaskBackendDiscrepancy[] = [];

  for (const id of allTaskIds) {
    const d1T = d1TaskMap.get(id);
    const localT = localTaskMap.get(id);

    const normStatusD1 = d1T ? normalizeTaskStatus(d1T.status) : 'N/A';
    const normStatusLocal = localT ? normalizeTaskStatus(localT.status) : 'N/A';
    const title = localT?.title || d1T?.title || 'Untitled';
    const clientName = localT?.clientName || d1T?.clientName || 'General';
    const assigneeName = localT?.assigneeName || d1T?.assigneeName || 'Unassigned';

    // Check Backend Discrepancies
    if (d1T && localT && normStatusD1 !== normStatusLocal) {
      backendDiscrepancies.push({
        taskId: id,
        taskTitle: title,
        statusD1: normStatusD1,
        statusLocal: normStatusLocal,
        updatedAtD1: d1T.updatedAt,
        updatedAtLocal: localT.updatedAt,
        issue: `D1 has '${normStatusD1}' while Local/Firestore has '${normStatusLocal}'`,
      });
    }

    // Check for Work Log Completed candidate
    const linkedLog = workLogMap.get(id);
    if (linkedLog) {
      const isLogDone = linkedLog.status === 'completed' || linkedLog.status === 'Completed' || linkedLog.source === 'task_completion';
      const isReopened = !!linkedLog.taskReopened || !!linkedLog.task_reopened;

      const isTaskDone = normStatusD1 === 'Done' || normStatusLocal === 'Done';

      if (isLogDone && !isReopened && !isTaskDone) {
        // Confirmed candidate recovery! Task was completed in Work Log, but shows as unfinished in task views!
        candidateRecoveries.push({
          taskId: id,
          taskTitle: title,
          clientName,
          assigneeName,
          currentStatusD1: normStatusD1,
          currentStatusLocal: normStatusLocal,
          workLogId: linkedLog.id,
          workLogDate: linkedLog.work_date || linkedLog.date || '',
          workLogCompletedAt: linkedLog.completed_at || linkedLog.completedAt || linkedLog.createdAt || '',
          scheduledDate: localT?.scheduledDate || d1T?.scheduledDate || '',
          rolloverCount: localT?.rolloverCount || 0,
          reason: `Deliverable recorded as completed in Work Log on ${linkedLog.work_date || linkedLog.date || 'date'}, but task shows as ${normStatusLocal || normStatusD1}`,
          confidence: 'HIGH'
        });
      }
    }
  }

  const totalTasksAnalyzed = allTaskIds.size;
  const consistentTasks = totalTasksAnalyzed - candidateRecoveries.length - backendDiscrepancies.length;

  const report: TaskAuditReport = {
    timestamp,
    totalTasksAnalyzed,
    totalWorkLogsAnalyzed: workLogMap.size,
    candidateRecoveries,
    backendDiscrepancies,
    summary: {
      totalCandidates: candidateRecoveries.length,
      highConfidenceCandidates: candidateRecoveries.filter(c => c.confidence === 'HIGH').length,
      discrepantBackends: backendDiscrepancies.length,
      consistentTasks: Math.max(0, consistentTasks)
    }
  };

  return report;
}

/**
 * Applies recovery to explicit, approved task IDs.
 * Does NOT run automatically. Requires explicit caller invocation with approved IDs.
 */
export async function applyApprovedTaskRecovery(
  approvedTaskIds: string[],
  userProfile?: { uid?: string; name?: string }
): Promise<{ recoveredCount: number; failedCount: number; details: string[] }> {
  if (!Array.isArray(approvedTaskIds) || approvedTaskIds.length === 0) {
    return { recoveredCount: 0, failedCount: 0, details: ['No tasks selected for recovery'] };
  }

  const report = await generateTaskAuditReport();
  const candidateMap = new Map<string, TaskCandidateRecovery>();
  for (const c of report.candidateRecoveries) {
    candidateMap.set(c.taskId, c);
  }

  const currentCached = getCachedTasks();
  let recoveredCount = 0;
  let failedCount = 0;
  const details: string[] = [];

  const updatedTasksList: Task[] = [];

  for (const t of currentCached) {
    if (approvedTaskIds.includes(t.id)) {
      const candidate = candidateMap.get(t.id);
      const completionTime = candidate?.workLogCompletedAt || t.updatedAt || new Date().toISOString();

      const recoveredTask = normalizeTaskDateModel({
        ...t,
        status: 'Done',
        completedAt: completionTime,
        completed_at: completionTime,
        updatedAt: new Date().toISOString(),
      });

      // 1. Update Cloudflare D1
      cfUpdateTask(t.id, recoveredTask).catch(console.warn);

      // 2. Update Firestore
      try {
        await setDoc(doc(db, 'tasks', t.id), sanitizeFirestorePayload(recoveredTask), { merge: true });
        await addDoc(collection(db, 'activityLogs'), {
          userId: userProfile?.uid || 'admin',
          userName: userProfile?.name || 'Admin',
          action: `reconciled task "${t.title}" to Done from historical Work Log record`,
          details: `Completed timestamp: ${completionTime}`,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('[Recovery] Firestore sync warning:', err);
      }

      updatedTasksList.push(recoveredTask);
      recoveredCount++;
      details.push(`✓ Recovered "${t.title}" (ID: ${t.id}) to Done`);
    } else {
      updatedTasksList.push(t);
    }
  }

  setCachedTasks(updatedTasksList);

  return { recoveredCount, failedCount, details };
}

// Attach read-only helper to browser window for interactive inspection without UI disruption
if (typeof window !== 'undefined') {
  (window as any).digiAuditTasks = async () => {
    console.log('🔍 Running Task & Work Log Audit...');
    const report = await generateTaskAuditReport();
    console.table(report.candidateRecoveries);
    console.log('Audit Summary:', report.summary);
    return report;
  };
}
