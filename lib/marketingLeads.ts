/**
 * DigiExplodeAI — Inbound Marketing Leads Service
 * Stores, manages, and syncs inbound prospect leads captured via website modals and forms.
 */

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
}

const STORAGE_KEY = 'digiexplode_inbound_leads_v1';

// Initial realistic seed data so admin panel is immediately functional & populated
const INITIAL_LEADS: InboundLead[] = [
  {
    id: 'lead_101',
    name: 'Dr. Ananya Sharma',
    location: 'Delhi NCR',
    email: 'dr.ananya.derma@gmail.com',
    contact: '+91 98112 45890',
    sourcePage: '/doctors',
    interest: 'Dermatology & Hair Clinic Growth (OPD Expansion)',
    status: 'new',
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(), // 25 mins ago
    notes: 'Interested in Google Ads for PRP & Hair Transplant. Clinic in South Extension.',
    device: 'Mobile (iPhone 15)',
    referrer: 'Google Search ("doctor marketing agency delhi")',
    estimatedValue: '₹60,000 / mo'
  },
  {
    id: 'lead_102',
    name: 'Vikramaditya Rathore',
    location: 'Chandigarh',
    email: 'vikram.rathore@rathorelogistics.in',
    contact: '+91 87250 11928',
    sourcePage: '/',
    interest: 'Full Brand Redesign & Custom Web Portal',
    status: 'contacted',
    timestamp: new Date(Date.now() - 1000 * 60 * 140).toISOString(), // 2.3 hrs ago
    notes: 'Spoke on call. Sent corporate portfolio. Follow-up meeting tomorrow at 3 PM.',
    device: 'Desktop (macOS / Chrome)',
    referrer: 'Direct Visit',
    estimatedValue: '₹1,50,000'
  },
  {
    id: 'lead_103',
    name: 'Dr. Mohit Verma',
    location: 'Mohali, Punjab',
    email: 'mohit.verma.ortho@yahoo.com',
    contact: '+91 98721 34991',
    sourcePage: '/doctors',
    interest: 'Joint Replacement Surgical Inquiries & Google Maps Top-3',
    status: 'in_discussion',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hrs ago
    notes: 'Wants to dominate Sector 70 & Kharar radius. Audit report shared over WhatsApp.',
    device: 'Mobile (Samsung Galaxy S24)',
    referrer: 'Meta Ads (Instagram Reel)',
    estimatedValue: '₹75,000 / mo'
  },
  {
    id: 'lead_104',
    name: 'Simran Kaur Sandhu',
    location: 'Ludhiana',
    email: 'simran@zoyafashions.com',
    contact: '+91 98155 77210',
    sourcePage: '/projects',
    interest: 'E-commerce Performance Marketing (ROAS scaling)',
    status: 'converted',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    notes: 'Onboarded on Growth Tier. First month retainer paid. Kickoff call scheduled.',
    device: 'Desktop (Windows / Edge)',
    referrer: 'LinkedIn Referral',
    estimatedValue: '₹90,000 / mo'
  },
  {
    id: 'lead_105',
    name: 'Rajeev Malhotra',
    location: 'Gurugram',
    email: '',
    contact: '+91 99100 23812',
    sourcePage: '/gurugram',
    interest: 'Local SEO & PPC for Real Estate Firm',
    status: 'new',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    notes: 'Requested urgent WhatsApp consultation regarding commercial leads.',
    device: 'Mobile (OnePlus 12)',
    referrer: 'Google Local Search',
    estimatedValue: '₹1,20,000 / mo'
  }
];

export function getInboundLeads(): InboundLead[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_LEADS));
      return INITIAL_LEADS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_LEADS;
  } catch (e) {
    console.warn('[marketingLeads] Failed to read from localStorage:', e);
    return INITIAL_LEADS;
  }
}

export function saveInboundLeads(leads: InboundLead[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  } catch (e) {
    console.warn('[marketingLeads] Failed to save to localStorage:', e);
  }
}

export function createInboundLead(data: {
  name: string;
  location: string;
  email?: string;
  contact?: string;
  sourcePage?: string;
  interest?: string;
  notes?: string;
}): InboundLead {
  const all = getInboundLeads();

  const newLead: InboundLead = {
    id: `lead_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: data.name.trim(),
    location: data.location.trim() || 'Undisclosed Location',
    email: data.email?.trim() || undefined,
    contact: data.contact?.trim() || undefined,
    sourcePage: data.sourcePage || (typeof window !== 'undefined' ? window.location.pathname : '/'),
    interest: data.interest || 'General Digital Growth Inquiry',
    status: 'new',
    timestamp: new Date().toISOString(),
    notes: data.notes || 'Inbound lead captured via website pop-up form.',
    device: typeof window !== 'undefined' && window.innerWidth < 768 ? 'Mobile' : 'Desktop',
    referrer: typeof document !== 'undefined' && document.referrer ? document.referrer : 'Direct Visit',
    estimatedValue: '₹50,000 - ₹1,00,000'
  };

  const updated = [newLead, ...all];
  saveInboundLeads(updated);

  // Dispatch global window event for real-time dashboard reactivity
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('digiexplode_new_lead', { detail: newLead }));
  }

  return newLead;
}

export function updateLeadStatus(id: string, status: InboundLead['status']): void {
  const all = getInboundLeads();
  const updated = all.map(l => (l.id === id ? { ...l, status } : l));
  saveInboundLeads(updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('digiexplode_leads_updated'));
  }
}

export function updateLeadNotes(id: string, notes: string): void {
  const all = getInboundLeads();
  const updated = all.map(l => (l.id === id ? { ...l, notes } : l));
  saveInboundLeads(updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('digiexplode_leads_updated'));
  }
}

export function deleteInboundLead(id: string): void {
  const all = getInboundLeads();
  const updated = all.filter(l => l.id !== id);
  saveInboundLeads(updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('digiexplode_leads_updated'));
  }
}

export function exportLeadsToCsv(leads: InboundLead[]): void {
  const headers = ['ID', 'Name', 'Location', 'Email', 'Contact', 'Source Page', 'Interest', 'Status', 'Timestamp', 'Notes'];
  const rows = leads.map(l => [
    `"${l.id}"`,
    `"${l.name.replace(/"/g, '""')}"`,
    `"${l.location.replace(/"/g, '""')}"`,
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
