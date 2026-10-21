import { 
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, 
  onSnapshot, query, where, orderBy, addDoc 
} from 'firebase/firestore';
import { db, sanitizeFirestorePayload } from './firebase';
import { WorkspaceEventService } from './controlPlane/WorkspaceEventService';
import { cfGetTasks, cfCreateTask, cfUpdateTask, cfDeleteTask } from './cloudflareApi';

export interface Task {
  id: string;
  taskId?: string;
  title: string;
  description?: string;
  clientId?: string;
  clientName?: string;
  category?: string;
  platform?: string;
  assigneeId?: string;
  assigneeName?: string;
  assigned_employee_id?: string;
  employee_id?: string;
  assignee_id?: string;
  assignedTo?: string;
  assignedById?: string;
  assignedByName?: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  
  // Canonical Date Model
  scheduledDate: string;             // Operational date when team is expected to work on task (YYYY-MM-DD)
  dueDate: string;                   // Final deadline for task (YYYY-MM-DD)
  originalScheduledDate?: string;    // Immutable first scheduled date (YYYY-MM-DD)
  originalDueDate?: string;          // Immutable original deadline when first created (YYYY-MM-DD)
  completedAt?: string;              // Actual completion ISO timestamp
  firstPendingSince?: string;        // Date from which task has continuously remained unfinished (YYYY-MM-DD)
  lastRolloverAt?: string;           // Timestamp of most recent automatic carry-forward ISO
  rolloverCount?: number;            // Number of automatic day rollovers (default 0)

  // Compatibility snake_case aliases for Firestore queries and scripts
  scheduled_date?: string;
  due_date?: string;
  original_scheduled_date?: string;
  original_due_date?: string;
  completed_at?: string;
  first_pending_since?: string;
  last_rollover_at?: string;
  rollover_count?: number;

  status: string; // 'To Do' | 'In Progress' | 'In Review' | 'Done'
  estimatedTime?: string;
  actualTime?: string;
  internalNotes?: string;
  completionProof?: string;
  createdAt: string;
  updatedAt?: string;
  isArchived?: boolean;
  is_deleted?: boolean;
  deleted_at?: string;
  deleted_by?: string;
  deleted_by_id?: string;
  videoProductionId?: string;
  videoTrackerId?: string;
  productionRole?: 'shoot' | 'edit';
  dependsOnTaskId?: string;
  blockedByShoot?: boolean;
  lastCompletedAt?: string;
  reopenedAt?: string;
  reopened_at?: string;
  taskReopened?: boolean;
  task_reopened?: boolean;
}

export interface RolloverSettings {
  automaticRollover: boolean;
  workingDays: number[]; // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  rollDoneTasks: boolean;
  ageingThresholds: {
    amber: number;    // 1 day
    orange: number;   // 2-3 days
    red: number;      // 4-6 days
    deepRed: number;  // 7+ days
  };
}

export const LOCAL_STORAGE_TASKS_KEY = 'digi_persisted_tasks_v2';
export const LOCAL_STORAGE_ROLLOVER_SETTINGS_KEY = 'digi_rollover_settings_v1';

export const DEFAULT_ROLLOVER_SETTINGS: RolloverSettings = {
  automaticRollover: true,
  workingDays: [1, 2, 3, 4, 5, 6], // Mon - Sat working days
  rollDoneTasks: false,
  ageingThresholds: {
    amber: 1,
    orange: 2,
    red: 4,
    deepRed: 7,
  }
};

export const getRolloverSettings = (): RolloverSettings => {
  if (typeof window === 'undefined') return DEFAULT_ROLLOVER_SETTINGS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ROLLOVER_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_ROLLOVER_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Could not read rollover settings:', e);
  }
  return DEFAULT_ROLLOVER_SETTINGS;
};

export const setRolloverSettings = (settings: Partial<RolloverSettings>) => {
  if (typeof window === 'undefined') return;
  try {
    const current = getRolloverSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(LOCAL_STORAGE_ROLLOVER_SETTINGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Could not save rollover settings:', e);
  }
};

export const DEFAULT_MASTER_TASKS: Task[] = [];

/**
 * Normalizes raw status string to canonical Kanban column key
 */
export const normalizeTaskStatus = (rawStatus: string): 'To Do' | 'In Progress' | 'In Review' | 'Done' | 'Cancelled' => {
  if (!rawStatus) return 'To Do';
  const s = rawStatus.toLowerCase().trim();
  if (['cancelled', 'canceled'].includes(s)) return 'Cancelled';
  if (['done', 'completed', 'approved'].includes(s)) return 'Done';
  if (['in review', 'internal review', 'client review', 'revision', 'in_review'].includes(s)) return 'In Review';
  if (['in progress', 'in_progress'].includes(s)) return 'In Progress';
  return 'To Do';
};

/**
 * Canonical Workflow Steps for One-Click Navigation
 */
export const WORKFLOW_STATUS_ORDER: Array<'To Do' | 'In Progress' | 'In Review' | 'Done'> = [
  'To Do',
  'In Progress',
  'In Review',
  'Done'
];

export const getNextWorkflowStatus = (currentStatus: string): 'To Do' | 'In Progress' | 'In Review' | 'Done' | null => {
  const norm = normalizeTaskStatus(currentStatus);
  const idx = WORKFLOW_STATUS_ORDER.indexOf(norm as any);
  if (idx >= 0 && idx < WORKFLOW_STATUS_ORDER.length - 1) {
    return WORKFLOW_STATUS_ORDER[idx + 1];
  }
  return null;
};

export const getPrevWorkflowStatus = (currentStatus: string): 'To Do' | 'In Progress' | 'In Review' | 'Done' | null => {
  const norm = normalizeTaskStatus(currentStatus);
  const idx = WORKFLOW_STATUS_ORDER.indexOf(norm as any);
  if (idx > 0) {
    return WORKFLOW_STATUS_ORDER[idx - 1];
  }
  return null;
};

/**
 * Normalizes and guarantees the full Canonical Task Date Model on any task object.
 * Provides immutable preservation of original dates and backwards compatibility.
 */
export function normalizeTaskDateModel(raw: any): Task {
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split('T')[0];
  const createdAtStr = raw.createdAt ? raw.createdAt.slice(0, 10) : todayStr;

  const initialDue = raw.dueDate || raw.due_date || raw.originalDueDate || raw.original_due_date || todayStr;
  const initialScheduled = raw.scheduledDate || raw.scheduled_date || raw.originalScheduledDate || raw.original_scheduled_date || createdAtStr || todayStr;
  const origScheduled = raw.originalScheduledDate || raw.original_scheduled_date || initialScheduled;
  const origDue = raw.originalDueDate || raw.original_due_date || initialDue;
  const pendingSince = raw.firstPendingSince || raw.first_pending_since || origScheduled || createdAtStr;
  const count = typeof raw.rolloverCount === 'number' 
    ? raw.rolloverCount 
    : (typeof raw.rollover_count === 'number' ? raw.rollover_count : 0);

  const normalizedStatus = normalizeTaskStatus(raw.status || 'To Do');
  const assignedEmpId = raw.assigned_employee_id || raw.assigneeId || raw.employee_id || raw.assignee_id || raw.assignedTo || '';
  const assignedEmpName = raw.assigneeName || raw.assignee_name || raw.employeeName || raw.employee_name || (assignedEmpId ? 'Team Member' : 'Unassigned');

  const isDone = normalizedStatus === 'Done';
  const resolvedCompletedAt = isDone 
    ? (raw.completedAt || raw.completed_at || raw.updatedAt || nowIso)
    : undefined;

  return {
    ...raw,
    id: raw.id || raw.taskId || `task_${Date.now()}`,
    taskId: raw.taskId || raw.id,
    title: (raw.title || 'Untitled Task').trim(),
    description: (raw.description || '').trim(),
    clientId: raw.clientId || '',
    clientName: raw.clientName || 'General',
    category: raw.category || 'General',
    assigneeId: assignedEmpId,
    assigneeName: assignedEmpName,
    assigned_employee_id: assignedEmpId,
    employee_id: assignedEmpId,
    priority: raw.priority || 'Medium',
    status: normalizedStatus,
    scheduledDate: initialScheduled,
    dueDate: initialDue,
    originalScheduledDate: origScheduled,
    originalDueDate: origDue,
    firstPendingSince: pendingSince,
    rolloverCount: count,
    lastRolloverAt: raw.lastRolloverAt || raw.last_rollover_at,
    completedAt: resolvedCompletedAt,
    lastCompletedAt: raw.lastCompletedAt || raw.last_completed_at,
    reopenedAt: raw.reopenedAt || raw.reopened_at,
    taskReopened: !!raw.taskReopened || !!raw.task_reopened,
    createdAt: raw.createdAt || nowIso,
    updatedAt: raw.updatedAt || nowIso,
    isArchived: !!raw.isArchived || !!raw.is_deleted,
    is_deleted: !!raw.is_deleted || !!raw.isArchived,
    deleted_at: raw.deleted_at || raw.deletedAt,
    deleted_by: raw.deleted_by || raw.deletedBy,
    deleted_by_id: raw.deleted_by_id || raw.deletedById,

    // Aliases
    scheduled_date: initialScheduled,
    due_date: initialDue,
    original_scheduled_date: origScheduled,
    original_due_date: origDue,
    first_pending_since: pendingSince,
    rollover_count: count,
    last_rollover_at: raw.lastRolloverAt || raw.last_rollover_at,
    completed_at: resolvedCompletedAt,
    reopened_at: raw.reopenedAt || raw.reopened_at,
    task_reopened: !!raw.taskReopened || !!raw.task_reopened,
  };
}

/**
 * Deterministically merges two versions of a Task record.
 * Uses updatedAt timestamps, safeguards completed states against stale reverts,
 * and preserves deliberate user reopenings.
 */
export function mergeTaskRecords(existing: Task, incoming: Task): { 
  merged: Task; 
  shouldSyncToD1: boolean; 
  shouldSyncToFirestore: boolean 
} {
  const normExisting = normalizeTaskDateModel(existing);
  const normIncoming = normalizeTaskDateModel(incoming);

  const existingTime = new Date(normExisting.updatedAt || normExisting.createdAt || 0).getTime();
  const incomingTime = new Date(normIncoming.updatedAt || normIncoming.createdAt || 0).getTime();

  const isExistingDone = normExisting.status === 'Done';
  const isIncomingDone = normIncoming.status === 'Done';

  // Case 1: Status conflict between Done and non-Done
  if (isExistingDone && !isIncomingDone) {
    const existingCompletedTime = new Date(normExisting.completedAt || normExisting.updatedAt || 0).getTime();
    const isExplicitReopen = !!normIncoming.reopenedAt || 
      !!normIncoming.taskReopened || 
      (incomingTime > existingCompletedTime + 1000);

    if (isExplicitReopen) {
      // User legitimately reopened the task on another client
      return {
        merged: normIncoming,
        shouldSyncToD1: false,
        shouldSyncToFirestore: false,
      };
    } else {
      // Incoming is a stale non-Done record (e.g. D1 before status transition)
      // Safeguard: Retain existing Done status and heal D1!
      const merged: Task = {
        ...normIncoming,
        status: 'Done',
        completedAt: normExisting.completedAt,
        completed_at: normExisting.completed_at,
        updatedAt: normExisting.updatedAt,
      };
      return {
        merged,
        shouldSyncToD1: true,
        shouldSyncToFirestore: false,
      };
    }
  }

  if (!isExistingDone && isIncomingDone) {
    const existingReopenedTime = new Date(normExisting.reopenedAt || 0).getTime();
    const incomingCompletedTime = new Date(normIncoming.completedAt || normIncoming.updatedAt || 0).getTime();

    // Check if existing was legitimately reopened after incoming completion
    if (existingReopenedTime > incomingCompletedTime) {
      return {
        merged: normExisting,
        shouldSyncToD1: true,
        shouldSyncToFirestore: false,
      };
    } else {
      // Incoming is completed and verified - accept incoming Done!
      return {
        merged: normIncoming,
        shouldSyncToD1: false,
        shouldSyncToFirestore: true,
      };
    }
  }

  // Case 2: Both have the same completion state or neither is Done -> Latest timestamp wins
  if (incomingTime > existingTime) {
    return {
      merged: normIncoming,
      shouldSyncToD1: false,
      shouldSyncToFirestore: true,
    };
  } else if (existingTime > incomingTime) {
    return {
      merged: normExisting,
      shouldSyncToD1: true,
      shouldSyncToFirestore: false,
    };
  }

  // Exact same timestamp: merge cleanly
  return {
    merged: {
      ...normIncoming,
      ...normExisting,
      status: (isExistingDone || isIncomingDone) ? 'Done' : normExisting.status,
      completedAt: normExisting.completedAt || normIncoming.completedAt,
    },
    shouldSyncToD1: false,
    shouldSyncToFirestore: false,
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * RELIABLE DUAL-BACKEND PERSISTENCE & RETRY ENGINE (OUTBOX PATTERN)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface TaskSyncQueueItem {
  id: string; // unique item id e.g. `${taskId}_${targetBackend}`
  taskId: string;
  action: 'create' | 'update' | 'delete';
  targetBackend: 'firestore' | 'd1' | 'both';
  taskPayload: Task;
  queuedAt: string;
  attempts: number;
  lastError?: string;
  lastAttemptAt?: string;
}

export const LOCAL_STORAGE_TASK_SYNC_QUEUE_KEY = 'digi_task_sync_queue_v1';

// In-memory queue fallback for non-browser/test environments
let memoryTaskSyncQueue: TaskSyncQueueItem[] = [];

export const getTaskSyncQueue = (): TaskSyncQueueItem[] => {
  if (typeof window === 'undefined') return [...memoryTaskSyncQueue];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TASK_SYNC_QUEUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Could not read task sync queue:', e);
  }
  return [...memoryTaskSyncQueue];
};

export const setTaskSyncQueue = (queue: TaskSyncQueueItem[]) => {
  memoryTaskSyncQueue = [...queue];
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_TASK_SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('Could not save task sync queue:', e);
  }
};

export const clearTaskSyncQueue = () => {
  memoryTaskSyncQueue = [];
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LOCAL_STORAGE_TASK_SYNC_QUEUE_KEY);
    } catch {}
  }
};

/**
 * Enqueues or updates a failed write into the persistent retry queue.
 * Idempotently deduplicates by taskId and targetBackend, keeping the newest verified payload.
 */
export const enqueueTaskSyncRetry = (
  task: Task,
  targetBackend: 'firestore' | 'd1' | 'both',
  action: 'create' | 'update' | 'delete' = 'update',
  error?: any
) => {
  const currentQueue = getTaskSyncQueue();
  const queueId = `${task.id}_${targetBackend}`;
  const nowIso = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error || 'Write failed');

  const existingIdx = currentQueue.findIndex(item => 
    item.taskId === task.id && (item.targetBackend === targetBackend || targetBackend === 'both' || item.targetBackend === 'both')
  );

  const newItem: TaskSyncQueueItem = {
    id: queueId,
    taskId: task.id,
    action,
    targetBackend,
    taskPayload: normalizeTaskDateModel(task),
    queuedAt: existingIdx >= 0 ? currentQueue[existingIdx].queuedAt : nowIso,
    attempts: existingIdx >= 0 ? currentQueue[existingIdx].attempts : 0,
    lastError: errorMessage,
    lastAttemptAt: nowIso,
  };

  if (existingIdx >= 0) {
    currentQueue[existingIdx] = newItem;
  } else {
    currentQueue.push(newItem);
  }

  setTaskSyncQueue(currentQueue);
};

/**
 * Removes a task retry entry once successfully synced.
 */
export const dequeueTaskSyncRetry = (taskId: string, targetBackend?: 'firestore' | 'd1' | 'both') => {
  const currentQueue = getTaskSyncQueue();
  const updated = currentQueue.filter(item => {
    if (item.taskId !== taskId) return true;
    if (!targetBackend || targetBackend === 'both') return false;
    return item.targetBackend !== targetBackend && item.targetBackend !== 'both';
  });
  setTaskSyncQueue(updated);
};

/**
 * Processes queued failed writes with exponential backoff / attempt capping.
 * Strictly idempotent: relies on key-based upserts and newest payload preservation.
 */
export const processTaskSyncQueue = async (
  options?: { maxAttempts?: number }
): Promise<{ 
  retriedCount: number; 
  succeededCount: number; 
  failedCount: number; 
  errors: Array<{ taskId: string; backend: string; error: string }> 
}> => {
  const maxAttempts = options?.maxAttempts || 5;
  const currentQueue = getTaskSyncQueue();
  if (currentQueue.length === 0) {
    return { retriedCount: 0, succeededCount: 0, failedCount: 0, errors: [] };
  }

  let succeededCount = 0;
  let failedCount = 0;
  const errors: Array<{ taskId: string; backend: string; error: string }> = [];
  const remainingQueue: TaskSyncQueueItem[] = [];

  for (const item of currentQueue) {
    if (item.attempts >= maxAttempts) {
      remainingQueue.push(item);
      failedCount++;
      continue;
    }

    item.attempts++;
    item.lastAttemptAt = new Date().toISOString();

    let firestoreOk = item.targetBackend !== 'firestore' && item.targetBackend !== 'both';
    let d1Ok = item.targetBackend !== 'd1' && item.targetBackend !== 'both';

    if (!firestoreOk) {
      try {
        if (item.action === 'delete') {
          await setDoc(doc(db, 'tasks', item.taskId), sanitizeFirestorePayload({
            is_deleted: true,
            isArchived: true,
            updatedAt: new Date().toISOString()
          }), { merge: true });
        } else {
          await setDoc(doc(db, 'tasks', item.taskId), sanitizeFirestorePayload(item.taskPayload), { merge: true });
        }
        firestoreOk = true;
      } catch (fsErr: any) {
        item.lastError = `Firestore retry failed: ${fsErr?.message || fsErr}`;
        errors.push({ taskId: item.taskId, backend: 'firestore', error: item.lastError });
      }
    }

    if (!d1Ok) {
      try {
        if (item.action === 'delete') {
          await cfDeleteTask(item.taskId);
        } else if (item.action === 'create') {
          await cfCreateTask(item.taskPayload);
        } else {
          await cfUpdateTask(item.taskId, item.taskPayload);
        }
        d1Ok = true;
      } catch (cfErr: any) {
        item.lastError = `Cloudflare D1 retry failed: ${cfErr?.message || cfErr}`;
        errors.push({ taskId: item.taskId, backend: 'd1', error: item.lastError });
      }
    }

    if (firestoreOk && d1Ok) {
      succeededCount++;
    } else {
      failedCount++;
      if (firestoreOk && !d1Ok) {
        item.targetBackend = 'd1';
      } else if (!firestoreOk && d1Ok) {
        item.targetBackend = 'firestore';
      }
      remainingQueue.push(item);
    }
  }

  setTaskSyncQueue(remainingQueue);
  return { retriedCount: currentQueue.length, succeededCount, failedCount, errors };
};

export interface TaskDualWriteResult {
  success: boolean;
  allBackendsSynced: boolean;
  partialFailure: boolean;
  firestoreStatus: 'success' | 'failed';
  d1Status: 'success' | 'failed';
  firestoreError?: string;
  d1Error?: string;
  retryQueued: boolean;
  task: Task;
}

/**
 * Reliable Dual-Write Core:
 * Executes writes to both Firestore and Cloudflare D1 with Promise.allSettled.
 * Automatically catches partial failures, enqueues idempotent retries,
 * and preserves verified task history.
 */
export async function persistTaskDualWrite(
  taskInput: Task,
  action: 'create' | 'update' = 'update'
): Promise<TaskDualWriteResult> {
  const task = normalizeTaskDateModel(taskInput);

  const [fsResult, d1Result] = await Promise.allSettled([
    setDoc(doc(db, 'tasks', task.id), sanitizeFirestorePayload(task), { merge: true }),
    action === 'create' ? cfCreateTask(task) : cfUpdateTask(task.id, task)
  ]);

  const firestoreStatus: 'success' | 'failed' = fsResult.status === 'fulfilled' ? 'success' : 'failed';
  const d1Status: 'success' | 'failed' = d1Result.status === 'fulfilled' ? 'success' : 'failed';

  const firestoreError = fsResult.status === 'rejected' 
    ? (fsResult.reason instanceof Error ? fsResult.reason.message : String(fsResult.reason))
    : undefined;

  const d1Error = d1Result.status === 'rejected'
    ? (d1Result.reason instanceof Error ? d1Result.reason.message : String(d1Result.reason))
    : undefined;

  const allBackendsSynced = firestoreStatus === 'success' && d1Status === 'success';
  const partialFailure = (firestoreStatus === 'success' && d1Status === 'failed') ||
                         (firestoreStatus === 'failed' && d1Status === 'success');

  let retryQueued = false;

  if (partialFailure) {
    if (d1Status === 'failed') {
      enqueueTaskSyncRetry(task, 'd1', action, d1Error);
      retryQueued = true;
    } else if (firestoreStatus === 'failed') {
      enqueueTaskSyncRetry(task, 'firestore', action, firestoreError);
      retryQueued = true;
    }
  } else if (!allBackendsSynced) {
    // Both backends failed
    enqueueTaskSyncRetry(task, 'both', action, `${firestoreError || ''} | ${d1Error || ''}`);
    retryQueued = true;
  } else {
    // Both succeeded! Dequeue any previous pending retries for this task
    dequeueTaskSyncRetry(task.id);
  }

  // Operation considered functionally successful if at least one backend persisted
  const success = firestoreStatus === 'success' || d1Status === 'success';

  return {
    success,
    allBackendsSynced,
    partialFailure,
    firestoreStatus,
    d1Status,
    firestoreError,
    d1Error,
    retryQueued,
    task
  };
}

/**
 * Calculates next valid working day in YYYY-MM-DD format based on configured working days.
 */
export function getNextWorkingDate(dateStr: string, workingDays: number[] = [1, 2, 3, 4, 5, 6]): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);

  // If already a working day, keep it
  if (workingDays.includes(dateObj.getDay())) {
    return dateStr;
  }

  // Find next working day up to 7 days ahead
  for (let i = 1; i <= 7; i++) {
    const next = new Date(dateObj);
    next.setDate(next.getDate() + i);
    if (workingDays.includes(next.getDay())) {
      const ny = next.getFullYear();
      const nm = String(next.getMonth() + 1).padStart(2, '0');
      const nd = String(next.getDate()).padStart(2, '0');
      return `${ny}-${nm}-${nd}`;
    }
  }

  return dateStr;
}

/**
 * Calculates calendar day difference (targetDate - baseDate)
 */
export function differenceInCalendarDays(targetDateStr: string, baseDateStr: string): number {
  try {
    if (!targetDateStr || !baseDateStr) return 0;
    const [ty, tm, td] = targetDateStr.split('-').map(Number);
    const [by, bm, bd] = baseDateStr.split('-').map(Number);
    const targetUtc = Date.UTC(ty, tm - 1, td);
    const baseUtc = Date.UTC(by, bm - 1, bd);
    const diffMs = targetUtc - baseUtc;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

/**
 * Returns today's date in operational calendar timezone (Asia/Kolkata) as YYYY-MM-DD
 */
export function getTodayDateStr(timeZone: string = 'Asia/Kolkata'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date());
  } catch {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Adds or subtracts days from a YYYY-MM-DD date string
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
  try {
    if (!dateStr) return getTodayDateStr();
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);
    const ny = dateObj.getFullYear();
    const nm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const nd = String(dateObj.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  } catch {
    return dateStr;
  }
}

/**
 * Formats a YYYY-MM-DD date string into human-friendly full, day-of-week, and short representations
 */
export function formatOperationalDate(dateStr: string): { fullDate: string; dayOfWeek: string; shortDate: string } {
  try {
    if (!dateStr) return { fullDate: '', dayOfWeek: '', shortDate: '' };
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const fullDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const shortDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return { fullDate, dayOfWeek, shortDate };
  } catch {
    return { fullDate: dateStr, dayOfWeek: '', shortDate: dateStr };
  }
}

export interface TaskAgeingInfo {
  pendingDays: number;
  isOverdue: boolean;
  overdueDays: number;
  isRolledOver: boolean;
  scheduledBadge: string;
  pendingBadge: string;
  pendingColorClass: string;
  overdueBadge: string | null;
  rolloverBadge: string | null;
  effectiveWorkingDate: string;
}

/**
 * Calculates pending age, overdue status, and controlled color-coded badges
 */
export function getTaskAgeingInfo(task: Task, todayStr: string = new Date().toISOString().split('T')[0]): TaskAgeingInfo {
  const normStatus = normalizeTaskStatus(task.status);
  const isDone = normStatus === 'Done';

  const scheduledDate = task.scheduledDate || task.scheduled_date || todayStr;
  const dueDate = task.dueDate || task.due_date || scheduledDate;
  const pendingSince = task.firstPendingSince || task.first_pending_since || task.originalScheduledDate || task.original_scheduled_date || scheduledDate;

  // Pending days calculation from first_pending_since to today
  let pendingDays = 0;
  if (!isDone) {
    const rawDiff = differenceInCalendarDays(todayStr, pendingSince);
    pendingDays = Math.max(0, rawDiff);
  }

  // Overdue calculation from due_date to today
  const overdueDiff = differenceInCalendarDays(todayStr, dueDate);
  const isOverdue = !isDone && overdueDiff > 0;
  const overdueDays = isOverdue ? overdueDiff : 0;

  const rolloverCount = task.rolloverCount || task.rollover_count || 0;
  const isRolledOver = rolloverCount > 0 || (task.originalScheduledDate && task.originalScheduledDate < scheduledDate);

  // Scheduled date human label
  let scheduledBadge = scheduledDate;
  if (scheduledDate === todayStr) {
    scheduledBadge = 'Today';
  } else if (differenceInCalendarDays(scheduledDate, todayStr) === 1) {
    scheduledBadge = 'Tomorrow';
  } else {
    try {
      const [y, m, d] = scheduledDate.split('-').map(Number);
      scheduledBadge = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {}
  }

  // Pending badge text and controlled color styling
  let pendingBadge = 'Today';
  let pendingColorClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300';

  if (pendingDays === 0) {
    pendingBadge = 'Today';
    pendingColorClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300';
  } else if (pendingDays === 1) {
    pendingBadge = '1 Day Pending';
    pendingColorClass = 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300';
  } else if (pendingDays >= 2 && pendingDays <= 3) {
    pendingBadge = `${pendingDays} Days Pending`;
    pendingColorClass = 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300';
  } else if (pendingDays >= 4 && pendingDays <= 6) {
    pendingBadge = `${pendingDays} Days Pending`;
    pendingColorClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300';
  } else {
    pendingBadge = `${pendingDays}+ Days Pending`;
    pendingColorClass = 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 font-black';
  }

  // Overdue badge text
  const overdueBadge = isOverdue ? `${overdueDays} Day${overdueDays > 1 ? 's' : ''} Overdue` : null;

  // Rollover badge text
  const rolloverBadge = isRolledOver ? `Carried Forward · ${rolloverCount > 0 ? `${rolloverCount}d` : 'Active'}` : null;

  return {
    pendingDays,
    isOverdue,
    overdueDays,
    isRolledOver: !!isRolledOver,
    scheduledBadge,
    pendingBadge,
    pendingColorClass,
    overdueBadge,
    rolloverBadge,
    effectiveWorkingDate: scheduledDate,
  };
}

/**
 * Automatic Rollover Engine
 * At app evaluation or start of day, finds unfinished tasks whose scheduled_date is before today.
 * Preserves original_scheduled_date, original_due_date, due_date and first_pending_since.
 * Updates scheduled_date to today's working day without creating duplicate tasks.
 */
export async function evaluateTaskRollovers(
  tasks: Task[], 
  settings: RolloverSettings = getRolloverSettings()
): Promise<{ updatedTasks: Task[]; rolledOverCount: number }> {
  if (!settings.automaticRollover) {
    return { updatedTasks: tasks, rolledOverCount: 0 };
  }

  const nowIso = new Date().toISOString();
  const todayStr = getTodayDateStr('Asia/Kolkata');
  const targetWorkingDate = getNextWorkingDate(todayStr, settings.workingDays);

  const updatedTasks: Task[] = [];
  const modifiedTasksToPersist: Task[] = [];
  let count = 0;

  for (const rawTask of tasks) {
    const task = normalizeTaskDateModel(rawTask);
    const normStatus = normalizeTaskStatus(task.status);
    const isFinished = normStatus === 'Done' || task.status === 'Cancelled' || !!task.isArchived || !!task.is_deleted;
    const lastRolloverDate = (task.lastRolloverAt || task.last_rollover_at || '').slice(0, 10);

    // Strictly unfinished tasks whose scheduled_date is prior to today and NOT already rolled over today
    if (!isFinished && task.scheduledDate < todayStr && lastRolloverDate !== todayStr) {
      const origScheduled = task.originalScheduledDate || task.scheduledDate;
      const origDue = task.originalDueDate || task.dueDate;
      const firstPending = task.firstPendingSince || origScheduled;
      const currentCount = task.rolloverCount || 0;

      const rolledTask: Task = {
        ...task,
        scheduledDate: targetWorkingDate,
        scheduled_date: targetWorkingDate,
        originalScheduledDate: origScheduled,
        original_scheduled_date: origScheduled,
        originalDueDate: origDue,
        original_due_date: origDue,
        firstPendingSince: firstPending,
        first_pending_since: firstPending,
        rolloverCount: currentCount + 1,
        rollover_count: currentCount + 1,
        lastRolloverAt: nowIso,
        last_rollover_at: nowIso,
        updatedAt: nowIso,
      };

      updatedTasks.push(rolledTask);
      modifiedTasksToPersist.push(rolledTask);
      count++;
    } else {
      updatedTasks.push(task);
    }
  }

  if (modifiedTasksToPersist.length > 0) {
    // 1. Update Local Cache immediately
    setCachedTasks(updatedTasks);

    // 2. Persist to Firestore and Cloudflare D1 with Promise.allSettled and retry queue
    const partialFailures: Array<{ taskId: string; backend: 'firestore' | 'd1'; error: string }> = [];
    let failedCount = 0;

    const persistenceResults = await Promise.allSettled(
      modifiedTasksToPersist.map(t => persistTaskDualWrite(t, 'update'))
    );

    for (let i = 0; i < persistenceResults.length; i++) {
      const res = persistenceResults[i];
      const t = modifiedTasksToPersist[i];
      if (res.status === 'fulfilled') {
        if (res.value.partialFailure) {
          partialFailures.push({
            taskId: t.id,
            backend: res.value.d1Status === 'failed' ? 'd1' : 'firestore',
            error: res.value.d1Error || res.value.firestoreError || 'Partial rollover sync failure'
          });
        }
      } else {
        failedCount++;
        enqueueTaskSyncRetry(t, 'both', 'update', res.reason);
      }
    }

    return { updatedTasks, rolledOverCount: count, partialFailures, failedCount };
  }

  return { updatedTasks, rolledOverCount: count, partialFailures: [], failedCount: 0 };
}

let memoryCachedTasks: Task[] = [];

/**
 * Loads tasks immediately from local cache with automatic date normalization
 */
export const getCachedTasks = (): Task[] => {
  if (typeof window === 'undefined') {
    return (memoryCachedTasks.length > 0 ? memoryCachedTasks : DEFAULT_MASTER_TASKS).map(normalizeTaskDateModel);
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TASKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter(t => !t.isArchived && !t.is_deleted && t.status !== 'Cancelled')
          .map(normalizeTaskDateModel);
      }
    }
  } catch (e) {
    console.warn('Could not read cached tasks:', e);
  }
  return DEFAULT_MASTER_TASKS.map(normalizeTaskDateModel);
};

/**
 * Updates local cache with full task list
 */
export const setCachedTasks = (tasks: Task[]) => {
  const normalized = tasks.map(normalizeTaskDateModel);
  memoryCachedTasks = [...normalized];
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_TASKS_KEY, JSON.stringify(normalized));
  } catch (e) {
    console.warn('Could not write cached tasks:', e);
  }
};

/**
 * Creates and persists a new task in Firestore and Local Cache
 */
export const persistNewTask = async (
  taskInput: Partial<Task>,
  userProfile?: { uid?: string; name?: string }
): Promise<Task> => {
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split('T')[0];
  const taskId = taskInput.id || taskInput.taskId || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const scheduledDate = taskInput.scheduledDate || taskInput.scheduled_date || todayStr;
  const dueDate = taskInput.dueDate || taskInput.due_date || scheduledDate;

  const rawTask: Task = {
    id: taskId,
    taskId: taskId,
    title: (taskInput.title || 'Untitled Task').trim(),
    description: (taskInput.description || '').trim(),
    clientId: taskInput.clientId || '',
    clientName: taskInput.clientName || (taskInput.clientId ? 'Client' : 'Direct'),
    category: taskInput.category || 'General',
    platform: taskInput.platform || '',
    assigneeId: taskInput.assigneeId || '',
    assigneeName: taskInput.assigneeName || (taskInput.assigneeId ? 'Assigned' : 'Unassigned'),
    assignedById: userProfile?.uid || taskInput.assignedById || '',
    assignedByName: userProfile?.name || taskInput.assignedByName || 'Admin',
    priority: (taskInput.priority as any) || 'Medium',
    scheduledDate: scheduledDate,
    dueDate: dueDate,
    originalScheduledDate: taskInput.originalScheduledDate || scheduledDate,
    originalDueDate: taskInput.originalDueDate || dueDate,
    firstPendingSince: taskInput.firstPendingSince || scheduledDate,
    rolloverCount: taskInput.rolloverCount || 0,
    status: normalizeTaskStatus(taskInput.status || 'To Do'),
    internalNotes: (taskInput.internalNotes || '').trim(),
    createdAt: taskInput.createdAt || nowIso,
    updatedAt: nowIso,
    isArchived: false,
    videoProductionId: taskInput.videoProductionId,
    videoTrackerId: taskInput.videoTrackerId,
    productionRole: taskInput.productionRole,
    blockedByShoot: taskInput.blockedByShoot,
  };

  const newTask = normalizeTaskDateModel(rawTask);

  // 1. Update Local Storage Cache immediately
  const currentCached = getCachedTasks();
  const updatedCache = [newTask, ...currentCached.filter(t => t.id !== taskId)];
  setCachedTasks(updatedCache);

  // 2. Reliable Dual-Backend Persistence
  const writeRes = await persistTaskDualWrite(newTask, 'create');
  if (!writeRes.success) {
    console.warn('Backend persistence error for new task (queued for retry):', writeRes.firestoreError, writeRes.d1Error);
  }

  try {

    // 3. Write activity log & emit workspace events
    try {
      await addDoc(collection(db, 'activityLogs'), {
        userId: userProfile?.uid || '',
        userName: userProfile?.name || 'Admin',
        action: `created task "${newTask.title}"`,
        details: `Scheduled: ${newTask.scheduledDate} · Deadline: ${newTask.dueDate} · Assignee: ${newTask.assigneeName}`,
        createdAt: nowIso,
      });
    } catch (e) {}

    // Emit Canonical Workspace Events (triggers AuditLog and NotificationService)
    try {
      const recipientId = newTask.assigneeId || newTask.assignee_id || newTask.assigned_employee_id;
      await WorkspaceEventService.emit({
        eventType: 'task.created',
        entityType: 'task',
        entityId: newTask.id,
        actorId: userProfile?.uid || 'admin',
        actorName: userProfile?.name || 'Admin',
        actorRole: 'admin',
        clientId: newTask.clientId,
        targetMemberIds: recipientId ? [recipientId] : [],
        metadata: {
          taskTitle: newTask.title,
          clientName: newTask.clientName,
          dueDate: newTask.dueDate,
          scheduledDate: newTask.scheduledDate,
          priority: newTask.priority,
          assigneeName: newTask.assigneeName
        },
        customDescription: `Created task "${newTask.title}" for ${newTask.clientName || 'General'} (Assignee: ${newTask.assigneeName || 'Unassigned'})`
      });

      if (recipientId) {
        await WorkspaceEventService.emit({
          eventType: 'task.assigned',
          entityType: 'task',
          entityId: newTask.id,
          actorId: userProfile?.uid || 'admin',
          actorName: userProfile?.name || 'Admin',
          actorRole: 'admin',
          clientId: newTask.clientId,
          targetMemberIds: [recipientId],
          metadata: {
            taskTitle: newTask.title,
            clientName: newTask.clientName,
            dueDate: newTask.dueDate,
            scheduledDate: newTask.scheduledDate,
            assigneeName: newTask.assigneeName
          }
        });
      }
    } catch (evtErr) {
      console.warn('WorkspaceEvent emission notice:', evtErr);
    }

    // 4. Auto-sync to Work Log if status is Done
    if (newTask.status === 'Done') {
      try {
        const { syncTaskCompletionToWorkLog } = await import('./taskWorkLogSync');
        syncTaskCompletionToWorkLog(
          {
            taskId: newTask.id,
            title: newTask.title,
            description: newTask.description,
            clientId: newTask.clientId,
            clientName: newTask.clientName,
            assigneeId: newTask.assigneeId,
            assigneeName: newTask.assigneeName,
            category: newTask.category || 'Other',
            quantity: 1,
            completedAt: newTask.completedAt || nowIso,
            source: 'task_completion',
            videoProductionId: newTask.videoProductionId,
          },
          userProfile,
          userProfile?.uid
        ).catch(console.warn);
      } catch (workLogErr) {
        console.warn('Work Log auto-sync notice on task creation:', workLogErr);
      }
    }

    // 5. Auto-sync to Approvals Queue if status is In Review
    if (newTask.status === 'In Review') {
      try {
        const { createOrUpdateApprovalFromSource } = await import('./approvalStorage');
        await createOrUpdateApprovalFromSource('task', newTask, { userId: userProfile?.uid, name: userProfile?.name });
      } catch (apprErr) {
        console.warn('Approvals auto-sync notice:', apprErr);
      }
    }
  } catch (err) {
    console.warn('Firestore write warning for task (cached locally):', err);
  }

  return newTask;
};

/**
 * Updates an existing task in Firestore and Local Cache
 */
export const persistUpdateTask = async (
  taskId: string,
  updates: Partial<Task>,
  userProfile?: { uid?: string; name?: string }
): Promise<Task | null> => {
  const nowIso = new Date().toISOString();
  const currentCached = getCachedTasks();
  const target = currentCached.find(t => t.id === taskId);

  const merged = target ? {
    ...target,
    ...updates,
    updatedAt: nowIso,
    ...(updates.status ? { status: normalizeTaskStatus(updates.status) } : {}),
    ...(updates.status === 'Done' ? { completedAt: target.completedAt || nowIso } : {}),
  } : {
    id: taskId,
    title: updates.title || 'Task',
    status: normalizeTaskStatus(updates.status || 'To Do'),
    priority: updates.priority || 'Medium',
    scheduledDate: updates.scheduledDate || new Date().toISOString().split('T')[0],
    dueDate: updates.dueDate || updates.scheduledDate || new Date().toISOString().split('T')[0],
    createdAt: nowIso,
    updatedAt: nowIso,
    ...updates,
  };

  const updatedTask = normalizeTaskDateModel(merged);

  // 1. Update Local Cache
  const updatedList = currentCached.map(t => t.id === taskId ? updatedTask : t);
  if (!target) updatedList.unshift(updatedTask);
  setCachedTasks(updatedList);

  // 2. Reliable Dual-Backend Persistence
  const writeRes = await persistTaskDualWrite(updatedTask, 'update');
  if (!writeRes.success) {
    console.warn('Backend persistence error for task update (queued for retry):', writeRes.firestoreError, writeRes.d1Error);
  }

  try {

    // 3. Auto-sync to Approvals Queue if status is In Review
    if (updatedTask.status === 'In Review') {
      try {
        const { createOrUpdateApprovalFromSource } = await import('./approvalStorage');
        await createOrUpdateApprovalFromSource('task', updatedTask, { userId: userProfile?.uid, name: userProfile?.name });
      } catch (apprErr) {
        console.warn('Approvals auto-sync notice on task update:', apprErr);
      }
    }
  } catch (err) {
    console.warn('Firestore update warning for task (cached locally):', err);
  }

  return updatedTask;
};

/**
 * Bulk Reschedule Tasks (Super Admin operation)
 * Modifies scheduledDate while keeping original due date and auditing each task.
 */
export interface BulkRescheduleResult {
  updatedCount: number;
  successCount: number;
  failureCount: number;
  partialFailures: Array<{ taskId: string; backend: 'firestore' | 'd1'; error: string }>;
}

export const bulkRescheduleTasks = async (
  taskIds: string[],
  newScheduledDate: string,
  userProfile?: { uid?: string; name?: string }
): Promise<BulkRescheduleResult> => {
  if (!taskIds || taskIds.length === 0 || !newScheduledDate) {
    return { updatedCount: 0, successCount: 0, failureCount: 0, partialFailures: [] };
  }
  const nowIso = new Date().toISOString();
  const currentCached = getCachedTasks();
  let updatedCount = 0;

  const tasksToPersist: Task[] = [];
  const updatedList = currentCached.map(task => {
    if (taskIds.includes(task.id)) {
      updatedCount++;
      const updated = normalizeTaskDateModel({
        ...task,
        scheduledDate: newScheduledDate,
        scheduled_date: newScheduledDate,
        updatedAt: nowIso,
      });
      tasksToPersist.push(updated);
      return updated;
    }
    return task;
  });

  setCachedTasks(updatedList);

  const partialFailures: Array<{ taskId: string; backend: 'firestore' | 'd1'; error: string }> = [];
  let successCount = 0;
  let failureCount = 0;

  const writePromises = tasksToPersist.map(async (target) => {
    const writeRes = await persistTaskDualWrite(target, 'update');
    if (writeRes.success) {
      successCount++;
      if (writeRes.partialFailure) {
        partialFailures.push({
          taskId: target.id,
          backend: writeRes.d1Status === 'failed' ? 'd1' : 'firestore',
          error: writeRes.d1Error || writeRes.firestoreError || 'Partial sync failure'
        });
      }
    } else {
      failureCount++;
    }

    addDoc(collection(db, 'activityLogs'), {
      userId: userProfile?.uid || '',
      userName: userProfile?.name || 'Super Admin',
      action: `rescheduled task "${target.title}" to ${newScheduledDate}`,
      details: `Original Scheduled: ${target.originalScheduledDate || 'N/A'} · Due: ${target.dueDate}`,
      createdAt: nowIso,
    }).catch(() => {});
  });

  await Promise.allSettled(writePromises);

  return {
    updatedCount,
    successCount,
    failureCount,
    partialFailures
  };
};

export interface TaskTransitionResult {
  success: boolean;
  task: Task | null;
  message: string;
  allBackendsSynced?: boolean;
  partialFailure?: boolean;
  backendSync?: {
    firestore: 'success' | 'failed';
    d1: 'success' | 'failed';
    firestoreError?: string;
    d1Error?: string;
  };
}

/**
 * Canonical Single Status Transition Engine
 * Used by Arrows, Drag-and-Drop, Dropdowns, My Day, Calendar, and Approvals.
 */
export const transitionTaskStatus = async (
  taskId: string,
  targetStatus: 'To Do' | 'In Progress' | 'In Review' | 'Done' | 'Cancelled',
  source: 'drag_drop' | 'left_arrow' | 'right_arrow' | 'status_dropdown' | 'bulk_action' | 'approval_sync' | 'calendar_action',
  userProfile?: { uid?: string; name?: string; role?: string }
): Promise<TaskTransitionResult> => {
  const currentCached = getCachedTasks();
  const targetTask = currentCached.find(t => t.id === taskId);
  if (!targetTask) {
    return { success: false, task: null, message: 'Task not found' };
  }

  const previousStatus = normalizeTaskStatus(targetTask.status);
  const newStatus = normalizeTaskStatus(targetStatus);

  if (previousStatus === newStatus) {
    return { 
      success: true, 
      task: targetTask, 
      message: 'Status unchanged',
      allBackendsSynced: true,
      partialFailure: false,
      backendSync: { firestore: 'success', d1: 'success' }
    };
  }

  const nowIso = new Date().toISOString();
  const isNowDone = newStatus === 'Done';
  const wasDone = previousStatus === 'Done';

  const updatedTask = normalizeTaskDateModel({
    ...targetTask,
    status: newStatus,
    updatedAt: nowIso,
    ...(isNowDone ? {
      completedAt: targetTask.completedAt || nowIso,
      completed_at: targetTask.completedAt || nowIso,
    } : {}),
    ...(wasDone && !isNowDone ? {
      // Reopening task: record history and remove active completion
      completedAt: undefined,
      completed_at: undefined,
      lastCompletedAt: targetTask.completedAt || targetTask.completed_at,
      reopenedAt: nowIso,
      reopened_at: nowIso,
      taskReopened: true,
      task_reopened: true,
    } : {}),
  });

  // 1. Optimistic local cache update
  const updatedList = currentCached.map(t => t.id === taskId ? updatedTask : t);
  setCachedTasks(updatedList);

  // 2. Reliable Dual-Backend Persistence
  const writeRes = await persistTaskDualWrite(updatedTask, 'update');

  // If both backends fail to persist, rollback local cache and report error explicitly
  if (!writeRes.success) {
    console.error('Failed to persist task status to server database:', writeRes.firestoreError, writeRes.d1Error);
    setCachedTasks(currentCached);
    return {
      success: false,
      task: targetTask,
      message: 'Failed to persist status change to server database',
      allBackendsSynced: false,
      partialFailure: false,
      backendSync: {
        firestore: writeRes.firestoreStatus,
        d1: writeRes.d1Status,
        firestoreError: writeRes.firestoreError,
        d1Error: writeRes.d1Error
      }
    };
  }

  // 3. Audit Log & Workspace Event
  try {
    await addDoc(collection(db, 'activityLogs'), {
      userId: userProfile?.uid || '',
      userName: userProfile?.name || 'Team Member',
      action: wasDone && !isNowDone
        ? `reopened task "${updatedTask.title}" from Done to ${newStatus} (${source})`
        : `moved task "${updatedTask.title}" from ${previousStatus} to ${newStatus} (${source})`,
      details: `Client: ${updatedTask.clientName} · Assignee: ${updatedTask.assigneeName}`,
      createdAt: nowIso,
    });

    await WorkspaceEventService.emit({
      eventType: isNowDone ? 'task.completed' : 'task.status_changed',
      entityType: 'task',
      entityId: updatedTask.id,
      actorId: userProfile?.uid || 'admin',
      actorName: userProfile?.name || 'Team Member',
      actorRole: userProfile?.role || 'employee',
      clientId: updatedTask.clientId,
      targetMemberIds: updatedTask.assigneeId ? [updatedTask.assigneeId] : [],
      metadata: {
        taskTitle: updatedTask.title,
        previousStatus,
        newStatus,
        clientName: updatedTask.clientName,
        assigneeName: updatedTask.assigneeName,
        source
      },
      customDescription: wasDone && !isNowDone
        ? `Task "${updatedTask.title}" was reopened to ${newStatus} by ${userProfile?.name || 'User'}`
        : `Task "${updatedTask.title}" moved from ${previousStatus} to ${newStatus} (${source}) by ${userProfile?.name || 'User'}`
    });
  } catch (e) {}

  // 4. Handle Done -> Work Log idempotent synchronization
  if (isNowDone) {
    try {
      const { syncTaskCompletionToWorkLog } = await import('./taskWorkLogSync');
      await syncTaskCompletionToWorkLog(
        {
          taskId: updatedTask.id,
          title: updatedTask.title,
          description: updatedTask.description,
          clientId: updatedTask.clientId,
          clientName: updatedTask.clientName,
          assigneeId: updatedTask.assigneeId,
          assigneeName: updatedTask.assigneeName,
          category: updatedTask.category || 'Other',
          quantity: 1,
          completedAt: updatedTask.completedAt,
          source: 'task_completion',
          videoProductionId: updatedTask.videoProductionId,
        },
        userProfile,
        userProfile?.uid
      );
    } catch (workLogErr) {
      console.warn('Work Log sync notice:', workLogErr);
    }
  } else if (wasDone && !isNowDone) {
    // Reopening task: update linked work logs
    try {
      const { syncTaskReopenedState } = await import('./taskWorkLogSync');
      await syncTaskReopenedState(taskId);
    } catch (reopenErr) {
      console.warn('Task reopen notice:', reopenErr);
    }
  }

  // 5. Handle In Review -> Approvals synchronization
  if (newStatus === 'In Review') {
    try {
      const { createOrUpdateApprovalFromSource } = await import('./approvalStorage');
      await createOrUpdateApprovalFromSource('task', updatedTask, { 
        userId: userProfile?.uid, 
        name: userProfile?.name 
      });
    } catch (apprErr) {
      console.warn('Approvals sync notice:', apprErr);
    }
  }

  // 6. Handle linked Video Production sync
  if (updatedTask.videoProductionId || updatedTask.videoTrackerId) {
    try {
      const { syncTaskToVideoProduction } = await import('./productionBridge');
      await syncTaskToVideoProduction(updatedTask, targetTask, userProfile);
    } catch (vidErr) {
      console.warn('Video production bridge sync notice:', vidErr);
    }
  }

  let statusMessage = isNowDone 
    ? 'Task completed & Work Log synced' 
    : (wasDone && !isNowDone ? `Task reopened to ${newStatus}` : `Moved to ${newStatus}`);

  if (writeRes.partialFailure) {
    const failedBackend = writeRes.d1Status === 'failed' ? 'Cloudflare D1' : 'Firestore';
    statusMessage += ` (${failedBackend} sync queued for background retry)`;
  }

  return { 
    success: true, 
    task: updatedTask, 
    message: statusMessage,
    allBackendsSynced: writeRes.allBackendsSynced,
    partialFailure: writeRes.partialFailure,
    backendSync: {
      firestore: writeRes.firestoreStatus,
      d1: writeRes.d1Status,
      firestoreError: writeRes.firestoreError,
      d1Error: writeRes.d1Error
    }
  };
};

/**
 * Safely Archives or Soft-Deletes a task with audit event emission.
 * Preserves historical Work Logs and audit history.
 */
export const persistDeleteTask = async (
  taskId: string,
  userProfile?: { uid?: string; name?: string; role?: string },
  options?: { softDelete?: boolean }
): Promise<boolean> => {
  const currentCached = getCachedTasks();
  const targetTask = currentCached.find(t => t.id === taskId);
  const updatedList = currentCached.filter(t => t.id !== taskId);
  setCachedTasks(updatedList);

  const nowIso = new Date().toISOString();
  const actorName = userProfile?.name || 'User';
  const actorId = userProfile?.uid || 'admin';
  const actorRole = userProfile?.role || 'employee';

  try {
    const [d1Res, fsRes] = await Promise.allSettled([
      cfDeleteTask(taskId),
      options?.softDelete !== false
        ? setDoc(doc(db, 'tasks', taskId), sanitizeFirestorePayload({
            is_deleted: true,
            isArchived: true,
            deleted_at: nowIso,
            deleted_by: actorName,
            deleted_by_id: actorId,
            updatedAt: nowIso
          }), { merge: true })
        : deleteDoc(doc(db, 'tasks', taskId))
    ]);

    if (d1Res.status === 'rejected') {
      enqueueTaskSyncRetry({ id: taskId } as Task, 'd1', 'delete', d1Res.reason);
    }
    if (fsRes.status === 'rejected') {
      enqueueTaskSyncRetry({ id: taskId } as Task, 'firestore', 'delete', fsRes.reason);
    }

    // Audit Event: task.deleted and activityLog
    try {
      await addDoc(collection(db, 'activityLogs'), {
        userId: actorId,
        userName: actorName,
        action: `deleted task "${targetTask?.title || taskId}"`,
        details: `Client: ${targetTask?.clientName || 'N/A'} · Assignee: ${targetTask?.assigneeName || 'N/A'}`,
        createdAt: nowIso,
      });

      await WorkspaceEventService.emit({
        eventType: 'task.deleted',
        entityType: 'task',
        entityId: taskId,
        actorId,
        actorName,
        actorRole,
        clientId: targetTask?.clientId,
        targetMemberIds: targetTask?.assigneeId ? [targetTask.assigneeId] : [],
        metadata: {
          taskId,
          taskTitle: targetTask?.title || 'Task',
          clientName: targetTask?.clientName,
          assigneeName: targetTask?.assigneeName,
          deletedAt: nowIso,
        },
        customDescription: `Task "${targetTask?.title || taskId}" was deleted by ${actorName}`
      });
    } catch (e) {
      console.warn('Task delete audit warning:', e);
    }

    return true;
  } catch (err) {
    console.warn('Firestore delete error for task (removed locally):', err);
    return false;
  }
};

/**
 * Duplicates a task for quick operational cloning
 */
export const duplicateTask = async (
  sourceTaskId: string,
  targetScheduledDate?: string,
  userProfile?: { uid?: string; name?: string; role?: string }
): Promise<Task | null> => {
  const currentCached = getCachedTasks();
  const source = currentCached.find(t => t.id === sourceTaskId);
  if (!source) return null;

  const targetDate = targetScheduledDate || getTodayDateStr();
  const clonedData: Partial<Task> = {
    title: `${source.title} (Copy)`,
    description: source.description,
    clientId: source.clientId,
    clientName: source.clientName,
    category: source.category,
    platform: source.platform,
    assigneeId: source.assigneeId,
    assigneeName: source.assigneeName,
    assigned_employee_id: source.assigned_employee_id,
    priority: source.priority,
    scheduledDate: targetDate,
    dueDate: source.dueDate || targetDate,
    status: 'To Do',
    internalNotes: source.internalNotes,
    videoProductionId: source.videoProductionId,
    videoTrackerId: source.videoTrackerId,
    productionRole: source.productionRole,
    blockedByShoot: source.blockedByShoot,
  };

  return await persistNewTask(clonedData, userProfile);
};

/**
 * Sets up a live Firestore snapshot listener with local cache fallback & automatic hydration
 */
export const subscribeToCanonicalTasks = (
  onUpdate: (tasks: Task[]) => void
): (() => void) => {
  // 1. Emit initial cached tasks immediately with date normalization
  let currentTasks = getCachedTasks();
  onUpdate(currentTasks);

  // Safely process any pending retries from prior offline/failed operations
  processTaskSyncQueue().catch(console.warn);

  // 2. Evaluate rollovers on initial load safely (once per business day)
  evaluateTaskRollovers(currentTasks).then(({ updatedTasks, rolledOverCount }) => {
    if (rolledOverCount > 0) {
      currentTasks = updatedTasks;
      onUpdate(currentTasks);
    }
  }).catch(console.warn);

  // 3. Live Sync from Cloudflare D1 database with deterministic conflict resolution
  cfGetTasks().then((cfList) => {
    if (!Array.isArray(cfList) || cfList.length === 0) return;

    const cachedBefore = getCachedTasks();
    const taskMap = new Map<string, Task>();
    for (const t of cachedBefore) {
      taskMap.set(t.id, t);
    }

    const tasksToHealInD1: Task[] = [];

    for (const rawCf of cfList) {
      const cfTask = normalizeTaskDateModel(rawCf);
      const existing = taskMap.get(cfTask.id);

      if (!existing) {
        taskMap.set(cfTask.id, cfTask);
      } else {
        const { merged, shouldSyncToD1 } = mergeTaskRecords(existing, cfTask);
        taskMap.set(cfTask.id, merged);
        if (shouldSyncToD1) {
          tasksToHealInD1.push(merged);
        }
      }
    }

    const reconciledList = Array.from(taskMap.values());
    setCachedTasks(reconciledList);
    currentTasks = reconciledList;
    onUpdate(reconciledList);

    // Heal stale records in D1 in the background with retry fallback
    if (tasksToHealInD1.length > 0) {
      for (const t of tasksToHealInD1) {
        cfUpdateTask(t.id, t).catch((err) => {
          enqueueTaskSyncRetry(t, 'd1', 'update', err);
        });
      }
    }
  }).catch(console.warn);

  // 4. Real-time Firestore Snapshot Listener with deterministic merging
  const unsub = onSnapshot(collection(db, 'tasks'), async (snapshot) => {
    if (!snapshot.empty) {
      const cachedBefore = getCachedTasks();
      const taskMap = new Map<string, Task>();
      for (const t of cachedBefore) {
        taskMap.set(t.id, t);
      }

      const tasksToHealInD1: Task[] = [];

      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (!d.isArchived && !d.is_deleted && d.status !== 'Cancelled') {
          const fsTask = normalizeTaskDateModel({ id: docSnap.id, taskId: docSnap.id, ...d });
          const existing = taskMap.get(fsTask.id);
          if (!existing) {
            taskMap.set(fsTask.id, fsTask);
          } else {
            const { merged, shouldSyncToD1 } = mergeTaskRecords(existing, fsTask);
            taskMap.set(fsTask.id, merged);
            if (shouldSyncToD1) {
              tasksToHealInD1.push(merged);
            }
          }
        }
      });

      const reconciledList = Array.from(taskMap.values());
      const { updatedTasks } = await evaluateTaskRollovers(reconciledList);
      setCachedTasks(updatedTasks);
      currentTasks = updatedTasks;
      onUpdate(updatedTasks);

      // Heal stale records in D1 in background with retry fallback
      if (tasksToHealInD1.length > 0) {
        for (const t of tasksToHealInD1) {
          cfUpdateTask(t.id, t).catch((err) => {
            enqueueTaskSyncRetry(t, 'd1', 'update', err);
          });
        }
      }
      return;
    }

    // If Firestore collection is empty, check cache or seed
    const cached = getCachedTasks();
    if (cached.length > 0) {
      onUpdate(cached);
    } else {
      const seeded = DEFAULT_MASTER_TASKS.map(normalizeTaskDateModel);
      setCachedTasks(seeded);
      onUpdate(seeded);
    }
  }, (err) => {
    console.warn('Tasks listener notice (using resilient local cache):', err);
    const cached = getCachedTasks();
    onUpdate(cached);
  });

  return unsub;
};
