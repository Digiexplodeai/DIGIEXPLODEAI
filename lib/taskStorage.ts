import { 
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, 
  onSnapshot, query, where, orderBy, addDoc 
} from 'firebase/firestore';
import { db } from './firebase';
import { WorkspaceEventService } from './controlPlane/WorkspaceEventService';

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
  videoProductionId?: string;
  videoTrackerId?: string;
  productionRole?: 'shoot' | 'edit';
  dependsOnTaskId?: string;
  blockedByShoot?: boolean;
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

export const DEFAULT_MASTER_TASKS: Task[] = [
  {
    id: 'tsk-master-sa-1',
    taskId: 'tsk-master-sa-1',
    title: 'Agency Executive Review & High-Ticket Proposal Strategy',
    description: 'Review pitch architecture, custom deliverables matrix, and profit margins for enterprise prospect.',
    clientId: 'client_nexus_coaching',
    clientName: 'Nexus Coaching Institute',
    category: 'Client Coordination',
    assigneeId: 'emp_superadmin',
    assigneeName: 'Digiexplode Super Admin',
    assigned_employee_id: 'emp_superadmin',
    priority: 'Urgent',
    scheduledDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    originalScheduledDate: new Date().toISOString().split('T')[0],
    originalDueDate: new Date().toISOString().split('T')[0],
    firstPendingSince: new Date().toISOString().split('T')[0],
    rolloverCount: 0,
    status: 'In Progress',
    createdAt: new Date().toISOString(),
    isArchived: false,
  },
  {
    id: 'tsk-master-sa-2',
    taskId: 'tsk-master-sa-2',
    title: 'Campaign Revenue & Growth Strategy Review',
    description: 'Approve monthly ad budgets, growth projections, and resource allocation across creative pipelines.',
    clientId: 'client_dr_anupam_jindal',
    clientName: 'Dr. Anupam Jindal',
    category: 'Reporting',
    assigneeId: 'emp_superadmin',
    assigneeName: 'Digiexplode Super Admin',
    assigned_employee_id: 'emp_superadmin',
    priority: 'High',
    scheduledDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    originalScheduledDate: new Date().toISOString().split('T')[0],
    originalDueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    firstPendingSince: new Date().toISOString().split('T')[0],
    rolloverCount: 0,
    status: 'To Do',
    createdAt: new Date().toISOString(),
    isArchived: false,
  },
  {
    id: 'tsk-master-1',
    taskId: 'tsk-master-1',
    title: 'Edit 5 Instagram Reels with Motion Typography',
    description: 'Create high-converting medical reels with animated subtitles and sound design.',
    clientId: 'client_dr_anupam_jindal',
    clientName: 'Dr. Anupam Jindal',
    category: 'Reel Editing',
    assigneeId: 'emp_2',
    assigneeName: 'Neha Gupta',
    assigned_employee_id: 'emp_2',
    priority: 'Urgent',
    scheduledDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    originalScheduledDate: new Date().toISOString().split('T')[0],
    originalDueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    firstPendingSince: new Date().toISOString().split('T')[0],
    rolloverCount: 0,
    status: 'In Progress',
    createdAt: new Date().toISOString(),
    isArchived: false,
  },
  {
    id: 'tsk-master-2',
    taskId: 'tsk-master-2',
    title: 'Meta Ads Retargeting Campaign Optimization',
    description: 'Configure custom pixel audiences and launch high-ROAS lead generation creatives.',
    clientId: 'client_dr_manishi_bansal',
    clientName: 'Dr. Manishi Bansal',
    category: 'Meta Ads',
    assigneeId: 'emp_1',
    assigneeName: 'Aman Sharma',
    assigned_employee_id: 'emp_1',
    priority: 'High',
    scheduledDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    originalScheduledDate: new Date().toISOString().split('T')[0],
    originalDueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    firstPendingSince: new Date().toISOString().split('T')[0],
    rolloverCount: 0,
    status: 'To Do',
    createdAt: new Date().toISOString(),
    isArchived: false,
  },
  {
    id: 'tsk-master-3',
    taskId: 'tsk-master-3',
    title: 'Monthly SEO Health & Core Web Vitals Audit',
    description: 'Audit backlink profile, page speed, schema markup, and keyword rank fluctuations.',
    clientId: 'client_dr_sankalp_sharma',
    clientName: 'Dr. Sankalp Sharma',
    category: 'SEO',
    assigneeId: 'emp_3',
    assigneeName: 'Rahul Verma',
    assigned_employee_id: 'emp_3',
    priority: 'Medium',
    scheduledDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    originalScheduledDate: new Date().toISOString().split('T')[0],
    originalDueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    firstPendingSince: new Date().toISOString().split('T')[0],
    rolloverCount: 0,
    status: 'In Review',
    createdAt: new Date().toISOString(),
    isArchived: false,
  },
  {
    id: 'tsk-master-4',
    taskId: 'tsk-master-4',
    title: 'Brand Identity Vector Assets & Carousel Templates',
    description: 'Design 10 customizable Figma carousel slides with dark and light aesthetic.',
    clientId: 'client_gangotri_ice',
    clientName: 'Gangotri Ice Cubes',
    category: 'Graphic Design',
    assigneeId: 'emp_4',
    assigneeName: 'Priya Singh',
    assigned_employee_id: 'emp_4',
    priority: 'High',
    scheduledDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    dueDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    originalScheduledDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    originalDueDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    firstPendingSince: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    rolloverCount: 0,
    status: 'Done',
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    isArchived: false,
  },
  {
    id: 'tsk-master-5',
    taskId: 'tsk-master-5',
    title: 'Edit 4K Cinematic Brand Film & Sound Mix',
    description: 'Color grade ARRI Log footage, apply multi-stem sound design, and master 4K ProRes deliverables.',
    clientId: 'client_dr_anupam_jindal',
    clientName: 'Dr. Anupam Jindal',
    category: 'Video Editing',
    assigneeId: 'emp_5',
    assigneeName: 'Vansh',
    assigned_employee_id: 'emp_5',
    priority: 'Urgent',
    scheduledDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    originalScheduledDate: new Date().toISOString().split('T')[0],
    originalDueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    firstPendingSince: new Date().toISOString().split('T')[0],
    rolloverCount: 0,
    status: 'In Progress',
    createdAt: new Date().toISOString(),
    isArchived: false,
  },
  {
    id: 'tsk-master-6',
    taskId: 'tsk-master-6',
    title: 'Creative Campaign Script & Hook Architecture',
    description: 'Develop 10 viral hooks and script structures for multi-platform ad creative testing.',
    clientId: 'client_nexus_coaching',
    clientName: 'Nexus Coaching Institute',
    category: 'Script Writing',
    assigneeId: 'emp_5',
    assigneeName: 'Vansh',
    assigned_employee_id: 'emp_5',
    priority: 'High',
    scheduledDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    originalScheduledDate: new Date().toISOString().split('T')[0],
    originalDueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    firstPendingSince: new Date().toISOString().split('T')[0],
    rolloverCount: 0,
    status: 'To Do',
    createdAt: new Date().toISOString(),
    isArchived: false,
  },
];

/**
 * Normalizes raw status string to canonical Kanban column key
 */
export const normalizeTaskStatus = (rawStatus: string): 'To Do' | 'In Progress' | 'In Review' | 'Done' => {
  if (!rawStatus) return 'To Do';
  const s = rawStatus.toLowerCase().trim();
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
  const idx = WORKFLOW_STATUS_ORDER.indexOf(norm);
  if (idx >= 0 && idx < WORKFLOW_STATUS_ORDER.length - 1) {
    return WORKFLOW_STATUS_ORDER[idx + 1];
  }
  return null;
};

export const getPrevWorkflowStatus = (currentStatus: string): 'To Do' | 'In Progress' | 'In Review' | 'Done' | null => {
  const norm = normalizeTaskStatus(currentStatus);
  const idx = WORKFLOW_STATUS_ORDER.indexOf(norm);
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
    completedAt: raw.completedAt || raw.completed_at,
    createdAt: raw.createdAt || nowIso,
    updatedAt: raw.updatedAt || nowIso,
    isArchived: !!raw.isArchived,

    // Aliases
    scheduled_date: initialScheduled,
    due_date: initialDue,
    original_scheduled_date: origScheduled,
    original_due_date: origDue,
    first_pending_since: pendingSince,
    rollover_count: count,
    last_rollover_at: raw.lastRolloverAt || raw.last_rollover_at,
    completed_at: raw.completedAt || raw.completed_at,
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
  const todayStr = nowIso.split('T')[0];
  const targetWorkingDate = getNextWorkingDate(todayStr, settings.workingDays);

  const updatedTasks: Task[] = [];
  const modifiedTasksToPersist: Task[] = [];
  let count = 0;

  for (const rawTask of tasks) {
    const task = normalizeTaskDateModel(rawTask);
    const normStatus = normalizeTaskStatus(task.status);
    const isFinished = normStatus === 'Done' || task.status === 'Cancelled' || task.isArchived;

    // Check if eligible for rollover: unfinished and scheduled_date is prior to today
    if (!isFinished && task.scheduledDate < todayStr) {
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

    // 2. Persist to Firestore in background without blocking UI
    try {
      for (const t of modifiedTasksToPersist) {
        setDoc(doc(db, 'tasks', t.id), t, { merge: true }).catch(console.warn);
      }
    } catch (e) {
      console.warn('Rollover firestore sync notice:', e);
    }
  }

  return { updatedTasks, rolledOverCount: count };
}

/**
 * Loads tasks immediately from local cache with automatic date normalization
 */
export const getCachedTasks = (): Task[] => {
  if (typeof window === 'undefined') return DEFAULT_MASTER_TASKS.map(normalizeTaskDateModel);
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TASKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter(t => !t.isArchived && t.status !== 'Cancelled')
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
  if (typeof window === 'undefined') return;
  try {
    const normalized = tasks.map(normalizeTaskDateModel);
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

  // 2. Persist to Firestore
  try {
    await setDoc(doc(db, 'tasks', taskId), newTask, { merge: true });

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

    // 4. Auto-sync to Approvals Queue if status is In Review
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

  // 2. Persist to Firestore
  try {
    await setDoc(doc(db, 'tasks', taskId), updatedTask, { merge: true });

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
export const bulkRescheduleTasks = async (
  taskIds: string[],
  newScheduledDate: string,
  userProfile?: { uid?: string; name?: string }
): Promise<number> => {
  if (!taskIds || taskIds.length === 0 || !newScheduledDate) return 0;
  const nowIso = new Date().toISOString();
  const currentCached = getCachedTasks();
  let updatedCount = 0;

  const updatedList = currentCached.map(task => {
    if (taskIds.includes(task.id)) {
      updatedCount++;
      return normalizeTaskDateModel({
        ...task,
        scheduledDate: newScheduledDate,
        scheduled_date: newScheduledDate,
        updatedAt: nowIso,
      });
    }
    return task;
  });

  setCachedTasks(updatedList);

  for (const tId of taskIds) {
    const target = updatedList.find(t => t.id === tId);
    if (target) {
      setDoc(doc(db, 'tasks', tId), target, { merge: true }).catch(console.warn);
      addDoc(collection(db, 'activityLogs'), {
        userId: userProfile?.uid || '',
        userName: userProfile?.name || 'Super Admin',
        action: `rescheduled task "${target.title}" to ${newScheduledDate}`,
        details: `Original Scheduled: ${target.originalScheduledDate || 'N/A'} · Due: ${target.dueDate}`,
        createdAt: nowIso,
      }).catch(() => {});
    }
  }

  return updatedCount;
};

/**
 * Canonical Single Status Transition Engine
 * Used by Arrows, Drag-and-Drop, Dropdowns, My Day, Calendar, and Approvals.
 */
export const transitionTaskStatus = async (
  taskId: string,
  targetStatus: 'To Do' | 'In Progress' | 'In Review' | 'Done',
  source: 'drag_drop' | 'left_arrow' | 'right_arrow' | 'status_dropdown' | 'bulk_action' | 'approval_sync' | 'calendar_action',
  userProfile?: { uid?: string; name?: string; role?: string }
): Promise<{ success: boolean; task: Task | null; message: string }> => {
  const currentCached = getCachedTasks();
  const targetTask = currentCached.find(t => t.id === taskId);
  if (!targetTask) {
    return { success: false, task: null, message: 'Task not found' };
  }

  const previousStatus = normalizeTaskStatus(targetTask.status);
  const newStatus = normalizeTaskStatus(targetStatus);

  if (previousStatus === newStatus) {
    return { success: true, task: targetTask, message: 'Status unchanged' };
  }

  const nowIso = new Date().toISOString();
  const isNowDone = newStatus === 'Done';
  const wasDone = previousStatus === 'Done';

  const updatedTask = normalizeTaskDateModel({
    ...targetTask,
    status: newStatus,
    updatedAt: nowIso,
    ...(isNowDone ? { completedAt: targetTask.completedAt || nowIso } : {}),
  });

  // 1. Optimistic local cache update
  const updatedList = currentCached.map(t => t.id === taskId ? updatedTask : t);
  setCachedTasks(updatedList);

  // 2. Persist to Firestore
  try {
    await setDoc(doc(db, 'tasks', taskId), updatedTask, { merge: true });

    // 3. Audit Log & Workspace Event
    try {
      await addDoc(collection(db, 'activityLogs'), {
        userId: userProfile?.uid || '',
        userName: userProfile?.name || 'Team Member',
        action: `moved task "${updatedTask.title}" from ${previousStatus} to ${newStatus} (${source})`,
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
        customDescription: `Task "${updatedTask.title}" moved from ${previousStatus} to ${newStatus} (${source}) by ${userProfile?.name || 'User'}`
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
      // Reopening task
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

    return { 
      success: true, 
      task: updatedTask, 
      message: isNowDone ? 'Task completed & Work Log synced' : `Moved to ${newStatus}` 
    };
  } catch (err: any) {
    console.error('Task status transition error:', err);
    return { success: false, task: targetTask, message: 'Failed to persist status change' };
  }
};

/**
 * Archives or Deletes a task
 */
export const persistDeleteTask = async (taskId: string): Promise<void> => {
  const currentCached = getCachedTasks();
  const updatedList = currentCached.filter(t => t.id !== taskId);
  setCachedTasks(updatedList);

  try {
    await deleteDoc(doc(db, 'tasks', taskId));
  } catch (err) {
    console.warn('Firestore delete warning for task (removed locally):', err);
  }
};

/**
 * Sets up a live Firestore snapshot listener with local cache fallback & automatic hydration
 */
export const subscribeToCanonicalTasks = (
  onUpdate: (tasks: Task[]) => void
): (() => void) => {
  // Emit initial cached tasks immediately with date normalization
  const initialTasks = getCachedTasks();
  onUpdate(initialTasks);

  // Evaluate rollovers on initial load
  evaluateTaskRollovers(initialTasks).then(({ updatedTasks, rolledOverCount }) => {
    if (rolledOverCount > 0) {
      onUpdate(updatedTasks);
    }
  }).catch(console.warn);

  const unsub = onSnapshot(collection(db, 'tasks'), async (snapshot) => {
    if (!snapshot.empty) {
      const list: Task[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (!d.isArchived && d.status !== 'Cancelled') {
          list.push(normalizeTaskDateModel({ id: docSnap.id, taskId: docSnap.id, ...d }));
        }
      });

      if (list.length > 0) {
        setCachedTasks(list);
        const { updatedTasks } = await evaluateTaskRollovers(list);
        onUpdate(updatedTasks);
        return;
      }
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
