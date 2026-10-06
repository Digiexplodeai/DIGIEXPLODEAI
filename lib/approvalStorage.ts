import { 
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, 
  onSnapshot, query, where, orderBy, addDoc 
} from 'firebase/firestore';
import { db } from './firebase';
import { ensureActiveFirebaseAuth, getCachedCalendarEntries } from './calendarStorage';
import { persistUpdateTask, getCachedTasks, type Task } from './taskStorage';
import { syncTaskCompletionToWorkLog } from './taskWorkLogSync';

export type ApprovalSourceType = 'task' | 'content' | 'video';
export type ApprovalStatus = 'pending' | 'approved' | 'revision_requested';

export interface ApprovalHistoryEvent {
  actor_id: string;
  actor_name: string;
  timestamp: string;
  action: 'Submitted for review' | 'Approved' | 'Revision requested' | 'Resubmitted' | 'Approved after revision' | string;
  notes?: string;
}

export interface CanonicalApprovalRecord {
  // Canonical fields
  id: string; // Deterministic ID: `appr_${source_type}_${source_id}`
  approval_id: string;
  source_type: ApprovalSourceType;
  source_id: string;
  client_id: string;
  client_name: string;
  title: string;
  description?: string;

  // Linked entity references
  task_id?: string | null;
  content_item_id?: string | null;
  video_production_id?: string | null;

  // Actor attribution
  submitted_by_employee_id?: string;
  submitted_by_name?: string;
  reviewer_id?: string | null;
  reviewer_name?: string | null;

  // Review status & workflow
  status: ApprovalStatus;
  submitted_at: string;
  reviewed_at?: string | null;
  review_notes?: string;
  revision_count: number;
  created_at: string;
  updated_at: string;
  audit_history: ApprovalHistoryEvent[];

  // Display metadata helpers for rich cards
  platform?: string;
  contentType?: string;
  category?: string;
  dueDate?: string;
  creativeLink?: string;
  priority?: string;
  estimatedHours?: number;

  // CamelCase compatibility aliases
  approvalId?: string;
  sourceType?: ApprovalSourceType;
  sourceId?: string;
  clientId?: string;
  clientName?: string;
  taskId?: string | null;
  contentItemId?: string | null;
  videoProductionId?: string | null;
  submittedByEmployeeId?: string;
  submittedByName?: string;
  reviewerId?: string | null;
  reviewerName?: string | null;
  submittedAt?: string;
  reviewedAt?: string | null;
  reviewNotes?: string;
  revisionCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export const LOCAL_STORAGE_APPROVALS_KEY = 'digi_persisted_approvals_v2';

export const DEFAULT_APPROVAL_SEEDS: CanonicalApprovalRecord[] = [
  {
    id: 'appr_task_tsk-master-3',
    approval_id: 'appr_task_tsk-master-3',
    approvalId: 'appr_task_tsk-master-3',
    source_type: 'task',
    sourceType: 'task',
    source_id: 'tsk-master-3',
    sourceId: 'tsk-master-3',
    client_id: 'client_dr_sankalp_sharma',
    clientId: 'client_dr_sankalp_sharma',
    client_name: 'Dr. Sankalp Sharma',
    clientName: 'Dr. Sankalp Sharma',
    title: 'Monthly SEO Health & Core Web Vitals Audit',
    description: 'Audit backlink profile, page speed, schema markup, and keyword rank fluctuations for organic patient acquisition.',
    task_id: 'tsk-master-3',
    taskId: 'tsk-master-3',
    content_item_id: null,
    video_production_id: null,
    submitted_by_employee_id: 'emp_3',
    submittedByEmployeeId: 'emp_3',
    submitted_by_name: 'Rahul Verma',
    submittedByName: 'Rahul Verma',
    reviewer_id: null,
    reviewer_name: null,
    status: 'pending',
    submitted_at: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    submittedAt: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    reviewed_at: null,
    review_notes: '',
    reviewNotes: '',
    revision_count: 0,
    revisionCount: 0,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    audit_history: [
      {
        actor_id: 'emp_3',
        actor_name: 'Rahul Verma',
        timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
        action: 'Submitted for review',
        notes: 'SEO technical score boosted to 94. Ready for sign-off.'
      }
    ],
    category: 'SEO',
    contentType: 'SEO Audit',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    priority: 'High',
  },
  {
    id: 'appr_content_cal_seed_1',
    approval_id: 'appr_content_cal_seed_1',
    approvalId: 'appr_content_cal_seed_1',
    source_type: 'content',
    sourceType: 'content',
    source_id: 'cal_seed_1',
    sourceId: 'cal_seed_1',
    client_id: 'client_dr_anupam_jindal',
    clientId: 'client_dr_anupam_jindal',
    client_name: 'Dr. Anupam Jindal',
    clientName: 'Dr. Anupam Jindal',
    title: 'Minimally Invasive Spine Surgery Benefits & Recovery',
    description: 'High-converting medical reel explaining robotic keyhole spine procedures with animated typography.',
    task_id: 'task_cal_seed_1',
    taskId: 'task_cal_seed_1',
    content_item_id: 'cal_seed_1',
    contentItemId: 'cal_seed_1',
    video_production_id: 'vid_cal_seed_1',
    submitted_by_employee_id: 'emp_2',
    submittedByEmployeeId: 'emp_2',
    submitted_by_name: 'Neha Gupta',
    submittedByName: 'Neha Gupta',
    reviewer_id: null,
    reviewer_name: null,
    status: 'pending',
    submitted_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    submittedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    reviewed_at: null,
    review_notes: '',
    reviewNotes: '',
    revision_count: 0,
    revisionCount: 0,
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    audit_history: [
      {
        actor_id: 'emp_2',
        actor_name: 'Neha Gupta',
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        action: 'Submitted for review',
        notes: 'Final 4K export with color grading and captions.'
      }
    ],
    platform: 'Instagram',
    contentType: 'Reel',
    category: 'Video Production',
    dueDate: new Date().toISOString().split('T')[0],
    creativeLink: 'https://instagram.com/reel/preview-demo',
    priority: 'Urgent',
  },
  {
    id: 'appr_content_cal_seed_2',
    approval_id: 'appr_content_cal_seed_2',
    approvalId: 'appr_content_cal_seed_2',
    source_type: 'content',
    sourceType: 'content',
    source_id: 'cal_seed_2',
    sourceId: 'cal_seed_2',
    client_id: 'client_dr_manishi_bansal',
    clientId: 'client_dr_manishi_bansal',
    client_name: 'Dr. Manishi Bansal',
    clientName: 'Dr. Manishi Bansal',
    title: '5 Essential Nutrition Tips During Second Trimester',
    description: '10-slide educational carousel with pastel medical brand aesthetics for maternal wellness.',
    task_id: 'task_cal_seed_2',
    taskId: 'task_cal_seed_2',
    content_item_id: 'cal_seed_2',
    contentItemId: 'cal_seed_2',
    video_production_id: null,
    submitted_by_employee_id: 'emp_4',
    submittedByEmployeeId: 'emp_4',
    submitted_by_name: 'Priya Singh',
    submittedByName: 'Priya Singh',
    reviewer_id: null,
    reviewer_name: null,
    status: 'pending',
    submitted_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    submittedAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    reviewed_at: null,
    review_notes: '',
    reviewNotes: '',
    revision_count: 0,
    revisionCount: 0,
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    audit_history: [
      {
        actor_id: 'emp_4',
        actor_name: 'Priya Singh',
        timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
        action: 'Submitted for review',
        notes: 'Carousel Figma export ready for review.'
      }
    ],
    platform: 'Instagram',
    contentType: 'Carousel',
    category: 'Graphic Design',
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    priority: 'High',
  },
  {
    id: 'appr_content_cal_seed_rev',
    approval_id: 'appr_content_cal_seed_rev',
    approvalId: 'appr_content_cal_seed_rev',
    source_type: 'content',
    sourceType: 'content',
    source_id: 'cal_seed_rev',
    sourceId: 'cal_seed_rev',
    client_id: 'client_gangotri_ice',
    clientId: 'client_gangotri_ice',
    client_name: 'Gangotri Ice Cubes',
    clientName: 'Gangotri Ice Cubes',
    title: 'Commercial Hygiene & Food Grade Ice Standards',
    description: 'B2B commercial post highlighting micro-filtration and pristine cold chain packaging standards.',
    task_id: 'task_cal_seed_rev',
    taskId: 'task_cal_seed_rev',
    content_item_id: 'cal_seed_rev',
    contentItemId: 'cal_seed_rev',
    video_production_id: null,
    submitted_by_employee_id: 'emp_4',
    submittedByEmployeeId: 'emp_4',
    submitted_by_name: 'Priya Singh',
    submittedByName: 'Priya Singh',
    reviewer_id: 'admin_1',
    reviewer_name: 'Super Admin',
    status: 'revision_requested',
    submitted_at: new Date(Date.now() - 86400000).toISOString(),
    submittedAt: new Date(Date.now() - 86400000).toISOString(),
    reviewed_at: new Date(Date.now() - 43200000).toISOString(),
    reviewedAt: new Date(Date.now() - 43200000).toISOString(),
    review_notes: 'Please update the corporate logo to the transparent SVG version and enhance contrast on slide 3.',
    reviewNotes: 'Please update the corporate logo to the transparent SVG version and enhance contrast on slide 3.',
    revision_count: 1,
    revisionCount: 1,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 43200000).toISOString(),
    updatedAt: new Date(Date.now() - 43200000).toISOString(),
    audit_history: [
      {
        actor_id: 'emp_4',
        actor_name: 'Priya Singh',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        action: 'Submitted for review',
        notes: 'Initial B2B creative draft.'
      },
      {
        actor_id: 'admin_1',
        actor_name: 'Super Admin',
        timestamp: new Date(Date.now() - 43200000).toISOString(),
        action: 'Revision requested',
        notes: 'Please update the corporate logo to the transparent SVG version and enhance contrast on slide 3.'
      }
    ],
    platform: 'Facebook',
    contentType: 'Static Post',
    category: 'Graphic Design',
    dueDate: new Date().toISOString().split('T')[0],
    priority: 'Medium',
  },
  {
    id: 'appr_content_cal_seed_3',
    approval_id: 'appr_content_cal_seed_3',
    approvalId: 'appr_content_cal_seed_3',
    source_type: 'content',
    sourceType: 'content',
    source_id: 'cal_seed_3',
    sourceId: 'cal_seed_3',
    client_id: 'client_gangotri_ice',
    clientId: 'client_gangotri_ice',
    client_name: 'Gangotri Ice Cubes',
    clientName: 'Gangotri Ice Cubes',
    title: 'Triple-Filtered Pure Crystal Ice For Premium Cafes',
    description: 'Purity you can taste in every single cube. Ultra-hygienic and crystal clear.',
    task_id: 'task_cal_seed_3',
    taskId: 'task_cal_seed_3',
    content_item_id: 'cal_seed_3',
    contentItemId: 'cal_seed_3',
    video_production_id: null,
    submitted_by_employee_id: 'emp_1',
    submittedByEmployeeId: 'emp_1',
    submitted_by_name: 'Aman Sharma',
    submittedByName: 'Aman Sharma',
    reviewer_id: 'admin_1',
    reviewer_name: 'Super Admin',
    status: 'approved',
    submitted_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    submittedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    reviewed_at: new Date(Date.now() - 86400000).toISOString(),
    reviewedAt: new Date(Date.now() - 86400000).toISOString(),
    review_notes: 'Approved without changes. Ready to schedule.',
    reviewNotes: 'Approved without changes. Ready to schedule.',
    revision_count: 0,
    revisionCount: 0,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    audit_history: [
      {
        actor_id: 'emp_1',
        actor_name: 'Aman Sharma',
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
        action: 'Submitted for review',
        notes: 'Final B2B ad creative.'
      },
      {
        actor_id: 'admin_1',
        actor_name: 'Super Admin',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        action: 'Approved'
      }
    ],
    platform: 'Facebook',
    contentType: 'Static Post',
    category: 'Social Media',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    priority: 'Medium',
  }
];

/**
 * Gets cached approvals from local storage, with fallback to default seeds
 */
export const getCachedApprovals = (): CanonicalApprovalRecord[] => {
  if (typeof window === 'undefined') return DEFAULT_APPROVAL_SEEDS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_APPROVALS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read cached approvals:', e);
  }
  // Initialize with seed data
  try {
    localStorage.setItem(LOCAL_STORAGE_APPROVALS_KEY, JSON.stringify(DEFAULT_APPROVAL_SEEDS));
  } catch (e) {}
  return DEFAULT_APPROVAL_SEEDS;
};

/**
 * Persists approvals to local storage
 */
export const setCachedApprovals = (approvals: CanonicalApprovalRecord[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_APPROVALS_KEY, JSON.stringify(approvals));
  } catch (e) {
    console.warn('Could not write cached approvals:', e);
  }
};

/**
 * Normalizes an approval record ensuring all canonical fields and aliases are present
 */
export const normalizeApprovalRecord = (raw: any): CanonicalApprovalRecord => {
  const source_type = (raw.source_type || raw.sourceType || 'task') as ApprovalSourceType;
  const source_id = String(raw.source_id || raw.sourceId || raw.id || '');
  const id = raw.id || raw.approval_id || raw.approvalId || `appr_${source_type}_${source_id}`;
  const nowIso = new Date().toISOString();

  let status: ApprovalStatus = 'pending';
  const rawStatus = (raw.status || '').toLowerCase();
  if (rawStatus === 'approved' || rawStatus === 'completed') {
    status = 'approved';
  } else if (rawStatus === 'revision_requested' || rawStatus === 'changes required' || rawStatus === 'changes_required' || rawStatus === 'revision') {
    status = 'revision_requested';
  } else {
    status = 'pending';
  }

  const hist = Array.isArray(raw.audit_history || raw.history) ? (raw.audit_history || raw.history) : [];

  return {
    id,
    approval_id: id,
    approvalId: id,
    source_type,
    sourceType: source_type,
    source_id,
    sourceId: source_id,
    client_id: raw.client_id || raw.clientId || '',
    clientId: raw.client_id || raw.clientId || '',
    client_name: raw.client_name || raw.clientName || 'General Client',
    clientName: raw.client_name || raw.clientName || 'General Client',
    title: raw.title || raw.topic || raw.deliverable_title || 'Untitled Deliverable',
    description: raw.description || raw.caption || '',
    task_id: raw.task_id || raw.taskId || (source_type === 'task' ? source_id : null),
    taskId: raw.task_id || raw.taskId || (source_type === 'task' ? source_id : null),
    content_item_id: raw.content_item_id || raw.contentItemId || (source_type === 'content' ? source_id : null),
    contentItemId: raw.content_item_id || raw.contentItemId || (source_type === 'content' ? source_id : null),
    video_production_id: raw.video_production_id || raw.videoProductionId || (source_type === 'video' ? source_id : null),
    videoProductionId: raw.video_production_id || raw.videoProductionId || (source_type === 'video' ? source_id : null),
    submitted_by_employee_id: raw.submitted_by_employee_id || raw.submittedByEmployeeId || raw.assigneeId || '',
    submittedByEmployeeId: raw.submitted_by_employee_id || raw.submittedByEmployeeId || raw.assigneeId || '',
    submitted_by_name: raw.submitted_by_name || raw.submittedByName || raw.assigneeName || 'Team Member',
    submittedByName: raw.submitted_by_name || raw.submittedByName || raw.assigneeName || 'Team Member',
    reviewer_id: raw.reviewer_id || raw.reviewerId || null,
    reviewerId: raw.reviewer_id || raw.reviewerId || null,
    reviewer_name: raw.reviewer_name || raw.reviewerName || null,
    reviewerName: raw.reviewer_name || raw.reviewerName || null,
    status,
    submitted_at: raw.submitted_at || raw.submittedAt || raw.created_at || raw.createdAt || nowIso,
    submittedAt: raw.submitted_at || raw.submittedAt || raw.created_at || raw.createdAt || nowIso,
    reviewed_at: raw.reviewed_at || raw.reviewedAt || null,
    reviewedAt: raw.reviewed_at || raw.reviewedAt || null,
    review_notes: raw.review_notes || raw.reviewNotes || raw.clientFeedback || '',
    reviewNotes: raw.review_notes || raw.reviewNotes || raw.clientFeedback || '',
    revision_count: typeof raw.revision_count === 'number' ? raw.revision_count : (typeof raw.revisionCount === 'number' ? raw.revisionCount : 0),
    revisionCount: typeof raw.revision_count === 'number' ? raw.revision_count : (typeof raw.revisionCount === 'number' ? raw.revisionCount : 0),
    created_at: raw.created_at || raw.createdAt || nowIso,
    createdAt: raw.created_at || raw.createdAt || nowIso,
    updated_at: raw.updated_at || raw.updatedAt || nowIso,
    updatedAt: raw.updated_at || raw.updatedAt || nowIso,
    audit_history: hist,
    platform: raw.platform || '',
    contentType: raw.contentType || raw.content_type || raw.category || '',
    category: raw.category || '',
    dueDate: raw.dueDate || raw.due_date || raw.date || '',
    creativeLink: raw.creativeLink || raw.creative_link || '',
    priority: raw.priority || 'Medium',
    estimatedHours: raw.estimatedHours || raw.estimated_hours || 2,
  };
};

/**
 * Creates or updates an approval record whenever a source item moves into review.
 * Deduplicates by source_type + source_id.
 * If resubmitted from revision_requested, returns to pending and appends Resubmitted event.
 */
export async function createOrUpdateApprovalFromSource(
  sourceType: ApprovalSourceType,
  sourceItem: any,
  actorProfile?: any,
  options?: { customTitle?: string; initialNotes?: string }
): Promise<CanonicalApprovalRecord> {
  const sourceId = String(sourceItem.id || sourceItem.contentId || sourceItem.taskId || sourceItem.source_id || '');
  if (!sourceId) {
    throw new Error('Missing source id for approval');
  }

  const docId = `appr_${sourceType}_${sourceId}`;
  const nowIso = new Date().toISOString();
  const actorId = actorProfile?.userId || actorProfile?.uid || 'user';
  const actorName = actorProfile?.name || 'Team Member';

  // 1. Check local cache and existing records
  const cached = getCachedApprovals();
  const existing = cached.find(a => a.id === docId || (a.source_type === sourceType && a.source_id === sourceId));

  const isResubmission = existing && existing.status === 'revision_requested';
  const newRevisionCount = existing ? existing.revision_count : 0;

  const historyEvents: ApprovalHistoryEvent[] = existing?.audit_history ? [...existing.audit_history] : [];
  if (isResubmission) {
    historyEvents.push({
      actor_id: actorId,
      actor_name: actorName,
      timestamp: nowIso,
      action: 'Resubmitted',
      notes: options?.initialNotes || 'Item resubmitted for review after revisions.'
    });
  } else if (!existing) {
    historyEvents.push({
      actor_id: actorId,
      actor_name: actorName,
      timestamp: nowIso,
      action: 'Submitted for review',
      notes: options?.initialNotes || ''
    });
  }

  const title = options?.customTitle || sourceItem.title || sourceItem.topic || sourceItem.work_description || 'Deliverable';
  const client_id = sourceItem.clientId || sourceItem.client_id || '';
  const client_name = sourceItem.clientName || sourceItem.client_name || 'Client';

  const approvalPayload: CanonicalApprovalRecord = normalizeApprovalRecord({
    ...(existing || {}),
    id: docId,
    approval_id: docId,
    source_type: sourceType,
    source_id: sourceId,
    client_id,
    client_name,
    title,
    description: sourceItem.description || sourceItem.caption || '',
    task_id: sourceItem.taskId || sourceItem.task_id || (sourceType === 'task' ? sourceId : (sourceItem.editTaskId || null)),
    content_item_id: sourceItem.contentId || sourceItem.content_item_id || (sourceType === 'content' ? sourceId : null),
    video_production_id: sourceItem.videoProductionId || sourceItem.video_production_id || (sourceType === 'video' ? sourceId : null),
    submitted_by_employee_id: sourceItem.assigneeId || sourceItem.employeeId || actorId,
    submitted_by_name: sourceItem.assigneeName || sourceItem.employeeName || actorName,
    reviewer_id: null,
    reviewer_name: null,
    status: 'pending',
    submitted_at: nowIso,
    reviewed_at: null,
    review_notes: isResubmission ? existing.review_notes : (options?.initialNotes || ''),
    revision_count: newRevisionCount,
    created_at: existing ? existing.created_at : nowIso,
    updated_at: nowIso,
    audit_history: historyEvents,
    platform: sourceItem.platform || (sourceItem.platforms ? sourceItem.platforms[0] : ''),
    contentType: sourceItem.contentType || sourceItem.category || '',
    category: sourceItem.category || '',
    dueDate: sourceItem.dueDate || sourceItem.date || sourceItem.shootDate || '',
    creativeLink: sourceItem.creativeLink || sourceItem.footageLink || '',
    priority: sourceItem.priority || 'Medium',
  });

  // 2. Update local cache immediately
  const updatedList = [
    approvalPayload,
    ...cached.filter(a => a.id !== docId && !(a.source_type === sourceType && a.source_id === sourceId))
  ];
  setCachedApprovals(updatedList);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('approvals_updated', { detail: approvalPayload }));
  }

  // 3. Persist to Firestore
  try {
    await ensureActiveFirebaseAuth().catch(console.warn);
    await setDoc(doc(db, 'approvals', docId), approvalPayload, { merge: true });
  } catch (err) {
    console.warn('Firestore setDoc warning for approval (saved locally):', err);
  }

  return approvalPayload;
}

/**
 * Approves an approval record, cascading the status update to the underlying task/content/video,
 * and triggering Work Log creation via task completion synchronization.
 */
export async function approveApprovalRecord(
  approvalId: string,
  reviewerProfile?: any
): Promise<CanonicalApprovalRecord> {
  const cached = getCachedApprovals();
  const target = cached.find(a => a.id === approvalId || a.approval_id === approvalId);
  if (!target) {
    throw new Error(`Approval record ${approvalId} not found`);
  }

  const nowIso = new Date().toISOString();
  const reviewerId = reviewerProfile?.userId || reviewerProfile?.uid || 'reviewer';
  const reviewerName = reviewerProfile?.name || 'Reviewer';

  const historyEvents: ApprovalHistoryEvent[] = [...(target.audit_history || [])];
  const isAfterRevision = target.revision_count > 0;
  historyEvents.push({
    actor_id: reviewerId,
    actor_name: reviewerName,
    timestamp: nowIso,
    action: isAfterRevision ? 'Approved after revision' : 'Approved',
  });

  const updatedApproval: CanonicalApprovalRecord = normalizeApprovalRecord({
    ...target,
    status: 'approved',
    reviewer_id: reviewerId,
    reviewer_name: reviewerName,
    reviewed_at: nowIso,
    updated_at: nowIso,
    audit_history: historyEvents,
  });

  // 1. Update local cache
  const updatedList = cached.map(a => (a.id === approvalId || a.approval_id === approvalId) ? updatedApproval : a);
  setCachedApprovals(updatedList);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('approvals_updated', { detail: updatedApproval }));
  }

  // 2. Persist Approval to Firestore
  try {
    await ensureActiveFirebaseAuth().catch(console.warn);
    await setDoc(doc(db, 'approvals', target.id), updatedApproval, { merge: true });
  } catch (err) {
    console.warn('Firestore approval update notice (cached locally):', err);
  }

  // 3. Cascade update to the source entity

  // A. TASK SOURCE (or linked task)
  const targetTaskId = target.task_id || (target.source_type === 'task' ? target.source_id : null);
  if (targetTaskId) {
    try {
      await persistUpdateTask(targetTaskId, {
        status: 'Done',
        completedAt: nowIso,
        updatedAt: nowIso,
      });

      // Synchronize to Work Log exactly once
      await syncTaskCompletionToWorkLog({
        taskId: targetTaskId,
        title: target.title,
        description: target.description,
        clientId: target.client_id,
        clientName: target.client_name,
        assigneeId: target.submitted_by_employee_id,
        assigneeName: target.submitted_by_name,
        category: target.category || target.contentType || 'Task Delivery',
        completedAt: nowIso,
        source: 'task_completion',
      }, reviewerProfile, reviewerId);
    } catch (e) {
      console.warn('Approvals: error updating linked task:', e);
    }
  }

  // B. CONTENT CALENDAR SOURCE
  if (target.source_type === 'content' || target.content_item_id) {
    const contentId = target.content_item_id || target.source_id;
    try {
      await updateDoc(doc(db, 'contentCalendar', contentId), {
        clientApprovalStatus: 'Approved',
        status: 'Approved',
        approvedAt: nowIso,
        updatedBy: reviewerName,
        updatedAt: nowIso,
      });
    } catch (e) {
      console.warn('Approvals: error updating content calendar:', e);
    }
  }

  // C. VIDEO TRACKER SOURCE
  if (target.source_type === 'video' || target.video_production_id) {
    const videoId = target.video_production_id || target.source_id;
    try {
      await updateDoc(doc(db, 'videoTracker', videoId), {
        status: 'finished',
        completedAt: nowIso,
        reviewedAt: nowIso,
        updatedAt: nowIso,
      });
    } catch (e) {
      console.warn('Approvals: error updating video production:', e);
    }
  }

  // 4. Log activity & emit workspace event
  try {
    await addDoc(collection(db, 'activityLogs'), {
      userId: reviewerId,
      userName: reviewerName,
      action: `approved deliverable: "${target.title}"`,
      details: `Client: ${target.client_name} · Source: ${target.source_type}`,
      createdAt: nowIso,
    });

    const { WorkspaceEventService } = await import('./controlPlane/WorkspaceEventService');
    await WorkspaceEventService.emit({
      eventType: 'content.approved',
      entityType: 'approval',
      entityId: target.id,
      actorId: reviewerId,
      actorName: reviewerName,
      actorRole: 'admin',
      clientId: target.client_id,
      targetMemberIds: target.submitted_by_employee_id ? [target.submitted_by_employee_id] : [],
      metadata: {
        title: target.title,
        clientName: target.client_name,
        sourceType: target.source_type
      },
      customDescription: `Approved creative/deliverable: "${target.title}" for ${target.client_name} by ${reviewerName}`
    });
  } catch (e) {}

  return updatedApproval;
}

/**
 * Requests revision on an approval record, cascading the status update back to active work
 * and incrementing the revision cycle.
 */
export async function requestRevisionApprovalRecord(
  approvalId: string,
  reviewNotes: string,
  reviewerProfile?: any
): Promise<CanonicalApprovalRecord> {
  if (!reviewNotes || !reviewNotes.trim()) {
    throw new Error('Revision notes are required to request changes');
  }

  const cached = getCachedApprovals();
  const target = cached.find(a => a.id === approvalId || a.approval_id === approvalId);
  if (!target) {
    throw new Error(`Approval record ${approvalId} not found`);
  }

  const nowIso = new Date().toISOString();
  const reviewerId = reviewerProfile?.userId || reviewerProfile?.uid || 'reviewer';
  const reviewerName = reviewerProfile?.name || 'Reviewer';
  const cleanNotes = reviewNotes.trim();

  const nextRevisionCount = (target.revision_count || 0) + 1;

  const historyEvents: ApprovalHistoryEvent[] = [...(target.audit_history || [])];
  historyEvents.push({
    actor_id: reviewerId,
    actor_name: reviewerName,
    timestamp: nowIso,
    action: 'Revision requested',
    notes: cleanNotes,
  });

  const updatedApproval: CanonicalApprovalRecord = normalizeApprovalRecord({
    ...target,
    status: 'revision_requested',
    reviewer_id: reviewerId,
    reviewer_name: reviewerName,
    reviewed_at: nowIso,
    review_notes: cleanNotes,
    revision_count: nextRevisionCount,
    updated_at: nowIso,
    audit_history: historyEvents,
  });

  // 1. Update local cache
  const updatedList = cached.map(a => (a.id === approvalId || a.approval_id === approvalId) ? updatedApproval : a);
  setCachedApprovals(updatedList);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('approvals_updated', { detail: updatedApproval }));
  }

  // 2. Persist Approval to Firestore
  try {
    await ensureActiveFirebaseAuth().catch(console.warn);
    await setDoc(doc(db, 'approvals', target.id), updatedApproval, { merge: true });
  } catch (err) {
    console.warn('Firestore revision request update notice (cached locally):', err);
  }

  // 3. Cascade update back to source entity to return to active work state

  // A. TASK SOURCE (or linked task) -> Send back to 'In Progress'
  const targetTaskId = target.task_id || (target.source_type === 'task' ? target.source_id : null);
  if (targetTaskId) {
    try {
      await persistUpdateTask(targetTaskId, {
        status: 'In Progress',
        internalNotes: `Changes requested (Rev #${nextRevisionCount}): ${cleanNotes}`,
        updatedAt: nowIso,
      });
    } catch (e) {
      console.warn('Approvals: error updating linked task to In Progress:', e);
    }
  }

  // B. CONTENT CALENDAR SOURCE -> Move back to 'In Design' / 'Changes Required'
  if (target.source_type === 'content' || target.content_item_id) {
    const contentId = target.content_item_id || target.source_id;
    try {
      await updateDoc(doc(db, 'contentCalendar', contentId), {
        clientApprovalStatus: 'Changes Required',
        status: 'Changes Required',
        clientFeedback: cleanNotes,
        updatedBy: reviewerName,
        updatedAt: nowIso,
      });
    } catch (e) {
      console.warn('Approvals: error updating content calendar for revision:', e);
    }
  }

  // C. VIDEO TRACKER SOURCE -> Move back to 'editing'
  if (target.source_type === 'video' || target.video_production_id) {
    const videoId = target.video_production_id || target.source_id;
    try {
      await updateDoc(doc(db, 'videoTracker', videoId), {
        status: 'editing',
        notes: `Changes requested (Rev #${nextRevisionCount}): ${cleanNotes}`,
        reviewedAt: nowIso,
        updatedAt: nowIso,
      });
    } catch (e) {
      console.warn('Approvals: error updating video tracker for revision:', e);
    }
  }

  // 4. Log activity & emit workspace event
  try {
    await addDoc(collection(db, 'activityLogs'), {
      userId: reviewerId,
      userName: reviewerName,
      action: `requested revision on "${target.title}" (Rev #${nextRevisionCount})`,
      details: `Notes: ${cleanNotes.slice(0, 80)}...`,
      createdAt: nowIso,
    });

    const { WorkspaceEventService } = await import('./controlPlane/WorkspaceEventService');
    await WorkspaceEventService.emit({
      eventType: 'content.revision_requested',
      entityType: 'approval',
      entityId: target.id,
      actorId: reviewerId,
      actorName: reviewerName,
      actorRole: 'admin',
      clientId: target.client_id,
      targetMemberIds: target.submitted_by_employee_id ? [target.submitted_by_employee_id] : [],
      metadata: {
        title: target.title,
        clientName: target.client_name,
        feedback: cleanNotes,
        revisionCount: nextRevisionCount
      },
      customDescription: `Requested changes on "${target.title}" (Rev #${nextRevisionCount}) for ${target.client_name}: ${cleanNotes}`
    });
  } catch (e) {}

  return updatedApproval;
}

/**
 * Scans existing source collections (tasks, contentCalendar, videoTracker)
 * both from local caches and Firestore, and seeds canonical approvals for any items currently in review.
 */
export async function syncExistingSourcesToApprovals(): Promise<CanonicalApprovalRecord[]> {
  const generated: CanonicalApprovalRecord[] = [];
  const nowIso = new Date().toISOString();

  // A. Scan cached tasks & master tasks for 'In Review'
  try {
    const cachedTasks = getCachedTasks();
    cachedTasks.forEach(task => {
      const statusLower = (task.status || '').toLowerCase();
      if (['in review', 'internal review', 'client review', 'in_review'].includes(statusLower)) {
        generated.push(normalizeApprovalRecord({
          id: `appr_task_${task.id}`,
          source_type: 'task',
          source_id: task.id,
          task_id: task.id,
          client_id: task.clientId || '',
          client_name: task.clientName || 'Client',
          title: task.title || 'Task in Review',
          description: task.description || '',
          submitted_by_employee_id: task.assigneeId || '',
          submitted_by_name: task.assigneeName || 'Team Member',
          status: 'pending',
          submitted_at: task.updatedAt || task.createdAt || nowIso,
          category: task.category || 'Task Delivery',
          dueDate: task.dueDate || '',
          priority: task.priority || 'Medium',
          audit_history: [{
            actor_id: task.assigneeId || 'emp',
            actor_name: task.assigneeName || 'Team Member',
            timestamp: task.updatedAt || task.createdAt || nowIso,
            action: 'Submitted for review'
          }]
        }));
      }
    });
  } catch (e) {}

  // B. Scan cached calendar entries for 'Pending' approval or 'Sent for Approval'
  try {
    const cachedCalendar = getCachedCalendarEntries();
    cachedCalendar.forEach(cal => {
      const appStatus = (cal.clientApprovalStatus || '').toLowerCase();
      const st = (cal.status || '').toLowerCase();
      if (appStatus === 'pending' || st === 'sent for approval' || appStatus === 'changes required') {
        const isChanges = appStatus === 'changes required' || st === 'changes required';
        generated.push(normalizeApprovalRecord({
          id: `appr_content_${cal.contentId}`,
          source_type: 'content',
          source_id: cal.contentId,
          content_item_id: cal.contentId,
          task_id: cal.taskId || null,
          client_id: cal.clientId || '',
          client_name: cal.clientName || 'Client',
          title: cal.topic || 'Content Deliverable',
          description: cal.caption || '',
          submitted_by_employee_id: cal.assigneeId || '',
          submitted_by_name: cal.assigneeName || 'Team Member',
          status: isChanges ? 'revision_requested' : 'pending',
          submitted_at: cal.updatedAt || cal.createdAt || nowIso,
          platform: cal.platform || '',
          contentType: cal.contentType || 'Static Post',
          dueDate: cal.date || '',
          creativeLink: cal.creativeLink || '',
          review_notes: cal.clientFeedback || '',
          revision_count: isChanges ? 1 : 0,
          audit_history: [{
            actor_id: cal.assigneeId || 'emp',
            actor_name: cal.assigneeName || 'Team Member',
            timestamp: cal.updatedAt || cal.createdAt || nowIso,
            action: isChanges ? 'Revision requested' : 'Submitted for review',
            notes: cal.clientFeedback || ''
          }]
        }));
      }
    });
  } catch (e) {}

  // C. Scan Firestore collections if available
  try {
    const tasksSnap = await getDocs(query(collection(db, 'tasks')));
    tasksSnap.forEach(docSnap => {
      const d = docSnap.data();
      const statusLower = (d.status || '').toLowerCase();
      if (['in review', 'internal review', 'client review', 'in_review'].includes(statusLower)) {
        generated.push(normalizeApprovalRecord({
          id: `appr_task_${docSnap.id}`,
          source_type: 'task',
          source_id: docSnap.id,
          task_id: docSnap.id,
          client_id: d.clientId || '',
          client_name: d.clientName || 'Client',
          title: d.title || 'Task in Review',
          description: d.description || '',
          submitted_by_employee_id: d.assigneeId || '',
          submitted_by_name: d.assigneeName || 'Team Member',
          status: 'pending',
          submitted_at: d.updatedAt || d.createdAt || nowIso,
          category: d.category || 'Task Delivery',
          dueDate: d.dueDate || '',
          priority: d.priority || 'Medium',
        }));
      }
    });

    const calSnap = await getDocs(query(collection(db, 'contentCalendar')));
    calSnap.forEach(docSnap => {
      const d = docSnap.data();
      const appStatus = (d.clientApprovalStatus || '').toLowerCase();
      const st = (d.status || '').toLowerCase();
      if (appStatus === 'pending' || st === 'sent for approval' || appStatus === 'changes required') {
        const isChanges = appStatus === 'changes required' || st === 'changes required';
        generated.push(normalizeApprovalRecord({
          id: `appr_content_${docSnap.id}`,
          source_type: 'content',
          source_id: docSnap.id,
          content_item_id: docSnap.id,
          task_id: d.taskId || null,
          client_id: d.clientId || '',
          client_name: d.clientName || 'Client',
          title: d.topic || 'Content Deliverable',
          description: d.caption || '',
          submitted_by_employee_id: d.assigneeId || '',
          submitted_by_name: d.assigneeName || 'Team Member',
          status: isChanges ? 'revision_requested' : 'pending',
          submitted_at: d.updatedAt || d.createdAt || nowIso,
          platform: d.platform || '',
          contentType: d.contentType || 'Static Post',
          dueDate: d.date || '',
          creativeLink: d.creativeLink || '',
          review_notes: d.clientFeedback || '',
          revision_count: isChanges ? 1 : 0,
        }));
      }
    });
  } catch (err) {
    console.warn('Firestore scan notice:', err);
  }

  // Combine with default seeds to guarantee non-empty initial review queue
  const currentCache = getCachedApprovals();
  const basePool = currentCache.length > 0 ? currentCache : DEFAULT_APPROVAL_SEEDS;
  
  const mergedMap = new Map<string, CanonicalApprovalRecord>();
  basePool.forEach(item => mergedMap.set(item.id, item));
  generated.forEach(item => mergedMap.set(item.id, item));

  const result = Array.from(mergedMap.values());
  setCachedApprovals(result);

  // Attempt async Firestore seed
  try {
    for (const item of result) {
      setDoc(doc(db, 'approvals', item.id), item, { merge: true }).catch(() => {});
    }
  } catch (e) {}

  return result;
}

/**
 * Real-time subscription to canonical approvals with local cache hydration
 */
export function subscribeToCanonicalApprovals(
  onUpdate: (approvals: CanonicalApprovalRecord[]) => void,
  onError?: (err: any) => void
): () => void {
  // 1. Emit cached approvals immediately
  const initial = getCachedApprovals();
  onUpdate(initial);

  // 2. Perform background sync from active sources if needed
  syncExistingSourcesToApprovals().then(synced => {
    if (synced.length > 0) {
      onUpdate(synced);
    }
  }).catch(() => {});

  // 3. Set up Firestore real-time listener
  const colRef = collection(db, 'approvals');
  const unsub = onSnapshot(colRef, async (snapshot) => {
    if (!snapshot.empty) {
      const list: CanonicalApprovalRecord[] = [];
      snapshot.forEach(docSnap => {
        list.push(normalizeApprovalRecord({ id: docSnap.id, ...docSnap.data() }));
      });

      if (list.length > 0) {
        setCachedApprovals(list);
        onUpdate(list);
        return;
      }
    }
    // If empty snapshot, fall back to synced/cached items
    const fallback = getCachedApprovals();
    onUpdate(fallback);
  }, (err) => {
    console.warn('Approvals listener notice (using cached data):', err);
    if (onError) onError(err);
    const cached = getCachedApprovals();
    onUpdate(cached);
  });

  return unsub;
}
