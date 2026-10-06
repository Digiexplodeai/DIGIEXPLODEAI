import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Settings, Palette, Shield, Bell, Database, ChevronRight, Check,
  ExternalLink, Lock, CheckCircle, AlertTriangle, Plus, Edit2, Archive,
  RefreshCw, Info, Cpu, HardDrive, Key, Sparkles, X
} from 'lucide-react';
import { BackgroundStudioView } from './BackgroundStudioView';
import { NotificationService, DEFAULT_NOTIFICATION_PREFERENCES } from '../../lib/controlPlane/NotificationService';
import { NotificationPreferences, TaskCategoryItem } from '../../lib/controlPlane/types';
import { SettingsService } from '../../lib/controlPlane/SettingsService';
import { WorkspaceEventService } from '../../lib/controlPlane/WorkspaceEventService';

interface SettingsViewProps {
  setActiveTab?: (tab: string) => void;
}

type SettingsTab = 'appearance' | 'notifications' | 'security' | 'system';

export const SettingsView: React.FC<SettingsViewProps> = ({ setActiveTab }) => {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsTab>('appearance');
  const isSuperAdmin = profile?.role === 'superAdmin';

  const sections = [
    { id: 'appearance' as SettingsTab, label: 'Appearance', icon: Palette, desc: 'Themes, Canvas & Motion' },
    { id: 'notifications' as SettingsTab, label: 'Notifications', icon: Bell, desc: 'Operational alert rules' },
    ...(isSuperAdmin ? [
      { id: 'security' as SettingsTab,  label: 'Security & Access',  icon: Shield,   desc: 'Control plane & RBAC overview' },
      { id: 'system' as SettingsTab,    label: 'System & Categories',icon: Database, desc: 'Task categories & runtime info' },
    ] : []),
  ];

  return (
    <div className="space-y-6 pb-8 font-sans">
      {/* Header */}
      <div>
        <div className="text-xs font-black uppercase tracking-widest text-[#3557FF] mb-1 flex items-center gap-2">
          <Settings className="w-3.5 h-3.5" /> Platform Control Plane
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Platform Settings</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Unified control center for visual preferences, notification routing, security integrity and task categories
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-5">
        {/* Sidebar nav */}
        <div className="md:w-60 flex-shrink-0">
          <div className="bg-white dark:bg-[#0E1326] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs">
            {sections.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all cursor-pointer ${
                  i < sections.length - 1 ? 'border-b border-slate-100 dark:border-white/5' : ''
                } ${
                  activeSection === s.id
                    ? 'bg-[#3557FF]/10 border-l-4 border-l-[#3557FF] text-[#3557FF]'
                    : 'hover:bg-slate-50 dark:hover:bg-white/4 text-slate-700 dark:text-slate-300'
                }`}
              >
                <s.icon className={`w-4 h-4 flex-shrink-0 ${activeSection === s.id ? 'text-[#3557FF]' : 'text-slate-400'}`} />
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${activeSection === s.id ? 'text-[#3557FF] dark:text-[#7B9FFF]' : 'text-slate-800 dark:text-slate-200'}`}>
                    {s.label}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">{s.desc}</p>
                </div>
                {activeSection === s.id && <ChevronRight className="w-3.5 h-3.5 text-[#3557FF] ml-auto flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeSection === 'appearance' && <BackgroundStudioView />}
          {activeSection === 'notifications' && <NotificationSettingsView memberId={profile?.userId} />}
          {activeSection === 'security' && isSuperAdmin && <SecuritySettingsView setActiveTab={setActiveTab} />}
          {activeSection === 'system' && isSuperAdmin && <SystemSettingsView />}
        </div>
      </div>
    </div>
  );
};

// ── Notification Settings ──────────────────────────────────────────────
const NotificationSettingsView: React.FC<{ memberId?: string }> = ({ memberId }) => {
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => NotificationService.getPreferences(memberId));
  const [savedBadge, setSavedBadge] = useState(false);

  const togglePref = (key: keyof NotificationPreferences) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    NotificationService.setPreferences(updated, memberId);
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 2000);
  };

  const prefConfig: { key: keyof NotificationPreferences; title: string; desc: string }[] = [
    {
      key: 'taskAssigned',
      title: 'Task Assigned to Me',
      desc: 'Deliver an instant notification when a new task or deliverable is assigned to you.'
    },
    {
      key: 'deadlineApproach',
      title: 'Deadline Approaching',
      desc: 'Receive alerts when assigned deliverables are due today or within 24 hours.'
    },
    {
      key: 'taskOverdue',
      title: 'Task Overdue',
      desc: 'Notify once when a deliverable has passed its scheduled deadline without completion.'
    },
    {
      key: 'leaveStatus',
      title: 'Leave Status Update',
      desc: 'Receive updates whenever attendance leave requests are approved or rejected.'
    },
    {
      key: 'clientApproval',
      title: 'Client Approval Received',
      desc: 'Notify creators and reviewers when clients approve or request revision on creatives.'
    },
    {
      key: 'announcements',
      title: 'Team Announcements',
      desc: 'Receive company-wide broadcast announcements from Agency leadership.'
    },
  ];

  return (
    <div className="bg-white dark:bg-[#0E1326] border border-slate-200 dark:border-white/10 rounded-2xl p-6 space-y-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white">Notification Preferences</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure operational alert rules. Disabling a type prevents future notifications from entering your inbox.
          </p>
        </div>
        {savedBadge && (
          <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Saved & Active
          </span>
        )}
      </div>

      <div className="divide-y divide-slate-100 dark:divide-white/5">
        {prefConfig.map(({ key, title, desc }) => {
          const isEnabled = prefs[key];
          return (
            <div key={key} className="py-3.5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white">{title}</p>
                <p className="text-[11px] text-slate-500">{desc}</p>
              </div>

              <button
                type="button"
                onClick={() => togglePref(key)}
                className={`w-11 h-6 rounded-full transition-all relative shrink-0 cursor-pointer ${
                  isEnabled ? 'bg-[#3557FF]' : 'bg-slate-300 dark:bg-white/15'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-xs ${
                    isEnabled ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Security Settings (Canonical Overview - No Duplicate Matrix) ───────
const SecuritySettingsView: React.FC<{ setActiveTab?: (tab: string) => void }> = ({ setActiveTab }) => {
  const { profile } = useAuth();

  return (
    <div className="space-y-4 font-sans">
      <div className="bg-white dark:bg-[#0E1326] border border-slate-200 dark:border-white/10 rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#3557FF]" />
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Security & Access Control Architecture</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Single authoritative Role-Based Access Control (RBAC) model across Agency OS
              </p>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            RBAC Enforced
          </span>
        </div>

        {/* Info card */}
        <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-[#3557FF] dark:text-[#7B9FFF]">
            <Info className="w-4 h-4" /> Single Canonical Security Source
          </div>
          <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
            All role permissions (Super Admin, Admin, Team Leader, Employee, HR, Accounts, Client) across all 15 platform modules are managed exclusively in the dedicated <strong>Roles & Permissions</strong> control center to eliminate duplicate conflicting matrices.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                if (setActiveTab) setActiveTab('permissions');
              }}
              className="px-4 py-2 bg-[#3557FF] hover:bg-[#2846DF] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" /> Open Roles & Permissions Control Center →
            </button>
          </div>
        </div>

        {/* Active Session info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3 bg-slate-50 dark:bg-white/3 rounded-xl border border-slate-100 dark:border-white/5">
            <span className="text-[10px] text-slate-400 uppercase font-black block">Active Role</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">{profile?.role || 'Super Admin'}</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-white/3 rounded-xl border border-slate-100 dark:border-white/5">
            <span className="text-[10px] text-slate-400 uppercase font-black block">Policy Version</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">v2.4 Canonical</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-white/3 rounded-xl border border-slate-100 dark:border-white/5">
            <span className="text-[10px] text-slate-400 uppercase font-black block">Audit Logging</span>
            <span className="text-xs font-bold text-emerald-400">Active & Immutable</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── System Settings (Task Categories & Environment Info) ───────────────
const SystemSettingsView: React.FC = () => {
  const [categories, setCategories] = useState<TaskCategoryItem[]>(() => SettingsService.getAllCategories());
  const [newCatName, setNewCatName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const load = () => {
    setCategories(SettingsService.getAllCategories());
  };

  useEffect(() => {
    load();
    const handleUpdate = () => load();
    window.addEventListener('digi_task_categories_changed', handleUpdate);
    return () => window.removeEventListener('digi_task_categories_changed', handleUpdate);
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      SettingsService.addCategory(newCatName);
      setNewCatName('');
      load();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error adding category');
    }
  };

  const handleRename = (id: string) => {
    setErrorMsg('');
    try {
      SettingsService.renameCategory(id, editName);
      setEditingId(null);
      setEditName('');
      load();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error renaming category');
    }
  };

  const handleArchive = (id: string) => {
    try {
      SettingsService.archiveCategory(id);
      load();
    } catch (err) {}
  };

  const handleUnarchive = (id: string) => {
    try {
      SettingsService.unarchiveCategory(id);
      load();
    } catch (err) {}
  };

  const sysInfo = SettingsService.getSystemInfo();

  return (
    <div className="space-y-5 font-sans">
      {/* Category Manager */}
      <div className="bg-white dark:bg-[#0E1326] border border-slate-200 dark:border-white/10 rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">Task Categories Manager</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage operational task deliverables. Archived categories remain on old tasks but hide from new selections.
            </p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
            {categories.filter(c => !c.isArchived).length} Active
          </span>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {errorMsg}
          </div>
        )}

        {/* Add Form */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            placeholder="New category name (e.g. 3D Animation)..."
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-[#3557FF]"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-[#3557FF] hover:bg-[#2846DF] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Category
          </button>
        </form>

        {/* Category List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          {categories.map(cat => {
            const isEditing = editingId === cat.id;
            return (
              <div
                key={cat.id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                  cat.isArchived
                    ? 'bg-slate-100 dark:bg-white/2 border-slate-200 dark:border-white/5 opacity-60'
                    : 'bg-slate-50 dark:bg-white/4 border-slate-200 dark:border-white/8'
                }`}
              >
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white outline-none"
                    />
                    <button
                      onClick={() => handleRename(cat.id)}
                      className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-md"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-slate-400 hover:text-white text-[10px]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full ${cat.isArchived ? 'bg-slate-400' : 'bg-purple-500'}`} />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {cat.name}
                      </span>
                      {cat.isArchived && (
                        <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-500">
                          Archived
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditingId(cat.id);
                          setEditName(cat.name);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/10"
                        title="Rename category"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      {cat.isArchived ? (
                        <button
                          onClick={() => handleUnarchive(cat.id)}
                          className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/20"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => handleArchive(cat.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                          title="Archive category"
                        >
                          <Archive className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* System Information */}
      <div className="bg-white dark:bg-[#0E1326] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xs space-y-3">
        <h2 className="text-sm font-black text-slate-900 dark:text-white">Live System Environment</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {Object.entries(sysInfo).map(([k, v]) => (
            <div key={k} className="flex justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/3 border border-slate-100 dark:border-white/5">
              <span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
