import { collection, addDoc, getDocs, query, where, orderBy, limit, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { NotificationRecord, NotificationPreferences, WorkspaceEvent } from './types';

const NOTIF_STORAGE_KEY = 'digi_notifications_v1';
const PREFS_STORAGE_KEY = 'digi_user_notification_prefs_v1';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  taskAssigned: true,
  deadlineApproach: true,
  taskOverdue: true,
  leaveStatus: true,
  clientApproval: true,
  announcements: true,
};

export class NotificationService {
  private static localNotifications: NotificationRecord[] = [];
  private static isInitialized = false;
  private static processedIdempotencyKeys = new Set<string>();

  public static init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    try {
      const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
      if (raw) {
        this.localNotifications = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Could not read local notifications:', e);
    }

    // Subscribe to Firestore notifications if available
    try {
      const q = query(collection(db, 'notifications'), orderBy('created_at', 'desc'), limit(150));
      onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const remoteRecords: NotificationRecord[] = snap.docs.map(doc => {
            const data = doc.data();
            return {
              notification_id: doc.id,
              recipient_member_id: data.recipient_member_id || data.recipientId || '',
              event_id: data.event_id || doc.id,
              type: data.type || 'task',
              title: data.title || '',
              message: data.message || '',
              source_type: data.source_type || 'task',
              source_id: data.source_id || '',
              client_id: data.client_id,
              read_at: data.read_at || null,
              created_at: data.created_at || new Date().toISOString(),
              action_tab: data.action_tab || 'tasks'
            };
          });

          // Merge with local cache
          const map = new Map<string, NotificationRecord>();
          for (const item of [...remoteRecords, ...this.localNotifications]) {
            const key = item.notification_id || item.event_id;
            if (key && !map.has(key)) {
              map.set(key, item);
            }
          }
          this.localNotifications = Array.from(map.values()).sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          this.persistCache();
          this.broadcastUpdate();
        }
      }, (err) => {
        console.warn('Notifications snapshot notice:', err);
      });
    } catch (e) {
      console.warn('Firestore Notifications subscription notice:', e);
    }
  }

  public static getPreferences(memberId?: string): NotificationPreferences {
    if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_PREFERENCES;
    try {
      const key = memberId ? `${PREFS_STORAGE_KEY}_${memberId}` : PREFS_STORAGE_KEY;
      const raw = localStorage.getItem(key);
      if (raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(raw) };
    } catch (e) {}
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  public static setPreferences(prefs: NotificationPreferences, memberId?: string) {
    if (typeof window === 'undefined') return;
    try {
      const key = memberId ? `${PREFS_STORAGE_KEY}_${memberId}` : PREFS_STORAGE_KEY;
      localStorage.setItem(key, JSON.stringify(prefs));
      window.dispatchEvent(new CustomEvent('digi_notification_prefs_changed', { detail: prefs }));
    } catch (e) {}
  }

  public static async processEvent(event: WorkspaceEvent): Promise<NotificationRecord[]> {
    this.init();

    // Prevent duplicate event handling
    if (this.processedIdempotencyKeys.has(event.idempotency_key)) {
      return [];
    }
    this.processedIdempotencyKeys.add(event.idempotency_key);

    const generatedNotifications: NotificationRecord[] = [];
    const recipients = event.target_member_ids || [];

    // Helper to test if preference allows notification
    const isAllowed = (recipientId: string, prefKey: keyof NotificationPreferences): boolean => {
      const prefs = this.getPreferences(recipientId);
      return prefs[prefKey] ?? true;
    };

    switch (event.event_type) {
      case 'task.assigned':
      case 'task.reassigned': {
        for (const recipient of recipients) {
          if (!recipient) continue;
          if (!isAllowed(recipient, 'taskAssigned')) continue;

          const title = event.event_type === 'task.assigned' 
            ? `New Task Assigned: ${event.metadata?.taskTitle || event.entity_id}`
            : `Task Reassigned: ${event.metadata?.taskTitle || event.entity_id}`;
          
          const notif: NotificationRecord = {
            notification_id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            recipient_member_id: recipient,
            event_id: event.event_id,
            type: 'task',
            title,
            message: event.metadata?.clientName 
              ? `Client: ${event.metadata.clientName} · Due: ${event.metadata?.dueDate || 'Not set'}`
              : `Assigned by ${event.actor_name}`,
            source_type: 'task',
            source_id: event.entity_id,
            client_id: event.client_id,
            read_at: null,
            created_at: event.timestamp || new Date().toISOString(),
            action_tab: 'tasks'
          };
          generatedNotifications.push(notif);
        }
        break;
      }

      case 'task.deadline_approaching': {
        for (const recipient of recipients) {
          if (!recipient) continue;
          if (!isAllowed(recipient, 'deadlineApproach')) continue;

          generatedNotifications.push({
            notification_id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            recipient_member_id: recipient,
            event_id: event.event_id,
            type: 'overdue',
            title: `Deadline Approaching: ${event.metadata?.taskTitle || event.entity_id}`,
            message: `Task is due today (${event.metadata?.dueDate || 'soon'}). Please complete or update status.`,
            source_type: 'task',
            source_id: event.entity_id,
            client_id: event.client_id,
            read_at: null,
            created_at: event.timestamp || new Date().toISOString(),
            action_tab: 'tasks'
          });
        }
        break;
      }

      case 'task.overdue': {
        for (const recipient of recipients) {
          if (!recipient) continue;
          if (!isAllowed(recipient, 'taskOverdue')) continue;

          generatedNotifications.push({
            notification_id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            recipient_member_id: recipient,
            event_id: event.event_id,
            type: 'overdue',
            title: `Task Overdue: ${event.metadata?.taskTitle || event.entity_id}`,
            message: `Task was due on ${event.metadata?.dueDate || 'earlier date'} and remains incomplete.`,
            source_type: 'task',
            source_id: event.entity_id,
            client_id: event.client_id,
            read_at: null,
            created_at: event.timestamp || new Date().toISOString(),
            action_tab: 'tasks'
          });
        }
        break;
      }

      case 'leave.approved':
      case 'leave.rejected': {
        for (const recipient of recipients) {
          if (!recipient) continue;
          if (!isAllowed(recipient, 'leaveStatus')) continue;

          const isApproved = event.event_type === 'leave.approved';
          generatedNotifications.push({
            notification_id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            recipient_member_id: recipient,
            event_id: event.event_id,
            type: 'attendance',
            title: isApproved ? 'Leave Request Approved' : 'Leave Request Rejected',
            message: `Your leave request for ${event.metadata?.dateRange || 'requested dates'} was ${isApproved ? 'approved' : 'rejected'} by ${event.actor_name}.`,
            source_type: 'attendance',
            source_id: event.entity_id,
            read_at: null,
            created_at: event.timestamp || new Date().toISOString(),
            action_tab: 'attendance'
          });
        }
        break;
      }

      case 'content.approved':
      case 'content.revision_requested': {
        for (const recipient of recipients) {
          if (!recipient) continue;
          if (!isAllowed(recipient, 'clientApproval')) continue;

          const isApp = event.event_type === 'content.approved';
          generatedNotifications.push({
            notification_id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            recipient_member_id: recipient,
            event_id: event.event_id,
            type: 'approval',
            title: isApp ? `Creative Approved: ${event.metadata?.title || 'Deliverable'}` : `Revision Requested: ${event.metadata?.title || 'Deliverable'}`,
            message: event.metadata?.feedback || (isApp ? 'Client approved creative for publication' : 'Changes requested by client'),
            source_type: 'approval',
            source_id: event.entity_id,
            client_id: event.client_id,
            read_at: null,
            created_at: event.timestamp || new Date().toISOString(),
            action_tab: 'approvals'
          });
        }
        break;
      }

      case 'announcement.published': {
        for (const recipient of recipients) {
          if (!recipient) continue;
          if (!isAllowed(recipient, 'announcements')) continue;

          generatedNotifications.push({
            notification_id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            recipient_member_id: recipient,
            event_id: event.event_id,
            type: 'announcement',
            title: event.metadata?.title || 'Team Announcement',
            message: event.metadata?.message || 'New company announcement published.',
            source_type: 'announcement',
            source_id: event.entity_id,
            read_at: null,
            created_at: event.timestamp || new Date().toISOString(),
            action_tab: 'notifications'
          });
        }
        break;
      }
    }

    // Save and broadcast
    for (const notif of generatedNotifications) {
      this.localNotifications.unshift(notif);
      
      // Async write to Firestore
      try {
        addDoc(collection(db, 'notifications'), notif).catch(() => {});
      } catch (e) {}

      // Server endpoint sync
      try {
        fetch('/api/system/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notif)
        }).catch(() => {});
      } catch (e) {}
    }

    if (generatedNotifications.length > 0) {
      this.persistCache();
      this.broadcastUpdate();
    }

    return generatedNotifications;
  }

  public static getNotifications(filterRecipientId?: string): NotificationRecord[] {
    this.init();
    if (!filterRecipientId) {
      return [...this.localNotifications];
    }
    return this.localNotifications.filter(n => 
      !n.recipient_member_id || 
      n.recipient_member_id === filterRecipientId || 
      n.recipient_member_id === 'all' || 
      n.recipient_member_id === 'team'
    );
  }

  public static getUnreadCount(filterRecipientId?: string): number {
    return this.getNotifications(filterRecipientId).filter(n => !n.read_at).length;
  }

  public static markAsRead(notificationId: string) {
    this.init();
    const now = new Date().toISOString();
    this.localNotifications = this.localNotifications.map(n => 
      n.notification_id === notificationId ? { ...n, read_at: now } : n
    );
    this.persistCache();
    this.broadcastUpdate();

    try {
      updateDoc(doc(db, 'notifications', notificationId), { read_at: now }).catch(() => {});
    } catch (e) {}
  }

  public static markAsUnread(notificationId: string) {
    this.init();
    this.localNotifications = this.localNotifications.map(n => 
      n.notification_id === notificationId ? { ...n, read_at: null } : n
    );
    this.persistCache();
    this.broadcastUpdate();

    try {
      updateDoc(doc(db, 'notifications', notificationId), { read_at: null }).catch(() => {});
    } catch (e) {}
  }

  public static markAllAsRead(filterRecipientId?: string) {
    this.init();
    const now = new Date().toISOString();
    this.localNotifications = this.localNotifications.map(n => {
      if (!filterRecipientId || n.recipient_member_id === filterRecipientId || !n.recipient_member_id) {
        return { ...n, read_at: now };
      }
      return n;
    });
    this.persistCache();
    this.broadcastUpdate();
  }

  public static deleteNotification(notificationId: string) {
    this.init();
    this.localNotifications = this.localNotifications.filter(n => n.notification_id !== notificationId);
    this.persistCache();
    this.broadcastUpdate();

    try {
      deleteDoc(doc(db, 'notifications', notificationId)).catch(() => {});
    } catch (e) {}
  }

  private static persistCache() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(this.localNotifications.slice(0, 200)));
      }
    } catch (e) {}
  }

  private static broadcastUpdate() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('digi_notifications_updated', {
        detail: {
          notifications: this.localNotifications,
          unreadCount: this.localNotifications.filter(n => !n.read_at).length
        }
      }));
    }
  }
}
