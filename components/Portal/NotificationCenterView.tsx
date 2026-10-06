import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Bell, Check, CheckCheck, Trash2, CheckSquare, AlertTriangle,
  Clock, Film, MessageSquare, Send, Sparkles, Filter, ExternalLink,
  ShieldAlert, RefreshCw, X, Radio, Megaphone
} from 'lucide-react';
import { NotificationService } from '../../lib/controlPlane/NotificationService';
import { NotificationRecord } from '../../lib/controlPlane/types';
import { WorkspaceEventService } from '../../lib/controlPlane/WorkspaceEventService';

interface NotificationCenterViewProps {
  setActiveTab?: (tab: string) => void;
}

type TabCategory = 'all' | 'unread' | 'task' | 'approval' | 'attendance' | 'system';

export const NotificationCenterView: React.FC<NotificationCenterViewProps> = ({ setActiveTab }) => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [activeTab, setActiveTabFilter] = useState<TabCategory>('all');
  const [search, setSearch] = useState('');
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementAudience, setAnnouncementAudience] = useState<'all' | 'employees' | 'clients'>('all');
  const [isPublishing, setIsPublishing] = useState(false);

  const isSuperAdminOrAdmin = profile?.role === 'superAdmin' || profile?.role === 'admin';
  const memberId = profile?.userId || 'admin';

  const load = () => {
    const list = NotificationService.getNotifications(profile?.role === 'superAdmin' ? undefined : memberId);
    setNotifications(list);
  };

  useEffect(() => {
    load();
    const handleUpdate = () => load();
    window.addEventListener('digi_notifications_updated', handleUpdate);
    return () => window.removeEventListener('digi_notifications_updated', handleUpdate);
  }, [profile]);

  const handleMarkRead = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    NotificationService.markAsRead(id);
    load();
  };

  const handleMarkUnread = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    NotificationService.markAsUnread(id);
    load();
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    NotificationService.deleteNotification(id);
    load();
  };

  const handleMarkAllRead = () => {
    NotificationService.markAllAsRead(profile?.role === 'superAdmin' ? undefined : memberId);
    load();
  };

  const handleOpenNotification = (notif: NotificationRecord) => {
    if (!notif.read_at) {
      NotificationService.markAsRead(notif.notification_id);
    }
    if (setActiveTab) {
      if (notif.action_tab) {
        setActiveTab(notif.action_tab);
      } else if (notif.source_type === 'task') {
        setActiveTab('tasks');
      } else if (notif.source_type === 'approval') {
        setActiveTab('approvals');
      } else if (notif.source_type === 'attendance') {
        setActiveTab('attendance');
      } else if (notif.source_type === 'video') {
        setActiveTab('videos');
      }
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementMessage.trim()) return;

    setIsPublishing(true);
    try {
      await WorkspaceEventService.emit({
        eventType: 'announcement.published',
        entityType: 'announcement',
        entityId: `announcement_${Date.now()}`,
        actorId: profile?.userId || 'admin',
        actorName: profile?.name || 'Super Admin',
        actorRole: profile?.role || 'superAdmin',
        targetMemberIds: ['all', 'team'],
        metadata: {
          title: announcementTitle.trim(),
          message: announcementMessage.trim(),
          audience: announcementAudience
        },
        customDescription: `Published company announcement: "${announcementTitle.trim()}" for ${announcementAudience}`
      });

      setAnnouncementTitle('');
      setAnnouncementMessage('');
      setIsAnnouncementModalOpen(false);
      load();
    } catch (err) {
      console.error('Announcement publish error:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  // Filtering
  const filtered = notifications.filter(n => {
    if (activeTab === 'unread' && n.read_at) return false;
    if (activeTab === 'task' && n.source_type !== 'task') return false;
    if (activeTab === 'approval' && n.source_type !== 'approval') return false;
    if (activeTab === 'attendance' && n.source_type !== 'attendance') return false;
    if (activeTab === 'system' && !['announcement', 'settings', 'permissions'].includes(n.source_type)) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
    }
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read_at).length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'task':
        return <CheckSquare className="w-4 h-4 text-cyan-400" />;
      case 'approval':
        return <Check className="w-4 h-4 text-violet-400" />;
      case 'overdue':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'attendance':
        return <Clock className="w-4 h-4 text-emerald-400" />;
      case 'announcement':
        return <Megaphone className="w-4 h-4 text-amber-400" />;
      default:
        return <Bell className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-4 h-4 text-[#3557FF]" />
            <span className="text-xs font-black uppercase tracking-widest text-[#3557FF]">Platform Control Plane</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Notification Center</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time operational alerts, task assignments, approvals and team announcements
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdminOrAdmin && (
            <button
              onClick={() => setIsAnnouncementModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
            >
              <Megaphone className="w-3.5 h-3.5" /> Broadcast Announcement
            </button>
          )}

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#3557FF]/10 text-[#3557FF] dark:text-[#7B9FFF] border border-[#3557FF]/20 rounded-xl text-xs font-bold hover:bg-[#3557FF]/20 transition-all cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#0E1326] p-3 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All', count: notifications.length },
            { id: 'unread', label: 'Unread', count: unreadCount },
            { id: 'task', label: 'Tasks', count: notifications.filter(n => n.source_type === 'task').length },
            { id: 'approval', label: 'Approvals', count: notifications.filter(n => n.source_type === 'approval').length },
            { id: 'attendance', label: 'HR & Leaves', count: notifications.filter(n => n.source_type === 'attendance').length },
            { id: 'system', label: 'System', count: notifications.filter(n => ['announcement', 'settings', 'permissions'].includes(n.source_type)).length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTabFilter(tab.id as TabCategory)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#3557FF] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  activeTab === tab.id ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="w-full sm:w-64 relative">
          <input
            type="text"
            placeholder="Search alerts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-[#3557FF]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-2 text-[10px] text-slate-400 hover:text-white">✕</button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-[#0E1326] rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#3557FF]/10 text-[#3557FF] flex items-center justify-center mb-3">
              <CheckCheck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">You're all caught up!</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              No pending notifications in this view. As tasks are assigned, approvals requested or leaves updated, they will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {filtered.map(item => {
              const isUnread = !item.read_at;
              return (
                <div
                  key={item.notification_id}
                  onClick={() => handleOpenNotification(item)}
                  className={`p-4 transition-colors flex items-start gap-4 cursor-pointer group ${
                    isUnread
                      ? 'bg-blue-50/50 dark:bg-[#3557FF]/8 hover:bg-blue-100/50 dark:hover:bg-[#3557FF]/14'
                      : 'hover:bg-slate-50 dark:hover:bg-white/3'
                  }`}
                >
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                    {getTypeIcon(item.type)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-[#3557FF] transition-colors">
                          {item.title}
                        </h4>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-[#3557FF] shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {item.message}
                    </p>

                    {item.client_id && (
                      <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        Client: {item.client_id}
                      </span>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    {isUnread ? (
                      <button
                        title="Mark as read"
                        onClick={(e) => handleMarkRead(item.notification_id, e)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 hover:text-emerald-400 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        title="Mark as unread"
                        onClick={(e) => handleMarkUnread(item.notification_id, e)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 hover:text-blue-400 transition-colors"
                      >
                        <Radio className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      title="Dismiss notification"
                      onClick={(e) => handleDelete(item.notification_id, e)}
                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Broadcast Announcement Modal */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Publish Team Announcement</h3>
              </div>
              <button onClick={() => setIsAnnouncementModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePublishAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Announcement Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Growth Meeting & Office Updates"
                  value={announcementTitle}
                  onChange={e => setAnnouncementTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Target Audience
                </label>
                <select
                  value={announcementAudience}
                  onChange={e => setAnnouncementAudience(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-400"
                >
                  <option value="all">Entire Workspace (All Members & Clients)</option>
                  <option value="employees">Internal Team Members Only</option>
                  <option value="clients">Clients Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Message Content
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write announcement details here..."
                  value={announcementMessage}
                  onChange={e => setAnnouncementMessage(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAnnouncementModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPublishing}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md hover:opacity-95 disabled:opacity-50"
                >
                  {isPublishing ? 'Publishing…' : 'Publish to Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenterView;
