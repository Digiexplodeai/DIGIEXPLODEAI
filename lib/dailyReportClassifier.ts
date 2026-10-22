/**
 * DigiExplode AI — Daily Report Classifier 2.0 (Single Source of Truth)
 * 
 * Implements strict date-wise classification, timezone conversions (Asia/Kolkata),
 * non-overlapping pending/overdue buckets, and verified duration tracking.
 * Used identically by both in-app Report Views and PDF Export Generator.
 */

import { Task } from './taskStorage';
import { getActiveTimers, formatDurationHours, formatDurationMinutes } from './taskTimerService';

/** Lightweight work log shape used for classification (matches D1 schema) */
export interface WorkLog {
  id?: string;
  taskId?: string;
  task_id?: string;
  employeeId?: string;
  employee_id?: string;
  date?: string;
  work_date?: string;
  hours?: number;
  hoursWorked?: number;
  category?: string;
  task_type?: string;
  workDone?: string;
  work_description?: string;
  source?: string;
  createdAt?: string;
  created_at?: string;
}

export const PRIORITY_COLORS: Record<string, string> = {
  Urgent: '#DC2626',
  High: '#EA580C',
  Medium: '#D97706',
  Low: '#16A34A',
  'Not Set': '#64748B'
};

export const PRIORITY_BG_COLORS: Record<string, string> = {
  Urgent: '#FEF2F2',
  High: '#FFF7ED',
  Medium: '#FFFBEB',
  Low: '#F0FDF4',
  'Not Set': '#F8FAFC'
};

export const PRIORITY_BORDER_COLORS: Record<string, string> = {
  Urgent: '#FECACA',
  High: '#FED7AA',
  Medium: '#FDE68A',
  Low: '#BBF7D0',
  'Not Set': '#E2E8F0'
};

/**
 * Converts any timestamp or date string to YYYY-MM-DD in Asia/Kolkata timezone.
 */
export function getKolkataDateFromTimestamp(val?: string | number | Date | null): string | null {
  if (!val) return null;
  // If already strict YYYY-MM-DD string
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return val;
  }
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d);
  } catch {
    return null;
  }
}

/**
 * Calculates calendar day difference (dateB - dateA)
 */
export function diffKolkataDays(dateLater: string, dateEarlier: string): number {
  try {
    if (!dateLater || !dateEarlier) return 0;
    const [y1, m1, d1] = dateLater.split('-').map(Number);
    const [y2, m2, d2] = dateEarlier.split('-').map(Number);
    const utc1 = Date.UTC(y1, m1 - 1, d1);
    const utc2 = Date.UTC(y2, m2 - 1, d2);
    return Math.floor((utc1 - utc2) / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

export interface ClassifiedTaskItem {
  task: Task;
  durationHours: number | null; // null if Not Recorded
  durationFormatted: string;   // "45m", "1h 20m", or "Not Recorded"
  isOverdue: boolean;
  daysOverdue: number;
  daysPending: number;
  isBlocked: boolean;
  blockedReason?: string;
  priorityColor: string;
  priorityBg: string;
  priorityBorder: string;
  createdDateKolkata: string;
  completedDateKolkata?: string;
  dueDateKolkata?: string;
  scheduledDateKolkata: string;
}

export interface ClassifiedDailyReport {
  targetDate: string;
  endDate?: string;
  isRange: boolean;
  employeeId?: string;
  employeeName?: string;
  clientId?: string;
  clientName?: string;
  
  // Section 1: Completed Today
  completedToday: ClassifiedTaskItem[];
  completedTodayTotalHours: number;
  completedMissingTimeCount: number;

  // Section 2: Worked On Today (ongoing/in-progress)
  workedOnToday: ClassifiedTaskItem[];
  workedOnTodayTotalHours: number;

  // Section 3: New Pending (created today & unfinished, not overdue)
  newPending: ClassifiedTaskItem[];

  // Section 4: Previous Pending (created earlier & unfinished, not overdue)
  previousPending: ClassifiedTaskItem[];

  // Section 4b: Overdue Tasks (unfinished, due date < targetDate)
  overdue: ClassifiedTaskItem[];
  highPriorityOverdueCount: number;

  // Summary Metrics Cards (No Double Counting)
  summary: {
    completedTodayCount: number;
    workedOnTodayCount: number;
    pendingCount: number; // newPending + previousPending
    overdueCount: number;
    totalTimeLoggedHours: number;
    totalTimeLoggedFormatted: string;
    totalTasksAssignedToday: number;
    pendingCarriedForwardCount: number; // previousPending
    missingTimeRecordsCount: number;
    factualDailySummary: string;
  };

  // Section 5: Time summary breakdown
  timeBreakdown: {
    taskId: string;
    taskTitle: string;
    clientName: string;
    category: string;
    status: string;
    hours: number;
    formatted: string;
  }[];

  // Optional historical grouped tasks for date range
  historicalTasksByDate?: Record<string, ClassifiedTaskItem[]>;
}

export interface DailyReportClassifierOptions {
  tasks: Task[];
  workLogs: any[];
  targetDate: string; // YYYY-MM-DD in Asia/Kolkata
  endDate?: string;   // Optional end date for custom date range
  filterEmployeeId?: string;
  filterClientId?: string;
  filterPriority?: string;
  filterCategory?: string;
  filterStatus?: string;
}

/**
 * Primary Canonical Classifier function for DigiExplode AI Daily Report 2.0
 */
export function classifyDailyReport(options: DailyReportClassifierOptions): ClassifiedDailyReport {
  const {
    tasks,
    workLogs,
    targetDate,
    endDate,
    filterEmployeeId,
    filterClientId,
    filterPriority,
    filterCategory,
    filterStatus
  } = options;

  const isRange = Boolean(endDate && endDate > targetDate);
  const rangeStart = targetDate;
  const rangeEnd = endDate || targetDate;

  // Helper to check if a date string falls in our target evaluation period
  const isInTargetPeriod = (dateStr?: string | null): boolean => {
    if (!dateStr) return false;
    if (isRange) {
      return dateStr >= rangeStart && dateStr <= rangeEnd;
    }
    return dateStr === targetDate;
  };

  // 1. Pre-filter by employee and client if provided
  const candidateTasks = tasks.filter(t => {
    if (t.isArchived || t.is_deleted || t.status === 'Cancelled') return false;
    if (filterEmployeeId) {
      const matchEmp = t.assigneeId === filterEmployeeId || 
                       t.assigned_employee_id === filterEmployeeId || 
                       t.employee_id === filterEmployeeId;
      if (!matchEmp) return false;
    }
    if (filterClientId && t.clientId !== filterClientId) {
      return false;
    }
    if (filterPriority && filterPriority !== 'All') {
      const p = t.priority || 'Not Set';
      if (p !== filterPriority) return false;
    }
    if (filterCategory && filterCategory !== 'All') {
      if (t.category !== filterCategory) return false;
    }
    if (filterStatus && filterStatus !== 'All') {
      if (t.status !== filterStatus) return false;
    }
    return true;
  });

  // 2. Build index of verified active work hours for each task in target period
  // We prefer actual work logs or active timer sessions.
  // NEVER assume updated_at means employee worked on task.
  // NEVER subtract createdAt from completedAt.
  const taskHoursMap = new Map<string, number>();

  workLogs.forEach(wl => {
    const rawDate = wl.work_date || wl.date || wl.completedAt || wl.createdAt;
    const logDate = getKolkataDateFromTimestamp(rawDate);
    if (!isInTargetPeriod(logDate)) return;

    if (filterEmployeeId) {
      const matchEmp = wl.employeeId === filterEmployeeId || wl.employee_id === filterEmployeeId;
      if (!matchEmp) return false;
    }
    if (filterClientId) {
      const matchClient = wl.clientId === filterClientId || wl.client_id === filterClientId;
      if (!matchClient) return false;
    }

    const taskId = wl.taskId || wl.task_id;
    if (taskId) {
      const hrs = Number(wl.hours) || Number(wl.hoursWorked) || Number(wl.durationHours) || 0;
      if (hrs > 0) {
        taskHoursMap.set(taskId, (taskHoursMap.get(taskId) || 0) + hrs);
      }
    }
  });

  // Incorporate currently active timer if running today for today's report
  if (!isRange && targetDate === getKolkataDateFromTimestamp(new Date())) {
    try {
      const timers = getActiveTimers();
      Object.values(timers).forEach(timer => {
        if (filterEmployeeId && timer.employeeId !== filterEmployeeId) return;
        if (timer.accumulatedSeconds > 30) {
          const timerHours = Math.round((timer.accumulatedSeconds / 3600) * 100) / 100;
          if (timerHours > 0) {
            taskHoursMap.set(timer.taskId, (taskHoursMap.get(timer.taskId) || 0) + timerHours);
          }
        }
      });
    } catch {}
  }

  // 3. Helper to wrap task in ClassifiedTaskItem with colors and verified durations
  const wrapItem = (t: Task): ClassifiedTaskItem => {
    const priority = t.priority || 'Not Set';
    const createdKolkata = getKolkataDateFromTimestamp(t.createdAt) || targetDate;
    const completedKolkata = getKolkataDateFromTimestamp(t.completedAt) || undefined;
    const dueKolkata = getKolkataDateFromTimestamp(t.dueDate) || undefined;
    const scheduledKolkata = getKolkataDateFromTimestamp(t.scheduledDate) || createdKolkata;

    // Check tracked duration
    const loggedHrs = taskHoursMap.get(t.id);
    const durationHours = loggedHrs && loggedHrs > 0 ? Math.round(loggedHrs * 100) / 100 : null;
    const durationFormatted = durationHours !== null ? formatDurationHours(durationHours) : 'Not Recorded';

    // Overdue calculation
    let isOverdue = false;
    let daysOverdue = 0;
    if (t.status !== 'Done' && dueKolkata && dueKolkata < targetDate) {
      isOverdue = true;
      daysOverdue = Math.max(1, diffKolkataDays(targetDate, dueKolkata));
    }

    // Pending days calculation from first pending date / created date
    const pendingSince = getKolkataDateFromTimestamp(t.firstPendingSince) || createdKolkata;
    const daysPending = Math.max(0, diffKolkataDays(targetDate, pendingSince));

    const isBlocked = Boolean(t.blockedByShoot || (t as any).isBlocked || (t as any).blocked);
    const blockedReason = t.blockedByShoot ? 'Blocked by Video Shoot asset delivery' : undefined;

    return {
      task: t,
      durationHours,
      durationFormatted,
      isOverdue,
      daysOverdue,
      daysPending,
      isBlocked,
      blockedReason,
      priorityColor: PRIORITY_COLORS[priority] || PRIORITY_COLORS['Not Set'],
      priorityBg: PRIORITY_BG_COLORS[priority] || PRIORITY_BG_COLORS['Not Set'],
      priorityBorder: PRIORITY_BORDER_COLORS[priority] || PRIORITY_BORDER_COLORS['Not Set'],
      createdDateKolkata: createdKolkata,
      completedDateKolkata: completedKolkata,
      dueDateKolkata: dueKolkata,
      scheduledDateKolkata: scheduledKolkata
    };
  };

  // 4. Strict classification buckets
  const completedToday: ClassifiedTaskItem[] = [];
  const workedOnToday: ClassifiedTaskItem[] = [];
  const newPending: ClassifiedTaskItem[] = [];
  const previousPending: ClassifiedTaskItem[] = [];
  const overdue: ClassifiedTaskItem[] = [];

  candidateTasks.forEach(t => {
    const item = wrapItem(t);
    const isDone = t.status === 'Done';
    const completedDate = item.completedDateKolkata;
    const createdDate = item.createdDateKolkata;
    const hasActiveWorkToday = (item.durationHours || 0) > 0;

    // Rule: Completed today
    if (isDone && completedDate && isInTargetPeriod(completedDate)) {
      completedToday.push(item);
      return;
    }

    // Rule: Completed previously (do NOT count in today's completions or pending)
    if (isDone && completedDate && completedDate < targetDate) {
      // Historical completed task — skip from today's active report
      return;
    }

    // If task is still pending or unfinished:
    if (!isDone) {
      // Rule: Overdue tasks
      if (item.isOverdue) {
        overdue.push(item);
        // If it was also worked on today, it shows in Worked On Today as well for time tracking
        if (hasActiveWorkToday) {
          workedOnToday.push(item);
        }
        return;
      }

      // Rule: New Pending (created today, unfinished, not overdue)
      if (isInTargetPeriod(createdDate)) {
        newPending.push(item);
        if (hasActiveWorkToday) {
          workedOnToday.push(item);
        }
        return;
      }

      // Rule: Previous Pending (created earlier, unfinished, not overdue)
      if (createdDate < targetDate) {
        previousPending.push(item);
        if (hasActiveWorkToday) {
          workedOnToday.push(item);
        }
        return;
      }

      // Future scheduled task
      if (createdDate > targetDate && hasActiveWorkToday) {
        workedOnToday.push(item);
      }
    }
  });

  // Calculate totals and metrics
  const completedTodayTotalHours = completedToday.reduce((acc, i) => acc + (i.durationHours || 0), 0);
  const workedOnTodayTotalHours = workedOnToday.reduce((acc, i) => acc + (i.durationHours || 0), 0);
  const completedMissingTimeCount = completedToday.filter(i => i.durationHours === null).length;
  const highPriorityOverdueCount = overdue.filter(i => i.task.priority === 'Urgent' || i.task.priority === 'High').length;

  // Total time logged in target period (sum of all tracked tasks + standalone logs)
  let totalTimeLoggedHours = 0;
  taskHoursMap.forEach(hrs => {
    totalTimeLoggedHours += hrs;
  });
  totalTimeLoggedHours = Math.round(totalTimeLoggedHours * 100) / 100;
  const totalTimeLoggedFormatted = formatDurationHours(totalTimeLoggedHours);

  // Total tasks assigned today
  const totalTasksAssignedToday = candidateTasks.filter(t => {
    const cDate = getKolkataDateFromTimestamp(t.createdAt);
    const sDate = getKolkataDateFromTimestamp(t.scheduledDate);
    return isInTargetPeriod(cDate) || isInTargetPeriod(sDate);
  }).length;

  // Time Breakdown entries
  const timeBreakdown: ClassifiedDailyReport['timeBreakdown'] = [];
  taskHoursMap.forEach((hrs, taskId) => {
    const t = candidateTasks.find(ct => ct.id === taskId);
    if (hrs > 0) {
      timeBreakdown.push({
        taskId,
        taskTitle: t?.title || `Task #${taskId.slice(-6)}`,
        clientName: t?.clientName || 'General',
        category: t?.category || 'General',
        status: t?.status || 'Active',
        hours: Math.round(hrs * 100) / 100,
        formatted: formatDurationHours(hrs)
      });
    }
  });

  // Sort time breakdown descending by logged hours
  timeBreakdown.sort((a, b) => b.hours - a.hours);

  // Short factual daily summary text
  const factualDailySummary = `${completedToday.length} task${completedToday.length === 1 ? '' : 's'} completed, ` +
    `${workedOnToday.length} ongoing task${workedOnToday.length === 1 ? '' : 's'} worked on, ` +
    `and ${totalTimeLoggedFormatted} active work logged on ${targetDate}. ` +
    `${newPending.length + previousPending.length} pending tasks (${overdue.length} overdue).`;

  return {
    targetDate,
    endDate,
    isRange,
    completedToday,
    completedTodayTotalHours: Math.round(completedTodayTotalHours * 100) / 100,
    completedMissingTimeCount,
    workedOnToday,
    workedOnTodayTotalHours: Math.round(workedOnTodayTotalHours * 100) / 100,
    newPending,
    previousPending,
    overdue,
    highPriorityOverdueCount,
    summary: {
      completedTodayCount: completedToday.length,
      workedOnTodayCount: workedOnToday.length,
      pendingCount: newPending.length + previousPending.length,
      overdueCount: overdue.length,
      totalTimeLoggedHours,
      totalTimeLoggedFormatted,
      totalTasksAssignedToday,
      pendingCarriedForwardCount: previousPending.length,
      missingTimeRecordsCount: completedMissingTimeCount,
      factualDailySummary
    },
    timeBreakdown
  };
}
