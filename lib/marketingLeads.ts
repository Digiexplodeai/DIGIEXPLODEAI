/**
 * DigiExplodeAI — Inbound Marketing Leads Service
 * Database Backend: Cloudflare D1 (via Cloudflare Worker API)
 * Local Cache: localStorage (optimistic layer for 0ms UI updates)
 *
 * All fake/mock leads have been removed. Cloudflare D1 is the authoritative source.
 */

import {
  cfGetLeads,
  cfCreateLead,
  cfUpdateLead,
  cfDeleteLead
} from './cloudflareApi';

export interface InboundLead {
  id: string;
  name: string;
  location: string;
  email?: string;
  contact?: string;
  sourcePage: string;
  interest?: string;
  status: 'new' | 'contacted' | 'in_discussion' | 'converted' | 'lost';
  timestamp: string;
  notes?: string;
  device?: string;
  referrer?: string;
  estimatedValue?: string;
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_KEY = 'digiexplode_inbound_leads_v2';
const LEGACY_STORAGE_KEY = 'digiexplode_inbound_leads_v1';

// Clean out legacy fake seed leads (Dr. Ananya, Vikramaditya, Mohit Verma, etc.)
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {}
}

let memoryCachedLeads: InboundLead[] = [];

export function normalizeLeadModel(raw: any): InboundLead {
  const nowIso = new Date().toISOString();
  return {
    id: raw.id || `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: (raw.name || '').trim(),
    location: (raw.location || '').trim() || 'Undisclosed Location',
    email: raw.email ? String(raw.email).trim() : undefined,
    contact: raw.contact ? String(raw.contact).trim() : undefined,
    sourcePage: raw.sourcePage || '/',
    interest: raw.interest || 'General Growth Inquiry',
    status: raw.status || 'new',
    timestamp: raw.createdAt || raw.timestamp || nowIso,
    notes: raw.notes || '',
    device: raw.device || '',
    referrer: raw.referrer || '',
    estimatedValue: raw.estimatedValue || '',
    createdAt: raw.createdAt || raw.timestamp || nowIso,
    updatedAt: raw.updatedAt || nowIso,
  };
}

export function getInboundLeads(): InboundLead[] {
  if (typeof window === 'undefined') return memoryCachedLeads;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out any legacy mock leads
        const real = parsed.filter(l => !String(l.id).startsWith('lead_10'));
        return real.map(normalizeLeadModel);
      }
    }
  } catch (e) {
    console.warn('[marketingLeads] Failed to read from localStorage:', e);
  }
  return memoryCachedLeads;
}

export function saveInboundLeads(leads: InboundLead[]): void {
  const normalized = leads.map(normalizeLeadModel);
  memoryCachedLeads = [...normalized];
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (e) {
    console.warn('[marketingLeads] Failed to save to localStorage:', e);
  }
}

/**
 * Creates and persists a new lead to Cloudflare D1 and Local Cache
 */
export async function createInboundLead(data: {
  name: string;
  location: string;
  email?: string;
  contact?: string;
  sourcePage?: string;
  interest?: string;
  notes?: string;
}): Promise<InboundLead> {
  const all = getInboundLeads();
  const nowIso = new Date().toISOString();

  const newLead: InboundLead = normalizeLeadModel({
    id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: data.name.trim(),
    location: data.location.trim() || 'Undisclosed Location',
    email: data.email?.trim() || undefined,
    contact: data.contact?.trim() || undefined,
    sourcePage: data.sourcePage || (typeof window !== 'undefined' ? window.location.pathname : '/'),
    interest: data.interest || 'General Digital Growth Inquiry',
    status: 'new',
    timestamp: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
    notes: data.notes || 'Inbound lead captured via website pop-up form.',
    device: typeof window !== 'undefined' && window.innerWidth < 768 ? 'Mobile' : 'Desktop',
    referrer: typeof document !== 'undefined' && document.referrer ? document.referrer : 'Direct Visit',
    estimatedValue: ''
  });

  // 1. Optimistic local cache update
  const updated = [newLead, ...all.filter(l => l.id !== newLead.id)];
  saveInboundLeads(updated);

  // 2. Persist to Cloudflare D1
  try {
    await cfCreateLead(newLead);
  } catch (err) {
    console.warn('[marketingLeads] Cloudflare D1 lead persistence notice:', err);
  }

  // 3. Dispatch global window event for real-time reactivity
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('digiexplode_new_lead', { detail: newLead }));
    window.dispatchEvent(new CustomEvent('digiexplode_leads_updated'));
  }

  return newLead;
}

export async function updateLeadStatus(id: string, status: InboundLead['status']): Promise<void> {
  const all = getInboundLeads();
  const nowIso = new Date().toISOString();
  const updated = all.map(l => (l.id === id ? { ...l, status, updatedAt: nowIso } : l));
  saveInboundLeads(updated);

  try {
    await cfUpdateLead(id, { status, updatedAt: nowIso });
  } catch (err) {
    console.warn('[marketingLeads] Cloudflare D1 lead status update notice:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('digiexplode_leads_updated'));
  }
}

export async function updateLeadNotes(id: string, notes: string): Promise<void> {
  const all = getInboundLeads();
  const nowIso = new Date().toISOString();
  const updated = all.map(l => (l.id === id ? { ...l, notes, updatedAt: nowIso } : l));
  saveInboundLeads(updated);

  try {
    await cfUpdateLead(id, { notes, updatedAt: nowIso });
  } catch (err) {
    console.warn('[marketingLeads] Cloudflare D1 lead notes update notice:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('digiexplode_leads_updated'));
  }
}

export async function deleteInboundLead(id: string): Promise<void> {
  const all = getInboundLeads();
  const updated = all.filter(l => l.id !== id);
  saveInboundLeads(updated);

  try {
    await cfDeleteLead(id);
  } catch (err) {
    console.warn('[marketingLeads] Cloudflare D1 lead deletion notice:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('digiexplode_leads_updated'));
  }
}

/**
 * Real-time subscription to canonical leads from Cloudflare D1
 * Polling interval: 5 seconds, with tab focus & visibility instant sync.
 */
export function subscribeToCanonicalLeads(
  onUpdate: (leads: InboundLead[]) => void
): () => void {
  let cancelled = false;

  // 1. Initial cached emission (0ms)
  onUpdate(getInboundLeads());

  // 2. Fetch authoritative list from Cloudflare D1
  const syncWithD1 = async () => {
    if (cancelled) return;
    try {
      const remoteLeads = await cfGetLeads();
      if (!Array.isArray(remoteLeads) || cancelled) return;

      const normalized = remoteLeads.map(normalizeLeadModel);
      saveInboundLeads(normalized);
      if (!cancelled) onUpdate(normalized);
    } catch (err) {
      console.warn('[marketingLeads] D1 leads sync notice:', err);
    }
  };

  syncWithD1();

  // 3. Polling every 5 seconds
  const interval = setInterval(syncWithD1, 5000);

  // 4. Focus/visibility instant sync
  const handleFocus = () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    syncWithD1();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);
  }

  return () => {
    cancelled = true;
    clearInterval(interval);
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
    }
  };
}

export function exportLeadsToCsv(leads: InboundLead[]): void {
  const headers = ['ID', 'Name', 'Location', 'Email', 'Contact', 'Source Page', 'Interest', 'Status', 'Timestamp', 'Notes'];
  const rows = leads.map(l => [
    `"${l.id}"`,
    `"${(l.name || '').replace(/"/g, '""')}"`,
    `"${(l.location || '').replace(/"/g, '""')}"`,
    `"${(l.email || '').replace(/"/g, '""')}"`,
    `"${(l.contact || '').replace(/"/g, '""')}"`,
    `"${l.sourcePage}"`,
    `"${(l.interest || '').replace(/"/g, '""')}"`,
    `"${l.status}"`,
    `"${new Date(l.timestamp).toLocaleString()}"`,
    `"${(l.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `digiexplode_leads_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
