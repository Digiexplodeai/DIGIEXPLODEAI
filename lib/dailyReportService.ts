/**
 * Digiexplode AI — Daily Report Service
 * 
 * Manages daily report drafts, submissions, manager reviews, and status tracking.
 * Connects directly to Firestore 'daily_reports' and persists to localStorage.
 * Operates on Asia/Kolkata date boundaries by default.
 */

import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export interface DailyReportSubmission {
  id: string; // Idempotent key: `dr_${employeeId}_${date}`
  date: string; // YYYY-MM-DD
  employeeId: string;
  employeeName: string;
  employeeEmail?: string;
  team?: string;
  department?: string;
  status: 'Draft' | 'Submitted' | 'Reviewed' | 'Returned';
  summary: string;
  blockers?: string;
  nextDayPlan?: string;
  completedTasksCount: number;
  pendingTasksCount: number;
  hoursLogged: number;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  managerRemarks?: string;
  isLate?: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'digi_daily_reports_v2';

/**
 * Returns today's date formatted as YYYY-MM-DD in Asia/Kolkata timezone
 */
export function getKolkataDateString(dateObj: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(dateObj); // Returns "YYYY-MM-DD"
  } catch (e) {
    return dateObj.toISOString().split('T')[0];
  }
}

/**
 * Get all cached daily report submissions from localStorage
 */
export function getCachedDailyReports(): DailyReportSubmission[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Persist daily report list to local cache
 */
function setCachedDailyReports(reports: DailyReportSubmission[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch (e) {
    console.warn('[DailyReportService] LocalStorage set error:', e);
  }
}

/**
 * Get daily report by employee ID and date
 */
export function getDailyReportForEmployee(employeeId: string, date: string): DailyReportSubmission | null {
  const reports = getCachedDailyReports();
  return reports.find(r => r.employeeId === employeeId && r.date === date) || null;
}

/**
 * Save draft or submit a daily report
 */
export async function saveOrSubmitDailyReport(
  payload: {
    date: string;
    employeeId: string;
    employeeName: string;
    employeeEmail?: string;
    team?: string;
    department?: string;
    summary: string;
    blockers?: string;
    nextDayPlan?: string;
    completedTasksCount: number;
    pendingTasksCount: number;
    hoursLogged: number;
    isSubmit: boolean;
  }
): Promise<DailyReportSubmission> {
  const nowIso = new Date().toISOString();
  const id = `dr_${payload.employeeId}_${payload.date}`;

  // Check if submission is late (submitted after report date)
  let isLate = false;
  if (payload.isSubmit) {
    const todayKolkata = getKolkataDateString();
    if (payload.date < todayKolkata) {
      isLate = true;
    }
  }

  const existing = getDailyReportForEmployee(payload.employeeId, payload.date);

  const record: DailyReportSubmission = {
    id,
    date: payload.date,
    employeeId: payload.employeeId,
    employeeName: payload.employeeName,
    employeeEmail: payload.employeeEmail || existing?.employeeEmail,
    team: payload.team || existing?.team || 'General',
    department: payload.department || existing?.department,
    status: payload.isSubmit ? 'Submitted' : 'Draft',
    summary: payload.summary.trim(),
    blockers: payload.blockers?.trim() || '',
    nextDayPlan: payload.nextDayPlan?.trim() || '',
    completedTasksCount: payload.completedTasksCount,
    pendingTasksCount: payload.pendingTasksCount,
    hoursLogged: payload.hoursLogged,
    submittedAt: payload.isSubmit ? (existing?.submittedAt || nowIso) : existing?.submittedAt,
    reviewedAt: existing?.reviewedAt,
    reviewedBy: existing?.reviewedBy,
    reviewedByName: existing?.reviewedByName,
    managerRemarks: existing?.managerRemarks,
    isLate: isLate || existing?.isLate,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso
  };

  // Update local cache
  const allReports = getCachedDailyReports();
  const filtered = allReports.filter(r => r.id !== id);
  const updated = [record, ...filtered];
  setCachedDailyReports(updated);

  // Sync to Firestore
  try {
    const docRef = doc(db, 'daily_reports', id);
    await setDoc(docRef, record, { merge: true });
  } catch (err) {
    console.warn('[DailyReportService] Firestore sync fallback:', err);
  }

  // Dispatch custom event for reactive UI
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('digi_daily_report_updated', { detail: record }));
  }

  return record;
}

/**
 * Manager review of a submitted daily report (Reviewed / Returned)
 */
export async function reviewDailyReportSubmission(
  reportId: string,
  newStatus: 'Reviewed' | 'Returned',
  managerRemarks: string,
  reviewer: { uid?: string; name?: string }
): Promise<DailyReportSubmission | null> {
  const nowIso = new Date().toISOString();
  const allReports = getCachedDailyReports();
  const target = allReports.find(r => r.id === reportId);
  if (!target) return null;

  const updatedRecord: DailyReportSubmission = {
    ...target,
    status: newStatus,
    managerRemarks: managerRemarks.trim(),
    reviewedAt: nowIso,
    reviewedBy: reviewer.uid || 'admin',
    reviewedByName: reviewer.name || 'Manager',
    updatedAt: nowIso
  };

  const updatedList = allReports.map(r => r.id === reportId ? updatedRecord : r);
  setCachedDailyReports(updatedList);

  try {
    const docRef = doc(db, 'daily_reports', reportId);
    await setDoc(docRef, updatedRecord, { merge: true });
  } catch (err) {
    console.warn('[DailyReportService] Firestore review sync fallback:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('digi_daily_report_updated', { detail: updatedRecord }));
  }

  return updatedRecord;
}

/**
 * Subscribe to reactive daily reports updates
 */
export function subscribeToDailyReports(callback: (reports: DailyReportSubmission[]) => void): () => void {
  // Initial local delivery
  callback(getCachedDailyReports());

  const handleCustomUpdate = () => {
    callback(getCachedDailyReports());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('digi_daily_report_updated', handleCustomUpdate);
  }

  // Firestore onSnapshot listener
  let unsubFirestore = () => {};
  try {
    const q = collection(db, 'daily_reports');
    unsubFirestore = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const fromFirestore = snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyReportSubmission));
        const mergedMap = new Map<string, DailyReportSubmission>();
        // Add local first
        getCachedDailyReports().forEach(r => mergedMap.set(r.id, r));
        // Overwrite with Firestore
        fromFirestore.forEach(r => mergedMap.set(r.id, r));
        const combined = Array.from(mergedMap.values()).sort((a, b) => (b.date > a.date ? 1 : -1));
        setCachedDailyReports(combined);
        callback(combined);
      }
    }, (err) => {
      console.warn('[DailyReportService] Firestore listener notice:', err);
    });
  } catch (err) {
    console.warn('[DailyReportService] Firestore setup notice:', err);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('digi_daily_report_updated', handleCustomUpdate);
    }
    unsubFirestore();
  };
}
