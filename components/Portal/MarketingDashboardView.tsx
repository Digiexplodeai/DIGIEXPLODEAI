import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Target,
  Activity,
  Globe,
  MapPin,
  Phone,
  Mail,
  MessageSquare,
  Search,
  Filter,
  Download,
  Plus,
  RefreshCw,
  ExternalLink,
  Clock,
  Laptop,
  Smartphone,
  Tablet,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Award,
  Sparkles,
  Trash2,
  Edit3,
  X,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Flame,
  PieChart,
  Layers
} from 'lucide-react';
import {
  InboundLead,
  getInboundLeads,
  updateLeadStatus,
  updateLeadNotes,
  deleteInboundLead,
  createInboundLead,
  exportLeadsToCsv,
  subscribeToCanonicalLeads
} from '../../lib/marketingLeads';
import {
  VisitorSession,
  getVisitorSessions,
  subscribeToCanonicalVisitors,
  trackPageView
} from '../../lib/marketingTracker';

export const MarketingDashboardView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'leads' | 'visitors' | 'analytics'>('leads');
  const [leads, setLeads] = useState<InboundLead[]>(() => getInboundLeads());
  const [visitors, setVisitors] = useState<VisitorSession[]>(() => getVisitorSessions());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageFilter, setPageFilter] = useState<string>('all');

  // Manual Add Lead Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadLoc, setNewLeadLoc] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadContact, setNewLeadContact] = useState('');
  const [newLeadInterest, setNewLeadInterest] = useState('');
  const [newLeadNotes, setNewLeadNotes] = useState('');

  // Editing Note State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // Real-time subscription to Cloudflare D1
  useEffect(() => {
    const unsubLeads = subscribeToCanonicalLeads((updatedLeads) => {
      setLeads(updatedLeads);
    });

    const unsubVisitors = subscribeToCanonicalVisitors((updatedVisitors) => {
      setVisitors(updatedVisitors);
    });

    const handleLeadsUpdate = () => setLeads(getInboundLeads());
    const handleVisitorEvent = () => setVisitors(getVisitorSessions());

    window.addEventListener('digiexplode_new_lead', handleLeadsUpdate);
    window.addEventListener('digiexplode_leads_updated', handleLeadsUpdate);
    window.addEventListener('digiexplode_visitor_event', handleVisitorEvent);

    return () => {
      unsubLeads();
      unsubVisitors();
      window.removeEventListener('digiexplode_new_lead', handleLeadsUpdate);
      window.removeEventListener('digiexplode_leads_updated', handleLeadsUpdate);
      window.removeEventListener('digiexplode_visitor_event', handleVisitorEvent);
    };
  }, []);

  const loadData = () => {
    setLeads(getInboundLeads());
    setVisitors(getVisitorSessions());
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      const matchesPage = pageFilter === 'all' || lead.sourcePage === pageFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        lead.name.toLowerCase().includes(q) ||
        lead.location.toLowerCase().includes(q) ||
        (lead.email && lead.email.toLowerCase().includes(q)) ||
        (lead.contact && lead.contact.toLowerCase().includes(q)) ||
        (lead.interest && lead.interest.toLowerCase().includes(q));

      return matchesStatus && matchesPage && matchesQuery;
    });
  }, [leads, statusFilter, pageFilter, searchQuery]);

  // Key KPI stats based on real data
  const totalLeadsCount = leads.length;
  const newLeadsCount = leads.filter(l => l.status === 'new').length;
  const convertedLeadsCount = leads.filter(l => l.status === 'converted').length;
  const activeVisitorsCount = visitors.filter(v => v.status === 'active').length;
  const conversionRate = (visitors.length > 0 && totalLeadsCount > 0)
    ? Math.min(100, (totalLeadsCount / visitors.length) * 100).toFixed(1)
    : '0.0';

  // Dynamic Pipeline Value calculated from real leads
  const pipelineValueFormatted = useMemo(() => {
    let sum = 0;
    for (const l of leads) {
      if (l.status === 'lost') continue;
      const match = (l.estimatedValue || '').replace(/[^\d.]/g, '');
      const parsed = parseFloat(match);
      if (!isNaN(parsed) && parsed > 0) sum += parsed;
    }
    if (sum === 0) return '₹0';
    if (sum >= 100000) return `₹${(sum / 100000).toFixed(2)}L`;
    return `₹${sum.toLocaleString('en-IN')}`;
  }, [leads]);

  // Top cities derived dynamically from real visitor sessions
  const topCities = useMemo(() => {
    if (visitors.length === 0) return [];
    const counts: Record<string, number> = {};
    for (const v of visitors) {
      const city = v.city || 'India';
      counts[city] = (counts[city] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([city, count]) => ({
        city,
        count,
        pct: `${Math.round((count / visitors.length) * 100)}%`
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [visitors]);

  // Top pages derived dynamically from real visitor sessions
  const topPages = useMemo(() => {
    if (visitors.length === 0) return [];
    const counts: Record<string, number> = {};
    for (const v of visitors) {
      const p = v.currentPage || '/';
      counts[p] = (counts[p] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([page, visits]) => {
        const pageLeads = leads.filter(l => l.sourcePage === page).length;
        const cr = visits > 0 ? `${((pageLeads / visits) * 100).toFixed(1)}%` : '0.0%';
        return { page, visits, leads: pageLeads, cr };
      })
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 5);
  }, [visitors, leads]);

  // Acquisition channels derived dynamically from real visitors
  const channelBreakdown = useMemo(() => {
    if (visitors.length === 0) return [];
    const counts: Record<string, number> = {
      'Google (Search & Ads)': 0,
      'Meta & Instagram': 0,
      'Direct Visit': 0,
      'Referral & Links': 0
    };
    for (const v of visitors) {
      const ref = (v.referrer || '').toLowerCase();
      if (ref.includes('google')) counts['Google (Search & Ads)']++;
      else if (ref.includes('meta') || ref.includes('instagram') || ref.includes('facebook')) counts['Meta & Instagram']++;
      else if (ref.includes('direct')) counts['Direct Visit']++;
      else counts['Referral & Links']++;
    }
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      pct: `${Math.round((count / visitors.length) * 100)}%`
    }));
  }, [visitors]);

  const handleCreateManualLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName.trim()) return;

    createInboundLead({
      name: newLeadName,
      location: newLeadLoc,
      email: newLeadEmail || undefined,
      contact: newLeadContact || undefined,
      interest: newLeadInterest || 'Inbound Lead (Logged by Admin)',
      notes: newLeadNotes || 'Manually logged in CRM by agency admin.',
      sourcePage: '/admin/manual'
    });

    setIsAddModalOpen(false);
    setNewLeadName('');
    setNewLeadLoc('');
    setNewLeadEmail('');
    setNewLeadContact('');
    setNewLeadInterest('');
    setNewLeadNotes('');
  };

  const handleStatusChange = (id: string, newStatus: InboundLead['status']) => {
    updateLeadStatus(id, newStatus);
  };

  const handleSaveNote = (id: string) => {
    updateLeadNotes(id, noteText);
    setEditingNoteId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in p-4 sm:p-6 max-w-7xl mx-auto">
      
      {/* ─── TOP COMMAND BAR ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#0D1224] p-5 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#10B981] animate-ping" />
            <span className="text-[11px] font-black uppercase tracking-wider text-[#2563FF] dark:text-[#38BDF8]">
              LIVE INBOUND TELEMETRY & MARKETING CRM
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Marketing Command Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time display of website visitors, inbound lead capture, conversion tracking, and direct sales outreach.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => exportLeadsToCsv(filteredLeads)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
          >
            <Download className="w-4 h-4 text-[#2563FF]" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#6C4CFF] to-[#2563FF] hover:from-[#5A38EE] hover:to-[#1E4FE6] text-white text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Inbound Lead</span>
          </button>

          <button
            onClick={loadData}
            title="Refresh Live Data"
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── REAL-TIME KPI TILES ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        
        {/* Metric 1: Live Visitors Right Now */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D1224] border border-slate-200 dark:border-white/10 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Live Online Right Now</span>
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {activeVisitorsCount}
            </p>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">
              Active Now
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Browsing Doctors, Home, Projects</p>
        </div>

        {/* Metric 2: Total Leads Captured */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D1224] border border-slate-200 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Form Leads</span>
            <Target className="w-4 h-4 text-[#6C4CFF]" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {totalLeadsCount}
            </p>
            {newLeadsCount > 0 && (
              <span className="text-[10px] font-extrabold text-white bg-rose-500 px-2 py-0.5 rounded-full animate-bounce">
                {newLeadsCount} New
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Pop-up & Landing Page forms</p>
        </div>

        {/* Metric 3: Converted Clients */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D1224] border border-slate-200 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Deals Closed</span>
            <Award className="w-4 h-4 text-[#059669]" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl sm:text-3xl font-black text-[#059669]">
              {convertedLeadsCount}
            </p>
            <span className="text-[10px] font-bold text-slate-400">
              Onboarded
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Retainers & Web projects</p>
        </div>

        {/* Metric 4: Form Conversion Rate */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D1224] border border-slate-200 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Conversion Rate</span>
            <TrendingUp className="w-4 h-4 text-[#2563FF]" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl sm:text-3xl font-black text-[#2563FF]">
              {conversionRate}%
            </p>
            <span className="text-[10px] font-bold text-slate-400">
              {visitors.length} visits
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Visitors to Qualified Inquiries</p>
        </div>

        {/* Metric 5: Estimated Pipeline Potential */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D1224] border border-slate-200 dark:border-white/10 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pipeline Value</span>
            <Flame className="w-4 h-4 text-[#EA580C]" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {pipelineValueFormatted}
            </p>
            <span className="text-[10px] font-bold text-[#EA580C]">
              Active Leads
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Projected MRR & Retainers</p>
        </div>

      </div>

      {/* ─── SUB-NAVIGATION TABS ────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
        <button
          onClick={() => setActiveSubTab('leads')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'leads'
              ? 'bg-[#2563FF] text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Inbound Leads ({leads.length})</span>
          {newLeadsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-extrabold">
              {newLeadsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('visitors')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'visitors'
              ? 'bg-[#2563FF] text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Website Visitor Tracker ({visitors.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'analytics'
              ? 'bg-[#2563FF] text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <PieChart className="w-4 h-4" />
          <span>Geo & Funnel Analytics</span>
        </button>
      </div>

      {/* ─── TAB 1: INBOUND LEADS (CRM TABLE) ────────────────────────── */}
      {activeSubTab === 'leads' && (
        <div className="space-y-4">
          
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#0D1224] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs">
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search leads by name, city, phone, email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-[#2563FF]"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {['all', 'new', 'contacted', 'in_discussion', 'converted', 'lost'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-all whitespace-nowrap cursor-pointer ${
                    statusFilter === st
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

          </div>

          {/* Leads Table */}
          <div className="bg-white dark:bg-[#0D1224] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            {filteredLeads.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Target className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Inbound Leads Found</p>
                <p className="text-xs text-slate-400 mt-1">Try clearing your search query or filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-white/5 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-white/10">
                    <tr>
                      <th className="py-3 px-4">Lead / Prospect</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Contact & Outreach</th>
                      <th className="py-3 px-4">Inquiry Source & Interest</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Admin Notes</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {filteredLeads.map(lead => (
                      <tr key={lead.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-all">
                        
                        {/* Name & Time */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#6C4CFF] to-[#2563FF] text-white font-black text-xs flex items-center justify-center flex-shrink-0 shadow-2xs">
                              {lead.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white leading-tight">
                                {lead.name}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(lead.timestamp).toLocaleDateString('en-IN', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            <MapPin className="w-3 h-3 text-[#2563FF]" />
                            {lead.location || 'Undisclosed'}
                          </span>
                        </td>

                        {/* Contact & Direct Outreach */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            {lead.contact && (
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900 dark:text-white">{lead.contact}</span>
                                
                                {/* One-Click WhatsApp */}
                                <a
                                  href={`https://wa.me/${lead.contact.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                    `Hi ${lead.name}, this is DigiExplodeAI. Thank you for connecting with us regarding your business growth inquiry!`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Chat on WhatsApp"
                                  className="w-6 h-6 rounded-md bg-[#25D366] text-white flex items-center justify-center hover:opacity-90 transition-all"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                </a>

                                {/* Direct Call */}
                                <a
                                  href={`tel:${lead.contact}`}
                                  title="Call Lead"
                                  className="w-6 h-6 rounded-md bg-sky-500 text-white flex items-center justify-center hover:opacity-90 transition-all"
                                >
                                  <Phone className="w-3 h-3" />
                                </a>
                              </div>
                            )}

                            {lead.email ? (
                              <a
                                href={`mailto:${lead.email}`}
                                className="text-[11px] text-[#2563FF] hover:underline flex items-center gap-1"
                              >
                                <Mail className="w-3 h-3" /> {lead.email}
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">No email provided</span>
                            )}
                          </div>
                        </td>

                        {/* Interest & Source */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {lead.interest || 'General Inquiry'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-500/10 text-[10px] font-bold text-[#0284C7]">
                              {lead.sourcePage}
                            </span>
                            {lead.referrer && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                                via {lead.referrer}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status Dropdown */}
                        <td className="py-3.5 px-4">
                          <select
                            value={lead.status}
                            onChange={e => handleStatusChange(lead.id, e.target.value as InboundLead['status'])}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold uppercase tracking-wider outline-none cursor-pointer border ${
                              lead.status === 'new'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : lead.status === 'contacted'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : lead.status === 'in_discussion'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : lead.status === 'converted'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            <option value="new">New Lead</option>
                            <option value="contacted">Contacted</option>
                            <option value="in_discussion">In Discussion</option>
                            <option value="converted">Won / Converted</option>
                            <option value="lost">Lost</option>
                          </select>
                        </td>

                        {/* Notes */}
                        <td className="py-3.5 px-4 max-w-xs">
                          {editingNoteId === lead.id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={noteText}
                                onChange={e => setNoteText(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs"
                                placeholder="Add client notes..."
                              />
                              <button
                                onClick={() => handleSaveNote(lead.id)}
                                className="p-1 bg-[#2563FF] text-white rounded-md text-[10px] font-bold cursor-pointer"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingNoteId(lead.id);
                                setNoteText(lead.notes || '');
                              }}
                              className="cursor-pointer group flex items-start gap-1"
                              title="Click to edit notes"
                            >
                              <span className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                                {lead.notes || 'Click to add note...'}
                              </span>
                              <Edit3 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              if (confirm(`Delete lead "${lead.name}"?`)) {
                                deleteInboundLead(lead.id);
                              }
                            }}
                            title="Delete Lead"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ─── TAB 2: LIVE WEBSITE VISITOR TRACKER ─────────────────────── */}
      {activeSubTab === 'visitors' && (
        <div className="space-y-4">
          
          <div className="bg-white dark:bg-[#0D1224] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Live Visitor Stream • Showing {visitors.length} Active & Recent Sessions
              </p>
            </div>
            <p className="text-[11px] text-slate-400">
              Auto-updating via telemetry heartbeats. Identifies visitor location, page journeys & active engagements.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0D1224] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            {visitors.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Globe className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600 animate-pulse" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Listening for Live Visitors</p>
                <p className="text-xs text-slate-400 mt-1">Open www.digiexplodeai.com in another tab or mobile device to see your live visitor telemetry stream here automatically.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-white/5 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-white/10">
                    <tr>
                      <th className="py-3 px-4">Visitor / IP</th>
                      <th className="py-3 px-4">Detected Location</th>
                      <th className="py-3 px-4">Active Page</th>
                      <th className="py-3 px-4">Referrer / Traffic Channel</th>
                      <th className="py-3 px-4">Device & Browser</th>
                      <th className="py-3 px-4">Time on Site</th>
                      <th className="py-3 px-4">Status & Journey</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {visitors.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-all">
                        
                        {/* IP / ID */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                v.status === 'active'
                                  ? 'bg-emerald-500 animate-pulse'
                                  : v.status === 'idle'
                                  ? 'bg-amber-400'
                                  : 'bg-slate-300'
                              }`}
                            />
                            <span>{v.ipHash}</span>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                            <MapPin className="w-3.5 h-3.5 text-[#EA580C]" />
                            <span>{v.city}, {v.country}</span>
                          </div>
                        </td>

                        {/* Current Page */}
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-500/10 text-[#2563FF] font-bold text-[11px]">
                            {v.currentPage}
                          </span>
                        </td>

                        {/* Referrer */}
                        <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 dark:text-slate-400">
                          {v.referrer}
                        </td>

                        {/* Device & Browser */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            {v.device === 'Mobile' ? (
                              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <Laptop className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            <span>{v.device} • {v.browser}</span>
                          </div>
                        </td>

                        {/* Duration */}
                        <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                          {Math.floor(v.durationSeconds / 60)}m {v.durationSeconds % 60}s
                        </td>

                        {/* Actions / Journey */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {v.actions.slice(-2).map((act, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-[10px] text-slate-600 dark:text-slate-300 font-medium"
                              >
                                {act}
                              </span>
                            ))}
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ─── TAB 3: GEO & FUNNEL ANALYTICS ───────────────────────────── */}
      {activeSubTab === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Top Visitor Cities */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0D1224] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#EA580C]" /> Top Inbound Visitor Cities
            </h3>
            
            {topCities.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No visitor locations detected yet.</p>
            ) : (
              <div className="space-y-3">
                {topCities.map((item, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span>{item.city}</span>
                      <span>{item.count} visitor{item.count === 1 ? '' : 's'} ({item.pct})</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#6C4CFF] to-[#2563FF] rounded-full"
                        style={{ width: item.pct }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Performing Landing Pages */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0D1224] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#2563FF]" /> Top Visited Pages
            </h3>

            {topPages.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No page traffic recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {topPages.map((pg, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{pg.page}</p>
                      <p className="text-[10px] text-slate-400">{pg.visits} sessions</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-[#2563FF]">{pg.leads} leads</p>
                      <p className="text-[10px] text-emerald-600 font-bold">{pg.cr} CR</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Traffic Source Breakdown */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0D1224] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-[#059669]" /> Acquisition Channel Breakdown
            </h3>

            {channelBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No traffic channels recorded yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-center">
                {channelBreakdown.map((ch, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                    <p className="text-xl font-black text-[#2563FF]">{ch.pct}</p>
                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">{ch.name}</p>
                    <p className="text-[10px] text-slate-400">{ch.count} visits</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conversion Funnel */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0D1224] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#6C4CFF]" /> Funnel Conversion Summary
            </h3>

            <div className="space-y-3">
              {[
                { stage: '1. Total Website Visitors', count: `${visitors.length} sessions`, pct: '100%' },
                { stage: '2. High-Intent Actions Logged', count: `${visitors.reduce((acc, v) => acc + (v.actions?.length || 0), 0)} actions`, pct: visitors.length > 0 ? `${Math.min(100, Math.round((visitors.filter(v => (v.actions?.length || 0) > 1).length / visitors.length) * 100))}%` : '0%' },
                { stage: '3. Inbound Leads Captured', count: `${totalLeadsCount} leads`, pct: conversionRate + '%' },
                { stage: '4. Converted / Onboarded', count: `${convertedLeadsCount} deals`, pct: totalLeadsCount > 0 ? `${((convertedLeadsCount / totalLeadsCount) * 100).toFixed(1)}%` : '0.0%' }
              ].map((f, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{f.stage}</span>
                  <div className="text-right">
                    <span className="font-black text-[#2563FF] mr-2">{f.count}</span>
                    <span className="text-[10px] text-slate-400">({f.pct})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ─── MODAL: ADD LEAD MANUALLY ───────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#0D1224] border border-slate-200 dark:border-white/10 shadow-2xl p-6 text-[#0F172A] dark:text-white"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-[#2563FF]" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Log Inbound Lead Manually
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualLead} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px] font-bold mb-1">
                  Full Name / Doctor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Raghav Singla"
                  value={newLeadName}
                  onChange={e => setNewLeadName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-[#2563FF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px] font-bold mb-1">
                    City / Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chandigarh, Mohali"
                    value={newLeadLoc}
                    onChange={e => setNewLeadLoc(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-[#2563FF]"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px] font-bold mb-1">
                    Contact / WhatsApp
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765..."
                    value={newLeadContact}
                    onChange={e => setNewLeadContact(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-[#2563FF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px] font-bold mb-1">
                  Email ID
                </label>
                <input
                  type="email"
                  placeholder="client@company.com"
                  value={newLeadEmail}
                  onChange={e => setNewLeadEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-[#2563FF]"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px] font-bold mb-1">
                  Interest / Requirement
                </label>
                <input
                  type="text"
                  placeholder="e.g. Doctor Google Ads, Clinic OPD Growth, Web Development"
                  value={newLeadInterest}
                  onChange={e => setNewLeadInterest(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-[#2563FF]"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px] font-bold mb-1">
                  Initial Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Any details discussed, budget, follow-up timeline..."
                  value={newLeadNotes}
                  onChange={e => setNewLeadNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 outline-none focus:border-[#2563FF]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#2563FF] hover:bg-[#1E4FE6] text-white text-xs font-black shadow-md cursor-pointer"
                >
                  Save Inbound Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default MarketingDashboardView;
