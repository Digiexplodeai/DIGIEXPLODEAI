import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  TrendingUp, Users, CheckSquare, Clock, AlertTriangle, Calendar,
  UserCheck, Briefcase, Filter, Search, ChevronRight, X, ExternalLink,
  ChevronLeft, ArrowUpRight, Sparkles, RefreshCw, Layers, CheckCircle2,
  AlertCircle, FileText, Film, User, Tag, Download, PieChart, Activity
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import {
  subscribeToCanonicalEmployees,
  getCachedEmployees,
  type MasterEmployee,
  DEFAULT_EMPLOYEES_MASTER,
  normalizeDate,
  isTimestampInMonthRange,
  matchEmployeeToRecord,
  EMPLOYEE_ID_ALIASES
} from '../../lib/employeeMaster';
import {
  subscribeToCanonicalTasks,
  getCachedTasks,
  type Task
} from '../../lib/taskStorage';
import { DEFAULT_CLIENTS_MASTER } from '../../lib/clientMaster';
import { type WorkLog } from './WorkLogView';

// ─── Interfaces ────────────────────────────────────────────────────────
export interface AggregatedEmployeePerformance {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  department: string;
  email?: string;
  phone?: string;
  status: string;
  
  // Task Metrics
  tasksCompleted: number;
  openTasks: number;
  tasksDueInPeriod: number;
  onTimeCompleted: number;
  overdueCompleted: number;
  currentlyOverdue: number;
  onTimeRate: number; // percentage
  completionRate: number; // percentage
  completedTasksList: Task[];
  openTasksList: Task[];

  // Work Log Metrics
  workLogsCount: number;
  manualWorkLogsCount: number;
  taskGeneratedWorkLogsCount: number;
  workLogsList: WorkLog[];

  // Attendance Metrics
  presentDays: number;
  lateDays: number;
  leaveDays: number;
  absentDays: number;
  attendanceDaysCount: number;
  attendanceRecordsList: any[];

  // Client Relationships
  clientsWorkedOn: string[];

  // Workload State
  workloadState: 'Available' | 'Balanced' | 'Busy' | 'Heavy';
  workloadColor: string;
}

export const PerformanceView: React.FC = () => {
  const { user, profile } = useAuth();
  
  // Selected Month: defaults to current month (e.g. "2026-09")
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Source Collections State
  const [employees, setEmployees] = useState<MasterEmployee[]>(() => getCachedEmployees());
  const [tasks, setTasks] = useState<Task[]>(() => getCachedTasks());
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>(DEFAULT_CLIENTS_MASTER);
  
  // Query Status States
  const [loading, setLoading] = useState(true);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [activityPartialError, setActivityPartialError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState<AggregatedEmployeePerformance | null>(null);

  // Filters
  const [searchEmployee, setSearchEmployee] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterClient, setFilterClient] = useState('');

  // ─── 1. Real-time Subscriptions ──────────────────────────────────────
  useEffect(() => {
    // A. Employees Subscription (Independent)
    const unsubEmp = subscribeToCanonicalEmployees(
      (canonicalList) => {
        setEmployees(canonicalList.length > 0 ? canonicalList : DEFAULT_EMPLOYEES_MASTER);
        setEmployeeError(null);
        setLoading(false);
      },
      (err) => {
        console.warn('[PerformanceView] Employee query error notice:', err);
        setLoading(false);
      }
    );

    // B. Tasks Subscription
    const unsubTasks = subscribeToCanonicalTasks((taskList) => {
      setTasks(taskList);
    });

    // C. Work Logs Subscription (Firestore + LocalStorage fallback)
    const unsubWorkLogs = onSnapshot(collection(db, 'workLogs'), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkLog));
        setWorkLogs(list);
      } else {
        try {
          const raw = localStorage.getItem('digi_persisted_worklogs_v2');
          if (raw) setWorkLogs(JSON.parse(raw));
        } catch (e) {}
      }
    }, (err) => {
      console.warn('[PerformanceView] WorkLogs listener fallback to local:', err);
      try {
        const raw = localStorage.getItem('digi_persisted_worklogs_v2');
        if (raw) setWorkLogs(JSON.parse(raw));
      } catch (e) {}
    });

    // D. Attendance Subscription
    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAttendanceRecords(list);
      }
    }, (err) => {
      console.warn('[PerformanceView] Attendance listener fallback:', err);
    });

    // E. Clients Subscription
    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
      if (!snap.empty) {
        setClients(snap.docs.map(d => ({ id: d.id, clientId: d.id, ...d.data() })));
      }
    }, () => {});

    return () => {
      unsubEmp();
      unsubTasks();
      unsubWorkLogs();
      unsubAttendance();
      unsubClients();
    };
  }, []);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setSelectedMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    setSelectedMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  };

  // Month display label
  const monthDisplayLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Calculate Month Boundaries for debug & exact range checks
  const monthRange = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(year, month + 1, 1, 0, 0, 0, 0);
    return { start, end };
  }, [selectedMonth]);

  // ─── 2. Canonical Aggregation Engine ─────────────────────────────────
  const aggregatedPerformances = useMemo<AggregatedEmployeePerformance[]>(() => {
    // Active employees must always appear, regardless of activity count
    const activeEmployees = employees.filter(e => e.status !== 'Inactive' && e.status !== 'inactive');
    const targetPool = activeEmployees.length > 0 ? activeEmployees : DEFAULT_EMPLOYEES_MASTER;

    const allEmpsForMatching = targetPool.map(e => ({ id: e.id || e.employeeId, name: e.name || '' }));

    // Debug Tracking Arrays
    const unmatchedTaskEmployeeIds = new Set<string>();
    const unmatchedWorkLogEmployeeIds = new Set<string>();
    const unmatchedAttendanceEmployeeIds = new Set<string>();

    const taskEmployeeIds = new Set<string>();
    const workLogEmployeeIds = new Set<string>();
    const attendanceEmployeeIds = new Set<string>();

    tasks.forEach(t => {
      const rawId = t.assigneeId || '';
      if (rawId) taskEmployeeIds.add(rawId);
      const isMatchedAny = targetPool.some(e => matchEmployeeToRecord(e, t as any, allEmpsForMatching));
      if (!isMatchedAny && rawId) unmatchedTaskEmployeeIds.add(rawId);
    });

    workLogs.forEach(l => {
      const rawId = l.employeeId || l.employee_id || '';
      if (rawId) workLogEmployeeIds.add(rawId);
      const isMatchedAny = targetPool.some(e => matchEmployeeToRecord(e, l as any, allEmpsForMatching));
      if (!isMatchedAny && rawId) unmatchedWorkLogEmployeeIds.add(rawId);
    });

    attendanceRecords.forEach(a => {
      const rawId = a.employeeId || a.employee_id || '';
      if (rawId) attendanceEmployeeIds.add(rawId);
      const isMatchedAny = targetPool.some(e => matchEmployeeToRecord(e, a as any, allEmpsForMatching));
      if (!isMatchedAny && rawId) unmatchedAttendanceEmployeeIds.add(rawId);
    });

    // Mandatory Development Debug Output
    if (process.env.NODE_ENV !== 'production') {
      console.groupCollapsed(`[Digiexplode Team Performance Debug] ${selectedMonth}`);
      console.log('Current Authenticated UID:', user?.uid || profile?.userId || 'N/A');
      console.log('Resolved Super Admin Role:', profile?.role || 'admin');
      console.log('Employee Collection Path:', 'employees');
      console.log('Number of Employees Loaded:', targetPool.length);
      console.log('Selected Month Start Date:', monthRange.start.toISOString());
      console.log('Selected Month End Date:', monthRange.end.toISOString());
      console.log('Number of Tasks Loaded:', tasks.length);
      console.log('Number of Work Logs Loaded:', workLogs.length);
      console.log('Number of Attendance Records Loaded:', attendanceRecords.length);
      console.log('Employee IDs from Tasks Dataset:', Array.from(taskEmployeeIds));
      console.log('Employee IDs from Work Logs Dataset:', Array.from(workLogEmployeeIds));
      console.log('Employee IDs from Attendance Dataset:', Array.from(attendanceEmployeeIds));
      console.log('Unmatched Task Employee IDs:', Array.from(unmatchedTaskEmployeeIds));
      console.log('Unmatched Work Log Employee IDs:', Array.from(unmatchedWorkLogEmployeeIds));
      console.log('Unmatched Attendance Employee IDs:', Array.from(unmatchedAttendanceEmployeeIds));
      console.groupEnd();
    }

    return targetPool.map((emp) => {
      const empId = emp.id || emp.employeeId;

      // A. Tasks Processing
      const empTasks = tasks.filter(t => matchEmployeeToRecord(emp, t as any, allEmpsForMatching));
      
      const openTasksList = empTasks.filter(t => 
        t.status !== 'Done' && t.status !== 'Completed' && t.status !== 'Cancelled'
      );

      const tasksDueInPeriod = empTasks.filter(t => isTimestampInMonthRange(t.dueDate, selectedMonth)).length;

      const completedTasksList = empTasks.filter(t => {
        const isCompleted = t.status === 'Done' || t.status === 'Completed';
        if (!isCompleted) return false;
        // Verify completion date in selected month (fallback to updatedAt or dueDate)
        const compDate = t.completedAt || t.updatedAt || t.dueDate;
        return isTimestampInMonthRange(compDate, selectedMonth);
      });

      const currentlyOverdueTasks = openTasksList.filter(t => t.dueDate && t.dueDate < todayStr);

      let onTimeCount = 0;
      let overdueCompletedCount = 0;

      completedTasksList.forEach(t => {
        if (t.dueDate) {
          const compDateObj = normalizeDate(t.completedAt || t.updatedAt);
          const dueDateObj = normalizeDate(t.dueDate);
          if (compDateObj && dueDateObj) {
            if (compDateObj.getTime() <= dueDateObj.getTime() + 86399000) {
              onTimeCount++;
            } else {
              overdueCompletedCount++;
            }
          } else {
            onTimeCount++;
          }
        }
      });

      const totalDueTasks = onTimeCount + overdueCompletedCount;
      const onTimeRate = totalDueTasks > 0 ? Math.round((onTimeCount / totalDueTasks) * 100) : 100;
      
      const totalWorkloadDenominator = completedTasksList.length + openTasksList.length;
      const completionRate = totalWorkloadDenominator > 0 
        ? Math.round((completedTasksList.length / totalWorkloadDenominator) * 100) 
        : 0;

      // B. Work Logs Processing
      const empLogsList = workLogs.filter(l => {
        const isEmpMatch = matchEmployeeToRecord(emp, l as any, allEmpsForMatching);
        if (!isEmpMatch) return false;
        const logDate = l.work_date || l.date || l.completed_at || l.completedAt || l.createdAt;
        return isTimestampInMonthRange(logDate, selectedMonth);
      });

      const manualWorkLogsCount = empLogsList.filter(l => l.source === 'manual' || !l.auto_generated && !l.autoGenerated && !l.taskId && !l.task_id).length;
      const taskGeneratedWorkLogsCount = empLogsList.length - manualWorkLogsCount;

      // C. Attendance Processing
      const empAttendance = attendanceRecords.filter(a => {
        const isEmpMatch = matchEmployeeToRecord(emp, a as any, allEmpsForMatching);
        if (!isEmpMatch) return false;
        const attDate = a.date || a.attendance_date;
        return isTimestampInMonthRange(attDate, selectedMonth);
      });

      const presentDays = empAttendance.filter(a => a.status === 'Present' || a.status === 'Half Day').length;
      const lateDays    = empAttendance.filter(a => a.status === 'Late').length;
      const leaveDays   = empAttendance.filter(a => a.status === 'Leave').length;
      const absentDays  = empAttendance.filter(a => a.status === 'Absent').length;

      // D. Clients Worked On (Distinct)
      const clientSet = new Set<string>();
      completedTasksList.forEach(t => { if (t.clientName) clientSet.add(t.clientName); });
      openTasksList.forEach(t => { if (t.clientName) clientSet.add(t.clientName); });
      empLogsList.forEach(l => { if (l.clientName || l.client_name) clientSet.add(l.clientName || l.client_name || ''); });
      const clientsWorkedOn = Array.from(clientSet).filter(Boolean);

      // E. Workload State (Descriptive indicator, strictly factual)
      let workloadState: 'Available' | 'Balanced' | 'Busy' | 'Heavy' = 'Balanced';
      let workloadColor = '#2563EB'; // Blue

      if (openTasksList.length === 0) {
        workloadState = 'Available';
        workloadColor = '#16A34A'; // Emerald
      } else if (openTasksList.length <= 2) {
        workloadState = 'Balanced';
        workloadColor = '#2563EB'; // Blue
      } else if (openTasksList.length <= 4) {
        workloadState = 'Busy';
        workloadColor = '#F59E0B'; // Amber
      } else {
        workloadState = 'Heavy';
        workloadColor = '#DC2626'; // Rose
      }

      return {
        id: empId,
        employeeId: empId,
        name: emp.name || 'Team Member',
        role: emp.role || emp.designation || 'Specialist',
        department: emp.department || 'Operations',
        email: emp.email,
        phone: emp.phone,
        status: emp.status || 'Active',
        tasksCompleted: completedTasksList.length,
        openTasks: openTasksList.length,
        tasksDueInPeriod,
        onTimeCompleted: onTimeCount,
        overdueCompleted: overdueCompletedCount,
        currentlyOverdue: currentlyOverdueTasks.length,
        onTimeRate,
        completionRate,
        completedTasksList,
        openTasksList,
        workLogsCount: empLogsList.length,
        manualWorkLogsCount,
        taskGeneratedWorkLogsCount,
        workLogsList: empLogsList,
        presentDays,
        lateDays,
        leaveDays,
        absentDays,
        attendanceDaysCount: empAttendance.length,
        attendanceRecordsList: empAttendance,
        clientsWorkedOn,
        workloadState,
        workloadColor,
      };
    });
  }, [employees, tasks, workLogs, attendanceRecords, selectedMonth, monthRange, todayStr, user, profile]);

  // ─── 3. Filtered Performance List ────────────────────────────────────
  const filteredPerformances = useMemo(() => {
    return aggregatedPerformances.filter(p => {
      if (searchEmployee && !p.name.toLowerCase().includes(searchEmployee.toLowerCase()) && !p.role.toLowerCase().includes(searchEmployee.toLowerCase())) {
        return false;
      }
      if (filterDepartment && p.department !== filterDepartment) {
        return false;
      }
      if (filterClient && !p.clientsWorkedOn.includes(filterClient)) {
        return false;
      }
      return true;
    });
  }, [aggregatedPerformances, searchEmployee, filterDepartment, filterClient]);

  // Distinct departments for filter dropdown
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => { if (e.department) set.add(e.department); });
    return Array.from(set);
  }, [employees]);

  // ─── 4. Top Summary KPIs (Single Source of Truth) ─────────────────────
  const summaryMetrics = useMemo(() => {
    const totalActiveEmp = filteredPerformances.length;
    const totalCompletedTasks = filteredPerformances.reduce((acc, p) => acc + p.tasksCompleted, 0);
    const totalOpenTasks = filteredPerformances.reduce((acc, p) => acc + p.openTasks, 0);
    const totalOverdueTasks = filteredPerformances.reduce((acc, p) => acc + p.currentlyOverdue, 0);
    const totalWorkLogs = filteredPerformances.reduce((acc, p) => acc + p.workLogsCount, 0);
    
    const totalPresentDays = filteredPerformances.reduce((acc, p) => acc + p.presentDays + p.lateDays, 0);
    const totalAttRecords = filteredPerformances.reduce((acc, p) => acc + p.attendanceDaysCount, 0);
    const avgAttendanceRate = totalAttRecords > 0 
      ? Math.round((totalPresentDays / totalAttRecords) * 100) 
      : 100;

    return {
      totalActiveEmp,
      totalCompletedTasks,
      totalOpenTasks,
      totalOverdueTasks,
      totalWorkLogs,
      avgAttendanceRate
    };
  }, [filteredPerformances]);

  // Manual Refresh Handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const cachedEmp = getCachedEmployees();
      const cachedTasks = getCachedTasks();
      setEmployees(cachedEmp);
      setTasks(cachedTasks);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-[#101828] dark:text-[#F7F8FC]">
      {/* ─── 1. HEADER & MONTH FILTER BAR ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-[#5B4BFF] mb-1 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" /> Operations Analytics
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#101828] dark:text-[#F7F8FC]">Team Performance</h1>
          <p className="text-xs text-[#475467] dark:text-[#BAC1D1] mt-0.5">
            Factual operational metrics aggregated from Tasks, Work Logs, and Attendance
          </p>
        </div>

        {/* Month Selector & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-white dark:bg-[#111728] border border-[#D8DEE9] dark:border-[#293248] rounded-xl p-1 shadow-2xs">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-[#475467] dark:text-[#BAC1D1] hover:bg-[#F7F8FC] dark:hover:bg-white/5 transition-all cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-black text-[#101828] dark:text-white min-w-[130px] text-center">
              {monthDisplayLabel}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-[#475467] dark:text-[#BAC1D1] hover:bg-[#F7F8FC] dark:hover:bg-white/5 transition-all cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <input
            type="month"
            value={selectedMonth}
            onChange={e => e.target.value && setSelectedMonth(e.target.value)}
            className="bg-white dark:bg-[#111728] border border-[#D8DEE9] dark:border-[#293248] rounded-xl px-3 py-2 text-xs font-bold text-[#101828] dark:text-white outline-none cursor-pointer shadow-2xs"
          />

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-[#475467] dark:text-[#BAC1D1] border border-[#D8DEE9] dark:border-[#293248] bg-white dark:bg-[#111728] hover:bg-[#F7F8FC] dark:hover:bg-white/5 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#5B4BFF]' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ─── 2. TOP SUMMARY KPI STRIP (6 Operational Cards) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryKpiCard
          label="Active Team"
          value={summaryMetrics.totalActiveEmp}
          subValue="Configured staff"
          icon={Users}
          accent="#5B4BFF"
        />
        <SummaryKpiCard
          label="Tasks Completed"
          value={summaryMetrics.totalCompletedTasks}
          subValue={`In ${monthDisplayLabel}`}
          icon={CheckCircle2}
          accent="#16A34A"
        />
        <SummaryKpiCard
          label="Open Tasks"
          value={summaryMetrics.totalOpenTasks}
          subValue="Active assignments"
          icon={CheckSquare}
          accent="#2563EB"
        />
        <SummaryKpiCard
          label="Overdue Tasks"
          value={summaryMetrics.totalOverdueTasks}
          subValue="Needs immediate action"
          icon={AlertTriangle}
          accent={summaryMetrics.totalOverdueTasks > 0 ? '#DC2626' : '#64748B'}
        />
        <SummaryKpiCard
          label="Work Logs"
          value={summaryMetrics.totalWorkLogs}
          subValue="Logged deliveries"
          icon={FileText}
          accent="#7C3AED"
        />
        <SummaryKpiCard
          label="Attendance Rate"
          value={`${summaryMetrics.avgAttendanceRate}%`}
          subValue="Team presence"
          icon={UserCheck}
          accent="#06B6D4"
        />
      </div>

      {/* ─── 3. SEARCH & FILTERS BAR ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-[#111728] border border-[#D8DEE9] dark:border-[#293248] p-3 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-[#475467] dark:text-[#BAC1D1] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchEmployee}
              onChange={e => setSearchEmployee(e.target.value)}
              placeholder="Search team member or role..."
              className="w-full pl-9 pr-3 py-1.5 text-xs font-medium bg-[#F7F8FC] dark:bg-[#171E31] border border-[#D8DEE9] dark:border-[#293248] rounded-xl text-[#101828] dark:text-white placeholder-[#98A2B3] dark:placeholder-[#64748B] outline-none focus:border-[#5B4BFF]"
            />
          </div>

          {/* Department Filter */}
          <select
            value={filterDepartment}
            onChange={e => setFilterDepartment(e.target.value)}
            className="bg-[#F7F8FC] dark:bg-[#171E31] border border-[#D8DEE9] dark:border-[#293248] rounded-xl px-3 py-1.5 text-xs font-bold text-[#101828] dark:text-white outline-none cursor-pointer"
          >
            <option value="">All Departments</option>
            {departmentsList.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          {/* Client Filter */}
          <select
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
            className="bg-[#F7F8FC] dark:bg-[#171E31] border border-[#D8DEE9] dark:border-[#293248] rounded-xl px-3 py-1.5 text-xs font-bold text-[#101828] dark:text-white outline-none cursor-pointer"
          >
            <option value="">All Clients</option>
            {clients.map(c => (
              <option key={c.clientId || c.id} value={c.clientName || c.name}>
                {c.clientName || c.name || c.businessName}
              </option>
            ))}
          </select>
        </div>

        {(searchEmployee || filterDepartment || filterClient) && (
          <button
            onClick={() => { setSearchEmployee(''); setFilterDepartment(''); setFilterClient(''); }}
            className="text-xs font-bold text-[#5B4BFF] hover:underline self-end md:self-auto cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* ─── 4. MAIN PERFORMANCE TABLE / CARDS ─── */}
      {loading ? (
        <div className="bg-white dark:bg-[#111728] border border-[#D8DEE9] dark:border-[#293248] rounded-2xl p-6 space-y-3 shadow-2xs">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-14 bg-black/5 dark:bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredPerformances.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center bg-white dark:bg-[#111728] border border-[#D8DEE9] dark:border-[#293248] rounded-2xl p-8">
          <Users className="w-12 h-12 text-[#98A2B3] dark:text-[#64748B]" />
          <div>
            <h3 className="text-base font-black text-[#101828] dark:text-white">No active employees configured</h3>
            <p className="text-xs text-[#475467] dark:text-[#BAC1D1] mt-1">
              Add team members in the Employees module to view operational analytics.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#111728] border border-[#D8DEE9] dark:border-[#293248] rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="border-b border-[#D8DEE9] dark:border-[#293248] bg-[#F7F8FC] dark:bg-[#171E31] text-[10px] font-black uppercase text-[#475467] dark:text-[#BAC1D1] tracking-wider">
                  <th className="py-3.5 px-4">Team Member</th>
                  <th className="py-3.5 px-3">Workload</th>
                  <th className="py-3.5 px-3 text-center">Completed</th>
                  <th className="py-3.5 px-3 text-center">Open</th>
                  <th className="py-3.5 px-3 text-center">On-Time</th>
                  <th className="py-3.5 px-3 text-center">Overdue</th>
                  <th className="py-3.5 px-3 text-center">Work Logs</th>
                  <th className="py-3.5 px-3 text-center">Attendance</th>
                  <th className="py-3.5 px-3">Clients</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8DEE9] dark:divide-[#293248] text-xs">
                {filteredPerformances.map((perf) => {
                  return (
                    <tr
                      key={perf.id}
                      onClick={() => setSelectedEmployeeDetail(perf)}
                      className="hover:bg-[#F7F8FC] dark:hover:bg-white/3 transition-colors cursor-pointer"
                    >
                      {/* Employee Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#5B4BFF]/10 text-[#5B4BFF] border border-[#5B4BFF]/20 flex items-center justify-center font-black text-xs flex-shrink-0">
                            {perf.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-[#101828] dark:text-white truncate">{perf.name}</p>
                            <p className="text-[11px] text-[#475467] dark:text-[#BAC1D1] truncate">{perf.role} · {perf.department}</p>
                          </div>
                        </div>
                      </td>

                      {/* Workload Status */}
                      <td className="py-3.5 px-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border"
                          style={{
                            color: perf.workloadColor,
                            borderColor: `${perf.workloadColor}40`,
                            backgroundColor: `${perf.workloadColor}15`
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: perf.workloadColor }} />
                          {perf.workloadState}
                        </span>
                      </td>

                      {/* Tasks Completed */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          {perf.tasksCompleted}
                        </span>
                      </td>

                      {/* Open Tasks */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-bold text-[#101828] dark:text-white">
                          {perf.openTasks}
                        </span>
                      </td>

                      {/* On-Time Completed */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-bold text-[#475467] dark:text-[#BAC1D1]">
                          {perf.onTimeCompleted}
                        </span>
                      </td>

                      {/* Overdue Tasks */}
                      <td className="py-3.5 px-3 text-center">
                        {perf.currentlyOverdue > 0 ? (
                          <span className="font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-md">
                            {perf.currentlyOverdue}
                          </span>
                        ) : (
                          <span className="text-[#98A2B3] dark:text-[#64748B]">0</span>
                        )}
                      </td>

                      {/* Work Logs Logged */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-bold text-[#5B4BFF] bg-[#5B4BFF]/10 px-2 py-0.5 rounded-md">
                          {perf.workLogsCount}
                        </span>
                      </td>

                      {/* Attendance Present Days */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-bold text-[#101828] dark:text-white">
                          {perf.presentDays + perf.lateDays}d
                        </span>
                      </td>

                      {/* Clients Worked On */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1 flex-wrap max-w-[180px]">
                          {perf.clientsWorkedOn.length === 0 ? (
                            <span className="text-[11px] text-[#98A2B3] dark:text-[#64748B]">None</span>
                          ) : (
                            perf.clientsWorkedOn.slice(0, 2).map((cName, i) => (
                              <span key={i} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 truncate max-w-[120px]">
                                {cName}
                              </span>
                            ))
                          )}
                          {perf.clientsWorkedOn.length > 2 && (
                            <span className="text-[9px] font-black text-[#5B4BFF]">
                              +{perf.clientsWorkedOn.length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Details Button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmployeeDetail(perf);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-[#5B4BFF] border border-[#5B4BFF]/30 hover:bg-[#5B4BFF]/10 transition-all cursor-pointer"
                        >
                          View Details
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

      {/* ─── 5. EMPLOYEE DETAIL DRAWER ─── */}
      {selectedEmployeeDetail && (
        <EmployeeDetailDrawer
          employee={selectedEmployeeDetail}
          selectedMonthLabel={monthDisplayLabel}
          onClose={() => setSelectedEmployeeDetail(null)}
        />
      )}
    </div>
  );
};

// ─── COMPONENT: SUMMARY KPI CARD ───────────────────────────────────────
const SummaryKpiCard: React.FC<{
  label: string;
  value: number | string;
  subValue: string;
  icon: React.ElementType;
  accent: string;
}> = ({ label, value, subValue, icon: Icon, accent }) => (
  <div className="bg-white dark:bg-[#111728] border border-[#D8DEE9] dark:border-[#293248] rounded-2xl p-4 flex flex-col justify-between shadow-2xs hover:border-[#5B4BFF]/40 transition-all">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] font-black uppercase text-[#475467] dark:text-[#BAC1D1] tracking-wider truncate">
        {label}
      </span>
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${accent}15`, color: accent }}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
    </div>
    <div>
      <p className="text-xl sm:text-2xl font-black text-[#101828] dark:text-[#F7F8FC] leading-none">
        {value}
      </p>
      <p className="text-[10px] text-[#475467] dark:text-[#BAC1D1] mt-1 truncate">
        {subValue}
      </p>
    </div>
  </div>
);

// ─── COMPONENT: EMPLOYEE DETAIL DRAWER ──────────────────────────────────
interface EmployeeDetailDrawerProps {
  employee: AggregatedEmployeePerformance;
  selectedMonthLabel: string;
  onClose: () => void;
}

const EmployeeDetailDrawer: React.FC<EmployeeDetailDrawerProps> = ({
  employee,
  selectedMonthLabel,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'worklogs' | 'attendance'>('overview');

  return (
    <div className="fixed inset-0 z-70 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40 backdrop-blur-2xs" />
      <div
        className="w-full max-w-xl bg-white dark:bg-[#111728] border-l border-[#D8DEE9] dark:border-[#293248] h-full flex flex-col shadow-2xl text-[#101828] dark:text-[#F7F8FC]"
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-[#D8DEE9] dark:border-[#293248] flex items-center justify-between sticky top-0 bg-white dark:bg-[#111728] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5B4BFF]/10 text-[#5B4BFF] border border-[#5B4BFF]/20 flex items-center justify-center font-black text-sm flex-shrink-0">
              {employee.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-sm font-black">{employee.name}</h2>
              <p className="text-[11px] text-[#475467] dark:text-[#BAC1D1]">{employee.role} · {employee.department}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#475467] hover:text-[#101828] dark:text-[#BAC1D1] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-[#D8DEE9] dark:border-[#293248] flex items-center gap-4 bg-[#F7F8FC] dark:bg-[#171E31]">
          {[
            { key: 'overview',   label: 'Overview' },
            { key: 'tasks',      label: `Tasks (${employee.completedTasksList.length + employee.openTasksList.length})` },
            { key: 'worklogs',   label: `Work Logs (${employee.workLogsCount})` },
            { key: 'attendance', label: `Attendance (${employee.presentDays + employee.lateDays}d)` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`pb-3 text-xs font-black transition-all border-b-2 cursor-pointer ${
                activeTab === t.key
                  ? 'border-[#5B4BFF] text-[#5B4BFF]'
                  : 'border-transparent text-[#475467] dark:text-[#BAC1D1] hover:text-[#101828] dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Context Strip */}
              <div className="flex items-center justify-between text-xs bg-[#F7F8FC] dark:bg-[#171E31] p-3 rounded-xl border border-[#D8DEE9] dark:border-[#293248]">
                <span className="text-[#475467] dark:text-[#BAC1D1]">Operational Period:</span>
                <span className="font-black text-[#101828] dark:text-white">{selectedMonthLabel}</span>
              </div>

              {/* Factual KPI Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#F7F8FC] dark:bg-[#171E31] border border-[#D8DEE9] dark:border-[#293248] rounded-xl p-3.5">
                  <p className="text-[10px] font-black uppercase text-[#475467] dark:text-[#BAC1D1]">Completed Tasks</p>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{employee.tasksCompleted}</p>
                  <p className="text-[10px] text-[#475467] dark:text-[#BAC1D1] mt-0.5">{employee.onTimeCompleted} on-time</p>
                </div>

                <div className="bg-[#F7F8FC] dark:bg-[#171E31] border border-[#D8DEE9] dark:border-[#293248] rounded-xl p-3.5">
                  <p className="text-[10px] font-black uppercase text-[#475467] dark:text-[#BAC1D1]">Active Workload</p>
                  <p className="text-xl font-black text-[#2563EB] dark:text-[#3B82F6] mt-1">{employee.openTasks} Open</p>
                  <p className="text-[10px] text-[#475467] dark:text-[#BAC1D1] mt-0.5">{employee.currentlyOverdue} overdue</p>
                </div>

                <div className="bg-[#F7F8FC] dark:bg-[#171E31] border border-[#D8DEE9] dark:border-[#293248] rounded-xl p-3.5">
                  <p className="text-[10px] font-black uppercase text-[#475467] dark:text-[#BAC1D1]">Logged Work Entries</p>
                  <p className="text-xl font-black text-[#5B4BFF] mt-1">{employee.workLogsCount}</p>
                  <p className="text-[10px] text-[#475467] dark:text-[#BAC1D1] mt-0.5">Verified deliveries</p>
                </div>

                <div className="bg-[#F7F8FC] dark:bg-[#171E31] border border-[#D8DEE9] dark:border-[#293248] rounded-xl p-3.5">
                  <p className="text-[10px] font-black uppercase text-[#475467] dark:text-[#BAC1D1]">Present in Month</p>
                  <p className="text-xl font-black text-[#06B6D4] mt-1">{employee.presentDays + employee.lateDays}d</p>
                  <p className="text-[10px] text-[#475467] dark:text-[#BAC1D1] mt-0.5">{employee.leaveDays}d approved leave</p>
                </div>
              </div>

              {/* Clients Assigned */}
              <div>
                <p className="text-[10px] font-black uppercase text-[#475467] dark:text-[#BAC1D1] tracking-wider mb-2">
                  Client Brands Handled ({employee.clientsWorkedOn.length})
                </p>
                {employee.clientsWorkedOn.length === 0 ? (
                  <p className="text-xs text-[#475467] dark:text-[#BAC1D1] italic">No direct client assignments recorded in this period.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {employee.clientsWorkedOn.map((cName, i) => (
                      <span key={i} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#F7F8FC] dark:bg-[#171E31] border border-[#D8DEE9] dark:border-[#293248]">
                        {cName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider mb-2">
                  Completed in {selectedMonthLabel} ({employee.completedTasksList.length})
                </p>
                {employee.completedTasksList.length === 0 ? (
                  <p className="text-xs text-[#475467] dark:text-[#BAC1D1] italic bg-[#F7F8FC] dark:bg-[#171E31] p-3 rounded-xl border border-[#D8DEE9] dark:border-[#293248]">
                    No completed tasks in this period.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {employee.completedTasksList.map(task => (
                      <div key={task.id} className="bg-[#F7F8FC] dark:bg-[#171E31] p-3 rounded-xl border border-[#D8DEE9] dark:border-[#293248] text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#101828] dark:text-white truncate">{task.title}</span>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                            Done
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[#475467] dark:text-[#BAC1D1]">
                          <span>{task.clientName || 'General'} · {task.category || 'Task'}</span>
                          <span>Due: {task.dueDate || '—'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-[10px] font-black uppercase text-[#2563EB] dark:text-[#3B82F6] tracking-wider mb-2">
                  Currently Open Tasks ({employee.openTasksList.length})
                </p>
                {employee.openTasksList.length === 0 ? (
                  <p className="text-xs text-[#475467] dark:text-[#BAC1D1] italic bg-[#F7F8FC] dark:bg-[#171E31] p-3 rounded-xl border border-[#D8DEE9] dark:border-[#293248]">
                    No open tasks currently assigned.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {employee.openTasksList.map(task => (
                      <div key={task.id} className="bg-[#F7F8FC] dark:bg-[#171E31] p-3 rounded-xl border border-[#D8DEE9] dark:border-[#293248] text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#101828] dark:text-white truncate">{task.title}</span>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                            {task.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[#475467] dark:text-[#BAC1D1]">
                          <span>{task.clientName || 'General'} · {task.priority}</span>
                          <span className={task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10) ? 'text-rose-500 font-bold' : ''}>
                            Due: {task.dueDate || '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'worklogs' && (
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase text-[#475467] dark:text-[#BAC1D1] tracking-wider">
                Work Done Entries in {selectedMonthLabel} ({employee.workLogsList.length})
              </p>
              {employee.workLogsList.length === 0 ? (
                <p className="text-xs text-[#475467] dark:text-[#BAC1D1] italic bg-[#F7F8FC] dark:bg-[#171E31] p-3 rounded-xl border border-[#D8DEE9] dark:border-[#293248]">
                  No work logs recorded in this period.
                </p>
              ) : (
                <div className="space-y-2">
                  {employee.workLogsList.map((log, idx) => (
                    <div key={log.id || idx} className="bg-[#F7F8FC] dark:bg-[#171E31] p-3 rounded-xl border border-[#D8DEE9] dark:border-[#293248] text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#101828] dark:text-white">{log.workDone || log.work_description}</span>
                        <span className="text-[10px] text-[#475467] dark:text-[#BAC1D1]">{log.work_date || log.date}</span>
                      </div>
                      <p className="text-[10px] text-[#475467] dark:text-[#BAC1D1]">
                        Client: {log.clientName || log.client_name || 'General'} · Category: {log.category || log.task_type || 'Delivery'}
                      </p>
                      {log.workDetails && (
                        <p className="text-[11px] text-[#475467] dark:text-[#BAC1D1] italic mt-1">"{log.workDetails}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                  <p className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">Present</p>
                  <p className="text-base font-black text-emerald-700 dark:text-emerald-300">{employee.presentDays}d</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-500/10 p-2.5 rounded-xl border border-amber-200 dark:border-amber-500/20">
                  <p className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-400">Late</p>
                  <p className="text-base font-black text-amber-700 dark:text-amber-300">{employee.lateDays}d</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-500/10 p-2.5 rounded-xl border border-blue-200 dark:border-blue-500/20">
                  <p className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400">Leave</p>
                  <p className="text-base font-black text-blue-700 dark:text-blue-300">{employee.leaveDays}d</p>
                </div>
                <div className="bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-xl border border-rose-200 dark:border-rose-500/20">
                  <p className="text-[9px] font-black uppercase text-rose-600 dark:text-rose-400">Absent</p>
                  <p className="text-base font-black text-rose-700 dark:text-rose-300">{employee.absentDays}d</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase text-[#475467] dark:text-[#BAC1D1] tracking-wider mb-2">
                  Recorded Dates ({employee.attendanceRecordsList.length})
                </p>
                {employee.attendanceRecordsList.length === 0 ? (
                  <p className="text-xs text-[#475467] dark:text-[#BAC1D1] italic bg-[#F7F8FC] dark:bg-[#171E31] p-3 rounded-xl border border-[#D8DEE9] dark:border-[#293248]">
                    No attendance logs recorded in this period.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {employee.attendanceRecordsList.map((att, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[#F7F8FC] dark:bg-[#171E31] border border-[#D8DEE9] dark:border-[#293248] text-xs">
                        <span className="font-bold">{att.date || att.attendance_date}</span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-black/5 dark:bg-white/5">
                          {att.status} {att.checkIn ? `(${att.checkIn})` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceView;
