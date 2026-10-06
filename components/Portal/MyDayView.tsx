import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useActiveEmployee } from '../../hooks/useActiveEmployee';
import {
  Clock, CheckSquare, AlertTriangle, UserCheck, Zap, Plus,
  Calendar, ChevronRight, ChevronDown, Play, Check, X, Loader2,
  Star, Sparkles, CheckCircle2, AlertCircle, RefreshCw, Film,
  Layers, ExternalLink, ArrowRight, ArrowLeft, TrendingUp, FileText, CheckCheck,
  CalendarDays, Tag, Activity, User, Shield, Briefcase, Search, Edit2, Trash2
} from 'lucide-react';
import { db, sanitizeFirestorePayload } from '../../lib/firebase';
import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc,
  doc, orderBy, limit, Timestamp, onSnapshot, setDoc
} from 'firebase/firestore';
import { DEFAULT_CLIENTS_MASTER } from '../../lib/clientMaster';
import { isTaskAssignedToEmployee, EMPLOYEE_ID_ALIASES } from '../../lib/employeeMaster';
import { ensureActiveFirebaseAuth } from '../../lib/calendarStorage';
import { 
  type Task, 
  getTaskAgeingInfo, 
  normalizeTaskStatus, 
  transitionTaskStatus, 
  getNextWorkflowStatus, 
  getPrevWorkflowStatus,
  normalizeTaskDateModel,
  subscribeToCanonicalTasks,
  getCachedTasks,
  persistNewTask,
  differenceInCalendarDays
} from '../../lib/taskStorage';

interface MyDayProps {
  setActiveTab: (tab: string) => void;
}

export interface PersonalWorkLog {
  id: string;
  clientId: string;
  clientName: string;
  workDone: string;
  category: string;
  quantity: number;
  date: string;
  source: 'manual' | 'task' | string;
  taskId?: string | null;
  workDetails?: string;
  hours?: number;
  createdAt: string;
  updatedAt?: string;
  employeeId?: string;
  employee_id?: string;
  employeeName?: string;
}

const CATEGORIES = [
  'Graphic Design',
  'Reel Editing',
  'Video Shoot',
  'Video Editing',
  'Script Writing',
  'Caption Writing',
  'Social Media',
  'Meta Ads',
  'Google Ads',
  'SEO',
  'Website Update',
  'Blog',
  'Client Coordination',
  'Reporting',
  'Photography',
  'Other'
];

const DELIVERABLE_SUGGESTIONS: { label: string; category: string }[] = [
  // Graphic Design
  { label: 'Instagram Post Design', category: 'Graphic Design' },
  { label: 'Instagram Carousel (Multi-Slide)', category: 'Graphic Design' },
  { label: 'Instagram Story Creative', category: 'Graphic Design' },
  { label: 'Facebook Ad Creative', category: 'Graphic Design' },
  { label: 'Flyer / Brochure Design', category: 'Graphic Design' },
  { label: 'Banner & Poster Design', category: 'Graphic Design' },
  { label: 'YouTube Thumbnail Design', category: 'Graphic Design' },
  { label: 'Branding & Logo Asset', category: 'Graphic Design' },
  
  // Video & Reel Production
  { label: 'Instagram Reel Editing', category: 'Reel Editing' },
  { label: 'YouTube Short Editing', category: 'Reel Editing' },
  { label: 'Video Shoot (On-Location / Studio)', category: 'Video Shoot' },
  { label: 'Long-Form Video Editing', category: 'Video Editing' },
  { label: 'Patient Testimonial Video', category: 'Video Editing' },
  { label: 'Doctor / Founder Talking Head Video', category: 'Video Editing' },
  { label: 'Motion Graphics / Animated Intro', category: 'Video Editing' },
  
  // Content & Copy
  { label: 'Social Media Caption Writing', category: 'Caption Writing' },
  { label: 'Video Script Writing', category: 'Script Writing' },
  { label: 'SEO Blog Article', category: 'SEO' },
  { label: 'Case Study / Whitepaper Copy', category: 'Script Writing' },

  // Web & SEO
  { label: 'Website Page Update', category: 'Website Update' },
  { label: 'Landing Page Design & Build', category: 'Website Update' },
  { label: 'Technical SEO Optimization', category: 'SEO' },
  { label: 'Google Business Profile (GMB) Post', category: 'Social Media' },

  // Performance & Ads
  { label: 'Meta Ads Campaign Setup & Launch', category: 'Meta Ads' },
  { label: 'Google Search Ads Optimization', category: 'Google Ads' },
  { label: 'Ad Performance Reporting & Analytics', category: 'Reporting' },
  { label: 'Client Strategy & Growth Meeting', category: 'Client Coordination' },
];

function inferCategoryFromDeliverable(text: string): string | null {
  const lower = text.toLowerCase();
  if (/reel|short/i.test(lower)) return 'Reel Editing';
  if (/shoot/i.test(lower)) return 'Video Shoot';
  if (/video|clip|testimonial/i.test(lower)) return 'Video Editing';
  if (/carousel|post|banner|flyer|story|poster|thumbnail|graphic|logo|branding|creative/i.test(lower)) return 'Graphic Design';
  if (/website|webpage|landing page|web/i.test(lower)) return 'Website Update';
  if (/seo|keyword|gmb|google business/i.test(lower)) return 'SEO';
  if (/meta ad|facebook ad|instagram ad/i.test(lower)) return 'Meta Ads';
  if (/google ad|search ad|ppc/i.test(lower)) return 'Google Ads';
  if (/script|copy|caption|blog|article|content/i.test(lower)) return 'Script Writing';
  if (/report|analytic|margin|kpi/i.test(lower)) return 'Reporting';
  if (/meeting|call|client|coordination/i.test(lower)) return 'Client Coordination';
  return null;
}

const priorityStyles: Record<string, { badge: string; text: string; dot: string }> = {
  Urgent: { badge: 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:border-rose-900/60 dark:text-rose-300 font-black', text: 'text-rose-700', dot: 'bg-rose-500' },
  High:   { badge: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-900/60 dark:text-amber-300 font-bold', text: 'text-amber-800', dot: 'bg-amber-500' },
  Medium: { badge: 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-900/60 dark:text-indigo-300 font-bold', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  Low:    { badge: 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-white/10 dark:border-white/10 dark:text-slate-300 font-medium', text: 'text-slate-700', dot: 'bg-slate-500' },
};

export const MyDayView: React.FC<MyDayProps> = ({ setActiveTab }) => {
  const { profile, user } = useAuth();
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

  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Canonical Tasks from Central Repository
  const [allTasks, setAllTasks] = useState<Task[]>(() => getCachedTasks());
  const [clients, setClients] = useState<any[]>(DEFAULT_CLIENTS_MASTER);

  // Tab & View Selection
  const [activeTaskTab, setActiveTaskTab] = useState<'today' | 'overdue' | 'upcoming' | 'completed'>('today');
  const [workLogModalOpen, setWorkLogModalOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // ─── Assign Task Modal State ───────────────────────────────────────────
  const [assignTaskModalOpen, setAssignTaskModalOpen] = useState(false);
  const [savingAssignTask, setSavingAssignTask] = useState(false);
  const [assignTaskForm, setAssignTaskForm] = useState({
    title: '',
    description: '',
    clientId: '',
    clientName: '',
    category: 'Graphic Design',
    priority: 'Medium' as 'Urgent' | 'High' | 'Medium' | 'Low',
    scheduledDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    status: 'To Do',
    internalNotes: '',
  });

  // Attendance State
  const [attendanceRecord, setAttendanceRecord] = useState<any>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [elapsedWorkingTime, setElapsedWorkingTime] = useState<string>('');

  // Date Strings
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const headerDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  // Work Log Form State & Validation
  const [workLogs, setWorkLogs] = useState<PersonalWorkLog[]>([]);
  const [logForm, setLogForm] = useState({
    clientId: '',
    clientName: '',
    workDone: '',
    category: 'Graphic Design',
    quantity: '1',
    hours: '',
    date: todayStr,
    workDetails: ''
  });
  const [isCategoryManual, setIsCategoryManual] = useState(false);
  const [inferredCategorySuggestion, setInferredCategorySuggestion] = useState<string | null>(null);
  const [savingLog, setSavingLog] = useState(false);
  const [formTouched, setFormTouched] = useState(false);

  // Client Autocomplete State
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [clientActiveIndex, setClientActiveIndex] = useState(0);
  const clientComboboxRef = useRef<HTMLDivElement>(null);

  // Deliverable Suggestion State
  const [deliverableSuggestionsOpen, setDeliverableSuggestionsOpen] = useState(false);
  const [deliverableActiveIndex, setDeliverableActiveIndex] = useState(0);
  const deliverableRef = useRef<HTMLDivElement>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ─── 1. Canonical Tasks Real-Time Subscription ────────────────────────
  useEffect(() => {
    const unsub = subscribeToCanonicalTasks((updatedTasks) => {
      setAllTasks(updatedTasks);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ─── 2. Clients Subscription ──────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'clients'), snap => {
      if (!snap.empty) {
        setClients(snap.docs.map(d => ({ id: d.id, clientId: d.id, ...d.data() })));
      }
    }, () => setClients(DEFAULT_CLIENTS_MASTER));
    return () => unsub();
  }, []);

  // ─── 3. Attendance Subscription for Active Employee ───────────────────
  useEffect(() => {
    if (!resolvedEmployeeId) return;

    const unsubAttendance = onSnapshot(
      query(collection(db, 'attendance'), where('date', '==', todayStr)),
      (snap) => {
        if (!snap.empty) {
          const matched = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .find((a: any) => 
              a.employeeId === resolvedEmployeeId || 
              a.employee_id === resolvedEmployeeId ||
              EMPLOYEE_ID_ALIASES[a.employeeId] === resolvedEmployeeId
            );
          setAttendanceRecord(matched || null);
        } else {
          setAttendanceRecord(null);
        }
      },
      (err) => console.warn('Attendance live sync notice in MyDay:', err)
    );

    return () => unsubAttendance();
  }, [resolvedEmployeeId, todayStr]);

  // ─── 4. Work Logs Query (Strictly Scoped by Employee and Today) ────────
  const filterTodaysLogs = useCallback((rawLogs: any[]): PersonalWorkLog[] => {
    if (!Array.isArray(rawLogs) || !resolvedEmployeeId) return [];
    
    return rawLogs.filter((l: any) => {
      const empId = l.employee_id || l.employeeId || l.userId || l.user_id || '';
      const empName = (l.employee_name || l.employeeName || '').toLowerCase().trim();
      const myName = (activeEmployeeName || '').toLowerCase().trim();

      const isMyEmp = 
        empId === resolvedEmployeeId || 
        EMPLOYEE_ID_ALIASES[empId] === resolvedEmployeeId ||
        EMPLOYEE_ID_ALIASES[resolvedEmployeeId] === empId ||
        (resolvedEmployeeId === 'emp_superadmin' && (empId === 'demo-super-admin-01' || empId === 'superAdmin' || empId === 'admin' || empId === 'emp_superadmin' || empId === 'emp_admin' || empId === 'superadmin')) ||
        (empName && myName && (empName === myName || empName.includes(myName) || myName.includes(empName)));

      if (!isMyEmp) return false;

      const rawDate = l.work_date || l.date || l.workDate || l.completed_at || l.completedAt || l.created_at || l.createdAt || '';
      let logDate = '';
      if (typeof rawDate === 'string') {
        logDate = rawDate.slice(0, 10);
      } else if (rawDate?.toDate) {
        try {
          logDate = rawDate.toDate().toISOString().slice(0, 10);
        } catch {
          logDate = todayStr;
        }
      } else {
        logDate = todayStr;
      }

      return logDate === todayStr;
    }).map((l: any, idx: number) => ({
      id: l.id || l.workLogId || `log_${idx}`,
      clientId: l.client_id || l.clientId || '',
      clientName: l.client_name || l.clientName || 'Client',
      workDone: l.work_description || l.workDone || l.description || l.title || 'Work deliverable',
      quantity: l.quantity !== undefined ? Number(l.quantity) : 1,
      date: (l.work_date || l.date || l.workDate || todayStr).slice(0, 10),
      category: l.task_type || l.category || 'General',
      source: l.source || (l.task_id || l.taskId || l.auto_generated || l.autoGenerated ? 'task' : 'manual'),
      taskId: l.task_id || l.taskId || null,
      workDetails: l.work_details || l.workDetails || '',
      hours: l.hours !== undefined ? Number(l.hours) : undefined,
      createdAt: l.created_at || l.createdAt || new Date().toISOString(),
      updatedAt: l.updated_at || l.updatedAt,
      employeeId: l.employee_id || l.employeeId || resolvedEmployeeId,
      employee_id: l.employee_id || l.employeeId || resolvedEmployeeId,
      employeeName: l.employee_name || l.employeeName || activeEmployeeName
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [resolvedEmployeeId, todayStr, activeEmployeeName]);

  useEffect(() => {
    if (!resolvedEmployeeId) return;

    // Load from local storage immediately
    try {
      const cachedRaw = localStorage.getItem('digi_persisted_worklogs_v2');
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        setWorkLogs(filterTodaysLogs(parsed));
      }
    } catch {}

    // Live listener on Firestore workLogs collection
    const unsubWorkLogs = onSnapshot(
      collection(db, 'workLogs'),
      (snap) => {
        if (!snap.empty) {
          const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setWorkLogs(filterTodaysLogs(allDocs));
        } else {
          try {
            const cachedRaw = localStorage.getItem('digi_persisted_worklogs_v2');
            if (cachedRaw) setWorkLogs(filterTodaysLogs(JSON.parse(cachedRaw)));
          } catch {}
        }
      },
      (err) => console.warn('WorkLogs live sync notice in MyDay:', err)
    );

    const handleWorkLogUpdate = () => {
      try {
        const cachedRaw = localStorage.getItem('digi_persisted_worklogs_v2');
        if (cachedRaw) {
          setWorkLogs(filterTodaysLogs(JSON.parse(cachedRaw)));
        }
      } catch {}
    };
    window.addEventListener('worklogs_updated', handleWorkLogUpdate);

    return () => {
      unsubWorkLogs();
      window.removeEventListener('worklogs_updated', handleWorkLogUpdate);
    };
  }, [resolvedEmployeeId, filterTodaysLogs]);

  // ─── 5. Elapsed Working Timer ─────────────────────────────────────────
  useEffect(() => {
    if (!attendanceRecord?.checkIn || attendanceRecord?.checkOut) {
      setElapsedWorkingTime('');
      return;
    }

    const calculateElapsed = () => {
      try {
        const parts = attendanceRecord.checkIn.split(':');
        if (parts.length >= 2) {
          const now = new Date();
          const checkInDate = new Date();
          checkInDate.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);

          const diffMs = Math.max(0, now.getTime() - checkInDate.getTime());
          const hrs = Math.floor(diffMs / 3600000);
          const mins = Math.floor((diffMs % 3600000) / 60000);
          setElapsedWorkingTime(`${hrs}h ${mins}m`);
        }
      } catch {
        setElapsedWorkingTime('');
      }
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 60000);
    return () => clearInterval(interval);
  }, [attendanceRecord]);

  // ─── 6. Canonical Tasks Strictly Filtered by Active Employee ──────────
  const myAssignedTasks = useMemo(() => {
    return allTasks.filter(t => {
      if (t.isArchived || t.status === 'Cancelled') return false;
      return isTaskAssignedToEmployee(t, resolvedEmployeeId);
    });
  }, [allTasks, resolvedEmployeeId]);

  // ─── 7. Actionable Today Focus Tasks & Ordering ────────────────────────
  const todayFocusTasks = useMemo(() => {
    const unfinished = myAssignedTasks.filter(t => normalizeTaskStatus(t.status) !== 'Done');

    const matching = unfinished.filter(t => {
      const schDate = (t.scheduledDate || t.scheduled_date || todayStr).slice(0, 10);
      const dueDate = (t.dueDate || t.due_date || schDate).slice(0, 10);
      const isCarriedForward = (t.rolloverCount || 0) > 0 || (t.originalScheduledDate && t.originalScheduledDate < schDate);
      const isOverdue = dueDate < todayStr;
      const isDueToday = dueDate === todayStr;
      const isScheduledToday = schDate === todayStr;

      return isOverdue || isCarriedForward || isDueToday || isScheduledToday;
    });

    const priorityWeight: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

    return matching.sort((a, b) => {
      const aDue = (a.dueDate || a.due_date || '').slice(0, 10);
      const bDue = (b.dueDate || b.due_date || '').slice(0, 10);
      const aOverdue = aDue < todayStr ? 1 : 0;
      const bOverdue = bDue < todayStr ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue; // Overdue first

      const aCarried = (a.rolloverCount || 0) > 0 ? 1 : 0;
      const bCarried = (b.rolloverCount || 0) > 0 ? 1 : 0;
      if (aCarried !== bCarried) return bCarried - aCarried; // Carried forward next

      const aDueToday = aDue === todayStr ? 1 : 0;
      const bDueToday = bDue === todayStr ? 1 : 0;
      if (aDueToday !== bDueToday) return bDueToday - aDueToday; // Due today next

      const pA = priorityWeight[a.priority] || 2;
      const pB = priorityWeight[b.priority] || 2;
      if (pA !== pB) return pB - pA;

      return (a.title || '').localeCompare(b.title || '');
    });
  }, [myAssignedTasks, todayStr]);

  const overdueTasks = useMemo(() => {
    return myAssignedTasks.filter(t => {
      if (normalizeTaskStatus(t.status) === 'Done') return false;
      const dueDate = (t.dueDate || t.due_date || '').slice(0, 10);
      return dueDate && dueDate < todayStr;
    });
  }, [myAssignedTasks, todayStr]);

  const upcomingTasks = useMemo(() => {
    return myAssignedTasks.filter(t => {
      if (normalizeTaskStatus(t.status) === 'Done') return false;
      const schDate = (t.scheduledDate || t.scheduled_date || '').slice(0, 10);
      const dueDate = (t.dueDate || t.due_date || schDate).slice(0, 10);
      const diff = differenceInCalendarDays(schDate || dueDate, todayStr);
      return diff > 0 && diff <= 7;
    }).sort((a, b) => {
      const aDate = a.scheduledDate || a.dueDate || '';
      const bDate = b.scheduledDate || b.dueDate || '';
      return aDate.localeCompare(bDate);
    });
  }, [myAssignedTasks, todayStr]);

  // STRICT TASK COMPLETION KPI: Only counts actual tasks where status is Done and completed today
  const completedTodayTasks = useMemo(() => {
    return myAssignedTasks.filter(t => {
      if (normalizeTaskStatus(t.status) !== 'Done') return false;
      const compDate = (t.completedAt || t.completed_at || t.updatedAt || '').slice(0, 10);
      return compDate === todayStr;
    });
  }, [myAssignedTasks, todayStr]);

  // Authoritative Daily KPIs (Cleanly Separated)
  const kpiDueToday = todayFocusTasks.length;
  const kpiOverdue = overdueTasks.length;
  const kpiCompletedToday = completedTodayTasks.length;
  const kpiWorkLogged = workLogs.length;

  // ─── Status Workflow Handler for Actual Tasks ─────────────────────────
  const handleStatusChange = async (
    taskId: string, 
    targetStatus: 'To Do' | 'In Progress' | 'In Review' | 'Done',
    source: 'left_arrow' | 'right_arrow' | 'complete_btn' = 'complete_btn'
  ) => {
    // Optimistic state update
    setAllTasks(prev => prev.map(t => t.id === taskId ? {
      ...t,
      status: targetStatus,
      updatedAt: new Date().toISOString(),
      ...(targetStatus === 'Done' ? { completedAt: new Date().toISOString() } : {})
    } : t));

    const res = await transitionTaskStatus(taskId, targetStatus, source as any, {
      uid: user?.uid,
      name: profile?.name || activeEmployeeName,
      role: profile?.role
    });

    if (res.success) {
      triggerToast(res.message);
    } else {
      triggerToast('Status update failed');
      setAllTasks(getCachedTasks());
    }
  };

  // ─── Attendance Check In / Out Handler ────────────────────────────────
  const handleCheckIn = useCallback(async () => {
    if (checkingIn) return;
    setCheckingIn(true);
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
      const isLate = now.getHours() >= 10;

      if (!attendanceRecord) {
        // Check In
        const newRecord = {
          employeeId: resolvedEmployeeId,
          employee_id: resolvedEmployeeId,
          employeeName: activeEmployeeName,
          employeeEmail: activeEmployee?.email || profile?.email || '',
          date: todayStr,
          status: isLate ? 'Late' : 'Present',
          checkIn: timeStr,
          isLate,
          markedAt: new Date().toISOString(),
          markedBy: profile?.name || 'Self',
        };
        const ref = await addDoc(collection(db, 'attendance'), newRecord);
        setAttendanceRecord({ id: ref.id, ...newRecord });
        triggerToast(`✓ Checked in successfully at ${timeStr}`);
      } else if (!attendanceRecord.checkOut) {
        // Check Out
        await updateDoc(doc(db, 'attendance', attendanceRecord.id), {
          checkOut: timeStr,
          updatedAt: new Date().toISOString(),
        });
        setAttendanceRecord((prev: any) => ({ ...prev, checkOut: timeStr }));
        triggerToast(`✓ Checked out at ${timeStr}`);
      }
    } catch (err) {
      console.error('Check in/out error:', err);
      triggerToast('Attendance action error');
    } finally {
      setCheckingIn(false);
    }
  }, [attendanceRecord, checkingIn, resolvedEmployeeId, activeEmployeeName, activeEmployee, profile, todayStr]);

  // ─── Unique Filtered Clients for Autocomplete ─────────────────────────
  const uniqueClients = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of clients) {
      const name = (c.clientName || c.name || c.businessName || '').trim();
      if (name && !map.has(name.toLowerCase())) {
        map.set(name.toLowerCase(), {
          id: c.id || c.clientId || `client_${name}`,
          name,
          businessName: c.businessName || name,
          industry: c.industry || '',
          avatar: name.substring(0, 2).toUpperCase()
        });
      }
    }
    return Array.from(map.values());
  }, [clients]);

  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return uniqueClients.slice(0, 8);
    const queryLower = clientSearchQuery.trim().toLowerCase();
    return uniqueClients.filter(c => 
      c.name.toLowerCase().includes(queryLower) ||
      c.businessName.toLowerCase().includes(queryLower) ||
      c.industry.toLowerCase().includes(queryLower)
    ).slice(0, 8);
  }, [uniqueClients, clientSearchQuery]);

  // Check if client is officially selected from uniqueClients
  const selectedClientObj = useMemo(() => {
    if (!logForm.clientName) return null;
    const nameLower = logForm.clientName.trim().toLowerCase();
    return uniqueClients.find(c => c.name.toLowerCase() === nameLower || c.id === logForm.clientId) || null;
  }, [uniqueClients, logForm.clientName, logForm.clientId]);

  // Form Validation Computations
  const formValidation = useMemo(() => {
    const errors: Record<string, string> = {};
    const titleTrimmed = logForm.workDone.trim();

    if (!selectedClientObj && !logForm.clientName.trim()) {
      errors.client = 'Select a valid client or brand from the list.';
    }

    if (!titleTrimmed) {
      errors.title = 'Work description or deliverable title is required.';
    } else if (titleTrimmed.length > 200) {
      errors.title = 'Title must not exceed 200 characters.';
    }

    if (!logForm.category) {
      errors.category = 'Select a category.';
    }

    const qtyNum = parseInt(logForm.quantity, 10);
    if (isNaN(qtyNum) || qtyNum < 1) {
      errors.quantity = 'Quantity must be a positive integer (at least 1).';
    } else if (qtyNum > 999) {
      errors.quantity = 'Quantity cannot exceed 999.';
    }

    if (logForm.hours) {
      const hoursNum = parseFloat(logForm.hours);
      if (isNaN(hoursNum) || hoursNum <= 0) {
        errors.hours = 'Hours must be greater than 0.';
      } else if (hoursNum > 24) {
        errors.hours = 'Hours cannot exceed 24 in a single entry.';
      }
    }

    if (!logForm.date) {
      errors.date = 'Select a valid work date.';
    }

    const isValid = Object.keys(errors).length === 0;
    return { isValid, errors };
  }, [logForm, selectedClientObj]);

  // ─── Client-Specific Deliverable Suggestions ──────────────────────────
  const clientDeliverableSuggestions = useMemo(() => {
    const suggestions: { label: string; category: string }[] = [];
    const seen = new Set<string>();

    // 1. Previous work done for the selected client
    if (logForm.clientName) {
      const clientLower = logForm.clientName.toLowerCase();
      workLogs.filter(l => (l.clientName || '').toLowerCase() === clientLower).forEach(l => {
        if (l.workDone && !seen.has(l.workDone.toLowerCase())) {
          seen.add(l.workDone.toLowerCase());
          suggestions.push({ label: l.workDone, category: l.category || 'Graphic Design' });
        }
      });

      allTasks.filter(t => (t.clientName || '').toLowerCase() === clientLower).forEach(t => {
        if (t.title && !seen.has(t.title.toLowerCase())) {
          seen.add(t.title.toLowerCase());
          suggestions.push({ label: t.title, category: t.category || 'Graphic Design' });
        }
      });
    }

    // 2. Predefined deliverable suggestions
    DELIVERABLE_SUGGESTIONS.forEach(d => {
      if (!seen.has(d.label.toLowerCase())) {
        seen.add(d.label.toLowerCase());
        suggestions.push(d);
      }
    });

    const queryLower = logForm.workDone.trim().toLowerCase();
    if (!queryLower) return suggestions.slice(0, 8);

    return suggestions.filter(s => s.label.toLowerCase().includes(queryLower)).slice(0, 8);
  }, [logForm.clientName, logForm.workDone, workLogs, allTasks]);

  // Click outside listener for comboboxes
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientComboboxRef.current && !clientComboboxRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
      if (deliverableRef.current && !deliverableRef.current.contains(e.target as Node)) {
        setDeliverableSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Open Assign Task Modal Handler ────────────────────────────────────
  const handleOpenAssignTaskModal = () => {
    const todStr = new Date().toISOString().split('T')[0];
    setAssignTaskForm({
      title: '',
      description: '',
      clientId: uniqueClients[0]?.id || '',
      clientName: uniqueClients[0]?.name || '',
      category: 'Graphic Design',
      priority: 'Medium',
      scheduledDate: todStr,
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      status: 'To Do',
      internalNotes: '',
    });
    setAssignTaskModalOpen(true);
  };

  // ─── Save Assign Task Handler (creates TASK only, zero Work Logs) ───────
  const handleSaveAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTaskForm.title.trim()) return;
    setSavingAssignTask(true);
    try {
      const nowIso = new Date().toISOString();
      const selectedClient = uniqueClients.find(c => c.id === assignTaskForm.clientId) ||
        (assignTaskForm.clientName ? { id: `client_${assignTaskForm.clientName.toLowerCase().replace(/\s+/g, '_')}`, name: assignTaskForm.clientName } : null);

      const newTaskData: Partial<Task> = {
        title: assignTaskForm.title.trim(),
        description: assignTaskForm.description.trim(),
        clientId: selectedClient?.id || assignTaskForm.clientId || '',
        clientName: selectedClient?.name || assignTaskForm.clientName || 'General',
        category: assignTaskForm.category,
        // ── Canonical member assignment ──
        assigneeId: resolvedEmployeeId,
        assigneeName: activeEmployeeName,
        assigned_employee_id: resolvedEmployeeId,
        employee_id: resolvedEmployeeId,
        // ────────────────────────────────
        assignedById: user?.uid || '',
        assignedByName: profile?.name || 'Super Admin',
        priority: assignTaskForm.priority,
        scheduledDate: assignTaskForm.scheduledDate,
        dueDate: assignTaskForm.dueDate,
        originalScheduledDate: assignTaskForm.scheduledDate,
        originalDueDate: assignTaskForm.dueDate,
        firstPendingSince: assignTaskForm.scheduledDate,
        rolloverCount: 0,
        status: normalizeTaskStatus(assignTaskForm.status),
        internalNotes: assignTaskForm.internalNotes.trim(),
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const savedTask = await persistNewTask(newTaskData, { uid: user?.uid, name: profile?.name });

      // Optimistic local update so My Day shows it immediately
      setAllTasks(prev => [savedTask, ...prev.filter(t => t.id !== savedTask.id)]);

      setAssignTaskModalOpen(false);
      triggerToast(`✓ Task assigned to ${activeEmployeeName} — visible in Delivery Board & My Tasks`);

      // Broadcast so other views reload
      window.dispatchEvent(new CustomEvent('tasks_updated', { detail: savedTask }));
    } catch (err) {
      console.error('Assign task error:', err);
      triggerToast('Could not create task. Please retry.');
    } finally {
      setSavingAssignTask(false);
    }
  };

  // ─── Open Log Work Modal Handler ──────────────────────────────────────
  const handleOpenLogModal = (existingLog?: PersonalWorkLog) => {
    setFormTouched(false);
    if (existingLog) {
      setEditingLogId(existingLog.id);
      setIsCategoryManual(true);
      setInferredCategorySuggestion(null);
      setLogForm({
        clientId: existingLog.clientId || '',
        clientName: existingLog.clientName,
        workDone: existingLog.workDone,
        category: existingLog.category || 'Graphic Design',
        quantity: String(existingLog.quantity || 1),
        hours: existingLog.hours ? String(existingLog.hours) : '',
        date: existingLog.date || todayStr,
        workDetails: existingLog.workDetails || ''
      });
      setClientSearchQuery(existingLog.clientName);
    } else {
      setEditingLogId(null);
      setIsCategoryManual(false);
      setInferredCategorySuggestion(null);
      const defaultClient = uniqueClients[0]?.name || 'Dr. Anupam Jindal';
      const defaultClientId = uniqueClients[0]?.id || 'client_dr_anupam_jindal';
      setLogForm({
        clientId: defaultClientId,
        clientName: defaultClient,
        workDone: '',
        category: 'Graphic Design',
        quantity: '1',
        hours: '',
        date: todayStr,
        workDetails: ''
      });
      setClientSearchQuery(defaultClient);
    }
    setClientDropdownOpen(false);
    setDeliverableSuggestionsOpen(false);
    setWorkLogModalOpen(true);
  };

  // ─── Select Deliverable Suggestion Handler (Explicit User Action) ─────
  const handleSelectDeliverable = (item: { label: string; category: string }) => {
    setLogForm(prev => ({
      ...prev,
      workDone: item.label,
      category: item.category || prev.category
    }));
    setIsCategoryManual(true);
    setInferredCategorySuggestion(null);
    setDeliverableSuggestionsOpen(false);
  };

  // ─── Apply Inferred Category Suggestion ───────────────────────────────
  const handleApplySuggestedCategory = () => {
    if (inferredCategorySuggestion) {
      setLogForm(p => ({ ...p, category: inferredCategorySuggestion }));
      setIsCategoryManual(true);
      setInferredCategorySuggestion(null);
    }
  };

  // ─── Save Manual Work Log (SEPARATED FROM TASKS) ──────────────────────
  const handleSaveManualWorkLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormTouched(true);

    if (!formValidation.isValid) {
      const firstErr = Object.values(formValidation.errors)[0];
      triggerToast(String(firstErr || 'Please check form fields'));
      return;
    }

    if (savingLog) return; // Prevent double clicks / race condition

    const desc = logForm.workDone.trim();
    const cName = (selectedClientObj?.name || logForm.clientName).trim();
    const cId = selectedClientObj?.id || logForm.clientId || `client_${cName.toLowerCase().replace(/\s+/g, '_')}`;
    const qty = parseInt(logForm.quantity, 10);
    const parsedHours = logForm.hours ? parseFloat(logForm.hours) : null;
    const workDate = logForm.date || todayStr;
    const nowIso = new Date().toISOString();
    const logId = editingLogId || `worklog_manual_${Date.now()}`;

    setSavingLog(true);

    try {
      // 1. Build canonical Work Log payload (Pure Work Log entity, taskId: null)
      const canonicalPayload: any = {
        id: logId,
        workLogId: logId,
        taskId: null,
        task_id: null,
        clientId: cId,
        client_id: cId,
        clientName: cName,
        client_name: cName,
        employeeId: resolvedEmployeeId,
        employee_id: resolvedEmployeeId,
        employeeName: activeEmployeeName,
        employee_name: activeEmployeeName,
        workDone: desc,
        work_description: desc,
        description: desc,
        category: logForm.category,
        task_type: logForm.category,
        quantity: qty,
        hours: parsedHours ?? null,
        workDetails: logForm.workDetails.trim(),
        work_details: logForm.workDetails.trim(),
        workDate: workDate,
        work_date: workDate,
        date: workDate,
        source: 'manual',
        auto_generated: false,
        autoGenerated: false,
        created_by: user?.email || profile?.name || activeEmployeeName || 'User',
        createdAt: editingLogId ? (workLogs.find(l => l.id === editingLogId)?.createdAt || nowIso) : nowIso,
        created_at: editingLogId ? (workLogs.find(l => l.id === editingLogId)?.createdAt || nowIso) : nowIso,
        updatedAt: nowIso,
        updated_at: nowIso,
        status: 'completed'
      };

      const newLogItem: PersonalWorkLog = {
        id: logId,
        clientId: cId,
        clientName: cName,
        workDone: desc,
        category: logForm.category,
        quantity: qty,
        date: workDate,
        source: 'manual',
        taskId: null,
        workDetails: logForm.workDetails.trim(),
        hours: parsedHours ?? undefined,
        createdAt: canonicalPayload.createdAt,
        updatedAt: nowIso,
        employeeId: resolvedEmployeeId,
        employee_id: resolvedEmployeeId,
        employeeName: activeEmployeeName
      };

      // 2. Optimistic local cache update & state update immediately
      try {
        const cachedRaw = localStorage.getItem('digi_persisted_worklogs_v2');
        const existing = cachedRaw ? JSON.parse(cachedRaw) : [];
        const updated = [canonicalPayload, ...existing.filter((l: any) => l.id !== logId && l.workLogId !== logId)];
        localStorage.setItem('digi_persisted_worklogs_v2', JSON.stringify(updated));
      } catch (e) {
        console.warn('Local storage worklog cache notice:', e);
      }

      if (editingLogId) {
        setWorkLogs(prev => prev.map(l => l.id === editingLogId ? newLogItem : l));
        triggerToast('✓ Work log updated successfully');
      } else {
        setWorkLogs(prev => [newLogItem, ...prev.filter(l => l.id !== logId)]);
        triggerToast('✓ Work log recorded successfully');
      }

      setWorkLogModalOpen(false);
      setEditingLogId(null);
      setFormTouched(false);

      // 3. Dispatch global broadcast events
      window.dispatchEvent(new CustomEvent('worklogs_updated', { detail: canonicalPayload }));
      window.dispatchEvent(new Event('worklogs_updated'));

      // 4. Persist to Firestore in background with auth assurance
      const sanitized = sanitizeFirestorePayload(canonicalPayload);
      (async () => {
        try {
          await ensureActiveFirebaseAuth().catch(console.warn);
          await setDoc(doc(db, 'workLogs', logId), sanitized, { merge: true });
        } catch (fbErr) {
          console.warn('Firestore workLog write notice (cached locally):', fbErr);
        }
      })();

    } catch (err) {
      console.error('Work log save error:', err);
      triggerToast('Could not save work log');
    } finally {
      setSavingLog(false);
    }
  };

  // ─── Delete Manual Work Log Handler ───────────────────────────────────
  const handleDeleteWorkLog = async (logId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this manual work log entry?')) {
      return;
    }

    try {
      // 1. Optimistic local state & cache removal
      setWorkLogs(prev => prev.filter(l => l.id !== logId));
      
      try {
        const cachedRaw = localStorage.getItem('digi_persisted_worklogs_v2');
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          const updated = parsed.filter((l: any) => l.id !== logId && l.workLogId !== logId);
          localStorage.setItem('digi_persisted_worklogs_v2', JSON.stringify(updated));
        }
      } catch {}

      triggerToast('✓ Work log deleted');
      window.dispatchEvent(new Event('worklogs_updated'));

      // 2. Delete from Firestore
      await deleteDoc(doc(db, 'workLogs', logId)).catch(console.warn);
    } catch (err) {
      console.error('Delete work log error:', err);
      triggerToast('Could not delete work log');
    }
  };

  const displayedTasks = activeTaskTab === 'today' 
    ? todayFocusTasks 
    : activeTaskTab === 'overdue' 
      ? overdueTasks 
      : activeTaskTab === 'upcoming' 
        ? upcomingTasks 
        : completedTodayTasks;

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#101828] text-white px-4 py-2.5 rounded-xl shadow-2xl border border-white/15 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-[#39D9C6]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── 1. HEADER & IDENTITY BANNER ───────────────────────────────── */}
      <header className="space-y-3">
        {isViewAs && (
          <div className="bg-[#EEECFF] dark:bg-[#1F1944] border-2 border-[#5B4BFF]/40 text-[#101828] dark:text-white p-3.5 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5B4BFF] animate-pulse" />
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#5B4BFF] dark:text-[#9A8CFF] block">
                  Super Admin View-As Active
                </span>
                <p className="text-xs font-bold">
                  Viewing Daily Operations Center As: <strong className="text-[#5B4BFF] dark:text-[#9A8CFF]">{activeEmployeeName}</strong> ({activeEmployeeRole})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setViewAsEmployee('emp_superadmin')}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#11152D] hover:bg-[#5B4BFF] hover:text-white text-xs font-bold border border-[#5B4BFF]/30 text-[#5B4BFF] dark:text-[#9A8CFF] transition-all cursor-pointer shadow-2xs"
              >
                👑 Reset to My Super Admin View
              </button>
              <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">Switch Member:</span>
              <select
                value={resolvedEmployeeId}
                onChange={e => setViewAsEmployee(e.target.value)}
                className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-[#101828] dark:text-[#F7F8FC] outline-none cursor-pointer shadow-2xs"
              >
                {canonicalEmployees.map(e => (
                  <option key={e.id || e.employeeId} value={e.id || e.employeeId} className="bg-white dark:bg-[#11152D] text-[#101828] dark:text-white">
                    {(e.id === 'emp_superadmin' || e.employeeId === 'emp_superadmin')
                      ? `👑 ${e.name} (My Workspace / Super Admin)`
                      : `${e.name} (${e.role || 'Member'})`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#5B4BFF] to-[#39D9C6] text-white flex items-center justify-center font-black text-base shadow-sm">
              {activeEmployeeName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-[#101828] dark:text-white tracking-tight">
                  {isViewAs ? `${activeEmployeeName}'s Day` : 'My Day'}
                </h1>
                {!isViewAs && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border border-violet-200 dark:border-violet-900">
                    👑 {activeEmployeeName}
                  </span>
                )}
                {isViewAs && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                    {activeEmployeeRole}
                  </span>
                )}
                <span className="text-xs font-mono text-[#7A8496]">
                  ID: {resolvedEmployeeId}
                </span>
              </div>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5 mt-0.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-[#5B4BFF]" />
                <span>{headerDateFormatted}</span>
                <span>•</span>
                <span>Prioritized Daily Execution Dashboard</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {isAdmin && !isViewAs && (
              <div className="flex items-center gap-2 mr-1">
                <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">Inspect Member:</span>
                <select
                  value={resolvedEmployeeId}
                  onChange={e => setViewAsEmployee(e.target.value)}
                  className="bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-[#101828] dark:text-[#F7F8FC] outline-none cursor-pointer shadow-2xs"
                >
                  {canonicalEmployees.map(e => (
                    <option key={e.id || e.employeeId} value={e.id || e.employeeId} className="bg-white dark:bg-[#11152D] text-[#101828] dark:text-white">
                      {(e.id === 'emp_superadmin' || e.employeeId === 'emp_superadmin')
                        ? `👑 ${e.name} (My Workspace / Super Admin)`
                        : `${e.name} (${e.role || 'Member'})`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Assign Task button — creates a planned Task */}
            <button
              onClick={handleOpenAssignTaskModal}
              className="px-3.5 py-2 rounded-xl border border-[#5B4BFF]/40 bg-[#EEECFF] dark:bg-[#1F1944] text-[#5B4BFF] dark:text-[#9A8CFF] hover:bg-[#5B4BFF] hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
              title={isViewAs ? `Assign a planned task to ${activeEmployeeName}` : 'Assign a planned task to yourself'}
            >
              <Plus className="w-4 h-4" />
              <span>{isViewAs ? `+ Assign Task to ${activeEmployeeName.split(' ')[0]}` : '+ Assign Task to Myself'}</span>
            </button>

            {/* Log Completed Work button — creates a Work Log only */}
            <button
              onClick={() => handleOpenLogModal()}
              className="px-3.5 py-2 rounded-xl border border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-[#344054] dark:text-[#AEB3C5] hover:text-[#101828] dark:hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
              title="Record work already completed — creates a Work Log only, not a Task"
            >
              <FileText className="w-4 h-4 text-[#5B4BFF]" />
              <span>+ Log Completed Work</span>
            </button>

            <button
              onClick={() => setActiveTab('tasks')}
              className="px-4 py-2 bg-[#5B4BFF] hover:bg-[#4E3FE6] text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>View Full Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── 2. AUTHORITATIVE DAILY KPIS ───────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Due Today */}
        <div 
          onClick={() => setActiveTaskTab('today')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            activeTaskTab === 'today'
              ? 'bg-[#EEECFF]/60 dark:bg-[#201D45] border-[#5B4BFF] ring-2 ring-[#5B4BFF]/20'
              : 'bg-white dark:bg-[#11152D] border-[#D8DEE9] dark:border-white/10 hover:border-[#5B4BFF]/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              Due Today
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#101828] dark:text-white">
              {kpiDueToday}
            </span>
            <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
              actionable tasks
            </span>
          </div>
        </div>

        {/* Overdue */}
        <div 
          onClick={() => setActiveTaskTab('overdue')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            activeTaskTab === 'overdue'
              ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-500 ring-2 ring-rose-500/20'
              : 'bg-white dark:bg-[#11152D] border-[#D8DEE9] dark:border-white/10 hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Overdue
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
              {kpiOverdue}
            </span>
            <span className="text-[11px] font-bold text-rose-600/80">
              past deadline
            </span>
          </div>
        </div>

        {/* Completed Today (Only actual tasks completed today) */}
        <div 
          onClick={() => setActiveTaskTab('completed')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            activeTaskTab === 'completed'
              ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-[#11152D] border-[#D8DEE9] dark:border-white/10 hover:border-emerald-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-[#16A34A]">
              Completed Today
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-[#16A34A] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#101828] dark:text-white">
              {kpiCompletedToday}
            </span>
            <span className="text-[11px] font-bold text-[#16A34A]">
              tasks finished
            </span>
          </div>
        </div>

        {/* Work Logged Today (Count of all work logs recorded today) */}
        <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-[#5B4BFF] dark:text-[#9A8CFF]">
              Work Logged
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#EEECFF] dark:bg-[#201D45] text-[#5B4BFF] flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#101828] dark:text-white">
              {kpiWorkLogged}
            </span>
            <span className="text-[11px] font-bold text-[#5B4BFF] dark:text-[#9A8CFF]">
              today's entries
            </span>
          </div>
        </div>
      </section>

      {/* ─── 3. MAIN DASHBOARD SPLIT LAYOUT ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT 2 COLUMNS: TODAY FOCUS ACTIONABLE TASK CHECKLIST */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl p-5 shadow-xs space-y-4">
            
            {/* Tabs Bar */}
            <div className="flex items-center justify-between border-b border-[#D8DEE9] dark:border-white/10 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 bg-[#F8FAFC] dark:bg-[#161B31] p-1 rounded-xl border border-[#D8DEE9] dark:border-white/10 flex-wrap">
                <button
                  onClick={() => setActiveTaskTab('today')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTaskTab === 'today'
                      ? 'bg-white dark:bg-[#111728] text-[#5B4BFF] dark:text-[#806CFF] shadow-xs'
                      : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#101828]'
                  }`}
                >
                  <span>Due Today</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                    {todayFocusTasks.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTaskTab('overdue')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTaskTab === 'overdue'
                      ? 'bg-white dark:bg-[#111728] text-rose-600 shadow-xs'
                      : 'text-[#64748B] dark:text-[#94A3B8] hover:text-rose-600'
                  }`}
                >
                  <span>Overdue</span>
                  {overdueTasks.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300">
                      {overdueTasks.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTaskTab('upcoming')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTaskTab === 'upcoming'
                      ? 'bg-white dark:bg-[#111728] text-[#5B4BFF] dark:text-[#806CFF] shadow-xs'
                      : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#101828]'
                  }`}
                >
                  <span>Upcoming (7 Days)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {upcomingTasks.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTaskTab('completed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTaskTab === 'completed'
                      ? 'bg-white dark:bg-[#111728] text-[#16A34A] shadow-xs'
                      : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#16A34A]'
                  }`}
                >
                  <span>Completed Today</span>
                  {completedTodayTasks.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black bg-emerald-100 dark:bg-emerald-900/50 text-[#16A34A]">
                      {completedTodayTasks.length}
                    </span>
                  )}
                </button>
              </div>

              <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
                {displayedTasks.length} task{displayedTasks.length === 1 ? '' : 's'} in view
              </span>
            </div>

            {/* Task Checklist Items */}
            <div className="space-y-3">
              {displayedTasks.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-[#D8DEE9] dark:border-white/10 rounded-2xl p-6 text-xs text-[#64748B] bg-[#F8FAFC]/50 dark:bg-[#161B31]/30 flex flex-col items-center justify-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold">
                    <Check className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-sm text-[#101828] dark:text-white">
                    {activeTaskTab === 'today' ? 'All caught up for today!' : activeTaskTab === 'overdue' ? 'No overdue tasks!' : activeTaskTab === 'completed' ? 'No tasks finished yet today.' : 'No upcoming tasks scheduled.'}
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-sm">
                    {activeTaskTab === 'today' ? 'All scheduled work is complete or moved. Check upcoming work or view your full task workspace.' : activeTaskTab === 'completed' ? 'Completed deliverables for today will show here.' : 'Great job staying on top of delivery deadlines!'}
                  </p>
                  <button
                    onClick={() => setActiveTab('tasks')}
                    className="px-4 py-2 bg-[#5B4BFF] hover:bg-[#4E3FE6] text-white text-xs font-black rounded-xl transition-all mt-2 cursor-pointer shadow-xs"
                  >
                    Open Delivery Workspace
                  </button>
                </div>
              ) : (
                displayedTasks.map(task => {
                  const ageing = getTaskAgeingInfo(task, todayStr);
                  const pStyle = priorityStyles[task.priority] || priorityStyles.Medium;
                  const prevStatus = getPrevWorkflowStatus(task.status);
                  const nextStatus = getNextWorkflowStatus(task.status);
                  const isDone = normalizeTaskStatus(task.status) === 'Done';

                  return (
                    <div
                      key={task.id}
                      className="bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 hover:border-[#5B4BFF]/50 rounded-2xl p-4 transition-all shadow-2xs space-y-3"
                    >
                      {/* Top Row: Client + Priority + Category */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-white dark:bg-white/10 border border-[#D8DEE9] dark:border-white/10 text-[#344054] dark:text-[#CBD5E1]">
                            {task.clientName || 'General'}
                          </span>
                          <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                            {task.category || 'Task Delivery'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${pStyle.badge}`}>
                            {task.priority}
                          </span>
                        </div>
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-black text-[#101828] dark:text-white leading-snug">
                        {task.title}
                      </h4>

                      {/* Description if any */}
                      {task.description && (
                        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      {/* Badges & Date Information */}
                      <div className="flex items-center gap-2 flex-wrap text-xs pt-1 border-t border-[#D8DEE9]/60 dark:border-white/5">
                        <span className="font-bold text-[#344054] dark:text-[#CBD5E1] bg-white dark:bg-white/10 px-2 py-0.5 rounded-lg border border-[#D8DEE9] dark:border-white/10">
                          {ageing.scheduledBadge}
                        </span>

                        <span className={`font-bold px-2 py-0.5 rounded-lg ${
                          ageing.isOverdue ? 'bg-rose-100 text-rose-700 font-black' : 'text-[#64748B] dark:text-[#94A3B8]'
                        }`}>
                          Due: {task.dueDate || '—'}
                        </span>

                        {ageing.rolloverBadge && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                            {ageing.rolloverBadge}
                          </span>
                        )}

                        {ageing.pendingDays > 0 && (
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${ageing.pendingColorClass}`}>
                            {ageing.pendingBadge}
                          </span>
                        )}
                      </div>

                      {/* Action Controls Footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#D8DEE9] dark:border-white/10 gap-2 flex-wrap">
                        <div className="flex items-center gap-1 bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-1 shadow-2xs">
                          <button
                            type="button"
                            disabled={!prevStatus}
                            onClick={() => prevStatus && handleStatusChange(task.id, prevStatus, 'left_arrow')}
                            title={prevStatus ? `Move back to "${prevStatus}"` : 'Already in To Do'}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#334155] dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-white/10 hover:text-[#5B4BFF] disabled:opacity-20 cursor-pointer transition-all shadow-2xs"
                          >
                            <ArrowLeft className="w-4 h-4" />
                          </button>

                          <span className="text-[10px] font-black text-[#5B4BFF] dark:text-[#806CFF] px-2 uppercase tracking-wider">
                            {normalizeTaskStatus(task.status)}
                          </span>

                          <button
                            type="button"
                            disabled={!nextStatus}
                            onClick={() => nextStatus && handleStatusChange(task.id, nextStatus, 'right_arrow')}
                            title={nextStatus ? `Advance to "${nextStatus}"` : 'Already Done'}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#334155] dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-white/10 hover:text-[#5B4BFF] disabled:opacity-20 cursor-pointer transition-all shadow-2xs"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStatusChange(task.id, isDone ? 'To Do' : 'Done', 'complete_btn')}
                            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                              isDone
                                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                : 'bg-[#ECFDF3] hover:bg-[#16A34A] text-[#15803D] hover:text-white border border-[#BBF7D0]'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isDone ? 'Reopen' : 'Mark Done'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ─── COMING UP SECTION (Next 7 Days) ───────────────────────── */}
          <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#D8DEE9] dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#5B4BFF]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#101828] dark:text-white">
                  Coming Up (Next 7 Days)
                </h3>
              </div>
              <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
                {upcomingTasks.length} scheduled
              </span>
            </div>

            {upcomingTasks.length === 0 ? (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] py-4 text-center">
                No future tasks scheduled for the next 7 days.
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingTasks.map(t => (
                  <div 
                    key={t.id}
                    className="p-3 bg-[#F8FAFC] dark:bg-[#161B31] rounded-xl border border-[#D8DEE9] dark:border-white/10 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-[#101828] dark:text-white truncate">
                        {t.title}
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        {t.clientName || 'General'} · {t.category || 'Task'}
                      </p>
                    </div>

                    <span className="font-black text-[#5B4BFF] dark:text-[#806CFF] px-2.5 py-1 rounded-lg bg-[#EEECFF] dark:bg-[#201D45] shrink-0">
                      {t.scheduledDate || t.dueDate || 'Soon'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ATTENDANCE, TODAY'S WORK LOG & ATTENTION ─────── */}
        <div className="space-y-4">
          
          {/* Attendance & Shift Card */}
          <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#D8DEE9] dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#5B4BFF]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#101828] dark:text-white">
                  Today's Shift
                </h3>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                attendanceRecord?.checkIn 
                  ? 'bg-emerald-50 text-[#16A34A] border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {attendanceRecord?.checkIn ? 'Present' : 'Not Checked In'}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">Expected Shift:</span>
                <span className="font-bold text-[#101828] dark:text-white">10:00 AM – 7:00 PM</span>
              </div>

              {attendanceRecord?.checkIn && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">Checked In:</span>
                  <span className="font-bold text-emerald-600">{attendanceRecord.checkIn}</span>
                </div>
              )}

              {elapsedWorkingTime && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">Time Working:</span>
                  <span className="font-bold text-[#5B4BFF] font-mono">{elapsedWorkingTime}</span>
                </div>
              )}
            </div>

            <button
              onClick={handleCheckIn}
              disabled={checkingIn}
              className={`w-full py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                !attendanceRecord?.checkIn
                  ? 'bg-[#16A34A] hover:bg-[#15803D] text-white'
                  : !attendanceRecord?.checkOut
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-slate-200 text-slate-600 cursor-not-allowed'
              }`}
            >
              {checkingIn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : !attendanceRecord?.checkIn ? (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Check In for Today</span>
                </>
              ) : !attendanceRecord?.checkOut ? (
                <>
                  <Clock className="w-4 h-4" />
                  <span>Check Out</span>
                </>
              ) : (
                <span>Shift Completed</span>
              )}
            </button>
          </div>

          {/* Quick Work Log & Recent Records (Pure Work Logs) */}
          <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8DEE9] dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#5B4BFF]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#101828] dark:text-white">
                  Today's Work Log ({workLogs.length})
                </h3>
              </div>
              <button
                onClick={() => handleOpenLogModal()}
                className="text-[11px] font-bold text-[#5B4BFF] hover:underline flex items-center gap-1 cursor-pointer"
              >
                + Add Entry
              </button>
            </div>

            {workLogs.length === 0 ? (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] text-center py-4 border border-dashed border-[#D8DEE9] dark:border-white/10 rounded-xl">
                No work logged yet today. Click <strong>+ Add Entry</strong> to record work.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {workLogs.map(log => {
                  const isManual = log.source === 'manual' || !log.taskId;
                  return (
                    <div
                      key={log.id}
                      className="p-3 bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl space-y-1.5 text-xs hover:border-[#5B4BFF]/40 transition-all group shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span 
                          title={log.clientName}
                          className="font-bold text-[#101828] dark:text-white truncate max-w-[150px] text-xs"
                        >
                          {log.clientName}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wider ${
                            isManual 
                              ? 'bg-[#EEECFF] text-[#5B4BFF] border border-[#5B4BFF]/25 dark:bg-[#201D45] dark:text-[#9A8CFF]' 
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}>
                            {isManual ? 'MANUAL' : 'TASK'}
                          </span>

                          {isManual && (
                            <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleOpenLogModal(log)}
                                title="Edit manual log"
                                className="p-1 rounded text-slate-500 hover:text-[#5B4BFF] hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteWorkLog(log.id, e)}
                                title="Delete manual log"
                                className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <p 
                        title={log.workDone}
                        className="text-[11px] font-medium text-[#475467] dark:text-[#CBD5E1] leading-relaxed line-clamp-2 break-words"
                      >
                        {log.workDone}
                      </p>

                      {log.workDetails && (
                        <p 
                          title={log.workDetails}
                          className="text-[10px] text-[#7A8496] italic line-clamp-2 break-words"
                        >
                          {log.workDetails}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-[#7A8496] pt-1 border-t border-[#D8DEE9]/40 dark:border-white/5">
                        <span className="font-semibold text-[#5B4BFF] dark:text-[#9A8CFF] truncate max-w-[140px]">
                          {log.category || 'General'}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {log.hours ? <span>{log.hours}h</span> : null}
                          <span className="font-bold">Qty: {log.quantity}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Needs Your Attention Card */}
          <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 border-b border-[#D8DEE9] dark:border-white/10 pb-3">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-[#101828] dark:text-white">
                Needs Your Attention
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              {!attendanceRecord?.checkIn && (
                <div 
                  onClick={handleCheckIn}
                  className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 font-bold flex items-center justify-between cursor-pointer hover:bg-amber-100 transition-all"
                >
                  <span>Attendance Check-In Pending</span>
                  <span className="text-[10px] underline">Mark Now</span>
                </div>
              )}

              {overdueTasks.length > 0 && (
                <div 
                  onClick={() => setActiveTaskTab('overdue')}
                  className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 font-bold flex items-center justify-between cursor-pointer hover:bg-rose-100 transition-all"
                >
                  <span>{overdueTasks.length} Overdue Task{overdueTasks.length === 1 ? '' : 's'}</span>
                  <span className="text-[10px] underline">Review</span>
                </div>
              )}

              {attendanceRecord?.checkIn && overdueTasks.length === 0 && (
                <p className="text-xs text-emerald-600 font-bold flex items-center gap-1.5 py-1">
                  <Check className="w-4 h-4" /> Everything is running on track!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── ASSIGN TASK MODAL (creates canonical Task → visible in all views) ──── */}
      {assignTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[92vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#D8DEE9] dark:border-white/10 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-7 h-7 rounded-lg bg-[#5B4BFF]/10 text-[#5B4BFF] flex items-center justify-center">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-black text-[#101828] dark:text-white">
                    {isViewAs ? `Assign Task to ${activeEmployeeName}` : 'Assign Task to Myself'}
                  </h3>
                </div>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Creates a <strong className="text-[#5B4BFF]">planned task</strong> — appears in Delivery Board, Assignment Board &amp; My Tasks immediately.
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                  ✦ Use <em>Log Completed Work</em> instead if the work is already done.
                </p>
              </div>
              <button
                onClick={() => setAssignTaskModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Assignee identity badge */}
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#EEECFF]/60 dark:bg-[#1F1944]/60 border border-[#5B4BFF]/25">
              <div className="w-7 h-7 rounded-lg bg-[#5B4BFF] text-white flex items-center justify-center font-black text-[11px] shrink-0">
                {activeEmployeeName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-black text-[#101828] dark:text-white">{activeEmployeeName}</p>
                <p className="text-[10px] font-mono text-[#7A8496]">ID: {resolvedEmployeeId} · {activeEmployeeRole}</p>
              </div>
              <span className="ml-auto text-[9px] font-black px-2 py-0.5 rounded-full bg-[#5B4BFF] text-white">
                {isViewAs ? 'VIEW-AS' : 'MY WORKSPACE'}
              </span>
            </div>

            <form onSubmit={handleSaveAssignTask} className="space-y-3.5 text-xs">
              {/* Task Title */}
              <div>
                <label className="block font-bold text-[#344054] dark:text-[#CBD5E1] mb-1">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={assignTaskForm.title}
                  onChange={e => setAssignTaskForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Design Instagram Post, Edit Reel, Update Website…"
                  className="w-full p-2.5 rounded-xl border border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-medium outline-none focus:border-[#5B4BFF] transition-all"
                />
              </div>

              {/* Client / Brand */}
              <div>
                <label className="block font-bold text-[#344054] dark:text-[#CBD5E1] mb-1">Client / Brand</label>
                <select
                  value={assignTaskForm.clientId}
                  onChange={e => {
                    const chosen = uniqueClients.find(c => c.id === e.target.value);
                    setAssignTaskForm(p => ({
                      ...p,
                      clientId: e.target.value,
                      clientName: chosen?.name || ''
                    }));
                  }}
                  className="w-full p-2.5 rounded-xl border border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-bold outline-none cursor-pointer focus:border-[#5B4BFF]"
                >
                  <option value="">-- Select client --</option>
                  {uniqueClients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Category + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#344054] dark:text-[#CBD5E1] mb-1">Category</label>
                  <select
                    value={assignTaskForm.category}
                    onChange={e => setAssignTaskForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-bold outline-none cursor-pointer focus:border-[#5B4BFF]"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#344054] dark:text-[#CBD5E1] mb-1">Priority</label>
                  <select
                    value={assignTaskForm.priority}
                    onChange={e => setAssignTaskForm(p => ({ ...p, priority: e.target.value as any }))}
                    className="w-full p-2.5 rounded-xl border border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-bold outline-none cursor-pointer focus:border-[#5B4BFF]"
                  >
                    {(['Urgent', 'High', 'Medium', 'Low'] as const).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Scheduled Date + Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#5B4BFF] dark:text-[#9A8CFF] mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    required
                    value={assignTaskForm.scheduledDate}
                    onChange={e => setAssignTaskForm(p => ({ ...p, scheduledDate: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-bold outline-none focus:border-[#5B4BFF]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-rose-600 dark:text-rose-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={assignTaskForm.dueDate}
                    onChange={e => setAssignTaskForm(p => ({ ...p, dueDate: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-bold outline-none focus:border-[#5B4BFF]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-[#344054] dark:text-[#CBD5E1] mb-1">Description / Brief <span className="font-normal text-slate-400">(Optional)</span></label>
                <textarea
                  rows={2}
                  value={assignTaskForm.description}
                  onChange={e => setAssignTaskForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Add deliverable context, requirements, or links..."
                  className="w-full p-2.5 rounded-xl border border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-medium outline-none resize-none focus:border-[#5B4BFF]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#D8DEE9] dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setAssignTaskModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAssignTask || !assignTaskForm.title.trim()}
                  className="px-5 py-2.5 bg-[#5B4BFF] hover:bg-[#4E3FE6] text-white text-xs font-black rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingAssignTask ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Creating...</span></>
                  ) : (
                    <><CheckSquare className="w-3.5 h-3.5" /><span>Assign Task</span></>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MANUAL LOG WORK MODAL (SEARCHABLE COMBOBOX & SUGGESTIONS) ──── */}
      {workLogModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#D8DEE9] dark:border-white/10 pb-3">
              <div>
                <h3 className="text-base font-black text-[#101828] dark:text-white">
                  {editingLogId ? 'Edit Completed Work Log' : 'Log Completed Work'}
                </h3>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Recording completed work for: <strong className="text-[#5B4BFF]">{activeEmployeeName}</strong>
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                  ✦ Work already done. Use <em>Assign Task</em> for planned/future work.
                </p>
              </div>
              <button 
                onClick={() => setWorkLogModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualWorkLog} className="space-y-4 text-xs">
              
              {/* 1. Searchable Client / Brand Combobox */}
              <div className="relative" ref={clientComboboxRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-[#344054] dark:text-[#CBD5E1]">
                    Client / Brand <span className="text-rose-500">*</span>
                  </label>
                  {selectedClientObj && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Validated Client
                    </span>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={clientSearchQuery}
                    onFocus={() => setClientDropdownOpen(true)}
                    onChange={e => {
                      const q = e.target.value;
                      setClientSearchQuery(q);
                      const matched = uniqueClients.find(c => c.name.toLowerCase() === q.trim().toLowerCase());
                      setLogForm(p => ({
                        ...p,
                        clientName: q,
                        clientId: matched ? matched.id : ''
                      }));
                      setClientDropdownOpen(true);
                      setClientActiveIndex(0);
                    }}
                    onKeyDown={e => {
                      if (!clientDropdownOpen) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setClientActiveIndex(prev => (prev + 1) % Math.max(1, filteredClients.length));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setClientActiveIndex(prev => (prev - 1 + filteredClients.length) % Math.max(1, filteredClients.length));
                      } else if (e.key === 'Enter') {
                        if (filteredClients[clientActiveIndex]) {
                          e.preventDefault();
                          const chosen = filteredClients[clientActiveIndex];
                          setLogForm(p => ({ ...p, clientName: chosen.name, clientId: chosen.id }));
                          setClientSearchQuery(chosen.name);
                          setClientDropdownOpen(false);
                        }
                      } else if (e.key === 'Escape') {
                        setClientDropdownOpen(false);
                      }
                    }}
                    placeholder="Search client or brand name (e.g. Anupam, Nexus, Gangotri)..."
                    className={`w-full pl-9 pr-8 py-2.5 rounded-xl border bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-bold outline-none transition-all ${
                      formTouched && !selectedClientObj 
                        ? 'border-rose-500 focus:ring-1 focus:ring-rose-500' 
                        : 'border-[#D8DEE9] dark:border-white/10 focus:border-[#5B4BFF]'
                    }`}
                  />
                  {clientSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setClientSearchQuery('');
                        setLogForm(p => ({ ...p, clientName: '', clientId: '' }));
                        setClientDropdownOpen(true);
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {formTouched && !selectedClientObj && (
                  <p className="text-[11px] text-rose-500 mt-1 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Please select a recognized client from the list
                  </p>
                )}

                {/* Autocomplete Dropdown */}
                {clientDropdownOpen && filteredClients.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-[#141A32] border border-[#D8DEE9] dark:border-white/15 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 animate-in fade-in slide-in-from-top-1">
                    {filteredClients.map((client, idx) => {
                      const isSelected = (logForm.clientName || '').toLowerCase() === client.name.toLowerCase();
                      const isActive = idx === clientActiveIndex;
                      return (
                        <div
                          key={client.id || client.name}
                          onClick={() => {
                            setLogForm(p => ({ ...p, clientName: client.name, clientId: client.id }));
                            setClientSearchQuery(client.name);
                            setClientDropdownOpen(false);
                          }}
                          className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isActive ? 'bg-[#EEECFF] dark:bg-[#201D45]' : isSelected ? 'bg-slate-50 dark:bg-white/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-[#5B4BFF]/10 text-[#5B4BFF] dark:text-[#9A8CFF] flex items-center justify-center font-black text-[11px] shrink-0">
                              {client.avatar}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-[#101828] dark:text-white truncate">
                                {client.name}
                              </p>
                              {client.industry && (
                                <p className="text-[10px] text-[#7A8496] truncate">
                                  {client.industry}
                                </p>
                              )}
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-[#5B4BFF] shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Intelligent Deliverable Suggestive Search */}
              <div className="relative" ref={deliverableRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-[#344054] dark:text-[#CBD5E1]">
                    Work Description / Deliverable Title <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[10px] font-mono ${
                    logForm.workDone.length > 180 ? 'text-amber-500 font-bold' : 'text-[#7A8496]'
                  }`}>
                    {logForm.workDone.length}/200
                  </span>
                </div>
                
                <input
                  type="text"
                  required
                  maxLength={200}
                  placeholder="e.g. Instagram Reel Editing, Video Shoot, Website Update..."
                  value={logForm.workDone}
                  onFocus={() => setDeliverableSuggestionsOpen(true)}
                  onChange={e => {
                    const val = e.target.value;
                    const autoCat = inferCategoryFromDeliverable(val);
                    
                    setLogForm(p => ({
                      ...p,
                      workDone: val
                    }));

                    // AI Suggestion behavior: Never silently overwrite if user has chosen category
                    if (!isCategoryManual && autoCat && autoCat !== logForm.category) {
                      setInferredCategorySuggestion(autoCat);
                    } else {
                      setInferredCategorySuggestion(null);
                    }

                    setDeliverableSuggestionsOpen(true);
                    setDeliverableActiveIndex(0);
                  }}
                  onKeyDown={e => {
                    if (!deliverableSuggestionsOpen) return;
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setDeliverableActiveIndex(prev => (prev + 1) % Math.max(1, clientDeliverableSuggestions.length));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setDeliverableActiveIndex(prev => (prev - 1 + clientDeliverableSuggestions.length) % Math.max(1, clientDeliverableSuggestions.length));
                    } else if (e.key === 'Enter') {
                      if (clientDeliverableSuggestions[deliverableActiveIndex]) {
                        e.preventDefault();
                        handleSelectDeliverable(clientDeliverableSuggestions[deliverableActiveIndex]);
                      }
                    } else if (e.key === 'Escape') {
                      setDeliverableSuggestionsOpen(false);
                    }
                  }}
                  className={`w-full p-2.5 rounded-xl border bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-medium outline-none transition-all ${
                    formTouched && formValidation.errors.title
                      ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-[#D8DEE9] dark:border-white/10 focus:border-[#5B4BFF]'
                  }`}
                />

                {formTouched && formValidation.errors.title && (
                  <p className="text-[11px] text-rose-500 mt-1 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {formValidation.errors.title}
                  </p>
                )}

                {/* AI Inferred Category Suggestion Chip (Explicit User Confirmation) */}
                {inferredCategorySuggestion && !isCategoryManual && (
                  <div className="mt-2 p-2 rounded-xl bg-[#EEECFF] dark:bg-[#201D45] border border-[#5B4BFF]/30 flex items-center justify-between animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#5B4BFF] dark:text-[#9A8CFF]" />
                      <span className="text-[11px] text-[#344054] dark:text-[#CBD5E1]">
                        Suggested Category: <strong className="text-[#5B4BFF] dark:text-[#9A8CFF]">{inferredCategorySuggestion}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleApplySuggestedCategory}
                      className="px-2.5 py-1 bg-[#5B4BFF] hover:bg-[#4E3FE6] text-white text-[10px] font-black rounded-lg cursor-pointer transition-all shadow-2xs"
                    >
                      Apply
                    </button>
                  </div>
                )}

                {/* Deliverable Suggestions Dropdown */}
                {deliverableSuggestionsOpen && clientDeliverableSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-[#141A32] border border-[#D8DEE9] dark:border-white/15 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 animate-in fade-in slide-in-from-top-1">
                    <div className="p-2 bg-slate-50 dark:bg-white/5 text-[10px] font-black uppercase text-[#7A8496] tracking-wider flex items-center justify-between">
                      <span>Suggested Deliverables</span>
                      <span>Click to select title & category</span>
                    </div>
                    {clientDeliverableSuggestions.map((item, idx) => {
                      const isActive = idx === deliverableActiveIndex;
                      return (
                        <div
                          key={item.label}
                          onClick={() => handleSelectDeliverable(item)}
                          className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isActive ? 'bg-[#EEECFF] dark:bg-[#201D45]' : 'hover:bg-slate-50 dark:hover:bg-white/5'
                          }`}
                        >
                          <span className="font-bold text-xs text-[#101828] dark:text-white truncate">
                            {item.label}
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#5B4BFF]/10 text-[#5B4BFF] dark:text-[#9A8CFF] shrink-0">
                            {item.category}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Category & Quantity (Responsive 2-column) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-[#344054] dark:text-[#CBD5E1]">
                      Category <span className="text-rose-500">*</span>
                    </label>
                    {isCategoryManual && (
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                        Manual
                      </span>
                    )}
                  </div>
                  <select
                    value={logForm.category}
                    onChange={e => {
                      setLogForm(p => ({ ...p, category: e.target.value }));
                      setIsCategoryManual(true);
                      setInferredCategorySuggestion(null);
                    }}
                    className="w-full p-2.5 rounded-xl border border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-bold outline-none cursor-pointer focus:border-[#5B4BFF]"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#344054] dark:text-[#CBD5E1] block mb-1">
                    Quantity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    required
                    value={logForm.quantity}
                    onChange={e => setLogForm(p => ({ ...p, quantity: e.target.value }))}
                    className={`w-full p-2.5 rounded-xl border bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-bold outline-none focus:border-[#5B4BFF] ${
                      formTouched && formValidation.errors.quantity ? 'border-rose-500' : 'border-[#D8DEE9] dark:border-white/10'
                    }`}
                  />
                  {formTouched && formValidation.errors.quantity && (
                    <p className="text-[10px] text-rose-500 mt-1 font-semibold">{formValidation.errors.quantity}</p>
                  )}
                </div>
              </div>

              {/* 4. Date & Estimated Hours */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#344054] dark:text-[#CBD5E1] block mb-1">
                    Date of Work <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={logForm.date}
                    onChange={e => setLogForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-medium outline-none focus:border-[#5B4BFF]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#344054] dark:text-[#CBD5E1] block mb-1">
                    Hours Spent <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    placeholder="e.g. 2.5"
                    value={logForm.hours}
                    onChange={e => setLogForm(p => ({ ...p, hours: e.target.value }))}
                    className={`w-full p-2.5 rounded-xl border bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-medium outline-none focus:border-[#5B4BFF] ${
                      formTouched && formValidation.errors.hours ? 'border-rose-500' : 'border-[#D8DEE9] dark:border-white/10'
                    }`}
                  />
                  {formTouched && formValidation.errors.hours && (
                    <p className="text-[10px] text-rose-500 mt-1 font-semibold">{formValidation.errors.hours}</p>
                  )}
                </div>
              </div>

              {/* 5. Optional Notes / Work Details */}
              <div>
                <label className="font-bold text-[#344054] dark:text-[#CBD5E1] block mb-1">
                  Optional Notes / Creative Brief Details
                </label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  placeholder="Additional context or links (e.g. Drive folder, raw footage link, special instructions)..."
                  value={logForm.workDetails}
                  onChange={e => setLogForm(p => ({ ...p, workDetails: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-[#D8DEE9] dark:border-white/10 bg-[#F8FAFC] dark:bg-[#161B31] text-[#101828] dark:text-white font-medium outline-none resize-none focus:border-[#5B4BFF]"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#D8DEE9] dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setWorkLogModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLog || (formTouched && !formValidation.isValid)}
                  className="px-5 py-2.5 bg-[#5B4BFF] hover:bg-[#4E3FE6] text-white text-xs font-black rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingLog ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingLogId ? 'Update Work Log' : 'Save Work Log'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
