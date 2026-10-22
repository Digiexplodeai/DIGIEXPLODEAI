/**
 * DigiExplode AI — Lightweight Task Timer Service
 * 
 * Provides Start, Pause, and Stop active work session tracking per task.
 * Persists active timer state to localStorage so refreshes don't lose time.
 * When stopped, creates an authoritative Work Log synced to Cloudflare D1 and local cache.
 */

import { getKolkataDateString } from './dailyReportService';
import { cfCreateWorkLog } from './cloudflareApi';

export interface TaskTimerSession {
  taskId: string;
  taskTitle: string;
  employeeId: string;
  employeeName?: string;
  clientId?: string;
  clientName?: string;
  category?: string;
  isRunning: boolean;
  accumulatedSeconds: number; // Seconds logged prior to current running stint
  lastStartedAt?: number;      // Epoch ms when current stint started
  date: string;               // YYYY-MM-DD (Kolkata)
}

const STORAGE_KEY = 'digi_active_task_timers_v1';

export function getActiveTimers(): Record<string, TaskTimerSession> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveActiveTimers(timers: Record<string, TaskTimerSession>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
    window.dispatchEvent(new CustomEvent('digi_task_timer_updated'));
  } catch (e) {
    console.warn('[TaskTimerService] Failed to save timers:', e);
  }
}

/**
 * Get the current accumulated seconds for a task (including elapsed time if running)
 */
export function getTaskTimerSeconds(taskId: string): number {
  const timers = getActiveTimers();
  const session = timers[taskId];
  if (!session) return 0;
  if (!session.isRunning || !session.lastStartedAt) {
    return session.accumulatedSeconds || 0;
  }
  const currentRunning = Math.max(0, Math.floor((Date.now() - session.lastStartedAt) / 1000));
  return (session.accumulatedSeconds || 0) + currentRunning;
}

export function getTaskTimerSession(taskId: string): TaskTimerSession | null {
  const timers = getActiveTimers();
  return timers[taskId] || null;
}

/**
 * Start or resume timer for a task
 */
export function startTaskTimer(task: {
  id: string;
  title: string;
  employeeId: string;
  employeeName?: string;
  clientId?: string;
  clientName?: string;
  category?: string;
}): TaskTimerSession {
  const timers = getActiveTimers();
  const existing = timers[task.id];
  const now = Date.now();
  const todayKolkata = getKolkataDateString();

  let accumulated = 0;
  if (existing) {
    if (existing.isRunning && existing.lastStartedAt) {
      accumulated = (existing.accumulatedSeconds || 0) + Math.max(0, Math.floor((now - existing.lastStartedAt) / 1000));
    } else {
      accumulated = existing.accumulatedSeconds || 0;
    }
  }

  const updated: TaskTimerSession = {
    taskId: task.id,
    taskTitle: task.title,
    employeeId: task.employeeId,
    employeeName: task.employeeName || 'Team Member',
    clientId: task.clientId || '',
    clientName: task.clientName || 'General',
    category: task.category || 'General',
    isRunning: true,
    accumulatedSeconds: accumulated,
    lastStartedAt: now,
    date: todayKolkata
  };

  timers[task.id] = updated;
  saveActiveTimers(timers);
  return updated;
}

/**
 * Pause running timer for a task
 */
export function pauseTaskTimer(taskId: string): TaskTimerSession | null {
  const timers = getActiveTimers();
  const existing = timers[taskId];
  if (!existing || !existing.isRunning) return existing || null;

  const now = Date.now();
  const stintSeconds = existing.lastStartedAt ? Math.max(0, Math.floor((now - existing.lastStartedAt) / 1000)) : 0;
  const updated: TaskTimerSession = {
    ...existing,
    isRunning: false,
    accumulatedSeconds: (existing.accumulatedSeconds || 0) + stintSeconds,
    lastStartedAt: undefined
  };

  timers[taskId] = updated;
  saveActiveTimers(timers);
  return updated;
}

/**
 * Stop timer, finalize tracked duration, log as an official Work Log, and clear timer.
 * Returns total minutes logged.
 */
export async function stopAndLogTaskTimer(
  taskId: string,
  userProfile?: any
): Promise<{ loggedMinutes: number; workLogId?: string }> {
  const timers = getActiveTimers();
  const session = timers[taskId];
  if (!session) return { loggedMinutes: 0 };

  let totalSeconds = session.accumulatedSeconds || 0;
  if (session.isRunning && session.lastStartedAt) {
    totalSeconds += Math.max(0, Math.floor((Date.now() - session.lastStartedAt) / 1000));
  }

  // Remove timer from active session pool
  delete timers[taskId];
  saveActiveTimers(timers);

  // If active time is less than 30 seconds, discard without spamming work logs
  if (totalSeconds < 30) {
    return { loggedMinutes: 0 };
  }

  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));
  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
  const todayKolkata = getKolkataDateString();
  const nowIso = new Date().toISOString();
  const logId = `worklog_timer_${taskId}_${Date.now()}`;

  const payload = {
    id: logId,
    task_id: taskId,
    taskId: taskId,
    client_id: session.clientId || '',
    clientId: session.clientId || '',
    client_name: session.clientName || 'General',
    clientName: session.clientName || 'General',
    employee_id: session.employeeId,
    employeeId: session.employeeId,
    employee_name: session.employeeName || userProfile?.name || 'Team Member',
    employeeName: session.employeeName || userProfile?.name || 'Team Member',
    work_description: `Timer Session: ${session.taskTitle}`,
    workDone: `Timer Session: ${session.taskTitle}`,
    task_type: session.category || 'General',
    category: session.category || 'General',
    hours: totalHours,
    hoursWorked: totalHours,
    quantity: 1,
    work_date: todayKolkata,
    date: todayKolkata,
    source: 'timer_session',
    auto_generated: false,
    status: 'Completed',
    created_at: nowIso,
    createdAt: nowIso,
    updated_at: nowIso,
    updatedAt: nowIso
  };

  // 1. Optimistic Local Work Logs cache
  try {
    const raw = localStorage.getItem('digi_persisted_worklogs_v2');
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(payload);
    localStorage.setItem('digi_persisted_worklogs_v2', JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('worklogs_updated', { detail: payload }));
    }
  } catch (e) {
    console.warn('[TaskTimerService] Local work log save notice:', e);
  }

  // 2. Persist to Cloudflare D1
  cfCreateWorkLog(payload).catch(e => console.warn('[TaskTimerService] D1 sync notice:', e));

  return { loggedMinutes: totalMinutes, workLogId: logId };
}

/**
 * Format minutes into clean human-readable duration: "45m", "1h 20m", "3h 10m"
 */
export function formatDurationMinutes(totalMinutes?: number | null): string {
  if (totalMinutes === undefined || totalMinutes === null || isNaN(totalMinutes) || totalMinutes <= 0) {
    return 'Not Recorded';
  }
  const hrs = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

/**
 * Format fractional hours (e.g. 1.5) into "1h 30m"
 */
export function formatDurationHours(hours?: number | null): string {
  if (hours === undefined || hours === null || isNaN(hours) || hours <= 0) {
    return 'Not Recorded';
  }
  return formatDurationMinutes(Math.round(hours * 60));
}
