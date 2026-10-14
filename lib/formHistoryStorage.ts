/**
 * Central Form History & Auto-Suggestion Engine
 * 
 * Manages history across all forms and fields in the system.
 * Automatically aggregates historical data from:
 * 1. Existing database records (tasks, clients, employees, work logs, video trackers, calendar posts)
 * 2. Real-time form submissions and inputs saved to localStorage
 * 
 * Provides instantaneous, contextual suggestions whenever a user interacts with any field.
 */

import { getCachedTasks, DEFAULT_MASTER_TASKS, LOCAL_STORAGE_TASKS_KEY } from './taskStorage';
import { getCachedClients, DEFAULT_CLIENTS_MASTER } from './clientMaster';
import { getCachedEmployees, CENTRAL_EMPLOYEES_MASTER_LIST } from './employeeMaster';

const STORAGE_PREFIX = 'digi_form_hist_v2_';
const MAX_HISTORY_PER_FIELD = 30;

// Substrings commonly used in form placeholders that must never appear in suggestions
const PLACEHOLDER_BLACKLIST = [
  'outline specific asset',
  'style references',
  'copy instructions',
  'asset requirements',
  'design 10 figma',
  'carousel slides with dark aesthetic',
  'monsoon hydration',
  '5 signs of herniated',
  'write caption details',
  'private team coordination',
  'paste google drive',
  'hook directions, patient consent',
  'write announcement details',
  'describe brand language',
  'add specific rules',
  'placeholder',
  'type or speak natural language',
  'discuss deliverable or copy',
  'additional notes about agency closure',
  'enter videographer name',
  'enter editor name',
  'campaign name...',
  'select client...',
  'search assignee',
  'search or select',
  'search employee',
  'search client',
  'task deliverable title',
];

export function isLikelyPlaceholder(str: string): boolean {
  if (!str || typeof str !== 'string') return true;
  const clean = str.trim().toLowerCase();
  if (clean.length < 2) return true;
  if (
    clean.startsWith('e.g.') ||
    clean.startsWith('eg:') ||
    clean.startsWith('http://') ||
    clean.startsWith('https://') ||
    clean.startsWith('outline ') ||
    clean.startsWith('enter ') ||
    clean.startsWith('select ') ||
    clean.startsWith('write ') ||
    clean.startsWith('paste ')
  ) {
    return true;
  }
  if ((clean.endsWith('…') || clean.endsWith('...')) && clean.length > 20) {
    return true;
  }
  if (
    clean.includes('copy instructions') ||
    clean.includes('asset requirements') ||
    clean.includes('style references') ||
    clean.includes('outline specific')
  ) {
    return true;
  }
  return PLACEHOLDER_BLACKLIST.some(phrase => clean.includes(phrase));
}

// Auto-purge tainted items from localStorage on startup (2-pass safe iteration)
if (typeof window !== 'undefined') {
  try {
    const keysToClean: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) {
        keysToClean.push(k);
      }
    }
    for (const k of keysToClean) {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleanList = parsed.filter(item => typeof item === 'string' && !isLikelyPlaceholder(item));
          if (cleanList.length !== parsed.length) {
            localStorage.setItem(k, JSON.stringify(cleanList));
          }
        }
      }
    }
  } catch (e) {
    // Ignore storage access errors
  }
}

// Listeners map for reactive field updates
const fieldListeners = new Map<string, Set<(history: string[]) => void>>();

/**
 * Standard Agency Deliverable Seeds for instantaneous helpful suggestions
 */
const DEFAULT_AGENCY_TASK_SEEDS = [
  'Meta Ads',
  'Meta Ads Campaign Setup & Launch',
  'Meta & Google Ad Creatives (1:1, 9:16 & 16:9)',
  'Google Ads Search & Performance Max Setup',
  'Video Production & Shoot Coordination',
  'Video Editing for Reels & Short-Form Content',
  'YouTube Long-Form Video Cut with B-Roll & Chapters',
  'Design 10 Figma Carousel Slides with Dark Aesthetic',
  'Brand Identity Guideline Kit & Vector Typography',
  'Full Landing Page UI Redesign & Conversion Optimization',
  'Weekly Performance Analytics & Client Growth Deck',
  'Organic SEO Content Plan & 4 High-Impact Articles',
  'Motion Graphics & Kinetic Typography Polish',
  'Client Review Call Deck & Campaign Strategy'
];

/**
 * Extract text safely from localStorage JSON cache
 */
function safeGetJsonArray(key: string): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Harvest existing live application data for a given field key.
 * Guarantees that existing items (like "meta ads" or active clients) appear as suggestions.
 */
export function harvestSystemFieldData(fieldKey: string): string[] {
  const harvested: string[] = [];
  const normalizedKey = fieldKey.toLowerCase();

  try {
    // 1. Task Titles
    if (normalizedKey.includes('task_title') || normalizedKey === 'title' || normalizedKey === 'work_title') {
      const liveTasks = getCachedTasks();
      const localTasksV2 = safeGetJsonArray(LOCAL_STORAGE_TASKS_KEY);
      const localTasksLegacy = safeGetJsonArray('digi_agency_tasks_cache');
      const calItems = safeGetJsonArray('digi_content_calendar_events');
      const workLogs = safeGetJsonArray('digi_persisted_worklogs_v2');
      const workLogsLegacy = safeGetJsonArray('digi_worklogs_cache');
      const vidItems = safeGetJsonArray('digi_video_tracker_cache');

      const allSources = [
        ...liveTasks,
        ...localTasksV2,
        ...localTasksLegacy,
        ...DEFAULT_MASTER_TASKS,
        ...calItems,
        ...workLogs,
        ...workLogsLegacy,
        ...vidItems
      ];

      for (const t of allSources) {
        if (!t) continue;
        const candidate = t.title || t.taskTitle || t.topic || t.workDone || t.name;
        if (candidate && typeof candidate === 'string') {
          const clean = candidate.trim();
          if (clean.length >= 2 && clean.length < 120 && !isLikelyPlaceholder(clean)) {
            harvested.push(clean);
          }
        }
      }

      // Add baseline agency seeds
      for (const seed of DEFAULT_AGENCY_TASK_SEEDS) {
        if (!isLikelyPlaceholder(seed)) {
          harvested.push(seed);
        }
      }
    }

    // 2. Task Descriptions & Context
    if (normalizedKey.includes('task_description') || normalizedKey.includes('description') || normalizedKey.includes('deliverable_context')) {
      const liveTasks = getCachedTasks();
      const localTasks = safeGetJsonArray(LOCAL_STORAGE_TASKS_KEY);
      for (const t of [...liveTasks, ...localTasks]) {
        if (t && typeof t.description === 'string' && t.description.trim()) {
          const desc = t.description.trim();
          if (!isLikelyPlaceholder(desc)) {
            harvested.push(desc);
          }
        }
      }
    }

    // 3. Task Internal Notes
    if (normalizedKey.includes('task_notes') || normalizedKey.includes('internalnotes')) {
      const liveTasks = getCachedTasks();
      for (const t of liveTasks) {
        if (t && typeof t.internalNotes === 'string' && t.internalNotes.trim()) {
          const notes = t.internalNotes.trim();
          if (!isLikelyPlaceholder(notes)) {
            harvested.push(notes);
          }
        }
      }
    }

    // 4. Client Names & Brands
    if (normalizedKey.includes('client_name') || normalizedKey.includes('brand_name') || normalizedKey === 'client') {
      const liveClients = getCachedClients();
      const localClients = safeGetJsonArray('digi_clients_cache');
      for (const c of [...liveClients, ...localClients, ...DEFAULT_CLIENTS_MASTER]) {
        if (c?.clientName && !isLikelyPlaceholder(c.clientName)) harvested.push(c.clientName.trim());
        if (c?.name && c.name !== c?.clientName && !isLikelyPlaceholder(c.name)) harvested.push(c.name.trim());
        if (c?.businessName && c.businessName !== c?.clientName && !isLikelyPlaceholder(c.businessName)) harvested.push(c.businessName.trim());
      }
    }

    // 5. Client Business / Clinic / Company
    if (normalizedKey.includes('business_name') || normalizedKey.includes('company_name')) {
      const liveClients = getCachedClients();
      for (const c of [...liveClients, ...DEFAULT_CLIENTS_MASTER]) {
        if (c?.businessName && !isLikelyPlaceholder(c.businessName)) harvested.push(c.businessName.trim());
      }
    }

    // 6. Client Industry / Niche
    if (normalizedKey.includes('industry') || normalizedKey.includes('client_category')) {
      const liveClients = getCachedClients();
      for (const c of [...liveClients, ...DEFAULT_CLIENTS_MASTER]) {
        const ind = (c as any)?.industry || (c as any)?.category;
        if (ind && !isLikelyPlaceholder(ind)) harvested.push(ind.trim());
      }
    }

    // 7. Contact Person
    if (normalizedKey.includes('contact_person') || normalizedKey.includes('contactperson')) {
      const liveClients = getCachedClients();
      for (const c of [...liveClients, ...DEFAULT_CLIENTS_MASTER]) {
        const cp = (c as any)?.contactPerson;
        if (cp && !isLikelyPlaceholder(cp)) harvested.push(cp.trim());
      }
    }

    // 8. Client Notes / Scope
    if (normalizedKey.includes('client_notes') || normalizedKey.includes('client_scope')) {
      const liveClients = getCachedClients();
      for (const c of [...liveClients, ...DEFAULT_CLIENTS_MASTER]) {
        const n = (c as any)?.notes;
        if (n && !isLikelyPlaceholder(n)) harvested.push(n.trim());
      }
    }

    // 9. Video Tracker Titles & Topics
    if (normalizedKey.includes('video_title') || normalizedKey.includes('video_topic')) {
      const videoItems = safeGetJsonArray('digi_video_tracker_cache');
      for (const v of videoItems) {
        if (v?.title && !isLikelyPlaceholder(v.title)) harvested.push(v.title.trim());
      }
    }

    // 10. Video Notes, Concept & Locations
    if (normalizedKey.includes('video_notes') || normalizedKey.includes('production_notes')) {
      const videoItems = safeGetJsonArray('digi_video_tracker_cache');
      for (const v of videoItems) {
        if (v?.notes && !isLikelyPlaceholder(v.notes)) harvested.push(v.notes.trim());
        if (v?.concept && !isLikelyPlaceholder(v.concept)) harvested.push(v.concept.trim());
      }
    }

    // 11. Content Calendar Topics / Titles
    if (normalizedKey.includes('calendar_title') || normalizedKey.includes('calendar_topic') || normalizedKey.includes('content_topic')) {
      const calItems = safeGetJsonArray('digi_content_calendar_events');
      for (const item of calItems) {
        if (item?.topic && !isLikelyPlaceholder(item.topic)) harvested.push(item.topic.trim());
        if (item?.title && !isLikelyPlaceholder(item.title)) harvested.push(item.title.trim());
      }
    }

    // 12. Content Calendar Captions & Copy
    if (normalizedKey.includes('calendar_caption') || normalizedKey.includes('caption') || normalizedKey.includes('copy')) {
      const calItems = safeGetJsonArray('digi_content_calendar_events');
      for (const item of calItems) {
        if (item?.caption && !isLikelyPlaceholder(item.caption)) harvested.push(item.caption.trim());
      }
    }

    // 13. Content Calendar Hashtags
    if (normalizedKey.includes('hashtags') || normalizedKey.includes('tags')) {
      const calItems = safeGetJsonArray('digi_content_calendar_events');
      for (const item of calItems) {
        if (item?.hashtags && !isLikelyPlaceholder(item.hashtags)) harvested.push(item.hashtags.trim());
      }
    }

    // 14. Work Logs
    if (normalizedKey.includes('worklog') || normalizedKey.includes('work_done') || normalizedKey === 'work_title') {
      const logs = safeGetJsonArray('digi_worklogs_cache');
      for (const log of logs) {
        if (log?.workDone && !isLikelyPlaceholder(log.workDone)) harvested.push(log.workDone.trim());
        if (log?.notes && !isLikelyPlaceholder(log.notes)) harvested.push(log.notes.trim());
      }
    }

    // 15. Employee Names & Roles
    if (normalizedKey.includes('employee_name') || normalizedKey.includes('staff_name')) {
      const emps = getCachedEmployees();
      for (const e of [...emps, ...CENTRAL_EMPLOYEES_MASTER_LIST]) {
        if (e?.name && !isLikelyPlaceholder(e.name)) harvested.push(e.name.trim());
      }
    }
  } catch (err) {
    console.warn('[FormHistory] Harvest error for', fieldKey, err);
  }

  // Deduplicate and filter out empty strings and placeholders
  return Array.from(new Set(harvested.filter(Boolean)));
}

/**
 * Retrieve the full list of history suggestions for a field.
 * Combines explicit user inputs saved in localStorage + system-harvested existing records + optional static seeds.
 */
export function getFieldHistory(fieldKey: string, extraSeeds: string[] = []): string[] {
  if (typeof window === 'undefined') return extraSeeds.filter(s => !isLikelyPlaceholder(s));

  let savedHistory: string[] = [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${fieldKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        savedHistory = parsed.filter(item => 
          typeof item === 'string' && item.trim().length > 0 && !isLikelyPlaceholder(item)
        );
        // Clean tainted storage if dirty placeholders were found
        if (savedHistory.length !== parsed.length) {
          localStorage.setItem(`${STORAGE_PREFIX}${fieldKey}`, JSON.stringify(savedHistory));
        }
      }
    }
  } catch (e) {
    savedHistory = [];
  }

  // Harvest from existing active database models
  const harvested = harvestSystemFieldData(fieldKey);
  const cleanExtraSeeds = extraSeeds.filter(s => typeof s === 'string' && s.trim().length > 0 && !isLikelyPlaceholder(s));

  // Combine order: extra seeds (live component context like active board tasks) -> saved user history -> harvested system entries
  const combined = [...cleanExtraSeeds, ...savedHistory, ...harvested];

  // Case-insensitive deduplication preserving the casing of first occurrence
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of combined) {
    const clean = item.trim();
    if (!clean || isLikelyPlaceholder(clean)) continue;
    const lower = clean.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(clean);
    }
    if (result.length >= MAX_HISTORY_PER_FIELD) break;
  }

  return result;
}

/**
 * Save a newly entered value into history for a specific field.
 * Puts the value at the very front of the history list.
 */
export function saveFormFieldHistory(fieldKey: string, value: string): void {
  if (typeof window === 'undefined' || !fieldKey || !value) return;
  const clean = value.trim();
  if (clean.length < 2 || isLikelyPlaceholder(clean)) return; // Skip trivial chars or placeholders

  // Don't save overly long sentences as title
  if (fieldKey.toLowerCase().includes('title') && clean.length > 120) return;

  try {
    let current = getFieldHistory(fieldKey);
    // Remove if already exists so we can move it to front
    current = current.filter(item => item.toLowerCase() !== clean.toLowerCase());
    current.unshift(clean);

    if (current.length > MAX_HISTORY_PER_FIELD) {
      current = current.slice(0, MAX_HISTORY_PER_FIELD);
    }

    localStorage.setItem(`${STORAGE_PREFIX}${fieldKey}`, JSON.stringify(current));

    // Notify any active reactive listeners
    const listeners = fieldListeners.get(fieldKey);
    if (listeners) {
      listeners.forEach(cb => cb(current));
    }
  } catch (err) {
    console.error('[FormHistory] Failed to save field history:', err);
  }
}

/**
 * Remove a specific item from a field's history (e.g. user clicks delete icon on a suggestion)
 */
export function removeFormFieldHistory(fieldKey: string, valueToRemove: string): void {
  if (typeof window === 'undefined' || !fieldKey) return;
  const targetLower = valueToRemove.trim().toLowerCase();

  try {
    const current = getFieldHistory(fieldKey);
    const updated = current.filter(item => item.trim().toLowerCase() !== targetLower);

    localStorage.setItem(`${STORAGE_PREFIX}${fieldKey}`, JSON.stringify(updated));

    const listeners = fieldListeners.get(fieldKey);
    if (listeners) {
      listeners.forEach(cb => cb(updated));
    }
  } catch (err) {
    console.error('[FormHistory] Failed to remove item from history:', err);
  }
}

/**
 * Clear all history for a specific field
 */
export function clearFormFieldHistory(fieldKey: string): void {
  if (typeof window === 'undefined' || !fieldKey) return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${fieldKey}`);
    const listeners = fieldListeners.get(fieldKey);
    if (listeners) {
      listeners.forEach(cb => cb([]));
    }
  } catch (err) {
    console.error('[FormHistory] Failed to clear field history:', err);
  }
}

/**
 * Subscribe to reactive changes in a field's history
 */
export function subscribeToFieldHistory(fieldKey: string, callback: (history: string[]) => void): () => void {
  if (!fieldListeners.has(fieldKey)) {
    fieldListeners.set(fieldKey, new Set());
  }
  const set = fieldListeners.get(fieldKey)!;
  set.add(callback);

  // Immediately call with current history
  callback(getFieldHistory(fieldKey));

  return () => {
    set.delete(callback);
    if (set.size === 0) {
      fieldListeners.delete(fieldKey);
    }
  };
}
