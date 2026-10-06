import React, { useState, useEffect } from 'react';
import {
  Bell, Check, X, CheckSquare, AlertTriangle, Calendar,
  Film, MessageSquare, ExternalLink, Clock, Sparkles, Megaphone
} from 'lucide-react';
import { NotificationService } from '../../lib/controlPlane/NotificationService';
import { NotificationRecord } from '../../lib/controlPlane/types';
import { useAuth } from '../../context/AuthContext';

interface NotificationsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
}

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({
  isOpen,
  onClose,
  setActiveTab
}) => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);

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

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read_at).length;

  const markAllAsRead = () => {
    NotificationService.markAllAsRead(profile?.role === 'superAdmin' ? undefined : memberId);
    load();
  };

  const handleNotificationClick = (item: NotificationRecord) => {
    if (!item.read_at) {
      NotificationService.markAsRead(item.notification_id);
    }
    if (item.action_tab) {
      setActiveTab(item.action_tab);
    } else if (item.source_type === 'task') {
      setActiveTab('tasks');
    } else if (item.source_type === 'approval') {
      setActiveTab('approvals');
    } else if (item.source_type === 'attendance') {
      setActiveTab('attendance');
    }
    onClose();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'approval': return <CheckSquare className="w-3.5 h-3.5 text-[#6C4CFF]" />;
      case 'overdue': return <AlertTriangle className="w-3.5 h-3.5 text-[#FF5A5F]" />;
      case 'video': return <Film className="w-3.5 h-3.5 text-[#2563FF]" />;
      case 'attendance': return <Clock className="w-3.5 h-3.5 text-[#16A34A]" />;
      case 'announcement': return <Megaphone className="w-3.5 h-3.5 text-amber-400" />;
      default: return <CheckSquare className="w-3.5 h-3.5 text-[#6C4CFF]" />;
    }
  };

  return (
    <div 
      className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl shadow-2xl z-60 overflow-hidden animate-in fade-in-50 zoom-in-95 font-sans"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#D8DEE9] dark:border-white/10 bg-[#F7F8FC] dark:bg-[#161B31]">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#6C4CFF]" />
          <h3 className="text-xs font-black text-[#101828] dark:text-white uppercase tracking-wider">
            Notifications
          </h3>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-[#6C4CFF] text-white">
              {unreadCount}
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-[10px] font-bold text-[#6C4CFF] dark:text-[#8068FF] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Check className="w-3 h-3" /> Mark all read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-[#D8DEE9]/60 dark:divide-white/5">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#7A8496]">
            <p className="font-bold text-[#101828] dark:text-white">All caught up!</p>
            <p className="text-[11px] mt-0.5">No new notifications.</p>
          </div>
        ) : (
          notifications.slice(0, 15).map(item => {
            const isUnread = !item.read_at;
            return (
              <div
                key={item.notification_id}
                onClick={() => handleNotificationClick(item)}
                className={`p-3.5 hover:bg-[#F7F8FC] dark:hover:bg-white/5 transition-colors cursor-pointer flex items-start gap-3 group ${
                  isUnread ? 'bg-[#6C4CFF]/5 dark:bg-[#6C4CFF]/10' : ''
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-[#EEF1F7] dark:bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  {getTypeIcon(item.type)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-[#101828] dark:text-white truncate group-hover:text-[#6C4CFF] transition-colors">
                      {item.title}
                    </h4>
                    <span className="text-[9px] text-[#7A8496] shrink-0 font-medium">
                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#475467] dark:text-[#AEB3C5] line-clamp-2 mt-0.5 leading-relaxed">
                    {item.message}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-2.5 border-t border-[#D8DEE9] dark:border-white/10 bg-[#F7F8FC] dark:bg-[#161B31] text-center">
        <button
          onClick={() => {
            setActiveTab('notifications');
            onClose();
          }}
          className="text-xs font-bold text-[#6C4CFF] dark:text-[#8068FF] hover:underline cursor-pointer"
        >
          View Full Notification Center →
        </button>
      </div>
    </div>
  );
};

export default NotificationsDropdown;
