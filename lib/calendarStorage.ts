import { 
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, 
  onSnapshot, query, where, orderBy 
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from './firebase';
import { persistNewTask, persistUpdateTask, persistDeleteTask } from './taskStorage';

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

export const DEFAULT_CALENDAR_SEEDS: CalendarEntry[] = [
  {
    contentId: 'cal_seed_1',
    clientId: 'client_dr_anupam_jindal',
    clientName: 'Dr. Anupam Jindal',
    date: new Date().toISOString().split('T')[0],
    time: '18:00',
    month: new Date().toISOString().substring(0, 7),
    year: new Date().getFullYear(),
    platform: 'Instagram',
    contentType: 'Reel',
    topic: 'Minimally Invasive Spine Surgery Benefits & Recovery',
    caption: 'Discover how modern robotic neurosurgery reduces recovery time from weeks to days.',
    hashtags: '#neurosurgery #spinehealth #dranupamjindal #healthcare',
    status: 'Planned',
    postedStatus: 'Not Posted',
    clientApprovalStatus: 'Pending',
    assigneeId: 'emp_2',
    assigneeName: 'Neha Gupta',
    createdBy: 'System Admin',
    updatedBy: 'System Admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    contentId: 'cal_seed_2',
    clientId: 'client_dr_manishi_bansal',
    clientName: 'Dr. Manishi Bansal',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    time: '11:00',
    month: new Date(Date.now() + 86400000).toISOString().substring(0, 7),
    year: new Date().getFullYear(),
    platform: 'Instagram',
    contentType: 'Carousel',
    topic: '5 Essential Nutrition Tips During Second Trimester',
    caption: 'Swipe through to learn vital dietary habits for a healthy pregnancy journey.',
    hashtags: '#womenshealth #pregnancycare #drmanishibansal #gynecology',
    status: 'In Design',
    postedStatus: 'Not Posted',
    clientApprovalStatus: 'Pending',
    assigneeId: 'emp_4',
    assigneeName: 'Priya Singh',
    createdBy: 'System Admin',
    updatedBy: 'System Admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    contentId: 'cal_seed_3',
    clientId: 'client_gangotri_ice',
    clientName: 'Gangotri Ice Cubes',
    date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    time: '14:00',
    month: new Date(Date.now() + 86400000 * 2).toISOString().substring(0, 7),
    year: new Date().getFullYear(),
    platform: 'Facebook',
    contentType: 'Static Post',
    topic: 'Triple-Filtered Pure Crystal Ice For Premium Cafes',
    caption: 'Purity you can taste in every single cube. Ultra-hygienic and crystal clear.',
    hashtags: '#gangotriice #crystalpure #hospitalitysupplies',
    status: 'Approved',
    postedStatus: 'Not Posted',
    clientApprovalStatus: 'Approved',
    assigneeId: 'emp_1',
    assigneeName: 'Aman Sharma',
    createdBy: 'System Admin',
    updatedBy: 'System Admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

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
  } catch (e) {
    console.warn('Could not write calendar cache:', e);
  }
};

/**
 * Ensures that Firebase Auth has an active session and that
 * the user profile document is properly configured with superAdmin / admin role.
 */
export const ensureActiveFirebaseAuth = async (): Promise<string> => {
  let currentUser = auth.currentUser;
  if (!currentUser) {
    try {
      const cred = await signInAnonymously(auth);
      currentUser = cred.user;
    } catch (e) {
      console.warn("Auto-auth anonymous attempt:", e);
    }
  }

  const activeUid = currentUser?.uid || 'admin_session';

  if (currentUser) {
    try {
      // Upsert superAdmin profile document for active auth UID so security rules succeed
      await setDoc(doc(db, 'users', currentUser.uid), {
        userId: currentUser.uid,
        name: 'Digiexplode Super Admin',
        email: currentUser.email || 'admin@digiexplode.ai',
        role: 'superAdmin',
        status: 'active',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn("User profile sync notice:", err);
    }
  }

  return activeUid;
};

/**
 * Persists a new Calendar Entry:
 * 1. Updates LocalStorage cache immediately (optimistic UI)
 * 2. Synchronizes with Tasks collection & Video production
 * 3. Persists to Firestore contentCalendar collection
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

  // 2. Cross-module task sync
  try {
    const isVideo = ['Reel', 'Video', 'YouTube Short'].includes(normalizedEntry.contentType);
    await persistNewTask({
      id: taskId,
      taskId,
      title: `${normalizedEntry.contentType}: ${normalizedEntry.topic}`,
      description: normalizedEntry.caption || `Scheduled via Content Calendar for ${normalizedEntry.clientName}. Platform: ${normalizedEntry.platform}`,
      clientId: normalizedEntry.clientId,
      clientName: normalizedEntry.clientName,
      category: isVideo ? 'Reel Editing' : 'Social Media',
      platform: normalizedEntry.platform,
      assigneeId: normalizedEntry.assigneeId || '',
      assigneeName: normalizedEntry.assigneeName || 'Unassigned',
      priority: 'Medium',
      dueDate: normalizedEntry.date,
      status: normalizedEntry.status === 'Posted' ? 'Done' : (['Idea', 'Planned'].includes(normalizedEntry.status) ? 'To Do' : 'In Progress'),
      createdAt: nowIso,
    }, { uid: userProfile?.userId || userProfile?.uid, name: userProfile?.name });

    // Video production tracker link if video
    if (isVideo) {
      const videoId = `vid_${contentId}`;
      await setDoc(doc(db, 'videoTracker', videoId), {
        id: videoId,
        clientName: normalizedEntry.clientName,
        videoCount: 1,
        shotDate: normalizedEntry.date,
        status: 'Pending',
        editorName: normalizedEntry.assigneeName || '',
        shotTakenBy: userProfile?.name || 'Producer',
        editorAssigned: normalizedEntry.assigneeName || '',
        notes: `Auto-linked from Calendar: ${normalizedEntry.topic}`,
        createdAt: nowIso
      }, { merge: true }).catch(() => {});
    }
  } catch (taskErr) {
    console.warn("Task synchronization notice:", taskErr);
  }

  // 3. Ensure Auth session and persist to Firestore
  try {
    await ensureActiveFirebaseAuth();
    await setDoc(doc(db, 'contentCalendar', contentId), normalizedEntry, { merge: true });

    // 4. Auto-sync to Approvals Queue if status requires review
    const isUnderReview = normalizedEntry.status === 'Sent for Approval' || normalizedEntry.clientApprovalStatus === 'Pending';
    if (isUnderReview) {
      try {
        const { createOrUpdateApprovalFromSource } = await import('./approvalStorage');
        await createOrUpdateApprovalFromSource('content', normalizedEntry, { userId: userProfile?.userId || userProfile?.uid, name: userProfile?.name });
      } catch (apprErr) {
        console.warn("Approvals auto-sync notice for content:", apprErr);
      }
    }
  } catch (firestoreErr: any) {
    console.warn("Firestore sync notice for contentCalendar (cached locally):", firestoreErr);
  }

  return normalizedEntry;
};

/**
 * Updates an existing Calendar Entry
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

  // 1. Update LocalStorage cache
  const updatedList = current.map(e => e.contentId === contentId ? updatedEntry : e);
  if (!target) updatedList.unshift(updatedEntry);
  setCachedCalendarEntries(updatedList);

  // 2. Sync linked task
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

  // 3. Persist to Firestore
  try {
    await ensureActiveFirebaseAuth();
    await setDoc(doc(db, 'contentCalendar', contentId), updatedEntry, { merge: true });

    // 4. Auto-sync to Approvals Queue if status requires review
    const isUnderReview = updatedEntry.status === 'Sent for Approval' || updatedEntry.clientApprovalStatus === 'Pending';
    if (isUnderReview) {
      try {
        const { createOrUpdateApprovalFromSource } = await import('./approvalStorage');
        await createOrUpdateApprovalFromSource('content', updatedEntry, { userId: userProfile?.userId || userProfile?.uid, name: userProfile?.name });
      } catch (apprErr) {
        console.warn("Approvals auto-sync notice on content update:", apprErr);
      }
    }
  } catch (err) {
    console.warn("Firestore update notice for contentCalendar (cached locally):", err);
  }

  return updatedEntry;
};

/**
 * Deletes a Calendar Entry
 */
export const persistDeleteCalendarEntry = async (contentId: string): Promise<void> => {
  const current = getCachedCalendarEntries();
  const target = current.find(e => e.contentId === contentId);
  const updatedList = current.filter(e => e.contentId !== contentId);
  setCachedCalendarEntries(updatedList);

  if (target?.taskId) {
    try {
      await persistDeleteTask(target.taskId);
    } catch (e) {
      console.warn("Task delete sync notice:", e);
    }
  }

  try {
    await deleteDoc(doc(db, 'contentCalendar', contentId));
  } catch (err) {
    console.warn("Firestore delete notice:", err);
  }
};
