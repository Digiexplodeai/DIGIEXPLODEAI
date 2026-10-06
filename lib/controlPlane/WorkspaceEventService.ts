import { WorkspaceEvent, DomainEventType, EntityType } from './types';
import { AuditService } from './AuditService';
import { NotificationService } from './NotificationService';

export interface EmitEventParams {
  eventType: DomainEventType;
  entityType: EntityType;
  entityId: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  clientId?: string;
  targetMemberIds?: string[];
  metadata?: Record<string, any>;
  customDescription?: string;
  idempotencyKey?: string;
  workspaceId?: string;
}

export class WorkspaceEventService {
  private static isInitialized = false;

  public static init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    AuditService.init();
    NotificationService.init();
  }

  public static async emit(params: EmitEventParams): Promise<WorkspaceEvent> {
    this.init();

    // Default current user actor if running in browser
    let defaultActorId = params.actorId || 'system';
    let defaultActorName = params.actorName || 'System';
    let defaultActorRole = params.actorRole || 'admin';

    if (typeof window !== 'undefined' && (!params.actorId || !params.actorName)) {
      try {
        const demo = localStorage.getItem('digi_demo_profile');
        if (demo) {
          const parsed = JSON.parse(demo);
          defaultActorId = params.actorId || parsed.userId || 'admin';
          defaultActorName = params.actorName || parsed.name || 'Digiexplode Admin';
          defaultActorRole = params.actorRole || parsed.role || 'superAdmin';
        }
      } catch (e) {}
    }

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const idempotencyKey = params.idempotencyKey || `${params.eventType}_${params.entityId}_${Date.now()}`;

    const event: WorkspaceEvent = {
      event_id: eventId,
      event_type: params.eventType,
      workspace_id: params.workspaceId || 'default_workspace',
      actor_id: defaultActorId,
      actor_name: defaultActorName,
      actor_role: defaultActorRole,
      entity_type: params.entityType,
      entity_id: params.entityId,
      client_id: params.clientId,
      target_member_ids: params.targetMemberIds || [],
      timestamp: new Date().toISOString(),
      metadata: params.metadata || {},
      idempotency_key: idempotencyKey,
    };

    // 1. Audit Log Recording
    try {
      await AuditService.recordEvent(event, params.customDescription);
    } catch (e) {
      console.warn('Audit record error:', e);
    }

    // 2. Notification Dispatch
    try {
      await NotificationService.processEvent(event);
    } catch (e) {
      console.warn('Notification processing error:', e);
    }

    // 3. Broadcast to Application Window
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('workspace_event_emitted', { detail: event }));
    }

    // 4. Async sync with server event bus if reachable
    try {
      fetch('/api/system/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      }).catch(() => {});
    } catch (e) {}

    return event;
  }
}
