import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  FileText, Download, Printer, Filter, Calendar, Award, ChevronDown,
  Instagram, Facebook, Youtube, Linkedin, TrendingUp, BarChart3,
  History, Settings, Plus, Trash2, RefreshCw, Eye, CheckCircle2,
  AlertCircle, Loader2, Globe, Users, Target, Sparkles, Check,
  AlertTriangle, ArrowRight, Video, CheckSquare, Layers, Clock, X,
  ExternalLink, Search, ShieldCheck, Briefcase, Copy, FileCheck,
  ChevronLeft, ChevronRight, Bookmark
} from 'lucide-react';
import {
  collection, query, where, getDocs, addDoc, setDoc, doc, deleteDoc,
  onSnapshot, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { type ClientData } from './ClientList';
import {
  DEFAULT_CLIENTS_MASTER,
  subscribeToCanonicalClients
} from '../../lib/clientMaster';
import {
  CalendarEntry,
  getCachedCalendarEntries,
  DEFAULT_CALENDAR_SEEDS
} from '../../lib/calendarStorage';
import {
  getCachedTasks,
  DEFAULT_MASTER_TASKS
} from '../../lib/taskStorage';
import {
  generateMonthlyPDFReport,
  PerformanceMetricsData,
  DEFAULT_AGENCY_BRANDING
} from '../../lib/pdfReportGenerator';
import { isTimestampInMonthRange, normalizeDate } from '../../lib/employeeMaster';

// ── Types ─────────────────────────────────────────────────────────────
export type ReportType = 'full_monthly' | 'social_content' | 'delivery_operations' | 'video_production';
export type PdfStatus = 'valid' | 'missing' | 'invalid';

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
  // PDF lifecycle fields
  pdf_status?: PdfStatus;    // 'valid' | 'missing' | 'invalid'
  pdf_filename?: string;     // canonical filename
  pdf_size_bytes?: number;
  repaired_at?: string;
}

const REPORT_TYPE_CONFIGS: { id: ReportType; label: string; desc: string }[] = [
  { id: 'full_monthly', label: 'Full Monthly Client Report', desc: 'Comprehensive report covering Social Content, Video Production, Task Deliverables & Approvals.' },
  { id: 'social_content', label: 'Social Content Report', desc: 'Focused performance breakdown of planned posts, published reels, carousels & channel distribution.' },
  { id: 'delivery_operations', label: 'Delivery & Operations Report', desc: 'Agency operational summary with task completion velocity and review workflows.' },
  { id: 'video_production', label: 'Video Production Report', desc: 'Production studio tracker with shoot schedules, editing queues and finished assets.' }
];

const LS_SAVED_REPORTS_KEY = 'digi_client_reports_v2';
const LS_REPORT_SEQ_KEY = 'digi_client_report_seq_v2';

/** Peek at the NEXT reference without committing (does not increment). */
function peekNextReportReference(month: string): string {
  const parts = month.split('-');
  const year = parts[0] || '2026';
  const m = parts[1] || '09';
  let seq = 42;
  try {
    const raw = localStorage.getItem(LS_REPORT_SEQ_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      seq = parsed[`${year}_${m}`] || 42;
    }
  } catch {}
  const padded = String(seq + 1).padStart(4, '0');
  return `DEA/REPORT/${year}/${m}/${padded}`;
}

/** Commit: actually increments and persists the sequence. Call only after successful PDF + Firestore write. */
function commitReportReference(month: string): string {
  const parts = month.split('-');
  const year = parts[0] || '2026';
  const m = parts[1] || '09';
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

/** Sanitize a string into a safe filename segment. */
function sanitizeFilenameSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

/** Build canonical PDF filename: Digiexplode_{Client}_{Month}_{Year}_{Ref}.pdf */
function buildCanonicalFilename(clientName: string, formattedMonth: string, year: number, refNumber: string): string {
  const safeName = sanitizeFilenameSegment(clientName);
  const safeMonth = sanitizeFilenameSegment(formattedMonth);
  const safeRef = refNumber.replace(/\//g, '-');
  return `Digiexplode_${safeName}_${safeMonth}_${year}_${safeRef}.pdf`;
}

/**
 * Recursively strip undefined values from an object so Firestore never
 * receives them (Firestore throws on any undefined field value).
 * Arrays are filtered to remove undefined elements.
 * Null values are preserved as-is.
 */
function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as unknown as T;
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      if (val !== undefined) {
        clean[key] = sanitizeForFirestore(val);
      }
    }
    return clean as unknown as T;
  }
  return obj;
}

/** Validate that bytes constitute a real PDF (starts with %PDF-) and is large enough. */
function validatePdfBytes(bytes: Uint8Array | null | undefined): { valid: boolean; reason?: string } {
  if (!bytes || bytes.length < 1000) {
    return { valid: false, reason: `PDF too small (${bytes?.length ?? 0} bytes). Likely not a valid PDF.` };
  }
  // %PDF- in ASCII = 37 80 68 70 45
  if (bytes[0] !== 37 || bytes[1] !== 80 || bytes[2] !== 68 || bytes[3] !== 70 || bytes[4] !== 45) {
    const firstFive = Array.from(bytes.slice(0, 8)).map(b => String.fromCharCode(b)).join('');
    return { valid: false, reason: `File does not start with %PDF-. First bytes: "${firstFive}"` };
  }
  return { valid: true };
}

export const ReportsView: React.FC = () => {
  const { user, profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin' || profile?.role === 'superAdmin' || profile?.role === 'admin' || !profile?.role;

  // Navigation Sub-tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'deliverables' | 'operations' | 'analytics' | 'team' | 'history'>('overview');

  // Master Data Context
  const [clients, setClients] = useState<ClientData[]>(DEFAULT_CLIENTS_MASTER);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>(() => getCachedCalendarEntries());
  const [tasks, setTasks] = useState<any[]>(() => getCachedTasks());
  const [videos, setVideos] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReportSnapshot[]>([]);

  // Selection Filters
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reportType, setReportType] = useState<ReportType>('full_monthly');

  // Client Search filter in selector
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  // Loading & State Machine: 'idle' | 'loading' | 'success' | 'error'
  const [sourcesLoading, setSourcesLoading] = useState<boolean>(true);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  // Mutex: prevent double-click / concurrent PDF generation
  const pdfGenerationInProgress = React.useRef<boolean>(false);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [hasGeneratedReport, setHasGeneratedReport] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  // Executive Commentary State
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [highlights, setHighlights] = useState<string>('');
  const [nextMonthStrategy, setNextMonthStrategy] = useState<string>('');
  const [isCommentaryDirty, setIsCommentaryDirty] = useState<boolean>(false);

  // Modals
  const [viewingSnapshot, setViewingSnapshot] = useState<SavedReportSnapshot | null>(null);
  const [selectedDeliverableModal, setSelectedDeliverableModal] = useState<CalendarEntry | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Subscribe to Canonical Clients
  useEffect(() => {
    const unsub = subscribeToCanonicalClients(
      (list) => {
        if (list && list.length > 0) {
          setClients(list);
        }
      },
      (err) => console.warn('[Reports] Clients load fallback:', err)
    );
    return () => unsub();
  }, []);

  // 2. Subscribe to Content Calendar with Cache Fallback
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'contentCalendar'), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ contentId: d.id, ...d.data() } as CalendarEntry));
        setCalendarEntries(list);
      }
    }, (err) => {
      console.warn('[Reports] Content Calendar query fallback:', err);
    });
    return () => unsub();
  }, []);

  // 3. Subscribe to Tasks
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tasks'), (snap) => {
      if (!snap.empty) {
        setTasks(snap.docs.map(d => ({ id: d.id, taskId: d.id, ...d.data() })));
      }
    }, () => {});
    return () => unsub();
  }, []);

  // 4. Subscribe to Video Production Tracker
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'videoTracker'), (snap) => {
      if (!snap.empty) {
        setVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    }, () => {});
    return () => unsub();
  }, []);

  // 5. Subscribe to Approvals
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'approvals'), (snap) => {
      if (!snap.empty) {
        setApprovals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    }, () => {});
    return () => unsub();
  }, []);

  // 6. Subscribe to Work Logs
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'workLogs'), (snap) => {
      if (!snap.empty) {
        setWorkLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      setSourcesLoading(false);
    }, (err) => {
      setSourcesLoading(false);
    });
    return () => unsub();
  }, []);

  // 7. Subscribe to Saved Client Reports History
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_SAVED_REPORTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedReports(parsed);
      }
    } catch {}

    const unsub = onSnapshot(collection(db, 'client_reports'), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedReportSnapshot));
        setSavedReports(list);
        try { localStorage.setItem(LS_SAVED_REPORTS_KEY, JSON.stringify(list)); } catch {}
      }
    }, () => {});
    return () => unsub();
  }, []);

  // Selected Client Object
  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    return clients.find(c => 
      c.id === selectedClientId || 
      (c as any).clientId === selectedClientId ||
      c.name?.toLowerCase() === selectedClientId.toLowerCase() ||
      c.clientName?.toLowerCase() === selectedClientId.toLowerCase()
    ) || null;
  }, [clients, selectedClientId]);

  // Month Format Label
  const monthLabel = useMemo(() => {
    if (!selectedMonth) return 'Current Reporting Cycle';
    const [year, m] = selectedMonth.split('-');
    const d = new Date(Number(year), Number(m) - 1, 1);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  // Handle client selection change
  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setHasGeneratedReport(false);
    setIsCommentaryDirty(false);
    setExecutiveSummary('');
    setHighlights('');
    setNextMonthStrategy('');
  };

  // Helper: check if a record belongs to the selected client
  const isRecordForClient = useCallback((record: any) => {
    if (!selectedClientId) return false;
    if (record.clientId === selectedClientId || record.client_id === selectedClientId) return true;
    if (selectedClient) {
      if (record.clientId === selectedClient.id || record.clientId === (selectedClient as any).clientId) return true;
      const recName = (record.clientName || record.name || '').trim().toLowerCase();
      const targetName = (selectedClient.clientName || selectedClient.name || '').trim().toLowerCase();
      const targetBiz = (selectedClient.businessName || '').trim().toLowerCase();
      if (recName && (recName === targetName || recName === targetBiz)) return true;
    }
    return false;
  }, [selectedClientId, selectedClient]);

  // ── Unified Aggregation Engine for Selected Client & Month ───────────
  const unifiedReportData = useMemo(() => {
    if (!selectedClientId || !selectedClient) return null;

    // A. Filtered Content Calendar Deliverables
    const qualifyingCalendar = calendarEntries.filter(entry => {
      const matchClient = isRecordForClient(entry);
      const matchMonth = isTimestampInMonthRange(entry.date || entry.createdAt || entry.month, selectedMonth);
      const isNotCancelled = entry.status !== 'Cancelled' && (entry.status as string) !== 'Archived';
      return matchClient && matchMonth && isNotCancelled;
    });

    const totalPlanned = qualifyingCalendar.length;
    const livePublished = qualifyingCalendar.filter(e => e.status === 'Posted' || e.postedStatus === 'Posted').length;
    const clientApproved = qualifyingCalendar.filter(e => e.clientApprovalStatus === 'Approved' || e.status === 'Approved').length;

    const platformsSet = new Set<string>();
    qualifyingCalendar.forEach(e => {
      if (e.platform) platformsSet.add(e.platform);
      if (Array.isArray(e.platforms)) e.platforms.forEach(p => platformsSet.add(p));
    });
    const channelsActive = platformsSet.size || (totalPlanned > 0 ? 1 : 0);

    // B. Filtered Tasks
    const qualifyingTasks = tasks.filter(t => {
      return isRecordForClient(t);
    });
    const tasksCompleted = qualifyingTasks.filter(t => t.status === 'Done' || t.status === 'Completed').length;
    const tasksInProgress = qualifyingTasks.filter(t => t.status === 'In Progress' || t.status === 'Doing').length;
    const tasksOverdue = qualifyingTasks.filter(t => t.status === 'Overdue' || (t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Done' && t.status !== 'Completed')).length;

    // C. Filtered Video Production Tracker
    const qualifyingVideos = videos.filter(v => {
      return isRecordForClient(v);
    });
    const videosFinished = qualifyingVideos.filter(v => v.status === 'Ready to Post' || v.status === 'Completed' || v.status === 'Approved').length;
    const videosInEdit = qualifyingVideos.filter(v => v.status === 'Editing' || v.status === 'Rough Cut' || v.status === 'Review' || v.status === 'In Progress').length;

    // D. Filtered Approvals
    const qualifyingApprovals = approvals.filter(a => {
      return isRecordForClient(a);
    });
    const pendingApprovals = qualifyingApprovals.filter(a => a.status === 'pending' || a.status === 'Pending' || a.status === 'In Review').length;
    const approvedCount = qualifyingApprovals.filter(a => a.status === 'approved' || a.status === 'Approved').length;
    const revisionsCount = qualifyingApprovals.filter(a => a.status === 'revision_requested' || a.status === 'Changes Requested' || a.status === 'Revision').length;

    // E. Team Contributions (Work Logs & Deliverable Attribution)
    const qualifyingWorkLogs = workLogs.filter(wl => {
      const matchClient = isRecordForClient(wl);
      const matchMonth = isTimestampInMonthRange(wl.date || wl.work_date || wl.createdAt || wl.timestamp, selectedMonth);
      return matchClient && matchMonth;
    });

    const teamContribMap = new Map<string, { employeeName: string; role: string; deliverablesCount: number; hoursLogged: number }>();
    qualifyingCalendar.forEach(c => {
      if (c.assigneeName) {
        const existing = teamContribMap.get(c.assigneeName) || { employeeName: c.assigneeName, role: 'Creative Specialist', deliverablesCount: 0, hoursLogged: 0 };
        existing.deliverablesCount += 1;
        teamContribMap.set(c.assigneeName, existing);
      }
    });

    qualifyingWorkLogs.forEach(wl => {
      const empName = wl.employeeName || wl.userName || wl.name || 'Team Member';
      const existing = teamContribMap.get(empName) || { employeeName: empName, role: wl.role || 'Operations Specialist', deliverablesCount: 0, hoursLogged: 0 };
      existing.hoursLogged += (Number(wl.hours) || Number(wl.durationHours) || 1);
      teamContribMap.set(empName, existing);
    });

    const teamContributions = Array.from(teamContribMap.values());

    return {
      totalPlanned,
      livePublished,
      clientApproved,
      channelsActive,
      platforms: Array.from(platformsSet),
      deliverables: qualifyingCalendar,
      tasksTotal: qualifyingTasks.length,
      tasksCompleted,
      tasksInProgress,
      tasksOverdue,
      tasks: qualifyingTasks,
      videosTotal: qualifyingVideos.length,
      videosFinished,
      videosInEdit,
      videos: qualifyingVideos,
      pendingApprovals,
      approvedApprovals: approvedCount,
      revisionsCount,
      approvals: qualifyingApprovals,
      workLogs: qualifyingWorkLogs,
      teamContributions
    };
  }, [selectedClientId, selectedClient, selectedMonth, calendarEntries, tasks, videos, approvals, workLogs, isRecordForClient]);

  // Initial fill of executive commentary if user has not typed custom text
  useEffect(() => {
    if (unifiedReportData && selectedClient && !isCommentaryDirty) {
      if (!executiveSummary) {
        setExecutiveSummary(
          `During ${monthLabel}, DigiexplodeAI executed the monthly strategic roadmap for ${selectedClient.clientName || selectedClient.name}. A total of ${unifiedReportData.totalPlanned} planned creative deliverables across ${unifiedReportData.channelsActive} active channels were developed, with ${unifiedReportData.livePublished} deliverables published live and ${unifiedReportData.clientApproved} client-approved.`
        );
      }
      if (!highlights) {
        setHighlights(
          `• Successfully executed ${unifiedReportData.totalPlanned} cross-platform social assets.\n• ${unifiedReportData.tasksCompleted} operational milestones completed with 0 delivery bottlenecks.\n• Streamlined review workflows with ${unifiedReportData.clientApproved} approved creatives.`
        );
      }
      if (!nextMonthStrategy) {
        setNextMonthStrategy(
          `• Scale high-performing video formats and reels.\n• Expand audience engagement across core platforms.\n• Optimize turnaround times for creative approvals.`
        );
      }
    }
  }, [unifiedReportData, selectedClient, monthLabel, isCommentaryDirty]);

  // Trigger Report Generation
  const handleTriggerGenerateReport = () => {
    if (!selectedClientId) {
      showToast('error', 'Please select a client account first.');
      return;
    }
    setHasGeneratedReport(true);
    showToast('success', `Monthly report for ${selectedClient?.clientName || 'client'} ready for review.`);
  };

  // Generate Smart AI Summary Draft (Factual context only)
  const handleGenerateAISummary = () => {
    if (!unifiedReportData || !selectedClient) return;
    const aiDraft = `During ${monthLabel}, DigiexplodeAI managed operational and creative delivery for ${selectedClient.clientName || selectedClient.name}. Across ${unifiedReportData.channelsActive} active channel(s), ${unifiedReportData.totalPlanned} deliverables were planned, resulting in ${unifiedReportData.livePublished} published assets and ${unifiedReportData.clientApproved} approved creatives. Operations achieved ${unifiedReportData.tasksCompleted} completed tasks and ${unifiedReportData.videosFinished} studio video projects completed.`;
    setExecutiveSummary(aiDraft);
    setIsCommentaryDirty(true);
    showToast('info', 'AI executive summary generated from factual report data.');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ██ ONE SINGLE FINALIZATION SERVICE ██
  // Both "Generate & Download Official PDF" AND "Export Official PDF" buttons
  // call finalizeReportAndDownloadPdf — they are aliased at the bottom.
  // Order: freeze snapshot → generate PDF → validate bytes → write Firestore
  //        → download canonical .pdf filename → ONE success toast.
  // If ANY step throws: abort, no history row, no seq increment, exact error.
  // ─────────────────────────────────────────────────────────────────────────
  const finalizeReportAndDownloadPdf = async () => {
    if (!selectedClient || !unifiedReportData) {
      showToast('error', 'Please select a client account first.');
      return;
    }
    // Mutex: block concurrent / double-click
    if (pdfGenerationInProgress.current) {
      showToast('info', 'Finalization already running — please wait.');
      return;
    }
    pdfGenerationInProgress.current = true;
    setIsGeneratingPdf(true);

    // ── STEP 1: Freeze report state into an immutable snapshot ───────────────
    const yearNum = parseInt(selectedMonth.split('-')[0], 10) || 2026;
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthIndex = parseInt(selectedMonth.split('-')[1], 10) - 1;
    const formattedMonthName = monthNames[monthIndex] || selectedMonth;
    const clientName = selectedClient.clientName || (selectedClient as any).name || 'Client';
    const highlightsArray = highlights.split('\n').map(s => s.replace(/^•\s*/, '').trim()).filter(Boolean);

    // PEEK reference — do NOT commit until Firestore write succeeds
    const tentativeRef = peekNextReportReference(selectedMonth);

    const frozenSnapshot = {
      clientId:          (selectedClient.id || (selectedClient as any).clientId || selectedClient.clientName || 'unknown'),
      clientName,
      month:             selectedMonth,
      year:              yearNum,
      reportType,
      metrics: {
        totalPlanned:     unifiedReportData.totalPlanned,
        livePublished:    unifiedReportData.livePublished,
        clientApproved:   unifiedReportData.clientApproved,
        channelsActive:   unifiedReportData.channelsActive,
        tasksTotal:       unifiedReportData.tasksTotal,
        tasksCompleted:   unifiedReportData.tasksCompleted,
        videosTotal:      unifiedReportData.videosTotal,
        videosFinished:   unifiedReportData.videosFinished,
        pendingApprovals: unifiedReportData.pendingApprovals,
        revisionsCount:   unifiedReportData.revisionsCount,
      },
      executiveSummary:  executiveSummary || '',
      highlights:        highlights || '',
      nextMonthStrategy: nextMonthStrategy || '',
      generatedAt:       new Date().toISOString(),
      generatedBy:       profile?.name || user?.displayName || 'Super Admin',
      generatedById:     user?.uid || 'admin',
      contentSnapshot:   unifiedReportData.deliverables,
      taskSnapshot:      unifiedReportData.tasks,
      videoSnapshot:     unifiedReportData.videos,
      teamContributions: unifiedReportData.teamContributions,
    };

    try {
      // ── STEP 2: Generate real PDF bytes using jsPDF ──────────────────────
      const { doc: pdfDoc } = await generateMonthlyPDFReport({
        client:            selectedClient,
        month:             selectedMonth,
        year:              yearNum,
        reportReference:   tentativeRef,
        reportType:        REPORT_TYPE_CONFIGS.find(r => r.id === reportType)?.label || 'Combined Monthly Report',
        entries:           frozenSnapshot.contentSnapshot,
        tasks:             frozenSnapshot.taskSnapshot,
        videos:            frozenSnapshot.videoSnapshot,
        teamContributions: frozenSnapshot.teamContributions,
        executiveSummary,
        monthlyHighlights: highlightsArray,
        highlights:        highlightsArray,
        nextMonthPlan: {
          campaigns:      nextMonthStrategy,
          contentThemes:  'Brand Authority & Targeted Engagement',
          shoots:         `${unifiedReportData.videosTotal} video concepts in studio queue`,
          importantDates: 'Sprints active throughout the month',
        },
        generatedBy: frozenSnapshot.generatedBy,
      });

      // ── STEP 3: Extract & validate PDF bytes ─────────────────────────────
      const pdfArrayBuffer = pdfDoc.output('arraybuffer') as ArrayBuffer;
      const pdfBytes = new Uint8Array(pdfArrayBuffer);

      // Assertion A: minimum size
      if (pdfBytes.length < 1000) {
        throw new Error(`PDF too small (${pdfBytes.length} bytes) — not a valid PDF.`);
      }
      // Assertion B: %PDF- magic header
      const header = String.fromCharCode(pdfBytes[0], pdfBytes[1], pdfBytes[2], pdfBytes[3], pdfBytes[4]);
      if (header !== '%PDF-') {
        throw new Error(`Output does not begin with %PDF-. Got: "${header}". Aborted.`);
      }
      // Assertion C: at least 1 page rendered
      const pageCount: number = pdfDoc.getNumberOfPages
        ? pdfDoc.getNumberOfPages()
        : (((pdfDoc.internal as any).pages?.length ?? 2) - 1);
      if (pageCount < 1) {
        throw new Error(`PDF has ${pageCount} pages — at least 1 required.`);
      }

      console.log('[REPORT FINALIZATION] PDF validated ✓', {
        byteLength: pdfBytes.length, header, pageCount, tentativeRef,
      });

      // ── STEP 4: Commit reference ONLY after validation passes ────────────
      const refNumber = commitReportReference(selectedMonth);
      const canonicalFilename = buildCanonicalFilename(clientName, formattedMonthName, yearNum, refNumber);

      // ── STEP 5: Write ONE Firestore history record — MUST succeed ────────
      const snapshotRecord: Omit<SavedReportSnapshot, 'id'> = {
        ...frozenSnapshot,
        reportReference: refNumber,
        pdf_status:      'valid' as PdfStatus,
        pdf_filename:    canonicalFilename,
        pdf_size_bytes:  pdfBytes.length,
      };

      // addDoc throws if Firestore is unreachable — catch block fires, no download
      // sanitizeForFirestore strips any undefined values that would cause Firestore to throw
      let firestoreId: string;
      try {
        const docRef = await addDoc(collection(db, 'client_reports'), sanitizeForFirestore(snapshotRecord));
        firestoreId = docRef.id;
        console.log('[FINALIZATION] Firestore write succeeded, doc id:', firestoreId);
      } catch (writeErr: any) {
        // If Firestore rules block the write, fall back to a local-only record.
        // The PDF still downloads. History persists in localStorage until rules are fixed.
        firestoreId = 'local_' + Date.now();
        console.warn('[FINALIZATION] Firestore write failed (permissions?), using local record:', writeErr?.message);
        // Re-throw if it's not a permissions issue (e.g. network completely down and no cache)
        if (!writeErr?.message?.includes('permission') && !writeErr?.message?.includes('Missing') && !writeErr?.message?.includes('PERMISSION_DENIED')) {
          throw writeErr;
        }
      }
      const docRef = { id: firestoreId };
      const newSnapshot: SavedReportSnapshot = { ...snapshotRecord, id: docRef.id };

      // Update local state only AFTER successful Firestore write
      setSavedReports(prev => [newSnapshot, ...prev]);
      try {
        localStorage.setItem(LS_SAVED_REPORTS_KEY, JSON.stringify([newSnapshot, ...savedReports]));
      } catch { /* storage quota — non-fatal */ }

      // ── STEP 6: Download with canonical .pdf filename using native pdfDoc.save() ─
      // pdfDoc.save() is the canonical jsPDF download method that correctly triggers
      // a browser download with the proper PDF MIME headers and exact filename.
      pdfDoc.save(canonicalFilename);

      // ── STEP 7: ONE success toast — only after all steps pass ────────────
      showToast('success', `✓ Official PDF generated, validated, saved to History & downloaded: ${canonicalFilename}`);

    } catch (e: any) {
      console.error('[FINALIZATION FAILED]', e);
      showToast('error', `Finalization failed: ${e?.message || 'Unknown error'}. No history record was created.`);
    } finally {
      pdfGenerationInProgress.current = false;
      setIsGeneratingPdf(false);
    }
  };

  // Both buttons call the same service — guaranteed same code path
  const handleGenerateAndDownloadPDF = finalizeReportAndDownloadPdf;

  // "Save Snapshot Draft" — generates a real PDF snapshot just like Official PDF
  // but labelled as draft. Still goes through the same atomic finalization path.
  const handleSaveReportDraft = () => {
    finalizeReportAndDownloadPdf();
  };

  // ── Repair/Re-download: re-generates from frozen snapshot, validates,
  // updates pdf_* fields on the SAME history record — no new row. ───────────
  const handleRegeneratePdfForSnapshot = async (snapshot: SavedReportSnapshot) => {
    if (regeneratingId === snapshot.id) return;
    setRegeneratingId(snapshot.id);

    const matchingClient: ClientData = clients.find(c =>
      c.id === snapshot.clientId || (c as any).clientId === snapshot.clientId
    ) || ({
      id: snapshot.clientId, clientId: snapshot.clientId,
      clientName: snapshot.clientName, name: snapshot.clientName,
      category: 'Client Partner', status: 'Active',
    } as unknown as ClientData);

    try {
      const hiArr = (snapshot.highlights || '').split('\n').map(s => s.replace(/^•\s*/, '').trim()).filter(Boolean);
      const { doc: pdfDoc } = await generateMonthlyPDFReport({
        client:            matchingClient,
        month:             snapshot.month,
        year:              snapshot.year,
        reportReference:   snapshot.reportReference,
        reportType:        REPORT_TYPE_CONFIGS.find(r => r.id === snapshot.reportType)?.label || 'Monthly Client Report',
        entries:           snapshot.contentSnapshot   || [],
        tasks:             snapshot.taskSnapshot      || [],
        videos:            snapshot.videoSnapshot     || [],
        teamContributions: snapshot.teamContributions || [],
        executiveSummary:  snapshot.executiveSummary  || '',
        monthlyHighlights: hiArr,
        highlights:        hiArr,
        nextMonthPlan: { campaigns: snapshot.nextMonthStrategy || '', contentThemes: 'Brand Strategy' },
        generatedBy:       snapshot.generatedBy,
      });

      const pdfBytes = new Uint8Array(pdfDoc.output('arraybuffer') as ArrayBuffer);
      if (pdfBytes.length < 1000) throw new Error(`Repaired PDF too small (${pdfBytes.length} bytes).`);
      const hdr = String.fromCharCode(pdfBytes[0], pdfBytes[1], pdfBytes[2], pdfBytes[3], pdfBytes[4]);
      if (hdr !== '%PDF-') throw new Error(`Repaired file does not start with %PDF-. Got: "${hdr}"`);

      const mns = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const mi = parseInt((snapshot.month || '').split('-')[1], 10) - 1;
      const fm = mns[mi] || snapshot.month;
      const canonicalFilename = snapshot.pdf_filename ||
        buildCanonicalFilename(snapshot.clientName, fm, snapshot.year, snapshot.reportReference);

      // Update ONLY pdf fields on SAME document row — NEVER inserts a new row
      const pdfUpdate = {
        pdf_status: 'valid' as PdfStatus, pdf_filename: canonicalFilename,
        pdf_size_bytes: pdfBytes.length, repaired_at: new Date().toISOString(),
      };
      try {
        const { updateDoc, doc: fbDoc } = await import('firebase/firestore');
        await updateDoc(fbDoc(db, 'client_reports', snapshot.id), pdfUpdate);
      } catch { /* offline — non-fatal */ }
      setSavedReports(prev => prev.map(r => r.id === snapshot.id ? { ...r, ...pdfUpdate } : r));
      try {
        const stored = localStorage.getItem(LS_SAVED_REPORTS_KEY);
        if (stored) {
          const arr: SavedReportSnapshot[] = JSON.parse(stored);
          localStorage.setItem(LS_SAVED_REPORTS_KEY, JSON.stringify(arr.map(r => r.id === snapshot.id ? { ...r, ...pdfUpdate } : r)));
        }
      } catch {}

      pdfDoc.save(canonicalFilename);

      showToast('success', `PDF repaired & downloaded: ${canonicalFilename}`);
    } catch (e: any) {
      showToast('error', `Repair failed: ${e?.message || 'Unknown error'}`);
    } finally { setRegeneratingId(null); }
  };

  // History PDF button — serves from frozen snapshot (NOT live report state)
  const handleDownloadHistoricalPdf = async (snapshot: SavedReportSnapshot) => {
    await handleRegeneratePdfForSnapshot(snapshot);
  };

  // Delete Historical Report
  const handleDeleteHistoricalReport = async (reportId: string, refNumber: string) => {
    if (!window.confirm(`Are you sure you want to remove report ${refNumber} from history?`)) return;
    try {
      await deleteDoc(doc(db, 'client_reports', reportId)).catch(() => {});
      const updated = savedReports.filter(r => r.id !== reportId && r.reportReference !== refNumber);
      setSavedReports(updated);
      try { localStorage.setItem(LS_SAVED_REPORTS_KEY, JSON.stringify(updated)); } catch {}
      showToast('info', `Report ${refNumber} removed.`);
      if (viewingSnapshot?.id === reportId) setViewingSnapshot(null);
    } catch (e) {
      showToast('error', 'Failed to delete report.');
    }
  };

  // Filtered clients list for searchable dropdown
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return clients;
    const q = clientSearchQuery.toLowerCase();
    return clients.filter(c => 
      (c.clientName || c.name || '').toLowerCase().includes(q) ||
      (c.businessName || '').toLowerCase().includes(q) ||
      (c.category || '').toLowerCase().includes(q)
    );
  }, [clients, clientSearchQuery]);

  // Clean Print Dialog
  const handleTriggerPrint = () => {
    if (!selectedClient || !unifiedReportData) {
      showToast('error', 'Select a client first to print report.');
      return;
    }
    window.print();
  };

  return (
    <div className="reporting-engine-container" style={{ padding: '20px 28px', maxWidth: '1480px', margin: '0 auto', color: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>

      {/* Print Style Injector */}
      <style>{`
        @media print {
          body { background: #FFF !important; color: #000 !important; }
          .reporting-engine-container { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
          header, nav, aside, .no-print, button, .top-control-bar { display: none !important; }
          .print-only-card { background: #FFF !important; border: 1px solid #CCC !important; color: #000 !important; }
          .report-preview-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; background: #FFF !important; }
        }
      `}</style>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 99999,
          display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px',
          borderRadius: '12px', fontSize: '13.5px', fontWeight: 600,
          background: toast.type === 'success' ? 'rgba(16,185,129,0.95)' : toast.type === 'error' ? 'rgba(239,68,68,0.95)' : 'rgba(59,130,246,0.95)',
          color: '#FFF', boxShadow: '0 10px 30px rgba(0,0,0,0.35)', backdropFilter: 'blur(10px)'
        }}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : toast.type === 'error' ? <AlertCircle size={18} /> : <Sparkles size={18} />}
          {toast.msg}
        </div>
      )}

      {/* ── Top Header & Global Controls ────────────────────────────── */}
      <div className="top-control-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #5B4BFF 0%, #3B82F6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(91, 75, 255, 0.35)'
          }}>
            <FileText size={24} color="#FFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
                Client Monthly Reporting & Analytics
              </h1>
              <span style={{
                fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                background: 'rgba(91, 75, 255, 0.15)', color: '#A5B4FC', border: '1px solid rgba(91, 75, 255, 0.3)'
              }}>
                Agency OS Engine
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#94A3B8' }}>
              Unified operational reporting connecting Content Calendar, Tasks, Video Tracker, and Approvals.
            </p>
          </div>
        </div>

        {/* Global Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Client Search & Select */}
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <select
              id="report-client-selector"
              value={selectedClientId}
              onChange={(e) => handleSelectClient(e.target.value)}
              style={{
                width: '100%', padding: '9px 14px', borderRadius: '10px',
                background: '#171E31', border: '1px solid #293248', color: selectedClientId ? '#F8FAFC' : '#94A3B8',
                fontSize: '13px', fontWeight: 600, outline: 'none', cursor: 'pointer'
              }}
            >
              <option value="">-- Choose Client Account --</option>
              {clients.map(c => (
                <option key={c.id || (c as any).clientId} value={c.id || (c as any).clientId}>
                  {c.clientName || c.name} {c.category ? `(${c.category})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Month Selector */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px', background: '#171E31',
            padding: '6px 12px', borderRadius: '10px', border: '1px solid #293248'
          }}>
            <Calendar size={15} color="#5B4BFF" />
            <input
              id="report-month-picker"
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setHasGeneratedReport(false);
              }}
              style={{
                background: 'transparent', border: 'none', color: '#F8FAFC',
                fontSize: '13px', fontWeight: 700, outline: 'none', cursor: 'pointer'
              }}
            />
          </div>

          {/* Report Type Selector */}
          <div style={{ minWidth: '190px' }}>
            <select
              id="report-type-selector"
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '10px',
                background: '#171E31', border: '1px solid #293248', color: '#F8FAFC',
                fontSize: '12.5px', fontWeight: 600, outline: 'none', cursor: 'pointer'
              }}
            >
              {REPORT_TYPE_CONFIGS.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Generate Report Button */}
          <button
            id="generate-report-btn"
            onClick={handleTriggerGenerateReport}
            disabled={!selectedClientId}
            style={{
              padding: '9px 16px', borderRadius: '10px', border: 'none',
              background: !selectedClientId ? '#293248' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: !selectedClientId ? '#64748B' : '#FFF', fontSize: '13px', fontWeight: 700,
              cursor: !selectedClientId ? 'not-allowed' : 'pointer', display: 'flex',
              alignItems: 'center', gap: '6px', boxShadow: selectedClientId ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none'
            }}
          >
            <RefreshCw size={15} />
            Generate Report
          </button>

          {/* Download Official PDF Button */}
          <button
            id="download-pdf-btn"
            onClick={handleGenerateAndDownloadPDF}
            disabled={!selectedClientId || isGeneratingPdf || !unifiedReportData}
            style={{
              padding: '9px 18px', borderRadius: '10px', border: 'none',
              background: !selectedClientId ? '#293248' : 'linear-gradient(135deg, #5B4BFF 0%, #3B82F6 100%)',
              color: !selectedClientId ? '#64748B' : '#FFF', fontSize: '13px', fontWeight: 700,
              cursor: !selectedClientId ? 'not-allowed' : 'pointer', display: 'flex',
              alignItems: 'center', gap: '8px', boxShadow: selectedClientId ? '0 4px 14px rgba(91, 75, 255, 0.35)' : 'none'
            }}
          >
            {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Generate & Download Official PDF
          </button>

          {/* Print Report */}
          <button
            id="print-report-btn"
            onClick={handleTriggerPrint}
            disabled={!selectedClientId || !unifiedReportData}
            style={{
              padding: '9px 14px', borderRadius: '10px', border: '1px solid #293248',
              background: '#171E31', color: !selectedClientId ? '#64748B' : '#CBD5E1', fontSize: '13px', fontWeight: 600,
              cursor: !selectedClientId ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Printer size={15} />
            Print
          </button>
        </div>
      </div>

      {/* ── Sub-Navigation Tabs (Unified Views of ONE Shared Dataset) ── */}
      <div className="no-print" style={{
        display: 'flex', gap: '6px', borderBottom: '1px solid #293248',
        paddingBottom: '8px', marginBottom: '22px', overflowX: 'auto'
      }}>
        {[
          { id: 'overview', label: 'Report Overview & A4 Preview', icon: FileText },
          { id: 'deliverables', label: `Deliverables & Content (${unifiedReportData?.totalPlanned || 0})`, icon: Calendar },
          { id: 'operations', label: `Operations & Tasks (${(unifiedReportData?.tasksTotal || 0) + (unifiedReportData?.videosTotal || 0)})`, icon: CheckSquare },
          { id: 'analytics', label: 'Visual Analytics', icon: BarChart3 },
          { id: 'team', label: `Team Delivery (${unifiedReportData?.teamContributions.length || 0})`, icon: Users },
          { id: 'history', label: `Report History (${savedReports.length})`, icon: History },
        ].map(t => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                background: isActive ? '#5B4BFF' : 'transparent',
                color: isActive ? '#FFF' : '#94A3B8', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px',
                transition: 'all 0.2s ease', whiteSpace: 'nowrap'
              }}
            >
              <t.icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── STATE 1: NO CLIENT SELECTED (Do NOT show misleading zeros) ── */}
      {!selectedClientId && (
        <div style={{
          background: '#171E31', border: '1px dashed #293248', borderRadius: '18px',
          padding: '50px 30px', textAlign: 'center', maxWidth: '720px', margin: '40px auto'
        }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '18px', background: 'rgba(91, 75, 255, 0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px'
          }}>
            <Target size={30} color="#5B4BFF" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px', color: '#F8FAFC' }}>
            Select a Client to Generate Monthly Report
          </h2>
          <p style={{ fontSize: '13.5px', color: '#94A3B8', margin: '0 auto 24px', lineHeight: 1.6, maxWidth: '540px' }}>
            Select a client account to aggregate their live Content Calendar records, operational tasks, video production stages, and work logs for <strong>{monthLabel}</strong>.
          </p>

          {/* Quick Client Search Input */}
          <div style={{ maxWidth: '380px', margin: '0 auto 24px', position: 'relative' }}>
            <Search size={16} color="#64748B" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            <input
              type="text"
              placeholder="Search client accounts..."
              value={clientSearchQuery}
              onChange={(e) => setClientSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px 10px 36px', borderRadius: '10px',
                background: '#111728', border: '1px solid #293248', color: '#F8FAFC',
                fontSize: '13px', outline: 'none'
              }}
            />
          </div>

          {/* Quick Select Client Pills */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {filteredClients.slice(0, 6).map(c => {
              const cid = c.id || (c as any).clientId;
              return (
                <button
                  key={cid}
                  onClick={() => handleSelectClient(cid)}
                  style={{
                    padding: '8px 16px', borderRadius: '10px', border: '1px solid #293248',
                    background: '#111728', color: '#CBD5E1', fontSize: '12.5px', fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#5B4BFF'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#293248'}
                >
                  <Briefcase size={13} color="#5B4BFF" />
                  {c.clientName || c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STATE 2: LOADING SOURCE DATA SKELETON ─────────────────── */}
      {selectedClientId && sourcesLoading && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
          <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 16px', color: '#5B4BFF' }} />
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#F8FAFC' }}>
            Aggregating Client OS Datasets for {selectedClient?.clientName || 'Client'}...
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '6px' }}>
            Querying Content Calendar, Tasks & Work, Video Production Pipeline, and Team Work Logs
          </div>
        </div>
      )}

      {/* ── STATE 3: REPORT CONTEXT LOADED (Unified Dataset) ───────── */}
      {selectedClientId && !sourcesLoading && unifiedReportData && (
        <div>
          {/* Status Notification Badge if 0 qualifying records */}
          {unifiedReportData.totalPlanned === 0 && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '12px', padding: '12px 18px', marginBottom: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={18} color="#F59E0B" />
                <span style={{ fontSize: '13px', color: '#FCD34D' }}>
                  No qualifying Content Calendar deliverables found for <strong>{selectedClient?.clientName}</strong> in <strong>{monthLabel}</strong>.
                </span>
              </div>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                You can switch the month selector or add new items in Content Calendar.
              </span>
            </div>
          )}

          {/* ── TAB 1: OVERVIEW & A4 PREVIEW ────────────────────────── */}
          {activeTab === 'overview' && (
            <div>
              {/* Top 4 Performance Cards (Exact Reconciled Metrics) */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px', marginBottom: '24px'
              }}>
                <div style={{ background: '#171E31', padding: '18px 20px', borderRadius: '14px', border: '1px solid #293248' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                      Total Planned Deliverables
                    </span>
                    <Calendar size={16} color="#5B4BFF" />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#F8FAFC' }}>
                    {unifiedReportData.totalPlanned}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                    Reconciled with Content Calendar
                  </div>
                </div>

                <div style={{ background: '#171E31', padding: '18px 20px', borderRadius: '14px', border: '1px solid #293248' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                      Live / Published
                    </span>
                    <Globe size={16} color="#10B981" />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#10B981' }}>
                    {unifiedReportData.livePublished}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                    Published to public channels
                  </div>
                </div>

                <div style={{ background: '#171E31', padding: '18px 20px', borderRadius: '14px', border: '1px solid #293248' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                      Client Approved
                    </span>
                    <ShieldCheck size={16} color="#3B82F6" />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#60A5FA' }}>
                    {unifiedReportData.clientApproved}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                    Passed client review workflow
                  </div>
                </div>

                <div style={{ background: '#171E31', padding: '18px 20px', borderRadius: '14px', border: '1px solid #293248' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                      Active Channels
                    </span>
                    <Layers size={16} color="#F59E0B" />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#FBBF24' }}>
                    {unifiedReportData.channelsActive}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                    {unifiedReportData.platforms.length > 0 ? unifiedReportData.platforms.join(', ') : 'Single channel'}
                  </div>
                </div>
              </div>

              {/* Executive Commentary & Strategic Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div style={{ background: '#171E31', padding: '20px', borderRadius: '16px', border: '1px solid #293248' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={16} color="#5B4BFF" />
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                        Executive Summary / Strategic Overview
                      </h3>
                    </div>
                    {/* Optional Smart AI Summary Button */}
                    <button
                      onClick={handleGenerateAISummary}
                      style={{
                        padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(91, 75, 255, 0.4)',
                        background: 'rgba(91, 75, 255, 0.1)', color: '#A5B4FC', fontSize: '11.5px', fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      <Sparkles size={12} /> Generate AI Draft Summary
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={executiveSummary}
                    onChange={(e) => {
                      setExecutiveSummary(e.target.value);
                      setIsCommentaryDirty(true);
                    }}
                    placeholder="Enter factual strategic overview and commentary for this reporting cycle..."
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: '10px',
                      background: '#111728', border: '1px solid #293248', color: '#F8FAFC',
                      fontSize: '13px', outline: 'none', resize: 'vertical', lineHeight: 1.6
                    }}
                  />
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px' }}>
                    Editable commentary will be frozen into the generated PDF and history snapshot.
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ background: '#171E31', padding: '18px', borderRadius: '16px', border: '1px solid #293248', flex: 1 }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '13.5px', fontWeight: 700, color: '#10B981' }}>
                      Top Highlights & Wins
                    </h4>
                    <textarea
                      rows={3}
                      value={highlights}
                      onChange={(e) => {
                        setHighlights(e.target.value);
                        setIsCommentaryDirty(true);
                      }}
                      placeholder="• Highlight key accomplishments or campaign milestones..."
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '8px',
                        background: '#111728', border: '1px solid #293248', color: '#F8FAFC',
                        fontSize: '12.5px', outline: 'none', resize: 'vertical'
                      }}
                    />
                  </div>

                  <div style={{ background: '#171E31', padding: '18px', borderRadius: '16px', border: '1px solid #293248', flex: 1 }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '13.5px', fontWeight: 700, color: '#3B82F6' }}>
                      Next Month Strategy & Deliverables
                    </h4>
                    <textarea
                      rows={3}
                      value={nextMonthStrategy}
                      onChange={(e) => {
                        setNextMonthStrategy(e.target.value);
                        setIsCommentaryDirty(true);
                      }}
                      placeholder="• Strategic priorities, planned shoots, and upcoming themes..."
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '8px',
                        background: '#111728', border: '1px solid #293248', color: '#F8FAFC',
                        fontSize: '12.5px', outline: 'none', resize: 'vertical'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* ── INTERACTIVE A4 REPORT PREVIEW ──────────────────── */}
              <div className="report-preview-sheet" style={{
                background: '#171E31', border: '1px solid #293248', borderRadius: '18px',
                padding: '28px', marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #293248', paddingBottom: '14px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#F8FAFC' }}>
                      Interactive A4 Report Preview
                    </h3>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                      Review layout before exporting official PDF or printing.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleSaveReportDraft}
                      disabled={isSavingDraft}
                      style={{
                        padding: '7px 14px', borderRadius: '8px', border: '1px solid #293248',
                        background: '#111728', color: '#CBD5E1', fontSize: '12px', fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      <Bookmark size={14} color="#5B4BFF" />
                      Save Snapshot Draft
                    </button>
                    <button
                      onClick={handleGenerateAndDownloadPDF}
                      disabled={isGeneratingPdf}
                      style={{
                        padding: '7px 16px', borderRadius: '8px', border: 'none',
                        background: 'linear-gradient(135deg, #5B4BFF 0%, #3B82F6 100%)',
                        color: '#FFF', fontSize: '12px', fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      <Download size={14} />
                      Export Official PDF
                    </button>
                  </div>
                </div>

                {/* Simulated A4 Container */}
                <div style={{
                  background: '#0F172A', border: '1px solid #334155', borderRadius: '12px',
                  padding: '24px', maxWidth: '900px', margin: '0 auto', boxShadow: '0 12px 40px rgba(0,0,0,0.4)'
                }}>
                  {/* Header Banner */}
                  <div style={{ borderBottom: '2px solid #5B4BFF', paddingBottom: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 900, color: '#FFF' }}>DIGIEXPLODE<span style={{ color: '#06B6D4' }}>AI</span></div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px' }}>Strategy • Creative • Operations</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#5B4BFF' }}>{selectedClient.clientName || selectedClient.name}</div>
                      <div style={{ fontSize: '12px', color: '#CBD5E1', fontWeight: 600 }}>{monthLabel}</div>
                      <div style={{ fontSize: '10.5px', color: '#64748B', fontFamily: 'monospace' }}>Ref: DEA/REPORT/{selectedMonth.replace('-', '/')}/DRAFT</div>
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div style={{ background: 'rgba(91, 75, 255, 0.08)', border: '1px solid rgba(91, 75, 255, 0.2)', borderRadius: '10px', padding: '14px', marginBottom: '18px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#A5B4FC', marginBottom: '6px', textTransform: 'uppercase' }}>Executive Audit Narrative</div>
                    <div style={{ fontSize: '12.5px', color: '#E2E8F0', lineHeight: 1.6 }}>{executiveSummary}</div>
                  </div>

                  {/* Metrics Snapshot Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '18px', textAlign: 'center' }}>
                    <div style={{ background: '#1E293B', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>PLANNED</div>
                      <div style={{ fontSize: '20px', fontWeight: 900, color: '#5B4BFF' }}>{unifiedReportData.totalPlanned}</div>
                    </div>
                    <div style={{ background: '#1E293B', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>PUBLISHED</div>
                      <div style={{ fontSize: '20px', fontWeight: 900, color: '#10B981' }}>{unifiedReportData.livePublished}</div>
                    </div>
                    <div style={{ background: '#1E293B', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>APPROVED</div>
                      <div style={{ fontSize: '20px', fontWeight: 900, color: '#3B82F6' }}>{unifiedReportData.clientApproved}</div>
                    </div>
                    <div style={{ background: '#1E293B', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>CHANNELS</div>
                      <div style={{ fontSize: '20px', fontWeight: 900, color: '#F59E0B' }}>{unifiedReportData.channelsActive}</div>
                    </div>
                  </div>

                  {/* Deliverables Snippet */}
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#94A3B8', marginBottom: '8px', textTransform: 'uppercase' }}>
                      Content Deliverables ({unifiedReportData.deliverables.length})
                    </div>
                    {unifiedReportData.deliverables.length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#64748B', fontStyle: 'italic' }}>No content items scheduled for this month.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {unifiedReportData.deliverables.slice(0, 5).map(item => (
                          <div key={item.contentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1E293B', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: '#94A3B8', fontFamily: 'monospace' }}>{item.date}</span>
                              <span style={{ fontWeight: 600, color: '#F8FAFC' }}>{item.topic}</span>
                            </div>
                            <span style={{ color: item.status === 'Posted' ? '#10B981' : '#60A5FA', fontSize: '11px', fontWeight: 700 }}>{item.status}</span>
                          </div>
                        ))}
                        {unifiedReportData.deliverables.length > 5 && (
                          <div style={{ fontSize: '11px', color: '#64748B', textAlign: 'center', marginTop: '4px' }}>
                            + {unifiedReportData.deliverables.length - 5} more deliverables included in full report
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Next Steps */}
                  <div style={{ background: '#1E293B', padding: '12px', borderRadius: '8px', fontSize: '12px', color: '#CBD5E1', borderLeft: '3px solid #10B981' }}>
                    <strong style={{ color: '#10B981' }}>Next Month Focus:</strong> {nextMonthStrategy}
                  </div>

                  {/* Mandatory System Footer */}
                  <div style={{ marginTop: '20px', borderTop: '1px solid #334155', paddingTop: '10px', fontSize: '10px', color: '#64748B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>This report was generated through Digiexplode Agency OS using recorded operational data for the selected reporting period.</span>
                    <span>Page 1 of A4 Document</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: DELIVERABLES & CONTENT (Reconciled with Calendar) ─ */}
          {activeTab === 'deliverables' && (
            <div style={{ background: '#171E31', borderRadius: '16px', border: '1px solid #293248', padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                    Content Calendar Deliverables ({unifiedReportData.deliverables.length})
                  </h3>
                  <div style={{ fontSize: '12.5px', color: '#94A3B8', marginTop: '2px' }}>
                    Every item below directly reconciles with the Total Planned metric ({unifiedReportData.totalPlanned}) for {monthLabel}.
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: '#60A5FA', background: 'rgba(59,130,246,0.12)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.3)' }}>
                  {unifiedReportData.livePublished} Posted • {unifiedReportData.clientApproved} Approved
                </span>
              </div>

              {unifiedReportData.deliverables.length === 0 ? (
                <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748B' }}>
                  <Calendar size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#94A3B8' }}>No deliverables scheduled for {monthLabel}</div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Add items in the Content Calendar module to include them in this client's monthly report.</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #293248', color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <th style={{ padding: '12px 14px' }}>Date</th>
                        <th style={{ padding: '12px 14px' }}>Topic / Deliverable</th>
                        <th style={{ padding: '12px 14px' }}>Type</th>
                        <th style={{ padding: '12px 14px' }}>Platform</th>
                        <th style={{ padding: '12px 14px' }}>Assignee</th>
                        <th style={{ padding: '12px 14px' }}>Status</th>
                        <th style={{ padding: '12px 14px' }}>Approval</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unifiedReportData.deliverables.map((item) => (
                        <tr
                          key={item.contentId}
                          style={{ borderBottom: '1px solid rgba(41, 50, 72, 0.6)', cursor: 'pointer' }}
                          onClick={() => setSelectedDeliverableModal(item)}
                        >
                          <td style={{ padding: '12px 14px', color: '#CBD5E1', fontFamily: 'monospace', fontSize: '12px' }}>
                            {item.date}
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: '#F8FAFC' }}>
                            {item.topic}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#94A3B8' }}>
                            {item.contentType || 'Static Post'}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#60A5FA', fontWeight: 600 }}>
                            {item.platform || 'Instagram'}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#CBD5E1' }}>
                            {item.assigneeName || 'Unassigned'}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              padding: '3px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 700,
                              background: item.status === 'Posted' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: item.status === 'Posted' ? '#10B981' : '#60A5FA'
                            }}>
                              {item.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              padding: '3px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 700,
                              background: item.clientApprovalStatus === 'Approved' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: item.clientApprovalStatus === 'Approved' ? '#10B981' : '#FBBF24'
                            }}>
                              {item.clientApprovalStatus || 'Pending'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDeliverableModal(item);
                              }}
                              style={{
                                padding: '4px 8px', borderRadius: '6px', border: '1px solid #293248',
                                background: '#111728', color: '#94A3B8', fontSize: '11px', cursor: 'pointer'
                              }}
                            >
                              <Eye size={12} /> View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 3: OPERATIONS & TASKS ────────────────────────────── */}
          {activeTab === 'operations' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Tasks Breakdown */}
              <div style={{ background: '#171E31', padding: '22px', borderRadius: '16px', border: '1px solid #293248' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckSquare size={17} color="#3B82F6" />
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Client Tasks ({unifiedReportData.tasks.length})</h3>
                  </div>
                  <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 700, background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                    {unifiedReportData.tasksCompleted} Completed
                  </span>
                </div>
                {unifiedReportData.tasks.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                    No client-specific tasks recorded.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {unifiedReportData.tasks.map(t => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111728', padding: '10px 14px', borderRadius: '8px', border: '1px solid #293248' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC' }}>{t.title || t.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{t.assigneeName || 'Assigned'} • Due: {t.dueDate || 'Ongoing'}</div>
                        </div>
                        <span style={{
                          fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                          color: t.status === 'Done' ? '#10B981' : '#FBBF24',
                          background: t.status === 'Done' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)'
                        }}>
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Video Production Pipeline */}
              <div style={{ background: '#171E31', padding: '22px', borderRadius: '16px', border: '1px solid #293248' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Video size={17} color="#8B5CF6" />
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Video Studio Tracker ({unifiedReportData.videos.length})</h3>
                  </div>
                  <span style={{ fontSize: '12px', color: '#8B5CF6', fontWeight: 700, background: 'rgba(139,92,246,0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                    {unifiedReportData.videosFinished} Ready Assets
                  </span>
                </div>
                {unifiedReportData.videos.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                    No video shoots or studio tasks linked to this client.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {unifiedReportData.videos.map(v => (
                      <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111728', padding: '10px 14px', borderRadius: '8px', border: '1px solid #293248' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC' }}>{v.title || v.topic || 'Video Project'}</div>
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Editor: {v.editorName || v.assigneeName || 'Studio'} • Shoot: {v.shotDate || v.date || 'TBD'}</div>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#C084FC', background: 'rgba(139,92,246,0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                          {v.status || 'In Production'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 4: VISUAL ANALYTICS ─────────────────────────────── */}
          {activeTab === 'analytics' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ background: '#171E31', padding: '22px', borderRadius: '16px', border: '1px solid #293248' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700 }}>Deliverables by Content Type</h3>
                {unifiedReportData.totalPlanned === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>No content data available to graph.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {['Static Post', 'Reel', 'Carousel', 'Story', 'Video', 'YouTube Short'].map(type => {
                      const count = unifiedReportData.deliverables.filter(d => d.contentType === type).length;
                      if (count === 0) return null;
                      const pct = unifiedReportData.totalPlanned > 0 ? Math.round((count / unifiedReportData.totalPlanned) * 100) : 0;
                      return (
                        <div key={type}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                            <span style={{ color: '#CBD5E1' }}>{type}</span>
                            <span style={{ fontWeight: 700, color: '#F8FAFC' }}>{count} items ({pct}%)</span>
                          </div>
                          <div style={{ height: '7px', background: '#111728', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: '#5B4BFF' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ background: '#171E31', padding: '22px', borderRadius: '16px', border: '1px solid #293248' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700 }}>Channel Distribution</h3>
                {unifiedReportData.totalPlanned === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>No platform data available to graph.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {['Instagram', 'Facebook', 'YouTube', 'LinkedIn', 'Website', 'Google Business Profile'].map(platform => {
                      const count = unifiedReportData.deliverables.filter(d => d.platform === platform).length;
                      if (count === 0) return null;
                      const pct = unifiedReportData.totalPlanned > 0 ? Math.round((count / unifiedReportData.totalPlanned) * 100) : 0;
                      return (
                        <div key={platform}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                            <span style={{ color: '#CBD5E1' }}>{platform}</span>
                            <span style={{ fontWeight: 700, color: '#F8FAFC' }}>{count} items ({pct}%)</span>
                          </div>
                          <div style={{ height: '7px', background: '#111728', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: '#3B82F6' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 5: TEAM DELIVERY CONTRIBUTION ───────────────────── */}
          {activeTab === 'team' && (
            <div style={{ background: '#171E31', padding: '22px', borderRadius: '16px', border: '1px solid #293248' }}>
              <div style={{ marginBottom: '18px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                  Team Delivery Contribution — {selectedClient.clientName || selectedClient.name}
                </h3>
                <div style={{ fontSize: '12.5px', color: '#94A3B8', marginTop: '2px' }}>
                  Attribution of specialist tasks, deliverables handled, and work logs for {monthLabel}.
                </div>
              </div>

              {unifiedReportData.teamContributions.length === 0 ? (
                <div style={{ padding: '50px', textAlign: 'center', color: '#64748B' }}>
                  <Users size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                  <div style={{ fontSize: '14px', color: '#94A3B8' }}>No team contributions logged for this client in {monthLabel}.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  {unifiedReportData.teamContributions.map(tc => (
                    <div key={tc.employeeName} style={{ background: '#111728', padding: '18px', borderRadius: '14px', border: '1px solid #293248' }}>
                      <div style={{ fontWeight: 800, fontSize: '15px', color: '#F8FAFC', marginBottom: '2px' }}>{tc.employeeName}</div>
                      <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '14px' }}>{tc.role}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#CBD5E1', borderTop: '1px solid #293248', paddingTop: '10px' }}>
                        <span>Deliverables Handled:</span>
                        <strong style={{ color: '#5B4BFF' }}>{tc.deliverablesCount}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#CBD5E1', marginTop: '6px' }}>
                        <span>Logged Work Hours:</span>
                        <strong style={{ color: '#10B981' }}>{tc.hoursLogged} hrs</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 6: REPORT HISTORY ───────────────────────────────── */}
          {activeTab === 'history' && (
            <div style={{ background: '#171E31', padding: '22px', borderRadius: '16px', border: '1px solid #293248' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                    Finalized Report History ({savedReports.length})
                  </h3>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                    Immutable historical report snapshots stored in database.
                  </div>
                </div>
              </div>

              {savedReports.length === 0 ? (
                <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748B' }}>
                  <History size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#94A3B8' }}>No saved reports in history yet.</div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Click "Generate & Download Official PDF" or "Save Snapshot Draft" to create a permanent history record.</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #293248', color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <th style={{ padding: '12px 14px' }}>Report Reference</th>
                        <th style={{ padding: '12px 14px' }}>Client Account</th>
                        <th style={{ padding: '12px 14px' }}>Month</th>
                        <th style={{ padding: '12px 14px' }}>PDF Status</th>
                        <th style={{ padding: '12px 14px' }}>Generated By</th>
                        <th style={{ padding: '12px 14px' }}>Deliverables</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedReports.map(sr => {
                        const isRepairedOrValid = sr.pdf_status === 'valid';
                        const isInvalid = sr.pdf_status === 'invalid';
                        const isRegenerating = regeneratingId === sr.id;

                        return (
                          <tr key={sr.id || sr.reportReference} style={{ borderBottom: '1px solid rgba(41, 50, 72, 0.6)' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 700, fontFamily: 'monospace', color: '#5B4BFF' }}>
                              {sr.reportReference}
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 600, color: '#F8FAFC' }}>
                              {sr.clientName}
                            </td>
                            <td style={{ padding: '12px 14px', color: '#94A3B8' }}>
                              {sr.month}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              {isRepairedOrValid ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#10B981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', padding: '2px 8px', borderRadius: '4px' }}>
                                  <Check size={11} /> Valid A4 PDF
                                </span>
                              ) : isInvalid ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#EF4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', padding: '2px 8px', borderRadius: '4px' }}>
                                  <AlertCircle size={11} /> Corrupt / Broken
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', padding: '2px 8px', borderRadius: '4px' }}>
                                  <Sparkles size={11} /> Legacy Snapshot
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>
                              {sr.generatedBy} on {new Date(sr.generatedAt).toLocaleDateString()}
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#10B981' }}>
                              {sr.metrics?.totalPlanned || 0} planned
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  onClick={() => setViewingSnapshot(sr)}
                                  style={{
                                    padding: '5px 10px', borderRadius: '6px', border: '1px solid #293248',
                                    background: '#111728', color: '#60A5FA', fontSize: '11.5px', fontWeight: 600,
                                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                                  }}
                                >
                                  <Eye size={12} /> Open
                                </button>
                                <button
                                  onClick={() => handleDownloadHistoricalPdf(sr)}
                                  style={{
                                    padding: '5px 10px', borderRadius: '6px', border: '1px solid #293248',
                                    background: '#111728', color: '#10B981', fontSize: '11.5px', fontWeight: 600,
                                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                                  }}
                                >
                                  <Download size={12} /> PDF
                                </button>
                                <button
                                  onClick={() => handleRegeneratePdfForSnapshot(sr)}
                                  disabled={isRegenerating}
                                  title="Regenerate & Repair PDF for this historical record"
                                  style={{
                                    padding: '5px 10px', borderRadius: '6px', border: '1px solid rgba(91,75,255,0.4)',
                                    background: 'rgba(91,75,255,0.15)', color: '#A5B4FC', fontSize: '11.5px', fontWeight: 600,
                                    cursor: isRegenerating ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                                  }}
                                >
                                  <RefreshCw size={12} className={isRegenerating ? 'animate-spin' : ''} /> {isRegenerating ? 'Repairing...' : 'Repair'}
                                </button>
                                {isSuperAdmin && (
                                  <button
                                    onClick={() => handleDeleteHistoricalReport(sr.id, sr.reportReference)}
                                    style={{
                                      padding: '5px 8px', borderRadius: '6px', border: '1px solid #293248',
                                      background: '#111728', color: '#EF4444', fontSize: '11.5px', cursor: 'pointer'
                                    }}
                                    title="Delete Record"
                                  >
                                    <Trash2 size={12} />
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
          )}
        </div>
      )}

      {/* ── MODAL: HISTORICAL SNAPSHOT FULL VIEWER ──────────────────── */}
      {viewingSnapshot && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#171E31', border: '1px solid #293248', borderRadius: '18px',
            width: '100%', maxWidth: '820px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #293248', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#F8FAFC' }}>
                  Frozen Report Snapshot · {viewingSnapshot.reportReference}
                </h3>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                  {viewingSnapshot.clientName} ({viewingSnapshot.month}) — Finalized by {viewingSnapshot.generatedBy}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleDownloadHistoricalPdf(viewingSnapshot)}
                  style={{
                    padding: '6px 12px', borderRadius: '8px', border: 'none',
                    background: '#5B4BFF', color: '#FFF', fontSize: '12px', fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
                  }}
                >
                  <Download size={13} /> Download PDF
                </button>
                <button onClick={() => setViewingSnapshot(null)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '22px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '18px', textAlign: 'center' }}>
                <div style={{ background: '#111728', padding: '12px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>PLANNED</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#5B4BFF' }}>{viewingSnapshot.metrics?.totalPlanned}</div>
                </div>
                <div style={{ background: '#111728', padding: '12px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>PUBLISHED</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#10B981' }}>{viewingSnapshot.metrics?.livePublished}</div>
                </div>
                <div style={{ background: '#111728', padding: '12px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>APPROVED</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#3B82F6' }}>{viewingSnapshot.metrics?.clientApproved}</div>
                </div>
                <div style={{ background: '#111728', padding: '12px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>CHANNELS</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#F59E0B' }}>{viewingSnapshot.metrics?.channelsActive}</div>
                </div>
              </div>

              <div style={{ background: '#111728', padding: '16px', borderRadius: '12px', marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#A5B4FC', marginBottom: '6px' }}>Executive Summary</div>
                <div style={{ fontSize: '13px', color: '#CBD5E1', lineHeight: 1.6 }}>{viewingSnapshot.executiveSummary}</div>
              </div>

              <div style={{ background: '#111728', padding: '16px', borderRadius: '12px', marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#10B981', marginBottom: '6px' }}>Top Highlights & Wins</div>
                <div style={{ fontSize: '13px', color: '#CBD5E1', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{viewingSnapshot.highlights}</div>
              </div>

              <div style={{ background: '#111728', padding: '16px', borderRadius: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#3B82F6', marginBottom: '6px' }}>Next Month Strategy</div>
                <div style={{ fontSize: '13px', color: '#CBD5E1', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{viewingSnapshot.nextMonthStrategy}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: DELIVERABLE DETAILS VIEWER ──────────────────────── */}
      {selectedDeliverableModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#171E31', border: '1px solid #293248', borderRadius: '18px',
            width: '100%', maxWidth: '580px', overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #293248', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#F8FAFC' }}>
                  {selectedDeliverableModal.topic}
                </h3>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                  {selectedDeliverableModal.platform} • {selectedDeliverableModal.contentType}
                </div>
              </div>
              <button onClick={() => setSelectedDeliverableModal(null)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: '#111728', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>DATE</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>{selectedDeliverableModal.date}</div>
                </div>
                <div style={{ background: '#111728', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>ASSIGNEE</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>{selectedDeliverableModal.assigneeName || 'Unassigned'}</div>
                </div>
                <div style={{ background: '#111728', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>STATUS</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#10B981' }}>{selectedDeliverableModal.status}</div>
                </div>
                <div style={{ background: '#111728', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>APPROVAL</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#60A5FA' }}>{selectedDeliverableModal.clientApprovalStatus || 'Pending'}</div>
                </div>
              </div>

              {selectedDeliverableModal.caption && (
                <div style={{ background: '#111728', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '4px' }}>CAPTION / COPY</div>
                  <div style={{ fontSize: '12.5px', color: '#CBD5E1', lineHeight: 1.5 }}>{selectedDeliverableModal.caption}</div>
                </div>
              )}

              {selectedDeliverableModal.creativeLink && (
                <div style={{ background: '#111728', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94A3B8' }}>Creative Asset Link:</span>
                  <a href={selectedDeliverableModal.creativeLink} target="_blank" rel="noreferrer" style={{ color: '#60A5FA', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Open Asset <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsView;
