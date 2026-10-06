import { collection, addDoc, getDocs, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AuditRecord, WorkspaceEvent } from './types';

const AUDIT_STORAGE_KEY = 'digi_audit_records_v1';

export class AuditService {
  private static localCache: AuditRecord[] = [];
  private static isInitialized = false;

  public static init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    try {
      const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (raw) {
        this.localCache = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Could not read local audit cache:', e);
    }

    // Subscribe to Firestore auditLogs if available
    try {
      const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(300));
      onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const remoteRecords: AuditRecord[] = snap.docs.map(doc => {
            const data = doc.data();
            return {
              audit_id: doc.id,
              workspace_id: data.workspace_id || 'default_workspace',
              event_id: data.event_id || doc.id,
              actor_id: data.actor_id || data.actorId || 'system',
              actor_name: data.actor_name || data.actor || 'System Actor',
              actor_role: data.actor_role || data.actorRole || 'admin',
              action: data.action || 'Unknown Action',
              module: data.module || 'System',
              entity_type: data.entity_type || 'task',
              entity_id: data.entity_id || data.target || '',
              description: data.description || data.action || '',
              before_summary: data.before_summary || data.previousValue,
              after_summary: data.after_summary || data.newValue,
              metadata: data.metadata || {},
              created_at: data.created_at || data.timestamp || new Date().toISOString()
            };
          });

          // Merge unique by audit_id / event_id
          const map = new Map<string, AuditRecord>();
          for (const item of [...remoteRecords, ...this.localCache]) {
            const key = item.audit_id || item.event_id;
            if (key && !map.has(key)) {
              map.set(key, item);
            }
          }
          this.localCache = Array.from(map.values()).sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          this.persistCache();
          window.dispatchEvent(new CustomEvent('digi_audit_updated', { detail: this.localCache }));
        }
      }, (err) => {
        console.warn('AuditLog snapshot notice:', err);
      });
    } catch (e) {
      console.warn('Firestore Audit subscription notice:', e);
    }
  }

  public static async recordEvent(event: WorkspaceEvent, customDescription?: string): Promise<AuditRecord> {
    this.init();

    // Human readable action descriptions
    const actionLabel = this.formatActionLabel(event.event_type);
    const moduleName = this.resolveModuleName(event.entity_type, event.event_type);

    const record: AuditRecord = {
      audit_id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      workspace_id: event.workspace_id,
      event_id: event.event_id,
      actor_id: event.actor_id,
      actor_name: event.actor_name,
      actor_role: event.actor_role,
      action: actionLabel,
      module: moduleName,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      description: customDescription || `${event.actor_name} (${event.actor_role}) performed ${actionLabel} on ${event.entity_type} ${event.entity_id}`,
      before_summary: event.metadata?.before ? JSON.stringify(event.metadata.before).substring(0, 150) : undefined,
      after_summary: event.metadata?.after ? JSON.stringify(event.metadata.after).substring(0, 150) : undefined,
      metadata: event.metadata || {},
      created_at: event.timestamp || new Date().toISOString()
    };

    // Prepend to local cache immediately
    this.localCache.unshift(record);
    if (this.localCache.length > 500) this.localCache.pop();
    this.persistCache();

    window.dispatchEvent(new CustomEvent('digi_audit_updated', { detail: this.localCache }));

    // Persist to Firestore asynchronously
    try {
      await addDoc(collection(db, 'auditLogs'), {
        ...record,
        actor: record.actor_name,
        actorRole: record.actor_role,
        target: record.entity_id,
        timestamp: record.created_at
      });
    } catch (e) {
      console.warn('Firestore write for audit log fallback to local:', e);
    }

    // Also persist to server endpoint if running
    try {
      fetch('/api/system/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      }).catch(() => {});
    } catch (e) {}

    return record;
  }

  public static getRecords(): AuditRecord[] {
    this.init();
    return [...this.localCache];
  }

  public static exportCSV(records: AuditRecord[]): string {
    const headers = ['Timestamp', 'Actor', 'Role', 'Action', 'Module', 'Entity Type', 'Entity ID', 'Description'];
    const rows = records.map(r => [
      `"${r.created_at}"`,
      `"${(r.actor_name || '').replace(/"/g, '""')}"`,
      `"${(r.actor_role || '').replace(/"/g, '""')}"`,
      `"${(r.action || '').replace(/"/g, '""')}"`,
      `"${(r.module || '').replace(/"/g, '""')}"`,
      `"${(r.entity_type || '').replace(/"/g, '""')}"`,
      `"${(r.entity_id || '').replace(/"/g, '""')}"`,
      `"${(r.description || '').replace(/"/g, '""')}"`
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  private static persistCache() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(this.localCache.slice(0, 200)));
      }
    } catch (e) {}
  }

  private static formatActionLabel(eventType: string): string {
    const parts = eventType.split('.');
    if (parts.length === 2) {
      const verb = parts[1].replace(/_/g, ' ');
      return verb.charAt(0).toUpperCase() + verb.slice(1);
    }
    return eventType;
  }

  private static resolveModuleName(entityType: string, eventType: string): string {
    switch (entityType) {
      case 'task': return 'Tasks & Work';
      case 'employee': return 'Employees';
      case 'attendance': return 'Attendance & Leaves';
      case 'hr_document': return 'HR Documents';
      case 'payroll': return 'Payroll';
      case 'approval': return 'Approvals';
      case 'content': return 'Content Calendar';
      case 'video': return 'Video Production';
      case 'report': return 'Reports';
      case 'permissions': return 'Roles & Permissions';
      case 'settings':
      case 'category':
      case 'announcement': return 'Settings';
      default: return 'System';
    }
  }
}
