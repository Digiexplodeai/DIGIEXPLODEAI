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
  utmSource?: string;
  utmCampaign?: string;
}

const VISITOR_ID_KEY = 'digiexplode_visitor_id';
const VISITOR_SESSIONS_KEY = 'digiexplode_visitor_sessions_v2';
const VISITOR_GEO_KEY = 'digiexplode_visitor_geo_v1';
const LEGACY_SESSIONS_KEY = 'digiexplode_visitor_sessions_v1';

// Clear out legacy fake sessions
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(LEGACY_SESSIONS_KEY);
  } catch {}
}

let memorySessions: VisitorSession[] = [];
let cachedGeoInfo: { city: string; country: string } | null = null;

// Attempt to load cached geo info
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem(VISITOR_GEO_KEY);
    if (raw) cachedGeoInfo = JSON.parse(raw);
  } catch {}
}

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
    ipHash: raw.ipHash || 'Visitor',
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
    utmSource: raw.utmSource,
    utmCampaign: raw.utmCampaign,
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
 * Returns detected location info (e.g. for prefilling lead modal)
 */
export function getDetectedVisitorInfo(): { city: string; country: string; referrer: string } {
  const city = cachedGeoInfo?.city || 'India';
  const country = cachedGeoInfo?.country || 'India';
  let referrer = 'Direct Visit';
  if (typeof document !== 'undefined' && document.referrer) {
    referrer = document.referrer;
  }
  return { city, country, referrer };
}

/**
 * Fetches real geo attribution from Cloudflare Worker or IP service
 */
async function resolveRealVisitorGeo(): Promise<{ city: string; country: string }> {
  if (cachedGeoInfo && cachedGeoInfo.city && cachedGeoInfo.city !== 'India') {
    return cachedGeoInfo;
  }

  // 1. Try Cloudflare Worker edge geo endpoint
  try {
    const workerUrl = ((import.meta as any).env?.VITE_WORKER_URL || 'https://digiexplodai.digiexplodeai.workers.dev').replace(/\/$/, '');
    const res = await fetch(`${workerUrl}/api/geo`, { headers: { 'X-Agency-Key': 'digi_emp_session_2026' } });
    if (res.ok) {
      const data = await res.json();
      if (data && data.city) {
        const result = {
          city: data.formatted || data.city,
          country: data.country || 'India'
        };
        cachedGeoInfo = result;
        if (typeof window !== 'undefined') {
          localStorage.setItem(VISITOR_GEO_KEY, JSON.stringify(result));
        }
        return result;
      }
    }
  } catch {}

  // 2. Free client-side fallback (ipwhois / ipapi) if running on local dev
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      if (data && data.city) {
        const result = {
          city: `${data.city}, ${data.region_code || data.region || ''}`.replace(/,\s*$/, ''),
          country: data.country_name || 'India'
        };
        cachedGeoInfo = result;
        if (typeof window !== 'undefined') {
          localStorage.setItem(VISITOR_GEO_KEY, JSON.stringify(result));
        }
        return result;
      }
    }
  } catch {}

  // 3. Timezone fallback
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  let fallbackCity = 'India';
  if (tz.includes('Kolkata') || tz.includes('Calcutta')) fallbackCity = 'India';
  else if (tz.includes('London')) fallbackCity = 'London, UK';
  else if (tz.includes('New_York')) fallbackCity = 'New York, US';
  else if (tz.includes('Dubai')) fallbackCity = 'Dubai, UAE';

  return { city: fallbackCity, country: 'India' };
}

/**
 * Parses URL query params and document.referrer to categorize incoming traffic
 */
function parseTrafficAttribution(): { channelText: string; utmSource?: string; utmCampaign?: string } {
  if (typeof window === 'undefined') return { channelText: 'Direct Visit' };

  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');
    const gclid = params.get('gclid');
    const fbclid = params.get('fbclid');

    if (gclid) {
      return { channelText: `Google Ads (PPC Click)`, utmSource: 'google_ads', utmCampaign: utmCampaign || undefined };
    }
    if (fbclid) {
      return { channelText: `Meta / Instagram Ads (Ad Click)`, utmSource: 'meta_ads', utmCampaign: utmCampaign || undefined };
    }
    if (utmSource) {
      const detail = [utmSource, utmMedium, utmCampaign].filter(Boolean).join(' · ');
      return { channelText: `Campaign (${detail})`, utmSource, utmCampaign: utmCampaign || undefined };
    }

    const ref = document.referrer.toLowerCase();
    if (!ref) return { channelText: 'Direct Visit' };
    if (ref.includes(window.location.hostname)) return { channelText: 'Internal Navigation' };
    if (ref.includes('google')) return { channelText: 'Google Search (Organic)' };
    if (ref.includes('instagram')) return { channelText: 'Instagram (Social / Bio)' };
    if (ref.includes('facebook')) return { channelText: 'Facebook' };
    if (ref.includes('linkedin')) return { channelText: 'LinkedIn' };
    if (ref.includes('t.co') || ref.includes('twitter') || ref.includes('x.com')) return { channelText: 'X / Twitter' };
    if (ref.includes('whatsapp')) return { channelText: 'WhatsApp Link' };

    try {
      const parsedUrl = new URL(ref);
      return { channelText: `Referral: ${parsedUrl.hostname}` };
    } catch {
      return { channelText: 'Referral Link' };
    }
  } catch {
    return { channelText: 'Direct Visit' };
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

  const attribution = parseTrafficAttribution();
  const currentCity = cachedGeoInfo?.city || 'India';
  const currentCountry = cachedGeoInfo?.country || 'India';

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
      city: existing.city && existing.city !== 'India' ? existing.city : currentCity,
      actions: existing.actions.includes(actionName) ? existing.actions : [...existing.actions, actionName]
    };
    sessions[existingIndex] = targetSession;
  } else {
    targetSession = {
      id: vid,
      ipHash: 'Visitor',
      city: currentCity,
      country: currentCountry,
      currentPage: pathname,
      referrer: attribution.channelText,
      device,
      browser,
      firstSeenAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      durationSeconds: 15,
      status: 'active',
      actions: [`Entered site via ${pathname}`],
      utmSource: attribution.utmSource,
      utmCampaign: attribution.utmCampaign
    };
    sessions.unshift(targetSession);
  }

  const trimmed = sessions.slice(0, 60);
  saveVisitorSessions(trimmed);

  // Sync session heartbeat to Cloudflare D1
  cfTrackVisitorSession(targetSession).then((res: any) => {
    if (res && res.detectedCity && res.detectedCity !== 'India') {
      cachedGeoInfo = { city: res.detectedCity, country: res.detectedCountry || 'India' };
      localStorage.setItem(VISITOR_GEO_KEY, JSON.stringify(cachedGeoInfo));
    }
  }).catch(() => {});

  // Trigger geo resolution in background if not yet cached
  if (!cachedGeoInfo || cachedGeoInfo.city === 'India') {
    resolveRealVisitorGeo().then(geo => {
      if (geo && geo.city !== 'India') {
        targetSession.city = geo.city;
        targetSession.country = geo.country;
        saveVisitorSessions(sessions);
        cfTrackVisitorSession(targetSession).catch(() => {});
      }
    });
  }

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

  const interval = setInterval(syncWithD1, 8000);

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}
