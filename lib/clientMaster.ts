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

export const getCachedClients = (): CentralClient[] => {
  return DEFAULT_CLIENTS_MASTER;
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
  onUpdate(DEFAULT_CLIENTS_MASTER);

  try {
    const unsub = onSnapshot(collection(db, 'clients'), (snapshot) => {
      if (!snapshot.empty) {
        const list = snapshot.docs.map(d => ({ id: d.id, clientId: d.id, ...d.data() } as CentralClient));
        onUpdate(list);
      } else {
        onUpdate([]);
      }
    }, (err) => {
      console.warn('Clients snapshot notice (using local fallback):', err);
      onUpdate([]);
      if (onError) onError(err);
    });
    return unsub;
  } catch (e) {
    if (onError) onError(e);
    return () => {};
  }
}
