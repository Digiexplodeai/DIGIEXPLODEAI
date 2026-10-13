import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from './firebase';
import { type ClientData } from '../components/Portal/ClientList';

export interface CentralClient extends ClientData {
  id: string;
  slug: string;
  name?: string;
  logo?: string;
  category: string;
  status: 'Active' | 'Paused' | 'Completed';
  instagramUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  notes?: string;
}

// Clean Slate: No hardcoded dummy clients. Agency admins add their real clients.
export const CENTRAL_CLIENT_MASTER_LIST: CentralClient[] = [];

export const DEFAULT_CLIENTS_MASTER: CentralClient[] = [];

const LOCAL_STORAGE_CLIENTS_KEY = 'digi_local_clients';

/**
 * Reads clients from localStorage cache.
 * Returns an empty array if nothing is cached yet.
 */
export const getCachedClients = (): CentralClient[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CLIENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as CentralClient[];
    }
  } catch (e) {
    console.warn('[clientMaster] Could not read cached clients:', e);
  }
  return [];
};

/**
 * Saves clients to localStorage cache.
 */
export const setCachedClients = (clients: CentralClient[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_CLIENTS_KEY, JSON.stringify(clients));
  } catch (e) {
    console.warn('[clientMaster] Could not write cached clients:', e);
  }
};

// In-memory cache & initialization flag
let isSeedingCompleted = true;

/**
 * Ensures central clients are present in Firestore.
 * In clean slate mode, no dummy clients are seeded.
 */
export async function ensureCentralClientsSeeded(): Promise<void> {
  isSeedingCompleted = true;
}

export function subscribeToCanonicalClients(
  onUpdate: (clients: CentralClient[]) => void,
  onError?: (err: any) => void
): () => void {
  // 1. Emit cached clients immediately so the UI is never blank on refresh
  const cached = getCachedClients();
  if (cached.length > 0) {
    onUpdate(cached);
  } else {
    onUpdate([]);
  }

  try {
    const unsub = onSnapshot(collection(db, 'clients'), (snapshot) => {
      if (!snapshot.empty) {
        const list = snapshot.docs.map(d => ({ id: d.id, clientId: d.id, ...d.data() } as CentralClient));
        // Persist to localStorage so next refresh shows them instantly
        setCachedClients(list);
        onUpdate(list);
      } else {
        // Firestore empty — emit from cache so UI doesn't blank out
        const fallback = getCachedClients();
        onUpdate(fallback.length > 0 ? fallback : []);
      }
    }, (err) => {
      console.warn('[clientMaster] Clients snapshot error (using local cache):', err);
      // On error (e.g. auth not ready), use localStorage cache
      const fallback = getCachedClients();
      onUpdate(fallback.length > 0 ? fallback : []);
      if (onError) onError(err);
    });
    return unsub;
  } catch (e) {
    if (onError) onError(e);
    return () => {};
  }
}
