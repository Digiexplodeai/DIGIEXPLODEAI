import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Users, Briefcase, CheckSquare, Clock, AlertTriangle, UserCheck,
  Film, TrendingUp, Plus, RefreshCw, ChevronRight, ChevronDown,
  Activity, Calendar, Shield, Sparkles, CheckCircle2, AlertCircle,
  FileText, CreditCard, ArrowUpRight, Check, Eye, Filter,
  Layers, Video, ArrowRight, ExternalLink, CalendarDays, Zap, Loader2
} from 'lucide-react';
import { useAgencyCommandCenterData } from '../../hooks/useAgencyCommandCenterData';

// ─── Interfaces ────────────────────────────────────────────────────────
interface KPIItem {
  id: string;
  label: string;
  value: number | string;
  subValue?: string;
  icon: React.ElementType;
  accent: string;
  tab: string;
}

interface AttentionAlert {
  id: string;
  type: 'danger' | 'warning' | 'info' | 'purple';
  count: number;
  label: string;
  icon: React.ElementType;
  tab: string;
}

interface CommandCenterProps {
  setActiveTab: (tab: string) => void;
}

// Helpers for badges
const getPriorityBadge = (priority?: string) => {
  switch ((priority || '').toLowerCase()) {
    case 'urgent': return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'high': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const getStatusBadge = (status?: string) => {
  switch ((status || '').toLowerCase()) {
    case 'done':
    case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'in review':
    case 'sent for approval': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'in progress': return 'bg-blue-50 text-blue-700 border-blue-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const formatRelativeTime = (isoString?: string) => {
  if (!isoString) return 'Just now';
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(isoString).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
};

export const CommandCenter: React.FC<CommandCenterProps> = ({ setActiveTab }) => {
  const { profile } = useAuth();
  
  // Use the shared canonical aggregation layer
  const {
    loading,
    refreshing,
    refreshAll,
    todayStr,
    activeClients,
    clients,
    activeEmployees,
    todayAttendanceStats,
    tasks,
    openTasks,
    overdueTasks,
    dueTodayTasks,
    upcomingTasks,
    approvals,
    pendingApprovals,
    videos,
    videosInProduction,
    calendarEntries,
    contentDueToday,
    leaveRequests,
    activityLogs,
    videoPipelineStages,
    contentPipelineStages,
    clientAttentionList,
    upcomingDeadlines,
    teamWorkloadList
  } = useAgencyCommandCenterData();

  const [activeTaskTab, setActiveTaskTab] = useState<'today' | 'overdue' | 'upcoming'>('today');
  const [pipelineMode, setPipelineMode] = useState<'video' | 'content'>('video');
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);

  const createMenuRef = useRef<HTMLDivElement>(null);
  const moreActionsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setCreateMenuOpen(false);
      }
      if (moreActionsRef.current && !moreActionsRef.current.contains(e.target as Node)) {
        setMoreActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const headerDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  // ─── 1. ATTENTION ALERTS STRIP ───────────────────────────────────────
  const attentionAlerts = useMemo<AttentionAlert[]>(() => {
    const list: AttentionAlert[] = [];

    if (overdueTasks.length > 0) {
      list.push({
        id: 'att-overdue-tasks',
        type: 'danger',
        count: overdueTasks.length,
        label: `${overdueTasks.length} ${overdueTasks.length === 1 ? 'task' : 'tasks'} overdue`,
        icon: AlertTriangle,
        tab: 'tasks'
      });
    }

    if (pendingApprovals.length > 0) {
      list.push({
        id: 'att-pending-approvals',
        type: 'warning',
        count: pendingApprovals.length,
        label: `${pendingApprovals.length} ${pendingApprovals.length === 1 ? 'approval' : 'approvals'} waiting`,
        icon: Clock,
        tab: 'approvals'
      });
    }

    if (videosInProduction.length > 0) {
      list.push({
        id: 'att-videos-prod',
        type: 'purple',
        count: videosInProduction.length,
        label: `${videosInProduction.length} ${videosInProduction.length === 1 ? 'video' : 'videos'} in production`,
        icon: Film,
        tab: 'videos'
      });
    }

    if (contentDueToday.length > 0) {
      list.push({
        id: 'att-content-due',
        type: 'info',
        count: contentDueToday.length,
        label: `${contentDueToday.length} content due today`,
        icon: Calendar,
        tab: 'calendar'
      });
    }

    if (leaveRequests.length > 0) {
      list.push({
        id: 'att-leaves',
        type: 'warning',
        count: leaveRequests.length,
        label: `${leaveRequests.length} leave request pending`,
        icon: UserCheck,
        tab: 'attendance'
      });
    }

    return list;
  }, [overdueTasks.length, pendingApprovals.length, videosInProduction.length, contentDueToday.length, leaveRequests.length]);

  // ─── 2. 6 COMPACT EXECUTIVE KPIS ─────────────────────────────────────
  const kpis: KPIItem[] = useMemo(() => [
    {
      id: 'kpi-clients',
      label: 'Active Clients',
      value: activeClients.length,
      subValue: `${clients.length} total registered`,
      icon: Briefcase,
      accent: '#4F46E5', // Electric Indigo
      tab: 'clients'
    },
    {
      id: 'kpi-team',
      label: 'Team Present',
      value: `${todayAttendanceStats.presentCount}/${todayAttendanceStats.totalEmployees}`,
      subValue: todayAttendanceStats.notMarkedCount > 0 
        ? `${todayAttendanceStats.notMarkedCount} not marked` 
        : `${todayAttendanceStats.absentCount} absent/away`,
      icon: UserCheck,
      accent: '#16A34A', // Success Green
      tab: 'attendance'
    },
    {
      id: 'kpi-tasks',
      label: 'Open Tasks',
      value: openTasks.length,
      subValue: `${overdueTasks.length} overdue`,
      icon: CheckSquare,
      accent: '#2563EB', // Bright Blue
      tab: 'tasks'
    },
    {
      id: 'kpi-approvals',
      label: 'Pending Approvals',
      value: pendingApprovals.length,
      subValue: pendingApprovals.length > 0 ? 'Requires feedback' : 'All clear',
      icon: Clock,
      accent: '#F59E0B', // Warning Amber
      tab: 'approvals'
    },
    {
      id: 'kpi-videos',
      label: 'Videos in Production',
      value: videosInProduction.length,
      subValue: `${videos.filter(v => (v.status || '').toLowerCase().includes('edit')).length} in editing`,
      icon: Film,
      accent: '#7C3AED', // Vivid Violet
      tab: 'videos'
    },
    {
      id: 'kpi-content',
      label: 'Content Due',
      value: contentDueToday.length,
      subValue: `${calendarEntries.length} total scheduled`,
      icon: Calendar,
      accent: '#06B6D4', // Cyan Tech Accent
      tab: 'calendar'
    },
  ], [
    activeClients.length,
    clients.length,
    todayAttendanceStats,
    openTasks.length,
    overdueTasks.length,
    pendingApprovals.length,
    videosInProduction.length,
    videos,
    contentDueToday.length,
    calendarEntries.length
  ]);

  return (
    <div className="space-y-4 pb-8" style={{ fontFamily: 'Inter, Manrope, sans-serif' }}>

      {/* ─── 1. HEADER AREA ──────────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#D8DEE9] rounded-2xl p-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#4F46E5] bg-[#EEF2FF] px-2.5 py-0.5 rounded-md border border-[#C7D2FE]">
              Real-time Agency OS
            </span>
            <span className="text-xs text-[#7A8496]">·</span>
            <span className="text-xs font-semibold text-[#475467]">{headerDateFormatted}</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-[#101828] tracking-tight">
            Agency Command Center
          </h1>
          <p className="text-xs text-[#475467] mt-0.5 font-medium">
            Live operational intelligence synchronized across all client campaigns, teams, and studio pipelines.
          </p>
        </div>

        {/* Global Header Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={refreshAll}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#F8FAFC] border border-[#D8DEE9] text-[#344054] text-xs font-bold rounded-xl transition-all shadow-xs"
            title="Refresh All Source Modules"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#4F46E5] ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync Data'}</span>
          </button>

          {/* Quick Create Dropdown */}
          <div className="relative" ref={createMenuRef}>
            <button
              onClick={() => setCreateMenuOpen(!createMenuOpen)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] active:bg-[#3730A3] text-white text-xs font-bold rounded-xl shadow-xs transition-all duration-150"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-90" />
            </button>

            {createMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white border border-[#D8DEE9] rounded-xl shadow-lg z-50 py-1.5 overflow-hidden animate-in fade-in-50 zoom-in-95">
                <div className="px-3 py-1 text-[9px] font-black text-[#7A8496] uppercase tracking-wider border-b border-[#E5E9F0]">
                  New Agency Item
                </div>
                <button
                  onClick={() => { setCreateMenuOpen(false); setActiveTab('clients'); }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#344054] hover:bg-[#EEF2FF] hover:text-[#4F46E5] flex items-center gap-2.5 transition-colors"
                >
                  <Briefcase className="w-3.5 h-3.5 text-[#4F46E5]" />
                  <span>Client Account</span>
                </button>
                <button
                  onClick={() => { setCreateMenuOpen(false); setActiveTab('tasks'); }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#344054] hover:bg-[#EEF2FF] hover:text-[#4F46E5] flex items-center gap-2.5 transition-colors"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Operational Task</span>
                </button>
                <button
                  onClick={() => { setCreateMenuOpen(false); setActiveTab('calendar'); }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#344054] hover:bg-[#EEF2FF] hover:text-[#4F46E5] flex items-center gap-2.5 transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#06B6D4]" />
                  <span>Content Deliverable</span>
                </button>
                <button
                  onClick={() => { setCreateMenuOpen(false); setActiveTab('videos'); }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#344054] hover:bg-[#EEF2FF] hover:text-[#4F46E5] flex items-center gap-2.5 transition-colors"
                >
                  <Film className="w-3.5 h-3.5 text-[#7C3AED]" />
                  <span>Video Shoot Entry</span>
                </button>
                <button
                  onClick={() => { setCreateMenuOpen(false); setActiveTab('attendance'); }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#344054] hover:bg-[#EEF2FF] hover:text-[#4F46E5] flex items-center gap-2.5 transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>Mark Attendance</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── 2. ATTENTION BAR (High Contrast, Clear Status) ─────────────── */}
      <section>
        {attentionAlerts.length === 0 ? (
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-4 py-2.5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold text-[#15803D]">
              <div className="w-5 h-5 rounded-full bg-[#16A34A]/15 flex items-center justify-center text-[#16A34A]">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span>Everything critical is currently on track.</span>
            </div>
            <button
              onClick={() => setActiveTab('tasks')}
              className="text-xs font-bold text-[#15803D] hover:underline"
            >
              All tasks →
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-xs font-bold text-[#101828] flex items-center gap-1.5 whitespace-nowrap pl-1 pr-1">
              <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
              Needs Attention:
            </span>
            {attentionAlerts.map(alert => {
              const Icon = alert.icon;
              let chipStyle = 'bg-[#FEF2F2] hover:bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]';
              if (alert.type === 'warning') chipStyle = 'bg-[#FFF7ED] hover:bg-[#FFEDD5] border-[#FED7AA] text-[#C2410C]';
              if (alert.type === 'purple') chipStyle = 'bg-[#F5F3FF] hover:bg-[#EDE9FE] border-[#DDD6FE] text-[#6D28D9]';
              if (alert.type === 'info') chipStyle = 'bg-[#ECFEFF] hover:bg-[#CFFAFE] border-[#A5F3FC] text-[#0E7490]';

              return (
                <button
                  key={alert.id}
                  onClick={() => setActiveTab(alert.tab)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-xs font-bold whitespace-nowrap shadow-xs transition-all ${chipStyle}`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{alert.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── 3. 6-KPI EXECUTIVE STRIP (Height 84px) ──────────────────────── */}
      <section>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map(kpi => {
            const Icon = kpi.icon;
            return (
              <button
                key={kpi.id}
                onClick={() => setActiveTab(kpi.tab)}
                className="bg-white border border-[#D8DEE9] hover:border-[#C7D2FE] rounded-xl p-3.5 text-left shadow-xs hover:shadow-md transition-all duration-150 relative overflow-hidden group flex flex-col justify-between h-[84px]"
              >
                {/* 3px Accent top stripe */}
                <div 
                  className="absolute top-0 left-0 right-0 h-[3px]"
                  style={{ backgroundColor: kpi.accent }}
                />

                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#475467] truncate uppercase tracking-wider">
                    {kpi.label}
                  </span>
                  <div 
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${kpi.accent}18`, color: kpi.accent }}
                  >
                    <Icon className="w-3 h-3" />
                  </div>
                </div>

                <div className="text-[26px] font-bold text-[#101828] tracking-tight group-hover:text-[#4F46E5] transition-colors leading-none my-0.5">
                  {loading ? (
                    <span className="inline-block w-10 h-6 bg-[#EEF1F7] animate-pulse rounded"></span>
                  ) : (
                    kpi.value
                  )}
                </div>

                {kpi.subValue && (
                  <div className="text-[11px] font-medium text-[#7A8496] truncate">
                    {kpi.subValue}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── 4. QUICK ACTIONS TOOLBAR ─────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-white border border-[#D8DEE9] rounded-xl px-4 py-2 shadow-xs min-h-[48px] flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-[#101828] px-1">
            Quick Actions:
          </span>
          <button
            onClick={() => setActiveTab('tasks')}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F4F5FF] hover:bg-[#EDEEFF] text-[#4338CA] text-xs font-bold rounded-lg border border-[#D9DBFF] transition-all"
          >
            <CheckSquare className="w-3.5 h-3.5 text-[#4F46E5]" />
            Create Task
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F4F5FF] hover:bg-[#EDEEFF] text-[#4338CA] text-xs font-bold rounded-lg border border-[#D9DBFF] transition-all"
          >
            <Calendar className="w-3.5 h-3.5 text-[#06B6D4]" />
            Plan Content
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F4F5FF] hover:bg-[#EDEEFF] text-[#4338CA] text-xs font-bold rounded-lg border border-[#D9DBFF] transition-all"
          >
            <Briefcase className="w-3.5 h-3.5 text-[#4F46E5]" />
            Add Client
          </button>
        </div>

        {/* Secondary Actions Dropdown */}
        <div className="relative" ref={moreActionsRef}>
          <button
            onClick={() => setMoreActionsOpen(!moreActionsOpen)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#475467] hover:text-[#101828] hover:bg-[#F6F8FC] rounded-lg border border-transparent hover:border-[#D8DEE9] transition-all"
          >
            <span>More Actions</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {moreActionsOpen && (
            <div className="absolute right-0 mt-1.5 w-48 bg-white border border-[#D8DEE9] rounded-xl shadow-lg z-50 py-1.5 animate-in fade-in-50 zoom-in-95">
              <button
                onClick={() => { setMoreActionsOpen(false); setActiveTab('admins'); }}
                className="w-full text-left px-3.5 py-1.5 text-xs font-semibold text-[#344054] hover:bg-[#EEF2FF] flex items-center gap-2"
              >
                <Users className="w-3.5 h-3.5 text-[#16A34A]" />
                Employee Management
              </button>
              <button
                onClick={() => { setMoreActionsOpen(false); setActiveTab('videos'); }}
                className="w-full text-left px-3.5 py-1.5 text-xs font-semibold text-[#344054] hover:bg-[#EEF2FF] flex items-center gap-2"
              >
                <Film className="w-3.5 h-3.5 text-[#7C3AED]" />
                Video Production Desk
              </button>
              <button
                onClick={() => { setMoreActionsOpen(false); setActiveTab('reports'); }}
                className="w-full text-left px-3.5 py-1.5 text-xs font-semibold text-[#344054] hover:bg-[#EEF2FF] flex items-center gap-2"
              >
                <TrendingUp className="w-3.5 h-3.5 text-[#D89522]" />
                Client Monthly Reports
              </button>
              <button
                onClick={() => { setMoreActionsOpen(false); setActiveTab('payroll'); }}
                className="w-full text-left px-3.5 py-1.5 text-xs font-semibold text-[#344054] hover:bg-[#EEF2FF] flex items-center gap-2"
              >
                <CreditCard className="w-3.5 h-3.5 text-[#16A34A]" />
                Payroll Desk
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── 5. TODAY'S OPERATIONS (65% Work / 35% Approvals) ────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Today's Work (65%) */}
        <div className="lg:col-span-8 bg-white border border-[#D8DEE9] rounded-xl shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-[#FAFBFC] border-b border-[#E5E9F0] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-[#1D2939] flex items-center gap-1.5 uppercase tracking-wider">
                  <CheckSquare className="w-3.5 h-3.5 text-[#4F46E5]" />
                  Today's Work & Tasks
                </h3>
              </div>

              {/* Tabs */}
              <div className="inline-flex bg-[#EEF1F7] p-0.5 rounded-lg border border-[#D8DEE9]">
                <button
                  onClick={() => setActiveTaskTab('today')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    activeTaskTab === 'today'
                      ? 'bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE] shadow-2xs'
                      : 'text-[#475467] hover:text-[#101828]'
                  }`}
                >
                  Due Today ({dueTodayTasks.length})
                </button>
                <button
                  onClick={() => setActiveTaskTab('overdue')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    activeTaskTab === 'overdue'
                      ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] shadow-2xs'
                      : 'text-[#475467] hover:text-rose-600'
                  }`}
                >
                  Overdue ({overdueTasks.length})
                </button>
                <button
                  onClick={() => setActiveTaskTab('upcoming')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    activeTaskTab === 'upcoming'
                      ? 'bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE] shadow-2xs'
                      : 'text-[#475467] hover:text-[#101828]'
                  }`}
                >
                  Upcoming ({upcomingTasks.length})
                </button>
              </div>
            </div>

            {/* Task List */}
            <div className="p-4 divide-y divide-[#E5E9F0]">
              {activeTaskTab === 'today' && (
                dueTodayTasks.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#475467]">
                    <div className="w-8 h-8 rounded-full bg-[#ECFDF3] text-[#16A34A] flex items-center justify-center mx-auto mb-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <p className="font-bold text-[#101828]">No tasks due today</p>
                    <p className="text-[11px] text-[#7A8496]">All committed tasks are clear for today.</p>
                  </div>
                ) : (
                  dueTodayTasks.slice(0, 5).map(task => (
                    <div
                      key={task.id}
                      onClick={() => setActiveTab('tasks')}
                      className="py-2.5 px-1 flex items-center justify-between gap-3 hover:bg-[#FAFBFF] rounded-lg transition-colors cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#101828] group-hover:text-[#4F46E5] transition-colors truncate">
                            {task.title}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${getPriorityBadge(task.priority)}`}>
                            {task.priority || 'Normal'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#475467]">
                          <span className="font-bold text-[#344054]">{task.clientName || 'Agency'}</span>
                          <span>·</span>
                          <span>Lead: {task.assigneeName || 'Unassigned'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusBadge(task.status)}`}>
                          {task.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#7A8496] group-hover:text-[#4F46E5] transition-colors" />
                      </div>
                    </div>
                  ))
                )
              )}

              {activeTaskTab === 'overdue' && (
                overdueTasks.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#475467]">
                    <div className="w-8 h-8 rounded-full bg-[#ECFDF3] text-[#16A34A] flex items-center justify-center mx-auto mb-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <p className="font-bold text-[#101828]">No overdue tasks</p>
                    <p className="text-[11px] text-[#7A8496]">All deliverables are on schedule.</p>
                  </div>
                ) : (
                  overdueTasks.slice(0, 5).map(task => (
                    <div
                      key={task.id}
                      onClick={() => setActiveTab('tasks')}
                      className="py-2.5 px-1 flex items-center justify-between gap-3 hover:bg-[#FFF5F5] rounded-lg transition-colors cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#B91C1C] group-hover:underline transition-colors truncate">
                            {task.title}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                            Due {task.dueDate}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#475467]">
                          <span className="font-bold text-[#344054]">{task.clientName || 'Agency'}</span>
                          <span>·</span>
                          <span>Lead: {task.assigneeName || 'Unassigned'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                          {task.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#7A8496] group-hover:text-rose-600 transition-colors" />
                      </div>
                    </div>
                  ))
                )
              )}

              {activeTaskTab === 'upcoming' && (
                upcomingTasks.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#475467]">
                    <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center mx-auto mb-1.5">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <p className="font-bold text-[#101828]">No upcoming tasks</p>
                    <p className="text-[11px] text-[#7A8496]">Plan new deliverables in Tasks & Work.</p>
                  </div>
                ) : (
                  upcomingTasks.slice(0, 5).map(task => (
                    <div
                      key={task.id}
                      onClick={() => setActiveTab('tasks')}
                      className="py-2.5 px-1 flex items-center justify-between gap-3 hover:bg-[#FAFBFF] rounded-lg transition-colors cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#101828] group-hover:text-[#4F46E5] transition-colors truncate">
                            {task.title}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            Due {task.dueDate}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#475467]">
                          <span className="font-bold text-[#344054]">{task.clientName || 'Agency'}</span>
                          <span>·</span>
                          <span>Lead: {task.assigneeName || 'Unassigned'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusBadge(task.status)}`}>
                          {task.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#7A8496] group-hover:text-[#4F46E5] transition-colors" />
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>

          <div className="bg-[#F6F8FC] border-t border-[#D8DEE9] px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-medium text-[#475467]">
              {openTasks.length} active tasks across all clients
            </span>
            <button
              onClick={() => setActiveTab('tasks')}
              className="text-xs font-bold text-[#4F46E5] hover:text-[#4338CA] inline-flex items-center gap-1"
            >
              View All Tasks <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Approvals Queue (35%) */}
        <div className="lg:col-span-4 bg-white border border-[#D8DEE9] rounded-xl shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-[#FAFBFC] border-b border-[#E5E9F0] px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#1D2939] flex items-center gap-1.5 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
                  Approvals Queue
                </h3>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                {pendingApprovals.length} waiting
              </span>
            </div>

            <div className="p-4 space-y-2.5">
              {pendingApprovals.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#475467]">
                  <div className="w-8 h-8 rounded-full bg-[#FFF7ED] text-[#F59E0B] flex items-center justify-center mx-auto mb-1.5">
                    <Check className="w-4 h-4" />
                  </div>
                  <p className="font-bold text-[#101828]">No approvals waiting</p>
                  <p className="text-[11px] text-[#7A8496]">All deliverables are reviewed.</p>
                </div>
              ) : (
                pendingApprovals.slice(0, 4).map(item => (
                  <div
                    key={item.id || item.approval_id}
                    onClick={() => setActiveTab('approvals')}
                    className="p-3 bg-[#F8FAFC] hover:bg-[#FFFDF5] border border-[#D8DEE9] hover:border-amber-300 rounded-xl transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-[#4F46E5] uppercase tracking-wider">
                          {item.client_name || 'Client'}
                        </span>
                        <p className="text-xs font-bold text-[#101828] group-hover:text-amber-900 transition-colors truncate">
                          {item.title || 'Deliverable Item'}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-[#D8DEE9] text-[#344054] flex-shrink-0 uppercase">
                        {item.source_type || 'Review'}
                      </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-[#E5E9F0] flex items-center justify-between text-[11px] text-[#475467]">
                      <span>Lead: <strong className="text-[#344054]">{item.submitted_by_name || 'Creator'}</strong></span>
                      <span className="font-bold text-[#4F46E5] group-hover:underline">
                        Review in Hub →
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-[#F6F8FC] border-t border-[#D8DEE9] px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-medium text-[#475467]">
              {pendingApprovals.length} items awaiting client feedback
            </span>
            <button
              onClick={() => setActiveTab('approvals')}
              className="text-xs font-bold text-[#4F46E5] hover:text-[#4338CA] inline-flex items-center gap-1"
            >
              Open Approvals Hub <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </section>

      {/* ─── 6. PRODUCTION PIPELINE (Toggle Switcher) ─────────────────────── */}
      <section className="bg-white border border-[#D8DEE9] rounded-xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-[#E5E9F0]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#101828] uppercase tracking-wider">
                Agency Production Pipeline
              </h3>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="inline-flex bg-[#EEF1F7] p-0.5 rounded-lg border border-[#D8DEE9] text-xs font-bold">
            <button
              onClick={() => setPipelineMode('video')}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                pipelineMode === 'video'
                  ? 'bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE] shadow-2xs'
                  : 'text-[#475467] hover:text-[#101828]'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              Video Workflow ({videos.length})
            </button>
            <button
              onClick={() => setPipelineMode('content')}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                pipelineMode === 'content'
                  ? 'bg-[#ECFEFF] text-[#0E7490] border border-[#A5F3FC] shadow-2xs'
                  : 'text-[#475467] hover:text-[#101828]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Content Calendar ({calendarEntries.length})
            </button>
          </div>
        </div>

        {/* Connected Horizontal Flow */}
        {pipelineMode === 'video' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {videoPipelineStages.map((stage, i) => {
              const isActive = stage.count > 0;
              return (
                <div
                  key={stage.name}
                  onClick={() => setActiveTab('videos')}
                  className={`border rounded-xl p-3 text-center cursor-pointer transition-all ${
                    isActive
                      ? 'bg-[#EEF2FF] border-[#A5B4FC] text-[#4338CA] shadow-2xs'
                      : 'bg-[#F8FAFC] border-[#DCE2EB] text-[#475467] hover:border-[#CBD5E1]'
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider truncate">
                    {i + 1}. {stage.name}
                  </div>
                  <div className={`text-xl font-black mt-1 ${isActive ? 'text-[#4F46E5]' : 'text-[#101828]'}`}>
                    {stage.count}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {contentPipelineStages.map((stage, i) => {
              const isActive = stage.count > 0;
              return (
                <div
                  key={stage.name}
                  onClick={() => setActiveTab('calendar')}
                  className={`border rounded-xl p-3 text-center cursor-pointer transition-all ${
                    isActive
                      ? 'bg-[#ECFEFF] border-[#A5F3FC] text-[#0E7490] shadow-2xs'
                      : 'bg-[#F8FAFC] border-[#DCE2EB] text-[#475467] hover:border-[#CBD5E1]'
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider truncate">
                    {stage.name}
                  </div>
                  <div className={`text-xl font-black mt-1 ${isActive ? 'text-[#06B6D4]' : 'text-[#101828]'}`}>
                    {stage.count}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── 7. ROW 1: CLIENT ATTENTION (60%) + TEAM TODAY (40%) ─────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Client Attention Summary (60%) */}
        <div className="lg:col-span-7 bg-white border border-[#D8DEE9] rounded-xl shadow-xs overflow-hidden flex flex-col justify-between">
          <div className="p-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E9F0]">
              <div>
                <h3 className="text-xs font-bold text-[#1D2939] flex items-center gap-1.5 uppercase tracking-wider">
                  <Briefcase className="w-3.5 h-3.5 text-[#4F46E5]" />
                  Client Attention Intelligence
                </h3>
              </div>
              <button
                onClick={() => setActiveTab('clients')}
                className="text-xs font-bold text-[#4F46E5] hover:underline"
              >
                All Clients ({activeClients.length})
              </button>
            </div>

            <div className="mt-3">
              {clientAttentionList.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#475467] bg-[#F8FAFC] rounded-xl border border-[#D8DEE9]">
                  <CheckCircle2 className="w-6 h-6 text-[#16A34A] mx-auto mb-1" />
                  <p className="font-bold text-[#101828]">All active clients are on track.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E5E9F0] text-[10px] font-bold text-[#667085] uppercase tracking-wider">
                        <th className="pb-2">Client Account</th>
                        <th className="pb-2">Actionable Issue</th>
                        <th className="pb-2">Account Lead</th>
                        <th className="pb-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E9F0]">
                      {clientAttentionList.map(item => (
                        <tr key={item.id} className="hover:bg-[#F8FAFC] transition-colors">
                          <td className="py-2.5 font-bold text-[#101828]">
                            {item.name}
                          </td>
                          <td className="py-2.5 text-[#344054]">
                            <span className={`inline-flex items-center gap-1 font-bold ${
                              item.severity === 'urgent' ? 'text-rose-700' : 'text-amber-800'
                            }`}>
                              {item.reason}
                            </span>
                          </td>
                          <td className="py-2.5 text-[#475467] whitespace-nowrap">
                            {item.owner}
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => setActiveTab(item.tab)}
                              className="px-2.5 py-1 bg-[#EEF2FF] hover:bg-[#4F46E5] hover:text-white text-[#4338CA] text-xs font-bold rounded-lg border border-[#C7D2FE] transition-all"
                            >
                              {item.nextAction}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#F6F8FC] border-t border-[#D8DEE9] px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-medium text-[#475467]">
              {activeClients.length} total active client accounts
            </span>
            <button
              onClick={() => setActiveTab('clients')}
              className="text-xs font-bold text-[#4F46E5] hover:text-[#4338CA] inline-flex items-center gap-1"
            >
              Open Client Directory <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Team Today & Workload (40%) */}
        <div className="lg:col-span-5 bg-white border border-[#D8DEE9] rounded-xl shadow-xs overflow-hidden flex flex-col justify-between">
          <div className="p-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E9F0]">
              <div>
                <h3 className="text-xs font-bold text-[#1D2939] flex items-center gap-1.5 uppercase tracking-wider">
                  <Users className="w-3.5 h-3.5 text-[#16A34A]" />
                  Team Today & Workload
                </h3>
              </div>
              
              <div className="flex items-center gap-1 text-xs font-bold">
                <span className="text-[#16A34A]">{todayAttendanceStats.presentCount} Present</span>
                <span className="text-[#98A2B3]">/</span>
                <span className="text-[#475467]">{todayAttendanceStats.totalEmployees} Active Total</span>
              </div>
            </div>

            {/* Attendance Status Summary Chips */}
            <div className="grid grid-cols-4 gap-1.5 mt-3 text-center">
              <div className="bg-[#ECFDF3] text-[#15803D] border border-[#BBF7D0] rounded-lg py-1 px-1 text-[11px] font-semibold">
                <span className="font-bold">{todayAttendanceStats.presentCount}</span> Present
              </div>
              <div className="bg-[#FFF7ED] text-[#B45309] border border-[#FED7AA] rounded-lg py-1 px-1 text-[11px] font-semibold">
                <span className="font-bold">{todayAttendanceStats.lateCount}</span> Late
              </div>
              <div className="bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] rounded-lg py-1 px-1 text-[11px] font-semibold">
                <span className="font-bold">{todayAttendanceStats.absentCount}</span> Absent
              </div>
              <div className="bg-[#F5F3FF] text-[#6D28D9] border border-[#DDD6FE] rounded-lg py-1 px-1 text-[11px] font-semibold">
                <span className="font-bold">{todayAttendanceStats.leaveCount}</span> Leave
              </div>
            </div>

            {/* Employee Workload Rows */}
            <div className="mt-3 divide-y divide-[#E5E9F0]">
              {teamWorkloadList.map(member => (
                <div key={member.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#4F46E5]/10 text-[#4F46E5] font-black text-xs flex items-center justify-center flex-shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#101828] truncate">
                        {member.name}
                      </p>
                      <p className="text-[10px] font-medium text-[#7A8496] truncate">
                        {member.role}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] text-[#475467] font-semibold">
                      {member.taskCount} {member.taskCount === 1 ? 'task' : 'tasks'}
                    </span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${member.workloadColor}18`,
                        color: member.workloadColor
                      }}
                    >
                      {member.workloadState}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#F6F8FC] border-t border-[#D8DEE9] px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-medium text-[#475467]">
              Real-time attendance & team desk
            </span>
            <button
              onClick={() => setActiveTab('attendance')}
              className="text-xs font-bold text-[#4F46E5] hover:text-[#4338CA] inline-flex items-center gap-1"
            >
              Open Attendance <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </section>

      {/* ─── 8. ROW 2: RECENT ACTIVITY (65%) + COMING UP (35%) ───────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Recent Activity (65%) */}
        <div className="lg:col-span-8 bg-white border border-[#D8DEE9] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E9F0] mb-3">
            <div>
              <h3 className="text-xs font-bold text-[#1D2939] flex items-center gap-1.5 uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5 text-[#06B6D4]" />
                Recent Agency Activity
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('audit-log')}
              className="text-xs font-bold text-[#4F46E5] hover:underline"
            >
              View Activity Log →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activityLogs.length === 0 ? (
              <div className="col-span-2 py-6 text-center text-xs text-[#64748B]">
                No recent system activity recorded today.
              </div>
            ) : (
              activityLogs.slice(0, 4).map(log => (
                <div
                  key={log.id}
                  className="p-3 bg-[#F8FAFC] border border-[#D8DEE9] rounded-xl text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px] text-[#7A8496]">
                    <span className="font-bold text-[#4F46E5] uppercase">{log.details || 'System'}</span>
                    <span>{formatRelativeTime(log.createdAt || log.timestamp)}</span>
                  </div>
                  <p className="text-xs text-[#344054] font-medium leading-snug">
                    <strong className="text-[#101828] font-bold">{log.userName}</strong> {log.action}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Coming Up / Deadlines (35%) */}
        <div className="lg:col-span-4 bg-white border border-[#D8DEE9] rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E9F0] mb-3">
              <h3 className="text-xs font-bold text-[#1D2939] flex items-center gap-1.5 uppercase tracking-wider">
                <CalendarDays className="w-3.5 h-3.5 text-[#7C3AED]" />
                Coming Up
              </h3>
              <span className="text-[10px] text-[#475467] font-bold uppercase tracking-wider">
                Next 7 Days
              </span>
            </div>

            <div className="space-y-2">
              {upcomingDeadlines.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#475467] bg-[#F8FAFC] rounded-xl border border-[#D8DEE9]">
                  <p className="font-bold text-[#101828]">No upcoming deadlines</p>
                </div>
              ) : (
                upcomingDeadlines.slice(0, 4).map(dl => (
                  <div 
                    key={dl.id} 
                    onClick={() => {
                      if (dl.type === 'task') setActiveTab('tasks');
                      else if (dl.type === 'content') setActiveTab('calendar');
                      else setActiveTab('videos');
                    }}
                    className="p-2.5 bg-[#F8FAFC] hover:bg-[#F4F5FF] border border-[#D8DEE9] hover:border-[#C7D2FE] rounded-xl text-xs cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#4F46E5] uppercase tracking-wider truncate">
                        {dl.clientName}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-white border border-[#D8DEE9] text-[#475467]">
                        Due {dl.dueDate}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#101828] truncate mt-1">
                      {dl.deliverable}
                    </p>
                    <p className="text-[10px] text-[#7A8496] font-medium mt-0.5">
                      Lead: {dl.owner}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => setActiveTab('calendar')}
            className="w-full mt-3 py-2 bg-[#F4F5FF] hover:bg-[#EDEEFF] text-[#4338CA] text-xs font-bold rounded-xl border border-[#D9DBFF] transition-all text-center"
          >
            Open Full Calendar Schedule →
          </button>
        </div>

      </section>

    </div>
  );
};

export default CommandCenter;
