import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  Search, Command, Bell, Sun, Moon, Plus, ChevronDown,
  CheckSquare, Zap, Calendar, Film, Briefcase, User, LogOut,
  Shield, Menu, Check, Eye, X
} from 'lucide-react';
import { NotificationsDropdown } from './NotificationsDropdown';
import { NotificationService } from '../../lib/controlPlane/NotificationService';
import { PermissionService } from '../../lib/controlPlane/PermissionService';
import { CanonicalRole } from '../../lib/controlPlane/types';

interface TopbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCommandPalette: () => void;
  onOpenSidebar: () => void;
  onOpenCreateTask?: () => void;
  onOpenCreateWorkLog?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenCommandPalette,
  onOpenSidebar,
  onOpenCreateTask,
  onOpenCreateWorkLog,
}) => {
  const { profile, user, signOutUser } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [previewRole, setPreviewRole] = useState<CanonicalRole | null>(() => PermissionService.getPreviewRole());

  const notifRef = useRef<HTMLDivElement>(null);
  const quickCreateRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Unread count sync
  useEffect(() => {
    const memberId = profile?.userId || 'admin';
    const updateCount = () => {
      const count = NotificationService.getUnreadCount(profile?.role === 'superAdmin' ? undefined : memberId);
      setUnreadCount(count);
    };
    updateCount();

    const notifHandler = () => updateCount();
    const previewHandler = () => setPreviewRole(PermissionService.getPreviewRole());

    window.addEventListener('digi_notifications_updated', notifHandler);
    window.addEventListener('digi_preview_role_changed', previewHandler);
    return () => {
      window.removeEventListener('digi_notifications_updated', notifHandler);
      window.removeEventListener('digi_preview_role_changed', previewHandler);
    };
  }, [profile]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (notifRef.current && !notifRef.current.contains(target)) {
        setIsNotifOpen(false);
      }
      if (quickCreateRef.current && !quickCreateRef.current.contains(target)) {
        setIsQuickCreateOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(target)) {
        setIsThemeMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAdmin = profile?.role === 'superAdmin' || profile?.role === 'admin';

  return (
    <>
      {/* Preview as Role Banner */}
      {previewRole && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-1.5 flex items-center justify-between text-xs font-bold shadow-md z-50 sticky top-0">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 animate-pulse" />
            <span>
              PREVIEW MODE ACTIVE: Viewing Agency OS through the permission scope of <strong>{previewRole.toUpperCase()}</strong>.
            </span>
          </div>
          <button
            onClick={() => PermissionService.setPreviewRole(null)}
            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white px-2.5 py-0.5 rounded-lg text-[11px] font-black transition-all cursor-pointer"
          >
            <X className="w-3 h-3" /> Exit Preview
          </button>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#090D18]/95 backdrop-blur-md border-b border-[#D7DEE9] dark:border-[#293248] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 font-sans transition-colors duration-200">
        {/* Left: Mobile Toggle & Global Search Pill */}
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <button
            onClick={onOpenSidebar}
            className="lg:hidden p-2 rounded-xl text-[#475467] dark:text-[#BAC1D1] hover:bg-[#EEF1F6] dark:hover:bg-[#171E31]"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Global Omnibar Search Button */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="flex items-center justify-between gap-2 w-full max-w-md px-3 py-2 bg-[#F7F8FC] dark:bg-[#111728] hover:bg-[#EEF1F6] dark:hover:bg-[#171E31] text-[#7A8496] dark:text-[#828BA1] border border-[#D7DEE9] dark:border-[#293248] rounded-xl text-xs font-semibold shadow-2xs transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Search className="w-4 h-4 shrink-0 text-[#5B4BFF] dark:text-[#806CFF] group-hover:scale-105 transition-transform" />
              <span className="truncate hidden sm:inline">Search clients, tasks, employees (Ctrl+K)...</span>
              <span className="truncate sm:hidden">Search...</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-bold text-[#7A8496] bg-white dark:bg-[#171E31] border border-[#D7DEE9] dark:border-[#293248] rounded-md shadow-2xs">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right: Quick Actions, Theme Toggle, Notifications & Profile */}
        <div className="flex items-center gap-2.5">
          {/* Global +Create Dropdown */}
          <div className="relative" ref={quickCreateRef}>
            <button
              onClick={() => setIsQuickCreateOpen(!isQuickCreateOpen)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#5B4BFF] hover:bg-[#4E3FE6] dark:bg-[#806CFF] dark:hover:bg-[#725DEF] text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            </button>

            {isQuickCreateOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-[#111728] border border-[#D7DEE9] dark:border-[#293248] rounded-xl shadow-2xl z-50 py-1.5 animate-in fade-in-50 zoom-in-95">
                <div className="px-3.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#7A8496] dark:text-[#828BA1]">
                  Global +Create Menu
                </div>
                <button
                  onClick={() => {
                    setIsQuickCreateOpen(false);
                    if (onOpenCreateTask) onOpenCreateTask();
                    else setActiveTab('tasks');
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#101828] dark:text-[#F7F8FC] hover:bg-[#EEECFF] dark:hover:bg-[#201D45] hover:text-[#5B4BFF] dark:hover:text-[#806CFF] flex items-center gap-2.5 cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-[#2864FF]" />
                  <span>New Task</span>
                </button>
                <button
                  onClick={() => {
                    setIsQuickCreateOpen(false);
                    if (onOpenCreateWorkLog) onOpenCreateWorkLog();
                    else setActiveTab('worklog');
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#101828] dark:text-[#F7F8FC] hover:bg-[#EEECFF] dark:hover:bg-[#201D45] hover:text-[#5B4BFF] dark:hover:text-[#806CFF] flex items-center gap-2.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-[#7C3AED]" />
                  <span>Manual Work Log</span>
                </button>
                <button
                  onClick={() => { setIsQuickCreateOpen(false); setActiveTab('calendar'); }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#101828] dark:text-[#F7F8FC] hover:bg-[#EEECFF] dark:hover:bg-[#201D45] hover:text-[#5B4BFF] dark:hover:text-[#806CFF] flex items-center gap-2.5 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>Content Item</span>
                </button>
                <button
                  onClick={() => { setIsQuickCreateOpen(false); setActiveTab('videos'); }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#101828] dark:text-[#F7F8FC] hover:bg-[#EEECFF] dark:hover:bg-[#201D45] hover:text-[#5B4BFF] dark:hover:text-[#806CFF] flex items-center gap-2.5 cursor-pointer"
                >
                  <Film className="w-3.5 h-3.5 text-[#DC2626]" />
                  <span>Video Shoot</span>
                </button>
                {isAdmin && (
                  <>
                    <div className="border-t border-[#D7DEE9] dark:border-[#293248] my-1" />
                    <button
                      onClick={() => { setIsQuickCreateOpen(false); setActiveTab('clients'); }}
                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#101828] dark:text-[#F7F8FC] hover:bg-[#EEECFF] dark:hover:bg-[#201D45] hover:text-[#5B4BFF] dark:hover:text-[#806CFF] flex items-center gap-2.5 cursor-pointer"
                    >
                      <Briefcase className="w-3.5 h-3.5 text-[#2864FF]" />
                      <span>Client</span>
                    </button>
                    <button
                      onClick={() => { setIsQuickCreateOpen(false); setActiveTab('admins'); }}
                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#101828] dark:text-[#F7F8FC] hover:bg-[#EEECFF] dark:hover:bg-[#201D45] hover:text-[#5B4BFF] dark:hover:text-[#806CFF] flex items-center gap-2.5 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-[#5B4BFF]" />
                      <span>Employee</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Theme Selector (Light, Dark, System) */}
          <div className="relative" ref={themeMenuRef}>
            <button
              type="button"
              onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
              title={`Current Theme: ${theme.toUpperCase()}`}
              className="p-2 rounded-xl text-[#475467] dark:text-[#BAC1D1] hover:bg-[#EEF1F6] dark:hover:bg-[#171E31] border border-[#D7DEE9] dark:border-[#293248] transition-colors cursor-pointer"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-[#5B4BFF]" />
              )}
            </button>

            {isThemeMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-36 bg-white dark:bg-[#111728] border border-[#D7DEE9] dark:border-[#293248] rounded-xl shadow-2xl z-50 py-1 text-xs animate-in fade-in-50 zoom-in-95">
                <button
                  onClick={() => { setTheme('light'); setIsThemeMenuOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between font-bold cursor-pointer ${
                    theme === 'light' ? 'text-[#5B4BFF] dark:text-[#806CFF] bg-[#EEECFF] dark:bg-[#201D45]' : 'text-[#101828] dark:text-[#F7F8FC] hover:bg-[#EEF1F6] dark:hover:bg-[#171E31]'
                  }`}
                >
                  <span>Light</span>
                  {theme === 'light' && <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => { setTheme('dark'); setIsThemeMenuOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between font-bold cursor-pointer ${
                    theme === 'dark' ? 'text-[#5B4BFF] dark:text-[#806CFF] bg-[#EEECFF] dark:bg-[#201D45]' : 'text-[#101828] dark:text-[#F7F8FC] hover:bg-[#EEF1F6] dark:hover:bg-[#171E31]'
                  }`}
                >
                  <span>Dark</span>
                  {theme === 'dark' && <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => { setTheme('system'); setIsThemeMenuOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between font-bold cursor-pointer ${
                    theme === 'system' ? 'text-[#5B4BFF] dark:text-[#806CFF] bg-[#EEECFF] dark:bg-[#201D45]' : 'text-[#101828] dark:text-[#F7F8FC] hover:bg-[#EEF1F6] dark:hover:bg-[#171E31]'
                  }`}
                >
                  <span>System</span>
                  {theme === 'system' && <Check className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          {/* Notifications Dropdown Trigger */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="p-2 rounded-xl text-[#475467] dark:text-[#BAC1D1] hover:bg-[#EEF1F6] dark:hover:bg-[#171E31] border border-[#D7DEE9] dark:border-[#293248] transition-colors relative cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#5B4BFF] text-white text-[10px] font-black flex items-center justify-center shadow-md animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            <NotificationsDropdown
              isOpen={isNotifOpen}
              onClose={() => setIsNotifOpen(false)}
              setActiveTab={setActiveTab}
            />
          </div>

          {/* Profile Avatar / Menu */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-[#EEF1F6] dark:hover:bg-[#171E31] transition-colors border border-transparent hover:border-[#D7DEE9] dark:hover:border-[#293248] cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#5B4BFF] to-[#2864FF] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {profile?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold text-[#101828] dark:text-[#F7F8FC] leading-none">
                  {profile?.name || user?.email?.split('@')[0] || 'Member'}
                </p>
                <span className="text-[10px] font-bold text-[#5B4BFF] dark:text-[#806CFF] uppercase">
                  {profile?.role === 'superAdmin' ? 'Super Admin' : profile?.role || 'User'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#7A8496]" />
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-[#111728] border border-[#D7DEE9] dark:border-[#293248] rounded-xl shadow-2xl z-50 py-1.5 animate-in fade-in-50 zoom-in-95">
                <div className="px-3.5 py-2 border-b border-[#D7DEE9] dark:border-[#293248]">
                  <p className="text-xs font-bold text-[#101828] dark:text-white truncate">{profile?.name || 'Logged User'}</p>
                  <p className="text-[10px] text-[#7A8496] truncate">{profile?.email || user?.email}</p>
                </div>

                <button
                  onClick={() => { setIsProfileMenuOpen(false); setActiveTab('myday'); }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#101828] dark:text-[#F7F8FC] hover:bg-[#EEF2FF] dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-[#6C4CFF]" />
                  <span>My Day Workspace</span>
                </button>
                <button
                  onClick={() => { setIsProfileMenuOpen(false); setActiveTab('settings'); }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#101828] dark:text-[#F7F8FC] hover:bg-[#EEF2FF] dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5 text-[#2563FF]" />
                  <span>Account Settings</span>
                </button>

                <div className="border-t border-[#D8DEE9]/60 dark:border-white/10 mt-1 pt-1">
                  <button
                    onClick={signOutUser}
                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
};

export default Topbar;
