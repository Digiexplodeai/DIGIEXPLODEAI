/**
 * DigiExplodeAI — Social Media Content Calendar Storage
 * Database Backend: Cloudflare D1 (via Cloudflare Worker API) + Local Cache
 *
 * FIRESTORE IS NOT USED FOR DATA STORAGE.
 */

import { auth } from './firebase';
import { signInAnonymously } from 'firebase/auth';
import { persistNewTask, persistUpdateTask, persistDeleteTask } from './taskStorage';
import {
  cfGetCalendar,
  cfCreateCalendarEntry,
  cfUpdateCalendarEntry,
  cfDeleteCalendarEntry
} from './cloudflareApi';

export interface CalendarEntry {
  contentId: string;
  clientId: string;
  clientName: string;
  date: string;          // YYYY-MM-DD
  time?: string;         // HH:mm
  month?: string;        // YYYY-MM
  year?: number;
  platform: 'Instagram' | 'Facebook' | 'YouTube' | 'LinkedIn' | 'Website' | 'Google Business Profile' | 'X' | 'Other';
  platforms?: string[];  // Multi-platform support
  contentType: 'Static Post' | 'Reel' | 'Carousel' | 'Story' | 'YouTube Short' | 'Video' | 'GMB Post' | 'Website Work' | 'Other';
  topic: string;
  caption?: string;
  hashtags?: string;
  designBrief?: string;
  creativeLink?: string;
  videoLink?: string;
  canvaLink?: string;
  driveLink?: string;
  status: 'Idea' | 'Planned' | 'In Design' | 'Sent for Approval' | 'Changes Required' | 'Approved' | 'Scheduled' | 'Posted' | 'Cancelled' | 'On Hold';
  postedStatus?: 'Posted' | 'Not Posted';
  clientApprovalStatus?: 'Pending' | 'Approved' | 'Changes Required';
  clientFeedback?: string;
  internalNotes?: string;
  assigneeId?: string;
  assigneeName?: string;
  uploaderId?: string;
  uploaderName?: string;
  taskId?: string;
  videoId?: string;
  createdBy: string;
  createdByUid?: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export const LOCAL_STORAGE_CALENDAR_KEY = 'digi_social_calendar_cache_v2';
export const CALENDAR_UPDATED_EVENT = 'digi_calendar_changed';

export const DEFAULT_CALENDAR_SEEDS: CalendarEntry[] = [];

export const getCachedCalendarEntries = (): CalendarEntry[] => {
  if (typeof window === 'undefined') return DEFAULT_CALENDAR_SEEDS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CALENDAR_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Could not read calendar cache:', e);
  }
  return DEFAULT_CALENDAR_SEEDS;
};

export const setCachedCalendarEntries = (data: CalendarEntry[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_CALENDAR_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent(CALENDAR_UPDATED_EVENT, { detail: data }));
  } catch (e) {
    console.warn('Could not write calendar cache:', e);
  }
};

const d1ToCalendarEntry = (r: any): CalendarEntry => ({
  contentId: r.id,
  clientId: r.clientId || '',
  clientName: r.clientName || '',
  date: r.scheduledDate || r.dueDate || new Date().toISOString().split('T')[0],
  time: '12:00',
  month: (r.scheduledDate || '').substring(0, 7),
  year: parseInt((r.scheduledDate || '').substring(0, 4), 10) || new Date().getFullYear(),
  platform: (Array.isArray(r.platforms) && r.platforms[0]) || 'Instagram',
  platforms: Array.isArray(r.platforms) ? r.platforms : [],
  contentType: r.contentType || 'Static Post',
  topic: r.title || 'Deliverable',
  caption: r.caption || '',
  internalNotes: r.notes || '',
  status: r.status || 'Planned',
  postedStatus: r.status === 'Posted' ? 'Posted' : 'Not Posted',
  clientApprovalStatus: r.approvalStatus || 'Pending',
  assigneeId: r.assigneeId || '',
  assigneeName: r.assigneeName || '',
  createdBy: 'Admin',
  updatedBy: 'Admin',
  createdAt: r.createdAt || new Date().toISOString(),
  updatedAt: r.updatedAt || new Date().toISOString(),
});

const calendarEntryToD1 = (e: CalendarEntry) => ({
  id: e.contentId,
  title: e.topic,
  clientId: e.clientId,
  clientName: e.clientName,
  contentType: e.contentType,
  platforms: e.platforms && e.platforms.length > 0 ? e.platforms : [e.platform],
  status: e.status,
  assigneeId: e.assigneeId || '',
  assigneeName: e.assigneeName || '',
  scheduledDate: e.date,
  dueDate: e.date,
  caption: e.caption || '',
  notes: e.internalNotes || '',
  approvalStatus: e.clientApprovalStatus || 'Pending',
});

/**
 * Subscribes to canonical calendar entries:
 * 1. Delivers cache immediately (instant UI render)
 * 2. Fetches fresh data from Cloudflare D1 Worker
 * 3. Listens to reactive local change events
 * 4. Periodic background sync with Cloudflare D1
 */
export const subscribeToCanonicalCalendarEntries = (
  callback: (entries: CalendarEntry[]) => void,
  clientId?: string
): (() => void) => {
  // Initial delivery from local cache
  callback(getCachedCalendarEntries());

  const fetchFromD1 = async () => {
    try {
      const d1Rows = await cfGetCalendar(clientId);
      if (Array.isArray(d1Rows) && d1Rows.length > 0) {
        const d1Entries = d1Rows.map(d1ToCalendarEntry);
        // Merge with any freshly cached items
        const local = getCachedCalendarEntries();
        const map = new Map<string, CalendarEntry>();
        d1Entries.forEach(e => map.set(e.contentId, e));
        local.forEach(e => {
          if (!map.has(e.contentId)) {
            map.set(e.contentId, e);
          } else {
            // Keep the newer one
            const d1Item = map.get(e.contentId)!;
            if (e.updatedAt && d1Item.updatedAt && e.updatedAt > d1Item.updatedAt) {
              map.set(e.contentId, { ...d1Item, ...e });
            }
          }
        });
        const merged = Array.from(map.values());
        setCachedCalendarEntries(merged);
        callback(merged);
      }
    } catch (err) {
      console.warn('Cloudflare D1 calendar fetch notice:', err);
    }
  };

  fetchFromD1();

  const handleLocalChange = () => {
    callback(getCachedCalendarEntries());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(CALENDAR_UPDATED_EVENT, handleLocalChange);
  }

  // Poll Cloudflare D1 every 30 seconds
  const intervalId = setInterval(fetchFromD1, 30000);

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(CALENDAR_UPDATED_EVENT, handleLocalChange);
    }
    clearInterval(intervalId);
  };
};

/**
 * Ensures a Firebase Auth session exists (for auth-gated features only).
 * NO Firestore writes — data goes to Cloudflare D1.
 */
export const ensureActiveFirebaseAuth = async (): Promise<string> => {
  let currentUser = auth.currentUser;
  if (!currentUser) {
    try {
      const cred = await signInAnonymously(auth);
      currentUser = cred.user;
    } catch (e) {
      console.warn('Auto-auth anonymous attempt:', e);
    }
  }
  return currentUser?.uid || 'admin_session';
};

/**
 * Persists a new Calendar Entry:
 * 1. Updates LocalStorage cache immediately (optimistic UI)
 * 2. Synchronizes with Cloudflare D1 via Worker API
 * 3. Synchronizes with Tasks collection in Cloudflare D1
 */
export const persistNewCalendarEntry = async (entry: CalendarEntry, userProfile?: any): Promise<CalendarEntry> => {
  const nowIso = new Date().toISOString();
  const contentId = entry.contentId || 'post_' + Math.random().toString(36).substring(2, 9);
  const taskId = entry.taskId || `task_${contentId}`;

  const normalizedEntry: CalendarEntry = {
    ...entry,
    contentId,
    taskId,
    createdAt: entry.createdAt || nowIso,
    updatedAt: nowIso,
  };

  // 1. Optimistic local cache update
  const current = getCachedCalendarEntries();
  const updatedList = [normalizedEntry, ...current.filter(e => e.contentId !== contentId)];
  setCachedCalendarEntries(updatedList);

  // 2. Cloudflare D1 persistence
  try {
    await cfCreateCalendarEntry(calendarEntryToD1(normalizedEntry));
  } catch (d1Err) {
    console.warn('Cloudflare D1 calendar creation notice:', d1Err);
  }

  // 3. Cross-module task sync in Cloudflare D1
  try {
    await persistNewTask({
      id: taskId,
      taskId,
      title: `${normalizedEntry.contentType}: ${normalizedEntry.topic}`,
      description: normalizedEntry.caption || `Scheduled via Content Calendar for ${normalizedEntry.clientName}. Platform: ${normalizedEntry.platform}`,
      clientId: normalizedEntry.clientId,
      clientName: normalizedEntry.clientName,
      category: ['Reel', 'Video', 'YouTube Short'].includes(normalizedEntry.contentType) ? 'Reel Editing' : 'Social Media',
      platform: normalizedEntry.platform,
      assigneeId: normalizedEntry.assigneeId || '',
      assigneeName: normalizedEntry.assigneeName || 'Unassigned',
      priority: 'Medium',
      dueDate: normalizedEntry.date,
      status: normalizedEntry.status === 'Posted' ? 'Done' : (['Idea', 'Planned'].includes(normalizedEntry.status) ? 'To Do' : 'In Progress'),
      createdAt: nowIso,
    }, { uid: userProfile?.userId || userProfile?.uid, name: userProfile?.name });
  } catch (taskErr) {
    console.warn('Task synchronization notice:', taskErr);
  }

  // 4. Auto-sync to Approvals Queue if status requires review
  const isUnderReview = normalizedEntry.status === 'Sent for Approval' || normalizedEntry.clientApprovalStatus === 'Pending';
  if (isUnderReview) {
    try {
      const { createOrUpdateApprovalFromSource } = await import('./approvalStorage');
      await createOrUpdateApprovalFromSource('content', normalizedEntry, { userId: userProfile?.userId || userProfile?.uid, name: userProfile?.name });
    } catch (apprErr) {
      console.warn('Approvals auto-sync notice for content:', apprErr);
    }
  }

  return normalizedEntry;
};

/**
 * Updates an existing Calendar Entry:
 * 1. Updates LocalStorage cache immediately (optimistic UI)
 * 2. Synchronizes with Cloudflare D1 via Worker API
 * 3. Synchronizes with Tasks collection in Cloudflare D1
 */
export const persistUpdateCalendarEntry = async (contentId: string, updates: Partial<CalendarEntry>, userProfile?: any): Promise<CalendarEntry | null> => {
  const nowIso = new Date().toISOString();
  const current = getCachedCalendarEntries();
  const target = current.find(e => e.contentId === contentId);

  const updatedEntry: CalendarEntry = target ? {
    ...target,
    ...updates,
    updatedAt: nowIso
  } : {
    contentId,
    clientId: updates.clientId || '',
    clientName: updates.clientName || 'General',
    date: updates.date || nowIso.split('T')[0],
    platform: updates.platform || 'Instagram',
    contentType: updates.contentType || 'Static Post',
    topic: updates.topic || 'Deliverable',
    status: updates.status || 'Planned',
    createdBy: 'Admin',
    updatedBy: 'Admin',
    createdAt: nowIso,
    updatedAt: nowIso,
    ...updates
  };

  // 1. Update LocalStorage cache immediately
  const updatedList = current.map(e => e.contentId === contentId ? updatedEntry : e);
  if (!target) updatedList.unshift(updatedEntry);
  setCachedCalendarEntries(updatedList);

  // 2. Cloudflare D1 persistence
  try {
    await cfUpdateCalendarEntry(contentId, calendarEntryToD1(updatedEntry));
  } catch (d1Err) {
    console.warn('Cloudflare D1 calendar update notice:', d1Err);
  }

  // 3. Sync linked task in Cloudflare D1
  if (updatedEntry.taskId) {
    try {
      await persistUpdateTask(updatedEntry.taskId, {
        title: `${updatedEntry.contentType}: ${updatedEntry.topic}`,
        dueDate: updatedEntry.date,
        assigneeId: updatedEntry.assigneeId,
        assigneeName: updatedEntry.assigneeName,
        status: updatedEntry.status === 'Posted' ? 'Done' : (['Idea', 'Planned'].includes(updatedEntry.status) ? 'To Do' : 'In Progress')
      });
    } catch (e) {
      console.warn("Task update sync notice:", e);
    }
  }

  // 4. Auto-sync to Approvals Queue if status requires review
  const isUnderReview = updatedEntry.status === 'Sent for Approval' || updatedEntry.clientApprovalStatus === 'Pending';
  if (isUnderReview) {
    try {
      const { createOrUpdateApprovalFromSource } = await import('./approvalStorage');
      await createOrUpdateApprovalFromSource('content', updatedEntry, { userId: userProfile?.userId || userProfile?.uid, name: userProfile?.name });
    } catch (apprErr) {
      console.warn('Approvals auto-sync notice on content update:', apprErr);
    }
  }

  return updatedEntry;
};

/**
 * Deletes a Calendar Entry:
 * 1. Updates LocalStorage cache immediately
 * 2. Deletes from Cloudflare D1 via Worker API
 * 3. Deletes linked Task from Cloudflare D1
 */
export const persistDeleteCalendarEntry = async (contentId: string): Promise<void> => {
  const current = getCachedCalendarEntries();
  const target = current.find(e => e.contentId === contentId);
  const updatedList = current.filter(e => e.contentId !== contentId);
  setCachedCalendarEntries(updatedList);

  try {
    await cfDeleteCalendarEntry(contentId);
  } catch (d1Err) {
    console.warn('Cloudflare D1 calendar delete notice:', d1Err);
  }

  if (target?.taskId) {
    try {
      await persistDeleteTask(target.taskId);
    } catch (e) {
      console.warn('Task delete sync notice:', e);
    }
  }
};
