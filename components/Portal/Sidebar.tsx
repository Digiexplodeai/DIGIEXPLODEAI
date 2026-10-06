import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Sun, Users, Briefcase, CalendarDays, Film,
  CheckSquare, UserCheck, TrendingUp, BarChart3, Globe, FolderOpen,
  Bell, Settings, LogOut, X, ChevronDown, ChevronRight, Plus,
  Wifi, Search, PanelLeftClose, PanelLeft, Shield, Zap, Clock,
  ClipboardList, FileText, CreditCard, ShieldCheck, Lock
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  roles?: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const getNavGroups = (role: string, notifCount: number): NavGroup[] => {
  const all: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { id: 'dashboard',        label: 'Command Center', icon: LayoutDashboard, roles: ['superAdmin','admin'] },
        { id: 'myday',            label: 'My Day',          icon: Sun,             roles: ['superAdmin','admin','employee'] },
        { id: 'client-workspace', label: 'My Workspace',    icon: LayoutDashboard, roles: ['client'] },
      ]
    },
    {
      label: 'Operations',
      items: [
        { id: 'clients',   label: 'Clients',         icon: Briefcase,    roles: ['superAdmin','admin'] },
        { id: 'tasks',     label: 'Tasks & Work',     icon: CheckSquare,  roles: ['superAdmin','admin','employee'] },
        { id: 'worklog',   label: 'Work Log',         icon: ClipboardList,roles: ['superAdmin','admin','employee'] },
        { id: 'calendar',  label: 'Content Calendar', icon: CalendarDays, roles: ['superAdmin','admin','employee'] },
        { id: 'videos',    label: 'Video Production', icon: Film,         roles: ['superAdmin','admin','employee'] },
        { id: 'approvals', label: 'Approvals',        icon: CheckSquare,  roles: ['superAdmin','admin','client'] },
      ]
    },
    {
      label: 'People',
      items: [
        { id: 'admins',      label: 'Employees',           icon: Users,      roles: ['superAdmin','admin'] },
        { id: 'attendance',  label: 'Attendance & Leaves',  icon: UserCheck,  roles: ['superAdmin','admin','employee'] },
        { id: 'performance', label: 'Performance',          icon: TrendingUp, roles: ['superAdmin','admin'] },
        { id: 'hr-docs',     label: 'HR Documents',         icon: FileText,   roles: ['superAdmin','admin'] },
        { id: 'payroll',     label: 'Payroll',              icon: CreditCard, roles: ['superAdmin','admin'] },
      ]
    },
    {
      label: 'Analytics',
      items: [
        { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['superAdmin','admin','client'] },
      ]
    },
    {
      label: 'Tools',
      items: [
        { id: 'seo',   label: 'SEO & Meta Studio', icon: Globe,      roles: ['superAdmin','admin'] },
        { id: 'files', label: 'Files & Assets',    icon: FolderOpen, roles: ['superAdmin','admin','employee'] },
      ]
    },
    {
      label: 'System',
      items: [
        { id: 'notifications', label: 'Notifications',     icon: Bell,        roles: ['superAdmin','admin','employee','client'], badge: notifCount },
        { id: 'audit-log',     label: 'Audit Log',          icon: ShieldCheck, roles: ['superAdmin'] },
        { id: 'permissions',   label: 'Roles & Permissions',icon: Lock,        roles: ['superAdmin'] },
        { id: 'settings',      label: 'Settings',           icon: Settings,    roles: ['superAdmin','admin'] },
      ]
    }
  ];

  return all.map(group => ({
    ...group,
    items: group.items.filter(item => !item.roles || item.roles.includes(role))
  })).filter(group => group.items.length > 0);
};

const roleMeta: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  superAdmin: { label: 'Super Admin', color: 'bg-blue-600/15 text-blue-300 border-blue-500/30',   icon: Shield },
  admin:      { label: 'Agency Admin', color: 'bg-sky-500/15 text-sky-300 border-sky-500/25',      icon: Zap },
  employee:   { label: 'Team Member',  color: 'bg-teal-500/15 text-teal-300 border-teal-500/25',   icon: Users },
  client:     { label: 'Client',       color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', icon: Briefcase },
};

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, setIsOpen }) => {
  const { profile, signOutUser } = useAuth();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Overview: true, Operations: true, People: true, Analytics: true, Tools: false, System: false
  });
  const [searchQuery, setSearchQuery] = useState('');

  const role = profile?.role || 'admin';
  const meta = roleMeta[role] || roleMeta.admin;
  const navGroups = getNavGroups(role, 0);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  // Listen for global focus_search event (Ctrl+K)
  useEffect(() => {
    const handler = () => {
      if (collapsed) setCollapsed(false);
      setTimeout(() => {
        (document.querySelector('#sidebar-search') as HTMLInputElement)?.focus();
      }, 150);
    };
    window.addEventListener('focus_search', handler);
    return () => window.removeEventListener('focus_search', handler);
  }, [collapsed]);

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const handleNav = (id: string) => {
    setActiveTab(id);
    setIsOpen(false);
  };

  const allItems = navGroups.flatMap(g => g.items);
  const filtered = searchQuery
    ? allItems.filter(i => i.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300
          border-r shadow-2xl
          ${collapsed ? 'w-16' : 'w-64'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0`}
        style={{ background: '#0B1020', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        {/* ─── HEADER ─────────────────────────────── */}
        <div
          className={`flex items-center h-14 px-3 flex-shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 2px 10px rgba(79,70,229,0.35)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black text-white truncate" style={{ letterSpacing: '-0.02em' }}>DigiexplodeAI</div>
                <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.30)' }}>Agency OS</div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1.5 rounded-lg transition-all"
              style={{ color: 'rgba(255,255,255,0.35)' }}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
            <button onClick={() => setIsOpen(false)} className="lg:hidden p-1.5 rounded-lg" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── SEARCH ──────────────────────────────── */}
        {!collapsed && (
          <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.30)' }} />
              <input
                id="sidebar-search"
                type="text"
                placeholder="Search modules…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs outline-none w-full"
                style={{ color: 'rgba(255,255,255,0.70)', caretColor: '#3557FF' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-[10px]" style={{ color: 'rgba(255,255,255,0.30)' }}>✕</button>
              )}
            </div>
          </div>
        )}

        {/* ─── QUICK CREATE ────────────────────────── */}
        {!collapsed && (
          <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              onClick={() => handleNav('tasks')}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all"
              style={{ background: 'rgba(53,87,255,0.15)', color: '#7B9FFF', border: '1px solid rgba(53,87,255,0.25)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Quick Create
            </button>
          </div>
        )}

        {/* ─── FIREBASE LIVE BADGE ─────────────────── */}
        {!collapsed && (
          <div className="mx-3 mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg flex-shrink-0" style={{ background: 'rgba(22,163,106,0.08)', border: '1px solid rgba(22,163,106,0.15)' }}>
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <Wifi className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-400">Firebase Live</span>
          </div>
        )}

        {/* ─── NAV ITEMS ───────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-thin" style={{ scrollbarWidth: 'thin' }}>

          {/* Search results */}
          {filtered && (
            <div className="space-y-0.5">
              {filtered.length === 0 ? (
                <p className="text-xs px-2 py-3 text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>No results</p>
              ) : (
                filtered.map(item => (
                  <NavButton key={item.id} item={item} active={activeTab === item.id} collapsed={collapsed} onClick={() => handleNav(item.id)} />
                ))
              )}
            </div>
          )}

          {/* Normal grouped nav */}
          {!filtered && navGroups.map(group => (
            <div key={group.label}>
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-2 py-1 mb-1"
                >
                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {group.label}
                  </span>
                  {expandedGroups[group.label]
                    ? <ChevronDown className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.20)' }} />
                    : <ChevronRight className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.20)' }} />
                  }
                </button>
              )}

              {(collapsed || expandedGroups[group.label]) && (
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <NavButton key={item.id} item={item} active={activeTab === item.id} collapsed={collapsed} onClick={() => handleNav(item.id)} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* ─── USER PROFILE + SIGNOUT ──────────────── */}
        <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {!collapsed ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                  style={{ background: '#3557FF' }}
                >
                  {profile?.name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{profile?.name || 'User'}</div>
                  <div className={`inline-flex items-center gap-1 mt-0.5 text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded border ${meta.color}`}>
                    <meta.icon className="w-2.5 h-2.5" />
                    {meta.label}
                  </div>
                </div>
              </div>
              <button
                onClick={signOutUser}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ color: 'rgba(255,255,255,0.30)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#FF6B6B'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,107,0.07)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.30)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={signOutUser}
              className="w-full flex items-center justify-center p-2 rounded-xl transition-all"
              style={{ color: 'rgba(255,255,255,0.25)' }}
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Spacer for desktop layout */}
      <div className={`hidden lg:block flex-shrink-0 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`} />
    </>
  );
};

// ─── NAV BUTTON COMPONENT ────────────────────────────────────────────
interface NavButtonProps {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ item, active, collapsed, onClick }) => {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`w-full flex items-center gap-3 rounded-lg text-xs font-semibold transition-all duration-150
        ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'}`}
      style={{
        background: active ? 'linear-gradient(135deg, #4F46E5, #5B5EF7)' : 'transparent',
        color: active ? '#FFFFFF' : '#AAB2C5',
        boxShadow: active ? '0 2px 12px rgba(79,70,229,0.35)' : 'none',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = '#151D32';
          (e.currentTarget as HTMLElement).style.color = '#FFFFFF';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          (e.currentTarget as HTMLElement).style.color = '#AAB2C5';
        }
      }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active ? '#FFFFFF' : '#8E99AF' }} />
      {!collapsed && (
        <span className="truncate">{item.label}</span>
      )}
      {!collapsed && item.badge !== undefined && item.badge > 0 && (
        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500 text-white">
          {item.badge}
        </span>
      )}
    </button>
  );
};

export default Sidebar;
