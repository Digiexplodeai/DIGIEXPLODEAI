/**
 * HR Document Storage Library
 * Canonical data access for HR document lifecycle
 */

import {
  collection, doc, getDocs, addDoc, setDoc, updateDoc, getDoc,
  onSnapshot, query, where, orderBy
} from 'firebase/firestore';
import { db } from './firebase';

export type DocType = 'appointment' | 'relieving' | 'experience' | 'offer' | 'increment';
export type DocStatus = 'Draft' | 'Finalized' | 'Emailed' | 'Revoked';

export const DOC_TYPE_CODES: Record<DocType, string> = {
  appointment: 'APPT',
  offer:       'OFFER',
  relieving:   'REL',
  experience:  'EXP',
  increment:   'INC',
};

export interface HRDocumentRecord {
  id: string;
  referenceNumber: string;
  verificationToken: string;
  type: DocType;
  status: DocStatus;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  designation: string;
  department: string;
  effectiveDate: string;
  generatedAt: string;
  templateData: Record<string, string>;
  signatoryName: string;
  signatoryDesignation: string;
  generatedBy: string;
  generatedById: string;
  lastEditedBy?: string;
  lastEditedById?: string;
  emailSent: boolean;
  emailSentAt?: string;
  emailSentTo?: string;
  emailSentBy?: string;
  version: number;
  previousVersionId?: string;
  customBodyText?: string;
}

export interface HRAuditEvent {
  documentId: string;
  referenceNumber: string;
  action: string;
  actorId: string;
  actorName: string;
  timestamp: string;
  oldValue?: string;
  newValue?: string;
  notes?: string;
}

const LS_DOCS_KEY = 'digi_hr_documents_v1';
const LS_SEQ_KEY  = 'digi_hr_doc_sequence';

export async function generateDocumentReference(type: DocType): Promise<string> {
  const year = new Date().getFullYear();
  const code = DOC_TYPE_CODES[type];
  let seq = 41;
  try {
    const raw = localStorage.getItem(LS_SEQ_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      seq = (parsed[`${code}_${year}`] || 41);
    }
  } catch {}
  seq++;
  try {
    const raw = localStorage.getItem(LS_SEQ_KEY);
    const current = raw ? JSON.parse(raw) : {};
    current[`${code}_${year}`] = seq;
    localStorage.setItem(LS_SEQ_KEY, JSON.stringify(current));
  } catch {}
  const padded = String(seq).padStart(4, '0');
  return `DEA/HR/${code}/${year}/${padded}`;
}

export function generateVerificationToken(): string {
  const array = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i++) { array[i] = Math.floor(Math.random() * 256); }
  }
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getCachedHRDocuments(): HRDocumentRecord[] {
  try {
    const raw = localStorage.getItem(LS_DOCS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function subscribeToHRDocuments(
  onUpdate: (docs: HRDocumentRecord[]) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const cached = getCachedHRDocuments();
    if (cached.length > 0) onUpdate(cached);
  } catch {}
  try {
    const unsub = onSnapshot(
      query(collection(db, 'hrDocuments'), orderBy('generatedAt', 'desc')),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as HRDocumentRecord));
        localStorage.setItem(LS_DOCS_KEY, JSON.stringify(list));
        onUpdate(list);
      },
      (err) => {
        console.warn('[HRDocs] Snapshot error:', err);
        try {
          const raw = localStorage.getItem(LS_DOCS_KEY);
          if (raw) onUpdate(JSON.parse(raw));
        } catch {}
        if (onError) onError(err);
      }
    );
    return unsub;
  } catch (e) {
    if (onError) onError(e);
    return () => {};
  }
}

export async function saveHRDocument(
  record: Omit<HRDocumentRecord, 'id'>
): Promise<string> {
  try {
    const ref = await addDoc(collection(db, 'hrDocuments'), record);
    return ref.id;
  } catch (e) {
    console.warn('[HRDocs] Firestore save fallback:', e);
    const id = `local_${Date.now()}`;
    try {
      const cached = getCachedHRDocuments();
      cached.unshift({ ...record, id });
      localStorage.setItem(LS_DOCS_KEY, JSON.stringify(cached));
    } catch {}
    return id;
  }
}

export async function updateHRDocument(
  docId: string,
  data: Partial<HRDocumentRecord>
): Promise<void> {
  try {
    await setDoc(doc(db, 'hrDocuments', docId), data, { merge: true });
  } catch (e) {
    console.warn('[HRDocs] Update fallback:', e);
    try {
      const cached = getCachedHRDocuments();
      const idx = cached.findIndex(d => d.id === docId);
      if (idx >= 0) {
        cached[idx] = { ...cached[idx], ...data };
        localStorage.setItem(LS_DOCS_KEY, JSON.stringify(cached));
      }
    } catch {}
  }
}

export async function logHRAuditEvent(event: HRAuditEvent): Promise<void> {
  try {
    await addDoc(collection(db, 'hrAuditLogs'), event);
  } catch {}
  try {
    const { WorkspaceEventService } = await import('./controlPlane/WorkspaceEventService');
    await WorkspaceEventService.emit({
      eventType: event.action?.toLowerCase().includes('email') ? 'hr_document.emailed' :
                 event.action?.toLowerCase().includes('revok') ? 'hr_document.revoked' :
                 event.action?.toLowerCase().includes('final') ? 'hr_document.finalized' : 'hr_document.generated',
      entityType: 'hr_document',
      entityId: event.referenceNumber || event.documentId,
      actorId: event.actorId || 'hr',
      actorName: event.actorName || 'HR Lead',
      actorRole: 'hr',
      customDescription: `HR Action: ${event.action} on ${event.referenceNumber || event.documentId} (${event.notes || 'Document record'})`,
      metadata: {
        referenceNumber: event.referenceNumber,
        oldValue: event.oldValue,
        newValue: event.newValue,
      }
    });
  } catch (e) {}
}

export async function getDocumentByVerificationToken(
  token: string
): Promise<HRDocumentRecord | null> {
  try {
    const snap = await getDocs(query(
      collection(db, 'hrDocuments'),
      where('verificationToken', '==', token)
    ));
    if (!snap.empty) {
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as HRDocumentRecord;
    }
  } catch (e) {
    console.warn('[HRDocs] Verification query error:', e);
  }
  try {
    const cached = getCachedHRDocuments();
    return cached.find(d => d.verificationToken === token) || null;
  } catch {}
  return null;
}
