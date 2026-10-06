import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Plus, Filter, Search, List, Kanban, ChevronDown, ChevronRight,
  CheckSquare, Clock, AlertTriangle, User, Calendar, Tag, X,
  Loader2, Check, Edit2, Trash2, MoreVertical, ArrowUpRight, Flag,
  Sparkles, CheckCircle2, Layers, ExternalLink, Zap, Eye, MoveRight,
  Shield, Users, CalendarDays, RotateCcw, Film, ArrowLeft, ArrowRight,
  Settings, CheckCheck, AlertCircle, Calendar as CalendarIcon, SlidersHorizontal
} from 'lucide-react';
import { db } from '../../lib/firebase';
import {
  collection, query, where, getDocs, addDoc, updateDoc,
  deleteDoc, doc, orderBy, Timestamp, onSnapshot
} from 'firebase/firestore';
import { useActiveEmployee } from '../../hooks/useActiveEmployee';
import { DEFAULT_CLIENTS_MASTER, ensureCentralClientsSeeded } from '../../lib/clientMaster';
import { isTaskAssignedToEmployee } from '../../lib/employeeMaster';
import { AssignmentBoard } from './AssignmentBoard';
import { TaskScheduleCalendar } from './TaskScheduleCalendar';
import { MiniCalendarWidget } from './MiniCalendarWidget';
import {
  type Task,
  type RolloverSettings,
  DEFAULT_MASTER_TASKS,
  DEFAULT_ROLLOVER_SETTINGS,
  normalizeTaskStatus,
  normalizeTaskDateModel,
  getCachedTasks,
  persistNewTask,
  persistUpdateTask,
  persistDeleteTask,
  subscribeToCanonicalTasks,
  getTaskAgeingInfo,
  getNextWorkflowStatus,
  getPrevWorkflowStatus,
  transitionTaskStatus,
  bulkRescheduleTasks,
  getRolloverSettings,
  setRolloverSettings,
  getNextWorkingDate,
  differenceInCalendarDays,
} from '../../lib/taskStorage';

// ─── Types & Constants ────────────────────────────────────────────────
export { type Task } from '../../lib/taskStorage';

export type KanbanColumnKey = 'To Do' | 'In Progress' | 'In Review' | 'Done';

export const KANBAN_COLUMNS: { key: KanbanColumnKey; label: string; color: string; bg: string; border: string; accentBg: string }[] = [
  { key: 'To Do',       label: 'To Do',       color: '#64748B', bg: '#F8FAFC', border: '#D8DEE9', accentBg: 'bg-slate-500/10' },
  { key: 'In Progress', label: 'In Progress', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', accentBg: 'bg-blue-500/10' },
  { key: 'In Review',   label: 'In Review',   color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', accentBg: 'bg-amber-500/10' },
  { key: 'Done',        label: 'Done',        color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', accentBg: 'bg-emerald-500/10' },
];

export const CATEGORIES = [
  'Graphic Design', 'Reel Editing', 'Video Shoot', 'Video Editing',
  'Script Writing', 'Caption Writing', 'Social Media', 'Meta Ads',
  'Google Ads', 'SEO', 'Website Update', 'Blog', 'Client Coordination',
  'Reporting', 'Photography', 'Other'
];

export const PRIORITIES: ('Urgent' | 'High' | 'Medium' | 'Low')[] = ['Urgent', 'High', 'Medium', 'Low'];

export const DEFAULT_EMPLOYEES_LIST = [
  { id: 'emp_superadmin', name: 'Digiexplode Super Admin', role: 'Super Admin / Managing Director' },
  { id: 'emp_1', name: 'Aman Sharma', role: 'Performance Marketer' },
  { id: 'emp_2', name: 'Neha Gupta', role: 'Senior Video Editor' },
  { id: 'emp_3', name: 'Rahul Verma', role: 'Full Stack & SEO Lead' },
  { id: 'emp_4', name: 'Priya Singh', role: 'Creative Visual Designer' },
  { id: 'emp_5', name: 'Vansh', role: 'Creative Specialist' },
  { id: 'emp_6', name: 'Rohit Kumar', role: 'Content Strategist' },
];

const priorityStyles: Record<string, { badge: string; text: string; dot: string }> = {
  Urgent: { badge: 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:border-rose-900/60 dark:text-rose-300 font-black', text: 'text-rose-700', dot: 'bg-rose-500' },
  High:   { badge: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-900/60 dark:text-amber-300 font-bold', text: 'text-amber-800', dot: 'bg-amber-500' },
  Medium: { badge: 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-900/60 dark:text-indigo-300 font-bold', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  Low:    { badge: 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-white/10 dark:border-white/10 dark:text-slate-300 font-medium', text: 'text-slate-700', dot: 'bg-slate-500' },
};

export const TasksView: React.FC = () => {
  const { profile, user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>(() => getCachedTasks());
  const [clients, setClients] = useState<any[]>(DEFAULT_CLIENTS_MASTER);
  const [employees, setEmployees] = useState<any[]>(DEFAULT_EMPLOYEES_LIST);
  const [loading, setLoading] = useState(false);

  // View state: 5 tabs
  const [view, setView] = useState<'kanban' | 'assignment' | 'calendar' | 'my-tasks' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'tomorrow' | 'week' | 'overdue' | 'carried_forward'>('all');

  // Mini Calendar Selection & Toggle State (Enabled by default on desktop)
  const [selectedMiniDate, setSelectedMiniDate] = useState<string | null>(null);
  const [showMiniCalendar, setShowMiniCalendar] = useState(true);

  // Active Employee and View-As Context (Shared across Agency OS)
  const {
    activeEmployee,
    resolvedEmployeeId,
    activeEmployeeName,
    activeEmployeeRole,
    isViewAs,
    isAdmin,
    employees: canonicalEmployees,
    setViewAsEmployee
  } = useActiveEmployee();

  // Modals & Drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDefaultColumn, setCreateDefaultColumn] = useState<KanbanColumnKey>('To Do');
  const [createDefaultAssigneeId, setCreateDefaultAssigneeId] = useState<string>('');
  const [createDefaultDate, setCreateDefaultDate] = useState<string | undefined>(undefined);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Bulk Selection State
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkRescheduleDate, setBulkRescheduleDate] = useState<string>('');
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Drag-and-drop dragging state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Load clients and employees with live listeners
  useEffect(() => {
    ensureCentralClientsSeeded();

    const unsubClients = onSnapshot(collection(db, 'clients'), snap => {
      if (!snap.empty) {
        const loaded = snap.docs.map(d => ({ id: d.id, clientId: d.id, ...d.data() }));
        setClients(loaded);
      } else {
        setClients(DEFAULT_CLIENTS_MASTER);
      }
    }, err => {
      console.warn('Clients sync notice:', err);
      setClients(DEFAULT_CLIENTS_MASTER);
    });

    const unsubEmployees = onSnapshot(collection(db, 'employees'), snap => {
      if (!snap.empty) {
        const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setEmployees(loaded);
      } else {
        setEmployees(DEFAULT_EMPLOYEES_LIST);
      }
    }, err => {
      console.warn('Employees sync notice:', err);
      setEmployees(DEFAULT_EMPLOYEES_LIST);
    });

    return () => {
      unsubClients();
      unsubEmployees();
    };
  }, []);

  // Canonical Real-time Tasks Listener with persistence and hydration
  useEffect(() => {
    const unsub = subscribeToCanonicalTasks((updatedList) => {
      setTasks(updatedList);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Show temporary toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ─── Unified Status Transition Handler ──────────────────────────────
  const handleStatusChange = useCallback(async (
    taskId: string, 
    targetStatus: KanbanColumnKey, 
    source: 'drag_drop' | 'left_arrow' | 'right_arrow' | 'status_dropdown' | 'bulk_action' | 'calendar_action' = 'status_dropdown'
  ) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t,
      status: targetStatus,
      updatedAt: new Date().toISOString(),
      ...(targetStatus === 'Done' ? { completedAt: new Date().toISOString() } : {})
    } : t));

    if (selectedTask?.id === taskId) {
      setSelectedTask(prev => prev ? {
        ...prev,
        status: targetStatus,
        ...(targetStatus === 'Done' ? { completedAt: new Date().toISOString() } : {})
      } : null);
    }

    const res = await transitionTaskStatus(taskId, targetStatus, source, {
      uid: user?.uid,
      name: profile?.name,
      role: profile?.role
    });

    if (res.success) {
      triggerToast(res.message);
    } else {
      triggerToast('Status update error — rolling back');
      setTasks(getCachedTasks());
    }
  }, [tasks, selectedTask, profile, user]);

  // ─── Reschedule Single Task (from Calendar / Drawer) ─────────────────
  const handleReschedule = useCallback(async (taskId: string, newDate: string) => {
    const target = tasks.find(t => t.id === taskId);
    if (!target) return;

    const saved = await persistUpdateTask(taskId, {
      scheduledDate: newDate,
      scheduled_date: newDate,
    }, { uid: user?.uid, name: profile?.name });

    if (saved) {
      setTasks(prev => prev.map(t => t.id === taskId ? saved : t));
      triggerToast(`Rescheduled to ${newDate}`);
    }
  }, [tasks, profile, user]);

  // ─── Bulk Reschedule Handler ─────────────────────────────────────────
  const handleExecuteBulkReschedule = async () => {
    if (selectedTaskIds.size === 0 || !bulkRescheduleDate) return;
    setBulkProcessing(true);
    try {
      const count = await bulkRescheduleTasks(
        Array.from(selectedTaskIds), 
        bulkRescheduleDate, 
        { uid: user?.uid, name: profile?.name }
      );
      setTasks(getCachedTasks());
      setSelectedTaskIds(new Set());
      setBulkRescheduleDate('');
      triggerToast(`✓ Rescheduled ${count} task${count === 1 ? '' : 's'} to ${bulkRescheduleDate}`);
    } catch (e) {
      console.error('Bulk reschedule error:', e);
      triggerToast('Bulk reschedule failed');
    } finally {
      setBulkProcessing(false);
    }
  };

  const toggleSelectTask = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTaskIds.size === filteredTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
    }
  };

  // ─── Drag-and-Drop Handlers ──────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    if (dragOverColumn !== colKey) {
      setDragOverColumn(colKey);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetCol: KanbanColumnKey) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);
    if (taskId) {
      handleStatusChange(taskId, targetCol, 'drag_drop');
    }
  };

  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (!window.confirm('Archive this task?')) return;
    try {
      await persistDeleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      triggerToast('Task archived');
    } catch (err) {
      console.error('Delete task error:', err);
    }
  }, []);

  // Filter computation
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.status === 'Cancelled' || t.isArchived) return false;
      if (view === 'my-tasks') {
        const isMine = isTaskAssignedToEmployee(t, activeEmployee || resolvedEmployeeId);
        if (!isMine) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const matchesTitle = t.title?.toLowerCase().includes(q);
        const matchesClient = t.clientName?.toLowerCase().includes(q);
        const matchesAssignee = t.assigneeName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesClient && !matchesAssignee) return false;
      }
      if (filterAssignee && t.assigneeId !== filterAssignee && t.assigneeName !== filterAssignee) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterCategory && t.category !== filterCategory) return false;
      if (filterClient && t.clientId !== filterClient && t.clientName !== filterClient) return false;

      // Mini Calendar Direct Date Filtering
      const schDate = (t.scheduledDate || t.scheduled_date || todayStr).slice(0, 10);
      const dueDate = (t.dueDate || t.due_date || schDate).slice(0, 10);
      const normStatus = normalizeTaskStatus(t.status);
      const isDone = normStatus === 'Done';

      if (selectedMiniDate) {
        if (schDate !== selectedMiniDate.slice(0, 10)) return false;
      }

      // Date Filters Toolbar
      if (dateFilter === 'today') {
        const isToday = schDate === todayStr || (normStatus !== 'Done' && (t.rolloverCount || 0) > 0);
        if (!isToday) return false;
      } else if (dateFilter === 'tomorrow') {
        const isTmrw = differenceInCalendarDays(schDate, todayStr) === 1;
        if (!isTmrw) return false;
      } else if (dateFilter === 'week') {
        const diff = differenceInCalendarDays(schDate, todayStr);
        if (diff < 0 || diff > 7) return false;
      } else if (dateFilter === 'overdue') {
        if (isDone || !dueDate || dueDate >= todayStr) return false;
      } else if (dateFilter === 'carried_forward') {
        if ((t.rolloverCount || 0) === 0 && (!t.originalScheduledDate || t.originalScheduledDate >= schDate)) return false;
      }

      return true;
    });
  }, [tasks, search, filterAssignee, filterPriority, filterCategory, filterClient, dateFilter, selectedMiniDate, view, activeEmployee, resolvedEmployeeId, todayStr]);

  // Mandatory Debugging Logs
  useEffect(() => {
    console.log('[AgencyOS Tasks Debug] currentUser.uid:', user?.uid);
    console.log('[AgencyOS Tasks Debug] user.email:', user?.email, 'profile.role:', profile?.role);
    console.log('[AgencyOS Tasks Debug] resolved employee_id:', resolvedEmployeeId, 'name:', activeEmployeeName, 'isViewAs:', isViewAs);
    console.log('[AgencyOS Tasks Debug] total canonical tasks loaded:', tasks.length);
    const myAssignedTasks = tasks.filter(t => isTaskAssignedToEmployee(t, activeEmployee || resolvedEmployeeId));
    console.log('[AgencyOS Tasks Debug] tasks assigned to active employee:', myAssignedTasks.length);
    if (view === 'my-tasks') {
      console.log('[AgencyOS Tasks Debug] My Tasks IDs:', filteredTasks.map(t => t.id));
    }
  }, [user, profile, resolvedEmployeeId, activeEmployee, activeEmployeeName, isViewAs, tasks, view, filteredTasks]);

  // Overall Task Progress
  const totalActiveCount = filteredTasks.length;
  const completedCount = filteredTasks.filter(t => normalizeTaskStatus(t.status) === 'Done').length;
  const progressPercent = totalActiveCount > 0 ? Math.round((completedCount / totalActiveCount) * 100) : 0;

  // Counts for quick date filter pills
  const dateCounts = useMemo(() => {
    const todayCount = tasks.filter(t => (t.scheduledDate === todayStr || (normalizeTaskStatus(t.status) !== 'Done' && (t.rolloverCount || 0) > 0)) && !t.isArchived).length;
    const overdueCount = tasks.filter(t => normalizeTaskStatus(t.status) !== 'Done' && t.dueDate && t.dueDate < todayStr && !t.isArchived).length;
    const carriedCount = tasks.filter(t => normalizeTaskStatus(t.status) !== 'Done' && (t.rolloverCount || 0) > 0 && !t.isArchived).length;
    return { todayCount, overdueCount, carriedCount };
  }, [tasks, todayStr]);

  return (
    <div className="space-y-4 pb-20 font-sans text-[#101828] dark:text-[#F7F8FC]">

      {/* ─── TOAST NOTIFICATION ────────────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#101828] dark:bg-[#161B31] text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/10 text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-bottom-5 backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── 1. WORKSPACE HEADER & VIEW NAVIGATION ─────────────────────── */}
      <header className="bg-white dark:bg-[#111728] border border-[#D7DEE9] dark:border-[#293248] rounded-2xl p-4 md:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-[#EEECFF] text-[#5B4BFF] dark:bg-[#201D45] dark:text-[#806CFF] border border-[#5B4BFF]/25 tracking-wide">
                <Kanban className="w-3.5 h-3.5" />
                Delivery & Operations Board
              </span>
              <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] tracking-wider uppercase">
                Agency OS Workflow
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#101828] dark:text-[#F7F8FC]">
                Tasks & Work Operations
              </h1>

              {/* Progress indicator pill */}
              <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-[#F8FAFC] dark:bg-[#171E31] border border-[#D7DEE9] dark:border-[#293248] rounded-xl text-xs font-bold shadow-2xs">
                <span className="text-[#334155] dark:text-[#CBD5E1]">{completedCount} of {totalActiveCount} done</span>
                <span className="text-[#94A3B8]">·</span>
                <span className="text-[#5B4BFF] dark:text-[#806CFF] font-black">{progressPercent}%</span>
                <div className="w-20 h-2 bg-[#E2E8F0] dark:bg-[#293248] rounded-full overflow-hidden ml-0.5">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Actions: View Switcher + Mini Calendar Toggle + Settings + New Task */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* View Switcher Tabs with generous padding */}
            <div className="inline-flex bg-[#F8FAFC] dark:bg-[#171E31] p-1 rounded-xl border border-[#D7DEE9] dark:border-[#293248] overflow-x-auto shadow-2xs">
              <button
                onClick={() => setView('kanban')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  view === 'kanban'
                    ? 'bg-white dark:bg-[#111728] text-[#5B4BFF] dark:text-[#806CFF] shadow-xs border border-[#D7DEE9] dark:border-[#293248]'
                    : 'text-[#475467] dark:text-[#BAC1D1] hover:text-[#101828] dark:hover:text-white'
                }`}
              >
                <Kanban className="w-4 h-4" />
                <span>Delivery Board</span>
              </button>

              <button
                onClick={() => setView('assignment')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  view === 'assignment'
                    ? 'bg-white dark:bg-[#111728] text-[#5B4BFF] dark:text-[#806CFF] shadow-xs border border-[#D7DEE9] dark:border-[#293248]'
                    : 'text-[#475467] dark:text-[#BAC1D1] hover:text-[#101828] dark:hover:text-white'
                }`}
              >
                <Users className="w-4 h-4 text-[#2864FF]" />
                <span>Assignment Board</span>
              </button>

              <button
                onClick={() => setView('my-tasks')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  view === 'my-tasks'
                    ? 'bg-white dark:bg-[#111728] text-[#5B4BFF] dark:text-[#806CFF] shadow-xs border border-[#D7DEE9] dark:border-[#293248]'
                    : 'text-[#475467] dark:text-[#BAC1D1] hover:text-[#101828] dark:hover:text-white'
                }`}
              >
                <User className="w-4 h-4" />
                <span>My Tasks</span>
              </button>

              <button
                onClick={() => setView('calendar')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  view === 'calendar'
                    ? 'bg-white dark:bg-[#111728] text-[#5B4BFF] dark:text-[#806CFF] shadow-xs border border-[#D7DEE9] dark:border-[#293248]'
                    : 'text-[#475467] dark:text-[#BAC1D1] hover:text-[#101828] dark:hover:text-white'
                }`}
              >
                <CalendarDays className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Schedule Calendar</span>
              </button>

              <button
                onClick={() => setView('list')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  view === 'list'
                    ? 'bg-white dark:bg-[#111728] text-[#5B4BFF] dark:text-[#806CFF] shadow-xs border border-[#D7DEE9] dark:border-[#293248]'
                    : 'text-[#475467] dark:text-[#BAC1D1] hover:text-[#101828] dark:hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
                <span>List</span>
              </button>
            </div>

            {/* Mini Calendar Toggle Button */}
            <button
              onClick={() => setShowMiniCalendar(!showMiniCalendar)}
              className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs ${
                showMiniCalendar || selectedMiniDate
                  ? 'bg-[#EEECFF] dark:bg-[#201D45] text-[#5B4BFF] dark:text-[#806CFF] border-[#5B4BFF]/40'
                  : 'bg-[#F8FAFC] dark:bg-[#171E31] border-[#D7DEE9] dark:border-[#293248] text-[#475467] dark:text-[#BAC1D1] hover:text-[#101828] dark:hover:text-white'
              }`}
              title="Toggle Mini Calendar Date Navigator"
            >
              <CalendarIcon className="w-4 h-4 text-[#5B4BFF] dark:text-[#806CFF]" />
              <span>Mini Calendar</span>
              {selectedMiniDate && (
                <span className="w-2 h-2 rounded-full bg-[#5B4BFF] animate-pulse" />
              )}
            </button>

            {isAdmin && (
              <button
                onClick={() => setShowSettingsModal(true)}
                title="Rollover & Working Day Settings"
                className="p-2.5 rounded-xl border border-[#D7DEE9] dark:border-[#293248] text-[#475467] dark:text-[#BAC1D1] hover:bg-[#F8FAFC] dark:hover:bg-[#171E31] transition-all cursor-pointer shadow-2xs"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => {
                setCreateDefaultColumn('To Do');
                setCreateDefaultAssigneeId('');
                setCreateDefaultDate(selectedMiniDate || todayStr);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#5B4BFF] hover:bg-[#4E3FE6] dark:bg-[#806CFF] dark:hover:bg-[#725DEF] text-white text-xs font-black rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer tracking-wide"
            >
              <Plus className="w-4 h-4" />
              <span>+ New Task</span>
            </button>
          </div>
        </div>

        {/* ─── DATE FILTER CHIPS & SEARCH TOOLBAR ──────────────────────── */}
        <div className="pt-3.5 border-t border-[#D7DEE9]/60 dark:border-[#293248] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#7A8496] mr-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Date Filter:
            </span>
            {[
              { key: 'all', label: 'All Dates', count: tasks.length },
              { key: 'today', label: 'Today’s Work', count: dateCounts.todayCount, accent: 'text-blue-600 dark:text-blue-400' },
              { key: 'tomorrow', label: 'Tomorrow', count: null },
              { key: 'week', label: 'This Week', count: null },
              { key: 'overdue', label: 'Overdue', count: dateCounts.overdueCount, accent: 'text-rose-600 dark:text-rose-400' },
              { key: 'carried_forward', label: 'Carried Forward', count: dateCounts.carriedCount, accent: 'text-amber-600 dark:text-amber-400' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => {
                  setDateFilter(f.key as any);
                  setSelectedMiniDate(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  dateFilter === f.key && !selectedMiniDate
                    ? 'bg-[#5B4BFF] text-white shadow-2xs'
                    : 'bg-[#F8FAFC] dark:bg-[#161B31] text-[#475467] dark:text-[#BAC1D1] hover:bg-[#EEECFF] hover:text-[#5B4BFF] border border-[#D7DEE9] dark:border-[#293248]'
                }`}
              >
                <span>{f.label}</span>
                {f.count !== null && f.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    dateFilter === f.key && !selectedMiniDate ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 ' + (f.accent || 'text-[#475467]')
                  }`}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}

            {selectedMiniDate && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#EEECFF] dark:bg-[#201D45] text-[#5B4BFF] dark:text-[#806CFF] border border-[#5B4BFF]/40 rounded-xl text-xs font-bold">
                <span>Focused: {selectedMiniDate}</span>
                <button 
                  onClick={() => setSelectedMiniDate(null)}
                  className="p-0.5 hover:bg-rose-100 rounded text-rose-600 cursor-pointer"
                  title="Clear Date Focus"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3 py-1.5 shadow-2xs">
              <Search className="w-3.5 h-3.5 text-[#7A8496]" />
              <input
                type="text"
                placeholder="Search tasks, clients…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-xs text-[#101828] dark:text-[#F7F8FC] outline-none w-36 sm:w-48 font-medium"
              />
              {search && <button onClick={() => setSearch('')} className="text-[#98A2B3] text-xs">✕</button>}
            </div>

            <select
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
              className="bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#344054] dark:text-[#AEB3C5] outline-none cursor-pointer shadow-2xs"
            >
              <option value="">All Clients</option>
              {clients.map(c => (
                <option key={c.id || c.clientId} value={c.id || c.clientId}>
                  {c.clientName || c.name || 'Client'}
                </option>
              ))}
            </select>

            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#344054] dark:text-[#AEB3C5] outline-none cursor-pointer shadow-2xs"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </header>

      {/* ─── BULK RESCHEDULE TOOLBAR (Super Admin) ──────────────────────── */}
      {selectedTaskIds.size > 0 && (
        <div className="bg-[#5B4BFF] text-white p-3.5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-3">
          <div className="flex items-center gap-3">
            <span className="font-black text-xs px-3 py-1 bg-white/20 rounded-lg">
              {selectedTaskIds.size} Task{selectedTaskIds.size === 1 ? '' : 's'} Selected
            </span>
            <span className="text-xs font-semibold opacity-90 hidden sm:inline">
              Bulk Reschedule Scheduled Work Date
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white text-[#101828] rounded-xl px-2.5 py-1.5 shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-[#5B4BFF]" />
              <input
                type="date"
                value={bulkRescheduleDate}
                onChange={e => setBulkRescheduleDate(e.target.value)}
                className="text-xs font-bold outline-none bg-transparent"
              />
            </div>

            <button
              onClick={() => setBulkRescheduleDate(todayStr)}
              className="px-2.5 py-1 text-xs font-bold bg-white/15 hover:bg-white/25 rounded-lg transition-all cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={() => {
                const tmrw = new Date();
                tmrw.setDate(tmrw.getDate() + 1);
                setBulkRescheduleDate(tmrw.toISOString().split('T')[0]);
              }}
              className="px-2.5 py-1 text-xs font-bold bg-white/15 hover:bg-white/25 rounded-lg transition-all cursor-pointer"
            >
              Tomorrow
            </button>

            <button
              disabled={bulkProcessing || !bulkRescheduleDate}
              onClick={handleExecuteBulkReschedule}
              className="px-4 py-2 bg-white text-[#5B4BFF] hover:bg-slate-100 disabled:opacity-50 text-xs font-black rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {bulkProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
              <span>Apply Reschedule</span>
            </button>

            <button
              onClick={() => setSelectedTaskIds(new Set())}
              className="p-1 hover:bg-white/20 rounded-lg text-white/80 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── 2. ACTIVE VIEW RENDER: TWO-COLUMN APPLICATION GRID (MAIN BOARD + STICKY MINI CALENDAR) ─── */}
      <div className={`w-full gap-4 ${
        view !== 'calendar' && showMiniCalendar
          ? 'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] items-start'
          : 'flex flex-col'
      }`}>
        
        {/* Main Board Container - min-w-0 ensures no grid blowout from horizontal scrollable boards */}
        <div className="min-w-0 w-full space-y-4">
          {view === 'calendar' ? (
            /* DATE-BASED TASK SCHEDULE CALENDAR */
            <TaskScheduleCalendar
              tasks={filteredTasks}
              onSelectTask={setSelectedTask}
              onOpenCreateTask={dateStr => {
                setCreateDefaultColumn('To Do');
                setCreateDefaultDate(dateStr || todayStr);
                setShowCreateModal(true);
              }}
              onStatusChange={handleStatusChange}
              onRescheduleTask={handleReschedule}
            />
          ) : view === 'assignment' ? (
            /* SUPER ADMIN ASSIGNMENT BOARD */
            <AssignmentBoard
              tasks={filteredTasks}
              employees={employees}
              clients={clients}
              onSelectTask={setSelectedTask}
              onOpenCreateTask={empId => {
                setCreateDefaultAssigneeId(empId || '');
                setCreateDefaultDate(selectedMiniDate || todayStr);
                setShowCreateModal(true);
              }}
              onUpdateTask={(taskId, targetEmpId, targetEmpName) => {
                setTasks(prev => prev.map(t => t.id === taskId ? {
                  ...t,
                  assigneeId: targetEmpId,
                  assigned_employee_id: targetEmpId,
                  assigneeName: targetEmpName || 'Unassigned',
                  updatedAt: new Date().toISOString()
                } : t));
              }}
            />
          ) : view === 'kanban' || view === 'my-tasks' ? (
            /* ─── 3. REFINED KANBAN BOARD VIEW ────────────────────────────── */
            <div className="space-y-4">
              {view === 'my-tasks' && (
                <div className={`${
                  isViewAs 
                    ? 'bg-[#EEECFF]/50 dark:bg-[#1E1940] border-2 border-[#5B4BFF]/40' 
                    : 'bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10'
                } rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                      isViewAs ? 'bg-[#5B4BFF] text-white' : 'bg-[#EEECFF] dark:bg-[#201D45] text-[#5B4BFF] dark:text-[#806CFF]'
                    }`}>
                      {isViewAs ? <User className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {isViewAs ? (
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#5B4BFF] text-white">
                            Super Admin View-As
                          </span>
                        ) : (
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                            My Workspace
                          </span>
                        )}
                        <h2 className="text-sm font-black text-[#101828] dark:text-white">
                          {isViewAs ? `Viewing as: ${activeEmployeeName}` : 'My Super Admin Tasks'}
                        </h2>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                          {activeEmployeeRole}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-[#7A8496]">
                          ID: {resolvedEmployeeId}
                        </span>
                      </div>
                      <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                        {isViewAs
                          ? `Showing tasks assigned to ${activeEmployeeName} · ${filteredTasks.length} task${filteredTasks.length === 1 ? '' : 's'} in view`
                          : `Your personal workspace — ${filteredTasks.length} task${filteredTasks.length === 1 ? '' : 's'} assigned to you`
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {isAdmin && (
                      <>
                        <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">Switch Member:</span>
                        <select
                          value={resolvedEmployeeId}
                          onChange={e => setViewAsEmployee(e.target.value)}
                          className="bg-white dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-[#101828] dark:text-[#F7F8FC] outline-none cursor-pointer shadow-2xs"
                        >
                          {/* My Super Admin Workspace is always the first option */}
                          <option value="emp_superadmin" className="bg-white dark:bg-[#161B31] text-[#101828] dark:text-white">
                            👑 My Super Admin Workspace
                          </option>
                          {canonicalEmployees
                            .filter(e => (e.id || e.employeeId) !== 'emp_superadmin')
                            .map(e => (
                              <option key={e.id || e.employeeId} value={e.id || e.employeeId} className="bg-white dark:bg-[#161B31] text-[#101828] dark:text-white">
                                {e.name} ({e.role || 'Member'})
                              </option>
                            ))
                          }
                        </select>
                      </>
                    )}

                    <button
                      onClick={() => {
                        setCreateDefaultColumn('To Do');
                        setCreateDefaultAssigneeId(resolvedEmployeeId);
                        setCreateDefaultDate(todayStr);
                        setShowCreateModal(true);
                      }}
                      className="px-3 py-1.5 text-xs font-black bg-[#5B4BFF] hover:bg-[#4E3FE6] text-white rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isViewAs ? `+ New Task for ${activeEmployeeName.split(' ')[0]}` : '+ New Task'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4 min-h-[580px]">
              {KANBAN_COLUMNS.map(col => {
                const colTasks = filteredTasks.filter(t => normalizeTaskStatus(t.status) === col.key);
                const isDragTarget = dragOverColumn === col.key;

                return (
                  <div
                    key={col.key}
                    onDragOver={e => handleDragOver(e, col.key)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, col.key)}
                    className={`bg-[#F8FAFC] dark:bg-[#11152D] border rounded-2xl p-4 flex flex-col justify-between min-h-[560px] shadow-xs transition-all ${
                      isDragTarget 
                        ? 'border-[#5B4BFF] ring-2 ring-[#5B4BFF]/20 bg-[#EEECFF]/30 dark:bg-[#5B4BFF]/10' 
                        : 'border-[#D8DEE9] dark:border-white/10'
                    }`}
                  >
                    <div>
                      {/* Column Header with clean count pill */}
                      <div className="flex items-center justify-between pb-3.5 border-b border-[#D8DEE9] dark:border-white/10 mb-3.5">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shadow-2xs" style={{ backgroundColor: col.color }} />
                          <h3 className="text-xs font-black text-[#101828] dark:text-white uppercase tracking-wider">
                            {col.label}
                          </h3>
                          <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-white dark:bg-white/10 border border-[#D8DEE9] dark:border-white/10 text-[#475467] dark:text-[#CBD5E1] shadow-2xs">
                            {colTasks.length}
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            setCreateDefaultColumn(col.key);
                            setCreateDefaultDate(selectedMiniDate || todayStr);
                            setShowCreateModal(true);
                          }}
                          title={`Add task to ${col.label}`}
                          className="p-1.5 rounded-lg text-[#64748B] hover:text-[#101828] dark:hover:text-white hover:bg-white dark:hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Task Cards Container with Refined Spacing */}
                      <div className="space-y-3">
                        {colTasks.length === 0 ? (
                          <div className="py-12 text-center border-2 border-dashed border-[#D8DEE9] dark:border-white/10 rounded-2xl p-4 text-xs text-[#64748B] bg-white/60 dark:bg-white/5 flex flex-col items-center justify-center space-y-2">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-400">
                              <CheckSquare className="w-4 h-4" />
                            </div>
                            <p className="font-bold text-[#334155] dark:text-[#CBD5E1]">No tasks in {col.label}</p>
                            <button
                              onClick={() => {
                                setCreateDefaultColumn(col.key);
                                setCreateDefaultDate(selectedMiniDate || todayStr);
                                setShowCreateModal(true);
                              }}
                              className="px-3 py-1 text-[11px] font-black text-[#5B4BFF] dark:text-[#806CFF] bg-[#EEECFF] dark:bg-[#201D45] rounded-lg hover:bg-[#5B4BFF] hover:text-white transition-all cursor-pointer"
                            >
                              + Add Task
                            </button>
                          </div>
                        ) : (
                          colTasks.map(task => {
                            const pStyle = priorityStyles[task.priority] || priorityStyles.Medium;
                            const ageing = getTaskAgeingInfo(task, todayStr);
                            const prevStatus = getPrevWorkflowStatus(task.status);
                            const nextStatus = getNextWorkflowStatus(task.status);
                            const isSelected = selectedTaskIds.has(task.id);

                            return (
                              <div
                                key={task.id}
                                draggable
                                onDragStart={e => handleDragStart(e, task.id)}
                                onClick={() => setSelectedTask(task)}
                                className={`bg-white dark:bg-[#161B31] border ${
                                  isSelected 
                                    ? 'ring-2 ring-[#5B4BFF] border-[#5B4BFF] shadow-md' 
                                    : 'border-[#D8DEE9] dark:border-white/10'
                                } hover:border-[#5B4BFF] dark:hover:border-[#806CFF] rounded-2xl p-4 shadow-xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative space-y-3`}
                              >
                                {/* 1. Top Metadata Row: Client Pill + Priority Badge + Checkbox */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 truncate max-w-[190px]">
                                    {isAdmin && (
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          toggleSelectTask(task.id);
                                        }}
                                        onClick={e => e.stopPropagation()}
                                        className="w-4 h-4 rounded text-[#5B4BFF] cursor-pointer"
                                      />
                                    )}
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#EEECFF] text-[#5B4BFF] dark:bg-[#201D45] dark:text-[#806CFF] uppercase tracking-wider truncate">
                                      {task.clientName || 'General'}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${pStyle.badge}`}>
                                      {task.priority}
                                    </span>
                                  </div>
                                </div>

                                {/* 2. Main Title & Description */}
                                <div>
                                  <h4 className={`text-xs md:text-sm font-bold leading-snug group-hover:text-[#5B4BFF] dark:group-hover:text-[#806CFF] transition-colors ${
                                    col.key === 'Done' ? 'text-[#64748B] line-through' : 'text-[#101828] dark:text-white'
                                  }`}>
                                    {task.title}
                                  </h4>
                                  {task.description && (
                                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] line-clamp-2 mt-1 font-medium leading-relaxed">
                                      {task.description}
                                    </p>
                                  )}

                                  {/* Linked Video Production Tags */}
                                  {(task.blockedByShoot || task.videoProductionId || task.videoTrackerId) && (
                                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                      {task.blockedByShoot && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                                          <Clock className="w-2.5 h-2.5" /> Waiting for Shoot
                                        </span>
                                      )}
                                      {(task.videoProductionId || task.videoTrackerId) && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300">
                                          <Film className="w-2.5 h-2.5" /> Video {task.productionRole === 'shoot' ? 'Shoot' : task.productionRole === 'edit' ? 'Edit' : 'Production'}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* 3. Badges Row: Overdue, Pending Age, Carried Forward */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                  {ageing.overdueBadge && col.key !== 'Done' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-600 text-white shadow-2xs">
                                      <AlertCircle className="w-3 h-3" />
                                      {ageing.overdueBadge}
                                    </span>
                                  )}

                                  {ageing.pendingDays > 0 && col.key !== 'Done' && (
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${ageing.pendingColorClass}`}>
                                      <Clock className="w-3 h-3" />
                                      {ageing.pendingBadge}
                                    </span>
                                  )}

                                  {ageing.rolloverBadge && col.key !== 'Done' && (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                                      <RotateCcw className="w-2.5 h-2.5" />
                                      {ageing.rolloverBadge}
                                    </span>
                                  )}
                                </div>

                                {/* 4. Context Row: Assignee + Date Info */}
                                <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[#D8DEE9]/60 dark:border-white/10 text-[11px]">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-[#5B4BFF]/10 text-[#5B4BFF] dark:text-[#806CFF] font-black text-[10px] flex items-center justify-center shadow-2xs">
                                      {(task.assigneeName || 'T').charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-bold text-[#334155] dark:text-[#CBD5E1] truncate max-w-[95px]">
                                      {task.assigneeName || 'Unassigned'}
                                    </span>
                                  </div>

                                  <div className="text-right flex flex-col items-end">
                                    <span className="font-bold text-[#334155] dark:text-[#E2E8F0] text-[10px]">
                                      Work: {ageing.scheduledBadge}
                                    </span>
                                    {task.dueDate && task.dueDate !== task.scheduledDate && (
                                      <span className={`text-[9px] font-bold ${
                                        ageing.isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-[#64748B] dark:text-[#94A3B8]'
                                      }`}>
                                        Due: {task.dueDate}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* 5. Action Footer Row: Bigger Workflow Arrows + Dropdown + Done Button */}
                                <div 
                                  className="pt-2.5 border-t border-[#D8DEE9]/60 dark:border-white/10 flex items-center justify-between gap-1.5"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {/* Larger Left / Right Workflow Buttons */}
                                  <div className="flex items-center gap-1 bg-[#F8FAFC] dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-1 shadow-2xs">
                                    <button
                                      type="button"
                                      disabled={!prevStatus}
                                      onClick={() => prevStatus && handleStatusChange(task.id, prevStatus, 'left_arrow')}
                                      title={prevStatus ? `Move backward to "${prevStatus}"` : 'Already in To Do'}
                                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#334155] dark:text-[#CBD5E1] hover:bg-white dark:hover:bg-white/10 hover:text-[#5B4BFF] disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                                    >
                                      <ArrowLeft className="w-4 h-4" />
                                    </button>

                                    <select
                                      value={normalizeTaskStatus(task.status)}
                                      onChange={e => handleStatusChange(task.id, e.target.value as KanbanColumnKey, 'status_dropdown')}
                                      className="text-[10px] font-black bg-transparent text-[#334155] dark:text-[#CBD5E1] outline-none cursor-pointer px-1.5 py-1"
                                    >
                                      {KANBAN_COLUMNS.map(c => (
                                        <option key={c.key} value={c.key} className="bg-white dark:bg-[#11152D] text-[#101828] dark:text-white">
                                          {c.label}
                                        </option>
                                      ))}
                                    </select>

                                    <button
                                      type="button"
                                      disabled={!nextStatus}
                                      onClick={() => nextStatus && handleStatusChange(task.id, nextStatus, 'right_arrow')}
                                      title={nextStatus ? `Advance to "${nextStatus}"` : 'Already Done'}
                                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#334155] dark:text-[#CBD5E1] hover:bg-white dark:hover:bg-white/10 hover:text-[#5B4BFF] disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                                    >
                                      <ArrowRight className="w-4 h-4" />
                                    </button>
                                  </div>

                                  {col.key !== 'Done' ? (
                                    <button
                                      onClick={() => handleStatusChange(task.id, 'Done', 'right_arrow')}
                                      className="px-3.5 py-1.5 bg-[#ECFDF3] hover:bg-[#16A34A] text-[#15803D] hover:text-white border border-[#BBF7D0] rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs hover:shadow-xs"
                                    >
                                      <Check className="w-3.5 h-3.5" /> Done
                                    </button>
                                  ) : (
                                    <span className="text-xs font-bold text-[#16A34A] flex items-center gap-1 px-2 py-1 bg-[#ECFDF3] dark:bg-[#16A34A]/10 rounded-lg">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Synced
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setCreateDefaultColumn(col.key);
                        setCreateDefaultDate(selectedMiniDate || todayStr);
                        setShowCreateModal(true);
                      }}
                      className="w-full mt-4 py-2 bg-white dark:bg-white/5 hover:bg-[#F1F5F9] text-[#475467] dark:text-[#BAC1D1] text-xs font-black rounded-xl border border-[#D8DEE9] dark:border-white/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-4 h-4" /> Add Task
                    </button>
                  </div>
                );
              })}
            </div>
            </div>
          ) : (
            /* ─── 4. REFINED LIST VIEW ────────────────────────────────────── */
            <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl p-4 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#D8DEE9] dark:border-white/10 text-[10px] font-black text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                      <th className="pb-3 pl-3">
                        {isAdmin && (
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.size === filteredTasks.length && filteredTasks.length > 0}
                            onChange={toggleSelectAll}
                            className="rounded text-[#5B4BFF] cursor-pointer mr-2.5 w-4 h-4"
                          />
                        )}
                        Task Title & Context
                      </th>
                      <th className="pb-3">Client</th>
                      <th className="pb-3">Assignee</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Priority</th>
                      <th className="pb-3">Scheduled Work</th>
                      <th className="pb-3">Deadline</th>
                      <th className="pb-3">Ageing</th>
                      <th className="pb-3 text-center">Workflow</th>
                      <th className="pb-3 text-right pr-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8DEE9]/60 dark:divide-white/5">
                    {filteredTasks.map(task => {
                      const normStatus = normalizeTaskStatus(task.status);
                      const isDone = normStatus === 'Done';
                      const ageing = getTaskAgeingInfo(task, todayStr);
                      const prevStatus = getPrevWorkflowStatus(task.status);
                      const nextStatus = getNextWorkflowStatus(task.status);
                      const isSelected = selectedTaskIds.has(task.id);

                      return (
                        <tr
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className={`hover:bg-[#F8FAFC] dark:hover:bg-white/5 transition-colors cursor-pointer group ${
                            isSelected ? 'bg-[#EEECFF]/40 dark:bg-[#5B4BFF]/15' : ''
                          }`}
                        >
                          <td className="py-3.5 pl-3 max-w-[290px]">
                            <div className="flex items-center gap-2.5">
                              {isAdmin && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleSelectTask(task.id);
                                  }}
                                  onClick={e => e.stopPropagation()}
                                  className="rounded text-[#5B4BFF] cursor-pointer w-4 h-4"
                                />
                              )}
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  handleStatusChange(task.id, isDone ? 'To Do' : 'Done', 'status_dropdown');
                                }}
                                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                  isDone ? 'bg-[#16A34A] border-[#16A34A] text-white' : 'border-[#D8DEE9] hover:border-[#16A34A]'
                                }`}
                              >
                                {isDone && <Check className="w-3.5 h-3.5" />}
                              </button>
                              <div>
                                <span className={`font-bold truncate block ${isDone ? 'text-slate-400 line-through' : 'text-[#101828] dark:text-white'}`}>
                                  {task.title}
                                </span>
                                {(task.blockedByShoot || task.videoProductionId || task.videoTrackerId) && (
                                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                    {task.blockedByShoot && (
                                      <span className="inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                        <Clock className="w-2 h-2" /> Waiting for Shoot
                                      </span>
                                    )}
                                    {(task.videoProductionId || task.videoTrackerId) && (
                                      <span className="inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                        <Film className="w-2 h-2" /> Video {task.productionRole === 'shoot' ? 'Shoot' : 'Edit'}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 font-bold text-[#334155] dark:text-[#CBD5E1] truncate max-w-[130px]">{task.clientName || 'General'}</td>
                          <td className="py-3.5 text-[#475467] dark:text-[#94A3B8] font-medium truncate max-w-[110px]">{task.assigneeName || 'Unassigned'}</td>
                          <td className="py-3.5 font-semibold text-[#64748B] dark:text-[#94A3B8]">{task.category || '—'}</td>
                          <td className="py-3.5">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${priorityStyles[task.priority]?.badge || ''}`}>
                              {task.priority}
                            </span>
                          </td>
                          <td className="py-3.5 font-bold text-[#334155] dark:text-[#CBD5E1]">
                            {ageing.scheduledBadge}
                          </td>
                          <td className="py-3.5">
                            <span className={`font-bold ${ageing.isOverdue ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-[#64748B] dark:text-[#94A3B8]'}`}>
                              {task.dueDate || '—'}
                            </span>
                          </td>
                          <td className="py-3.5">
                            <div className="flex items-center gap-1 flex-wrap">
                              {ageing.overdueBadge ? (
                                <span className="text-[8px] font-black px-2 py-0.5 rounded bg-rose-600 text-white">
                                  {ageing.overdueBadge}
                                </span>
                              ) : ageing.pendingDays > 0 && !isDone ? (
                                <span className={`text-[8px] font-bold px-2 py-0.5 rounded border ${ageing.pendingColorClass}`}>
                                  {ageing.pendingBadge}
                                </span>
                              ) : (
                                <span className="text-[9px] text-[#94A3B8]">On Track</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 text-center" onClick={e => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1 bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-1">
                              <button
                                disabled={!prevStatus}
                                onClick={() => prevStatus && handleStatusChange(task.id, prevStatus, 'left_arrow')}
                                title={prevStatus ? `Move backward to ${prevStatus}` : 'Cannot move backward'}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-[#475467] hover:bg-white dark:hover:bg-white/10 disabled:opacity-20 cursor-pointer"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-[10px] font-black text-[#5B4BFF] dark:text-[#806CFF] px-2">
                                {normStatus}
                              </span>
                              <button
                                disabled={!nextStatus}
                                onClick={() => nextStatus && handleStatusChange(task.id, nextStatus, 'right_arrow')}
                                title={nextStatus ? `Advance to ${nextStatus}` : 'Already Done'}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-[#475467] hover:bg-white dark:hover:bg-white/10 disabled:opacity-20 cursor-pointer"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 text-right pr-3">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleStatusChange(task.id, isDone ? 'To Do' : 'Done', 'status_dropdown');
                              }}
                              className="px-3 py-1.5 text-xs font-black rounded-xl border border-[#D8DEE9] dark:border-white/10 hover:bg-[#5B4BFF] hover:text-white transition-all cursor-pointer shadow-2xs"
                            >
                              {isDone ? 'Reopen' : 'Mark Done'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ─── MINI CALENDAR WIDGET SIDEBAR (Sticky on Desktop) ─── */}
        {view !== 'calendar' && showMiniCalendar && (
          <aside className="w-full lg:w-[280px] shrink-0 sticky top-20 lg:top-24 self-start space-y-3 z-10 animate-in fade-in slide-in-from-right-3">
            <MiniCalendarWidget
              tasks={tasks}
              selectedDate={selectedMiniDate}
              onSelectDate={(dateStr) => {
                setSelectedMiniDate(dateStr);
                if (dateStr) {
                  triggerToast(`Focused tasks for ${dateStr}`);
                }
              }}
            />
          </aside>
        )}
      </div>

      {/* ─── CREATE TASK MODAL ─────────────────────────────────────────── */}
      {showCreateModal && (
        <CreateTaskModal
          clients={clients}
          employees={employees}
          defaultColumn={createDefaultColumn}
          defaultAssigneeId={createDefaultAssigneeId}
          defaultDate={createDefaultDate}
          profile={profile}
          user={user}
          onClose={() => setShowCreateModal(false)}
          onCreated={newTask => {
            setTasks(prev => [newTask, ...prev]);
            setShowCreateModal(false);
            triggerToast('✓ New deliverable task created');
          }}
        />
      )}

      {/* ─── TASK DETAIL DRAWER ───────────────────────────────────────── */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          employees={employees}
          isAdmin={isAdmin}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleStatusChange}
          onDelete={() => {
            handleDeleteTask(selectedTask.id);
            setSelectedTask(null);
          }}
          onSave={updated => {
            setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
            setSelectedTask(updated);
            triggerToast('Task details saved');
          }}
        />
      )}

      {/* ─── ROLLOVER SETTINGS MODAL ──────────────────────────────────── */}
      {showSettingsModal && (
        <RolloverSettingsModal
          onClose={() => setShowSettingsModal(false)}
          onSaved={() => {
            setShowSettingsModal(false);
            triggerToast('Rollover settings updated');
          }}
        />
      )}

    </div>
  );
};

// ─── CREATE TASK MODAL COMPONENT ──────────────────────────────────────
const CreateTaskModal: React.FC<{
  clients: any[];
  employees: any[];
  defaultColumn: KanbanColumnKey;
  defaultAssigneeId?: string;
  defaultDate?: string;
  profile: any;
  user: any;
  onClose: () => void;
  onCreated: (t: Task) => void;
}> = ({ clients, employees, defaultColumn, defaultAssigneeId, defaultDate, profile, user, onClose, onCreated }) => {
  const clientList = (clients && clients.length > 0) ? clients : DEFAULT_CLIENTS_MASTER;
  const employeeList = (employees && employees.length > 0) ? employees : DEFAULT_EMPLOYEES_LIST;
  const inputCls = 'w-full bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#101828] dark:text-[#F7F8FC] placeholder-[#98A2B3] outline-none focus:border-[#5B4BFF] focus:bg-white dark:focus:bg-[#1A203C] transition-all shadow-2xs';

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const initialWorkDate = defaultDate || todayStr;

  const [videoList, setVideoList] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('digi_video_tracker_cache');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  const [form, setForm] = useState({
    title: '',
    description: '',
    clientId: '',
    category: 'Graphic Design',
    assigneeId: defaultAssigneeId || '',
    priority: 'Medium' as 'Urgent' | 'High' | 'Medium' | 'Low',
    scheduledDate: initialWorkDate,
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    status: defaultColumn,
    internalNotes: '',
    videoProductionId: '',
  });
  const [saving, setSaving] = useState(false);

  const applyQuickDate = (type: 'today' | 'tomorrow' | 'nextWorking' | 'nextMonday') => {
    const d = new Date();
    if (type === 'today') {
      const ds = d.toISOString().split('T')[0];
      setForm(p => ({ ...p, scheduledDate: ds }));
    } else if (type === 'tomorrow') {
      d.setDate(d.getDate() + 1);
      const ds = d.toISOString().split('T')[0];
      setForm(p => ({ ...p, scheduledDate: ds }));
    } else if (type === 'nextWorking') {
      const nextW = getNextWorkingDate(d.toISOString().split('T')[0]);
      setForm(p => ({ ...p, scheduledDate: nextW }));
    } else if (type === 'nextMonday') {
      const day = d.getDay();
      const diff = (8 - day) % 7 || 7;
      d.setDate(d.getDate() + diff);
      const ds = d.toISOString().split('T')[0];
      setForm(p => ({ ...p, scheduledDate: ds }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);

    try {
      const client = clientList.find(c => (c.id || c.clientId) === form.clientId);
      const emp = employeeList.find(e => e.id === form.assigneeId);
      const nowIso = new Date().toISOString();

      const role = form.category === 'Video Shoot' ? 'shoot' : form.category === 'Video Editing' ? 'edit' : undefined;

      const newTaskData: Partial<Task> = {
        title: form.title.trim(),
        description: form.description.trim(),
        clientId: form.clientId,
        clientName: client?.clientName || client?.name || client?.businessName || (form.clientId ? 'Client' : 'Direct'),
        category: form.category,
        assigneeId: form.assigneeId,
        assigneeName: emp?.name || (form.assigneeId ? 'Assigned' : 'Unassigned'),
        assignedById: user?.uid || '',
        assignedByName: profile?.name || 'Super Admin',
        priority: form.priority,
        scheduledDate: form.scheduledDate,
        dueDate: form.dueDate,
        originalScheduledDate: form.scheduledDate,
        originalDueDate: form.dueDate,
        firstPendingSince: form.scheduledDate,
        rolloverCount: 0,
        status: form.status,
        internalNotes: form.internalNotes.trim(),
        videoProductionId: form.videoProductionId || undefined,
        videoTrackerId: form.videoProductionId || undefined,
        productionRole: role,
        blockedByShoot: form.category === 'Video Editing' && !!form.videoProductionId,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const savedTask = await persistNewTask(newTaskData, { uid: user?.uid, name: profile?.name });
      onCreated(savedTask);
    } catch (err) {
      console.error('Task creation error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-[#D8DEE9] dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#5B4BFF]/10 text-[#5B4BFF] flex items-center justify-center font-bold">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#101828] dark:text-white">Create Deliverable Task</h2>
              <p className="text-[11px] text-[#64748B]">Separate operational Scheduled Date & Final Due Date</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-[#7A8496] mb-1">
              Task Title *
            </label>
            <input
              required
              type="text"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Design 10 Figma Carousel Slides with Dark Aesthetic"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-[#7A8496] mb-1">
              Description & Deliverable Context
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Outline specific asset requirements, style references, or copy instructions…"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-[#7A8496] mb-1">Client / Brand</label>
              <select
                value={form.clientId}
                onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}
                className={`${inputCls} cursor-pointer font-bold`}
              >
                <option value="" className="bg-white dark:bg-[#161B31] text-[#101828] dark:text-white">Select client…</option>
                {clientList.map(c => {
                  const val = c.id || c.clientId;
                  const label = c.clientName || c.name || c.businessName || 'Client';
                  return (
                    <option key={val} value={val} className="bg-white dark:bg-[#161B31] text-[#101828] dark:text-white">
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-[#7A8496] mb-1">Assign Employee</label>
              <select
                value={form.assigneeId}
                onChange={e => setForm(p => ({ ...p, assigneeId: e.target.value }))}
                className={`${inputCls} cursor-pointer font-bold`}
              >
                <option value="" className="bg-white dark:bg-[#161B31] text-[#101828] dark:text-white">-- Unassigned --</option>
                {employeeList.map(e => (
                  <option key={e.id} value={e.id} className="bg-white dark:bg-[#161B31] text-[#101828] dark:text-white">
                    {e.name} ({e.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-[#7A8496] mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className={`${inputCls} cursor-pointer font-bold`}
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c} className="bg-white dark:bg-[#161B31] text-[#101828] dark:text-white">{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-[#7A8496] mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: e.target.value as any }))}
                className={`${inputCls} cursor-pointer font-bold`}
              >
                {PRIORITIES.map(p => (
                  <option key={p} value={p} className="bg-white dark:bg-[#161B31] text-[#101828] dark:text-white">{p}</option>
                ))}
              </select>
            </div>

            {/* Scheduled Work Date with Quick Chips */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-[#5B4BFF] dark:text-[#806CFF] mb-1">
                Scheduled Work Date (Operational)
              </label>
              <input
                type="date"
                required
                value={form.scheduledDate}
                onChange={e => setForm(p => ({ ...p, scheduledDate: e.target.value }))}
                className={inputCls}
              />
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => applyQuickDate('today')}
                  className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickDate('tomorrow')}
                  className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickDate('nextMonday')}
                  className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer"
                >
                  Next Mon
                </button>
              </div>
            </div>

            {/* Final Due Date (Deadline) */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1">
                Final Due Date (Hard Deadline)
              </label>
              <input
                type="date"
                required
                value={form.dueDate}
                onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                className={inputCls}
              />
              <span className="text-[10px] font-medium text-[#7A8496] block mt-1">
                Original deadline stays immutable on rollover.
              </span>
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-[#7A8496] mb-1">Initial Status</label>
              <select
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))}
                className={inputCls}
              >
                {KANBAN_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>

            {/* Optional Video Production link */}
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-[#7A8496] mb-1">
                Linked Video Production Entry (Optional)
              </label>
              <select
                value={form.videoProductionId}
                onChange={e => {
                  const vidId = e.target.value;
                  const found = videoList.find(v => v.id === vidId);
                  setForm(p => ({
                    ...p,
                    videoProductionId: vidId,
                    clientId: found?.clientId || p.clientId,
                    title: p.title || (found ? `${p.category === 'Video Shoot' ? 'Shoot' : 'Edit'}: ${found.title}` : p.title),
                  }));
                }}
                className={`${inputCls} cursor-pointer font-bold`}
              >
                <option value="">-- Standalone Task (No Video Link) --</option>
                {videoList.map(v => (
                  <option key={v.id} value={v.id}>
                    🎬 {v.clientName} - {v.title} ({v.plannedQuantity || 3} vids)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-3 border-t border-[#D8DEE9] dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-xs font-bold text-[#475467] border border-[#D8DEE9] hover:bg-[#F8FAFC] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-[#5B4BFF] hover:bg-[#4E3FE6] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Deliverable
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── TASK DETAIL DRAWER ───────────────────────────────────────────────
const TaskDetailDrawer: React.FC<{
  task: Task;
  employees: any[];
  isAdmin: boolean;
  onClose: () => void;
  onStatusChange: (taskId: string, newCol: KanbanColumnKey, source?: any) => void;
  onDelete: () => void;
  onSave: (t: Task) => void;
}> = ({ task, employees, isAdmin, onClose, onStatusChange, onDelete, onSave }) => {
  const [desc, setDesc] = useState(task.description || '');
  const [notes, setNotes] = useState(task.internalNotes || '');
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || '');
  const [priority, setPriority] = useState(task.priority);
  const [scheduledDate, setScheduledDate] = useState(task.scheduledDate || task.scheduled_date || '');
  const [dueDate, setDueDate] = useState(task.dueDate || task.due_date || '');
  const [saving, setSaving] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const normStatus = normalizeTaskStatus(task.status);
  const ageing = getTaskAgeingInfo(task, todayStr);
  const prevStatus = getPrevWorkflowStatus(task.status);
  const nextStatus = getNextWorkflowStatus(task.status);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const emp = employees.find(e => e.id === assigneeId);
      const updatedData: Partial<Task> = {
        description: desc.trim(),
        internalNotes: notes.trim(),
        assigneeId,
        assigneeName: emp?.name || task.assigneeName || 'Unassigned',
        priority,
        scheduledDate,
        scheduled_date: scheduledDate,
        dueDate,
        due_date: dueDate,
      };

      const saved = await persistUpdateTask(task.id, updatedData);
      const merged = saved || normalizeTaskDateModel({ ...task, ...updatedData });
      onSave(merged);
    } catch (err) {
      console.error('Update task drawer error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-lg bg-white dark:bg-[#11152D] border-l border-[#D8DEE9] dark:border-white/10 h-full overflow-y-auto shadow-2xl p-6 space-y-6 flex flex-col justify-between font-sans"
        onClick={e => e.stopPropagation()}
      >
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#D8DEE9] dark:border-white/10">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${priorityStyles[task.priority]?.badge || ''}`}>
                {task.status} · {task.priority}
              </span>
              {ageing.overdueBadge && (
                <span className="text-[10px] font-black px-2.5 py-1 rounded-md bg-rose-600 text-white shadow-2xs">
                  {ageing.overdueBadge}
                </span>
              )}
              {ageing.pendingDays > 0 && normStatus !== 'Done' && (
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${ageing.pendingColorClass}`}>
                  {ageing.pendingBadge}
                </span>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer hover:bg-slate-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <span className="text-[10px] font-black text-[#5B4BFF] dark:text-[#806CFF] uppercase tracking-wider">
              {task.clientName || 'General Client'} · {task.category || 'Deliverable'}
            </span>
            <h2 className="text-lg font-black text-[#101828] dark:text-white mt-1 leading-snug">
              {task.title}
            </h2>
          </div>

          {/* Workflow Status Arrow Controls */}
          <div className="bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-2xl p-3.5 flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#7A8496] block">Workflow Status</span>
              <span className="text-sm font-black text-[#5B4BFF] dark:text-[#806CFF]">{normStatus}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={!prevStatus}
                onClick={() => prevStatus && onStatusChange(task.id, prevStatus, 'left_arrow')}
                className="px-3 py-2 bg-white dark:bg-[#11152D] border border-[#D8DEE9] rounded-xl text-xs font-bold text-[#475467] dark:text-[#CBD5E1] disabled:opacity-25 flex items-center gap-1.5 shadow-2xs cursor-pointer hover:bg-slate-50"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                disabled={!nextStatus}
                onClick={() => nextStatus && onStatusChange(task.id, nextStatus, 'right_arrow')}
                className="px-3.5 py-2 bg-[#5B4BFF] text-white rounded-xl text-xs font-black disabled:opacity-25 flex items-center gap-1.5 shadow-2xs hover:bg-[#4E3FE6] cursor-pointer"
              >
                Advance <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-[#7A8496] mb-1">
                Description & Brief
              </label>
              <textarea
                rows={3}
                value={desc}
                onChange={e => setDesc(e.target.value)}
                className="w-full bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-3 text-xs font-medium text-[#101828] dark:text-[#F7F8FC] outline-none focus:border-[#5B4BFF] resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#7A8496] mb-1">Assignee</label>
                <select
                  value={assigneeId}
                  onChange={e => setAssigneeId(e.target.value)}
                  className="w-full bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-2.5 text-xs font-bold text-[#101828] dark:text-[#F7F8FC] outline-none cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#7A8496] mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="w-full bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-2.5 text-xs font-bold text-[#101828] dark:text-[#F7F8FC] outline-none cursor-pointer"
                >
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#5B4BFF] mb-1">
                  Scheduled Work Date
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  className="w-full bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-2.5 text-xs font-bold text-[#101828] dark:text-[#F7F8FC] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-rose-600 mb-1">
                  Final Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-2.5 text-xs font-bold text-[#101828] dark:text-[#F7F8FC] outline-none"
                />
              </div>
            </div>

            {/* Rollover & Historical Audit Info */}
            <div className="bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-[11px] text-[#7A8496]">
              <div className="flex justify-between">
                <span>Original Scheduled:</span>
                <span className="font-bold text-[#101828] dark:text-white">{task.originalScheduledDate || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Original Deadline:</span>
                <span className="font-bold text-[#101828] dark:text-white">{task.originalDueDate || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Rollover Count:</span>
                <span className="font-bold text-[#101828] dark:text-white">{task.rolloverCount || 0} times carried forward</span>
              </div>
              {task.lastRolloverAt && (
                <div className="flex justify-between">
                  <span>Last Carry Forward:</span>
                  <span className="font-bold text-[#101828] dark:text-white">{new Date(task.lastRolloverAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-[#7A8496] mb-1">
                Internal Agency Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Private team coordination notes…"
                className="w-full bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-3 text-xs text-[#101828] dark:text-[#F7F8FC] outline-none resize-none font-medium"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[#D8DEE9] dark:border-white/10 flex items-center justify-between gap-3">
          {isAdmin && (
            <button
              onClick={onDelete}
              className="p-3 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
              title="Archive Task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2 flex-1 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-[#475467] border border-[#D8DEE9] rounded-xl hover:bg-[#F8FAFC] cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleUpdate}
              disabled={saving}
              className="px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-[#5B4BFF] hover:bg-[#4E3FE6] rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── ROLLOVER SETTINGS MODAL ───────────────────────────────────────────
const RolloverSettingsModal: React.FC<{
  onClose: () => void;
  onSaved: () => void;
}> = ({ onClose, onSaved }) => {
  const [settings, setLocalSettings] = useState<RolloverSettings>(() => getRolloverSettings());

  const daysOfWeek = [
    { day: 1, label: 'Mon' },
    { day: 2, label: 'Tue' },
    { day: 3, label: 'Wed' },
    { day: 4, label: 'Thu' },
    { day: 5, label: 'Fri' },
    { day: 6, label: 'Sat' },
    { day: 0, label: 'Sun' },
  ];

  const toggleDay = (d: number) => {
    setLocalSettings(prev => {
      const exists = prev.workingDays.includes(d);
      const updated = exists 
        ? prev.workingDays.filter(x => x !== d)
        : [...prev.workingDays, d];
      return { ...prev, workingDays: updated };
    });
  };

  const handleSave = () => {
    setRolloverSettings(settings);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-5 animate-in zoom-in-95 font-sans">
        <div className="flex items-center justify-between pb-3 border-b border-[#D8DEE9] dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#5B4BFF]/10 text-[#5B4BFF] flex items-center justify-center font-bold">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#101828] dark:text-white">Rollover & Working Days</h3>
              <p className="text-[10px] text-[#64748B]">Configure agency operational rules</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Automatic Rollover Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <div>
              <span className="font-bold text-[#101828] dark:text-white block">Enable Automatic Rollover</span>
              <span className="text-[10px] text-[#64748B]">Carry forward unfinished tasks to next working day</span>
            </div>
            <input
              type="checkbox"
              checked={settings.automaticRollover}
              onChange={e => setLocalSettings(p => ({ ...p, automaticRollover: e.target.checked }))}
              className="w-4 h-4 rounded text-[#5B4BFF] cursor-pointer"
            />
          </div>

          {/* Working Days Selector */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-[#7A8496] mb-2">
              Agency Working Days
            </label>
            <div className="grid grid-cols-7 gap-1.5">
              {daysOfWeek.map(({ day, label }) => {
                const isActive = settings.workingDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`py-2 text-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-[#5B4BFF] text-white shadow-2xs font-black' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <span className="text-[10px] text-[#7A8496] block mt-1.5">
              Unfinished tasks will roll over to the next enabled working day.
            </span>
          </div>

          {/* Ageing Preview */}
          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#5B4BFF] block">
              Pending Age Visual Thresholds
            </span>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
                <span className="font-black">Amber:</span> 1 Day Pending
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-orange-50 text-orange-800 border border-orange-200">
                <span className="font-black">Orange:</span> 2-3 Days Pending
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
                <span className="font-black">Red:</span> 4-6 Days Pending
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-rose-100 text-rose-900 border border-rose-300 font-bold">
                <span className="font-black">Deep Red:</span> 7+ Days Pending
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 pt-3 border-t border-[#D8DEE9] dark:border-white/10">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-[#475467] border border-[#D8DEE9] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-[#5B4BFF] hover:bg-[#4E3FE6] shadow-2xs cursor-pointer"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default TasksView;
