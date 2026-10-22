import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  FileText, Download, Printer, Filter, Calendar, Award, ChevronDown,
  Instagram, Facebook, Youtube, Linkedin, TrendingUp, BarChart3,
  History, Settings, Plus, Trash2, RefreshCw, Eye, CheckCircle2,
  AlertCircle, Loader2, Globe, Users, Target, Sparkles, Check,
  AlertTriangle, ArrowRight, Video, CheckSquare, Layers, Clock, X,
  ExternalLink, Search, ShieldCheck, Briefcase, Copy, FileCheck,
  ChevronLeft, ChevronRight, Bookmark, FileSpreadsheet, Send, MessageSquare,
  HelpCircle, UserCheck, UserX, AlertOctagon, User, ArrowUpRight,
  Play, Pause, Square, Timer
} from 'lucide-react';
import {
  collection, onSnapshot, addDoc, doc, setDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { type ClientData } from './ClientList';
import {
  DEFAULT_CLIENTS_MASTER,
  getCachedClients,
  subscribeToCanonicalClients
} from '../../lib/clientMaster';
import {
  CalendarEntry,
  getCachedCalendarEntries
} from '../../lib/calendarStorage';
import {
  Task,
  getCachedTasks,
  subscribeToCanonicalTasks
} from '../../lib/taskStorage';
import {
  CENTRAL_EMPLOYEES_MASTER_LIST,
  getCachedEmployees,
  subscribeToCanonicalEmployees,
  type MasterEmployee
} from '../../lib/employeeMaster';
import {
  DailyReportSubmission,
  getCachedDailyReports,
  saveOrSubmitDailyReport,
  reviewDailyReportSubmission,
  subscribeToDailyReports,
  getKolkataDateString
} from '../../lib/dailyReportService';
import {
  exportReportToPDF,
  exportReportToXLSX,
  exportReportToCSV,
  triggerPrintReport,
  generateDailyReport2PDF
} from '../../lib/reportExportUtils';
import {
  classifyDailyReport,
  ClassifiedDailyReport,
  ClassifiedTaskItem,
  PRIORITY_COLORS,
  PRIORITY_BG_COLORS,
  PRIORITY_BORDER_COLORS
} from '../../lib/dailyReportClassifier';
import {
  startTaskTimer,
  pauseTaskTimer,
  stopAndLogTaskTimer,
  getTaskTimerSession,
  getTaskTimerSeconds,
  formatDurationMinutes,
  formatDurationHours
} from '../../lib/taskTimerService';
import {
  generateMonthlyPDFReport,
  DEFAULT_AGENCY_BRANDING
} from '../../lib/pdfReportGenerator';

// ── Types ─────────────────────────────────────────────────────────────
export type MainReportTab =
  | 'overview'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'employee'
  | 'client'
  | 'submission_tracker'
  | 'custom';

export type ClientReportSubTab =
  | 'overview'
  | 'deliverables'
  | 'operations'
  | 'analytics'
  | 'team'
  | 'history';

export type ReportType = 'full_monthly' | 'social_content' | 'delivery_operations' | 'video_production';

export interface SavedReportSnapshot {
  id: string;
  reportReference: string;
  clientId: string;
  clientName: string;
  month: string; // YYYY-MM
  year: number;
  reportType: ReportType;
  metrics: {
    totalPlanned: number;
    livePublished: number;
    clientApproved: number;
    channelsActive: number;
    tasksTotal: number;
    tasksCompleted: number;
    videosTotal: number;
    videosFinished: number;
    pendingApprovals: number;
    revisionsCount: number;
  };
  executiveSummary: string;
  highlights: string;
  nextMonthStrategy: string;
  generatedAt: string;
  generatedBy: string;
  generatedById: string;
  contentSnapshot: CalendarEntry[];
  taskSnapshot: any[];
  videoSnapshot: any[];
  teamContributions: { employeeName: string; role: string; deliverablesCount: number; hoursLogged: number }[];
  pdf_status?: 'valid' | 'missing' | 'invalid';
  pdf_filename?: string;
  pdf_size_bytes?: number;
}

const REPORT_TYPE_CONFIGS: { id: ReportType; label: string; desc: string }[] = [
  { id: 'full_monthly', label: 'Full Monthly Client Report', desc: 'Comprehensive report covering Social Content, Video Production, Task Deliverables & Approvals.' },
  { id: 'social_content', label: 'Social Content Report', desc: 'Focused performance breakdown of planned posts, published reels, carousels & channel distribution.' },
  { id: 'delivery_operations', label: 'Delivery & Operations Report', desc: 'Agency operational summary with task completion velocity and review workflows.' },
  { id: 'video_production', label: 'Video Production Report', desc: 'Production studio tracker with shoot schedules, editing queues and finished assets.' }
];

const LS_SAVED_REPORTS_KEY = 'digi_client_reports_v2';
const LS_REPORT_SEQ_KEY = 'digi_client_report_seq_v2';

function commitReportReference(month: string): string {
  const parts = month.split('-');
  const year = parts[0] || '2026';
  const m = parts[1] || '10';
  let seq = 42;
  try {
    const raw = localStorage.getItem(LS_REPORT_SEQ_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      seq = parsed[`${year}_${m}`] || 42;
    }
  } catch {}
  seq++;
  try {
    const raw = localStorage.getItem(LS_REPORT_SEQ_KEY);
    const curr = raw ? JSON.parse(raw) : {};
    curr[`${year}_${m}`] = seq;
    localStorage.setItem(LS_REPORT_SEQ_KEY, JSON.stringify(curr));
  } catch {}
  const padded = String(seq).padStart(4, '0');
  return `DEA/REPORT/${year}/${m}/${padded}`;
}

function sanitizeFilenameSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function buildCanonicalFilename(clientName: string, formattedMonth: string, year: number, refNumber: string): string {
  const safeName = sanitizeFilenameSegment(clientName);
  const safeMonth = sanitizeFilenameSegment(formattedMonth);
  const safeRef = refNumber.replace(/\//g, '-');
  return `Digiexplode_${safeName}_${safeMonth}_${year}_${safeRef}.pdf`;
}

export const ReportsView: React.FC = () => {
  const { user, profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin' || profile?.role === 'superAdmin' || profile?.role === 'admin' || !profile?.role;
  const isManager = isSuperAdmin || profile?.role === 'manager' || profile?.role === 'team_lead';
  const isEmployeeRole = profile?.role === 'employee';

  // ── 1. PRIMARY NAVIGATION ──────────────────────────────────────────
  const [activeMainTab, setActiveMainTab] = useState<MainReportTab>(() => {
    return profile?.role === 'employee' ? 'daily' : 'overview';
  });

  useEffect(() => {
    if (isEmployeeRole && (activeMainTab === 'overview' || activeMainTab === 'client' || activeMainTab === 'submission_tracker')) {
      setActiveMainTab('daily');
    }
  }, [isEmployeeRole]);

  // ── 2. LIVE DATASETS CONNECTED TO AUTHORITATIVE SYSTEM ─────────────
  const [clients, setClients] = useState<ClientData[]>(() => getCachedClients());
  const [employees, setEmployees] = useState<MasterEmployee[]>(() => getCachedEmployees());
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>(() => getCachedCalendarEntries());
  const [tasks, setTasks] = useState<Task[]>(() => getCachedTasks());
  const [workLogs, setWorkLogs] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('digi_persisted_worklogs_v2') || localStorage.getItem('digi_worklogs_cache');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [videos, setVideos] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('digi_video_tracker_cache');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [approvals, setApprovals] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('digi_approvals_cache');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [dailyReports, setDailyReports] = useState<DailyReportSubmission[]>(() => getCachedDailyReports());
  const [savedReports, setSavedReports] = useState<SavedReportSnapshot[]>([]);

  // ── 3. DATE SELECTION CONTROLS ─────────────────────────────────────
  const todayKolkata = useMemo(() => getKolkataDateString(), []);
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(todayKolkata);
  
  // Weekly selection (Monday of current week)
  const currentWeekMonday = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    return mon.toISOString().split('T')[0];
  }, []);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(currentWeekMonday);

  // Monthly selection (YYYY-MM)
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  // Custom range
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(todayKolkata);

  // ── 4. FILTER CONTROLS ─────────────────────────────────────────────
  const [dailyMode, setDailyMode] = useState<'daily' | 'range'>('daily');
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('');
  const [filterClientId, setFilterClientId] = useState<string>('');
  const [filterTeam, setFilterTeam] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Daily Report 2.0 State
  const [pdfPreviewBlobUrl, setPdfPreviewBlobUrl] = useState<string | null>(null);
  const [isGeneratingDailyPdf, setIsGeneratingDailyPdf] = useState(false);
  const [activeTimersTick, setActiveTimersTick] = useState<number>(0);

  // ── 5. CLIENT MONTHLY REPORT STATE (PRESENTS EXISTING WORKING GENERATOR) ──
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientReportSubTab, setClientReportSubTab] = useState<ClientReportSubTab>('overview');
  const [reportType, setReportType] = useState<ReportType>('full_monthly');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [highlights, setHighlights] = useState('');
  const [nextMonthStrategy, setNextMonthStrategy] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [reviewModalReport, setReviewModalReport] = useState<DailyReportSubmission | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');

  // ── 6. EMPLOYEE DAILY SUBMISSION FORM STATE ────────────────────────
  const [empDailySummary, setEmpDailySummary] = useState('');
  const [empDailyBlockers, setEmpDailyBlockers] = useState('');
  const [empDailyNextPlan, setEmpDailyNextPlan] = useState('');
  const [isSubmittingDaily, setIsSubmittingDaily] = useState(false);

  const showToast = (type: 'success' | 'error' | 'info', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── 7. REACTIVE SUBSCRIPTIONS (Cross-Module Real-time Sync) ─────────
  useEffect(() => {
    const unsubClients = subscribeToCanonicalClients(setClients);
    const unsubEmployees = subscribeToCanonicalEmployees(setEmployees);
    const unsubTasks = subscribeToCanonicalTasks(setTasks);
    const unsubDaily = subscribeToDailyReports(setDailyReports);

    // Sync contentCalendar
    const unsubCal = onSnapshot(collection(db, 'contentCalendar'), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ contentId: d.id, ...d.data() } as CalendarEntry));
        setCalendarEntries(list);
      }
    }, () => {});

    // Sync workLogs
    const unsubWorkLogs = onSnapshot(collection(db, 'workLogs'), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setWorkLogs(list);
      }
    }, () => {});

    // Sync saved reports
    const unsubSaved = onSnapshot(collection(db, 'client_reports'), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedReportSnapshot));
        setSavedReports(list);
      }
    }, () => {});

    // Sync active task timers and work logs local events
    const handleTimerChange = () => setActiveTimersTick(t => t + 1);
    if (typeof window !== 'undefined') {
      window.addEventListener('digi_task_timer_updated', handleTimerChange);
      window.addEventListener('worklogs_updated', handleTimerChange);
    }

    return () => {
      unsubClients();
      unsubEmployees();
      unsubTasks();
      unsubCal();
      unsubDaily();
      unsubWorkLogs();
      unsubSaved();
      if (typeof window !== 'undefined') {
        window.removeEventListener('digi_task_timer_updated', handleTimerChange);
        window.removeEventListener('worklogs_updated', handleTimerChange);
      }
    };
  }, []);

  // Current active employee identity
  const currentEmployee = useMemo(() => {
    const email = user?.email?.toLowerCase();
    const uid = user?.uid;
    return employees.find(e => 
      (email && e.email?.toLowerCase() === email) || 
      e.id === uid || 
      e.employeeId === uid
    ) || employees[0];
  }, [employees, user]);

  // Prefill employee daily report form if draft/submission exists for selectedDailyDate
  useEffect(() => {
    if (!currentEmployee) return;
    const existing = dailyReports.find(r => r.employeeId === currentEmployee.id && r.date === selectedDailyDate);
    if (existing) {
      setEmpDailySummary(existing.summary || '');
      setEmpDailyBlockers(existing.blockers || '');
      setEmpDailyNextPlan(existing.nextDayPlan || '');
    } else {
      setEmpDailySummary('');
      setEmpDailyBlockers('');
      setEmpDailyNextPlan('');
    }
  }, [currentEmployee, selectedDailyDate, dailyReports]);

  // ── 8. AGGREGATED CALCULATIONS (Single Source of Truth) ─────────────

  // A. All Tasks Filter Helper
  const isTaskOverdue = (t: Task): boolean => {
    if (t.status === 'Done' || t.status === 'Cancelled') return false;
    if (!t.dueDate) return false;
    return t.dueDate < todayKolkata;
  };

  // Active target employee id for filtering: if logged-in user is employee role, lock to their ID
  const effectiveDailyEmployeeId = useMemo(() => {
    if (isEmployeeRole && currentEmployee) {
      return currentEmployee.id || currentEmployee.employeeId;
    }
    return filterEmployeeId;
  }, [isEmployeeRole, currentEmployee, filterEmployeeId]);

  // B. Classified Daily Report 2.0 (Single Source of Truth)
  const classifiedDaily = useMemo(() => {
    return classifyDailyReport({
      tasks,
      workLogs,
      targetDate: selectedDailyDate,
      endDate: dailyMode === 'range' ? customEndDate : undefined,
      filterEmployeeId: effectiveDailyEmployeeId,
      filterClientId,
      filterPriority,
      filterCategory,
      filterStatus
    });
  }, [
    tasks,
    workLogs,
    selectedDailyDate,
    customEndDate,
    dailyMode,
    effectiveDailyEmployeeId,
    filterClientId,
    filterPriority,
    filterCategory,
    filterStatus,
    activeTimersTick
  ]);

  // Backward-compatible dailyRecords view
  const dailyRecords = useMemo(() => {
    const allClassifiedTasks = [
      ...classifiedDaily.completedToday.map(i => i.task),
      ...classifiedDaily.workedOnToday.map(i => i.task),
      ...classifiedDaily.newPending.map(i => i.task),
      ...classifiedDaily.previousPending.map(i => i.task),
      ...classifiedDaily.overdue.map(i => i.task)
    ];

    return {
      tasks: allClassifiedTasks,
      completedTasks: classifiedDaily.completedToday.map(i => i.task),
      pendingTasks: [
        ...classifiedDaily.newPending.map(i => i.task),
        ...classifiedDaily.previousPending.map(i => i.task),
        ...classifiedDaily.overdue.map(i => i.task)
      ],
      workLogs: classifiedDaily.timeBreakdown,
      deliverables: [],
      publishedContent: [],
      totalHours: classifiedDaily.summary.totalTimeLoggedHours
    };
  }, [classifiedDaily]);

  // C. Weekly Operational Records
  const weeklyRecords = useMemo(() => {
    const startDate = selectedWeekStart;
    const startObj = new Date(startDate);
    const endObj = new Date(startObj);
    endObj.setDate(startObj.getDate() + 6);
    const endDate = endObj.toISOString().split('T')[0];

    const weekTasks = tasks.filter(t => {
      if (t.status === 'Cancelled') return false;
      const d = t.scheduledDate || t.completedAt?.slice(0, 10);
      const inRange = d && d >= startDate && d <= endDate;
      const matchEmp = !filterEmployeeId || t.assigneeId === filterEmployeeId;
      const matchClient = !filterClientId || t.clientId === filterClientId;
      return inRange && matchEmp && matchClient;
    });

    const weekWorkLogs = workLogs.filter(wl => {
      const d = (wl.work_date || wl.date || '').slice(0, 10);
      const inRange = d && d >= startDate && d <= endDate;
      const matchEmp = !filterEmployeeId || wl.employeeId === filterEmployeeId;
      const matchClient = !filterClientId || wl.clientId === filterClientId;
      return inRange && matchEmp && matchClient;
    });

    const weekDeliverables = calendarEntries.filter(c => {
      const d = (c.date || '').slice(0, 10);
      const inRange = d && d >= startDate && d <= endDate;
      const matchEmp = !filterEmployeeId || c.assigneeId === filterEmployeeId;
      const matchClient = !filterClientId || c.clientId === filterClientId;
      return inRange && matchEmp && matchClient;
    });

    const completed = weekTasks.filter(t => t.status === 'Done');
    const totalHours = weekWorkLogs.reduce((acc, wl) => acc + (Number(wl.hours) || Number(wl.durationHours) || 0), 0);
    const published = weekDeliverables.filter(c => c.status === 'Posted' || c.postedStatus === 'Posted');

    // Day by day distribution (Mon to Sun)
    const dayBreakdown = Array.from({ length: 7 }, (_, i) => {
      const cur = new Date(startObj);
      cur.setDate(startObj.getDate() + i);
      const curStr = cur.toISOString().split('T')[0];
      const dayName = cur.toLocaleDateString('en-US', { weekday: 'short' });
      const dayCompleted = completed.filter(t => (t.completedAt || t.scheduledDate)?.startsWith(curStr)).length;
      const dayHrs = weekWorkLogs.filter(wl => (wl.work_date || wl.date)?.startsWith(curStr)).reduce((a, b) => a + (Number(b.hours) || 0), 0);
      return { date: curStr, dayName, completedCount: dayCompleted, hours: Math.round(dayHrs * 10) / 10 };
    });

    return {
      startDate,
      endDate,
      tasks: weekTasks,
      completedTasks: completed,
      pendingTasks: weekTasks.filter(t => t.status !== 'Done'),
      totalHours: Math.round(totalHours * 10) / 10,
      deliverables: weekDeliverables,
      publishedContent: published,
      dayBreakdown
    };
  }, [tasks, workLogs, calendarEntries, selectedWeekStart, filterEmployeeId, filterClientId]);

  // D. Monthly Operational Records
  const monthlyRecords = useMemo(() => {
    const month = selectedMonth;

    const monthTasks = tasks.filter(t => {
      if (t.status === 'Cancelled') return false;
      const d = t.scheduledDate || t.completedAt?.slice(0, 10) || t.createdAt?.slice(0, 10);
      const inMonth = d && d.startsWith(month);
      const matchEmp = !filterEmployeeId || t.assigneeId === filterEmployeeId;
      const matchClient = !filterClientId || t.clientId === filterClientId;
      return inMonth && matchEmp && matchClient;
    });

    const monthDeliverables = calendarEntries.filter(c => {
      const d = (c.date || c.createdAt || '').slice(0, 7);
      const inMonth = d === month;
      const matchEmp = !filterEmployeeId || c.assigneeId === filterEmployeeId;
      const matchClient = !filterClientId || c.clientId === filterClientId;
      return inMonth && matchEmp && matchClient;
    });

    const monthWorkLogs = workLogs.filter(wl => {
      const d = (wl.work_date || wl.date || '').slice(0, 7);
      const inMonth = d === month;
      const matchEmp = !filterEmployeeId || wl.employeeId === filterEmployeeId;
      const matchClient = !filterClientId || wl.clientId === filterClientId;
      return inMonth && matchEmp && matchClient;
    });

    const completed = monthTasks.filter(t => t.status === 'Done');
    const totalHours = monthWorkLogs.reduce((acc, wl) => acc + (Number(wl.hours) || Number(wl.durationHours) || 0), 0);
    const published = monthDeliverables.filter(c => c.status === 'Posted' || c.postedStatus === 'Posted');

    return {
      month,
      tasks: monthTasks,
      completedTasks: completed,
      pendingTasks: monthTasks.filter(t => t.status !== 'Done'),
      overdueTasks: monthTasks.filter(isTaskOverdue),
      totalHours: Math.round(totalHours * 10) / 10,
      deliverables: monthDeliverables,
      publishedContent: published
    };
  }, [tasks, calendarEntries, workLogs, selectedMonth, filterEmployeeId, filterClientId]);

  // E. Employee Performance Metrics Table
  const employeePerformanceList = useMemo(() => {
    const targetPool = isEmployeeRole && currentEmployee ? [currentEmployee] : employees;
    return targetPool.map(emp => {
      const empTasks = tasks.filter(t => t.assigneeId === emp.id || t.assigneeId === emp.employeeId);
      const completed = empTasks.filter(t => t.status === 'Done');
      const pending = empTasks.filter(t => t.status !== 'Done' && t.status !== 'Cancelled');
      const overdue = empTasks.filter(isTaskOverdue);

      const empWorkLogs = workLogs.filter(wl => wl.employeeId === emp.id || wl.employeeId === emp.employeeId);
      const hoursLogged = empWorkLogs.reduce((acc, wl) => acc + (Number(wl.hours) || Number(wl.durationHours) || 0), 0);

      const empDeliverables = calendarEntries.filter(c => c.assigneeId === emp.id || c.assigneeId === emp.employeeId);
      const published = empDeliverables.filter(c => c.status === 'Posted' || c.postedStatus === 'Posted');
      const approved = empDeliverables.filter(c => c.status === 'Approved' || c.clientApprovalStatus === 'Approved');

      // Handled clients
      const clientSet = new Set<string>();
      empTasks.forEach(t => t.clientName && clientSet.add(t.clientName));
      empWorkLogs.forEach(w => w.clientName && clientSet.add(w.clientName));

      // On time completion
      const onTimeCount = completed.filter(t => !t.dueDate || !t.completedAt || t.completedAt.slice(0, 10) <= t.dueDate).length;
      const onTimeRate = completed.length > 0 ? Math.round((onTimeCount / completed.length) * 100) : 100;

      // Daily report submissions
      const submissions = dailyReports.filter(r => r.employeeId === emp.id && r.status !== 'Draft');

      return {
        employee: emp,
        tasksAssigned: empTasks.length,
        tasksCompleted: completed.length,
        tasksPending: pending.length,
        tasksOverdue: overdue.length,
        onTimeRate,
        hoursLogged: Math.round(hoursLogged * 10) / 10,
        clientsHandled: clientSet.size,
        deliverablesSubmitted: empDeliverables.length,
        deliverablesApproved: approved.length,
        deliverablesPublished: published.length,
        dailyReportsCount: submissions.length
      };
    });
  }, [employees, tasks, workLogs, calendarEntries, dailyReports, todayKolkata, isEmployeeRole, currentEmployee]);

  // F. Daily Submission Tracker Statuses
  const dailyTrackerRecords = useMemo(() => {
    const targetDate = selectedDailyDate;
    const targetPool = isEmployeeRole && currentEmployee ? [currentEmployee] : employees;
    return targetPool.map(emp => {
      const submission = dailyReports.find(r => r.employeeId === emp.id && r.date === targetDate);
      let status: 'Submitted' | 'Reviewed' | 'Returned' | 'Pending' | 'Late' = 'Pending';
      if (submission) {
        if (submission.status === 'Reviewed') status = 'Reviewed';
        else if (submission.status === 'Returned') status = 'Returned';
        else if (submission.status === 'Submitted') {
          status = submission.isLate ? 'Late' : 'Submitted';
        }
      } else if (targetDate < todayKolkata) {
        status = 'Late';
      }

      const dayLogs = workLogs.filter(wl => (wl.employeeId === emp.id) && ((wl.work_date || wl.date || '').slice(0, 10) === targetDate));
      const hours = dayLogs.reduce((acc, wl) => acc + (Number(wl.hours) || 0), 0);
      const completedDayTasks = tasks.filter(t => (t.assigneeId === emp.id) && t.status === 'Done' && (t.completedAt?.startsWith(targetDate) || t.scheduledDate === targetDate)).length;

      return {
        employee: emp,
        submission,
        status,
        hoursLogged: Math.round(hours * 10) / 10,
        completedTasksCount: completedDayTasks
      };
    });
  }, [employees, dailyReports, selectedDailyDate, todayKolkata, workLogs, tasks]);

  // G. Unified Client Monthly Data (For Client Presentation & PDF Generator)
  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId || (c as any).clientId === selectedClientId) || null;
  }, [clients, selectedClientId]);

  const clientUnifiedData = useMemo(() => {
    if (!selectedClient) return null;
    const cid = selectedClient.id || (selectedClient as any).clientId;
    const cName = (selectedClient.clientName || selectedClient.name || '').toLowerCase();

    const clientEntries = calendarEntries.filter(c => {
      const matchId = c.clientId === cid;
      const matchName = (c.clientName || '').toLowerCase() === cName;
      const matchMonth = (c.date || c.createdAt || '').slice(0, 7) === selectedMonth;
      return (matchId || matchName) && matchMonth && c.status !== 'Cancelled';
    });

    const clientTasks = tasks.filter(t => {
      const matchId = t.clientId === cid;
      const matchName = (t.clientName || '').toLowerCase() === cName;
      const matchMonth = (t.scheduledDate || t.completedAt?.slice(0, 10) || '').slice(0, 7) === selectedMonth;
      return (matchId || matchName) && matchMonth && t.status !== 'Cancelled';
    });

    const clientWorkLogs = workLogs.filter(wl => {
      const matchId = wl.clientId === cid;
      const matchName = (wl.clientName || '').toLowerCase() === cName;
      const matchMonth = (wl.work_date || wl.date || '').slice(0, 7) === selectedMonth;
      return (matchId || matchName) && matchMonth;
    });

    const totalPlanned = clientEntries.length;
    const livePublished = clientEntries.filter(e => e.status === 'Posted' || e.postedStatus === 'Posted').length;
    const clientApproved = clientEntries.filter(e => e.clientApprovalStatus === 'Approved' || e.status === 'Approved').length;
    const tasksCompleted = clientTasks.filter(t => t.status === 'Done').length;
    const hoursLogged = clientWorkLogs.reduce((a, b) => a + (Number(b.hours) || 0), 0);

    return {
      totalPlanned,
      livePublished,
      clientApproved,
      tasksTotal: clientTasks.length,
      tasksCompleted,
      tasksPending: clientTasks.filter(t => t.status !== 'Done').length,
      totalHours: Math.round(hoursLogged * 10) / 10,
      deliverables: clientEntries,
      tasks: clientTasks,
      workLogs: clientWorkLogs
    };
  }, [selectedClient, calendarEntries, tasks, workLogs, selectedMonth]);

  // ── 9. EXPORT HANDLERS (PDF, Excel XLSX, CSV) ─────────────────────

  // Overview Export
  const handleExportOverview = (format: 'pdf' | 'xlsx' | 'csv') => {
    const config = {
      reportTitle: 'Digiexplode AI — Executive Operations Overview',
      reportSubtitle: 'Authoritative Agency Work & Deliverables Performance',
      periodLabel: `As of ${todayKolkata}`,
      generatedBy: profile?.name || 'Super Admin',
      summaryCards: [
        { label: 'Total Tasks', value: tasks.length },
        { label: 'Completed', value: tasks.filter(t => t.status === 'Done').length },
        { label: 'Pending', value: tasks.filter(t => t.status !== 'Done').length },
        { label: 'Overdue', value: tasks.filter(isTaskOverdue).length },
        { label: 'Work Logged', value: `${Math.round(workLogs.reduce((a, b) => a + (Number(b.hours) || 0), 0))} hrs` },
        { label: 'Published Content', value: calendarEntries.filter(e => e.status === 'Posted').length }
      ],
      tables: [
        {
          title: 'Recent Active Operational Tasks',
          headers: ['Task Title', 'Client', 'Assignee', 'Category', 'Priority', 'Status', 'Due Date'],
          rows: tasks.slice(0, 30).map(t => [
            t.title,
            t.clientName || 'General',
            t.assigneeName || 'Unassigned',
            t.category || 'General',
            t.priority,
            t.status,
            t.dueDate || '-'
          ])
        }
      ],
      filenameBase: 'DigiexplodeAI_Operations_Overview'
    };

    if (format === 'pdf') exportReportToPDF(config);
    else if (format === 'xlsx') exportReportToXLSX(config);
    else exportReportToCSV(config);

    showToast('success', `Exported Overview as ${format.toUpperCase()}`);
  };

  // Daily Report 2.0 Export Handlers
  const handleExportDaily = async (format: 'pdf' | 'xlsx' | 'csv') => {
    const empName = effectiveDailyEmployeeId ? employees.find(e => e.id === effectiveDailyEmployeeId || e.employeeId === effectiveDailyEmployeeId)?.name : 'All Employees';
    const clientName = filterClientId ? clients.find(c => (c.id || c.clientId) === filterClientId)?.clientName : 'All Clients';
    const filterDesc = `Employee: ${empName} | Client: ${clientName}${filterPriority !== 'All' ? ` | Priority: ${filterPriority}` : ''}${filterCategory !== 'All' ? ` | Category: ${filterCategory}` : ''}`;

    if (format === 'pdf') {
      setIsGeneratingDailyPdf(true);
      try {
        await generateDailyReport2PDF(classifiedDaily, {
          employeeName: empName,
          employeeRole: effectiveDailyEmployeeId ? employees.find(e => e.id === effectiveDailyEmployeeId || e.employeeId === effectiveDailyEmployeeId)?.role : undefined,
          generatedBy: profile?.name || 'Supervisor / Admin',
          filterSummary: filterDesc
        }, { download: true });
        showToast('success', 'Downloaded Official Daily Report 2.0 (A4 Landscape PDF)');
      } catch (err: any) {
        showToast('error', `Failed to generate PDF: ${err?.message || 'Error'}`);
      } finally {
        setIsGeneratingDailyPdf(false);
      }
    } else if (format === 'xlsx') {
      const config = {
        reportTitle: `Digiexplode AI — Daily Operations Report (${classifiedDaily.targetDate})`,
        reportSubtitle: 'Authoritative Date-Wise Deliverables, Tracked Durations & Time Summary',
        periodLabel: classifiedDaily.isRange ? `${classifiedDaily.targetDate} to ${classifiedDaily.endDate}` : classifiedDaily.targetDate,
        generatedBy: profile?.name || 'Supervisor / Admin',
        filterSummary: filterDesc,
        summaryCards: [
          { label: 'Completed Today', value: classifiedDaily.summary.completedTodayCount },
          { label: 'Worked On Today', value: classifiedDaily.summary.workedOnTodayCount },
          { label: 'Pending Tasks', value: classifiedDaily.summary.pendingCount },
          { label: 'Overdue', value: classifiedDaily.summary.overdueCount },
          { label: 'Total Time Logged', value: classifiedDaily.summary.totalTimeLoggedFormatted }
        ],
        tables: [
          {
            title: `Completed Today (${classifiedDaily.completedToday.length} tasks)`,
            headers: ['Task Title', 'Client', 'Category', 'Priority', 'Active Duration', 'Completed Date'],
            rows: classifiedDaily.completedToday.map(i => [
              i.task.title,
              i.task.clientName || 'General',
              i.task.category || 'Deliverable',
              i.task.priority,
              i.durationFormatted,
              i.completedDateKolkata || classifiedDaily.targetDate
            ])
          },
          {
            title: `Worked On Today (${classifiedDaily.workedOnToday.length} ongoing tasks)`,
            headers: ['Task Title', 'Client', 'Category', 'Status', 'Priority', 'Today Tracked Time'],
            rows: classifiedDaily.workedOnToday.map(i => [
              i.task.title,
              i.task.clientName || 'General',
              i.task.category || 'Deliverable',
              i.task.status,
              i.task.priority,
              i.durationFormatted
            ])
          },
          {
            title: `New Pending Tasks Assigned Today (${classifiedDaily.newPending.length})`,
            headers: ['Task Title', 'Client', 'Category', 'Priority', 'Due Date'],
            rows: classifiedDaily.newPending.map(i => [
              i.task.title,
              i.task.clientName || 'General',
              i.task.category || 'Deliverable',
              i.task.priority,
              i.dueDateKolkata || 'Not Set'
            ])
          },
          {
            title: `Previous Pending & Overdue Tasks (${classifiedDaily.overdue.length} overdue · ${classifiedDaily.previousPending.length} carried forward)`,
            headers: ['Task Title', 'Client', 'Category', 'Priority', 'Due Date', 'Status / Ageing', 'Blocked Status'],
            rows: [
              ...classifiedDaily.overdue.map(i => [i.task.title, i.task.clientName || 'General', i.task.category || 'General', i.task.priority, i.dueDateKolkata || 'Overdue', `OVERDUE (${i.daysOverdue}d)`, i.isBlocked ? 'Blocked' : 'Active']),
              ...classifiedDaily.previousPending.map(i => [i.task.title, i.task.clientName || 'General', i.task.category || 'General', i.task.priority, i.dueDateKolkata || 'No Deadline', `${i.daysPending} days pending`, i.isBlocked ? 'Blocked' : 'Active'])
            ]
          },
          {
            title: `Daily Time Summary (${classifiedDaily.timeBreakdown.length} records · Total: ${classifiedDaily.summary.totalTimeLoggedFormatted})`,
            headers: ['Task / Activity Description', 'Client', 'Category', 'Status', 'Active Duration'],
            rows: classifiedDaily.timeBreakdown.map(tb => [tb.taskTitle, tb.clientName, tb.category, tb.status, tb.formatted])
          }
        ],
        filenameBase: `Digiexplode_Daily_Report_${classifiedDaily.targetDate}`
      };
      exportReportToXLSX(config);
      showToast('success', 'Exported Daily Report as Excel');
    } else {
      const config = {
        reportTitle: `Digiexplode AI — Daily Operations Report (${classifiedDaily.targetDate})`,
        periodLabel: classifiedDaily.targetDate,
        generatedBy: profile?.name || 'Supervisor / Admin',
        filterSummary: filterDesc,
        summaryCards: [
          { label: 'Completed Today', value: classifiedDaily.summary.completedTodayCount },
          { label: 'Worked On Today', value: classifiedDaily.summary.workedOnTodayCount },
          { label: 'Pending', value: classifiedDaily.summary.pendingCount },
          { label: 'Overdue', value: classifiedDaily.summary.overdueCount },
          { label: 'Total Hours', value: classifiedDaily.summary.totalTimeLoggedFormatted }
        ],
        tables: [
          {
            title: 'Completed Today',
            headers: ['Task Title', 'Client', 'Category', 'Priority', 'Duration'],
            rows: classifiedDaily.completedToday.map(i => [i.task.title, i.task.clientName || 'General', i.task.category || 'General', i.task.priority, i.durationFormatted])
          },
          {
            title: 'Pending & Overdue',
            headers: ['Task Title', 'Client', 'Category', 'Priority', 'Due Date', 'Status'],
            rows: [
              ...classifiedDaily.overdue.map(i => [i.task.title, i.task.clientName || 'General', i.task.category || 'General', i.task.priority, i.dueDateKolkata || 'Overdue', `Overdue ${i.daysOverdue}d`]),
              ...classifiedDaily.previousPending.map(i => [i.task.title, i.task.clientName || 'General', i.task.category || 'General', i.task.priority, i.dueDateKolkata || 'Active', `${i.daysPending}d Pending`])
            ]
          }
        ],
        filenameBase: `Digiexplode_Daily_Report_${classifiedDaily.targetDate}`
      };
      exportReportToCSV(config);
      showToast('success', 'Exported Daily Report as CSV');
    }
  };

  // Live PDF Preview Handler (Identical Data Engine)
  const handlePreviewDailyPDF = async () => {
    setIsGeneratingDailyPdf(true);
    try {
      const empName = effectiveDailyEmployeeId ? employees.find(e => e.id === effectiveDailyEmployeeId || e.employeeId === effectiveDailyEmployeeId)?.name : 'All Employees';
      const clientName = filterClientId ? clients.find(c => (c.id || c.clientId) === filterClientId)?.clientName : 'All Clients';
      const filterDesc = `Employee: ${empName} | Client: ${clientName}${filterPriority !== 'All' ? ` | Priority: ${filterPriority}` : ''}${filterCategory !== 'All' ? ` | Category: ${filterCategory}` : ''}`;

      const doc = await generateDailyReport2PDF(classifiedDaily, {
        employeeName: empName,
        employeeRole: effectiveDailyEmployeeId ? employees.find(e => e.id === effectiveDailyEmployeeId || e.employeeId === effectiveDailyEmployeeId)?.role : undefined,
        generatedBy: profile?.name || 'Supervisor / Admin',
        filterSummary: filterDesc
      }, { download: false });

      const blobUrl = doc.output('bloburl');
      setPdfPreviewBlobUrl(blobUrl.toString());
    } catch (err: any) {
      showToast('error', `Failed to render PDF preview: ${err?.message || 'Error'}`);
    } finally {
      setIsGeneratingDailyPdf(false);
    }
  };

  // Lightweight Task Timer Handlers
  const handleToggleTimer = async (task: Task) => {
    const current = getTaskTimerSession(task.id);
    if (current?.isRunning) {
      pauseTaskTimer(task.id);
      setActiveTimersTick(t => t + 1);
      showToast('info', `Paused timer for "${task.title}"`);
    } else {
      startTaskTimer({
        id: task.id,
        title: task.title,
        employeeId: currentEmployee?.id || user?.uid || 'emp_active',
        employeeName: currentEmployee?.name || profile?.name || 'Team Member',
        clientId: task.clientId,
        clientName: task.clientName,
        category: task.category
      });
      setActiveTimersTick(t => t + 1);
      showToast('success', `Started active timer for "${task.title}"`);
    }
  };

  const handleStopTimer = async (taskId: string) => {
    const res = await stopAndLogTaskTimer(taskId, profile);
    setActiveTimersTick(t => t + 1);
    if (res.loggedMinutes > 0) {
      showToast('success', `Logged ${formatDurationMinutes(res.loggedMinutes)} active time to official Work Log!`);
    } else {
      showToast('info', 'Timer stopped (less than 30s session discarded).');
    }
  };

  // Weekly Report Export
  const handleExportWeekly = (format: 'pdf' | 'xlsx' | 'csv') => {
    const config = {
      reportTitle: `Digiexplode AI — Weekly Performance Report`,
      reportSubtitle: `Sprint Performance: ${weeklyRecords.startDate} to ${weeklyRecords.endDate}`,
      periodLabel: `${weeklyRecords.startDate} to ${weeklyRecords.endDate}`,
      generatedBy: profile?.name || 'Super Admin',
      summaryCards: [
        { label: 'Tasks Completed', value: weeklyRecords.completedTasks.length },
        { label: 'Tasks Pending', value: weeklyRecords.pendingTasks.length },
        { label: 'Total Hours', value: `${weeklyRecords.totalHours} hrs` },
        { label: 'Published Content', value: weeklyRecords.publishedContent.length }
      ],
      tables: [
        {
          title: 'Daily Velocity Breakdown',
          headers: ['Day', 'Date', 'Completed Tasks', 'Hours Logged'],
          rows: weeklyRecords.dayBreakdown.map(d => [d.dayName, d.date, d.completedCount, `${d.hours} hrs`])
        },
        {
          title: 'Weekly Deliverables & Tasks',
          headers: ['Task Title', 'Client', 'Assignee', 'Status', 'Priority', 'Completed At'],
          rows: weeklyRecords.tasks.map(t => [t.title, t.clientName || 'Client', t.assigneeName || 'Assigned', t.status, t.priority, t.completedAt?.slice(0, 10) || '-'])
        }
      ],
      filenameBase: `DigiexplodeAI_Weekly_Report_${weeklyRecords.startDate}`
    };

    if (format === 'pdf') exportReportToPDF(config);
    else if (format === 'xlsx') exportReportToXLSX(config);
    else exportReportToCSV(config);

    showToast('success', `Exported Weekly Report as ${format.toUpperCase()}`);
  };

  // Monthly Report Export
  const handleExportMonthly = (format: 'pdf' | 'xlsx' | 'csv') => {
    const config = {
      reportTitle: `Digiexplode AI — Monthly Operations Report (${selectedMonth})`,
      reportSubtitle: 'Full Agency Monthly Production, Content Calendar & Work Logs',
      periodLabel: selectedMonth,
      generatedBy: profile?.name || 'Super Admin',
      summaryCards: [
        { label: 'Tasks Completed', value: monthlyRecords.completedTasks.length },
        { label: 'Tasks Pending', value: monthlyRecords.pendingTasks.length },
        { label: 'Total Hours Logged', value: `${monthlyRecords.totalHours} hrs` },
        { label: 'Published Assets', value: monthlyRecords.publishedContent.length }
      ],
      tables: [
        {
          title: 'Monthly Deliverables & Operational Tasks',
          headers: ['Title', 'Client', 'Assignee', 'Category', 'Status', 'Due Date'],
          rows: monthlyRecords.tasks.map(t => [t.title, t.clientName || 'General', t.assigneeName || 'Unassigned', t.category, t.status, t.dueDate || '-'])
        }
      ],
      filenameBase: `DigiexplodeAI_Monthly_Report_${selectedMonth}`
    };

    if (format === 'pdf') exportReportToPDF(config);
    else if (format === 'xlsx') exportReportToXLSX(config);
    else exportReportToCSV(config);

    showToast('success', `Exported Monthly Report as ${format.toUpperCase()}`);
  };

  // Employee Performance Export
  const handleExportEmployeeReport = (format: 'pdf' | 'xlsx' | 'csv') => {
    const config = {
      reportTitle: 'Digiexplode AI — Employee Performance & Delivery Report',
      reportSubtitle: 'Factual Task Completion, Logged Work & On-Time Performance',
      periodLabel: `As of ${todayKolkata}`,
      generatedBy: profile?.name || 'Super Admin',
      tables: [
        {
          title: 'All Employees Performance Summary',
          headers: ['Employee Name', 'Role / Team', 'Assigned', 'Completed', 'Pending', 'Overdue', 'On-Time %', 'Hours Logged', 'Clients Handled', 'Daily Reports'],
          rows: employeePerformanceList.map(item => [
            item.employee.name,
            item.employee.role || item.employee.designation || 'Staff',
            item.tasksAssigned,
            item.tasksCompleted,
            item.tasksPending,
            item.tasksOverdue,
            `${item.onTimeRate}%`,
            `${item.hoursLogged} hrs`,
            item.clientsHandled,
            item.dailyReportsCount
          ])
        }
      ],
      filenameBase: `DigiexplodeAI_Employee_Performance_${todayKolkata}`
    };

    if (format === 'pdf') exportReportToPDF(config);
    else if (format === 'xlsx') exportReportToXLSX(config);
    else exportReportToCSV(config);

    showToast('success', `Exported Employee Performance as ${format.toUpperCase()}`);
  };

  // Submission Tracker Export
  const handleExportSubmissionTracker = (format: 'pdf' | 'xlsx' | 'csv') => {
    const submittedCount = dailyTrackerRecords.filter(r => r.status === 'Submitted' || r.status === 'Reviewed').length;
    const config = {
      reportTitle: `Digiexplode AI — Daily Report Submission Tracker (${selectedDailyDate})`,
      reportSubtitle: 'Employee Compliance & Daily Activity Submission Audit',
      periodLabel: selectedDailyDate,
      generatedBy: profile?.name || 'Super Admin',
      summaryCards: [
        { label: 'Total Employees', value: dailyTrackerRecords.length },
        { label: 'Submitted / Reviewed', value: submittedCount },
        { label: 'Pending / Late', value: dailyTrackerRecords.length - submittedCount }
      ],
      tables: [
        {
          title: 'Daily Submission Audit Records',
          headers: ['Employee Name', 'Role', 'Status', 'Submitted At', 'Hours Logged', 'Completed Tasks'],
          rows: dailyTrackerRecords.map(r => [
            r.employee.name,
            r.employee.role || 'Staff',
            r.status,
            r.submission?.submittedAt ? new Date(r.submission.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
            `${r.hoursLogged} hrs`,
            r.completedTasksCount
          ])
        }
      ],
      filenameBase: `DigiexplodeAI_Daily_Submission_Tracker_${selectedDailyDate}`
    };

    if (format === 'pdf') exportReportToPDF(config);
    else if (format === 'xlsx') exportReportToXLSX(config);
    else exportReportToCSV(config);

    showToast('success', `Exported Submission Tracker as ${format.toUpperCase()}`);
  };

  // Client Report Official PDF Export (via pdfReportGenerator)
  const handleGenerateOfficialClientPdf = async () => {
    if (!selectedClient || !clientUnifiedData) {
      showToast('error', 'Please select a client account first.');
      return;
    }
    setIsGeneratingPdf(true);
    try {
      const yearNum = parseInt(selectedMonth.split('-')[0], 10) || 2026;
      const refNumber = commitReportReference(selectedMonth);
      const clientName = selectedClient.clientName || selectedClient.name || 'Client';

      const { doc: pdfDoc, filename } = await generateMonthlyPDFReport({
        client: selectedClient,
        month: selectedMonth,
        year: yearNum,
        reportReference: refNumber,
        reportType: 'Full Monthly Client Report',
        entries: clientUnifiedData.deliverables,
        tasks: clientUnifiedData.tasks,
        executiveSummary: executiveSummary || `Monthly creative delivery and social media campaign performance audit for ${clientName}.`,
        highlights: highlights ? highlights.split('\n').filter(Boolean) : [
          `${clientUnifiedData.totalPlanned} deliverables planned for ${clientName}.`,
          `${clientUnifiedData.livePublished} live published brand assets across active channels.`,
          `${clientUnifiedData.clientApproved} creative assets reviewed and approved.`
        ],
        generatedBy: profile?.name || 'Super Admin'
      });

      pdfDoc.save(filename);

      // Save record in Firestore and localStorage
      const snapshot: SavedReportSnapshot = {
        id: `cr_${Date.now()}`,
        reportReference: refNumber,
        clientId: selectedClient.id || (selectedClient as any).clientId,
        clientName,
        month: selectedMonth,
        year: yearNum,
        reportType: 'full_monthly',
        metrics: {
          totalPlanned: clientUnifiedData.totalPlanned,
          livePublished: clientUnifiedData.livePublished,
          clientApproved: clientUnifiedData.clientApproved,
          channelsActive: 3,
          tasksTotal: clientUnifiedData.tasksTotal,
          tasksCompleted: clientUnifiedData.tasksCompleted,
          videosTotal: 0,
          videosFinished: 0,
          pendingApprovals: 0,
          revisionsCount: 0
        },
        executiveSummary,
        highlights,
        nextMonthStrategy,
        generatedAt: new Date().toISOString(),
        generatedBy: profile?.name || 'Super Admin',
        generatedById: user?.uid || 'admin',
        contentSnapshot: clientUnifiedData.deliverables,
        taskSnapshot: clientUnifiedData.tasks,
        videoSnapshot: [],
        teamContributions: []
      };

      try {
        await addDoc(collection(db, 'client_reports'), snapshot);
      } catch {}

      showToast('success', `Downloaded Official Client PDF: ${filename}`);
    } catch (err: any) {
      console.error('Client PDF generation error:', err);
      showToast('error', `Failed to generate PDF: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // ── 10. DAILY REPORT ACTIONS (Save Draft, Submit, Manager Review) ───
  const handleSaveOrSubmitDaily = async (isSubmit: boolean) => {
    if (!currentEmployee) return;
    setIsSubmittingDaily(true);
    try {
      await saveOrSubmitDailyReport({
        date: selectedDailyDate,
        employeeId: currentEmployee.id,
        employeeName: currentEmployee.name,
        employeeEmail: currentEmployee.email,
        team: currentEmployee.department || currentEmployee.role || 'General',
        department: currentEmployee.department,
        summary: empDailySummary,
        blockers: empDailyBlockers,
        nextDayPlan: empDailyNextPlan,
        completedTasksCount: dailyRecords.completedTasks.length,
        pendingTasksCount: dailyRecords.pendingTasks.length,
        hoursLogged: dailyRecords.totalHours,
        isSubmit
      });

      showToast('success', isSubmit ? 'Daily Report Submitted successfully!' : 'Daily Report Draft saved.');
    } catch (err: any) {
      showToast('error', `Failed: ${err?.message || 'Error saving report'}`);
    } finally {
      setIsSubmittingDaily(false);
    }
  };

  const handleReviewSubmission = async (newStatus: 'Reviewed' | 'Returned') => {
    if (!reviewModalReport) return;
    try {
      await reviewDailyReportSubmission(
        reviewModalReport.id,
        newStatus,
        reviewRemarks,
        { uid: user?.uid, name: profile?.name || 'Manager' }
      );
      showToast('success', `Report marked as ${newStatus}`);
      setReviewModalReport(null);
      setReviewRemarks('');
    } catch (err: any) {
      showToast('error', `Failed to update review: ${err?.message}`);
    }
  };

  // ── 11. NAVIGATION TAB CONFIGS ──────────────────────────────────────
  const TABS: { id: MainReportTab; label: string; icon: any; count?: number }[] = useMemo(() => {
    if (isEmployeeRole) {
      return [
        { id: 'daily', label: 'My Daily Reports', icon: FileCheck },
        { id: 'employee', label: 'My Delivery & Performance', icon: Award },
        { id: 'weekly', label: 'Weekly Sprints', icon: TrendingUp },
        { id: 'monthly', label: 'Monthly Operations', icon: Calendar },
        { id: 'custom', label: 'Custom Reports', icon: Filter }
      ];
    }

    return [
      { id: 'overview', label: 'Agency Pulse', icon: BarChart3 },
      { id: 'daily', label: 'Daily Reports', icon: FileCheck },
      { id: 'weekly', label: 'Weekly Sprints', icon: TrendingUp },
      { id: 'monthly', label: 'Monthly Operations', icon: Calendar },
      { id: 'employee', label: 'Employee Performance', icon: Award },
      { id: 'client', label: 'Client Reporting', icon: Briefcase },
      { id: 'submission_tracker', label: 'Submission Tracker', icon: ShieldCheck, count: dailyTrackerRecords.filter(r => r.status === 'Pending' || r.status === 'Late').length },
      { id: 'custom', label: 'Custom Reports', icon: Filter }
    ];
  }, [isEmployeeRole, dailyTrackerRecords]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-[#101828] dark:text-[#F8FAFC] p-4 sm:p-6 lg:p-8 font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-99999 flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-bold text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4"
          style={{
            background: toast.type === 'success' ? '#10B981' : toast.type === 'error' ? '#EF4444' : '#5B4BFF'
          }}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E2E8F0] dark:border-white/10">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#5B4BFF] text-white flex items-center justify-center shadow-lg shadow-[#5B4BFF]/30 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#101828] dark:text-white">
                Reports & Operations Intelligence
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#5B4BFF]/10 text-[#5B4BFF] dark:text-[#806CFF] border border-[#5B4BFF]/20">
                Authoritative Agency OS
              </span>
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
              Live operational reporting synchronized across My Day, Tasks, Calendar, Work Logs, and Approvals.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => triggerPrintReport()}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 text-xs font-bold text-[#475467] dark:text-[#CBD5E1] hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* ── PRIMARY NAVIGATION TABS ─────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-3 border-b border-[#E2E8F0] dark:border-white/10 mb-6 scrollbar-none">
        {TABS.map(tab => {
          const isActive = activeMainTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveMainTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-[#5B4BFF] text-white shadow-md shadow-[#5B4BFF]/25 font-black'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#101828] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-white text-[#5B4BFF]' : 'bg-rose-500 text-white'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW (AGENCY PULSE) ──────────────────────────── */}
      {activeMainTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Quick Filter & Global Export Bar */}
          <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#7A8496]">Live Engine Status:</span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Synchronized with Operational Board
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#64748B] mr-1">Export Overview:</span>
              <button
                onClick={() => handleExportOverview('pdf')}
                className="px-3 py-1.5 rounded-lg bg-[#5B4BFF]/10 text-[#5B4BFF] dark:text-[#806CFF] text-xs font-black hover:bg-[#5B4BFF] hover:text-white transition-all flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button
                onClick={() => handleExportOverview('xlsx')}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </button>
              <button
                onClick={() => handleExportOverview('csv')}
                className="px-3 py-1.5 rounded-lg bg-slate-500/10 text-slate-700 dark:text-slate-300 text-xs font-black hover:bg-slate-700 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
          </div>

          {/* 9 Executive KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {[
              { label: 'Total Tasks', value: tasks.length, icon: Layers, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' },
              { label: 'Completed Tasks', value: tasks.filter(t => t.status === 'Done').length, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
              { label: 'Pending Tasks', value: tasks.filter(t => t.status !== 'Done' && t.status !== 'Cancelled').length, icon: Clock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
              { label: 'Overdue Tasks', value: tasks.filter(isTaskOverdue).length, icon: AlertTriangle, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40' },
              { label: 'Work Logged (hrs)', value: Math.round(workLogs.reduce((a, b) => a + (Number(b.hours) || 0), 0)), icon: Award, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
              { label: 'Deliverables Total', value: calendarEntries.length, icon: Calendar, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40' },
              { label: 'Published Content', value: calendarEntries.filter(e => e.status === 'Posted' || e.postedStatus === 'Posted').length, icon: Globe, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40' },
              { label: 'Daily Submissions', value: dailyReports.filter(r => r.date === todayKolkata && r.status !== 'Draft').length, icon: FileCheck, color: 'text-green-600 bg-green-50 dark:bg-green-950/40' },
              { label: 'Missing Daily Reports', value: dailyTrackerRecords.filter(r => r.status === 'Pending' || r.status === 'Late').length, icon: AlertOctagon, color: 'text-red-600 bg-red-50 dark:bg-red-950/40' },
              { label: 'Active Clients', value: clients.length, icon: Briefcase, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40' },
            ].map((kpi, idx) => {
              const Icon = kpi.icon;
              return (
                <div key={idx} className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#7A8496] block">{kpi.label}</span>
                    <span className="text-xl font-black text-[#101828] dark:text-white mt-1 block">{kpi.value}</span>
                  </div>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${kpi.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Department Breakdown & Active Client Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Team Distribution */}
            <div className="bg-white dark:bg-[#111728] p-5 rounded-3xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs">
              <h3 className="text-sm font-black text-[#101828] dark:text-white mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#5B4BFF]" />
                <span>Team & Role Workload Distribution</span>
              </h3>
              <div className="space-y-3">
                {employees.map(emp => {
                  const empTasks = tasks.filter(t => t.assigneeId === emp.id);
                  const completed = empTasks.filter(t => t.status === 'Done').length;
                  const pct = empTasks.length > 0 ? Math.round((completed / empTasks.length) * 100) : 0;
                  return (
                    <div key={emp.id} className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#161B31] border border-[#E2E8F0] dark:border-white/5 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-black text-[#101828] dark:text-white">{emp.name}</div>
                        <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{emp.role || 'Staff Member'}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-xs font-black text-[#5B4BFF]">{completed}</span>
                          <span className="text-[10px] text-[#64748B]"> / {empTasks.length} tasks</span>
                        </div>
                        <div className="w-16 bg-slate-200 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                          <div className="bg-[#5B4BFF] h-full" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Operational Tasks Overview */}
            <div className="bg-white dark:bg-[#111728] p-5 rounded-3xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-[#101828] dark:text-white flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-[#5B4BFF]" />
                  <span>Recent Operational Tasks</span>
                </h3>
                <span className="text-xs text-[#64748B]">Showing latest 6</span>
              </div>
              <div className="divide-y divide-[#E2E8F0] dark:divide-white/5">
                {tasks.slice(0, 6).map(t => (
                  <div key={t.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[#101828] dark:text-white truncate">{t.title}</div>
                      <div className="text-[11px] text-[#64748B] flex items-center gap-2 mt-0.5">
                        <span>{t.clientName || 'General'}</span>
                        <span>•</span>
                        <span>{t.assigneeName || 'Unassigned'}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                      t.status === 'Done' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: DAILY REPORTS 2.0 (AUTHORITATIVE SYSTEM) ─────────── */}
      {activeMainTab === 'daily' && (
        <div className="space-y-6 animate-in fade-in">
          {/* ── 1. REPORT CONTROLS BAR ─────────────────────────────────── */}
          <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-xs space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Daily / Date Range Toggle */}
              <div className="flex items-center gap-1.5 p-1 bg-[#F1F5F9] dark:bg-[#161B31] rounded-xl border border-[#E2E8F0] dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setDailyMode('daily')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    dailyMode === 'daily'
                      ? 'bg-white dark:bg-[#5B4BFF] text-[#101828] dark:text-white shadow-2xs font-black'
                      : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#101828]'
                  }`}
                >
                  Daily Report
                </button>
                <button
                  type="button"
                  onClick={() => setDailyMode('range')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    dailyMode === 'range'
                      ? 'bg-white dark:bg-[#5B4BFF] text-[#101828] dark:text-white shadow-2xs font-black'
                      : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#101828]'
                  }`}
                >
                  Custom Date Range
                </button>
              </div>

              {/* Action Controls: PDF Preview, Download PDF, Print, Excel, CSV */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handlePreviewDailyPDF}
                  disabled={isGeneratingDailyPdf}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-500/10 text-[#5B4BFF] dark:text-[#806CFF] text-xs font-black hover:bg-[#5B4BFF] hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Live A4 Landscape PDF Preview"
                >
                  {isGeneratingDailyPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>PDF Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportDaily('pdf')}
                  disabled={isGeneratingDailyPdf}
                  className="px-3.5 py-1.5 rounded-xl bg-[#5B4BFF] text-white text-xs font-black hover:bg-[#4E3FE6] transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#5B4BFF]/25"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerPrintReport()}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 text-xs font-bold text-[#475467] dark:text-[#CBD5E1] hover:bg-slate-50 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportDaily('xlsx')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                </button>
                <button
                  type="button"
                  onClick={() => handleExportDaily('csv')}
                  className="px-3 py-1.5 rounded-xl bg-slate-500/10 text-slate-700 dark:text-slate-300 text-xs font-black hover:bg-slate-700 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            </div>

            {/* Filter Pickers Row */}
            <div className="flex items-center gap-2.5 flex-wrap pt-2 border-t border-[#F1F5F9] dark:border-white/5">
              {/* Date Input */}
              {dailyMode === 'daily' ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3 py-1.5">
                    <Calendar className="w-4 h-4 text-[#5B4BFF]" />
                    <input
                      type="date"
                      value={selectedDailyDate}
                      onChange={e => setSelectedDailyDate(e.target.value)}
                      className="bg-transparent text-xs font-bold outline-none text-[#101828] dark:text-white cursor-pointer"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDailyDate(todayKolkata)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      selectedDailyDate === todayKolkata ? 'bg-[#5B4BFF] text-white font-black' : 'bg-slate-100 dark:bg-white/5 text-[#475467] dark:text-[#CBD5E1]'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      setSelectedDailyDate(d.toISOString().split('T')[0]);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-white/5 text-[#475467] dark:text-[#CBD5E1] hover:bg-slate-200 cursor-pointer"
                  >
                    Yesterday
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-2.5 py-1.5">
                    <span className="text-[10px] font-bold text-[#64748B]">From:</span>
                    <input
                      type="date"
                      value={selectedDailyDate}
                      onChange={e => setSelectedDailyDate(e.target.value)}
                      className="bg-transparent text-xs font-bold outline-none text-[#101828] dark:text-white cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-2.5 py-1.5">
                    <span className="text-[10px] font-bold text-[#64748B]">To:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={e => setCustomEndDate(e.target.value)}
                      className="bg-transparent text-xs font-bold outline-none text-[#101828] dark:text-white cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Employee Filter */}
              {isEmployeeRole ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl text-xs font-bold text-[#101828] dark:text-white">
                  <UserCheck className="w-3.5 h-3.5 text-[#5B4BFF]" />
                  <span>My Report ({currentEmployee?.name || 'Self'})</span>
                </div>
              ) : (
                <select
                  value={filterEmployeeId}
                  onChange={e => setFilterEmployeeId(e.target.value)}
                  className="bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-[#101828] dark:text-white outline-none cursor-pointer"
                >
                  <option value="">All Team Members</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.role || 'Staff'})</option>
                  ))}
                </select>
              )}

              {/* Client Filter */}
              <select
                value={filterClientId}
                onChange={e => setFilterClientId(e.target.value)}
                className="bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-[#101828] dark:text-white outline-none cursor-pointer"
              >
                <option value="">All Clients</option>
                {clients.map(c => (
                  <option key={c.id || (c as any).clientId} value={c.id || (c as any).clientId}>
                    {c.clientName || c.name}
                  </option>
                ))}
              </select>

              {/* Priority Filter (Step 4 & 8) */}
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                className="bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-[#101828] dark:text-white outline-none cursor-pointer"
              >
                <option value="All">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              {/* Category Filter (Step 6 & 8) */}
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-[#101828] dark:text-white outline-none cursor-pointer"
              >
                <option value="All">All Categories</option>
                <option value="Graphic Design">Graphic Design</option>
                <option value="Reel Editing">Reel Editing</option>
                <option value="Video Shoot">Video Shoot</option>
                <option value="Video Editing">Video Editing</option>
                <option value="Social Media">Social Media</option>
                <option value="Meta Ads">Meta Ads</option>
                <option value="Google Ads">Google Ads</option>
                <option value="SEO">SEO</option>
                <option value="Website Development">Website Development</option>
                <option value="Website Update">Website Update</option>
                <option value="Script Writing">Script Writing</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* ── 2. COMPACT SUMMARY METRIC CARDS (Step 7 & 9) ──────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* Card 1: Completed Today */}
            <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-emerald-200 dark:border-emerald-950/60 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                  Completed Today
                </span>
                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1 block">
                  {classifiedDaily.summary.completedTodayCount}
                </span>
                <span className="text-[10px] font-bold text-[#64748B]">
                  {formatDurationHours(classifiedDaily.completedTodayTotalHours)} tracked
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            {/* Card 2: Worked On Today */}
            <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-blue-200 dark:border-blue-950/60 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 block">
                  Worked On Today
                </span>
                <span className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-1 block">
                  {classifiedDaily.summary.workedOnTodayCount}
                </span>
                <span className="text-[10px] font-bold text-[#64748B]">
                  Ongoing / active today
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            {/* Card 3: Pending Tasks */}
            <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-amber-200 dark:border-amber-950/60 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                  Pending Tasks
                </span>
                <span className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1 block">
                  {classifiedDaily.summary.pendingCount}
                </span>
                <span className="text-[10px] font-bold text-[#64748B]">
                  {classifiedDaily.newPending.length} new · {classifiedDaily.previousPending.length} carried
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            {/* Card 4: Overdue */}
            <div className={`p-4 rounded-2xl border shadow-2xs flex items-center justify-between transition-all ${
              classifiedDaily.summary.overdueCount > 0 
                ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60' 
                : 'bg-white dark:bg-[#111728] border-slate-200 dark:border-white/10'
            }`}>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 block">
                  Overdue Tasks
                </span>
                <span className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-1 block">
                  {classifiedDaily.summary.overdueCount}
                </span>
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-300">
                  {classifiedDaily.highPriorityOverdueCount > 0 ? `⚠️ ${classifiedDaily.highPriorityOverdueCount} High/Urgent` : 'No urgent overdue'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            {/* Card 5: Total Time Logged */}
            <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-purple-200 dark:border-purple-950/60 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#5B4BFF] dark:text-[#806CFF] block">
                  Total Time Logged
                </span>
                <span className="text-2xl font-black text-[#5B4BFF] dark:text-[#806CFF] mt-1 block">
                  {classifiedDaily.summary.totalTimeLoggedFormatted}
                </span>
                <span className="text-[10px] font-bold text-[#64748B]">
                  Verified active work
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-[#5B4BFF] flex items-center justify-center shrink-0">
                <Timer className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Secondary Stats Chips (Step 9) */}
          <div className="flex items-center gap-2.5 flex-wrap text-xs font-bold text-[#64748B]">
            <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
              Assigned Today: <strong className="text-[#101828] dark:text-white">{classifiedDaily.summary.totalTasksAssignedToday}</strong>
            </span>
            <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
              Carried Forward: <strong className="text-amber-600">{classifiedDaily.summary.pendingCarriedForwardCount}</strong>
            </span>
            <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
              Overdue: <strong className="text-rose-600">{classifiedDaily.summary.overdueCount}</strong>
            </span>
            {classifiedDaily.summary.missingTimeRecordsCount > 0 ? (
              <span className="px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
                ⚠️ {classifiedDaily.summary.missingTimeRecordsCount} completed tasks missing active duration
              </span>
            ) : (
              <span className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                ✓ All completed tasks have verified time logs
              </span>
            )}
          </div>

          {/* Factual Daily Summary Banner (Step 9) */}
          <div className="p-3.5 rounded-2xl bg-[#EEECFF] dark:bg-[#1E1B4B]/50 border border-[#D8DEE9] dark:border-[#5B4BFF]/30 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#5B4BFF] shrink-0" />
              <span className="font-bold text-[#1E1B4B] dark:text-[#E0E7FF]">
                {classifiedDaily.summary.factualDailySummary}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(classifiedDaily.summary.factualDailySummary);
                showToast('success', 'Copied daily summary to clipboard');
              }}
              className="p-1.5 rounded-lg bg-white/70 dark:bg-white/10 hover:bg-white text-[#5B4BFF] cursor-pointer"
              title="Copy Summary Text"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ── 3. SECTION 1: COMPLETED TODAY (Step 2, 4, 5, 7) ────────── */}
          <div className="bg-white dark:bg-[#111728] p-5 rounded-3xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h3 className="text-sm font-black text-[#101828] dark:text-white">
                  Section 1 — Completed Today ({classifiedDaily.completedToday.length})
                </h3>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Total Time: {formatDurationHours(classifiedDaily.completedTodayTotalHours)}
              </span>
            </div>

            {classifiedDaily.completedToday.length === 0 ? (
              <p className="text-xs text-[#64748B] py-4 text-center bg-slate-50 dark:bg-[#161B31] rounded-2xl">
                No tasks completed on this date.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#E2E8F0] dark:border-white/5">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8FAFC] dark:bg-[#161B31] text-[10px] font-black uppercase text-[#7A8496] border-b border-[#E2E8F0] dark:border-white/10">
                    <tr>
                      <th className="py-2.5 px-3">Task Title</th>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Active Duration</th>
                      <th className="py-2.5 px-3">Completed Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-white/5 font-medium">
                    {classifiedDaily.completedToday.map(item => (
                      <tr key={item.task.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-[#101828] dark:text-white">
                          {item.task.title}
                        </td>
                        <td className="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8]">
                          {item.task.clientName || 'General'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-white/5 text-[#475467] dark:text-[#CBD5E1]">
                            {item.task.category || 'General'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider inline-block border"
                            style={{
                              color: item.priorityColor,
                              backgroundColor: item.priorityBg,
                              borderColor: item.priorityBorder
                            }}
                          >
                            {item.task.priority || 'Medium'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`font-bold ${item.durationHours === null ? 'text-[#94A3B8]' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {item.durationFormatted}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#64748B]">
                          {item.completedDateKolkata || classifiedDaily.targetDate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── 4. SECTION 2: WORKED ON TODAY (Step 2, 5, 7) ──────────── */}
          <div className="bg-white dark:bg-[#111728] p-5 rounded-3xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                <h3 className="text-sm font-black text-[#101828] dark:text-white">
                  Section 2 — Worked On Today (Ongoing / In-Progress: {classifiedDaily.workedOnToday.length})
                </h3>
              </div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                Tracked Today: {formatDurationHours(classifiedDaily.workedOnTodayTotalHours)}
              </span>
            </div>

            {classifiedDaily.workedOnToday.length === 0 ? (
              <p className="text-xs text-[#64748B] py-4 text-center bg-slate-50 dark:bg-[#161B31] rounded-2xl">
                No ongoing tasks worked on today.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#E2E8F0] dark:border-white/5">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8FAFC] dark:bg-[#161B31] text-[10px] font-black uppercase text-[#7A8496] border-b border-[#E2E8F0] dark:border-white/10">
                    <tr>
                      <th className="py-2.5 px-3">Task Title</th>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Today Tracked Time</th>
                      <th className="py-2.5 px-3 text-right">Quick Timer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-white/5 font-medium">
                    {classifiedDaily.workedOnToday.map(item => {
                      const session = getTaskTimerSession(item.task.id);
                      const isRunning = Boolean(session?.isRunning);

                      return (
                        <tr key={item.task.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-[#101828] dark:text-white">
                            {item.task.title}
                          </td>
                          <td className="py-2.5 px-3 text-[#64748B]">
                            {item.task.clientName || 'General'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-white/5 text-[#475467]">
                              {item.task.category || 'General'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                              {item.task.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider inline-block border"
                              style={{
                                color: item.priorityColor,
                                backgroundColor: item.priorityBg,
                                borderColor: item.priorityBorder
                              }}
                            >
                              {item.task.priority || 'Medium'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-blue-600 dark:text-blue-400">
                            {item.durationFormatted}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleTimer(item.task)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition-all ${
                                  isRunning 
                                    ? 'bg-amber-500 text-white shadow-2xs animate-pulse'
                                    : 'bg-slate-100 dark:bg-white/10 text-[#475467] dark:text-[#CBD5E1] hover:bg-emerald-50 hover:text-emerald-600'
                                }`}
                              >
                                {isRunning ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                                <span>{isRunning ? 'Pause' : 'Start'}</span>
                              </button>
                              {session && (session.accumulatedSeconds > 0 || isRunning) && (
                                <button
                                  type="button"
                                  onClick={() => handleStopTimer(item.task.id)}
                                  className="px-2 py-1 rounded-lg text-[10px] font-black bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center gap-1 cursor-pointer"
                                  title="Log and clear active timer"
                                >
                                  <Square className="w-2.5 h-2.5" />
                                  <span>Stop</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── 5. SECTION 3: NEW PENDING TASKS ASSIGNED TODAY (Step 3 & 7) */}
          <div className="bg-white dark:bg-[#111728] p-5 rounded-3xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                <h3 className="text-sm font-black text-[#101828] dark:text-white">
                  Section 3 — New Pending Tasks Assigned Today ({classifiedDaily.newPending.length})
                </h3>
              </div>
              <span className="text-xs text-[#64748B]">Created on {classifiedDaily.targetDate}</span>
            </div>

            {classifiedDaily.newPending.length === 0 ? (
              <p className="text-xs text-[#64748B] py-4 text-center bg-slate-50 dark:bg-[#161B31] rounded-2xl">
                No new pending tasks assigned on this date.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#E2E8F0] dark:border-white/5">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8FAFC] dark:bg-[#161B31] text-[10px] font-black uppercase text-[#7A8496] border-b border-[#E2E8F0] dark:border-white/10">
                    <tr>
                      <th className="py-2.5 px-3">Task Title</th>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-white/5 font-medium">
                    {classifiedDaily.newPending.map(item => (
                      <tr key={item.task.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-[#101828] dark:text-white">
                          {item.task.title}
                        </td>
                        <td className="py-2.5 px-3 text-[#64748B]">
                          {item.task.clientName || 'General'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-white/5 text-[#475467]">
                            {item.task.category || 'General'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider inline-block border"
                            style={{
                              color: item.priorityColor,
                              backgroundColor: item.priorityBg,
                              borderColor: item.priorityBorder
                            }}
                          >
                            {item.task.priority || 'Medium'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#64748B]">
                          {item.dueDateKolkata || 'No Deadline'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                            Assigned Today
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── 6. SECTION 4: PREVIOUS PENDING & OVERDUE TASKS (Step 3 & 7) */}
          <div className="bg-white dark:bg-[#111728] p-5 rounded-3xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <h3 className="text-sm font-black text-[#101828] dark:text-white">
                  Section 4 — Previous Pending & Overdue Tasks ({classifiedDaily.overdue.length} overdue · {classifiedDaily.previousPending.length} carried forward)
                </h3>
              </div>
              <span className="text-xs text-[#64748B]">Non-overlapping pending tasks</span>
            </div>

            {classifiedDaily.overdue.length === 0 && classifiedDaily.previousPending.length === 0 ? (
              <p className="text-xs text-[#64748B] py-4 text-center bg-slate-50 dark:bg-[#161B31] rounded-2xl">
                No overdue or carried forward pending tasks.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#E2E8F0] dark:border-white/5">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8FAFC] dark:bg-[#161B31] text-[10px] font-black uppercase text-[#7A8496] border-b border-[#E2E8F0] dark:border-white/10">
                    <tr>
                      <th className="py-2.5 px-3">Task Title</th>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3">Ageing / Status</th>
                      <th className="py-2.5 px-3">Blocked Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-white/5 font-medium">
                    {/* Overdue tasks first */}
                    {classifiedDaily.overdue.map(item => (
                      <tr key={item.task.id} className="bg-rose-50/20 dark:bg-rose-950/10 hover:bg-rose-50/40 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-rose-900 dark:text-rose-200">
                          {item.task.title}
                        </td>
                        <td className="py-2.5 px-3 text-[#64748B]">
                          {item.task.clientName || 'General'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-white/5 text-[#475467]">
                            {item.task.category || 'General'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider inline-block border"
                            style={{
                              color: item.priorityColor,
                              backgroundColor: item.priorityBg,
                              borderColor: item.priorityBorder
                            }}
                          >
                            {item.task.priority || 'Medium'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-black text-rose-600 dark:text-rose-400">
                          {item.dueDateKolkata}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-rose-600 text-white">
                            {item.daysOverdue} Days Overdue
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {item.isBlocked ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                              Blocked
                            </span>
                          ) : (
                            <span className="text-[#94A3B8] text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* Previous Pending carried forward */}
                    {classifiedDaily.previousPending.map(item => (
                      <tr key={item.task.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-[#101828] dark:text-white">
                          {item.task.title}
                        </td>
                        <td className="py-2.5 px-3 text-[#64748B]">
                          {item.task.clientName || 'General'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-white/5 text-[#475467]">
                            {item.task.category || 'General'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider inline-block border"
                            style={{
                              color: item.priorityColor,
                              backgroundColor: item.priorityBg,
                              borderColor: item.priorityBorder
                            }}
                          >
                            {item.task.priority || 'Medium'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#64748B]">
                          {item.dueDateKolkata || 'No Deadline'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            {item.daysPending} days pending
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {item.isBlocked ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                              Blocked
                            </span>
                          ) : (
                            <span className="text-[#94A3B8] text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── 7. SECTION 5: DAILY TIME SUMMARY (Step 5 & 7) ─────────── */}
          <div className="bg-white dark:bg-[#111728] p-5 rounded-3xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                <h3 className="text-sm font-black text-[#101828] dark:text-white">
                  Section 5 — Daily Time Summary ({classifiedDaily.timeBreakdown.length} records)
                </h3>
              </div>
              <span className="text-xs font-black text-[#5B4BFF] dark:text-[#806CFF]">
                Total: {classifiedDaily.summary.totalTimeLoggedFormatted}
              </span>
            </div>

            {classifiedDaily.timeBreakdown.length === 0 ? (
              <p className="text-xs text-[#64748B] py-4 text-center bg-slate-50 dark:bg-[#161B31] rounded-2xl">
                No active work time recorded for this date.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#E2E8F0] dark:border-white/5">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8FAFC] dark:bg-[#161B31] text-[10px] font-black uppercase text-[#7A8496] border-b border-[#E2E8F0] dark:border-white/10">
                    <tr>
                      <th className="py-2.5 px-3">Task / Work Activity</th>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Active Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-white/5 font-medium">
                    {classifiedDaily.timeBreakdown.map(tb => (
                      <tr key={tb.taskId} className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-[#101828] dark:text-white">
                          {tb.taskTitle}
                        </td>
                        <td className="py-2.5 px-3 text-[#64748B]">
                          {tb.clientName}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-white/5 text-[#475467]">
                            {tb.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-white/5 text-[#475467]">
                            {tb.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-[#5B4BFF] dark:text-[#806CFF]">
                          {tb.formatted}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── 8. EMPLOYEE DAILY REPORT SUBMISSION CARD ────────────────── */}
          <div className="bg-white dark:bg-[#111728] p-6 rounded-3xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#5B4BFF]/10 text-[#5B4BFF] flex items-center justify-center font-black">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#101828] dark:text-white">
                    Submit Daily Report ({currentEmployee?.name || 'My Daily Entry'})
                  </h3>
                  <p className="text-[11px] text-[#64748B]">Reporting for work date: <strong>{selectedDailyDate}</strong></p>
                </div>
              </div>
              {dailyReports.find(r => r.employeeId === currentEmployee?.id && r.date === selectedDailyDate) && (
                <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                  dailyReports.find(r => r.employeeId === currentEmployee?.id && r.date === selectedDailyDate)?.status === 'Reviewed'
                    ? 'bg-purple-100 text-purple-700'
                    : dailyReports.find(r => r.employeeId === currentEmployee?.id && r.date === selectedDailyDate)?.status === 'Submitted'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  Status: {dailyReports.find(r => r.employeeId === currentEmployee?.id && r.date === selectedDailyDate)?.status}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#7A8496] mb-1">
                  Daily Work Summary *
                </label>
                <textarea
                  rows={3}
                  value={empDailySummary}
                  onChange={e => setEmpDailySummary(e.target.value)}
                  placeholder="Key milestones completed today, client deliverables shipped..."
                  className="w-full bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-3 text-xs font-medium outline-none focus:border-[#5B4BFF]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#7A8496] mb-1">
                  Blockers or Dependencies (Optional)
                </label>
                <textarea
                  rows={3}
                  value={empDailyBlockers}
                  onChange={e => setEmpDailyBlockers(e.target.value)}
                  placeholder="Awaiting client asset approvals, revision requests, technical blockers..."
                  className="w-full bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-3 text-xs font-medium outline-none focus:border-[#5B4BFF]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#7A8496] mb-1">
                  Next Day Plan & Priorities
                </label>
                <textarea
                  rows={3}
                  value={empDailyNextPlan}
                  onChange={e => setEmpDailyNextPlan(e.target.value)}
                  placeholder="Top tasks planned for tomorrow..."
                  className="w-full bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-3 text-xs font-medium outline-none focus:border-[#5B4BFF]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-[#64748B]">
                Auto-calculated today: <strong>{classifiedDaily.completedToday.length} tasks completed</strong> • <strong>{classifiedDaily.summary.totalTimeLoggedFormatted} logged</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmittingDaily || !empDailySummary.trim()}
                  onClick={() => handleSaveOrSubmitDaily(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-bold text-[#475467] dark:text-[#CBD5E1] hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={isSubmittingDaily || !empDailySummary.trim()}
                  onClick={() => handleSaveOrSubmitDaily(true)}
                  className="px-5 py-2 rounded-xl bg-[#5B4BFF] hover:bg-[#4E3FE6] text-white text-xs font-black shadow-md shadow-[#5B4BFF]/25 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingDaily ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Submit Daily Report</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: WEEKLY REPORTS ────────────────────────────────────── */}
      {activeMainTab === 'weekly' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Week Selector Bar */}
          <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const d = new Date(selectedWeekStart);
                  d.setDate(d.getDate() - 7);
                  setSelectedWeekStart(d.toISOString().split('T')[0]);
                }}
                className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-[#475467] hover:bg-slate-200 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#7A8496] block">Weekly Sprint</span>
                <span className="text-xs font-black text-[#101828] dark:text-white">{weeklyRecords.startDate} to {weeklyRecords.endDate}</span>
              </div>
              <button
                onClick={() => {
                  const d = new Date(selectedWeekStart);
                  d.setDate(d.getDate() + 7);
                  setSelectedWeekStart(d.toISOString().split('T')[0]);
                }}
                className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-[#475467] hover:bg-slate-200 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedWeekStart(currentWeekMonday)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#5B4BFF]/10 text-[#5B4BFF] cursor-pointer"
              >
                Current Week
              </button>
            </div>

            {/* Export buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => handleExportWeekly('pdf')} className="px-3.5 py-1.5 rounded-xl bg-[#5B4BFF]/10 text-[#5B4BFF] text-xs font-black hover:bg-[#5B4BFF] hover:text-white transition-all flex items-center gap-1 cursor-pointer">
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button onClick={() => handleExportWeekly('xlsx')} className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 text-xs font-black hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1 cursor-pointer">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </button>
              <button onClick={() => handleExportWeekly('csv')} className="px-3.5 py-1.5 rounded-xl bg-slate-500/10 text-slate-700 text-xs font-black hover:bg-slate-700 hover:text-white transition-all flex items-center gap-1 cursor-pointer">
                <FileText className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
          </div>

          {/* Weekly KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#7A8496]">Tasks Completed</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{weeklyRecords.completedTasks.length}</span>
            </div>
            <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#7A8496]">Tasks Pending</span>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">{weeklyRecords.pendingTasks.length}</span>
            </div>
            <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#7A8496]">Total Work Hours</span>
              <span className="text-2xl font-black text-[#5B4BFF] mt-1 block">{weeklyRecords.totalHours} hrs</span>
            </div>
            <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#7A8496]">Published Deliverables</span>
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 block">{weeklyRecords.publishedContent.length}</span>
            </div>
          </div>

          {/* Day-by-Day Sprint Velocity */}
          <div className="bg-white dark:bg-[#111728] p-5 rounded-3xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs">
            <h3 className="text-sm font-black text-[#101828] dark:text-white mb-3">Day-by-Day Sprint Activity (Mon - Sun)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-2.5">
              {weeklyRecords.dayBreakdown.map((d, i) => (
                <div key={i} className="p-3 rounded-2xl bg-[#F8FAFC] dark:bg-[#161B31] border border-[#E2E8F0] dark:border-white/5 text-center">
                  <span className="text-[10px] font-black uppercase text-[#7A8496] block">{d.dayName}</span>
                  <span className="text-xs text-[#64748B] block mb-1">{d.date.slice(5)}</span>
                  <div className="text-base font-black text-[#101828] dark:text-white">{d.completedCount} <span className="text-[10px] text-emerald-600">done</span></div>
                  <div className="text-[11px] text-[#5B4BFF] font-bold">{d.hours} hrs</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: MONTHLY REPORTS ───────────────────────────────────── */}
      {activeMainTab === 'monthly' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-[#5B4BFF]" />
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-[#101828] dark:text-white outline-none cursor-pointer"
              />
              <span className="text-xs font-bold text-[#64748B]">Agency Operations for {selectedMonth}</span>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => handleExportMonthly('pdf')} className="px-3.5 py-1.5 rounded-xl bg-[#5B4BFF]/10 text-[#5B4BFF] text-xs font-black hover:bg-[#5B4BFF] hover:text-white transition-all flex items-center gap-1 cursor-pointer">
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button onClick={() => handleExportMonthly('xlsx')} className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 text-xs font-black hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1 cursor-pointer">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </button>
              <button onClick={() => handleExportMonthly('csv')} className="px-3.5 py-1.5 rounded-xl bg-slate-500/10 text-slate-700 text-xs font-black hover:bg-slate-700 hover:text-white transition-all flex items-center gap-1 cursor-pointer">
                <FileText className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#7A8496]">Monthly Completed</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">{monthlyRecords.completedTasks.length}</span>
            </div>
            <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#7A8496]">Pending / Ongoing</span>
              <span className="text-2xl font-black text-amber-600 mt-1 block">{monthlyRecords.pendingTasks.length}</span>
            </div>
            <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#7A8496]">Total Agency Hours</span>
              <span className="text-2xl font-black text-[#5B4BFF] mt-1 block">{monthlyRecords.totalHours} hrs</span>
            </div>
            <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#7A8496]">Published Content</span>
              <span className="text-2xl font-black text-purple-600 mt-1 block">{monthlyRecords.publishedContent.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: EMPLOYEE PERFORMANCE ──────────────────────────────── */}
      {activeMainTab === 'employee' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-black text-[#101828] dark:text-white">Employee Performance & Delivery Matrix</h2>
              <p className="text-[11px] text-[#64748B]">Factual metrics calculated strictly from verified tasks, work logs, and daily submissions.</p>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => handleExportEmployeeReport('pdf')} className="px-3.5 py-1.5 rounded-xl bg-[#5B4BFF]/10 text-[#5B4BFF] text-xs font-black hover:bg-[#5B4BFF] hover:text-white transition-all flex items-center gap-1 cursor-pointer">
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button onClick={() => handleExportEmployeeReport('xlsx')} className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 text-xs font-black hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1 cursor-pointer">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </button>
              <button onClick={() => handleExportEmployeeReport('csv')} className="px-3.5 py-1.5 rounded-xl bg-slate-500/10 text-slate-700 text-xs font-black hover:bg-slate-700 hover:text-white transition-all flex items-center gap-1 cursor-pointer">
                <FileText className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111728] rounded-3xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8FAFC] dark:bg-[#161B31] text-[10px] font-black uppercase text-[#7A8496] border-b border-[#E2E8F0] dark:border-white/10">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-3">Role / Team</th>
                    <th className="py-3 px-3 text-center">Assigned</th>
                    <th className="py-3 px-3 text-center">Completed</th>
                    <th className="py-3 px-3 text-center">Pending</th>
                    <th className="py-3 px-3 text-center">Overdue</th>
                    <th className="py-3 px-3 text-center">On-Time %</th>
                    <th className="py-3 px-3 text-center">Hours Logged</th>
                    <th className="py-3 px-3 text-center">Clients</th>
                    <th className="py-3 px-3 text-center">Daily Reports</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-white/5 font-medium">
                  {employeePerformanceList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#101828] dark:text-white">{item.employee.name}</div>
                        <div className="text-[10px] text-[#64748B]">{item.employee.email}</div>
                      </td>
                      <td className="py-3 px-3 text-[#64748B]">{item.employee.role || 'Staff'}</td>
                      <td className="py-3 px-3 text-center font-bold">{item.tasksAssigned}</td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-600">{item.tasksCompleted}</td>
                      <td className="py-3 px-3 text-center font-bold text-amber-600">{item.tasksPending}</td>
                      <td className="py-3 px-3 text-center font-bold text-rose-600">{item.tasksOverdue}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          item.onTimeRate >= 85 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {item.onTimeRate}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-black text-[#5B4BFF]">{item.hoursLogged} hrs</td>
                      <td className="py-3 px-3 text-center font-bold">{item.clientsHandled}</td>
                      <td className="py-3 px-3 text-center font-bold">{item.dailyReportsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 6: CLIENT REPORTING (Official Branded Client PDF Generator) ── */}
      {activeMainTab === 'client' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                className="bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3.5 py-2 text-xs font-bold text-[#101828] dark:text-white outline-none min-w-[240px]"
              >
                <option value="">-- Choose Client Account --</option>
                {clients.map(c => (
                  <option key={c.id || (c as any).clientId} value={c.id || (c as any).clientId}>
                    {c.clientName || c.name} {c.category ? `(${c.category})` : ''}
                  </option>
                ))}
              </select>

              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-[#101828] dark:text-white outline-none"
              />
            </div>

            {selectedClientId && clientUnifiedData && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  disabled={isGeneratingPdf}
                  onClick={handleGenerateOfficialClientPdf}
                  className="px-4 py-2 rounded-xl bg-[#5B4BFF] hover:bg-[#4E3FE6] text-white text-xs font-black shadow-md shadow-[#5B4BFF]/25 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>Generate Official Branded PDF</span>
                </button>
              </div>
            )}
          </div>

          {!selectedClientId ? (
            <div className="bg-white dark:bg-[#111728] border border-dashed border-[#D8DEE9] dark:border-white/10 rounded-3xl p-12 text-center max-w-xl mx-auto">
              <Briefcase className="w-10 h-10 text-[#5B4BFF] mx-auto mb-3" />
              <h3 className="text-base font-black text-[#101828] dark:text-white">Select a Client Account</h3>
              <p className="text-xs text-[#64748B] mt-1">Choose any active client above to view their deliverables, tasks, and generate an official presentation report.</p>
            </div>
          ) : clientUnifiedData && (
            <div className="space-y-6">
              {/* Client Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#7A8496]">Planned Content</span>
                  <span className="text-2xl font-black text-[#5B4BFF] mt-1 block">{clientUnifiedData.totalPlanned}</span>
                </div>
                <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#7A8496]">Published Live</span>
                  <span className="text-2xl font-black text-emerald-600 mt-1 block">{clientUnifiedData.livePublished}</span>
                </div>
                <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#7A8496]">Approved Assets</span>
                  <span className="text-2xl font-black text-teal-600 mt-1 block">{clientUnifiedData.clientApproved} / {clientUnifiedData.totalPlanned}</span>
                </div>
                <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#7A8496]">Publishing Velocity</span>
                  <span className="text-2xl font-black text-purple-600 mt-1 block">
                    {clientUnifiedData.totalPlanned > 0 ? Math.round((clientUnifiedData.livePublished / clientUnifiedData.totalPlanned) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* Client Deliverables Table */}
              <div className="bg-white dark:bg-[#111728] p-5 rounded-3xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs">
                <h3 className="text-sm font-black text-[#101828] dark:text-white mb-3">Content Calendar Deliverables for {selectedClient?.clientName}</h3>
                {clientUnifiedData.deliverables.length === 0 ? (
                  <p className="text-xs text-[#64748B] text-center py-4">No content items recorded for this month.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#F8FAFC] dark:bg-[#161B31] text-[10px] font-black uppercase text-[#7A8496] border-b border-[#E2E8F0] dark:border-white/10">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Topic / Title</th>
                          <th className="py-2.5 px-3">Platform</th>
                          <th className="py-2.5 px-3">Format</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Assignee</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] dark:divide-white/5 font-medium">
                        {clientUnifiedData.deliverables.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                            <td className="py-2.5 px-3 font-mono text-[11px]">{item.date || '-'}</td>
                            <td className="py-2.5 px-3 font-bold text-[#101828] dark:text-white">{item.topic || item.title}</td>
                            <td className="py-2.5 px-3">{item.platform || 'Multi'}</td>
                            <td className="py-2.5 px-3">{item.contentType || 'Graphic'}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                item.status === 'Posted' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                              }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">{item.assigneeName || 'Assigned'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 7: SUBMISSION TRACKER ────────────────────────────────── */}
      {activeMainTab === 'submission_tracker' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white dark:bg-[#111728] p-4 rounded-2xl border border-[#D8DEE9] dark:border-white/10 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-[#5B4BFF]" />
              <input
                type="date"
                value={selectedDailyDate}
                onChange={e => setSelectedDailyDate(e.target.value)}
                className="bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-[#101828] dark:text-white outline-none cursor-pointer"
              />
              <span className="text-xs font-bold text-[#64748B]">Compliance tracking for {selectedDailyDate}</span>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => handleExportSubmissionTracker('pdf')} className="px-3.5 py-1.5 rounded-xl bg-[#5B4BFF]/10 text-[#5B4BFF] text-xs font-black hover:bg-[#5B4BFF] hover:text-white transition-all flex items-center gap-1 cursor-pointer">
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button onClick={() => handleExportSubmissionTracker('xlsx')} className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 text-xs font-black hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1 cursor-pointer">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </button>
              <button onClick={() => handleExportSubmissionTracker('csv')} className="px-3.5 py-1.5 rounded-xl bg-slate-500/10 text-slate-700 text-xs font-black hover:bg-slate-700 hover:text-white transition-all flex items-center gap-1 cursor-pointer">
                <FileText className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111728] rounded-3xl border border-[#D8DEE9] dark:border-white/10 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8FAFC] dark:bg-[#161B31] text-[10px] font-black uppercase text-[#7A8496] border-b border-[#E2E8F0] dark:border-white/10">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-3">Role / Team</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Submitted At</th>
                    <th className="py-3 px-3 text-center">Hours Logged</th>
                    <th className="py-3 px-3 text-center">Completed Tasks</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-white/5 font-medium">
                  {dailyTrackerRecords.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                      <td className="py-3 px-4 font-bold text-[#101828] dark:text-white">{r.employee.name}</td>
                      <td className="py-3 px-3 text-[#64748B]">{r.employee.role || 'Staff'}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          r.status === 'Reviewed'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400'
                            : r.status === 'Submitted'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : r.status === 'Returned'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                            : r.status === 'Late'
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-[#64748B]">
                        {r.submission?.submittedAt ? new Date(r.submission.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="py-3 px-3 text-center font-bold">{r.hoursLogged} hrs</td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-600">{r.completedTasksCount}</td>
                      <td className="py-3 px-3 text-right">
                        {r.submission ? (
                          <button
                            onClick={() => {
                              setReviewModalReport(r.submission || null);
                              setReviewRemarks(r.submission?.managerRemarks || '');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#5B4BFF]/10 text-[#5B4BFF] text-[11px] font-black hover:bg-[#5B4BFF] hover:text-white transition-all cursor-pointer"
                          >
                            Review Report
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">No submission</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 8: CUSTOM REPORTS ────────────────────────────────────── */}
      {activeMainTab === 'custom' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white dark:bg-[#111728] p-5 rounded-3xl border border-[#D8DEE9] dark:border-white/10 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-[#101828] dark:text-white">Custom Reporting Query Engine</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-[#7A8496] mb-1">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="w-full bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-2.5 text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-[#7A8496] mb-1">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="w-full bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-2.5 text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-[#7A8496] mb-1">Employee</label>
                <select
                  value={filterEmployeeId}
                  onChange={e => setFilterEmployeeId(e.target.value)}
                  className="w-full bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-2.5 text-xs font-bold outline-none"
                >
                  <option value="">All Employees</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-[#7A8496] mb-1">Client</label>
                <select
                  value={filterClientId}
                  onChange={e => setFilterClientId(e.target.value)}
                  className="w-full bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-2.5 text-xs font-bold outline-none"
                >
                  <option value="">All Clients</option>
                  {clients.map(c => (
                    <option key={c.id || (c as any).clientId} value={c.id || (c as any).clientId}>{c.clientName || c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MANAGER REVIEW MODAL ─────────────────────────────────────── */}
      {reviewModalReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111728] border border-[#D8DEE9] dark:border-white/10 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-white/10">
              <div>
                <h3 className="text-base font-black text-[#101828] dark:text-white">Daily Report Review</h3>
                <p className="text-xs text-[#64748B]">{reviewModalReport.employeeName} • {reviewModalReport.date}</p>
              </div>
              <button onClick={() => setReviewModalReport(null)} className="p-1.5 rounded-xl text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-[#7A8496] uppercase text-[10px] block">Submitted Work Summary</span>
                <p className="p-3 rounded-xl bg-slate-50 dark:bg-[#161B31] mt-1 text-[#101828] dark:text-[#F8FAFC] font-medium whitespace-pre-wrap">
                  {reviewModalReport.summary || 'No summary entered'}
                </p>
              </div>

              {reviewModalReport.blockers && (
                <div>
                  <span className="font-bold text-rose-500 uppercase text-[10px] block">Blockers / Dependencies</span>
                  <p className="p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-300 mt-1">
                    {reviewModalReport.blockers}
                  </p>
                </div>
              )}

              {reviewModalReport.nextDayPlan && (
                <div>
                  <span className="font-bold text-[#7A8496] uppercase text-[10px] block">Next Day Plan</span>
                  <p className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161B31] mt-1 text-[#64748B]">
                    {reviewModalReport.nextDayPlan}
                  </p>
                </div>
              )}

              <div>
                <label className="font-bold text-[#7A8496] uppercase text-[10px] block mb-1">Manager Remarks / Feedback</label>
                <textarea
                  rows={3}
                  value={reviewRemarks}
                  onChange={e => setReviewRemarks(e.target.value)}
                  placeholder="Feedback, approval comments, or instructions if returning for edits..."
                  className="w-full bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-2.5 text-xs outline-none focus:border-[#5B4BFF]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => handleReviewSubmission('Returned')}
                className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 text-xs font-black transition-all cursor-pointer"
              >
                Return for Edits
              </button>
              <button
                onClick={() => handleReviewSubmission('Reviewed')}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
              >
                Mark as Reviewed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PDF PREVIEW MODAL (Step 7 & 8) ───────────────────────────── */}
      {pdfPreviewBlobUrl && (
        <div className="fixed inset-0 z-99999 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-white dark:bg-[#111728] border border-[#D8DEE9] dark:border-white/10 rounded-3xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Top Bar */}
            <div className="p-4 px-6 border-b border-[#E2E8F0] dark:border-white/10 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#5B4BFF]/10 text-[#5B4BFF] flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#101828] dark:text-white">
                    Live PDF Preview — Employee Daily Report 2.0
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    A4 Landscape • Authoritative Agency OS Format • Identical to Downloaded File
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerPrintReport()}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 text-xs font-bold text-[#475467] dark:text-[#CBD5E1] hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportDaily('pdf')}
                  className="px-4 py-1.5 rounded-xl bg-[#5B4BFF] hover:bg-[#4E3FE6] text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-[#5B4BFF]/25 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPdfPreviewBlobUrl(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Embedded Iframe Preview */}
            <div className="flex-1 w-full bg-slate-100 dark:bg-[#0B0F19] p-2">
              <iframe
                src={pdfPreviewBlobUrl}
                title="Employee Daily Report PDF Preview"
                className="w-full h-full rounded-2xl border-0 shadow-inner"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsView;
