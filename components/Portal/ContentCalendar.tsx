import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where,
  getDocs,
  addDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, sanitizeFirestorePayload } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  Calendar as CalendarIcon, 
  List, 
  Filter, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Copy, 
  Check, 
  Clock, 
  Eye, 
  Trash2, 
  Instagram, 
  Facebook, 
  Youtube, 
  MessageSquare, 
  Layers, 
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Award,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Film,
  CheckSquare,
  Video,
  User,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Edit2,
  Tag,
  ExternalLink,
  CalendarDays,
  LayoutGrid
} from 'lucide-react';
import { type ClientData } from './ClientList';
import { ensureCentralClientsSeeded, DEFAULT_CLIENTS_MASTER } from '../../lib/clientMaster';
import { 
  getCachedEmployees, 
  subscribeToCanonicalEmployees, 
  type MasterEmployee,
  CENTRAL_EMPLOYEES_MASTER_LIST
} from '../../lib/employeeMaster';
import { CalendarModal } from './CalendarModal';

import { 
  type CalendarEntry, 
  DEFAULT_CALENDAR_SEEDS, 
  getCachedCalendarEntries, 
  setCachedCalendarEntries, 
  persistDeleteCalendarEntry,
  ensureActiveFirebaseAuth
} from '../../lib/calendarStorage';

import {
  type Task,
  subscribeToCanonicalTasks,
  getCachedTasks,
  persistUpdateTask,
  persistNewTask,
  getTaskAgeingInfo,
  normalizeTaskStatus,
  transitionTaskStatus
} from '../../lib/taskStorage';

export { type CalendarEntry };

// ─── UNIFIED CALENDAR EVENT MODEL ─────────────────────────────────────
export interface UnifiedCalendarEvent {
  eventKey: string;             // Unique deterministic ID: "task_abc123", "content_xyz", "video_shoot_123", "video_edit_123"
  source: 'task' | 'content' | 'video_shoot' | 'video_edit';
  sourceLabel: 'TASK' | 'CONTENT' | 'VIDEO SHOOT' | 'VIDEO EDIT';
  entityId: string;
  title: string;                // Clean resolved human-readable title (NEVER database document ID)
  description?: string;
  clientName: string;
  clientId?: string;
  date: string;                 // Operational date (YYYY-MM-DD)
  dueDate?: string;             // Deadline (YYYY-MM-DD)
  scheduledDate?: string;       // Scheduled date (YYYY-MM-DD)
  status: string;               // Normalized display status
  assigneeName?: string;
  assigneeId?: string;
  platform?: string;
  contentType?: string;
  category?: string;
  priority?: 'Urgent' | 'High' | 'Medium' | 'Low';
  quantity?: number;
  isOverdue: boolean;
  isCompleted: boolean;
  rawTask?: Task;
  rawContent?: CalendarEntry;
  rawVideo?: any;
}

// ─── DATE NORMALIZATION HELPER ────────────────────────────────────────
function normalizeDateToYMD(input: any): string {
  if (!input) return new Date().toISOString().split('T')[0];
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const yr = parsed.getFullYear();
      const mo = String(parsed.getMonth() + 1).padStart(2, '0');
      const dy = String(parsed.getDate()).padStart(2, '0');
      return `${yr}-${mo}-${dy}`;
    }
  }
  if (typeof input.toDate === 'function') {
    try {
      const d = input.toDate();
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      return `${yr}-${mo}-${dy}`;
    } catch {}
  }
  if (input instanceof Date && !isNaN(input.getTime())) {
    const yr = input.getFullYear();
    const mo = String(input.getMonth() + 1).padStart(2, '0');
    const dy = String(input.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  }
  return new Date().toISOString().split('T')[0];
}

// ─── TITLE RESOLVER (Never show random database IDs to user) ───────────
function resolveCleanTitle(rawObj: any, defaultText = 'Untitled Work'): string {
  if (!rawObj) return defaultText;
  const candidate = (
    rawObj.title || 
    rawObj.deliverableTitle || 
    rawObj.topic || 
    rawObj.workDescription || 
    rawObj.workDone || 
    rawObj.name || 
    rawObj.description || 
    ''
  ).trim();

  // Reject candidate ONLY if it looks like a raw Firestore auto-ID (18+ alphanum chars, no spaces)
  // Threshold raised to 18 so short human titles like 'cghghjghnjgh' (12 chars) are NEVER rejected
  const looksLikeId = !candidate ||
    /^(task_|worklog_|cal_|video_|shoot_|edit_|doc_)[a-zA-Z0-9_-]{6,}$/.test(candidate) ||
    (/^[a-zA-Z0-9]{18,}$/.test(candidate) && !candidate.includes(' '));
  if (looksLikeId) {
    if (rawObj.category && rawObj.category.length > 2) return `${rawObj.category} Deliverable`;
    if (rawObj.clientName) return `${rawObj.clientName} Deliverable`;
    return defaultText;
  }

  return candidate;
}

export const ContentCalendar: React.FC = () => {
  const { profile, user } = useAuth();
  
  // Data Repositories
  const [entries, setEntries] = useState<CalendarEntry[]>(() => getCachedCalendarEntries());
  const [canonicalTasks, setCanonicalTasks] = useState<Task[]>(() => getCachedTasks());
  const [videos, setVideos] = useState<any[]>([]);
  const [clients, setClients] = useState<ClientData[]>(DEFAULT_CLIENTS_MASTER);
  const [employees, setEmployees] = useState<MasterEmployee[]>(() => getCachedEmployees());

  // Date Selection & Navigation
  const [currentDate, setCurrentDate] = useState(new Date());
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // ─── CANONICAL MEMBER IDENTITY RESOLVER ───────────────────────────────
  // Maps the active auth profile to the canonical employee ID used in tasks.
  // This is the ONLY correct way to match 'My Assigned Work' — never compare
  // auth UID against emp_N identifiers.
  const canonicalMemberId = useMemo(() => {
    if (!profile) return null;
    if (profile.role === 'superAdmin' || profile.role === 'admin') return 'emp_superadmin';
    // For employee role, match by name against CENTRAL_EMPLOYEES_MASTER_LIST
    const normalizedName = (profile.name || '').trim().toLowerCase();
    const matched = CENTRAL_EMPLOYEES_MASTER_LIST.find(e =>
      e.name.toLowerCase() === normalizedName ||
      e.email.toLowerCase() === (profile.email || '').toLowerCase() ||
      e.id === profile.userId
    );
    return matched?.id || null;
  }, [profile]);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<'all' | 'content' | 'tasks' | 'video' | 'overdue' | 'my_work'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedClientQuery, setSelectedClientQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientFilterOpen, setClientFilterOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');

  // Modals & Detail Drawers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null);
  const [targetDateForNew, setTargetDateForNew] = useState<string | null>(null);

  // Quick Action & Detail Drawers
  const [planMenuOpen, setPlanMenuOpen] = useState(false);
  const [quickAddMenuDate, setQuickAddMenuDate] = useState<string | null>(null);
  const [selectedTaskForDrawer, setSelectedTaskForDrawer] = useState<Task | null>(null);
  const [selectedDayForDrawer, setSelectedDayForDrawer] = useState<{ dateStr: string; events: UnifiedCalendarEvent[] } | null>(null);
  const [createTaskModalDate, setCreateTaskModalDate] = useState<string | null>(null);

  // Task Creation Modal Form State
  const [newTaskForm, setNewTaskForm] = useState({
    title: '',
    clientName: 'Dr. Anupam Jindal',
    clientId: 'client_dr_anupam_jindal',
    assigneeId: '',
    assigneeName: 'Unassigned',
    category: 'Graphic Design',
    priority: 'Medium' as 'Urgent' | 'High' | 'Medium' | 'Low',
    dueDate: todayStr,
    scheduledDate: todayStr,
    description: ''
  });
  const [savingNewTask, setSavingNewTask] = useState(false);

  // Dragging event state
  const [draggedEvent, setDraggedEvent] = useState<UnifiedCalendarEvent | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const clientFilterRef = useRef<HTMLDivElement>(null);
  const planMenuRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ─── 1. Subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    ensureCentralClientsSeeded();

    const unsubTasks = subscribeToCanonicalTasks((tasks) => {
      setCanonicalTasks(tasks);
    });

    const unsubEmployees = subscribeToCanonicalEmployees((emps) => {
      if (emps && emps.length > 0) setEmployees(emps);
    });

    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
      if (!snap.empty) {
        setClients(snap.docs.map(d => ({ id: d.id, clientId: d.id, ...d.data() })));
      }
    }, () => setClients(DEFAULT_CLIENTS_MASTER));

    const unsubVideos = onSnapshot(collection(db, 'videoTracker'), (snap) => {
      if (!snap.empty) {
        setVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    }, () => {});

    const unsubVideoProd = onSnapshot(collection(db, 'videoProduction'), (snap) => {
      if (!snap.empty) {
        const prodVideos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setVideos(prev => {
          const map = new Map<string, any>();
          prev.forEach(v => map.set(v.id, v));
          prodVideos.forEach(v => map.set(v.id, { ...map.get(v.id), ...v }));
          return Array.from(map.values());
        });
      }
    }, () => {});

    // Content Calendar Firestore stream
    const unsubCalendar = onSnapshot(collection(db, 'contentCalendar'), (snapshot) => {
      if (!snapshot.empty) {
        const list: CalendarEntry[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ contentId: docSnap.id, ...docSnap.data() } as CalendarEntry);
        });
        setEntries(list);
        setCachedCalendarEntries(list);
      } else {
        const cached = getCachedCalendarEntries();
        if (cached && cached.length > 0) setEntries(cached);
      }
    }, (err) => console.warn('Content calendar live notice:', err));

    const unsubContentPosts = onSnapshot(collection(db, 'contentPosts'), (snapshot) => {
      if (!snapshot.empty) {
        const list: CalendarEntry[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ contentId: docSnap.id, ...docSnap.data() } as CalendarEntry);
        });
        setEntries(prev => {
          const map = new Map<string, CalendarEntry>();
          prev.forEach(e => map.set(e.contentId, e));
          list.forEach(e => map.set(e.contentId, { ...map.get(e.contentId), ...e }));
          return Array.from(map.values());
        });
      }
    }, () => {});

    return () => {
      unsubTasks();
      unsubEmployees();
      unsubClients();
      unsubVideos();
      unsubVideoProd();
      unsubCalendar();
      unsubContentPosts();
    };
  }, []);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientFilterRef.current && !clientFilterRef.current.contains(e.target as Node)) {
        setClientFilterOpen(false);
      }
      if (planMenuRef.current && !planMenuRef.current.contains(e.target as Node)) {
        setPlanMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── 2. CENTRAL UNIFIED CALENDAR EVENT MAPPER ─────────────────────────
  const unifiedEvents = useMemo<UnifiedCalendarEvent[]>(() => {
    const list: UnifiedCalendarEvent[] = [];
    const seenKeys = new Set<string>();

    // A. Canonical Tasks & Work (Master Task Model)
    canonicalTasks.forEach(t => {
      if (t.isArchived || t.status === 'Cancelled') return;
      const key = `task_${t.id}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);

      const schDate = normalizeDateToYMD(t.scheduledDate || t.scheduled_date || t.dueDate || t.due_date);
      const dueDate = normalizeDateToYMD(t.dueDate || t.due_date || schDate);
      const normStatus = normalizeTaskStatus(t.status);
      const isCompleted = normStatus === 'Done';
      const isOverdue = !isCompleted && dueDate < todayStr;

      let displayStatus = normStatus === 'Done' ? 'Completed' : normStatus === 'In Progress' ? 'In Progress' : normStatus === 'In Review' ? 'In Review' : 'Pending';
      if (isOverdue) displayStatus = 'Overdue';

      list.push({
        eventKey: key,
        source: 'task',
        sourceLabel: 'TASK',
        entityId: t.id,
        // Use t.title directly — NEVER pass through resolveCleanTitle for tasks
        // resolveCleanTitle's Firestore-ID heuristic incorrectly rejects short task titles
        title: ((t.title || t.name || '').trim() || (t.description || '').slice(0, 80).trim() || t.category || 'Agency Task'),
        description: t.description || '',
        clientName: t.clientName || 'General Client',
        clientId: t.clientId,
        date: schDate,
        dueDate: dueDate,
        scheduledDate: schDate,
        status: displayStatus,
        assigneeName: t.assigneeName || 'Unassigned',
        assigneeId: t.assigneeId || t.assigned_employee_id,
        category: t.category || 'General',
        priority: t.priority || 'Medium',
        quantity: 1,
        isOverdue,
        isCompleted,
        rawTask: t
      });
    });

    // B. Social Content Posts (Master Content Model)
    entries.forEach(c => {
      const key = `content_${c.contentId}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);

      const cDate = normalizeDateToYMD(c.date);
      const isPosted = c.status === 'Posted' || c.postedStatus === 'Posted';
      const isOverdue = !isPosted && cDate < todayStr;

      list.push({
        eventKey: key,
        source: 'content',
        sourceLabel: 'CONTENT',
        entityId: c.contentId,
        title: resolveCleanTitle(c, 'Social Content Post'),
        description: c.caption || c.designBrief || '',
        clientName: c.clientName || 'Client',
        clientId: c.clientId,
        date: cDate,
        dueDate: cDate,
        scheduledDate: cDate,
        status: isPosted ? 'Posted' : c.status || 'Scheduled',
        assigneeName: c.assigneeName || c.uploaderName || 'Content Team',
        assigneeId: c.assigneeId || c.uploaderId,
        platform: c.platform || 'Instagram',
        contentType: c.contentType || 'Post',
        category: c.contentType || 'Social Media',
        isOverdue,
        isCompleted: isPosted,
        rawContent: c
      });
    });

    // C. Video Production (Shoots & Edits)
    videos.forEach(v => {
      // 1. Video Shoot Event
      if (v.shotDate || v.shootDate) {
        const shootKey = `video_shoot_${v.id}`;
        if (!seenKeys.has(shootKey)) {
          seenKeys.add(shootKey);
          const sDate = normalizeDateToYMD(v.shotDate || v.shootDate);
          const isDone = v.status === 'Completed' || v.status === 'Published' || v.status === 'Shot Completed';
          const isOverdue = !isDone && sDate < todayStr;

          list.push({
            eventKey: shootKey,
            source: 'video_shoot',
            sourceLabel: 'VIDEO SHOOT',
            entityId: v.id,
            title: `🎬 ${resolveCleanTitle(v, 'Video Shoot')}`,
            description: v.location || v.script || '',
            clientName: v.clientName || 'Client',
            clientId: v.clientId,
            date: sDate,
            dueDate: sDate,
            scheduledDate: sDate,
            status: isDone ? 'Completed' : v.status || 'Shoot Scheduled',
            assigneeName: v.videographerName || v.assignedTo || 'Videographer',
            assigneeId: v.videographerId || v.assignedToId,
            category: 'Video Shoot',
            isOverdue,
            isCompleted: isDone,
            rawVideo: v
          });
        }
      }

      // 2. Video Editing Deadline Event
      if (v.editDueDate || v.editingDeadline) {
        const editKey = `video_edit_${v.id}`;
        if (!seenKeys.has(editKey)) {
          seenKeys.add(editKey);
          const eDate = normalizeDateToYMD(v.editDueDate || v.editingDeadline);
          const isDone = v.status === 'Completed' || v.status === 'Published' || v.status === 'Edit Approved';
          const isOverdue = !isDone && eDate < todayStr;

          list.push({
            eventKey: editKey,
            source: 'video_edit',
            sourceLabel: 'VIDEO EDIT',
            entityId: v.id,
            title: `✂️ ${resolveCleanTitle(v, 'Video Editing')}`,
            description: v.notes || '',
            clientName: v.clientName || 'Client',
            clientId: v.clientId,
            date: eDate,
            dueDate: eDate,
            scheduledDate: eDate,
            status: isDone ? 'Completed' : v.status || 'In Editing',
            assigneeName: v.editorName || v.assignedTo || 'Video Editor',
            assigneeId: v.editorId || v.assignedToId,
            category: 'Reel Editing',
            isOverdue,
            isCompleted: isDone,
            rawVideo: v
          });
        }
      }

      // 3. Video Publish Date Event
      if (v.publishDate) {
        const pubKey = `video_publish_${v.id}`;
        if (!seenKeys.has(pubKey)) {
          seenKeys.add(pubKey);
          const pDate = normalizeDateToYMD(v.publishDate);
          const isDone = v.status === 'Published' || v.status === 'Completed';
          const isOverdue = !isDone && pDate < todayStr;

          list.push({
            eventKey: pubKey,
            source: 'video_edit',
            sourceLabel: 'VIDEO EDIT',
            entityId: v.id,
            title: `🚀 Publish: ${resolveCleanTitle(v, 'Video Publish')}`,
            description: v.notes || '',
            clientName: v.clientName || 'Client',
            clientId: v.clientId,
            date: pDate,
            dueDate: pDate,
            scheduledDate: pDate,
            status: isDone ? 'Published' : 'Scheduled',
            assigneeName: v.editorName || v.assignedTo || 'Video Team',
            assigneeId: v.editorId || v.assignedToId,
            category: 'Video Publish',
            isOverdue,
            isCompleted: isDone,
            rawVideo: v
          });
        }
      }
    });

    // ─── RECONCILIATION AUDIT LOG (dev tool, no-op in production) ───
    const taskIds = canonicalTasks.filter(t => !t.isArchived && t.status !== 'Cancelled').map(t => t.id);
    const calendarTaskIds = list.filter(e => e.source === 'task').map(e => e.entityId);
    const missingTaskIds = taskIds.filter(id => !calendarTaskIds.includes(id));
    const extraCalendarIds = calendarTaskIds.filter(id => !taskIds.includes(id));
    if (process.env.NODE_ENV !== 'production') {
      console.group('%c[Calendar Reconciliation Audit]', 'color:#5B4BFF;font-weight:bold;font-size:12px');
      console.log(`Source Tasks (${taskIds.length}):`, taskIds);
      console.log(`Calendar Task Events (${calendarTaskIds.length}):`, calendarTaskIds);
      if (missingTaskIds.length > 0) console.error('❌ MISSING from Calendar:', missingTaskIds);
      else console.log('✅ All task IDs present in Calendar');
      if (extraCalendarIds.length > 0) console.warn('⚠️ Extra calendar IDs not in source tasks:', extraCalendarIds);
      else console.log('✅ No duplicate/phantom calendar task records');
      console.table(
        canonicalTasks.filter(t => !t.isArchived && t.status !== 'Cancelled').map(t => {
          const evt = list.find(e => e.source === 'task' && e.entityId === t.id);
          return {
            task_id: t.id,
            title: t.title,
            assignee_id: t.assigneeId || t.assigned_employee_id,
            assignee_name: t.assigneeName,
            status: t.status,
            scheduled_date: t.scheduledDate || t.scheduled_date,
            due_date: t.dueDate || t.due_date,
            calendar_event_id: evt ? evt.eventKey : '❌ MISSING',
            calendar_date: evt ? evt.date : '—',
            included: evt ? '✅' : '❌'
          };
        })
      );
      console.groupEnd();
    }

    return list;
  }, [canonicalTasks, entries, videos, todayStr]);

  // ─── 3. FILTERED EVENTS ──────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    return unifiedEvents.filter(event => {
      // Source Filter
      if (sourceFilter === 'content' && event.source !== 'content') return false;
      if (sourceFilter === 'tasks' && event.source !== 'task') return false;
      if (sourceFilter === 'video' && event.source !== 'video_shoot' && event.source !== 'video_edit') return false;
      if (sourceFilter === 'overdue' && !event.isOverdue) return false;
      if (sourceFilter === 'my_work') {
        // Use canonical employee ID for comparison — NEVER compare auth UID against emp_N
        if (canonicalMemberId) {
          // Primary: exact ID match (emp_superadmin, emp_1 … emp_N)
          const idMatch = event.assigneeId === canonicalMemberId;
          // Fallback: name match for edge-cases where assigneeId may be missing
          const nameMatch = canonicalMemberId === 'emp_superadmin'
            ? (event.assigneeName || '').toLowerCase().includes('super admin') ||
              (event.assigneeName || '').toLowerCase().includes('digiexplode')
            : false;
          if (!idMatch && !nameMatch) return false;
        } else {
          // Profile not yet resolved — show nothing rather than showing everything
          return false;
        }
      }

      // Status Filter
      if (statusFilter !== 'all') {
        const sLower = statusFilter.toLowerCase();
        const evStatusLower = event.status.toLowerCase();
        if (sLower === 'overdue' && !event.isOverdue) return false;
        if (sLower === 'completed' && !event.isCompleted && !evStatusLower.includes('done') && !evStatusLower.includes('posted')) return false;
        if (sLower === 'pending' && (event.isCompleted || evStatusLower.includes('in progress'))) return false;
        if (sLower === 'in progress' && !evStatusLower.includes('progress') && !evStatusLower.includes('editing')) return false;
        if (sLower === 'scheduled' && !evStatusLower.includes('scheduled') && !evStatusLower.includes('planned')) return false;
        if (sLower === 'approved' && !evStatusLower.includes('approved')) return false;
        if (sLower === 'posted' && !evStatusLower.includes('posted') && !evStatusLower.includes('published')) return false;
      }

      // Client Filter
      if (selectedClientId && event.clientId !== selectedClientId) {
        if (!event.clientName.toLowerCase().includes(selectedClientQuery.toLowerCase())) return false;
      } else if (selectedClientQuery && !event.clientName.toLowerCase().includes(selectedClientQuery.toLowerCase())) {
        return false;
      }

      // Employee Filter
      if (selectedEmployee) {
        const empLower = selectedEmployee.toLowerCase();
        const matchId = event.assigneeId === selectedEmployee;
        const matchName = (event.assigneeName || '').toLowerCase().includes(empLower);
        if (!matchId && !matchName) return false;
      }

      // Text Search
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const match = 
          (event.title || '').toLowerCase().includes(q) ||
          (event.clientName || '').toLowerCase().includes(q) ||
          (event.assigneeName || '').toLowerCase().includes(q) ||
          (event.category || '').toLowerCase().includes(q) ||
          (event.platform || '').toLowerCase().includes(q) ||
          (event.status || '').toLowerCase().includes(q) ||
          (event.description || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [unifiedEvents, sourceFilter, statusFilter, selectedClientId, selectedClientQuery, selectedEmployee, searchTerm, canonicalMemberId]);

  // Year & Month Calculations
  const currentYear = currentDate.getFullYear();
  const currentMonthNum = currentDate.getMonth();
  const daysInMonth = new Date(currentYear, currentMonthNum + 1, 0).getDate();
  const startingDayOfWeek = new Date(currentYear, currentMonthNum, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonthNum - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonthNum + 1, 1));
  const handleToday = () => setCurrentDate(new Date());
  const handlePrevWeek = () => setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const handleNextWeek = () => setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });

  // ─── AGENDA: ALL filtered events (no month restriction) ─────────────
  // Agenda is the audit-friendly truth view — it NEVER restricts to a single month.
  // Month/week navigation controls which month is displayed in those views.
  // Agenda always shows every qualifying event from the full dataset.
  const agendaAllEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredEvents]);

  // Month-scoped list used only for month-grid and week-grid views:
  const agendaMonthEvents = useMemo(() => {
    const m = `${currentYear}-${String(currentMonthNum + 1).padStart(2, '0')}`;
    return filteredEvents.filter(e => e.date.startsWith(m));
  }, [filteredEvents, currentYear, currentMonthNum]);

  // ─── WEEK VIEW: dates for current week (Sun-Sat) ─────────────────────
  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay()); // Go to Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }, [currentDate]);

  // ─── DRAG AND DROP RESCHEDULE ─────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, event: UnifiedCalendarEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify(event));
    setDraggedEvent(event);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnDate = async (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    const event = draggedEvent;
    setDraggedEvent(null);
    if (!event) return;

    if (event.source === 'task' && event.rawTask) {
      const origDue = event.rawTask.dueDate || event.rawTask.due_date;
      if (origDue && targetDateStr > origDue) {
        const ok = window.confirm(`Move task "${event.title}" to ${targetDateStr}? (Deadline is ${origDue})`);
        if (!ok) return;
      }

      await persistUpdateTask(event.rawTask.id, {
        scheduledDate: targetDateStr,
        scheduled_date: targetDateStr,
        dueDate: targetDateStr > (origDue || '') ? targetDateStr : origDue
      }, { uid: user?.uid, name: profile?.name });

      showToast(`✓ Task rescheduled to ${targetDateStr}`);
    } else if (event.source === 'content' && event.rawContent) {
      try {
        await setDoc(doc(db, 'contentCalendar', event.rawContent.contentId), {
          ...event.rawContent,
          date: targetDateStr,
          month: targetDateStr.substring(0, 7),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        showToast(`✓ Content post moved to ${targetDateStr}`);
      } catch (err) {
        showToast('Could not reschedule content', 'error');
      }
    } else if (event.source === 'video_shoot' && event.rawVideo) {
      try {
        await setDoc(doc(db, 'videoTracker', event.rawVideo.id), {
          shotDate: targetDateStr,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        showToast(`✓ Video shoot moved to ${targetDateStr}`);
      } catch {
        showToast('Could not reschedule video shoot', 'error');
      }
    } else if (event.source === 'video_edit' && event.rawVideo) {
      try {
        await setDoc(doc(db, 'videoTracker', event.rawVideo.id), {
          editDueDate: targetDateStr,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        showToast(`✓ Video editing deadline moved to ${targetDateStr}`);
      } catch {
        showToast('Could not reschedule editing deadline', 'error');
      }
    }
  };

  // ─── CLICK EVENT DISPATCHER ──────────────────────────────────────────
  const handleEventClick = (event: UnifiedCalendarEvent) => {
    if (event.source === 'content' && event.rawContent) {
      setEditingEntry(event.rawContent);
      setIsModalOpen(true);
    } else if (event.source === 'task' && event.rawTask) {
      setSelectedTaskForDrawer(event.rawTask);
    } else if (event.rawVideo) {
      showToast(`🎬 Video: "${event.title}" for ${event.clientName}`);
    }
  };

  // ─── TASK WORKFLOW IN DRAWER ──────────────────────────────────────────
  const handleTaskStatusChangeInDrawer = async (taskId: string, targetStatus: any) => {
    const res = await transitionTaskStatus(taskId, targetStatus, 'calendar_action', {
      uid: user?.uid,
      name: profile?.name,
      role: profile?.role
    });
    if (res.success) {
      showToast(res.message);
      if (selectedTaskForDrawer && selectedTaskForDrawer.id === taskId) {
        setSelectedTaskForDrawer({
          ...selectedTaskForDrawer,
          status: targetStatus,
          updatedAt: new Date().toISOString()
        });
      }
    }
  };

  // ─── CREATE TASK HANDLER ──────────────────────────────────────────────
  const handleSaveNewTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskForm.title.trim()) return;
    setSavingNewTask(true);

    try {
      const created = await persistNewTask({
        title: newTaskForm.title.trim(),
        clientName: newTaskForm.clientName,
        clientId: newTaskForm.clientId,
        assigneeId: newTaskForm.assigneeId,
        assigneeName: newTaskForm.assigneeName,
        category: newTaskForm.category,
        priority: newTaskForm.priority,
        scheduledDate: newTaskForm.scheduledDate || todayStr,
        dueDate: newTaskForm.dueDate || todayStr,
        description: newTaskForm.description.trim(),
        status: 'To Do'
      }, { uid: user?.uid, name: profile?.name });

      showToast(`✓ Created task "${created.title}" for ${created.clientName}`);
      setCreateTaskModalDate(null);
      setNewTaskForm({
        title: '',
        clientName: 'Dr. Anupam Jindal',
        clientId: 'client_dr_anupam_jindal',
        assigneeId: '',
        assigneeName: 'Unassigned',
        category: 'Graphic Design',
        priority: 'Medium',
        dueDate: todayStr,
        scheduledDate: todayStr,
        description: ''
      });
    } catch (err) {
      showToast('Could not create task', 'error');
    } finally {
      setSavingNewTask(false);
    }
  };

  // ─── CARD STYLING HELPER ──────────────────────────────────────────────
  const getCardStyle = (event: UnifiedCalendarEvent) => {
    if (event.isOverdue) {
      return {
        card: 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200',
        badge: 'bg-rose-600 text-white',
        dot: 'bg-rose-500'
      };
    }
    if (event.isCompleted) {
      return {
        card: 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200',
        badge: 'bg-emerald-600 text-white',
        dot: 'bg-emerald-500'
      };
    }
    switch(event.source) {
      case 'task':
        return {
          card: 'bg-indigo-50/70 dark:bg-[#1E1A42]/60 border-indigo-200/80 dark:border-[#5B4BFF]/30 text-[#101828] dark:text-[#F7F8FC]',
          badge: 'bg-[#5B4BFF] text-white',
          dot: 'bg-[#5B4BFF]'
        };
      case 'content':
        return {
          card: 'bg-pink-50/70 dark:bg-pink-950/40 border-pink-200 dark:border-pink-900/60 text-pink-900 dark:text-pink-200',
          badge: 'bg-pink-600 text-white',
          dot: 'bg-pink-500'
        };
      case 'video_shoot':
      case 'video_edit':
        return {
          card: 'bg-cyan-50/70 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-900/60 text-cyan-900 dark:text-cyan-200',
          badge: 'bg-cyan-600 text-white',
          dot: 'bg-cyan-500'
        };
      default:
        return {
          card: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white',
          badge: 'bg-slate-700 text-white',
          dot: 'bg-slate-500'
        };
    }
  };

  // ─── UNIQUE CLIENTS FOR SEARCH ────────────────────────────────────────
  const uniqueClients = useMemo(() => {
    const map = new Map<string, any>();
    clients.forEach(c => {
      const name = (c.clientName || c.name || c.businessName || '').trim();
      if (name && !map.has(name.toLowerCase())) {
        map.set(name.toLowerCase(), { id: c.id || c.clientId, name });
      }
    });
    return Array.from(map.values());
  }, [clients]);

  const filteredClientSuggestions = useMemo(() => {
    if (!selectedClientQuery.trim()) return uniqueClients.slice(0, 8);
    const q = selectedClientQuery.toLowerCase();
    return uniqueClients.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [uniqueClients, selectedClientQuery]);

  // ─── RENDER MONTH CELL GRID ───────────────────────────────────────────
  const renderCalendarMonthCells = () => {
    const cells = [];
    const prevMonthEnd = new Date(currentYear, currentMonthNum, 0).getDate();

    // 1. Previous month trailing days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthEnd - i;
      cells.push(
        <div key={`prev-${dayNum}`} className="bg-slate-50/30 dark:bg-slate-950/15 border border-slate-100 dark:border-white/5 p-2 min-h-[135px] opacity-35 select-none">
          <span className="text-xs font-bold text-slate-400">{dayNum}</span>
        </div>
      );
    }

    // 2. Current month active days
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${currentYear}-${String(currentMonthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = filteredEvents.filter(e => e.date === dayStr);
      const isToday = dayStr === todayStr;
      const visibleEvents = dayEvents.slice(0, 3);
      const overflowCount = dayEvents.length - visibleEvents.length;

      cells.push(
        <div 
          key={`day-${day}`} 
          onDragOver={handleDragOver}
          onDrop={e => handleDropOnDate(e, dayStr)}
          className={`border p-2 min-h-[140px] flex flex-col justify-between transition-all group relative ${
            isToday 
              ? 'bg-[#EEECFF]/40 dark:bg-[#5B4BFF]/10 border-[#5B4BFF] ring-1 ring-[#5B4BFF]/30' 
              : 'bg-white dark:bg-[#11152D] border-slate-150 dark:border-white/10 hover:border-[#5B4BFF]/40'
          }`}
        >
          {/* Day Header */}
          <div className="flex justify-between items-center mb-1">
            <div 
              onClick={() => setSelectedDayForDrawer({ dateStr: dayStr, events: dayEvents })}
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-80"
            >
              <span className={`text-xs font-black px-1.5 py-0.5 rounded-md ${
                isToday ? 'bg-[#5B4BFF] text-white' : 'text-slate-800 dark:text-slate-200'
              }`}>
                {day}
              </span>
              {dayEvents.length > 0 && (
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                  {dayEvents.length} item{dayEvents.length === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {profile?.role !== 'client' && (
              <button 
                onClick={() => setQuickAddMenuDate(dayStr)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-[#5B4BFF] hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-all text-slate-400 cursor-pointer"
                title={`Schedule item for ${dayStr}`}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Calendar Day Events Items */}
          <div className="space-y-1.5 flex-grow pr-0.5">
            {visibleEvents.map(event => {
              const styles = getCardStyle(event);
              return (
                <div 
                  key={event.eventKey}
                  draggable
                  onDragStart={e => handleDragStart(e, event)}
                  onClick={() => handleEventClick(event)}
                  className={`text-[9.5px] font-bold p-1.5 rounded-xl border flex flex-col gap-0.5 cursor-grab active:cursor-grabbing transition-all shadow-2xs hover:shadow-xs hover:border-[#5B4BFF] ${styles.card}`}
                  title={`${event.sourceLabel}: ${event.clientName} - ${event.title}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-[7px] font-black px-1 rounded-sm uppercase tracking-wider ${styles.badge}`}>
                      {event.isOverdue ? 'OVERDUE' : event.sourceLabel}
                    </span>
                    <span className="text-[8px] font-semibold text-[#64748B] dark:text-[#94A3B8] truncate max-w-[65px]">
                      {event.assigneeName || 'Unassigned'}
                    </span>
                  </div>

                  <span className="truncate text-[#101828] dark:text-white font-black leading-tight">
                    {event.title}
                  </span>

                  <div className="flex justify-between items-center text-[8px] opacity-80 pt-0.5">
                    <span className="truncate max-w-[75px]">{event.clientName}</span>
                    <span className="font-bold">{event.status}</span>
                  </div>
                </div>
              );
            })}

            {/* Overflow "+N more" pill */}
            {overflowCount > 0 && (
              <button
                onClick={() => setSelectedDayForDrawer({ dateStr: dayStr, events: dayEvents })}
                className="w-full py-1 text-center text-[10px] font-black text-[#5B4BFF] dark:text-[#9A8CFF] bg-[#EEECFF] dark:bg-[#201D45] hover:bg-[#5B4BFF] hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                +{overflowCount} more items
              </button>
            )}
          </div>
        </div>
      );
    }

    // 3. Trailing blank spaces
    const totalFilled = startingDayOfWeek + daysInMonth;
    const remainingDays = 42 - totalFilled;
    for (let day = 1; day <= remainingDays; day++) {
      cells.push(
        <div key={`next-${day}`} className="bg-slate-50/30 dark:bg-slate-950/15 border border-slate-100 dark:border-white/5 p-2 min-h-[135px] opacity-35 select-none">
          <span className="text-xs font-bold text-slate-400">{day}</span>
        </div>
      );
    }

    return cells;
  };

  return (
    <div className="space-y-5 pb-16 font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-60 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md transition-all text-xs font-bold animate-in fade-in slide-in-from-top-4 ${
          toast.type === 'error'
            ? 'bg-rose-50 dark:bg-rose-950/90 text-rose-700 dark:text-rose-200 border-rose-200 dark:border-rose-800'
            : toast.type === 'info'
            ? 'bg-amber-50 dark:bg-amber-950/90 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
            : 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ─── 1. HEADER & CONTROL TOOLBAR ───────────────────────────────── */}
      <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl p-5 shadow-xs space-y-4">
        
        {/* Top Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EEECFF] text-[#5B4BFF] dark:bg-[#201D45] dark:text-[#9A8CFF] border border-[#5B4BFF]/25">
                <CalendarIcon className="w-3 h-3" />
                Unified Agency Master Calendar
              </span>
              <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] tracking-wider uppercase">
                Synchronized across My Day, Tasks & Content
              </span>
            </div>

            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-[#101828] dark:text-white">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h1>
              <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
                ({filteredEvents.length} items visible)
              </span>
            </div>
          </div>

          {/* Navigation & Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-1 shadow-2xs">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'month' ? 'bg-white dark:bg-[#11152D] text-[#5B4BFF] shadow-xs' : 'text-[#64748B] dark:text-[#94A3B8]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Month</span>
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'week' ? 'bg-white dark:bg-[#11152D] text-[#5B4BFF] shadow-xs' : 'text-[#64748B] dark:text-[#94A3B8]'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Week</span>
              </button>
              <button
                onClick={() => setViewMode('agenda')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'agenda' ? 'bg-white dark:bg-[#11152D] text-[#5B4BFF] shadow-xs' : 'text-[#64748B] dark:text-[#94A3B8]'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Agenda</span>
              </button>
            </div>

            <button
              onClick={handleToday}
              className="px-3.5 py-1.5 text-xs font-bold bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 hover:bg-[#EEECFF] hover:text-[#5B4BFF] rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              Today
            </button>

            <div className="flex items-center bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-0.5 shadow-2xs">
              <button
                onClick={viewMode === 'week' ? handlePrevWeek : handlePrevMonth}
                className="p-1.5 hover:bg-white dark:hover:bg-[#11152D] rounded-lg text-[#64748B] dark:text-[#94A3B8] cursor-pointer transition-colors"
                title={viewMode === 'week' ? 'Previous Week' : 'Previous Month'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={viewMode === 'week' ? handleNextWeek : handleNextMonth}
                className="p-1.5 hover:bg-white dark:hover:bg-[#11152D] rounded-lg text-[#64748B] dark:text-[#94A3B8] cursor-pointer transition-colors"
                title={viewMode === 'week' ? 'Next Week' : 'Next Month'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* + Plan / Schedule dropdown button */}
            {profile?.role !== 'client' && (
              <div className="relative" ref={planMenuRef}>
                <button
                  onClick={() => setPlanMenuOpen(!planMenuOpen)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#5B4BFF] hover:bg-[#4E3FE6] text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Plan / Schedule</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                </button>

                {planMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 bg-white dark:bg-[#141A32] border border-[#D8DEE9] dark:border-white/15 rounded-xl shadow-2xl z-50 w-56 p-1.5 space-y-1 animate-in fade-in slide-in-from-top-1">
                    <button
                      onClick={() => {
                        setCreateTaskModalDate(todayStr);
                        setPlanMenuOpen(false);
                      }}
                      className="w-full p-2 rounded-lg text-left text-xs font-bold text-[#101828] dark:text-white hover:bg-[#EEECFF] hover:text-[#5B4BFF] dark:hover:bg-[#201D45] flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <CheckSquare className="w-4 h-4 text-[#5B4BFF]" />
                      <span>Create Task & Work</span>
                    </button>

                    <button
                      onClick={() => {
                        setTargetDateForNew(todayStr);
                        setIsModalOpen(true);
                        setEditingEntry(null);
                        setPlanMenuOpen(false);
                      }}
                      className="w-full p-2 rounded-lg text-left text-xs font-bold text-[#101828] dark:text-white hover:bg-pink-50 hover:text-pink-600 dark:hover:bg-pink-950/40 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Instagram className="w-4 h-4 text-pink-600" />
                      <span>Schedule Social Content</span>
                    </button>

                    <button
                      onClick={() => {
                        setCreateTaskModalDate(todayStr);
                        setNewTaskForm(p => ({ ...p, category: 'Video Shoot', title: 'Video Shoot' }));
                        setPlanMenuOpen(false);
                      }}
                      className="w-full p-2 rounded-lg text-left text-xs font-bold text-[#101828] dark:text-white hover:bg-cyan-50 hover:text-cyan-600 dark:hover:bg-cyan-950/40 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Video className="w-4 h-4 text-cyan-600" />
                      <span>Schedule Video Shoot</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── SOURCE FILTER CHIPS WITH REAL COUNTS ────────────────────── */}
        <div className="pt-3 border-t border-[#D8DEE9] dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#7A8496] mr-1 shrink-0">
              Source:
            </span>
            {[
              { key: 'all', label: 'All Sources', count: unifiedEvents.length },
              { key: 'content', label: 'Content Posts', count: unifiedEvents.filter(e => e.source === 'content').length },
              { key: 'tasks', label: 'Tasks & Work', count: unifiedEvents.filter(e => e.source === 'task').length },
              { key: 'video', label: 'Video Shoots & Edits', count: unifiedEvents.filter(e => e.source === 'video_shoot' || e.source === 'video_edit').length },
              { key: 'overdue', label: 'Overdue Items', count: unifiedEvents.filter(e => e.isOverdue).length },
              { key: 'my_work', label: 'My Assigned Work' }
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setSourceFilter(f.key as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs ${
                  sourceFilter === f.key
                    ? 'bg-[#5B4BFF] text-white shadow-xs'
                    : 'bg-[#F8FAFC] dark:bg-[#161B31] text-[#344054] dark:text-[#AEB3C5] hover:bg-[#EEECFF] hover:text-[#5B4BFF] border border-[#D8DEE9] dark:border-white/10'
                }`}
              >
                <span>{f.label}</span>
                {typeof f.count === 'number' && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    sourceFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-[#475467] dark:text-[#CBD5E1]'
                  }`}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Secondary Filters Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="flex items-center gap-2 bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-2.5 py-1.5 shadow-2xs">
              <Search className="w-3.5 h-3.5 text-[#7A8496]" />
              <input
                type="text"
                placeholder="Search title, client, assignee, category…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent text-xs text-[#101828] dark:text-white outline-none w-36 sm:w-52"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-[#344054] dark:text-[#AEB3C5] outline-none cursor-pointer shadow-2xs"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed / Done</option>
              <option value="Overdue">Overdue</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Approved">Approved</option>
              <option value="Posted">Posted</option>
            </select>

            {/* Searchable Client Filter */}
            <div className="relative" ref={clientFilterRef}>
              <button
                type="button"
                onClick={() => setClientFilterOpen(!clientFilterOpen)}
                className="bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-[#344054] dark:text-[#AEB3C5] flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <span>{selectedClientQuery || 'All Clients'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {clientFilterOpen && (
                <div className="absolute right-0 top-full mt-1.5 bg-white dark:bg-[#141A32] border border-[#D8DEE9] dark:border-white/15 rounded-xl shadow-2xl z-50 w-64 p-2 space-y-2 animate-in fade-in slide-in-from-top-1">
                  <input
                    type="text"
                    placeholder="Search client (e.g. Anupam)..."
                    value={selectedClientQuery}
                    onChange={e => {
                      setSelectedClientQuery(e.target.value);
                      setSelectedClientId('');
                    }}
                    className="w-full p-2 bg-slate-50 dark:bg-[#11152D] border border-slate-200 dark:border-white/10 rounded-lg text-xs text-[#101828] dark:text-white outline-none"
                    autoFocus
                  />
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 text-xs">
                    <div
                      onClick={() => {
                        setSelectedClientQuery('');
                        setSelectedClientId('');
                        setClientFilterOpen(false);
                      }}
                      className="p-2 hover:bg-[#EEECFF] dark:hover:bg-[#201D45] rounded-lg cursor-pointer font-bold text-[#5B4BFF]"
                    >
                      ✓ All Clients
                    </div>
                    {filteredClientSuggestions.map(c => (
                      <div
                        key={c.id || c.name}
                        onClick={() => {
                          setSelectedClientQuery(c.name);
                          setSelectedClientId(c.id);
                          setClientFilterOpen(false);
                        }}
                        className="p-2 hover:bg-[#EEECFF] dark:hover:bg-[#201D45] rounded-lg cursor-pointer font-medium text-[#101828] dark:text-white truncate"
                      >
                        {c.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Employee Filter */}
            <select
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className="bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-[#344054] dark:text-[#AEB3C5] outline-none cursor-pointer shadow-2xs"
            >
              <option value="">All Employees</option>
              {employees.map(e => (
                <option key={e.id || e.employeeId} value={e.id || e.employeeId}>
                  {e.name} ({e.role || 'Member'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── 2. MAIN CALENDAR VIEW (MONTH / WEEK / AGENDA) ───────────────── */}
      {viewMode === 'month' ? (
        <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl overflow-hidden shadow-xs">
          {/* Days of Week Header */}
          <div className="grid grid-cols-7 border-b border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-center py-3">
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
              <span key={d} className="text-[10px] font-black tracking-widest text-[#7A8496]">{d}</span>
            ))}
          </div>
          {/* Month Day Cells */}
          <div className="grid grid-cols-7 gap-[1px] bg-[#D8DEE9] dark:bg-white/10">
            {renderCalendarMonthCells()}
          </div>
        </div>

      ) : viewMode === 'week' ? (
        /* ─── WEEK VIEW ──────────────────────────────────────────────────── */
        <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl overflow-hidden shadow-xs">
          {/* Week day header */}
          <div className="grid grid-cols-7 border-b border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31]">
            {weekDays.map((dayStr, i) => {
              const d = new Date(dayStr + 'T00:00:00');
              const isToday = dayStr === todayStr;
              const dayEvents = filteredEvents.filter(e => e.date === dayStr);
              return (
                <div
                  key={dayStr}
                  className={`p-3 text-center border-r border-[#D8DEE9] dark:border-white/10 last:border-r-0 ${
                    isToday ? 'bg-[#EEECFF]/60 dark:bg-[#5B4BFF]/15' : ''
                  }`}
                >
                  <div className="text-[9px] font-black uppercase tracking-wider text-[#7A8496]">
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i]}
                  </div>
                  <div className={`text-xl font-black mt-0.5 ${
                    isToday ? 'text-[#5B4BFF] dark:text-[#9A8CFF]' : 'text-[#101828] dark:text-white'
                  }`}>
                    {d.getDate()}
                  </div>
                  {dayEvents.length > 0 && (
                    <span className="text-[9px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                      {dayEvents.length} item{dayEvents.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Week event columns */}
          <div className="grid grid-cols-7 divide-x divide-[#D8DEE9] dark:divide-white/10 min-h-[520px]">
            {weekDays.map(dayStr => {
              const dayEvents = filteredEvents.filter(e => e.date === dayStr);
              const isToday = dayStr === todayStr;
              return (
                <div
                  key={dayStr}
                  className={`p-1.5 space-y-1.5 min-h-[520px] ${
                    isToday ? 'bg-[#EEECFF]/20 dark:bg-[#5B4BFF]/5' : 'bg-white dark:bg-[#11152D]'
                  }`}
                  onDragOver={handleDragOver}
                  onDrop={e => handleDropOnDate(e, dayStr)}
                >
                  {dayEvents.length === 0 && (
                    <div className="h-full flex items-start justify-center pt-8">
                      <span className="text-[10px] text-[#D8DEE9] dark:text-white/10 font-bold select-none">—</span>
                    </div>
                  )}
                  {dayEvents.map(event => {
                    const styles = getCardStyle(event);
                    const isRollover = event.rawTask && (event.rawTask.rolloverCount || 0) > 0;
                    return (
                      <div
                        key={event.eventKey}
                        draggable
                        onDragStart={e => handleDragStart(e, event)}
                        onClick={() => handleEventClick(event)}
                        className={`p-2 rounded-xl border text-[10px] cursor-grab active:cursor-grabbing hover:border-[#5B4BFF] hover:shadow-sm transition-all shadow-2xs ${styles.card}`}
                        title={`${event.sourceLabel}: ${event.title} — ${event.clientName}`}
                      >
                        <div className="flex items-center gap-1 mb-1">
                          <span className={`text-[7px] font-black px-1 py-0.5 rounded-sm uppercase tracking-wider ${styles.badge}`}>
                            {event.isOverdue ? 'OD' : event.sourceLabel.split(' ')[0]}
                          </span>
                          {isRollover && (
                            <span className="text-[7px] font-black px-1 py-0.5 rounded-sm bg-amber-500 text-white uppercase">CF</span>
                          )}
                        </div>
                        <div className="font-black text-[#101828] dark:text-white leading-tight line-clamp-2 text-[10px]">
                          {event.title}
                        </div>
                        <div className="text-[9px] text-[#64748B] dark:text-[#94A3B8] mt-1 truncate">
                          {event.clientName}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

      ) : (
        /* ─── AGENDA VIEW — All dates, zero hidden entries, full audit view ─── */
        <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl overflow-hidden shadow-xs">
          {/* Agenda header */}
          <div className="px-5 py-4 border-b border-[#D8DEE9] dark:border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-[#101828] dark:text-white">
                Full Agenda · All Dates
              </h3>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                {agendaAllEvents.length} item{agendaAllEvents.length !== 1 ? 's' : ''}
                {sourceFilter !== 'all' ? ` · filtered by ${sourceFilter === 'tasks' ? 'Tasks & Work' : sourceFilter === 'content' ? 'Content Posts' : sourceFilter === 'my_work' ? 'My Assigned Work' : sourceFilter === 'overdue' ? 'Overdue' : 'Video'}` : ''}
                {' · '}all entries shown · click to open source record
              </p>
            </div>
            <div className="flex items-center gap-2">
              {sourceFilter !== 'all' && (
                <button
                  onClick={() => setSourceFilter('all')}
                  className="text-[9px] font-black px-2 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center gap-1 cursor-pointer hover:bg-rose-100"
                >
                  <X className="w-2.5 h-2.5" />
                  Clear filter
                </button>
              )}
              <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-[#EEECFF] dark:bg-[#201D45] text-[#5B4BFF] dark:text-[#9A8CFF] border border-[#5B4BFF]/25 uppercase tracking-wider">
                {agendaAllEvents.length} Total
              </span>
            </div>
          </div>

          {agendaAllEvents.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <CalendarDays className="w-10 h-10 mx-auto text-[#D8DEE9] dark:text-white/15 mb-3" />
              <p className="text-sm font-bold text-[#64748B] dark:text-[#94A3B8]">
                No items match the current filter selection.
              </p>
              <p className="text-xs text-[#94A3B8] mt-1">Try clearing filters to see all events.</p>
            </div>
          ) : (
            /* Group events by date — uses agendaAllEvents so no month restriction */
            <div className="divide-y divide-[#D8DEE9]/60 dark:divide-white/5">
              {(Object.entries(
                [...agendaAllEvents]
                  .reduce((acc: Record<string, UnifiedCalendarEvent[]>, ev) => {
                    if (!acc[ev.date]) acc[ev.date] = [];
                    acc[ev.date].push(ev);
                    return acc;
                  }, {})
              ) as [string, UnifiedCalendarEvent[]][]).map(([dateStr, dateEvents]) => {
                const dateObj = new Date(dateStr + 'T00:00:00');
                const isToday = dateStr === todayStr;
                const isPast = dateStr < todayStr;
                const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

                return (
                  <div key={dateStr}>
                    {/* Sticky date header */}
                    <div className={`px-5 py-2.5 flex items-center gap-2.5 sticky top-0 z-10 backdrop-blur-sm border-l-4 ${
                      isToday
                        ? 'bg-[#EEECFF]/90 dark:bg-[#5B4BFF]/20 border-[#5B4BFF]'
                        : isPast
                        ? 'bg-[#F8FAFC]/90 dark:bg-[#161B31]/90 border-[#D8DEE9] dark:border-white/10'
                        : 'bg-white/90 dark:bg-[#11152D]/90 border-[#5B4BFF]/30'
                    }`}>
                      <span className={`text-xs font-black ${
                        isToday ? 'text-[#5B4BFF] dark:text-[#9A8CFF]' : isPast ? 'text-[#7A8496]' : 'text-[#344054] dark:text-[#CBD5E1]'
                      }`}>
                        {dayLabel}
                      </span>
                      {isToday && (
                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-[#5B4BFF] text-white uppercase tracking-wider">
                          TODAY
                        </span>
                      )}
                      <span className="text-[10px] text-[#94A3B8] font-bold ml-auto">
                        {dateEvents.length} item{dateEvents.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Events for this date */}
                    <div className="px-5 py-3 space-y-2">
                      {dateEvents.map(event => {
                        const styles = getCardStyle(event);
                        const isRollover = event.rawTask && (event.rawTask.rolloverCount || 0) > 0;
                        return (
                          <div
                            key={event.eventKey}
                            draggable
                            onDragStart={e => handleDragStart(e, event)}
                            onClick={() => handleEventClick(event)}
                            className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer hover:border-[#5B4BFF] hover:shadow-sm transition-all shadow-2xs ${styles.card}`}
                          >
                            {/* Source accent strip */}
                            <div className={`w-1 self-stretch rounded-full shrink-0 mt-0.5 ${styles.dot}`} />

                            {/* Main content */}
                            <div className="flex-1 min-w-0 space-y-1">
                              {/* Badges row */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${styles.badge}`}>
                                  {event.sourceLabel}
                                </span>
                                <span className="text-[9px] font-mono text-[#94A3B8] dark:text-[#64748B]" title={`Source ID: ${event.entityId}`}>
                                  {event.entityId.slice(0, 8)}…
                                </span>
                                {event.isOverdue && (
                                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-rose-600 text-white uppercase tracking-wider">OVERDUE</span>
                                )}
                                {isRollover && (
                                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-500 text-white uppercase tracking-wider">
                                    CARRIED ×{event.rawTask!.rolloverCount}
                                  </span>
                                )}
                                {(event.priority === 'Urgent' || event.priority === 'High') && (
                                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900 uppercase">
                                    {event.priority}
                                  </span>
                                )}
                              </div>

                              {/* Title — always full, never truncated */}
                              <h4 className="text-sm font-black text-[#101828] dark:text-white leading-snug">
                                {event.title}
                              </h4>

                              {/* Meta row */}
                              <div className="flex items-center gap-3 flex-wrap text-[11px]">
                                <span className="font-bold text-[#344054] dark:text-[#CBD5E1]">
                                  {event.clientName}
                                </span>
                                {event.assigneeName && event.assigneeName !== 'Unassigned' && event.assigneeName !== 'Content Team' && (
                                  <span className="text-[#64748B] dark:text-[#94A3B8]">
                                    → {event.assigneeName}
                                  </span>
                                )}
                                {event.dueDate && event.dueDate !== event.date && (
                                  <span className={`font-bold ${
                                    event.isOverdue ? 'text-rose-600' : 'text-[#7A8496] dark:text-[#94A3B8]'
                                  }`}>
                                    Due {event.dueDate}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Status badge */}
                            <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-white dark:bg-white/10 border border-[#D8DEE9] dark:border-white/10 text-[#344054] dark:text-[#CBD5E1] shrink-0 whitespace-nowrap self-start">
                              {event.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── QUICK ADD MENU POPUP (Date Cell "+") ──────────────────────── */}
      {quickAddMenuDate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl animate-in zoom-in-95 font-sans">
            <div className="flex items-center justify-between pb-2 border-b border-[#D8DEE9] dark:border-white/10">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[#5B4BFF]" />
                <h3 className="text-sm font-black text-[#101828] dark:text-white">
                  Schedule on {quickAddMenuDate}
                </h3>
              </div>
              <button onClick={() => setQuickAddMenuDate(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  setTargetDateForNew(quickAddMenuDate);
                  setIsModalOpen(true);
                  setEditingEntry(null);
                  setQuickAddMenuDate(null);
                }}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-pink-500 hover:bg-pink-50/40 dark:hover:bg-pink-950/20 text-left flex items-center justify-between transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 dark:bg-pink-950/40 flex items-center justify-center font-bold">
                    <Instagram className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#101828] dark:text-white group-hover:text-pink-600">
                      Plan Social Content Post
                    </h4>
                    <p className="text-[10px] text-[#7A8496]">Reel, Carousel, Story, or Graphic</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#7A8496] group-hover:text-pink-600" />
              </button>

              <button
                onClick={() => {
                  setCreateTaskModalDate(quickAddMenuDate);
                  setNewTaskForm(p => ({ ...p, scheduledDate: quickAddMenuDate, dueDate: quickAddMenuDate }));
                  setQuickAddMenuDate(null);
                }}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-[#5B4BFF] hover:bg-[#EEECFF]/30 dark:hover:bg-[#5B4BFF]/10 text-left flex items-center justify-between transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#EEECFF] text-[#5B4BFF] dark:bg-[#201D45] flex items-center justify-center font-bold">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#101828] dark:text-white group-hover:text-[#5B4BFF]">
                      Create Operational Task
                    </h4>
                    <p className="text-[10px] text-[#7A8496]">Synchronized with Tasks & My Day</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#7A8496] group-hover:text-[#5B4BFF]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CREATE CANONICAL TASK MODAL ───────────────────────────────── */}
      {createTaskModalDate && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DEE9] dark:border-white/10">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-[#5B4BFF]" />
                <h3 className="text-sm font-black text-[#101828] dark:text-white">
                  Create Master Task
                </h3>
              </div>
              <button onClick={() => setCreateTaskModalDate(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewTask} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-[#344054] dark:text-[#CBD5E1] block mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Patient Testimonial Video, Flyer Design..."
                  value={newTaskForm.title}
                  onChange={e => setNewTaskForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-bold outline-none focus:border-[#5B4BFF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#344054] dark:text-[#CBD5E1] block mb-1">
                    Client *
                  </label>
                  <select
                    value={newTaskForm.clientName}
                    onChange={e => {
                      const name = e.target.value;
                      const c = clients.find(cl => (cl.clientName || cl.name) === name);
                      setNewTaskForm(p => ({ ...p, clientName: name, clientId: c?.id || c?.clientId || '' }));
                    }}
                    className="w-full p-2.5 rounded-xl border border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-bold outline-none cursor-pointer"
                  >
                    {clients.map(c => (
                      <option key={c.id || c.clientId} value={c.clientName || c.name}>
                        {c.clientName || c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#344054] dark:text-[#CBD5E1] block mb-1">
                    Assignee
                  </label>
                  <select
                    value={newTaskForm.assigneeId}
                    onChange={e => {
                      const empId = e.target.value;
                      const emp = employees.find(em => (em.id || em.employeeId) === empId);
                      setNewTaskForm(p => ({ ...p, assigneeId: empId, assigneeName: emp?.name || 'Unassigned' }));
                    }}
                    className="w-full p-2.5 rounded-xl border border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-bold outline-none cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {employees.map(e => (
                      <option key={e.id || e.employeeId} value={e.id || e.employeeId}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#344054] dark:text-[#CBD5E1] block mb-1">
                    Category
                  </label>
                  <select
                    value={newTaskForm.category}
                    onChange={e => setNewTaskForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-bold outline-none cursor-pointer"
                  >
                    <option value="Graphic Design">Graphic Design</option>
                    <option value="Reel Editing">Reel Editing</option>
                    <option value="Video Shoot">Video Shoot</option>
                    <option value="Script Writing">Script Writing</option>
                    <option value="Meta Ads">Meta Ads</option>
                    <option value="SEO">SEO</option>
                    <option value="Website Update">Website Update</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#344054] dark:text-[#CBD5E1] block mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newTaskForm.dueDate}
                    onChange={e => setNewTaskForm(p => ({ ...p, dueDate: e.target.value, scheduledDate: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-bold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#344054] dark:text-[#CBD5E1] block mb-1">
                  Description / Brief
                </label>
                <textarea
                  rows={2}
                  placeholder="Task brief or creative guidelines..."
                  value={newTaskForm.description}
                  onChange={e => setNewTaskForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-medium outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D8DEE9] dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setCreateTaskModalDate(null)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNewTask}
                  className="px-5 py-2.5 bg-[#5B4BFF] hover:bg-[#4E3FE6] text-white font-black rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {savingNewTask ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DAY DETAIL DRAWER (When clicking "+N more" or Day Number) ──── */}
      {selectedDayForDrawer && (
        <div 
          className="fixed inset-0 z-60 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in"
          onClick={() => setSelectedDayForDrawer(null)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-[#11152D] border-l border-[#D8DEE9] dark:border-white/10 h-full overflow-y-auto shadow-2xl p-6 space-y-5 flex flex-col justify-between"
            onClick={e => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#D8DEE9] dark:border-white/10">
                <div>
                  <h3 className="text-base font-black text-[#101828] dark:text-white">
                    {new Date(selectedDayForDrawer.dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {selectedDayForDrawer.events.length} Scheduled Deliverables
                  </p>
                </div>
                <button onClick={() => setSelectedDayForDrawer(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedDayForDrawer.events.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  No items scheduled for this day.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedDayForDrawer.events.map(event => {
                    const styles = getCardStyle(event);
                    return (
                      <div
                        key={event.eventKey}
                        onClick={() => {
                          setSelectedDayForDrawer(null);
                          handleEventClick(event);
                        }}
                        className={`p-3.5 rounded-xl border space-y-2 cursor-pointer hover:border-[#5B4BFF] transition-all shadow-2xs ${styles.card}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${styles.badge}`}>
                            {event.sourceLabel}
                          </span>
                          <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                            {event.assigneeName || 'Unassigned'}
                          </span>
                        </div>

                        <h4 className="text-sm font-black text-[#101828] dark:text-white">
                          {event.title}
                        </h4>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 dark:border-white/10">
                          <span className="font-bold">{event.clientName}</span>
                          <span className="font-bold text-[#5B4BFF] dark:text-[#9A8CFF]">{event.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#D8DEE9] dark:border-white/10 flex items-center justify-between">
              <button
                onClick={() => {
                  setQuickAddMenuDate(selectedDayForDrawer.dateStr);
                  setSelectedDayForDrawer(null);
                }}
                className="px-4 py-2 bg-[#5B4BFF] hover:bg-[#4E3FE6] text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                + Add Deliverable
              </button>
              <button
                onClick={() => setSelectedDayForDrawer(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TASK DETAIL DRAWER (When clicking a Task event in Calendar) ─ */}
      {selectedTaskForDrawer && (
        <div className="fixed inset-0 z-60 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in" onClick={() => setSelectedTaskForDrawer(null)}>
          <div 
            className="w-full max-w-md bg-white dark:bg-[#11152D] border-l border-[#D8DEE9] dark:border-white/10 h-full overflow-y-auto shadow-2xl p-6 space-y-6 flex flex-col justify-between"
            onClick={e => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#D8DEE9] dark:border-white/10">
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-[#EEECFF] text-[#5B4BFF] dark:bg-[#201D45] dark:text-[#9A8CFF] border border-[#5B4BFF]/30">
                  CANONICAL TASK · {normalizeTaskStatus(selectedTaskForDrawer.status)}
                </span>
                <button onClick={() => setSelectedTaskForDrawer(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <span className="text-[10px] font-bold text-[#5B4BFF] dark:text-[#9A8CFF] uppercase tracking-wider">
                  {selectedTaskForDrawer.clientName} · {selectedTaskForDrawer.category || 'Task'}
                </span>
                <h2 className="text-base font-black text-[#101828] dark:text-white mt-1">
                  {selectedTaskForDrawer.title}
                </h2>
                {selectedTaskForDrawer.description && (
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-2 font-medium leading-relaxed">
                    {selectedTaskForDrawer.description}
                  </p>
                )}
              </div>

              <div className="bg-[#F8FAFC] dark:bg-[#161B31] p-4 rounded-xl border border-[#D8DEE9] dark:border-white/10 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Scheduled Work Date:</span>
                  <span className="font-bold text-[#5B4BFF]">{selectedTaskForDrawer.scheduledDate || selectedTaskForDrawer.scheduled_date || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Final Deadline (Due Date):</span>
                  <span className="font-bold text-rose-600">{selectedTaskForDrawer.dueDate || selectedTaskForDrawer.due_date || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Assignee:</span>
                  <span className="font-bold text-[#101828] dark:text-white">{selectedTaskForDrawer.assigneeName || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Priority:</span>
                  <span className="font-bold text-[#101828] dark:text-white">{selectedTaskForDrawer.priority}</span>
                </div>
              </div>

              {/* Status Action Controls */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-[#344054] dark:text-[#CBD5E1] block">
                  Quick Workflow Action:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleTaskStatusChangeInDrawer(selectedTaskForDrawer.id, 'In Progress')}
                    className="p-2 rounded-xl text-xs font-bold bg-[#EEECFF] dark:bg-[#201D45] text-[#5B4BFF] dark:text-[#9A8CFF] hover:bg-[#5B4BFF] hover:text-white transition-colors cursor-pointer"
                  >
                    Mark In Progress
                  </button>
                  <button
                    onClick={() => handleTaskStatusChangeInDrawer(selectedTaskForDrawer.id, normalizeTaskStatus(selectedTaskForDrawer.status) === 'Done' ? 'To Do' : 'Done')}
                    className={`p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      normalizeTaskStatus(selectedTaskForDrawer.status) === 'Done'
                        ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200'
                    }`}
                  >
                    {normalizeTaskStatus(selectedTaskForDrawer.status) === 'Done' ? 'Reopen Task' : '✓ Mark Completed'}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#D8DEE9] dark:border-white/10 flex justify-end">
              <button
                onClick={() => setSelectedTaskForDrawer(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-[#101828] dark:text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CONTENT POST MODAL (When clicking a Content post) ─────────── */}
      {isModalOpen && (
        <CalendarModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingEntry(null);
            setTargetDateForNew(null);
          }}
          entry={editingEntry}
          targetDate={targetDateForNew}
          clients={clients}
        />
      )}
    </div>
  );
};

export default ContentCalendar;
