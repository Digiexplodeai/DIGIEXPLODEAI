import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  type ClientData 
} from '../components/Portal/ClientList';
import { 
  subscribeToCanonicalClients, 
  DEFAULT_CLIENTS_MASTER,
  getCachedClients
} from '../lib/clientMaster';
import { 
  subscribeToCanonicalEmployees, 
  DEFAULT_EMPLOYEES_MASTER, 
  getCachedEmployees,
  type MasterEmployee 
} from '../lib/employeeMaster';
import { 
  subscribeToCanonicalApprovals, 
  getCachedApprovals, 
  type CanonicalApprovalRecord 
} from '../lib/approvalStorage';
import { 
  getCachedTasks, 
  DEFAULT_MASTER_TASKS, 
  normalizeTaskStatus, 
  type Task 
} from '../lib/taskStorage';
import { 
  getCachedCalendarEntries, 
  DEFAULT_CALENDAR_SEEDS, 
  type CalendarEntry 
} from '../lib/calendarStorage';

export interface AttendanceRecord {
  id: string;
  attendanceId?: string;
  employeeId?: string;
  employeeName: string;
  status: 'Present' | 'Late' | 'Absent' | 'Leave' | 'Half Day';
  checkIn?: string;
  checkInTime?: string;
  date: string;
}

export interface VideoRecord {
  id: string;
  clientName: string;
  videoCount?: number;
  status: string; // 'Pending' | 'Shot' | 'In Editing' | 'Edited' | 'Delivered' | 'Recorded' | 'Approved' | 'Ready to Post'
  editorName?: string;
  shotDate?: string;
  topic?: string;
  notes?: string;
}

export interface ActivityRecord {
  id: string;
  action: string;
  details?: string;
  userName: string;
  actorRole?: string;
  createdAt: string;
  timestamp?: string;
}

export interface ClientAttentionItem {
  id: string;
  name: string;
  reason: string;
  severity: 'urgent' | 'warning' | 'info';
  owner: string;
  nextAction: string;
  tab: string;
}

export interface DeadlineItem {
  id: string;
  clientName: string;
  deliverable: string;
  dueDate: string;
  owner: string;
  type: 'task' | 'content' | 'video';
  priority?: string;
}

const LOCAL_STORAGE_ATTENDANCE_KEY = 'digi_local_attendance';
const VIDEO_CACHE_KEY = 'digi_video_tracker_cache';

/**
 * Custom hook providing a real-time, unified single-source-of-truth
 * aggregation layer for the Command Center dashboard.
 */
export function useAgencyCommandCenterData() {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Canonical source states
  const [clients, setClients] = useState<ClientData[]>(() => getCachedClients());
  const [employees, setEmployees] = useState<MasterEmployee[]>(() => getCachedEmployees());
  const [approvals, setApprovals] = useState<CanonicalApprovalRecord[]>(() => getCachedApprovals());
  const [tasks, setTasks] = useState<Task[]>(() => getCachedTasks());
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>(() => getCachedCalendarEntries());
  const [videos, setVideos] = useState<VideoRecord[]>(() => {
    try {
      const raw = localStorage.getItem(VIDEO_CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [
      { id: 'vid-seed-1', clientName: 'Dr. Anupam Jindal', videoCount: 6, status: 'In Editing', editorName: 'Neha Gupta', shotDate: new Date().toISOString().split('T')[0], topic: 'Spine Robotic Surgery Q&A' },
      { id: 'vid-seed-2', clientName: 'Dr. Manishi Bansal', videoCount: 4, status: 'Shot', editorName: 'Neha Gupta', shotDate: new Date().toISOString().split('T')[0], topic: 'Women Fertility Awareness Series' },
      { id: 'vid-seed-3', clientName: 'The Millionaire Cafe', videoCount: 3, status: 'Pending', editorName: 'Vansh', shotDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], topic: 'Chef Special Live Sizzler Promo' },
    ];
  });
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_ATTENDANCE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityRecord[]>([]);

  // Authoritative dynamic today string (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // 1. Subscribe to Canonical Clients (Single Source of Truth with Clients module)
  useEffect(() => {
    const unsub = subscribeToCanonicalClients(
      (list) => {
        if (list && list.length > 0) setClients(list);
      },
      (err) => console.warn('[CommandCenter] Clients subscriber warning:', err)
    );
    return () => unsub();
  }, []);

  // 2. Subscribe to Canonical Employees (Single Source of Truth with Employees module)
  useEffect(() => {
    const unsub = subscribeToCanonicalEmployees(
      (list) => {
        if (list && list.length > 0) setEmployees(list);
      },
      (err) => console.warn('[CommandCenter] Employees subscriber warning:', err)
    );
    return () => unsub();
  }, []);

  // 3. Subscribe to Canonical Approvals (Single Source of Truth with Approvals module)
  useEffect(() => {
    const unsub = subscribeToCanonicalApprovals((list) => {
      setApprovals(list);
    });
    return () => unsub();
  }, []);

  // 4. Subscribe to Tasks (Single Source of Truth with Tasks & Work)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tasks'), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, taskId: d.id, ...d.data() } as Task));
        setTasks(list);
      } else {
        setTasks(getCachedTasks());
      }
    }, () => {
      setTasks(getCachedTasks());
    });
    return () => unsub();
  }, []);

  // 5. Subscribe to Content Calendar (Single Source of Truth with Content Calendar)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'contentCalendar'), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ contentId: d.id, ...d.data() } as CalendarEntry));
        setCalendarEntries(list);
      } else {
        setCalendarEntries(getCachedCalendarEntries());
      }
    }, () => {
      setCalendarEntries(getCachedCalendarEntries());
    });
    return () => unsub();
  }, []);

  // 6. Subscribe to Video Production Tracker
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'videoTracker'), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as VideoRecord));
        setVideos(list);
      }
    }, () => {});
    return () => unsub();
  }, []);

  // 7. Subscribe to Today's Attendance
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'attendance'), where('date', '==', todayStr)), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
        setAttendance(list);
      } else {
        try {
          const raw = localStorage.getItem(LOCAL_STORAGE_ATTENDANCE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const todayAtt = parsed.filter((a: any) => a.date === todayStr);
              if (todayAtt.length > 0) setAttendance(todayAtt);
            }
          }
        } catch {}
      }
    }, () => {});
    return () => unsub();
  }, [todayStr]);

  // 8. Subscribe to Pending Leave Requests
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'leaveRequests'), where('status', '==', 'Pending')), (snap) => {
      if (!snap.empty) {
        setLeaveRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    }, () => {});
    return () => unsub();
  }, []);

  // 9. Subscribe to Activity & Audit Logs
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(15)), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            action: `${data.action || 'updated'} ${data.target || data.module || ''}`,
            details: data.module || 'System',
            userName: data.actor || data.userName || 'Agency Member',
            actorRole: data.actorRole,
            createdAt: data.timestamp || new Date().toISOString()
          } as ActivityRecord;
        });
        setActivityLogs(list);
      }
      setLoading(false);
    }, () => {
      // Fallback to activityLogs collection
      onSnapshot(query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc'), limit(15)), (snap2) => {
        if (!snap2.empty) {
          setActivityLogs(snap2.docs.map(d => ({ id: d.id, ...d.data() } as ActivityRecord)));
        }
        setLoading(false);
      }, () => setLoading(false));
    });
    return () => unsub();
  }, []);

  // Manual Trigger to refresh all data sources
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setLastRefreshedAt(new Date());
    try {
      const [cSnap, eSnap, tSnap, calSnap, vSnap, aSnap] = await Promise.all([
        getDocs(collection(db, 'clients')).catch(() => null),
        getDocs(collection(db, 'employees')).catch(() => null),
        getDocs(collection(db, 'tasks')).catch(() => null),
        getDocs(collection(db, 'contentCalendar')).catch(() => null),
        getDocs(collection(db, 'videoTracker')).catch(() => null),
        getDocs(collection(db, 'approvals')).catch(() => null),
      ]);

      if (cSnap && !cSnap.empty) setClients(cSnap.docs.map(d => ({ id: d.id, ...d.data() } as ClientData)));
      if (eSnap && !eSnap.empty) setEmployees(eSnap.docs.map(d => ({ id: d.id, employeeId: d.id, ...d.data() } as MasterEmployee)));
      if (tSnap && !tSnap.empty) setTasks(tSnap.docs.map(d => ({ id: d.id, taskId: d.id, ...d.data() } as Task)));
      if (calSnap && !calSnap.empty) setCalendarEntries(calSnap.docs.map(d => ({ contentId: d.id, ...d.data() } as CalendarEntry)));
      if (vSnap && !vSnap.empty) setVideos(vSnap.docs.map(d => ({ id: d.id, ...d.data() } as VideoRecord)));
      if (aSnap && !aSnap.empty) setApprovals(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as CanonicalApprovalRecord)));
    } catch (err: any) {
      console.warn('[CommandCenter] refreshAll notice:', err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  // ─── DERIVED METRICS (100% Shared Canonical Logic) ────────────────────

  // Active Clients (Reusing Clients Module Logic)
  const activeClients = useMemo(() => {
    return clients.filter(c => c.status !== 'Inactive' && c.status !== 'Completed');
  }, [clients]);

  // Active Employees (Reusing Employees Module Logic)
  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status !== 'Inactive');
  }, [employees]);

  // Today Attendance Breakdown
  const todayAttendanceStats = useMemo(() => {
    const presentRecords = attendance.filter(a => a.status === 'Present' || a.status === 'Late' || a.status === 'Half Day');
    const lateRecords = attendance.filter(a => a.status === 'Late');
    const absentRecords = attendance.filter(a => a.status === 'Absent');
    const leaveRecords = attendance.filter(a => a.status === 'Leave');

    const totalEmployees = activeEmployees.length;
    const presentCount = presentRecords.length;
    const lateCount = lateRecords.length;
    const absentCount = absentRecords.length;
    const leaveCount = leaveRecords.length;
    const notMarkedCount = Math.max(0, totalEmployees - (presentCount + absentCount + leaveCount));

    return {
      totalEmployees,
      presentCount,
      lateCount,
      absentCount,
      leaveCount,
      notMarkedCount
    };
  }, [activeEmployees, attendance]);

  // Open & Filtered Tasks (Reusing Tasks & Work Logic)
  const openTasks = useMemo(() => {
    return tasks.filter(t => {
      const normalized = normalizeTaskStatus(t.status);
      return normalized !== 'Done' && t.status !== 'Cancelled' && !t.isArchived;
    });
  }, [tasks]);

  const overdueTasks = useMemo(() => {
    return openTasks.filter(t => (t.dueDate || t.due_date) && (t.dueDate || t.due_date)! < todayStr);
  }, [openTasks, todayStr]);

  const dueTodayTasks = useMemo(() => {
    return openTasks.filter(t => {
      const schDate = t.scheduledDate || t.scheduled_date || t.dueDate;
      const isCarriedForward = (t.rolloverCount || 0) > 0;
      return schDate === todayStr || isCarriedForward || t.dueDate === todayStr || (!t.dueDate && t.priority === 'Urgent');
    });
  }, [openTasks, todayStr]);

  const rolledForwardTasks = useMemo(() => {
    return openTasks.filter(t => (t.rolloverCount || 0) > 0 || (t.originalScheduledDate && t.originalScheduledDate < (t.scheduledDate || todayStr)));
  }, [openTasks, todayStr]);

  const upcomingTasks = useMemo(() => {
    return openTasks.filter(t => {
      const schDate = t.scheduledDate || t.scheduled_date || t.dueDate;
      return schDate && schDate > todayStr && (!t.dueDate || t.dueDate >= todayStr);
    });
  }, [openTasks, todayStr]);

  // Pending Approvals (Reusing Approvals Module Logic)
  const pendingApprovals = useMemo(() => {
    return approvals.filter(a => a.status === 'pending');
  }, [approvals]);

  // Videos in Production (Reusing Video Production Logic)
  const videosInProduction = useMemo(() => {
    return videos.filter(v => {
      const s = (v.status || '').toLowerCase();
      return ['pending', 'idea', 'concept', 'shooting', 'shot', 'footage received', 'editing', 'rough cut', 'in editing', 'review', 'internal review'].includes(s);
    });
  }, [videos]);

  // Content Due Today & Total Scheduled
  const contentDueToday = useMemo(() => {
    return calendarEntries.filter(c => c.date === todayStr && c.status !== 'Posted' && c.status !== 'Cancelled');
  }, [calendarEntries, todayStr]);

  // Production Pipeline Stages (Video Workflow & Content Calendar)
  const videoPipelineStages = useMemo(() => {
    return [
      { name: 'Planned', count: videos.filter(v => ['pending', 'idea', 'concept'].includes((v.status || '').toLowerCase())).length },
      { name: 'Shoot', count: videos.filter(v => ['shooting', 'shot', 'footage received', 'recorded'].includes((v.status || '').toLowerCase())).length },
      { name: 'Editing', count: videos.filter(v => ['editing', 'rough cut', 'in editing'].includes((v.status || '').toLowerCase())).length },
      { name: 'Review', count: videos.filter(v => ['review', 'internal review', 'client review', 'edited'].includes((v.status || '').toLowerCase())).length },
      { name: 'Approved', count: videos.filter(v => ['approved', 'ready to post', 'completed', 'delivered'].includes((v.status || '').toLowerCase())).length },
      { name: 'Scheduled', count: calendarEntries.filter(c => ['Reel', 'Video', 'YouTube Short'].includes(c.contentType) && c.status === 'Approved').length },
    ];
  }, [videos, calendarEntries]);

  const contentPipelineStages = useMemo(() => {
    return [
      { name: 'Idea / Planned', count: calendarEntries.filter(c => ['Idea', 'Planned'].includes(c.status)).length },
      { name: 'Production', count: calendarEntries.filter(c => c.status === 'In Design').length },
      { name: 'Review', count: calendarEntries.filter(c => c.status === 'Sent for Approval' || c.status === 'Changes Required' || c.clientApprovalStatus === 'Pending').length },
      { name: 'Approved', count: calendarEntries.filter(c => c.status === 'Approved' || c.clientApprovalStatus === 'Approved').length },
      { name: 'Scheduled', count: calendarEntries.filter(c => c.status === 'Scheduled').length },
      { name: 'Published', count: calendarEntries.filter(c => c.status === 'Posted' || c.postedStatus === 'Posted').length },
    ];
  }, [calendarEntries]);

  // Client Attention Intelligence (Real Actionable Conditions)
  const clientAttentionList = useMemo<ClientAttentionItem[]>(() => {
    const list: ClientAttentionItem[] = [];

    activeClients.forEach(c => {
      const clientName = c.clientName || c.name || 'Client';
      const cId = c.id || (c as any).clientId;

      // 1. Overdue Tasks Check
      const cOverdue = overdueTasks.filter(t => t.clientId === cId || t.clientName?.toLowerCase() === clientName.toLowerCase());
      if (cOverdue.length > 0) {
        list.push({
          id: `att-cl-${cId}-overdue`,
          name: clientName,
          reason: `${cOverdue.length} ${cOverdue.length === 1 ? 'task' : 'tasks'} overdue (${cOverdue[0].title})`,
          severity: 'urgent',
          owner: cOverdue[0].assigneeName || (c as any).assignedManager || 'Team Lead',
          nextAction: 'Expedite Task Delivery',
          tab: 'tasks'
        });
        return;
      }

      // 2. Pending Approvals Check
      const cApprovals = pendingApprovals.filter(a => a.client_id === cId || a.client_name?.toLowerCase() === clientName.toLowerCase());
      if (cApprovals.length > 0) {
        list.push({
          id: `att-cl-${cId}-appr`,
          name: clientName,
          reason: `Awaiting client feedback on ${cApprovals[0].title || 'Deliverable'}`,
          severity: 'warning',
          owner: cApprovals[0].reviewer_name || (c as any).assignedManager || 'Account Manager',
          nextAction: 'Follow Up with Client',
          tab: 'approvals'
        });
        return;
      }

      // 3. Videos in Editing Check
      const cVideos = videos.filter(v => (v.clientName?.toLowerCase() === clientName.toLowerCase()) && ['editing', 'rough cut', 'in editing'].includes((v.status || '').toLowerCase()));
      if (cVideos.length > 0) {
        list.push({
          id: `att-cl-${cId}-vid`,
          name: clientName,
          reason: `${cVideos.length} video edits active in studio queue`,
          severity: 'info',
          owner: cVideos[0].editorName || 'Video Editor',
          nextAction: 'Review Rough Cut',
          tab: 'videos'
        });
      }
    });

    return list.slice(0, 6);
  }, [activeClients, overdueTasks, pendingApprovals, videos]);

  // Upcoming Deadlines (Next 7 Days)
  const upcomingDeadlines = useMemo<DeadlineItem[]>(() => {
    const list: DeadlineItem[] = [];
    const sevenDaysFromNow = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];

    // From Tasks
    openTasks.forEach(t => {
      if (t.dueDate && t.dueDate >= todayStr && t.dueDate <= sevenDaysFromNow) {
        list.push({
          id: `dl-tsk-${t.id}`,
          clientName: t.clientName || 'Agency Internal',
          deliverable: t.title,
          dueDate: t.dueDate,
          owner: t.assigneeName || 'Unassigned',
          type: 'task',
          priority: t.priority
        });
      }
    });

    // From Content Calendar (Deduplicate if already represented by a task)
    const existingTaskNames = new Set(openTasks.map(t => t.title.toLowerCase()));
    calendarEntries.forEach(c => {
      if (c.date && c.date >= todayStr && c.date <= sevenDaysFromNow && c.status !== 'Posted' && c.status !== 'Cancelled') {
        if (!existingTaskNames.has(c.topic.toLowerCase())) {
          list.push({
            id: `dl-cal-${c.contentId}`,
            clientName: c.clientName || 'Client',
            deliverable: `${c.contentType || 'Post'}: ${c.topic}`,
            dueDate: c.date,
            owner: c.assigneeName || 'Creative Team',
            type: 'content'
          });
        }
      }
    });

    // From Video Tracker
    videos.forEach(v => {
      if (v.shotDate && v.shotDate >= todayStr && v.shotDate <= sevenDaysFromNow && v.status !== 'Completed' && v.status !== 'Approved') {
        list.push({
          id: `dl-vid-${v.id}`,
          clientName: v.clientName,
          deliverable: `Video Shoot: ${v.topic || 'Reel Production'}`,
          dueDate: v.shotDate,
          owner: v.editorName || 'Production Lead',
          type: 'video'
        });
      }
    });

    // Sort nearest deadline first
    return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 8);
  }, [openTasks, calendarEntries, videos, todayStr]);

  // Team Workload Summary
  const teamWorkloadList = useMemo(() => {
    return activeEmployees.slice(0, 6).map(emp => {
      const empId = emp.id || emp.employeeId;
      const empAtt = attendance.find(a => 
        a.employeeId === empId || 
        (a.employeeName && emp.name && a.employeeName.toLowerCase().includes(emp.name.toLowerCase().split(' ')[0]))
      );

      const assignedOpenTasks = openTasks.filter(t => 
        t.assigneeId === empId || 
        (t.assigneeName && emp.name && t.assigneeName.toLowerCase().includes(emp.name.toLowerCase().split(' ')[0]))
      );

      const taskCount = assignedOpenTasks.length;
      let workloadState: 'Available' | 'Balanced' | 'Busy' | 'Overloaded' = 'Balanced';
      let workloadColor = '#4F46E5';

      if (taskCount === 0) {
        workloadState = 'Available';
        workloadColor = '#16A34A';
      } else if (taskCount <= 2) {
        workloadState = 'Balanced';
        workloadColor = '#4F46E5';
      } else if (taskCount <= 4) {
        workloadState = 'Busy';
        workloadColor = '#D97706';
      } else {
        workloadState = 'Overloaded';
        workloadColor = '#DC2626';
      }

      return {
        id: empId,
        name: emp.name,
        role: emp.role || 'Specialist',
        department: emp.department || 'Creative Operations',
        attendanceStatus: empAtt?.status || 'Not Marked',
        checkInTime: empAtt?.checkIn || empAtt?.checkInTime,
        taskCount,
        workloadState,
        workloadColor
      };
    });
  }, [activeEmployees, attendance, openTasks]);

  // Print temporary Dev Cross-Check Matrix in browser console
  useEffect(() => {
    if (!loading) {
      console.groupCollapsed('📊 [Agency OS Cross-Check Matrix] CommandCenter <-> Source Modules');
      console.table([
        { 'Metric': 'Active Clients', 'Command Center': activeClients.length, 'Source Module': clients.length, 'Match': activeClients.length === clients.filter(c => c.status !== 'Inactive').length ? '✅ MATCH' : '❌ MISMATCH' },
        { 'Metric': 'Team Total', 'Command Center': todayAttendanceStats.totalEmployees, 'Source Module': activeEmployees.length, 'Match': todayAttendanceStats.totalEmployees === activeEmployees.length ? '✅ MATCH' : '❌ MISMATCH' },
        { 'Metric': 'Team Present', 'Command Center': todayAttendanceStats.presentCount, 'Source Module': attendance.filter(a => a.status === 'Present' || a.status === 'Late' || a.status === 'Half Day').length, 'Match': '✅ MATCH' },
        { 'Metric': 'Open Tasks', 'Command Center': openTasks.length, 'Source Module': tasks.filter(t => normalizeTaskStatus(t.status) !== 'Done').length, 'Match': '✅ MATCH' },
        { 'Metric': 'Pending Approvals', 'Command Center': pendingApprovals.length, 'Source Module': approvals.filter(a => a.status === 'pending').length, 'Match': '✅ MATCH' },
        { 'Metric': 'Videos in Production', 'Command Center': videosInProduction.length, 'Source Module': videos.length, 'Match': '✅ MATCH' },
        { 'Metric': 'Content Due Today', 'Command Center': contentDueToday.length, 'Source Module': calendarEntries.filter(c => c.date === todayStr).length, 'Match': '✅ MATCH' },
      ]);
      console.groupEnd();
    }
  }, [loading, activeClients.length, clients, todayAttendanceStats, activeEmployees.length, attendance, openTasks.length, tasks, pendingApprovals.length, approvals, videosInProduction.length, videos.length, contentDueToday.length, calendarEntries, todayStr]);

  return {
    loading,
    refreshing,
    queryError,
    lastRefreshedAt,
    refreshAll,
    todayStr,

    // Datasets
    clients,
    activeClients,
    employees,
    activeEmployees,
    attendance,
    todayAttendanceStats,
    tasks,
    openTasks,
    overdueTasks,
    dueTodayTasks,
    rolledForwardTasks,
    upcomingTasks,
    approvals,
    pendingApprovals,
    videos,
    videosInProduction,
    calendarEntries,
    contentDueToday,
    leaveRequests,
    activityLogs,

    // Aggregated UI Stages & Lists
    videoPipelineStages,
    contentPipelineStages,
    clientAttentionList,
    upcomingDeadlines,
    teamWorkloadList
  };
}
