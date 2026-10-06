import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  query
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  Film, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  User, 
  AlertCircle,
  TrendingUp,
  FileText,
  Video,
  Play,
  RotateCcw,
  Eye,
  Check,
  X,
  Sliders,
  ChevronRight,
  Filter,
  Search,
  Sparkles,
  Layers,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Link2,
  FolderSync,
  ExternalLink,
  ShieldAlert,
  UserCheck
} from 'lucide-react';
import { type ClientData } from './ClientList';
import { DEFAULT_CLIENTS_MASTER } from '../../lib/clientMaster';
import { 
  subscribeToCanonicalEmployees, 
  getCachedEmployees, 
  type MasterEmployee 
} from '../../lib/employeeMaster';
import { ClientSelect } from './ClientSelect';
import { ensureActiveFirebaseAuth } from '../../lib/calendarStorage';
import { 
  syncVideoProductionToTasks, 
  syncVideoStatusToTasks, 
  syncVideoAssigneesToTasks 
} from '../../lib/productionBridge';

export type VideoStatus = 'pending_shoot' | 'shot' | 'editing' | 'review' | 'finished';

export interface VideoProductionEntry {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  plannedQuantity: number;
  shotQuantity: number;
  finishedQuantity: number;
  shootDate: string; // YYYY-MM-DD
  dueDate?: string;  // YYYY-MM-DD
  status: VideoStatus;
  videographerId?: string;
  videographerName?: string;
  editorId?: string;
  editorName?: string;
  completedByEmployeeId?: string;
  completedByName?: string;
  shotAt?: string;
  editingStartedAt?: string;
  reviewedAt?: string;
  completedAt?: string;
  notes?: string;
  footageLink?: string;
  referenceLink?: string;
  contentItemId?: string;
  taskId?: string;
  shootTaskId?: string;
  editTaskId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdByUid?: string;
  auditHistory?: Array<{
    actorId: string;
    actorName: string;
    timestamp: string;
    action: string;
    details?: string;
  }>;
}

export const STATUS_CONFIG: Record<VideoStatus, {
  label: string;
  shortLabel: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  dotColor: string;
  nextAction?: string;
  nextStatus?: VideoStatus;
}> = {
  pending_shoot: {
    label: 'Pending Shoot',
    shortLabel: 'Pending',
    color: 'text-amber-700 dark:text-amber-300',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
    badgeText: 'text-amber-700 dark:text-amber-400',
    borderColor: 'border-amber-200 dark:border-amber-900/60',
    dotColor: 'bg-amber-500',
    nextAction: 'Mark as Shot',
    nextStatus: 'shot'
  },
  shot: {
    label: 'Shot · Awaiting Edit',
    shortLabel: 'Shot',
    color: 'text-sky-700 dark:text-sky-300',
    badgeBg: 'bg-sky-50 dark:bg-sky-950/40',
    badgeText: 'text-sky-700 dark:text-sky-400',
    borderColor: 'border-sky-200 dark:border-sky-900/60',
    dotColor: 'bg-sky-500',
    nextAction: 'Start Editing',
    nextStatus: 'editing'
  },
  editing: {
    label: 'Editing in Progress',
    shortLabel: 'Editing',
    color: 'text-indigo-700 dark:text-indigo-300',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/40',
    badgeText: 'text-indigo-700 dark:text-indigo-400',
    borderColor: 'border-indigo-200 dark:border-indigo-900/60',
    dotColor: 'bg-indigo-500',
    nextAction: 'Send to Review',
    nextStatus: 'review'
  },
  review: {
    label: 'In Review & Approval',
    shortLabel: 'Review',
    color: 'text-purple-700 dark:text-purple-300',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/40',
    badgeText: 'text-purple-700 dark:text-purple-400',
    borderColor: 'border-purple-200 dark:border-purple-900/60',
    dotColor: 'bg-purple-500',
    nextAction: 'Mark Finished',
    nextStatus: 'finished'
  },
  finished: {
    label: 'Finished / Ready to Publish',
    shortLabel: 'Finished',
    color: 'text-emerald-700 dark:text-emerald-300',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    badgeText: 'text-emerald-700 dark:text-emerald-400',
    borderColor: 'border-emerald-200 dark:border-emerald-900/60',
    dotColor: 'bg-emerald-500'
  }
};

export function normalizeVideoEntry(docId: string, data: any): VideoProductionEntry {
  // 1. Normalize status
  let status: VideoStatus = 'pending_shoot';
  const rawStatus = (data.status || '').toLowerCase();
  if (rawStatus === 'pending' || rawStatus === 'pending_shoot' || rawStatus === 'pending shoot') {
    status = 'pending_shoot';
  } else if (rawStatus === 'shot' || rawStatus === 'shot · awaiting edit' || rawStatus === 'shot (done)') {
    status = 'shot';
  } else if (rawStatus === 'editing' || rawStatus === 'in_progress' || rawStatus === 'in progress') {
    status = 'editing';
  } else if (rawStatus === 'review' || rawStatus === 'in review' || rawStatus === 'in_review') {
    status = 'review';
  } else if (rawStatus === 'edited' || rawStatus === 'finished' || rawStatus === 'complete' || rawStatus === 'done') {
    status = 'finished';
  }

  // 2. Normalize quantities
  const rawCount = typeof data.plannedQuantity === 'number' 
    ? data.plannedQuantity 
    : (typeof data.videoCount === 'number' 
      ? data.videoCount 
      : (typeof data.quantity === 'number' ? data.quantity : 1));

  let plannedQuantity = rawCount > 0 ? rawCount : 1;
  let shotQuantity = typeof data.shotQuantity === 'number' ? data.shotQuantity : 0;
  let finishedQuantity = typeof data.finishedQuantity === 'number' ? data.finishedQuantity : 0;

  if (status === 'pending_shoot') {
    plannedQuantity = rawCount > 0 ? rawCount : 1;
    shotQuantity = 0;
    finishedQuantity = 0;
  } else if (status === 'shot' || status === 'editing' || status === 'review') {
    shotQuantity = typeof data.shotQuantity === 'number' ? data.shotQuantity : rawCount;
    plannedQuantity = typeof data.plannedQuantity === 'number' ? data.plannedQuantity : shotQuantity;
    finishedQuantity = typeof data.finishedQuantity === 'number' ? data.finishedQuantity : 0;
  } else if (status === 'finished') {
    finishedQuantity = typeof data.finishedQuantity === 'number' ? data.finishedQuantity : rawCount;
    shotQuantity = typeof data.shotQuantity === 'number' ? data.shotQuantity : finishedQuantity;
    plannedQuantity = typeof data.plannedQuantity === 'number' ? data.plannedQuantity : shotQuantity;
  }

  // Incomplete records NEVER show Completed By
  const completedByEmployeeId = status === 'finished' ? (data.completedByEmployeeId || data.editorId || '') : '';
  const completedByName = status === 'finished' ? (data.completedByName || data.editorName || data.editedBy || '') : '';
  const completedAt = status === 'finished' ? (data.completedAt || data.updatedAt || data.createdAt || '') : '';

  return {
    id: docId,
    clientId: data.clientId || '',
    clientName: data.clientName || 'General Client',
    title: data.title || data.topic || `${plannedQuantity} Video Deliverable(s)`,
    plannedQuantity,
    shotQuantity,
    finishedQuantity,
    shootDate: data.shootDate || data.shotDate || data.recordingDate || new Date().toISOString().split('T')[0],
    dueDate: data.dueDate || '',
    status,
    videographerId: data.videographerId || data.shotTakenById || '',
    videographerName: data.videographerName || data.shotTakenBy || data.recordedBy || '',
    editorId: data.editorId || data.editorAssignedId || '',
    editorName: data.editorName || data.editorAssigned || data.editedBy || '',
    completedByEmployeeId,
    completedByName,
    shotAt: data.shotAt || '',
    editingStartedAt: data.editingStartedAt || '',
    reviewedAt: data.reviewedAt || '',
    completedAt,
    notes: data.notes || '',
    footageLink: data.footageLink || data.rawFootageLink || '',
    referenceLink: data.referenceLink || '',
    contentItemId: data.contentItemId || data.contentId || '',
    taskId: data.taskId || data.linkedTaskId || '',
    shootTaskId: data.shootTaskId || '',
    editTaskId: data.editTaskId || '',
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
    createdBy: data.createdBy || 'Super Admin',
    createdByUid: data.createdByUid || '',
    auditHistory: Array.isArray(data.auditHistory) ? data.auditHistory : []
  };
}

const DEFAULT_INITIAL_VIDEOS: VideoProductionEntry[] = [
  {
    id: 'vid-demo-1',
    clientId: 'client_dr_anupam_jindal',
    clientName: 'Dr. Anupam Jindal',
    title: 'Neurosurgery Patient Recovery & Robotic Spine FAQ Set',
    plannedQuantity: 4,
    shotQuantity: 4,
    finishedQuantity: 0,
    shootDate: new Date().toISOString().split('T')[0],
    status: 'shot',
    videographerId: 'emp_1',
    videographerName: 'Aman Sharma',
    editorId: 'emp_2',
    editorName: 'Neha Gupta',
    notes: 'Brain surgery patient testimonial & robotic spine Q&A reel set',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Super Admin'
  },
  {
    id: 'vid-demo-2',
    clientId: 'client_dr_manishi_bansal',
    clientName: 'Dr. Manishi Bansal',
    title: 'High-Risk Pregnancy Awareness Series',
    plannedQuantity: 3,
    shotQuantity: 3,
    finishedQuantity: 3,
    shootDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
    status: 'finished',
    videographerId: 'emp_3',
    videographerName: 'Rahul Verma',
    editorId: 'emp_2',
    editorName: 'Neha Gupta',
    completedByEmployeeId: 'emp_2',
    completedByName: 'Neha Gupta',
    completedAt: new Date().toISOString(),
    notes: 'High-risk pregnancy awareness series with animated infographics',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Super Admin'
  },
  {
    id: 'vid-demo-3',
    clientId: 'client_dr_sankalp_sharma',
    clientName: 'Dr. Sankalp Sharma',
    title: 'Arthroscopy & Joint Care Exercise Demonstrations',
    plannedQuantity: 5,
    shotQuantity: 0,
    finishedQuantity: 0,
    shootDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    status: 'pending_shoot',
    videographerId: 'emp_1',
    videographerName: 'Aman Sharma',
    editorId: 'emp_2',
    editorName: 'Neha Gupta',
    notes: 'Scheduled filming slot at Ortho clinic',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Super Admin'
  }
];

export const VideoTrackerView: React.FC = () => {
  const { profile, user } = useAuth();
  const [videos, setVideos] = useState<VideoProductionEntry[]>(DEFAULT_INITIAL_VIDEOS);
  const [clients, setClients] = useState<ClientData[]>(DEFAULT_CLIENTS_MASTER);
  const [employees, setEmployees] = useState<MasterEmployee[]>(() => getCachedEmployees());
  const [loading, setLoading] = useState(true);

  // Active view tab: 'board' (Primary Kanban) | 'calendar' | 'list' | 'my_assignments'
  const [activeView, setActiveView] = useState<'board' | 'calendar' | 'list' | 'my_assignments'>('board');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClient, setFilterClient] = useState('All');
  const [filterEditor, setFilterEditor] = useState('All');
  const [filterVideographer, setFilterVideographer] = useState('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [myAssignmentSubTab, setMyAssignmentSubTab] = useState<'all' | 'editing' | 'shoots'>('all');

  // Modal / Drawer States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeDetailEntry, setActiveDetailEntry] = useState<VideoProductionEntry | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Status Action Transition Modals
  const [confirmModal, setConfirmModal] = useState<{
    entry: VideoProductionEntry;
    actionType: 'mark_shot' | 'start_editing' | 'send_review' | 'mark_finished' | 'revert';
    targetStatus?: VideoStatus;
    customQuantity?: number;
    customEditorId?: string;
    customEditorName?: string;
  } | null>(null);

  // Contradiction detection count for Super Admin
  const [contradictionCount, setContradictionCount] = useState<number>(0);
  const [showDataRepairModal, setShowDataRepairModal] = useState(false);

  // Create Form States
  const [formClientId, setFormClientId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formQuantity, setFormQuantity] = useState<number>(3);
  const [formShootDate, setFormShootDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDueDate, setFormDueDate] = useState(new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]);
  const [formInitialStatus, setFormInitialStatus] = useState<'pending_shoot' | 'shot'>('pending_shoot');
  const [formVideographerId, setFormVideographerId] = useState('');
  const [formVideographerCustom, setFormVideographerCustom] = useState('');
  const [formEditorId, setFormEditorId] = useState('');
  const [formEditorCustom, setFormEditorCustom] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formFootageLink, setFormFootageLink] = useState('');

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Local cache helper
  const CACHE_KEY = 'digi_video_tracker_cache';
  const saveToLocalCache = (list: VideoProductionEntry[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(list));
    } catch (e) {
      // ignore
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // FIREBASE REAL-TIME SUBSCRIPTIONS
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Proactively initialize Firebase Auth session to prevent permission denial
    ensureActiveFirebaseAuth().catch(console.warn);

    // Initial load from local cache if available
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVideos(parsed);
        }
      }
    } catch (e) {
      // ignore
    }

    const unsubVideos = onSnapshot(query(collection(db, 'videoTracker')), (snapshot) => {
      const list: VideoProductionEntry[] = [];
      let contradictionsFound = 0;

      snapshot.forEach((d) => {
        const raw = d.data();
        // Check for contradictions in raw data
        if (
          (raw.status === 'Pending' || raw.status === 'pending_shoot') && (raw.shotQuantity > 0 || (raw.videoCount > 0 && !raw.plannedQuantity)) ||
          (raw.status !== 'Edited' && raw.status !== 'finished' && (raw.completedBy || raw.completedByEmployeeId))
        ) {
          contradictionsFound++;
        }

        list.push(normalizeVideoEntry(d.id, raw));
      });

      if (list.length > 0) {
        list.sort((a, b) => {
          if (b.shootDate !== a.shootDate) {
            return b.shootDate.localeCompare(a.shootDate);
          }
          return b.createdAt.localeCompare(a.createdAt);
        });
        setVideos(list);
        saveToLocalCache(list);
      } else {
        setVideos(DEFAULT_INITIAL_VIDEOS);
      }
      setContradictionCount(contradictionsFound);
      setLoading(false);
    }, (error) => {
      console.warn("videoTracker listener notice:", error);
      // Retain current or fallback to default
      setVideos(prev => prev.length > 0 ? prev : DEFAULT_INITIAL_VIDEOS);
      setLoading(false);
    });

    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      const clientList: ClientData[] = [];
      snapshot.forEach((d) => {
        clientList.push({ clientId: d.id, ...d.data() } as ClientData);
      });
      if (clientList.length > 0) {
        setClients(clientList);
      }
    });

    const unsubEmployees = subscribeToCanonicalEmployees((empList) => {
      if (empList.length > 0) {
        setEmployees(empList);
      }
    });

    return () => {
      unsubVideos();
      unsubClients();
      unsubEmployees();
    };
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // DERIVED DASHBOARD KPIS (Exact reconciliation with underlying records)
  // ──────────────────────────────────────────────────────────────────────────
  const kpiTotals = useMemo(() => {
    const totalShot = videos
      .filter(v => ['shot', 'editing', 'review', 'finished'].includes(v.status))
      .reduce((sum, v) => sum + (v.shotQuantity || 0), 0);

    const pendingToShoot = videos
      .filter(v => v.status === 'pending_shoot')
      .reduce((sum, v) => sum + (v.plannedQuantity || 0), 0);

    const remainingToEdit = videos
      .filter(v => v.status !== 'finished')
      .reduce((sum, v) => sum + Math.max((v.shotQuantity || 0) - (v.finishedQuantity || 0), 0), 0);

    const videosFinished = videos
      .filter(v => v.status === 'finished')
      .reduce((sum, v) => sum + (v.finishedQuantity || 0), 0);

    return {
      totalShot,
      pendingToShoot,
      remainingToEdit,
      videosFinished
    };
  }, [videos]);

  // Logged-in user employee profile match
  const currentUserEmployee = useMemo(() => {
    if (!profile) return null;
    return employees.find(e => 
      (e.employeeId && (e.employeeId === profile.userId || e.employeeId === profile.uid)) ||
      (e.email && profile.email && e.email.toLowerCase() === profile.email.toLowerCase()) ||
      (e.name && profile.name && e.name.toLowerCase() === profile.name.toLowerCase())
    ) || null;
  }, [profile, employees]);

  const currentEmpId = currentUserEmployee?.employeeId || currentUserEmployee?.id || profile?.userId || profile?.uid || '';
  const currentEmpName = currentUserEmployee?.name || profile?.name || 'Super Admin';

  // ──────────────────────────────────────────────────────────────────────────
  // FILTERING & VIEWS LOGIC
  // ──────────────────────────────────────────────────────────────────────────
  const filteredVideos = useMemo(() => {
    return videos.filter(v => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = v.title.toLowerCase().includes(q);
        const matchClient = v.clientName.toLowerCase().includes(q);
        const matchEditor = (v.editorName || '').toLowerCase().includes(q);
        const matchVideographer = (v.videographerName || '').toLowerCase().includes(q);
        const matchNotes = (v.notes || '').toLowerCase().includes(q);
        if (!matchTitle && !matchClient && !matchEditor && !matchVideographer && !matchNotes) return false;
      }

      // 2. Client Filter
      if (filterClient !== 'All' && v.clientId !== filterClient && v.clientName !== filterClient) {
        return false;
      }

      // 3. Status Filter
      if (filterStatus !== 'All' && v.status !== filterStatus) {
        return false;
      }

      // 4. Editor Filter
      if (filterEditor !== 'All') {
        if (v.editorId !== filterEditor && v.editorName !== filterEditor) return false;
      }

      // 5. Videographer Filter
      if (filterVideographer !== 'All') {
        if (v.videographerId !== filterVideographer && v.videographerName !== filterVideographer) return false;
      }

      // 6. My Assignments Filter
      if (activeView === 'my_assignments') {
        const isMyEditor = (v.editorId && v.editorId === currentEmpId) || (v.editorName && currentEmpName && v.editorName.toLowerCase() === currentEmpName.toLowerCase());
        const isMyShoot = (v.videographerId && v.videographerId === currentEmpId) || (v.videographerName && currentEmpName && v.videographerName.toLowerCase() === currentEmpName.toLowerCase());
        
        if (myAssignmentSubTab === 'editing') return isMyEditor;
        if (myAssignmentSubTab === 'shoots') return isMyShoot;
        return isMyEditor || isMyShoot;
      }

      return true;
    });
  }, [videos, searchQuery, filterClient, filterStatus, filterEditor, filterVideographer, activeView, myAssignmentSubTab, currentEmpId, currentEmpName]);

  // Grouped by Status for Kanban Board
  const kanbanColumns = useMemo(() => {
    const columns: Record<VideoStatus, VideoProductionEntry[]> = {
      pending_shoot: [],
      shot: [],
      editing: [],
      review: [],
      finished: []
    };

    filteredVideos.forEach(v => {
      if (columns[v.status]) {
        columns[v.status].push(v);
      } else {
        columns.pending_shoot.push(v);
      }
    });

    return columns;
  }, [filteredVideos]);

  // Grouped by Shoot Date for Calendar/Timeline View
  const groupedByDate = useMemo(() => {
    const groups: Record<string, VideoProductionEntry[]> = {};
    filteredVideos.forEach(v => {
      const d = v.shootDate || 'No Date';
      if (!groups[d]) groups[d] = [];
      groups[d].push(v);
    });
    return groups;
  }, [filteredVideos]);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CREATE VIDEO PRODUCTION ENTRY
  // ──────────────────────────────────────────────────────────────────────────
  const handleCreateVideoEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientId) {
      showToast("Please select a Client brand.", "error");
      return;
    }
    if (formQuantity < 1) {
      showToast("Video quantity must be at least 1.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      // 0. Ensure Firebase Auth session is active
      await ensureActiveFirebaseAuth().catch(console.warn);

      const clientObj = clients.find(c => c.clientId === formClientId);
      const targetClientName = clientObj?.clientName || 'General Client';

      const videographerEmp = employees.find(e => e.employeeId === formVideographerId || e.id === formVideographerId);
      const finalVideographerName = formVideographerId === 'other' ? formVideographerCustom.trim() : (videographerEmp?.name || '');

      const editorEmp = employees.find(e => e.employeeId === formEditorId || e.id === formEditorId);
      const finalEditorName = formEditorId === 'other' ? formEditorCustom.trim() : (editorEmp?.name || '');

      const docId = `vid_${Date.now()}`;
      const nowIso = new Date().toISOString();

      const plannedQuantity = formQuantity;
      const shotQuantity = formInitialStatus === 'shot' ? formQuantity : 0;
      const finishedQuantity = 0;

      const shootTaskId = `task_shoot_${docId}`;
      const editTaskId = `task_edit_${docId}`;

      // 1. Prepare record payload
      const payload: VideoProductionEntry = {
        id: docId,
        clientId: formClientId,
        clientName: targetClientName,
        title: formTitle.trim() || `${formQuantity} Video Deliverable(s)`,
        plannedQuantity,
        shotQuantity,
        finishedQuantity,
        shootDate: formShootDate,
        dueDate: formDueDate,
        status: formInitialStatus,
        videographerId: formVideographerId !== 'other' ? formVideographerId : '',
        videographerName: finalVideographerName,
        editorId: formEditorId !== 'other' ? formEditorId : '',
        editorName: finalEditorName,
        shotAt: formInitialStatus === 'shot' ? nowIso : '',
        notes: formNotes.trim(),
        footageLink: formFootageLink.trim(),
        taskId: editTaskId,
        shootTaskId,
        editTaskId,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: profile?.name || 'Super Admin',
        createdByUid: profile?.userId || profile?.uid || 'admin',
        auditHistory: [
          {
            actorId: currentEmpId,
            actorName: currentEmpName,
            timestamp: nowIso,
            action: 'Created Video Production Entry',
            details: `Initial status: ${formInitialStatus}. Quantity: ${formQuantity}`
          }
        ]
      };

      // 2. Optimistic local cache update immediately
      setVideos(prev => {
        const next = [payload, ...prev.filter(v => v.id !== docId)];
        saveToLocalCache(next);
        return next;
      });

      // 3. Persist to Firestore with auto-auth retry
      try {
        await setDoc(doc(db, 'videoTracker', docId), payload);
      } catch (writeErr: any) {
        console.warn("Retrying video entry persist with fresh auth credentials:", writeErr);
        await ensureActiveFirebaseAuth();
        await setDoc(doc(db, 'videoTracker', docId), payload);
      }

      // 4. Synchronize linked operational tasks (Shoot + Edit) and auto-sync work log if already shot
      try {
        await syncVideoProductionToTasks(payload, { userProfile: profile, uid: user?.uid });
      } catch (bridgeErr) {
        console.warn("Video production tasks bridge notice:", bridgeErr);
      }

      showToast(`Created video production entry for ${targetClientName}!`, "success");
      setIsCreateModalOpen(false);

      // Reset form
      setFormTitle('');
      setFormQuantity(3);
      setFormNotes('');
      setFormFootageLink('');
      setFormVideographerId('');
      setFormVideographerCustom('');
      setFormEditorId('');
      setFormEditorCustom('');

    } catch (err: any) {
      console.error("Error creating video entry:", err);
      // Since local cache is saved, let the user know and keep modal closed
      showToast("Saved locally and scheduled for cloud sync.", "info");
      setIsCreateModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 2. WORKFLOW STATUS TRANSITIONS
  // ──────────────────────────────────────────────────────────────────────────
  const executeStatusTransition = async (
    entry: VideoProductionEntry, 
    newStatus: VideoStatus, 
    extraPayload: Partial<VideoProductionEntry> = {}
  ) => {
    setIsSubmitting(true);
    const nowIso = new Date().toISOString();
    const docRef = doc(db, 'videoTracker', entry.id);

    try {
      await ensureActiveFirebaseAuth().catch(console.warn);

      const updates: any = {
        status: newStatus,
        updatedAt: nowIso,
        ...extraPayload
      };

      // Status specific timestamps and audit notes
      if (newStatus === 'shot') {
        updates.shotAt = nowIso;
        updates.shotQuantity = extraPayload.shotQuantity ?? (entry.shotQuantity > 0 ? entry.shotQuantity : entry.plannedQuantity);
      } else if (newStatus === 'editing') {
        updates.editingStartedAt = nowIso;
      } else if (newStatus === 'review') {
        updates.reviewedAt = nowIso;
      } else if (newStatus === 'finished') {
        updates.completedAt = nowIso;
        updates.finishedQuantity = extraPayload.finishedQuantity ?? (entry.shotQuantity > 0 ? entry.shotQuantity : entry.plannedQuantity);
        updates.completedByEmployeeId = extraPayload.completedByEmployeeId || currentEmpId;
        updates.completedByName = extraPayload.completedByName || currentEmpName;
      }

      // Append audit history
      const currentHistory = entry.auditHistory || [];
      updates.auditHistory = [
        ...currentHistory,
        {
          actorId: currentEmpId,
          actorName: currentEmpName,
          timestamp: nowIso,
          action: `Transitioned status to ${STATUS_CONFIG[newStatus].label}`,
          details: `Updated quantities: Planned=${updates.plannedQuantity ?? entry.plannedQuantity}, Shot=${updates.shotQuantity ?? entry.shotQuantity}, Finished=${updates.finishedQuantity ?? entry.finishedQuantity}`
        }
      ];

      // Optimistic update & cache
      setVideos(prev => {
        const next = prev.map(v => v.id === entry.id ? { ...v, ...updates } : v);
        saveToLocalCache(next);
        return next;
      });

      // Persist to Firebase with retry
      try {
        await updateDoc(docRef, updates);
      } catch (upErr: any) {
        console.warn("Retrying transition update with fresh auth:", upErr);
        await ensureActiveFirebaseAuth();
        await updateDoc(docRef, updates);
      }

      // Sync linked operational tasks and work logs via productionBridge
      try {
        await syncVideoStatusToTasks(
          { ...entry, ...updates },
          newStatus,
          extraPayload,
          profile
        );
      } catch (syncErr) {
        console.warn("Status bridge to tasks notice:", syncErr);
      }

      showToast(`Updated "${entry.clientName}" to ${STATUS_CONFIG[newStatus].label}!`, "success");
      setConfirmModal(null);
      if (activeDetailEntry?.id === entry.id) {
        setActiveDetailEntry(prev => prev ? { ...prev, ...updates } : null);
      }

    } catch (err: any) {
      console.error("Error transitioning video status:", err);
      showToast("Updated locally. Syncing with server.", "info");
      setConfirmModal(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 3. SUPER ADMIN BATCH DATA REPAIR
  // ──────────────────────────────────────────────────────────────────────────
  const handleBatchRepairData = async () => {
    setIsSubmitting(true);
    try {
      await ensureActiveFirebaseAuth().catch(console.warn);
      let repairCount = 0;
      const repairedList: VideoProductionEntry[] = [];

      for (const v of videos) {
        const docRef = doc(db, 'videoTracker', v.id);
        const normalized = normalizeVideoEntry(v.id, v);
        repairedList.push(normalized);

        try {
          await updateDoc(docRef, {
            plannedQuantity: normalized.plannedQuantity,
            shotQuantity: normalized.shotQuantity,
            finishedQuantity: normalized.finishedQuantity,
            status: normalized.status,
            completedByEmployeeId: normalized.completedByEmployeeId,
            completedByName: normalized.completedByName,
            completedAt: normalized.completedAt,
            updatedAt: new Date().toISOString()
          });
        } catch (rErr) {
          console.warn("Repair record write notice:", rErr);
        }
        repairCount++;
      }

      setVideos(repairedList);
      saveToLocalCache(repairedList);

      showToast(`Successfully normalized and repaired ${repairCount} records!`, "success");
      setShowDataRepairModal(false);
      setContradictionCount(0);
    } catch (err: any) {
      console.error("Error repairing data:", err);
      showToast("Data repair notice: " + (err?.message || "Unknown error"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 4. DELETE PRODUCTION ENTRY
  // ──────────────────────────────────────────────────────────────────────────
  const handleDeleteVideo = async (id: string) => {
    try {
      await ensureActiveFirebaseAuth().catch(console.warn);
      setVideos(prev => {
        const next = prev.filter(v => v.id !== id);
        saveToLocalCache(next);
        return next;
      });
      setDeletingId(null);
      if (activeDetailEntry?.id === id) setActiveDetailEntry(null);

      try {
        await deleteDoc(doc(db, 'videoTracker', id));
      } catch (delErr) {
        console.warn("Delete cloud doc notice:", delErr);
      }
      showToast("Video production record deleted.", "info");
    } catch (err: any) {
      console.error("Error deleting video:", err);
      showToast("Deleted from view.", "info");
    }
  };

  return (
    <div className="space-y-6 pb-16 animate-fade-in text-slate-900 dark:text-slate-100">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-black transition-all animate-slide-up ${
          toastMessage.type === 'error'
            ? 'bg-rose-600 text-white'
            : toastMessage.type === 'info'
            ? 'bg-slate-900 text-white'
            : 'bg-emerald-600 text-white'
        }`}>
          {toastMessage.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header & Main Control Row */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-2xl shadow-sm">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Video Production Hub</h1>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-lg border border-purple-200 dark:border-purple-900/40">
                End-to-End Delivery
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Synchronized production workflow: shoot scheduling, filming logs, editing pipeline, client reviews, and finished video delivery.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {contradictionCount > 0 && (
            <button
              onClick={() => setShowDataRepairModal(true)}
              className="py-2 px-3.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs"
            >
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span>Fix Contradictory Data ({contradictionCount})</span>
            </button>
          )}

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="py-2.5 px-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Create Video Production Entry</span>
          </button>
        </div>
      </div>

      {/* Reconciled Compact KPI Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Total Videos Shot */}
        <div className="p-4.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">Total Videos Shot</span>
            <div className="p-1.5 bg-sky-50 dark:bg-sky-950/40 rounded-lg text-sky-600">
              <Film className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {kpiTotals.totalShot}
          </div>
          <p className="text-[11px] font-medium text-slate-400">Filmed across all active accounts</p>
        </div>

        {/* KPI 2: Pending to Shoot */}
        <div className="p-4.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending to Shoot</span>
            <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {kpiTotals.pendingToShoot}
          </div>
          <p className="text-[11px] font-medium text-slate-400">Upcoming planned filming slots</p>
        </div>

        {/* KPI 3: Remaining to Edit */}
        <div className="p-4.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Remaining to Edit</span>
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-indigo-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {kpiTotals.remainingToEdit}
          </div>
          <p className="text-[11px] font-medium text-slate-400">Shot, currently in editor queue</p>
        </div>

        {/* KPI 4: Videos Finished */}
        <div className="p-4.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Videos Finished</span>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {kpiTotals.videosFinished}
          </div>
          <p className="text-[11px] font-medium text-slate-400">Completed & ready for release</p>
        </div>
      </div>

      {/* Navigation Tabs & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
          
          {/* View Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-black">
            <button
              onClick={() => setActiveView('board')}
              className={`py-1.5 px-3.5 rounded-xl transition-all ${
                activeView === 'board'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 inline mr-1.5" /> Production Board (Kanban)
            </button>
            <button
              onClick={() => setActiveView('calendar')}
              className={`py-1.5 px-3.5 rounded-xl transition-all ${
                activeView === 'calendar'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 inline mr-1.5" /> Shoot Timeline
            </button>
            <button
              onClick={() => setActiveView('list')}
              className={`py-1.5 px-3.5 rounded-xl transition-all ${
                activeView === 'list'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 inline mr-1.5" /> List View
            </button>
            <button
              onClick={() => setActiveView('my_assignments')}
              className={`py-1.5 px-3.5 rounded-xl transition-all ${
                activeView === 'my_assignments'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 inline mr-1.5" /> My Assignments
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full lg:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topic, client, editor..."
              className="w-full pl-8.5 pr-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Secondary Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-bold">
          {/* Client Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Filter Client</label>
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
            >
              <option value="All">All Clients ({clients.length})</option>
              {clients.map(c => (
                <option key={c.clientId} value={c.clientId}>{c.clientName}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Production Stage</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
            >
              <option value="All">All Stages</option>
              <option value="pending_shoot">Pending Shoot</option>
              <option value="shot">Shot · Awaiting Edit</option>
              <option value="editing">Editing in Progress</option>
              <option value="review">In Review & Approval</option>
              <option value="finished">Finished</option>
            </select>
          </div>

          {/* Editor Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Assigned Editor</label>
            <select
              value={filterEditor}
              onChange={(e) => setFilterEditor(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
            >
              <option value="All">All Editors</option>
              {employees.map(emp => (
                <option key={emp.employeeId || emp.id} value={emp.employeeId || emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          {/* Videographer Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Videographer</label>
            <select
              value={filterVideographer}
              onChange={(e) => setFilterVideographer(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
            >
              <option value="All">All Videographers</option>
              {employees.map(emp => (
                <option key={emp.employeeId || emp.id} value={emp.employeeId || emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* My Assignments Sub-tabs (when My Assignments active) */}
        {activeView === 'my_assignments' && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs font-bold">
            <span className="text-slate-400">Showing work for: <strong className="text-slate-800 dark:text-slate-200">{currentEmpName}</strong></span>
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setMyAssignmentSubTab('all')}
                className={`py-1 px-3 rounded-lg text-[11px] ${myAssignmentSubTab === 'all' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 font-black' : 'text-slate-500'}`}
              >
                All Assigned
              </button>
              <button
                onClick={() => setMyAssignmentSubTab('editing')}
                className={`py-1 px-3 rounded-lg text-[11px] ${myAssignmentSubTab === 'editing' ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 font-black' : 'text-slate-500'}`}
              >
                My Editing Tasks
              </button>
              <button
                onClick={() => setMyAssignmentSubTab('shoots')}
                className={`py-1 px-3 rounded-lg text-[11px] ${myAssignmentSubTab === 'shoots' ? 'bg-sky-50 dark:bg-sky-950 text-sky-600 font-black' : 'text-slate-500'}`}
              >
                My Scheduled Shoots
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* VIEW 1: PRODUCTION BOARD (PRIMARY KANBAN)                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeView === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 items-start">
          {(Object.keys(STATUS_CONFIG) as VideoStatus[]).map((colKey) => {
            const conf = STATUS_CONFIG[colKey];
            const colEntries = kanbanColumns[colKey] || [];
            const colItemCount = colEntries.reduce((acc, curr) => {
              if (colKey === 'pending_shoot') return acc + (curr.plannedQuantity || 1);
              if (colKey === 'finished') return acc + (curr.finishedQuantity || curr.shotQuantity || 1);
              return acc + (curr.shotQuantity || 1);
            }, 0);

            return (
              <div 
                key={colKey}
                className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-3.5 space-y-3 flex flex-col min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${conf.dotColor}`}></span>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      {conf.shortLabel}
                    </h3>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {colEntries.length} cards · {colItemCount} vids
                  </span>
                </div>

                {/* Card List */}
                <div className="space-y-3 flex-grow overflow-y-auto custom-scrollbar">
                  {colEntries.length === 0 ? (
                    <div className="py-12 text-center text-[11px] font-bold text-slate-400 bg-white/40 dark:bg-slate-950/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      No videos in {conf.shortLabel}
                    </div>
                  ) : (
                    colEntries.map((video) => (
                      <ProductionCard
                        key={video.id}
                        entry={video}
                        onInspect={() => setActiveDetailEntry(video)}
                        onAdvanceStatus={() => {
                          if (conf.nextStatus) {
                            setConfirmModal({
                              entry: video,
                              actionType: conf.nextStatus === 'shot' ? 'mark_shot' : conf.nextStatus === 'editing' ? 'start_editing' : conf.nextStatus === 'review' ? 'send_review' : 'mark_finished',
                              targetStatus: conf.nextStatus,
                              customQuantity: video.plannedQuantity || video.shotQuantity
                            });
                          }
                        }}
                        onRevertStatus={() => {
                          const prevStatus: VideoStatus = video.status === 'finished' ? 'review' : video.status === 'review' ? 'editing' : 'shot';
                          setConfirmModal({
                            entry: video,
                            actionType: 'revert',
                            targetStatus: prevStatus
                          });
                        }}
                        onDelete={() => setDeletingId(video.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* VIEW 2: SHOOT TIMELINE (CALENDAR VIEW)                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {(activeView === 'calendar' || activeView === 'my_assignments') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span>Production Schedule & Shoot Date Groupings</span>
            </h2>
            <span className="text-[11px] font-bold text-slate-400">
              {filteredVideos.length} Video Production Records
            </span>
          </div>

          {Object.keys(groupedByDate).length === 0 ? (
            <div className="text-center py-16">
              <Film className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">No matching production records found.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.keys(groupedByDate).map(dateStr => (
                <div key={dateStr} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">
                      {dateStr === 'No Date' ? 'Unscheduled Shoots' : new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                      {groupedByDate[dateStr].length} {groupedByDate[dateStr].length === 1 ? 'Job' : 'Jobs'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pl-3 border-l-2 border-purple-100 dark:border-purple-950">
                    {groupedByDate[dateStr].map(video => (
                      <ProductionCard
                        key={video.id}
                        entry={video}
                        onInspect={() => setActiveDetailEntry(video)}
                        onAdvanceStatus={() => {
                          const conf = STATUS_CONFIG[video.status];
                          if (conf.nextStatus) {
                            setConfirmModal({
                              entry: video,
                              actionType: conf.nextStatus === 'shot' ? 'mark_shot' : conf.nextStatus === 'editing' ? 'start_editing' : conf.nextStatus === 'review' ? 'send_review' : 'mark_finished',
                              targetStatus: conf.nextStatus,
                              customQuantity: video.plannedQuantity || video.shotQuantity
                            });
                          }
                        }}
                        onRevertStatus={() => {
                          const prevStatus: VideoStatus = video.status === 'finished' ? 'review' : video.status === 'review' ? 'editing' : 'shot';
                          setConfirmModal({
                            entry: video,
                            actionType: 'revert',
                            targetStatus: prevStatus
                          });
                        }}
                        onDelete={() => setDeletingId(video.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* VIEW 3: LIST VIEW                                                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeView === 'list' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium">
              <thead className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="p-4">Client Brand</th>
                  <th className="p-4">Deliverable Topic</th>
                  <th className="p-4">Quantities</th>
                  <th className="p-4">Shoot Date</th>
                  <th className="p-4">Stage</th>
                  <th className="p-4">Videographer</th>
                  <th className="p-4">Editor</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredVideos.map(video => {
                  const conf = STATUS_CONFIG[video.status];
                  return (
                    <tr key={video.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/40 transition-colors">
                      <td className="p-4 font-black text-slate-900 dark:text-white">
                        {video.clientName}
                      </td>
                      <td className="p-4 font-bold text-slate-800 dark:text-slate-200 max-w-xs truncate">
                        {video.title}
                      </td>
                      <td className="p-4 font-bold">
                        {video.status === 'pending_shoot' && (
                          <span className="text-amber-600">{video.plannedQuantity} Planned</span>
                        )}
                        {video.status !== 'pending_shoot' && video.status !== 'finished' && (
                          <span className="text-sky-600">{video.shotQuantity} Shot</span>
                        )}
                        {video.status === 'finished' && (
                          <span className="text-emerald-600">{video.finishedQuantity} Finished</span>
                        )}
                      </td>
                      <td className="p-4 font-bold text-slate-600 dark:text-slate-400">
                        {video.shootDate}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black ${conf.badgeBg} ${conf.badgeText} border ${conf.borderColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${conf.dotColor}`}></span>
                          {conf.label}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">
                        {video.videographerName || 'Unassigned'}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">
                        {video.editorName || 'Unassigned'}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {conf.nextAction && (
                            <button
                              onClick={() => {
                                if (conf.nextStatus) {
                                  setConfirmModal({
                                    entry: video,
                                    actionType: conf.nextStatus === 'shot' ? 'mark_shot' : conf.nextStatus === 'editing' ? 'start_editing' : conf.nextStatus === 'review' ? 'send_review' : 'mark_finished',
                                    targetStatus: conf.nextStatus,
                                    customQuantity: video.plannedQuantity || video.shotQuantity
                                  });
                                }
                              }}
                              className="py-1 px-2.5 bg-slate-100 hover:bg-purple-50 dark:bg-slate-800 dark:hover:bg-purple-950/40 text-slate-700 dark:text-slate-300 hover:text-purple-600 rounded-lg text-[11px] font-bold transition-all"
                            >
                              {conf.nextAction}
                            </button>
                          )}
                          <button
                            onClick={() => setActiveDetailEntry(video)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            title="Inspect Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: CREATE VIDEO PRODUCTION ENTRY                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-scale-up">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-xl">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Create Video Production Entry</h3>
                  <p className="text-xs text-slate-400 font-medium">Log upcoming shoots or recorded footage into the agency production pipeline.</p>
                </div>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateVideoEntry} className="space-y-4">
              {/* Client Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Client Account *</label>
                <ClientSelect
                  clients={clients}
                  selectedClientId={formClientId}
                  onSelectClient={(id) => setFormClientId(id)}
                  placeholder="Select Client..."
                />
              </div>

              {/* Title / Reel Topic */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Video Topic / Deliverable Title *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Spine Surgery Recovery Tips (4 Reels)"
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl outline-none"
                  required
                />
              </div>

              {/* Initial Status & Dynamic Quantity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Production Stage *</label>
                  <select
                    value={formInitialStatus}
                    onChange={(e) => setFormInitialStatus(e.target.value as any)}
                    className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl outline-none"
                  >
                    <option value="pending_shoot">Pending Shoot (Planned)</option>
                    <option value="shot">Shot · Awaiting Edit (Recorded)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {formInitialStatus === 'pending_shoot' ? 'Planned Videos *' : 'Videos Actually Shot *'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(parseInt(e.target.value) || 1)}
                    className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl outline-none"
                    required
                  />
                </div>
              </div>

              {/* Shoot Date & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Shoot / Filming Date *</label>
                  <input
                    type="date"
                    value={formShootDate}
                    onChange={(e) => setFormShootDate(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Target Editing Due Date</label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl outline-none"
                  />
                </div>
              </div>

              {/* Videographer Crew */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Videographer (Crew Lead)</label>
                <select
                  value={formVideographerId}
                  onChange={(e) => setFormVideographerId(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl outline-none"
                >
                  <option value="">-- Select Videographer --</option>
                  {employees.map(emp => (
                    <option key={emp.employeeId || emp.id} value={emp.employeeId || emp.id}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                  <option value="other">+ Other (Type Custom Name)</option>
                </select>
                {formVideographerId === 'other' && (
                  <input
                    type="text"
                    value={formVideographerCustom}
                    onChange={(e) => setFormVideographerCustom(e.target.value)}
                    placeholder="Enter videographer name..."
                    className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl outline-none mt-1"
                  />
                )}
              </div>

              {/* Editor Assignment */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Assigned Video Editor</label>
                <select
                  value={formEditorId}
                  onChange={(e) => setFormEditorId(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl outline-none"
                >
                  <option value="">-- Select Video Editor --</option>
                  {employees.map(emp => (
                    <option key={emp.employeeId || emp.id} value={emp.employeeId || emp.id}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                  <option value="other">+ Other (Type Custom Name)</option>
                </select>
                {formEditorId === 'other' && (
                  <input
                    type="text"
                    value={formEditorCustom}
                    onChange={(e) => setFormEditorCustom(e.target.value)}
                    placeholder="Enter editor name..."
                    className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl outline-none mt-1"
                  />
                )}
              </div>

              {/* Notes & Footage Link */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Raw Footage Link / Drive Folder</label>
                <input
                  type="url"
                  value={formFootageLink}
                  onChange={(e) => setFormFootageLink(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Production Notes & Script References</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Hook directions, patient consent status, background music style..."
                  className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2.5 px-6 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Save Video Production Entry</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: WORKFLOW TRANSITION CONFIRMATION MODAL                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {confirmModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up">
            
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-xl">
                <FolderSync className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {confirmModal.actionType === 'mark_shot' && 'Confirm Videos Shot'}
                  {confirmModal.actionType === 'start_editing' && 'Start Video Editing'}
                  {confirmModal.actionType === 'send_review' && 'Send to Review & Approval'}
                  {confirmModal.actionType === 'mark_finished' && 'Mark Production Finished'}
                  {confirmModal.actionType === 'revert' && 'Revert Production Stage'}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  {confirmModal.entry.clientName} · {confirmModal.entry.title}
                </p>
              </div>
            </div>

            {/* Form Fields for Mark as Shot */}
            {confirmModal.actionType === 'mark_shot' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Actual Number of Videos Shot *</label>
                  <input
                    type="number"
                    min={1}
                    value={confirmModal.customQuantity || confirmModal.entry.plannedQuantity}
                    onChange={(e) => setConfirmModal({ ...confirmModal, customQuantity: parseInt(e.target.value) || 1 })}
                    className="w-full text-xs font-black bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl outline-none"
                  />
                  <p className="text-[10px] text-slate-400 font-medium">Planned volume: {confirmModal.entry.plannedQuantity} videos.</p>
                </div>
              </div>
            )}

            {/* Form Fields for Start Editing */}
            {confirmModal.actionType === 'start_editing' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Assigned Editor</label>
                  <select
                    value={confirmModal.customEditorId || confirmModal.entry.editorId || ''}
                    onChange={(e) => {
                      const emp = employees.find(em => em.employeeId === e.target.value || em.id === e.target.value);
                      setConfirmModal({
                        ...confirmModal,
                        customEditorId: e.target.value,
                        customEditorName: emp ? emp.name : ''
                      });
                    }}
                    className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl outline-none"
                  >
                    <option value="">-- Select Editor --</option>
                    {employees.map(emp => (
                      <option key={emp.employeeId || emp.id} value={emp.employeeId || emp.id}>
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Form Fields for Mark Finished */}
            {confirmModal.actionType === 'mark_finished' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Finished Videos Count *</label>
                  <input
                    type="number"
                    min={1}
                    value={confirmModal.customQuantity || confirmModal.entry.shotQuantity}
                    onChange={(e) => setConfirmModal({ ...confirmModal, customQuantity: parseInt(e.target.value) || 1 })}
                    className="w-full text-xs font-black bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl outline-none"
                  />
                  <p className="text-[10px] text-slate-400 font-medium">Recorded shot count: {confirmModal.entry.shotQuantity} videos.</p>
                </div>
              </div>
            )}

            {/* Revert confirmation */}
            {confirmModal.actionType === 'revert' && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900 text-xs font-medium text-amber-800 dark:text-amber-200">
                Are you sure you want to move this production record back to <strong>{STATUS_CONFIG[confirmModal.targetStatus || 'editing'].label}</strong>?
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  if (confirmModal.targetStatus) {
                    const extra: Partial<VideoProductionEntry> = {};
                    if (confirmModal.actionType === 'mark_shot') {
                      extra.shotQuantity = confirmModal.customQuantity || confirmModal.entry.plannedQuantity;
                    }
                    if (confirmModal.actionType === 'start_editing' && confirmModal.customEditorId) {
                      extra.editorId = confirmModal.customEditorId;
                      extra.editorName = confirmModal.customEditorName || confirmModal.entry.editorName;
                    }
                    if (confirmModal.actionType === 'mark_finished') {
                      extra.finishedQuantity = confirmModal.customQuantity || confirmModal.entry.shotQuantity;
                      extra.completedByEmployeeId = currentEmpId;
                      extra.completedByName = currentEmpName;
                    }

                    executeStatusTransition(confirmModal.entry, confirmModal.targetStatus, extra);
                  }
                }}
                className="py-2 px-5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center gap-1.5"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Confirm & Update</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: SUPER ADMIN CONTRADICTION REPAIR PREVIEW                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showDataRepairModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-scale-up">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 dark:bg-amber-950 text-amber-600 rounded-xl">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Audit & Repair Historical Contradictions</h3>
                  <p className="text-xs text-slate-400 font-medium">Safely normalize legacy videoTracker records to enforce planned vs. shot quantity separation.</p>
                </div>
              </div>
              <button onClick={() => setShowDataRepairModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <p>The system will apply the following non-destructive rules to all historical records:</p>
              <ul className="list-disc pl-5 space-y-1 text-[11px] font-bold text-slate-500">
                <li>Records in <code>pending_shoot</code> will have <code>shot_quantity = 0</code> and retain <code>planned_quantity</code>.</li>
                <li>Incomplete records will not display <code>Completed By</code> badges until marked <code>finished</code>.</li>
                <li>All legacy status values (<code>Pending</code>, <code>Shot</code>, <code>Edited</code>) will be normalized into canonical pipeline states.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDataRepairModal(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleBatchRepairData}
                className="py-2.5 px-6 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderSync className="w-3.5 h-3.5" />}
                <span>Execute Batch Normalization</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* DRAWER: PRODUCTION ENTRY DETAIL INSPECTION                          */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeDetailEntry && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-end p-4">
          <div className="bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 h-full max-w-md w-full p-6 shadow-2xl space-y-5 flex flex-col justify-between animate-slide-left overflow-y-auto">
            
            <div className="space-y-4">
              <div className="flex justify-between items-start pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">
                    Production Record Details
                  </span>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                    {activeDetailEntry.clientName}
                  </h3>
                </div>
                <button onClick={() => setActiveDetailEntry(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-500">Current Pipeline Stage</span>
                <span className={`px-2.5 py-1 rounded-xl text-xs font-black ${STATUS_CONFIG[activeDetailEntry.status].badgeBg} ${STATUS_CONFIG[activeDetailEntry.status].badgeText} border ${STATUS_CONFIG[activeDetailEntry.status].borderColor}`}>
                  {STATUS_CONFIG[activeDetailEntry.status].label}
                </span>
              </div>

              {/* Information Grid */}
              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">Topic / Title</span>
                  <p className="font-bold text-slate-900 dark:text-white">{activeDetailEntry.title}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">Shoot Date</span>
                    <p className="font-bold text-slate-700 dark:text-slate-300">{activeDetailEntry.shootDate}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">Target Due Date</span>
                    <p className="font-bold text-slate-700 dark:text-slate-300">{activeDetailEntry.dueDate || 'Not set'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">Videographer</span>
                    <p className="font-bold text-slate-700 dark:text-slate-300">{activeDetailEntry.videographerName || 'Unassigned'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">Assigned Editor</span>
                    <p className="font-bold text-slate-700 dark:text-slate-300">{activeDetailEntry.editorName || 'Unassigned'}</p>
                  </div>
                </div>

                {activeDetailEntry.status === 'finished' && activeDetailEntry.completedByName && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 space-y-1">
                    <span className="text-[10px] font-black uppercase">Completed By</span>
                    <p className="font-black text-xs">{activeDetailEntry.completedByName}</p>
                    {activeDetailEntry.completedAt && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Finished on {new Date(activeDetailEntry.completedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {activeDetailEntry.footageLink && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">Raw Footage Link</span>
                    <a 
                      href={activeDetailEntry.footageLink} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Footage Folder</span>
                    </a>
                  </div>
                )}

                {activeDetailEntry.notes && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">Production Notes</span>
                    <p className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-medium leading-relaxed">
                      {activeDetailEntry.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Audit History Log */}
              {activeDetailEntry.auditHistory && activeDetailEntry.auditHistory.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Production History & Audit Trail
                  </span>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                    {activeDetailEntry.auditHistory.map((log, idx) => (
                      <div key={idx} className="text-[10px] p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                          <span>{log.action}</span>
                          <span className="text-slate-400">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="text-slate-400 mt-0.5">by {log.actorName}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Action */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                onClick={() => setDeletingId(activeDetailEntry.id)}
                className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Entry</span>
              </button>

              <button
                onClick={() => setActiveDetailEntry(null)}
                className="py-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation In-App Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-2.5 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-black">Delete Production Entry?</h3>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              This will remove the record from the video tracker. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteVideo(deletingId)}
                className="py-2 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-xs"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// PRODUCTION CARD COMPONENT
// ────────────────────────────────────────────────────────────────────────────
interface ProductionCardProps {
  entry: VideoProductionEntry;
  onInspect: () => void;
  onAdvanceStatus: () => void;
  onRevertStatus: () => void;
  onDelete: () => void;
}

const ProductionCard: React.FC<ProductionCardProps> = ({
  entry,
  onInspect,
  onAdvanceStatus,
  onRevertStatus,
  onDelete
}) => {
  const conf = STATUS_CONFIG[entry.status];

  return (
    <div className="p-3.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-2.5 hover:border-purple-300 dark:hover:border-purple-800 transition-all group">
      
      {/* Client Name & Menu */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">
            {entry.clientName}
          </span>
          <h4 className="text-xs font-black text-slate-900 dark:text-white line-clamp-2 mt-0.5 leading-snug">
            {entry.title}
          </h4>
        </div>

        <button
          onClick={onInspect}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          title="Inspect details"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quantities & Shoot Date Badges */}
      <div className="flex items-center flex-wrap gap-1.5 text-[10px] font-bold">
        {/* Quantity Badge */}
        {entry.status === 'pending_shoot' && (
          <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 font-black">
            {entry.plannedQuantity} Planned
          </span>
        )}
        {entry.status !== 'pending_shoot' && entry.status !== 'finished' && (
          <span className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-900/60 font-black">
            {entry.shotQuantity} Shot
          </span>
        )}
        {entry.status === 'finished' && (
          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 font-black">
            {entry.finishedQuantity} Finished
          </span>
        )}

        {/* Shoot Date */}
        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
          <Calendar className="w-2.5 h-2.5 inline mr-1 text-slate-400" />
          {entry.shootDate}
        </span>
      </div>

      {/* Crew Assignments (Videographer & Editor) */}
      <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-850 text-[10px]">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="font-medium">Crew / Filmed:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
            {entry.videographerName || 'Unassigned'}
          </span>
        </div>
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="font-medium">Editor:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
            {entry.editorName || 'Unassigned'}
          </span>
        </div>
      </div>

      {/* Completed by badge (ONLY if status is finished) */}
      {entry.status === 'finished' && entry.completedByName && (
        <div className="flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 pt-0.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          <span>Completed by {entry.completedByName}</span>
        </div>
      )}

      {/* Card Footer Actions */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between gap-1.5">
        {entry.status !== 'pending_shoot' && (
          <button
            onClick={onRevertStatus}
            className="p-1 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Revert to previous stage"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        {conf.nextAction && (
          <button
            onClick={onAdvanceStatus}
            className="py-1 px-3 w-full bg-slate-100 hover:bg-purple-600 hover:text-white dark:bg-slate-900 dark:hover:bg-purple-600 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 shadow-2xs"
          >
            <span>{conf.nextAction}</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}

        {entry.status === 'finished' && (
          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 w-full text-center">
            Ready to Post
          </span>
        )}
      </div>
    </div>
  );
};
