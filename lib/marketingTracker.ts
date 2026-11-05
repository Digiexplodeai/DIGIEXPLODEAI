/**
 * DigiExplodeAI — Website Visitor Telemetry & Traffic Tracker
 * Database Backend: Cloudflare D1 (via Cloudflare Worker API)
 *
 * Real-time monitoring of live visitors, page journeys, device analytics, and geo attribution.
 * All fake/mock sessions removed. Real visitor traffic is tracked and synced to Cloudflare D1.
 */

import { cfGetVisitorSessions, cfTrackVisitorSession } from './cloudflareApi';

export interface VisitorSession {
  id: string;
  ipHash: string;
  city: string;
  country: string;
  currentPage: string;
  referrer: string;
  device: 'Desktop' | 'Mobile' | 'Tablet';
  browser: 'Chrome' | 'Safari' | 'Edge' | 'Firefox';
  firstSeenAt: string;
  lastActiveAt: string;
  durationSeconds: number;
  status: 'active' | 'idle' | 'ended';
  actions: string[];
}

const VISITOR_ID_KEY = 'digiexplode_visitor_id';
const VISITOR_SESSIONS_KEY = 'digiexplode_visitor_sessions_v2';
const LEGACY_SESSIONS_KEY = 'digiexplode_visitor_sessions_v1';

// Clear out legacy fake sessions (vis_delhi_801, vis_chd_802, etc.)
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(LEGACY_SESSIONS_KEY);
  } catch {}
}

let memorySessions: VisitorSession[] = [];

export function normalizeSessionModel(raw: any): VisitorSession {
  let actionsArr: string[] = [];
  if (Array.isArray(raw.actions)) {
    actionsArr = raw.actions;
  } else if (typeof raw.actions === 'string') {
    try {
      actionsArr = JSON.parse(raw.actions);
    } catch {
      actionsArr = [raw.actions];
    }
  }

  return {
    id: raw.id || `vis_${Date.now()}`,
    ipHash: raw.ipHash || '103.***.***.***',
    city: raw.city || 'India',
    country: raw.country || 'India',
    currentPage: raw.currentPage || '/',
    referrer: raw.referrer || 'Direct Visit',
    device: raw.device || 'Desktop',
    browser: raw.browser || 'Chrome',
    firstSeenAt: raw.firstSeenAt || new Date().toISOString(),
    lastActiveAt: raw.lastActiveAt || new Date().toISOString(),
    durationSeconds: Number(raw.durationSeconds) || 0,
    status: raw.status || 'active',
    actions: Array.isArray(actionsArr) ? actionsArr : [],
  };
}

export function getVisitorSessions(): VisitorSession[] {
  if (typeof window === 'undefined') return memorySessions;
  try {
    const raw = localStorage.getItem(VISITOR_SESSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const real = parsed.filter(s => !String(s.id).startsWith('vis_delhi_') && !String(s.id).startsWith('vis_chd_'));
        return real.map(normalizeSessionModel);
      }
    }
  } catch (e) {
    console.warn('[marketingTracker] Failed to read sessions:', e);
  }
  return memorySessions;
}

export function saveVisitorSessions(sessions: VisitorSession[]): void {
  const normalized = sessions.map(normalizeSessionModel);
  memorySessions = [...normalized];
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VISITOR_SESSIONS_KEY, JSON.stringify(normalized));
  } catch (e) {
    console.warn('[marketingTracker] Failed to save sessions:', e);
  }
}

/**
 * Initializes or updates the active visitor session on any page navigation
 */
export function trackPageView(pathname: string): void {
  if (typeof window === 'undefined') return;

  // Do not track portal/admin dashboard views as consumer visitors
  if (pathname.startsWith('/portal') || pathname.startsWith('/admin')) {
    return;
  }

  let vid = localStorage.getItem(VISITOR_ID_KEY);
  if (!vid) {
    vid = `vis_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString().slice(-4)}`;
    localStorage.setItem(VISITOR_ID_KEY, vid);
  }

  const isMobile = window.innerWidth < 768;
  const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
  const device: VisitorSession['device'] = isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop';

  const userAgent = navigator.userAgent;
  let browser: VisitorSession['browser'] = 'Chrome';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
  else if (userAgent.includes('Edg')) browser = 'Edge';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  let city = 'Delhi NCR';
  if (tz.includes('Calcutta') || tz.includes('Kolkata')) city = 'India';
  else if (tz.includes('London')) city = 'London';
  else if (tz.includes('New_York')) city = 'New York';
  else if (tz.includes('Dubai')) city = 'Dubai';

  const sessions = getVisitorSessions();
  const existingIndex = sessions.findIndex(s => s.id === vid);

  const actionName = `Navigated to ${pathname}`;
  let targetSession: VisitorSession;

  if (existingIndex >= 0) {
    const existing = sessions[existingIndex];
    const duration = Math.max(10, Math.round((Date.now() - new Date(existing.firstSeenAt).getTime()) / 1000));
    targetSession = {
      ...existing,
      currentPage: pathname,
      lastActiveAt: new Date().toISOString(),
      durationSeconds: duration,
      status: 'active',
      actions: existing.actions.includes(actionName) ? existing.actions : [...existing.actions, actionName]
    };
    sessions[existingIndex] = targetSession;
  } else {
    targetSession = {
      id: vid,
      ipHash: 'Visitor',
      city,
      country: 'India',
      currentPage: pathname,
      referrer: document.referrer ? (document.referrer.includes(window.location.hostname) ? 'Internal Navigation' : document.referrer) : 'Direct Visit',
      device,
      browser,
      firstSeenAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      durationSeconds: 15,
      status: 'active',
      actions: [`Entered site via ${pathname}`]
    };
    sessions.unshift(targetSession);
  }

  const trimmed = sessions.slice(0, 50);
  saveVisitorSessions(trimmed);

  // Sync session heartbeat to Cloudflare D1
  cfTrackVisitorSession(targetSession).catch(() => {});

  window.dispatchEvent(new CustomEvent('digiexplode_visitor_event', { detail: { vid, pathname } }));
}

/**
 * Logs a high-intent user interaction (e.g. Popup opened, form submitted, calculator slider dragged)
 */
export function logVisitorAction(actionText: string): void {
  if (typeof window === 'undefined') return;
  const vid = localStorage.getItem(VISITOR_ID_KEY);
  if (!vid) return;

  const sessions = getVisitorSessions();
  const index = sessions.findIndex(s => s.id === vid);
  if (index >= 0) {
    const s = sessions[index];
    if (!s.actions.includes(actionText)) {
      const updatedSession: VisitorSession = {
        ...s,
        lastActiveAt: new Date().toISOString(),
        actions: [...s.actions, actionText]
      };
      sessions[index] = updatedSession;
      saveVisitorSessions(sessions);
      cfTrackVisitorSession(updatedSession).catch(() => {});
      window.dispatchEvent(new CustomEvent('digiexplode_visitor_event'));
    }
  }
}

/**
 * Subscribes to canonical visitor sessions from Cloudflare D1
 */
export function subscribeToCanonicalVisitors(
  onUpdate: (sessions: VisitorSession[]) => void
): () => void {
  let cancelled = false;

  onUpdate(getVisitorSessions());

  const syncWithD1 = async () => {
    if (cancelled) return;
    try {
      const remoteSessions = await cfGetVisitorSessions();
      if (!Array.isArray(remoteSessions) || cancelled) return;
      const normalized = remoteSessions.map(normalizeSessionModel);
      saveVisitorSessions(normalized);
      if (!cancelled) onUpdate(normalized);
    } catch (err) {
      console.warn('[marketingTracker] D1 visitors sync notice:', err);
    }
  };

  syncWithD1();

  const interval = setInterval(syncWithD1, 10000);

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}
