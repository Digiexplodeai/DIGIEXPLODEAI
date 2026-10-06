import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  query, where 
} from 'firebase/firestore';
import { db } from './firebase';
import { ensureActiveFirebaseAuth } from './calendarStorage';
import { 
  type Task, 
  getCachedTasks, 
  setCachedTasks, 
  persistUpdateTask, 
  persistNewTask 
} from './taskStorage';
import { 
  type VideoProductionEntry, 
  type VideoStatus 
} from '../components/Portal/VideoTrackerView';
import { syncTaskCompletionToWorkLog, syncTaskReopenedState } from './taskWorkLogSync';

// Active lock to prevent ping-pong synchronization loops
const activeSyncKeys = new Set<string>();

/**
 * Normalizes video cache key
 */
const VIDEO_CACHE_KEY = 'digi_video_tracker_cache';

const getCachedVideos = (): VideoProductionEntry[] => {
  try {
    const raw = localStorage.getItem(VIDEO_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
};

const updateCachedVideo = (videoId: string, updates: Partial<VideoProductionEntry>) => {
  try {
    const current = getCachedVideos();
    const updated = current.map(v => v.id === videoId ? { ...v, ...updates, updatedAt: new Date().toISOString() } : v);
    localStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify(updated));
  } catch (e) {}
};

/**
 * Synchronizes a Video Production Entry with its canonical Shoot and Editing operational tasks.
 * Idempotent: checks for existing shootTaskId / editTaskId to avoid duplicate task creation.
 */
export async function syncVideoProductionToTasks(
  videoEntry: VideoProductionEntry,
  options?: { userProfile?: any; uid?: string }
): Promise<{ shootTaskId: string; editTaskId: string }> {
  const syncKey = `vid_to_tasks_${videoEntry.id}`;
  if (activeSyncKeys.has(syncKey)) {
    return {
      shootTaskId: videoEntry.shootTaskId || `task_shoot_${videoEntry.id}`,
      editTaskId: videoEntry.editTaskId || `task_edit_${videoEntry.id}`
    };
  }
  activeSyncKeys.add(syncKey);

  try {
    await ensureActiveFirebaseAuth().catch(console.warn);
    const nowIso = new Date().toISOString();
    const shootTaskId = videoEntry.shootTaskId || `task_shoot_${videoEntry.id}`;
    const editTaskId = videoEntry.editTaskId || `task_edit_${videoEntry.id}`;

    const isShotDone = ['shot', 'editing', 'review', 'finished'].includes(videoEntry.status);
    const isEditDone = videoEntry.status === 'finished';
    const isEditingInProgress = ['editing', 'review'].includes(videoEntry.status);

    const shootStatus: 'To Do' | 'Done' = isShotDone ? 'Done' : 'To Do';
    let editStatus: 'To Do' | 'In Progress' | 'In Review' | 'Done' = 'To Do';
    if (isEditDone) {
      editStatus = 'Done';
    } else if (videoEntry.status === 'review') {
      editStatus = 'In Review';
    } else if (videoEntry.status === 'editing') {
      editStatus = 'In Progress';
    }

    // ── 1. Create or Update Shoot Task ──
    const shootTaskPayload: Task = {
      id: shootTaskId,
      taskId: shootTaskId,
      title: `Shoot: ${videoEntry.title}`,
      description: `Video Production Shoot. Client: ${videoEntry.clientName}. Planned Quantity: ${videoEntry.plannedQuantity} video(s). Notes: ${videoEntry.notes || 'None'}. Shoot Date: ${videoEntry.shootDate}`,
      clientId: videoEntry.clientId,
      clientName: videoEntry.clientName,
      category: 'Video Shoot',
      assigneeId: videoEntry.videographerId || '',
      assigneeName: videoEntry.videographerName || 'Unassigned',
      priority: 'High',
      scheduledDate: videoEntry.shootDate || nowIso.split('T')[0],
      dueDate: videoEntry.shootDate || nowIso.split('T')[0],
      originalScheduledDate: videoEntry.shootDate || nowIso.split('T')[0],
      originalDueDate: videoEntry.shootDate || nowIso.split('T')[0],
      firstPendingSince: videoEntry.shootDate || nowIso.split('T')[0],
      rolloverCount: 0,
      status: shootStatus,
      videoProductionId: videoEntry.id,
      videoTrackerId: videoEntry.id,
      productionRole: 'shoot',
      createdAt: videoEntry.createdAt || nowIso,
      updatedAt: nowIso,
      ...(shootStatus === 'Done' ? { completedAt: videoEntry.shotAt || nowIso } : {}),
    };

    // ── 2. Create or Update Editing Task ──
    const editDueDate = videoEntry.dueDate || videoEntry.shootDate || nowIso.split('T')[0];
    const editTaskPayload: Task = {
      id: editTaskId,
      taskId: editTaskId,
      title: `Edit: ${videoEntry.title}`,
      description: `Video Production Edit. Client: ${videoEntry.clientName}. Planned Quantity: ${videoEntry.plannedQuantity} video(s). Raw Footage: ${videoEntry.footageLink || 'Pending'}. Notes: ${videoEntry.notes || 'None'}. Due Date: ${editDueDate}`,
      clientId: videoEntry.clientId,
      clientName: videoEntry.clientName,
      category: 'Video Editing',
      assigneeId: videoEntry.editorId || '',
      assigneeName: videoEntry.editorName || 'Unassigned',
      priority: 'High',
      scheduledDate: videoEntry.shootDate || editDueDate,
      dueDate: editDueDate,
      originalScheduledDate: videoEntry.shootDate || editDueDate,
      originalDueDate: editDueDate,
      firstPendingSince: videoEntry.shootDate || editDueDate,
      rolloverCount: 0,
      status: editStatus,
      videoProductionId: videoEntry.id,
      videoTrackerId: videoEntry.id,
      productionRole: 'edit',
      dependsOnTaskId: shootTaskId,
      blockedByShoot: !isShotDone,
      createdAt: videoEntry.createdAt || nowIso,
      updatedAt: nowIso,
      ...(editStatus === 'Done' ? { completedAt: videoEntry.completedAt || nowIso } : {}),
    };

    // Persist tasks in local cache
    const currentTasks = getCachedTasks();
    const updatedTasks = [
      shootTaskPayload,
      editTaskPayload,
      ...currentTasks.filter(t => t.id !== shootTaskId && t.id !== editTaskId)
    ];
    setCachedTasks(updatedTasks);

    // Persist tasks in Firestore
    try {
      await setDoc(doc(db, 'tasks', shootTaskId), shootTaskPayload, { merge: true });
    } catch (e) {
      console.warn("Shoot task Firestore sync notice:", e);
    }

    try {
      await setDoc(doc(db, 'tasks', editTaskId), editTaskPayload, { merge: true });
    } catch (e) {
      console.warn("Edit task Firestore sync notice:", e);
    }

    // Ensure Video Production record has linked task IDs
    if (!videoEntry.shootTaskId || !videoEntry.editTaskId) {
      updateCachedVideo(videoEntry.id, { shootTaskId, editTaskId });
      try {
        await updateDoc(doc(db, 'videoTracker', videoEntry.id), {
          shootTaskId,
          editTaskId,
          updatedAt: nowIso
        });
      } catch (e) {
        console.warn("Video tracker link task ID sync notice:", e);
      }
    }

    // ── 3. Automatic Work Log generation for completed tasks ──
    if (shootStatus === 'Done') {
      try {
        await syncTaskCompletionToWorkLog(
          {
            taskId: shootTaskId,
            title: shootTaskPayload.title,
            description: shootTaskPayload.description,
            clientId: shootTaskPayload.clientId,
            clientName: shootTaskPayload.clientName,
            assigneeId: shootTaskPayload.assigneeId || 'emp_unassigned',
            assigneeName: shootTaskPayload.assigneeName || 'Videographer',
            category: 'Video Shoot',
            quantity: videoEntry.shotQuantity || videoEntry.plannedQuantity || 1,
            completedAt: videoEntry.shotAt || nowIso,
            videoProductionId: videoEntry.id,
            video_production_id: videoEntry.id,
          },
          options?.userProfile,
          options?.uid
        );
      } catch (logErr) {
        console.warn("Shoot task work log sync notice:", logErr);
      }
    }

    if (editStatus === 'Done') {
      try {
        await syncTaskCompletionToWorkLog(
          {
            taskId: editTaskId,
            title: editTaskPayload.title,
            description: editTaskPayload.description,
            clientId: editTaskPayload.clientId,
            clientName: editTaskPayload.clientName,
            assigneeId: editTaskPayload.assigneeId || 'emp_unassigned',
            assigneeName: editTaskPayload.assigneeName || 'Video Editor',
            category: 'Video Editing',
            quantity: videoEntry.finishedQuantity || videoEntry.shotQuantity || videoEntry.plannedQuantity || 1,
            completedAt: videoEntry.completedAt || nowIso,
            videoProductionId: videoEntry.id,
            video_production_id: videoEntry.id,
          },
          options?.userProfile,
          options?.uid
        );
      } catch (logErr) {
        console.warn("Edit task work log sync notice:", logErr);
      }
    }

    return { shootTaskId, editTaskId };
  } finally {
    activeSyncKeys.delete(syncKey);
  }
}

/**
 * Synchronizes task state changes (status, assignee, due date) back to parent Video Production record.
 */
export async function syncTaskToVideoProduction(
  task: Task,
  previousTaskState?: Partial<Task>,
  userProfile?: any
): Promise<void> {
  const videoId = task.videoProductionId || task.videoTrackerId;
  if (!videoId) return;

  const syncKey = `task_to_vid_${task.id}_${videoId}`;
  if (activeSyncKeys.has(syncKey)) return;
  activeSyncKeys.add(syncKey);

  try {
    await ensureActiveFirebaseAuth().catch(console.warn);
    const nowIso = new Date().toISOString();

    // Read cached or Firestore video record
    let videoRecord: VideoProductionEntry | null = null;
    const cachedVideos = getCachedVideos();
    videoRecord = cachedVideos.find(v => v.id === videoId) || null;

    if (!videoRecord) {
      try {
        const snap = await getDoc(doc(db, 'videoTracker', videoId));
        if (snap.exists()) {
          videoRecord = { id: snap.id, ...snap.data() } as VideoProductionEntry;
        }
      } catch (e) {
        console.warn("Fetch parent video notice:", e);
      }
    }

    if (!videoRecord) return;

    const updates: Partial<VideoProductionEntry> = {
      updatedAt: nowIso
    };

    const isShootTask = task.productionRole === 'shoot' || task.category === 'Video Shoot' || task.id.includes('shoot');
    const isEditTask = task.productionRole === 'edit' || task.category === 'Video Editing' || task.id.includes('edit');

    // ── 1. Status Synchronization ──
    const normStatus = task.status;
    if (isShootTask) {
      if (normStatus === 'Done') {
        if (videoRecord.status === 'pending_shoot') {
          updates.status = 'shot';
          updates.shotAt = task.completedAt || nowIso;
          updates.shotQuantity = videoRecord.shotQuantity > 0 ? videoRecord.shotQuantity : videoRecord.plannedQuantity;
        }
        // Unblock editing task
        if (videoRecord.editTaskId) {
          persistUpdateTask(videoRecord.editTaskId, { blockedByShoot: false });
        }
      } else if (normStatus === 'In Progress' || normStatus === 'To Do') {
        if (videoRecord.status === 'shot') {
          updates.status = 'pending_shoot';
        }
      }
    } else if (isEditTask) {
      if (normStatus === 'Done') {
        updates.status = 'finished';
        updates.completedAt = task.completedAt || nowIso;
        updates.finishedQuantity = videoRecord.shotQuantity > 0 ? videoRecord.shotQuantity : videoRecord.plannedQuantity;
        updates.completedByEmployeeId = task.assigneeId || '';
        updates.completedByName = task.assigneeName || '';
      } else if (normStatus === 'In Review') {
        updates.status = 'review';
        updates.reviewedAt = nowIso;
      } else if (normStatus === 'In Progress') {
        updates.status = 'editing';
        updates.editingStartedAt = nowIso;
      } else if (normStatus === 'To Do') {
        if (videoRecord.status === 'editing' || videoRecord.status === 'review' || videoRecord.status === 'finished') {
          updates.status = (videoRecord.shotQuantity > 0 || videoRecord.shotAt) ? 'shot' : 'pending_shoot';
        }
      }
    }

    // ── 2. Assignee Two-Way Synchronization ──
    if (isShootTask && task.assigneeId !== undefined) {
      if (task.assigneeId !== videoRecord.videographerId || task.assigneeName !== videoRecord.videographerName) {
        updates.videographerId = task.assigneeId;
        updates.videographerName = task.assigneeName || 'Unassigned';
      }
    } else if (isEditTask && task.assigneeId !== undefined) {
      if (task.assigneeId !== videoRecord.editorId || task.assigneeName !== videoRecord.editorName) {
        updates.editorId = task.assigneeId;
        updates.editorName = task.assigneeName || 'Unassigned';
      }
    }

    // ── 3. Due Date Two-Way Synchronization ──
    if (isShootTask && task.dueDate && task.dueDate !== videoRecord.shootDate) {
      updates.shootDate = task.dueDate;
    } else if (isEditTask && task.dueDate && task.dueDate !== videoRecord.dueDate) {
      updates.dueDate = task.dueDate;
    }

    // Apply updates if changes exist
    if (Object.keys(updates).length > 1) { // more than just updatedAt
      updateCachedVideo(videoId, updates);
      try {
        await updateDoc(doc(db, 'videoTracker', videoId), updates);
      } catch (e) {
        console.warn("Update parent video in Firestore notice:", e);
      }
    }
  } finally {
    activeSyncKeys.delete(syncKey);
  }
}

/**
 * Synchronizes Video Production workflow action buttons to linked Tasks.
 */
export async function syncVideoStatusToTasks(
  videoEntry: VideoProductionEntry,
  newStatus: VideoStatus,
  extraPayload: Partial<VideoProductionEntry> = {},
  userProfile?: any
): Promise<void> {
  const syncKey = `vid_status_to_tasks_${videoEntry.id}_${newStatus}`;
  if (activeSyncKeys.has(syncKey)) return;
  activeSyncKeys.add(syncKey);

  try {
    await ensureActiveFirebaseAuth().catch(console.warn);
    const nowIso = new Date().toISOString();
    const shootTaskId = videoEntry.shootTaskId || `task_shoot_${videoEntry.id}`;
    const editTaskId = videoEntry.editTaskId || `task_edit_${videoEntry.id}`;

    if (newStatus === 'shot') {
      // 1. Mark shoot task Done
      await persistUpdateTask(shootTaskId, {
        status: 'Done',
        completedAt: nowIso,
        updatedAt: nowIso,
      });

      // 2. Unblock editing task
      await persistUpdateTask(editTaskId, {
        blockedByShoot: false,
        updatedAt: nowIso,
      });

      // 3. Auto-generate Work Log for Videographer
      await syncTaskCompletionToWorkLog(
        {
          taskId: shootTaskId,
          title: `Shoot: ${videoEntry.title}`,
          description: `Video Production Shoot. Client: ${videoEntry.clientName}`,
          clientId: videoEntry.clientId,
          clientName: videoEntry.clientName,
          assigneeId: videoEntry.videographerId || 'emp_unassigned',
          assigneeName: videoEntry.videographerName || 'Videographer',
          category: 'Video Shoot',
          quantity: extraPayload.shotQuantity ?? videoEntry.plannedQuantity ?? 1,
          completedAt: nowIso,
          videoProductionId: videoEntry.id,
          video_production_id: videoEntry.id,
        },
        userProfile
      );
    } else if (newStatus === 'editing') {
      // Set editing task to In Progress
      await persistUpdateTask(editTaskId, {
        status: 'In Progress',
        blockedByShoot: false,
        updatedAt: nowIso,
      });
    } else if (newStatus === 'review') {
      // Set editing task to In Review
      await persistUpdateTask(editTaskId, {
        status: 'In Review',
        blockedByShoot: false,
        updatedAt: nowIso,
      });

      // Auto-sync to Approvals Queue
      try {
        const { createOrUpdateApprovalFromSource } = await import('./approvalStorage');
        await createOrUpdateApprovalFromSource('video', {
          ...videoEntry,
          status: 'review',
          editTaskId,
          ...extraPayload,
        }, userProfile);
      } catch (apprErr) {
        console.warn('Approvals auto-sync notice for video:', apprErr);
      }
    } else if (newStatus === 'finished') {
      // Mark editing task Done
      await persistUpdateTask(editTaskId, {
        status: 'Done',
        blockedByShoot: false,
        completedAt: nowIso,
        updatedAt: nowIso,
      });

      // Auto-generate Work Log for Editor
      const finalEditorId = extraPayload.completedByEmployeeId || videoEntry.editorId || 'emp_unassigned';
      const finalEditorName = extraPayload.completedByName || videoEntry.editorName || 'Video Editor';

      await syncTaskCompletionToWorkLog(
        {
          taskId: editTaskId,
          title: `Edit: ${videoEntry.title}`,
          description: `Video Production Edit. Client: ${videoEntry.clientName}`,
          clientId: videoEntry.clientId,
          clientName: videoEntry.clientName,
          assigneeId: finalEditorId,
          assigneeName: finalEditorName,
          category: 'Video Editing',
          quantity: extraPayload.finishedQuantity ?? videoEntry.shotQuantity ?? videoEntry.plannedQuantity ?? 1,
          completedAt: nowIso,
          videoProductionId: videoEntry.id,
          video_production_id: videoEntry.id,
        },
        userProfile
      );
    } else if (newStatus === 'pending_shoot') {
      // Revert shoot task to To Do and block editing task
      await persistUpdateTask(shootTaskId, {
        status: 'To Do',
        updatedAt: nowIso,
      });
      await syncTaskReopenedState(shootTaskId);

      await persistUpdateTask(editTaskId, {
        status: 'To Do',
        blockedByShoot: true,
        updatedAt: nowIso,
      });
    }
  } finally {
    activeSyncKeys.delete(syncKey);
  }
}

/**
 * Synchronizes assignee changes from Video Production to linked Tasks.
 */
export async function syncVideoAssigneesToTasks(
  videoEntry: VideoProductionEntry,
  userProfile?: any
): Promise<void> {
  const shootTaskId = videoEntry.shootTaskId || `task_shoot_${videoEntry.id}`;
  const editTaskId = videoEntry.editTaskId || `task_edit_${videoEntry.id}`;

  if (videoEntry.videographerId !== undefined) {
    await persistUpdateTask(shootTaskId, {
      assigneeId: videoEntry.videographerId || '',
      assigneeName: videoEntry.videographerName || 'Unassigned',
      dueDate: videoEntry.shootDate,
    });
  }

  if (videoEntry.editorId !== undefined) {
    await persistUpdateTask(editTaskId, {
      assigneeId: videoEntry.editorId || '',
      assigneeName: videoEntry.editorName || 'Unassigned',
      dueDate: videoEntry.dueDate || videoEntry.shootDate,
    });
  }
}
