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

export const CENTRAL_CLIENT_MASTER_LIST: CentralClient[] = [
  {
    id: 'client_dr_anupam_jindal',
    clientId: 'client_dr_anupam_jindal',
    name: 'Dr. Anupam Jindal',
    clientName: 'Dr. Anupam Jindal',
    slug: 'dr-anupam-jindal',
    businessName: 'Dr. Anupam Jindal Neurosurgery & Spine',
    category: 'Healthcare & Neurosurgery',
    contactPerson: 'Dr. Anupam Jindal',
    phone: '+91 98140 12345',
    email: 'info@dranupamjindal.com',
    package: 'Premium',
    status: 'Active',
    startDate: '2024-01-15',
    instagramUrl: 'https://instagram.com/dranupamjindal',
    facebookUrl: 'https://facebook.com/dranupamjindal',
    youtubeUrl: 'https://youtube.com/@dranupamjindal',
    websiteUrl: 'https://dranupamjindal.com',
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z'
  },
  {
    id: 'client_dr_manishi_bansal',
    clientId: 'client_dr_manishi_bansal',
    name: 'Dr. Manishi Bansal',
    clientName: 'Dr. Manishi Bansal',
    slug: 'dr-manishi-bansal',
    businessName: 'Dr. Manishi Bansal Women Healthcare & Gynecology',
    category: 'Healthcare & Gynecology',
    contactPerson: 'Dr. Manishi Bansal',
    phone: '+91 98150 23456',
    email: 'contact@drmanishibansal.com',
    package: 'Premium',
    status: 'Active',
    startDate: '2024-02-01',
    instagramUrl: 'https://instagram.com/drmanishibansal',
    facebookUrl: 'https://facebook.com/drmanishibansal',
    websiteUrl: 'https://drmanishibansal.com',
    createdAt: '2024-02-01T00:00:00.000Z',
    updatedAt: '2024-02-01T00:00:00.000Z'
  },
  {
    id: 'client_dr_sankalp_sharma',
    clientId: 'client_dr_sankalp_sharma',
    name: 'Dr. Sankalp Sharma',
    clientName: 'Dr. Sankalp Sharma',
    slug: 'dr-sankalp-sharma',
    businessName: 'Dr. Sankalp Sharma Orthopaedics & Joint Care',
    category: 'Healthcare & Orthopaedics',
    contactPerson: 'Dr. Sankalp Sharma',
    phone: '+91 98720 34567',
    email: 'dr.sankalpsharma@gmail.com',
    package: 'Growth',
    status: 'Active',
    startDate: '2024-02-15',
    instagramUrl: 'https://instagram.com/drsankalpsharma',
    facebookUrl: 'https://facebook.com/drsankalpsharma',
    websiteUrl: 'https://drsankalpsharma.com',
    createdAt: '2024-02-15T00:00:00.000Z',
    updatedAt: '2024-02-15T00:00:00.000Z'
  },
  {
    id: 'client_dr_amandeep_singh',
    clientId: 'client_dr_amandeep_singh',
    name: 'Dr. Amandeep Singh',
    clientName: 'Dr. Amandeep Singh',
    slug: 'dr-amandeep-singh',
    businessName: 'Dr. Amandeep Singh Cardiac & Medicine Center',
    category: 'Healthcare & Cardiology',
    contactPerson: 'Dr. Amandeep Singh',
    phone: '+91 98144 45678',
    email: 'dr.amandeepsingh@hospital.org',
    package: 'Growth',
    status: 'Active',
    startDate: '2024-03-01',
    instagramUrl: 'https://instagram.com/dramandeepsingh',
    facebookUrl: 'https://facebook.com/dramandeepsingh',
    createdAt: '2024-03-01T00:00:00.000Z',
    updatedAt: '2024-03-01T00:00:00.000Z'
  },
  {
    id: 'client_dr_rakhi_goyal',
    clientId: 'client_dr_rakhi_goyal',
    name: 'Dr. Rakhi Goyal',
    clientName: 'Dr. Rakhi Goyal',
    slug: 'dr-rakhi-goyal',
    businessName: 'Dr. Rakhi Goyal Skin, Hair & Aesthetics',
    category: 'Healthcare & Dermatology',
    contactPerson: 'Dr. Rakhi Goyal',
    phone: '+91 98765 56789',
    email: 'rakhi.goyal.skin@gmail.com',
    package: 'Premium',
    status: 'Active',
    startDate: '2024-03-10',
    instagramUrl: 'https://instagram.com/drrakhigoyal',
    facebookUrl: 'https://facebook.com/drrakhigoyal',
    youtubeUrl: 'https://youtube.com/@drrakhigoyal',
    createdAt: '2024-03-10T00:00:00.000Z',
    updatedAt: '2024-03-10T00:00:00.000Z'
  },
  {
    id: 'client_dr_nishant_setia',
    clientId: 'client_dr_nishant_setia',
    name: 'Dr. Nishant Setia',
    clientName: 'Dr. Nishant Setia',
    slug: 'dr-nishant-setia',
    businessName: 'Dr. Nishant Setia Advanced Dental & Implant Center',
    category: 'Healthcare & Dental',
    contactPerson: 'Dr. Nishant Setia',
    phone: '+91 98155 67890',
    email: 'drnishantsetia@dentalcare.com',
    package: 'Growth',
    status: 'Active',
    startDate: '2024-03-20',
    instagramUrl: 'https://instagram.com/drnishantsetia',
    facebookUrl: 'https://facebook.com/drnishantsetia',
    websiteUrl: 'https://drnishantsetia.com',
    createdAt: '2024-03-20T00:00:00.000Z',
    updatedAt: '2024-03-20T00:00:00.000Z'
  },
  {
    id: 'client_dr_bhushan_parmar',
    clientId: 'client_dr_bhushan_parmar',
    name: 'Dr. Bhushan Parmar',
    clientName: 'Dr. Bhushan Parmar',
    slug: 'dr-bhushan-parmar',
    businessName: 'Dr. Bhushan Parmar Gastro & Liver Clinic',
    category: 'Healthcare & Gastroenterology',
    contactPerson: 'Dr. Bhushan Parmar',
    phone: '+91 98788 78901',
    email: 'drbhushanparmar@gastro.in',
    package: 'Growth',
    status: 'Active',
    startDate: '2024-04-01',
    instagramUrl: 'https://instagram.com/drbhushanparmar',
    facebookUrl: 'https://facebook.com/drbhushanparmar',
    createdAt: '2024-04-01T00:00:00.000Z',
    updatedAt: '2024-04-01T00:00:00.000Z'
  },
  {
    id: 'client_silver_care',
    clientId: 'client_silver_care',
    name: 'Silver Care',
    clientName: 'Silver Care',
    slug: 'silver-care',
    businessName: 'Silver Care Elder & Home Healthcare Services',
    category: 'Senior Healthcare & Home Nursing',
    contactPerson: 'Director, Silver Care',
    phone: '+91 98141 89012',
    email: 'support@silvercareservices.com',
    package: 'Premium',
    status: 'Active',
    startDate: '2024-04-10',
    instagramUrl: 'https://instagram.com/silvercareindia',
    facebookUrl: 'https://facebook.com/silvercareindia',
    linkedinUrl: 'https://linkedin.com/company/silvercare',
    websiteUrl: 'https://silvercare.org',
    createdAt: '2024-04-10T00:00:00.000Z',
    updatedAt: '2024-04-10T00:00:00.000Z'
  },
  {
    id: 'client_dr_navjot_singh',
    clientId: 'client_dr_navjot_singh',
    name: 'Dr. Navjot Singh',
    clientName: 'Dr. Navjot Singh',
    slug: 'dr-navjot-singh',
    businessName: 'Dr. Navjot Singh ENT & Head Neck Surgery',
    category: 'Healthcare & ENT Surgery',
    contactPerson: 'Dr. Navjot Singh',
    phone: '+91 98722 90123',
    email: 'drnavjotsinghent@gmail.com',
    package: 'Starter',
    status: 'Active',
    startDate: '2024-04-20',
    instagramUrl: 'https://instagram.com/drnavjotsinghent',
    facebookUrl: 'https://facebook.com/drnavjotsinghent',
    createdAt: '2024-04-20T00:00:00.000Z',
    updatedAt: '2024-04-20T00:00:00.000Z'
  },
  {
    id: 'client_dr_deval_gadhvi',
    clientId: 'client_dr_deval_gadhvi',
    name: 'Dr. Deval Gadhvi',
    clientName: 'Dr. Deval Gadhvi',
    slug: 'dr-deval-gadhvi',
    businessName: 'Dr. Deval Gadhvi Pediatrics & Neonatology',
    category: 'Healthcare & Pediatrics',
    contactPerson: 'Dr. Deval Gadhvi',
    phone: '+91 98250 01234',
    email: 'drdevalgadhvi@childcare.com',
    package: 'Growth',
    status: 'Active',
    startDate: '2024-05-01',
    instagramUrl: 'https://instagram.com/drdevalgadhvi',
    facebookUrl: 'https://facebook.com/drdevalgadhvi',
    createdAt: '2024-05-01T00:00:00.000Z',
    updatedAt: '2024-05-01T00:00:00.000Z'
  },
  {
    id: 'client_housing_partners',
    clientId: 'client_housing_partners',
    name: 'Housing Partners',
    clientName: 'Housing Partners',
    slug: 'housing-partners',
    businessName: 'Housing Partners Real Estate & Property Advisory',
    category: 'Real Estate & Properties',
    contactPerson: 'Managing Partner',
    phone: '+91 98155 12345',
    email: 'contact@housingpartners.in',
    package: 'Premium',
    status: 'Active',
    startDate: '2024-05-15',
    instagramUrl: 'https://instagram.com/housingpartners',
    facebookUrl: 'https://facebook.com/housingpartners',
    linkedinUrl: 'https://linkedin.com/company/housingpartners',
    websiteUrl: 'https://housingpartners.in',
    createdAt: '2024-05-15T00:00:00.000Z',
    updatedAt: '2024-05-15T00:00:00.000Z'
  },
  {
    id: 'client_pranav_bansal',
    clientId: 'client_pranav_bansal',
    name: 'Pranav Bansal',
    clientName: 'Pranav Bansal',
    slug: 'pranav-bansal',
    businessName: 'Pranav Bansal Ventures & Consultancy',
    category: 'Business & Financial Consultancy',
    contactPerson: 'Pranav Bansal',
    phone: '+91 98760 23456',
    email: 'pranav@bansalventures.com',
    package: 'Growth',
    status: 'Active',
    startDate: '2024-06-01',
    instagramUrl: 'https://instagram.com/pranavbansal',
    linkedinUrl: 'https://linkedin.com/in/pranavbansal',
    createdAt: '2024-06-01T00:00:00.000Z',
    updatedAt: '2024-06-01T00:00:00.000Z'
  },
  {
    id: 'client_gangotri_ice_cubes',
    clientId: 'client_gangotri_ice_cubes',
    name: 'Gangotri Ice Cubes',
    clientName: 'Gangotri Ice Cubes',
    slug: 'gangotri-ice-cubes',
    businessName: 'Gangotri Ice Cubes & Packaged Cold Solutions',
    category: 'Manufacturing & FMCG',
    contactPerson: 'Operations Lead',
    phone: '+91 98142 34567',
    email: 'sales@gangotriice.com',
    package: 'Growth',
    status: 'Active',
    startDate: '2024-06-15',
    instagramUrl: 'https://instagram.com/gangotriice',
    facebookUrl: 'https://facebook.com/gangotriice',
    createdAt: '2024-06-15T00:00:00.000Z',
    updatedAt: '2024-06-15T00:00:00.000Z'
  },
  {
    id: 'client_dashmesh_ornamentals',
    clientId: 'client_dashmesh_ornamentals',
    name: 'Dashmesh Ornamentals',
    clientName: 'Dashmesh Ornamentals',
    slug: 'dashmesh-ornamentals',
    businessName: 'Dashmesh Ornamentals & Architectural Hardware',
    category: 'Architectural & Hardware Manufacturing',
    contactPerson: 'Managing Director',
    phone: '+91 98721 45678',
    email: 'contact@dashmeshhardware.com',
    package: 'Starter',
    status: 'Active',
    startDate: '2024-07-01',
    instagramUrl: 'https://instagram.com/dashmeshornamentals',
    facebookUrl: 'https://facebook.com/dashmeshornamentals',
    websiteUrl: 'https://dashmeshornamentals.com',
    createdAt: '2024-07-01T00:00:00.000Z',
    updatedAt: '2024-07-01T00:00:00.000Z'
  },
  {
    id: 'client_bajwa_taxi_service',
    clientId: 'client_bajwa_taxi_service',
    name: 'Bajwa Taxi Service',
    clientName: 'Bajwa Taxi Service',
    slug: 'bajwa-taxi-service',
    businessName: 'Bajwa Taxi Service & Intercity Travel',
    category: 'Travel & Transportation',
    contactPerson: 'Bajwa Travel Desk',
    phone: '+91 98150 56789',
    email: 'booking@bajwataxi.com',
    package: 'Starter',
    status: 'Active',
    startDate: '2024-07-15',
    instagramUrl: 'https://instagram.com/bajwataxiservice',
    facebookUrl: 'https://facebook.com/bajwataxiservice',
    websiteUrl: 'https://bajwataxiservice.com',
    createdAt: '2024-07-15T00:00:00.000Z',
    updatedAt: '2024-07-15T00:00:00.000Z'
  },
  {
    id: 'client_sahayak_insurance',
    clientId: 'client_sahayak_insurance',
    name: 'Sahayak Insurance',
    clientName: 'Sahayak Insurance',
    slug: 'sahayak-insurance',
    businessName: 'Sahayak Insurance & Financial Security Solutions',
    category: 'Financial Services & Insurance',
    contactPerson: 'Lead Advisor',
    phone: '+91 98762 67890',
    email: 'info@sahayakinsurance.com',
    package: 'Growth',
    status: 'Active',
    startDate: '2024-08-01',
    instagramUrl: 'https://instagram.com/sahayakinsurance',
    facebookUrl: 'https://facebook.com/sahayakinsurance',
    linkedinUrl: 'https://linkedin.com/company/sahayak-insurance',
    createdAt: '2024-08-01T00:00:00.000Z',
    updatedAt: '2024-08-01T00:00:00.000Z'
  },
  {
    id: 'client_rajeev_k_vashishta',
    clientId: 'client_rajeev_k_vashishta',
    name: 'Rajeev K. Vashishta',
    clientName: 'Rajeev K. Vashishta',
    slug: 'rajeev-k-vashishta',
    businessName: 'Advocate Rajeev K. Vashishta Legal Advisory',
    category: 'Legal & Corporate Advisory',
    contactPerson: 'Advocate Rajeev K. Vashishta',
    phone: '+91 98140 78901',
    email: 'office@rajeevvashishta.com',
    package: 'Growth',
    status: 'Active',
    startDate: '2024-08-15',
    instagramUrl: 'https://instagram.com/rajeevkvashishta',
    linkedinUrl: 'https://linkedin.com/in/rajeevkvashishta',
    createdAt: '2024-08-15T00:00:00.000Z',
    updatedAt: '2024-08-15T00:00:00.000Z'
  },
  {
    id: 'client_bachan_gas_service',
    clientId: 'client_bachan_gas_service',
    name: 'Bachan Gas Service',
    clientName: 'Bachan Gas Service',
    slug: 'bachan-gas-service',
    businessName: 'Bachan Gas Service & Commercial LPG Distribution',
    category: 'Energy & Utility Services',
    contactPerson: 'Manager, Bachan Gas',
    phone: '+91 98780 89012',
    email: 'support@bachangas.com',
    package: 'Starter',
    status: 'Active',
    startDate: '2024-09-01',
    facebookUrl: 'https://facebook.com/bachangasservice',
    createdAt: '2024-09-01T00:00:00.000Z',
    updatedAt: '2024-09-01T00:00:00.000Z'
  },
  {
    id: 'client_dr_kritarth',
    clientId: 'client_dr_kritarth',
    name: 'Dr. Kritarth',
    clientName: 'Dr. Kritarth',
    slug: 'dr-kritarth',
    businessName: 'Dr. Kritarth Pulmonology & Chest Medicine Clinic',
    category: 'Healthcare & Pulmonology',
    contactPerson: 'Dr. Kritarth',
    phone: '+91 98155 90123',
    email: 'dr.kritarth@chestcare.org',
    package: 'Premium',
    status: 'Active',
    startDate: '2024-09-10',
    instagramUrl: 'https://instagram.com/drkritarth',
    facebookUrl: 'https://facebook.com/drkritarth',
    youtubeUrl: 'https://youtube.com/@drkritarth',
    websiteUrl: 'https://drkritarth.com',
    createdAt: '2024-09-10T00:00:00.000Z',
    updatedAt: '2024-09-10T00:00:00.000Z'
  },
  {
    id: 'client_dr_akash_gandotra',
    clientId: 'client_dr_akash_gandotra',
    name: 'Dr. Akash Gandotra',
    clientName: 'Dr. Akash Gandotra',
    slug: 'dr-akash-gandotra',
    businessName: 'Dr. Akash Gandotra Eye Care & Laser Vision Center',
    category: 'Healthcare & Ophthalmology',
    contactPerson: 'Dr. Akash Gandotra',
    phone: '+91 98725 01234',
    email: 'drakash@laservision.in',
    package: 'Premium',
    status: 'Active',
    startDate: '2024-09-15',
    instagramUrl: 'https://instagram.com/drakashgandotra',
    facebookUrl: 'https://facebook.com/drakashgandotra',
    youtubeUrl: 'https://youtube.com/@drakashgandotra',
    websiteUrl: 'https://drakashgandotra.com',
    createdAt: '2024-09-15T00:00:00.000Z',
    updatedAt: '2024-09-15T00:00:00.000Z'
  },
  {
    id: 'client_dr_puneet_kumar',
    clientId: 'client_dr_puneet_kumar',
    name: 'Dr. Puneet Kumar',
    clientName: 'Dr. Puneet Kumar',
    slug: 'dr-puneet-kumar',
    businessName: 'Dr. Puneet Kumar Endocrinology & Diabetes Care',
    category: 'Healthcare & Endocrinology',
    contactPerson: 'Dr. Puneet Kumar',
    phone: '+91 98149 12340',
    email: 'drpuneetkumar@diabetescare.in',
    package: 'Growth',
    status: 'Active',
    startDate: '2024-09-20',
    instagramUrl: 'https://instagram.com/drpuneetkumar',
    facebookUrl: 'https://facebook.com/drpuneetkumar',
    websiteUrl: 'https://drpuneetkumar.com',
    createdAt: '2024-09-20T00:00:00.000Z',
    updatedAt: '2024-09-20T00:00:00.000Z'
  }
];

export const DEFAULT_CLIENTS_MASTER = CENTRAL_CLIENT_MASTER_LIST;

export const getCachedClients = (): CentralClient[] => {
  return DEFAULT_CLIENTS_MASTER;
};

// In-memory cache & initialization flag
let isSeedingCompleted = false;

/**
 * Ensures all 21 central master clients are present in Firestore.
 * Preserves any customized fields already modified by admins in Firestore.
 */
export async function ensureCentralClientsSeeded(): Promise<void> {
  if (isSeedingCompleted) return;
  
  try {
    const clientsRef = collection(db, 'clients');
    const snapshot = await getDocs(clientsRef);
    
    // Map existing records by clientId and by normalized name
    const existingById = new Set<string>();
    const existingByName = new Set<string>();
    
    snapshot.forEach((docSnap) => {
      existingById.add(docSnap.id);
      const data = docSnap.data();
      if (data.clientName) {
        existingByName.add(data.clientName.trim().toLowerCase());
      }
      if (data.name) {
        existingByName.add(data.name.trim().toLowerCase());
      }
    });

    // Add any missing master clients
    const seedingPromises: Promise<void>[] = [];
    for (const masterClient of CENTRAL_CLIENT_MASTER_LIST) {
      const normalizedName = masterClient.name.trim().toLowerCase();
      if (!existingById.has(masterClient.id) && !existingByName.has(normalizedName)) {
        seedingPromises.push(
          setDoc(doc(db, 'clients', masterClient.id), masterClient, { merge: true })
        );
      }
    }

    if (seedingPromises.length > 0) {
      await Promise.all(seedingPromises);
    }
    isSeedingCompleted = true;
  } catch (error) {
    console.warn('Central clients seeding non-critical notice (offline or permission wait):', error);
  }
}

export function subscribeToCanonicalClients(
  onUpdate: (clients: CentralClient[]) => void,
  onError?: (err: any) => void
): () => void {
  onUpdate(DEFAULT_CLIENTS_MASTER);
  ensureCentralClientsSeeded().catch(() => {});

  try {
    const unsub = onSnapshot(collection(db, 'clients'), (snapshot) => {
      if (!snapshot.empty) {
        const list = snapshot.docs.map(d => ({ id: d.id, clientId: d.id, ...d.data() } as CentralClient));
        onUpdate(list.length > 0 ? list : DEFAULT_CLIENTS_MASTER);
      } else {
        onUpdate(DEFAULT_CLIENTS_MASTER);
      }
    }, (err) => {
      console.warn('Clients snapshot notice (using local fallback):', err);
      onUpdate(DEFAULT_CLIENTS_MASTER);
      if (onError) onError(err);
    });
    return unsub;
  } catch (e) {
    if (onError) onError(e);
    return () => {};
  }
}

