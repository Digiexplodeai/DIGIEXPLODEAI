/**
 * DigiExplodeAI — Cloudflare D1 API Client
 * Secure API client integrating Firebase Authentication Bearer tokens,
 * automatic token refresh on 401 responses, and Zero Trust error handling.
 *
 * Set VITE_WORKER_URL in your .env to your Worker URL:
 *   VITE_WORKER_URL=https://digiexplodai.digiexplodeai.workers.dev
 */

import { auth } from './firebase';

const BASE_URL = ((import.meta as any).env?.VITE_WORKER_URL || 'https://digiexplodai.digiexplodeai.workers.dev').replace(/\/$/, '');

let explicitAuthTokenOverride: string | null = null;

/**
 * Optional override for testing or background tasks
 */
export function setApiAuthTokenOverride(token: string | null): void {
  explicitAuthTokenOverride = token;
}

/**
 * Retrieves the active user's Firebase ID-token.
 */
async function getActiveIdToken(forceRefresh = false): Promise<string | null> {
  if (explicitAuthTokenOverride) {
    return explicitAuthTokenOverride;
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }

  try {
    return await currentUser.getIdToken(forceRefresh);
  } catch (err) {
    console.warn('[cloudflareApi] Token retrieval warning:', err);
    return null;
  }
}

/**
 * Authenticated API Fetch wrapper
 */
async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const token = await getActiveIdToken(false);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options?.headers as Record<string, string>) || {}),
  };

  let res = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers,
  });

  // Automatic token refresh on 401 Unauthorized
  if (res.status === 401 && !explicitAuthTokenOverride && auth.currentUser) {
    try {
      const freshToken = await getActiveIdToken(true);
      if (freshToken && freshToken !== token) {
        headers['Authorization'] = `Bearer ${freshToken}`;
        res = await fetch(`${BASE_URL}/api${path}`, {
          ...options,
          headers,
        });
      }
    } catch (refreshErr) {
      console.warn('[cloudflareApi] Token refresh attempt failed:', refreshErr);
    }
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `Request failed with HTTP status ${res.status}` }));
    const errorMessage = errBody.error || `HTTP ${res.status}`;

    // Dispatches global security event if token was revoked or role forbidden
    if (typeof window !== 'undefined') {
      if (res.status === 401) {
        window.dispatchEvent(
          new CustomEvent('digi_api_unauthorized', {
            detail: { path, status: 401, error: errorMessage },
          })
        );
      } else if (res.status === 403) {
        window.dispatchEvent(
          new CustomEvent('digi_api_forbidden', {
            detail: { path, status: 403, error: errorMessage },
          })
        );
      }
    }

    throw new Error(errorMessage);
  }

  return res.json();
}

// ── CLIENTS ─────────────────────────────────────────────────────────────────

export const cfGetClients = () => apiFetch('/clients');
export const cfGetClient = (id: string) => apiFetch(`/clients/${id}`);
export const cfSaveClient = (data: any) => {
  const id = data.clientId;
  if (id) {
    return apiFetch(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  return apiFetch('/clients', { method: 'POST', body: JSON.stringify(data) });
};
export const cfCreateClient = (data: any) =>
  apiFetch('/clients', { method: 'POST', body: JSON.stringify(data) });
export const cfUpdateClient = (id: string, data: any) =>
  apiFetch(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const cfDeleteClient = (id: string) =>
  apiFetch(`/clients/${id}`, { method: 'DELETE' });

// ── EMPLOYEES ────────────────────────────────────────────────────────────────

export const cfGetEmployees = () => apiFetch('/employees');
export const cfGetEmployee = (id: string) => apiFetch(`/employees/${id}`);
export const cfCreateEmployee = (data: any) =>
  apiFetch('/employees', { method: 'POST', body: JSON.stringify(data) });
export const cfUpdateEmployee = (id: string, data: any) =>
  apiFetch(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const cfDeleteEmployee = (id: string) =>
  apiFetch(`/employees/${id}`, { method: 'DELETE' });

// ── TASKS ────────────────────────────────────────────────────────────────────

export const cfGetTasks = (filters?: { clientId?: string; assigneeId?: string; status?: string }) => {
  const params = new URLSearchParams();
  if (filters?.clientId) params.set('clientId', filters.clientId);
  if (filters?.assigneeId) params.set('assigneeId', filters.assigneeId);
  if (filters?.status) params.set('status', filters.status);
  return apiFetch(`/tasks${params.toString() ? '?' + params.toString() : ''}`);
};
export const cfGetTask = (id: string) => apiFetch(`/tasks/${id}`);
export const cfCreateTask = (data: any) =>
  apiFetch('/tasks', { method: 'POST', body: JSON.stringify(data) });
export const cfUpdateTask = (id: string, data: any) =>
  apiFetch(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const cfDeleteTask = (id: string) =>
  apiFetch(`/tasks/${id}`, { method: 'DELETE' });

// ── CONTENT CALENDAR ─────────────────────────────────────────────────────────

export const cfGetCalendar = (clientId?: string) =>
  apiFetch(`/calendar${clientId ? `?clientId=${clientId}` : ''}`);
export const cfCreateCalendarEntry = (data: any) =>
  apiFetch('/calendar', { method: 'POST', body: JSON.stringify(data) });
export const cfUpdateCalendarEntry = (id: string, data: any) =>
  apiFetch(`/calendar/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const cfDeleteCalendarEntry = (id: string) =>
  apiFetch(`/calendar/${id}`, { method: 'DELETE' });

// ── WORKLOGS ─────────────────────────────────────────────────────────────────

export const cfGetWorkLogs = (employeeId?: string) =>
  apiFetch(`/worklogs${employeeId ? `?employeeId=${employeeId}` : ''}`);
export const cfCreateWorkLog = (data: any) =>
  apiFetch('/worklogs', { method: 'POST', body: JSON.stringify(data) });
export const cfUpdateWorkLog = (id: string, data: any) =>
  apiFetch(`/worklogs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const cfDeleteWorkLog = (id: string) =>
  apiFetch(`/worklogs/${id}`, { method: 'DELETE' });

// ── ATTENDANCE ───────────────────────────────────────────────────────────────

export const cfGetAttendance = (filters?: { date?: string; employeeId?: string }) => {
  const params = new URLSearchParams();
  if (filters?.date) params.set('date', filters.date);
  if (filters?.employeeId) params.set('employeeId', filters.employeeId);
  return apiFetch(`/attendance${params.toString() ? '?' + params.toString() : ''}`);
};
export const cfCreateAttendance = (data: any) =>
  apiFetch('/attendance', { method: 'POST', body: JSON.stringify(data) });
export const cfUpdateAttendance = (id: string, data: any) =>
  apiFetch(`/attendance/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// ── APPROVALS ────────────────────────────────────────────────────────────────

export const cfGetApprovals = () => apiFetch('/approvals');
export const cfCreateApproval = (data: any) =>
  apiFetch('/approvals', { method: 'POST', body: JSON.stringify(data) });
export const cfUpdateApproval = (id: string, data: any) =>
  apiFetch(`/approvals/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const cfDeleteApproval = (id: string) =>
  apiFetch(`/approvals/${id}`, { method: 'DELETE' });

// ── VIDEO TRACKER ────────────────────────────────────────────────────────────

export const cfGetVideoEntries = () => apiFetch('/videotracker');
export const cfCreateVideoEntry = (data: any) =>
  apiFetch('/videotracker', { method: 'POST', body: JSON.stringify(data) });
export const cfUpdateVideoEntry = (id: string, data: any) =>
  apiFetch(`/videotracker/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const cfDeleteVideoEntry = (id: string) =>
  apiFetch(`/videotracker/${id}`, { method: 'DELETE' });

// ── PAYSLIPS ─────────────────────────────────────────────────────────────────

export const cfGetPayslips = (filters?: { month?: string; employeeId?: string }) => {
  const params = new URLSearchParams();
  if (filters?.month) params.set('month', filters.month);
  if (filters?.employeeId) params.set('employeeId', filters.employeeId);
  return apiFetch(`/payslips${params.toString() ? '?' + params.toString() : ''}`);
};
export const cfCreatePayslip = (data: any) =>
  apiFetch('/payslips', { method: 'POST', body: JSON.stringify(data) });
export const cfUpdatePayslip = (id: string, data: any) =>
  apiFetch(`/payslips/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const cfDeletePayslip = (id: string) =>
  apiFetch(`/payslips/${id}`, { method: 'DELETE' });

// ── HR DOCUMENTS ─────────────────────────────────────────────────────────────

export const cfGetHRDocuments = (employeeId?: string) =>
  apiFetch(`/hrdocuments${employeeId ? `?employeeId=${employeeId}` : ''}`);
export const cfCreateHRDocument = (data: any) =>
  apiFetch('/hrdocuments', { method: 'POST', body: JSON.stringify(data) });
export const cfUpdateHRDocument = (id: string, data: any) =>
  apiFetch(`/hrdocuments/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const cfDeleteHRDocument = (id: string) =>
  apiFetch(`/hrdocuments/${id}`, { method: 'DELETE' });

// ── USERS ─────────────────────────────────────────────────────────────────────

export const cfGetUsers = () => apiFetch('/users');
export const cfGetUser = (id: string) => apiFetch(`/users/${id}`);
export const cfUpsertUser = (data: any) =>
  apiFetch('/users', { method: 'POST', body: JSON.stringify(data) });
export const cfUpdateUser = (id: string, data: any) =>
  apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// ── HEALTH ────────────────────────────────────────────────────────────────────

export const cfHealthCheck = () => apiFetch('/health');

/**
 * Subscribe-like helper for components using polling instead of Firestore onSnapshot.
 * Returns an unsubscribe function (clears the interval).
 */
export function cfSubscribe<T>(
  fetcher: () => Promise<T>,
  onUpdate: (data: T) => void,
  onError?: (err: any) => void,
  intervalMs = 30000
): () => void {
  // Immediate first call
  fetcher().then(onUpdate).catch(onError || console.warn);
  // Poll every intervalMs
  const timer = setInterval(() => {
    fetcher().then(onUpdate).catch(onError || console.warn);
  }, intervalMs);
  return () => clearInterval(timer);
}
