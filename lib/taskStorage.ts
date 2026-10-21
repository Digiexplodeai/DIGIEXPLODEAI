/**
 * DigiExplodeAI — Task Storage & Sync Engine
 * Database Backend: Cloudflare D1 (via Cloudflare Worker API)
 * Local Cache: localStorage (optimistic layer for 0ms UI updates)
 *
 * FIRESTORE IS NOT USED FOR DATA STORAGE.
 * Firebase is only used for Authentication (see lib/firebase.ts auth export).
 */

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

  // Compatibility snake_case aliases
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

    // A task can ONLY be legitimately reopened if explicit reopen markers are present
    const incomingReopenedTime = normIncoming.reopenedAt ? new Date(normIncoming.reopenedAt).getTime() : 0;
    const isExplicitReopen = !!normIncoming.taskReopened ||
      (incomingReopenedTime > 0 && incomingReopenedTime >= existingCompletedTime);

    if (isExplicitReopen) {
      // User legitimately reopened the task
      return { merged: normIncoming, shouldSyncToD1: false };
    } else {
      // Incoming is a stale non-Done record — NEVER overwrite verified Done tasks!
      const merged: Task = {
        ...normIncoming,
        status: 'Done',
        completedAt: normExisting.completedAt || normExisting.updatedAt,
        completed_at: normExisting.completed_at || normExisting.completedAt || normExisting.updatedAt,
        updatedAt: normExisting.updatedAt,
      };
      return { merged, shouldSyncToD1: true };
    }
  }

  if (!isExistingDone && isIncomingDone) {
    const existingReopenedTime = normExisting.reopenedAt ? new Date(normExisting.reopenedAt).getTime() : 0;
    const incomingCompletedTime = new Date(normIncoming.completedAt || normIncoming.updatedAt || 0).getTime();

    // Check if existing was legitimately reopened after incoming completion
    const isExplicitExistingReopen = !!normExisting.taskReopened ||
      (existingReopenedTime > 0 && existingReopenedTime >= incomingCompletedTime);

    if (isExplicitExistingReopen) {
      return { merged: normExisting, shouldSyncToD1: true };
    } else {
      // Incoming is completed and verified — accept incoming Done
      return { merged: normIncoming, shouldSyncToD1: true };
    }
  }

  // Case 2: Both have the same completion state — latest timestamp wins
  if (incomingTime > existingTime) {
    return { merged: normIncoming, shouldSyncToD1: false };
  } else if (existingTime > incomingTime) {
    return { merged: normExisting, shouldSyncToD1: true };
  }

  // Exact same timestamp: merge cleanly, prefer existing
  return {
    merged: {
      ...normIncoming,
      ...normExisting,
      status: (isExistingDone || isIncomingDone) ? 'Done' : normExisting.status,
      completedAt: normExisting.completedAt || normIncoming.completedAt,
    },
    shouldSyncToD1: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// D1 RETRY QUEUE (for failed D1 writes only)
// ─────────────────────────────────────────────────────────────────────────────

export interface TaskSyncQueueItem {
  id: string;
  taskId: string;
  action: 'create' | 'update' | 'delete';
  taskPayload: Task;
  queuedAt: string;
  attempts: number;
  lastError?: string;
  lastAttemptAt?: string;
}

export const LOCAL_STORAGE_TASK_SYNC_QUEUE_KEY = 'digi_task_sync_queue_v2';

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
 * Enqueues or updates a failed D1 write into the persistent retry queue.
 */
export const enqueueTaskSyncRetry = (
  task: Task,
  action: 'create' | 'update' | 'delete' = 'update',
  error?: any
) => {
  const currentQueue = getTaskSyncQueue();
  const queueId = `${task.id}_d1`;
  const nowIso = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error || 'D1 write failed');

  const existingIdx = currentQueue.findIndex(item => item.taskId === task.id);

  const newItem: TaskSyncQueueItem = {
    id: queueId,
    taskId: task.id,
    action,
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
export const dequeueTaskSyncRetry = (taskId: string) => {
  const currentQueue = getTaskSyncQueue();
  const updated = currentQueue.filter(item => item.taskId !== taskId);
  setTaskSyncQueue(updated);
};

/**
 * Processes queued failed D1 writes with exponential backoff.
 */
export const processTaskSyncQueue = async (
  options?: { maxAttempts?: number }
): Promise<{
  retriedCount: number;
  succeededCount: number;
  failedCount: number;
  errors: Array<{ taskId: string; error: string }>
}> => {
  const maxAttempts = options?.maxAttempts || 5;
  const currentQueue = getTaskSyncQueue();
  if (currentQueue.length === 0) {
    return { retriedCount: 0, succeededCount: 0, failedCount: 0, errors: [] };
  }

  let succeededCount = 0;
  let failedCount = 0;
  const errors: Array<{ taskId: string; error: string }> = [];
  const remainingQueue: TaskSyncQueueItem[] = [];

  for (const item of currentQueue) {
    if (item.attempts >= maxAttempts) {
      remainingQueue.push(item);
      failedCount++;
      continue;
    }

    item.attempts++;
    item.lastAttemptAt = new Date().toISOString();

    try {
      if (item.action === 'delete') {
        await cfDeleteTask(item.taskId);
      } else if (item.action === 'create') {
        await cfCreateTask(item.taskPayload);
      } else {
        await cfUpdateTask(item.taskId, item.taskPayload);
      }
      succeededCount++;
      // Don't push to remaining — it's done
    } catch (cfErr: any) {
      item.lastError = `D1 retry failed: ${cfErr?.message || cfErr}`;
      errors.push({ taskId: item.taskId, error: item.lastError });
      failedCount++;
      remainingQueue.push(item);
    }
  }

  setTaskSyncQueue(remainingQueue);
  return { retriedCount: currentQueue.length, succeededCount, failedCount, errors };
};

export interface TaskD1WriteResult {
  success: boolean;
  d1Status: 'success' | 'failed';
  d1Error?: string;
  retryQueued: boolean;
  task: Task;
}

/**
 * Reliable D1-only persistence with local cache as optimistic layer.
 * Replaces the old dual-write that included Firestore.
 */
export async function persistTaskToD1(
  taskInput: Task,
  action: 'create' | 'update' = 'update'
): Promise<TaskD1WriteResult> {
  const task = normalizeTaskDateModel(taskInput);

  let d1Status: 'success' | 'failed' = 'success';
  let d1Error: string | undefined;
  let retryQueued = false;

  try {
    if (action === 'create') {
      await cfCreateTask(task);
    } else {
      await cfUpdateTask(task.id, task);
    }
    // Success: clear any previous retry for this task
    dequeueTaskSyncRetry(task.id);
  } catch (err: any) {
    d1Status = 'failed';
    d1Error = err instanceof Error ? err.message : String(err);
    enqueueTaskSyncRetry(task, action, err);
    retryQueued = true;
    console.warn(`[TaskStorage] D1 ${action} failed for task ${task.id}, queued for retry:`, d1Error);
  }

  return {
    success: d1Status === 'success' || retryQueued, // success if persisted OR queued
    d1Status,
    d1Error,
    retryQueued,
    task,
  };
}

/**
 * Calculates next valid working day in YYYY-MM-DD format based on configured working days.
 */
export function getNextWorkingDate(dateStr: string, workingDays: number[] = [1, 2, 3, 4, 5, 6]): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);

  if (workingDays.includes(dateObj.getDay())) {
    return dateStr;
  }

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
 * Formats a YYYY-MM-DD date string into human-friendly representations
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

  let pendingDays = 0;
  if (!isDone) {
    const rawDiff = differenceInCalendarDays(todayStr, pendingSince);
    pendingDays = Math.max(0, rawDiff);
  }

  const overdueDiff = differenceInCalendarDays(todayStr, dueDate);
  const isOverdue = !isDone && overdueDiff > 0;
  const overdueDays = isOverdue ? overdueDiff : 0;

  const rolloverCount = task.rolloverCount || task.rollover_count || 0;
  const isRolledOver = rolloverCount > 0 || (task.originalScheduledDate && task.originalScheduledDate < scheduledDate);

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

  const overdueBadge = isOverdue ? `${overdueDays} Day${overdueDays > 1 ? 's' : ''} Overdue` : null;
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
 */
export async function evaluateTaskRollovers(
  tasks: Task[],
  settings: RolloverSettings = getRolloverSettings()
): Promise<{ updatedTasks: Task[]; rolledOverCount: number; partialFailures?: any[]; failedCount?: number }> {
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
    setCachedTasks(updatedTasks);

    const partialFailures: any[] = [];
    let failedCount = 0;

    await Promise.allSettled(
      modifiedTasksToPersist.map(async (t) => {
        try {
          await cfUpdateTask(t.id, t);
        } catch (err) {
          enqueueTaskSyncRetry(t, 'update', err);
          failedCount++;
          partialFailures.push({ taskId: t.id, error: String(err) });
        }
      })
    );

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
 * Creates and persists a new task to Cloudflare D1 and Local Cache
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

  // 1. Update Local Storage Cache immediately (optimistic)
  const currentCached = getCachedTasks();
  const updatedCache = [newTask, ...currentCached.filter(t => t.id !== taskId)];
  setCachedTasks(updatedCache);

  // 2. Persist to Cloudflare D1
  const writeRes = await persistTaskToD1(newTask, 'create');
  if (!writeRes.success) {
    console.warn('[TaskStorage] D1 write queued for retry:', writeRes.d1Error);
  }

  // 3. Emit workspace events (fire and forget)
  try {
    const recipientId = newTask.assigneeId || newTask.assigned_employee_id;
    WorkspaceEventService.emit({
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
    }).catch(console.warn);
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

  return newTask;
};

/**
 * Updates an existing task in Cloudflare D1 and Local Cache
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

  // 1. Update Local Cache immediately (optimistic)
  const updatedList = currentCached.map(t => t.id === taskId ? updatedTask : t);
  if (!target) updatedList.unshift(updatedTask);
  setCachedTasks(updatedList);

  // 2. Persist to Cloudflare D1
  const writeRes = await persistTaskToD1(updatedTask, 'update');
  if (!writeRes.success) {
    console.warn('[TaskStorage] D1 update queued for retry:', writeRes.d1Error);
  }

  // 3. Auto-sync to Approvals Queue if status is In Review
  if (updatedTask.status === 'In Review') {
    try {
      const { createOrUpdateApprovalFromSource } = await import('./approvalStorage');
      await createOrUpdateApprovalFromSource('task', updatedTask, { userId: userProfile?.uid, name: userProfile?.name });
    } catch (apprErr) {
      console.warn('Approvals auto-sync notice on task update:', apprErr);
    }
  }

  return updatedTask;
};

/**
 * Bulk Reschedule Tasks (Super Admin operation)
 */
export interface BulkRescheduleResult {
  updatedCount: number;
  successCount: number;
  failureCount: number;
  partialFailures: Array<{ taskId: string; error: string }>;
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

  const partialFailures: Array<{ taskId: string; error: string }> = [];
  let successCount = 0;
  let failureCount = 0;

  await Promise.allSettled(tasksToPersist.map(async (target) => {
    try {
      await cfUpdateTask(target.id, target);
      successCount++;
    } catch (err) {
      enqueueTaskSyncRetry(target, 'update', err);
      failureCount++;
      partialFailures.push({ taskId: target.id, error: String(err) });
    }
  }));

  return { updatedCount, successCount, failureCount, partialFailures };
};

export interface TaskTransitionResult {
  success: boolean;
  task: Task | null;
  message: string;
  d1Synced?: boolean;
  retryQueued?: boolean;
  d1Error?: string;
}

/**
 * Canonical Single Status Transition Engine
 * Used by Arrows, Drag-and-Drop, Dropdowns, My Day, Calendar, and Approvals.
 * Cloudflare D1 is the authoritative backend.
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
      d1Synced: true,
      retryQueued: false,
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
      completedAt: undefined,
      completed_at: undefined,
      lastCompletedAt: targetTask.completedAt || targetTask.completed_at,
      reopenedAt: nowIso,
      reopened_at: nowIso,
      taskReopened: true,
      task_reopened: true,
    } : {}),
  });

  // 1. Optimistic local cache update IMMEDIATELY
  const updatedList = currentCached.map(t => t.id === taskId ? updatedTask : t);
  setCachedTasks(updatedList);

  // 2. Persist to Cloudflare D1
  const writeRes = await persistTaskToD1(updatedTask, 'update');

  // If D1 is completely unreachable (not even queued), rollback local cache
  if (!writeRes.success && !writeRes.retryQueued) {
    console.error('[TaskStorage] D1 write failed and could not be queued. Rolling back.');
    setCachedTasks(currentCached);
    return {
      success: false,
      task: targetTask,
      message: 'Failed to persist status change — please try again',
      d1Synced: false,
      retryQueued: false,
      d1Error: writeRes.d1Error,
    };
  }

  // 3. Emit workspace event (fire and forget)
  try {
    WorkspaceEventService.emit({
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
    }).catch(() => {});
  } catch (e) {}

  // 4. Handle Done -> Work Log synchronization
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

  if (writeRes.retryQueued) {
    statusMessage += ' (D1 sync queued — will retry automatically)';
  }

  return {
    success: true,
    task: updatedTask,
    message: statusMessage,
    d1Synced: writeRes.d1Status === 'success',
    retryQueued: writeRes.retryQueued,
    d1Error: writeRes.d1Error,
  };
};

/**
 * Safely Archives or Soft-Deletes a task with audit event emission.
 */
export const persistDeleteTask = async (
  taskId: string,
  userProfile?: { uid?: string; name?: string; role?: string },
  _options?: { softDelete?: boolean }
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
    await cfDeleteTask(taskId);
  } catch (err) {
    enqueueTaskSyncRetry({ id: taskId } as Task, 'delete', err);
    console.warn('[TaskStorage] D1 delete queued for retry:', err);
  }

  // Emit audit event (fire and forget)
  try {
    WorkspaceEventService.emit({
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
    }).catch(() => {});
  } catch (e) {
    console.warn('Task delete audit warning:', e);
  }

  return true;
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
 * Live task subscription backed ONLY by Cloudflare D1.
 * No Firestore listener — no stale-data rollbacks.
 * Flow: local cache (instant) → D1 fetch (authoritative) → rollover evaluation.
 */
export const subscribeToCanonicalTasks = (
  onUpdate: (tasks: Task[]) => void
): (() => void) => {
  let cancelled = false;

  // 1. Emit initial cached tasks immediately (0ms latency)
  let currentTasks = getCachedTasks();
  onUpdate(currentTasks);

  // 2. Process any pending D1 retries from previous sessions
  processTaskSyncQueue().catch(console.warn);

  // 3. Evaluate rollovers on initial load
  evaluateTaskRollovers(currentTasks).then(({ updatedTasks, rolledOverCount }) => {
    if (cancelled) return;
    if (rolledOverCount > 0) {
      currentTasks = updatedTasks;
      onUpdate(currentTasks);
    }
  }).catch(console.warn);

  // 4. Fetch authoritative list from Cloudflare D1 and merge
  cfGetTasks().then((cfList) => {
    if (cancelled) return;
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
        // Task from D1 not in local cache — add it
        taskMap.set(cfTask.id, cfTask);
      } else {
        const { merged, shouldSyncToD1 } = mergeTaskRecords(existing, cfTask);
        taskMap.set(cfTask.id, merged);
        if (shouldSyncToD1) {
          tasksToHealInD1.push(merged);
        }
      }
    }

    const reconciledList = Array.from(taskMap.values())
      .filter(t => !t.isArchived && !t.is_deleted && t.status !== 'Cancelled');

    setCachedTasks(reconciledList);
    currentTasks = reconciledList;

    if (!cancelled) onUpdate(reconciledList);

    // Heal stale records in D1 in background
    if (tasksToHealInD1.length > 0) {
      for (const t of tasksToHealInD1) {
        cfUpdateTask(t.id, t).catch((err) => {
          enqueueTaskSyncRetry(t, 'update', err);
        });
      }
    }
  }).catch(console.warn);

  // 5. Set up periodic D1 polling to pick up changes from other devices/browsers
  //    (replaces the Firestore onSnapshot listener)
  const POLL_INTERVAL_MS = 30_000; // 30 seconds
  const pollInterval = setInterval(async () => {
    if (cancelled) return;
    try {
      const cfList = await cfGetTasks();
      if (!Array.isArray(cfList) || cfList.length === 0 || cancelled) return;

      const cachedBefore = getCachedTasks();
      const taskMap = new Map<string, Task>();
      for (const t of cachedBefore) taskMap.set(t.id, t);

      const tasksToHealInD1: Task[] = [];

      for (const rawCf of cfList) {
        const cfTask = normalizeTaskDateModel(rawCf);
        const existing = taskMap.get(cfTask.id);
        if (!existing) {
          taskMap.set(cfTask.id, cfTask);
        } else {
          const { merged, shouldSyncToD1 } = mergeTaskRecords(existing, cfTask);
          taskMap.set(cfTask.id, merged);
          if (shouldSyncToD1) tasksToHealInD1.push(merged);
        }
      }

      const reconciledList = Array.from(taskMap.values())
        .filter(t => !t.isArchived && !t.is_deleted && t.status !== 'Cancelled');

      setCachedTasks(reconciledList);
      currentTasks = reconciledList;
      if (!cancelled) onUpdate(reconciledList);

      for (const t of tasksToHealInD1) {
        cfUpdateTask(t.id, t).catch((err) => enqueueTaskSyncRetry(t, 'update', err));
      }
    } catch (pollErr) {
      console.warn('[TaskStorage] D1 poll notice:', pollErr);
    }
  }, POLL_INTERVAL_MS);

  // Return unsubscribe / cleanup function
  return () => {
    cancelled = true;
    clearInterval(pollInterval);
  };
};
