import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sidebar }            from '../components/Portal/Sidebar';
import { LoginView }          from '../components/Portal/LoginView';
import { CommandCenter }      from '../components/Portal/CommandCenter';
import { MyDayView }          from '../components/Portal/MyDayView';
import { DashboardOverview }  from '../components/Portal/DashboardOverview';
import { ContentCalendar }    from '../components/Portal/ContentCalendar';
import { ApprovalsView }      from '../components/Portal/ApprovalsView';
import { ReportsView }        from '../components/Portal/ReportsView';
import { ClientList }         from '../components/Portal/ClientList';
import { AdminList }          from '../components/Portal/AdminList';
import { AttendanceView }     from '../components/Portal/AttendanceView';
import { VideoTrackerView }   from '../components/Portal/VideoTrackerView';
import { SEOStudioView }      from '../components/Portal/SEOStudioView';
import { TasksView }          from '../components/Portal/TasksView';
import { WorkLogView }        from '../components/Portal/WorkLogView';
import { PerformanceView }    from '../components/Portal/PerformanceView';
import { SettingsView }       from '../components/Portal/SettingsView';
import { NotificationCenterView } from '../components/Portal/NotificationCenterView';
import { HRDocumentsView }    from '../components/Portal/HRDocumentsView';
import { PayrollView }        from '../components/Portal/PayrollView';
import { AuditLogView }       from '../components/Portal/AuditLogView';
import { PermissionsView }    from '../components/Portal/PermissionsView';
import { MarketingDashboardView } from '../components/Portal/MarketingDashboardView';
import { Topbar }             from '../components/Portal/Topbar';
import { CommandPalette }     from '../components/Portal/CommandPalette';
import { Menu, ShieldAlert, LogOut, Loader2, Command, Bell } from 'lucide-react';
import { PermissionService } from '../lib/controlPlane/PermissionService';

const TAB_MODULE_MAP: Record<string, string> = {
  'clients': 'Clients',
  'tasks': 'Tasks & Work',
  'worklog': 'Work Log',
  'calendar': 'Content Calendar',
  'videos': 'Video Production',
  'approvals': 'Approvals',
  'admins': 'Employees',
  'attendance': 'Attendance & Leaves',
  'performance': 'Performance',
  'reports': 'Reports',
  'hr-docs': 'HR Documents',
  'payroll': 'Payroll',
  'seo': 'SEO Studio',
  'marketing': 'Marketing & Leads',
  'files': 'Files & Assets',
  'settings': 'Settings',
};

interface PortalDashboardProps {
  defaultTab?: string;
}

// Role-based default tabs
const getDefaultTab = (role: string): string => {
  switch (role) {
    case 'superAdmin': return 'dashboard';
    case 'admin':      return 'dashboard';
    case 'employee':   return 'myday';
    case 'client':     return 'client-workspace';
    default:           return 'dashboard';
  }
};

const PortalDashboard: React.FC<PortalDashboardProps> = ({ defaultTab }) => {
  const { user, profile, loading, signOutUser, loginAsDemoRole } = useAuth();
  const searchTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
  const [activeTab, setActiveTab] = useState<string>(searchTab || defaultTab || 'attendance');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [showSlowLoadFallback, setShowSlowLoadFallback] = useState(false);

  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => setShowSlowLoadFallback(true), 1500);
      return () => clearTimeout(t);
    } else {
      setShowSlowLoadFallback(false);
    }
  }, [loading]);

  // Set role-based default tab once profile loads
  useEffect(() => {
    if (searchTab) {
      setActiveTab(searchTab);
    } else if (profile && !defaultTab) {
      setActiveTab(getDefaultTab(profile.role));
    }
  }, [profile, defaultTab, searchTab]);

  // Global keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#0A0F1E' }}>
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-2xl"
               style={{ background: '#3557FF', boxShadow: '0 0 40px rgba(53,87,255,0.35)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-7 h-7">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div className="absolute -inset-1 rounded-2xl opacity-30 blur animate-pulse" style={{ background: 'linear-gradient(135deg, #3557FF, #6A4CFF)' }} />
        </div>
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-widest animate-pulse" style={{ color: '#7B9FFF', letterSpacing: '0.15em' }}>
            Initializing Agency OS…
          </p>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>DigiexplodeAI · Command Center</p>
        </div>

        {showSlowLoadFallback && (
          <div className="mt-4 flex flex-col items-center gap-2 animate-in fade-in">
            <button
              onClick={() => loginAsDemoRole('superAdmin')}
              className="px-5 py-2.5 rounded-xl bg-[#3557FF] hover:bg-[#2545E0] text-white text-xs font-bold shadow-lg transition-all cursor-pointer"
            >
              Open Dashboard (Super Admin)
            </button>
            <button
              onClick={() => signOutUser()}
              className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
            >
              Go to Login Page
            </button>
          </div>
        )}
      </div>
    );
  }

  // Not signed in
  if (!user && !profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center py-6 px-4">
        <LoginView />
      </div>
    );
  }

  // Deactivated account
  if (profile?.status === 'inactive') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-slate-900 border border-rose-500/20 p-8 rounded-3xl max-w-md w-full shadow-2xl space-y-6">
          <ShieldAlert className="w-16 h-16 text-rose-400 mx-auto" />
          <h2 className="text-xl font-black text-white">Account Deactivated</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your account is currently <strong className="text-rose-400">inactive</strong>.
            Please contact DigiexplodeAI support to restore access.
          </p>
          <button
            onClick={signOutUser}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Render tab content with Dynamic Role Boundary Enforcement
  const renderTab = () => {
    const rawRole = profile?.role || 'admin';
    const effectiveRole = PermissionService.getEffectiveRole(rawRole as any);
    const isSuperAdmin = effectiveRole === 'superAdmin';
    const isClient = effectiveRole === 'client';

    // 1. Super Admin strictly restricted modules
    const superAdminOnlyTabs = ['audit-log', 'permissions'];
    if (!isSuperAdmin && superAdminOnlyTabs.includes(activeTab)) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-[#3557FF]">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Super Admin Authorization Required</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
              This module requires elevated platform administrator credentials.
            </p>
          </div>
          <button
            onClick={() => setActiveTab(isClient ? 'client-workspace' : 'myday')}
            className="px-5 py-2.5 bg-[#3557FF] hover:bg-[#2545E0] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md"
          >
            Return to Workspace
          </button>
        </div>
      );
    }

    // 2. Client Boundary: Prevent clients from accessing internal operational tools
    const clientAllowedTabs = ['dashboard', 'client-workspace', 'approvals', 'reports', 'notifications'];
    if (isClient && !clientAllowedTabs.includes(activeTab)) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Client Access Boundary</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
              Internal agency modules, team directories, and financial records are restricted. Please navigate to your dedicated client workspace.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('client-workspace')}
            className="px-5 py-2.5 bg-[#3557FF] hover:bg-[#2545E0] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md"
          >
            Return to My Workspace
          </button>
        </div>
      );
    }

    // 3. Dynamic Matrix Enforcement for Platform Modules
    const canonicalMod = TAB_MODULE_MAP[activeTab];
    if (canonicalMod && !isSuperAdmin) {
      const allowed = PermissionService.can(canonicalMod, 'view', effectiveRole);
      if (!allowed) {
        return (
          <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Access Not Granted</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                You do not have view permissions for the <strong className="text-slate-800 dark:text-slate-200">{canonicalMod}</strong> module. Please contact your agency administrator.
              </p>
            </div>
            <button
              onClick={() => setActiveTab(isClient ? 'client-workspace' : 'myday')}
              className="px-5 py-2.5 bg-[#3557FF] hover:bg-[#2545E0] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md"
            >
              Return to Workspace
            </button>
          </div>
        );
      }
    }

    switch (activeTab) {
      // ─── Overview ─────────────────────────────────────────
      case 'dashboard':
        return (profile?.role === 'client')
          ? <DashboardOverview setActiveTab={setActiveTab} />
          : <CommandCenter setActiveTab={setActiveTab} />;

      case 'myday':           return <MyDayView setActiveTab={setActiveTab} />;
      case 'client-workspace': return <DashboardOverview setActiveTab={setActiveTab} />;

      // ─── Operations ───────────────────────────────────────
      case 'clients':         return <ClientList />;
      case 'tasks':           return <TasksView />;
      case 'worklog':         return <WorkLogView />;
      case 'calendar':        return <ContentCalendar />;
      case 'videos':          return <VideoTrackerView />;
      case 'approvals':       return <ApprovalsView setActiveTab={setActiveTab} />;

      // ─── People ───────────────────────────────────────────
      case 'admins':          return <AdminList />;
      case 'attendance':      return <AttendanceView />;
      case 'performance':     return <PerformanceView />;
      case 'hr-docs':         return <HRDocumentsView />;
      case 'payroll':         return <PayrollView />;

      // ─── Analytics & Growth ───────────────────────────────
      case 'marketing':       return <MarketingDashboardView />;
      case 'reports':         return <ReportsView />;

      // ─── Tools ────────────────────────────────────────────
      case 'seo':             return <SEOStudioView />;
      case 'files':           return <FilesPlaceholder />;

      // ─── System ───────────────────────────────────────────
      case 'notifications':   return <NotificationCenterView setActiveTab={setActiveTab} />;
      case 'audit-log':       return <AuditLogView />;
      case 'permissions':     return <PermissionsView />;
      case 'settings':        return <SettingsView setActiveTab={setActiveTab} />;
      case 'bg-studio':       return <SettingsView setActiveTab={setActiveTab} />; // redirect old route

      default:                return <CommandCenter setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen flex bg-[#EEF1F7] dark:bg-[#080A12] text-[#101828] dark:text-[#F7F8FC] font-sans antialiased transition-colors duration-200">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Universal Topbar */}
        <Topbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenCommandPalette={() => setIsCommandOpen(true)}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onOpenCreateTask={() => setActiveTab('tasks')}
          onOpenCreateWorkLog={() => setActiveTab('worklog')}
        />

        {/* Page content */}
        <main className="flex-1 px-3 md:px-6 lg:px-8 py-5 md:py-7 max-w-screen-2xl w-full mx-auto">
          {renderTab()}
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        setActiveTab={setActiveTab}
      />
    </div>
  );
};

// ─── Placeholder views ─────────────────────────────────────────────────
const FilesPlaceholder: React.FC = () => (
  <div className="flex flex-col items-center gap-4 py-20 text-center">
    <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
      <Command className="w-8 h-8 text-violet-400" />
    </div>
    <h2 className="text-lg font-black text-white">Files & Assets</h2>
    <p className="text-sm text-slate-500 max-w-xs">File management module coming soon. Use drive links in task and content entries for now.</p>
  </div>
);

const NotificationsPlaceholder: React.FC = () => (
  <div className="space-y-5 pb-8">
    <div>
      <div className="text-xs font-black uppercase tracking-widest text-violet-400 mb-1 flex items-center gap-2">
        <Bell className="w-3.5 h-3.5" /> Notifications
      </div>
      <h1 className="text-2xl font-black text-white">Notification Center</h1>
    </div>
    <div className="bg-white/4 border border-white/8 rounded-2xl p-8 text-center">
      <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
      <p className="text-sm font-bold text-slate-400">You're all caught up!</p>
      <p className="text-xs text-slate-600 mt-1">Notifications appear here when tasks are assigned, deadlines approach, or approvals are needed.</p>
    </div>
  </div>
);

export default PortalDashboard;
