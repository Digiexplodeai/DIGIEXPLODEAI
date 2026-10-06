export type CanonicalRole = 'superAdmin' | 'admin' | 'teamLeader' | 'employee' | 'hr' | 'accounts' | 'client';

export type CanonicalAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';

export type EntityType = 
  | 'task' 
  | 'employee' 
  | 'content' 
  | 'video' 
  | 'approval' 
  | 'work_log' 
  | 'attendance' 
  | 'hr_document' 
  | 'payroll' 
  | 'report' 
  | 'settings' 
  | 'permissions'
  | 'announcement'
  | 'category';

export type DomainEventType =
  // Tasks
  | 'task.created'
  | 'task.assigned'
  | 'task.reassigned'
  | 'task.status_changed'
  | 'task.completed'
  | 'task.overdue'
  | 'task.deleted'
  | 'task.deadline_approaching'
  // Content
  | 'content.created'
  | 'content.assigned'
  | 'content.submitted_for_review'
  | 'content.approved'
  | 'content.revision_requested'
  | 'content.scheduled'
  | 'content.published'
  // Video
  | 'video.created'
  | 'video.shoot_assigned'
  | 'video.shot'
  | 'video.editor_assigned'
  | 'video.in_review'
  | 'video.finished'
  // Employees
  | 'employee.created'
  | 'employee.updated'
  | 'employee.deactivated'
  | 'employee.reactivated'
  | 'employee.role_changed'
  // Attendance & Leaves
  | 'attendance.checked_in'
  | 'attendance.checked_out'
  | 'attendance.admin_override'
  | 'leave.requested'
  | 'leave.approved'
  | 'leave.rejected'
  // HR & Payroll
  | 'hr_document.generated'
  | 'hr_document.finalized'
  | 'hr_document.emailed'
  | 'hr_document.revoked'
  | 'payroll.generated'
  | 'payroll.finalized'
  | 'payroll.marked_paid'
  // Reports
  | 'report.generated'
  | 'report.finalized'
  | 'report.pdf_regenerated'
  | 'report.deleted'
  // System
  | 'permissions.updated'
  | 'settings.updated'
  | 'task_category.created'
  | 'task_category.updated'
  | 'task_category.deleted'
  | 'task_category.archived'
  | 'announcement.published';

export interface WorkspaceEvent {
  event_id: string;
  event_type: DomainEventType;
  workspace_id: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  entity_type: EntityType;
  entity_id: string;
  client_id?: string;
  target_member_ids?: string[];
  timestamp: string;
  metadata?: Record<string, any>;
  idempotency_key: string;
}

export interface NotificationRecord {
  notification_id: string;
  recipient_member_id: string;
  event_id: string;
  type: string;
  title: string;
  message: string;
  source_type: EntityType;
  source_id: string;
  client_id?: string;
  read_at: string | null;
  created_at: string;
  action_tab?: string;
}

export interface NotificationPreferences {
  taskAssigned: boolean;
  deadlineApproach: boolean;
  taskOverdue: boolean;
  leaveStatus: boolean;
  clientApproval: boolean;
  announcements: boolean;
}

export interface AuditRecord {
  audit_id: string;
  workspace_id: string;
  event_id: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  module: string;
  entity_type: EntityType;
  entity_id: string;
  description: string;
  before_summary?: string;
  after_summary?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface PermissionScope {
  tasksView?: 'own' | 'team' | 'all';
  tasksEdit?: 'own_or_assigned' | 'team' | 'all';
  workLogView?: 'own' | 'team' | 'all';
  contentView?: 'own_client' | 'all';
  reportsView?: 'own_client' | 'all';
}

export interface RolePermissions {
  [module: string]: {
    [role in CanonicalRole]?: {
      [action in CanonicalAction]?: boolean;
    };
  };
}

export interface AppearancePreferences {
  mode: 'particles' | 'aurora' | 'cyber' | 'cosmic' | 'off';
  speed: number;
  theme: 'cyber' | 'emerald' | 'sunset';
  density: number;
  reducedMotion: boolean;
  isWorkspaceDefault?: boolean;
}

export interface TaskCategoryItem {
  id: string;
  name: string;
  color?: string;
  isArchived?: boolean;
  createdAt: string;
  updatedAt?: string;
}
