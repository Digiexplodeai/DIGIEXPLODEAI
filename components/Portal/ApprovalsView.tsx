import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle2, XCircle, Clock, Eye, BadgeCheck, MessageSquare,
  ExternalLink, Instagram, Youtube, Facebook, Globe, Image,
  Video, X, Send, Loader2, RotateCcw, Filter, ChevronDown, ChevronRight,
  CheckSquare, Film, Sparkles, AlertCircle, AlertTriangle, User,
  Calendar, Layers, Tag, RefreshCw, ArrowUpRight, History
} from 'lucide-react';
import {
  type CanonicalApprovalRecord,
  type ApprovalStatus,
  type ApprovalSourceType,
  subscribeToCanonicalApprovals,
  approveApprovalRecord,
  requestRevisionApprovalRecord,
  getCachedApprovals,
  syncExistingSourcesToApprovals,
} from '../../lib/approvalStorage';
import { type ClientData } from './ClientList';
import { DEFAULT_CLIENTS_MASTER, ensureCentralClientsSeeded } from '../../lib/clientMaster';
import { collection, onSnapshot, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface ApprovalsViewProps {
  setActiveTab?: (tab: string) => void;
}

const platformIcon = (platform?: string) => {
  const p = (platform || '').toLowerCase();
  if (p.includes('instagram')) return Instagram;
  if (p.includes('youtube'))   return Youtube;
  if (p.includes('facebook'))  return Facebook;
  return Globe;
};

const sourceTypeMeta: Record<ApprovalSourceType, { label: string; icon: React.ElementType; color: string; badge: string }> = {
  task: {
    label: 'Task',
    icon: CheckSquare,
    color: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30'
  },
  content: {
    label: 'Social Content',
    icon: Calendar,
    color: 'text-purple-600 dark:text-purple-400',
    badge: 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30'
  },
  video: {
    label: 'Video Production',
    icon: Film,
    color: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
  },
};

const calculateWaitingDuration = (submittedAt?: string): string => {
  if (!submittedAt) return 'Just now';
  try {
    const diffMs = Date.now() - new Date(submittedAt).getTime();
    if (diffMs < 0) return 'Just now';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${Math.max(1, mins)}m waiting`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h waiting`;
    const days = Math.floor(hrs / 24);
    return `${days}d waiting`;
  } catch {
    return 'Waiting';
  }
};

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({ setActiveTab }) => {
  const { profile } = useAuth();
  const [approvals, setApprovals] = useState<CanonicalApprovalRecord[]>(() => getCachedApprovals());
  const [clients, setClients] = useState<ClientData[]>(DEFAULT_CLIENTS_MASTER);
  
  // State machine: 'loading' | 'success' | 'error' | 'timeout'
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error' | 'timeout'>('loading');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filter states
  const [activeTabFilter, setActiveTabFilter] = useState<'pending' | 'approved' | 'revision_requested' | 'all'>('pending');
  const [filterClient, setFilterClient] = useState('');
  const [filterSourceType, setFilterSourceType] = useState<string>('all');
  
  // Modals & Drawers
  const [detailItem, setDetailItem] = useState<CanonicalApprovalRecord | null>(null);
  const [revisionModalItem, setRevisionModalItem] = useState<CanonicalApprovalRecord | null>(null);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load clients with live listener
  useEffect(() => {
    ensureCentralClientsSeeded();
    const unsub = onSnapshot(collection(db, 'clients'), (snap) => {
      if (!snap.empty) {
        setClients(snap.docs.map(d => ({ clientId: d.id, ...d.data() } as ClientData)));
      } else {
        setClients(DEFAULT_CLIENTS_MASTER);
      }
    }, () => {
      setClients(DEFAULT_CLIENTS_MASTER);
    });
    return () => unsub();
  }, []);

  // Main Realtime Subscription to Canonical Approvals
  const loadApprovalsData = useCallback(() => {
    setLoadState('loading');
    let hasLoaded = false;

    // Safety timeout: never hang indefinitely on skeleton
    const timer = setTimeout(() => {
      if (!hasLoaded) {
        setLoadState(prev => prev === 'loading' ? 'timeout' : prev);
      }
    }, 4500);

    const unsub = subscribeToCanonicalApprovals(
      (data) => {
        hasLoaded = true;
        clearTimeout(timer);
        setApprovals(data);
        setLoadState('success');
      },
      (err) => {
        console.warn('Approvals subscription notice:', err);
        clearTimeout(timer);
        setLoadState(prev => prev === 'loading' ? 'error' : prev);
      }
    );

    // Initial background sync from active sources
    syncExistingSourcesToApprovals().then(synced => {
      if (synced && synced.length > 0) {
        setApprovals(synced);
        setLoadState('success');
      }
    }).catch(() => {});

    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  useEffect(() => {
    const unsub = loadApprovalsData();

    // Listen for custom event updates across the app
    const handleUpdated = (e: any) => {
      const cached = getCachedApprovals();
      setApprovals(cached);
    };

    window.addEventListener('approvals_updated', handleUpdated);
    window.addEventListener('storage', handleUpdated);

    return () => {
      unsub();
      window.removeEventListener('approvals_updated', handleUpdated);
      window.removeEventListener('storage', handleUpdated);
    };
  }, [loadApprovalsData]);

  // Dedicated manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const synced = await syncExistingSourcesToApprovals();
      const current = getCachedApprovals();
      setApprovals(current.length > 0 ? current : synced);
      setLoadState('success');
      showToast('✓ Review queue refreshed & synced across modules');
    } catch (err) {
      console.warn('Manual refresh notice:', err);
      const cached = getCachedApprovals();
      setApprovals(cached);
      showToast('Queue refreshed from local storage', 'info');
    } finally {
      setTimeout(() => setIsRefreshing(false), 450);
    }
  };

  // Handle Approve Action
  const handleApprove = async (item: CanonicalApprovalRecord) => {
    if (item.status !== 'pending') {
      showToast('Item is already reviewed', 'info');
      return;
    }
    setActionLoadingId(item.id);
    try {
      await approveApprovalRecord(item.id, profile);
      showToast(`✓ Approved: "${item.title}" — Source updated & Work Log synced`);
      if (detailItem?.id === item.id) {
        setDetailItem(null);
      }
    } catch (err: any) {
      console.error('Approval failed:', err);
      showToast(`Failed to approve: ${err?.message || 'Error'}`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Request Revision Action
  const handleRequestRevisionSubmit = async () => {
    if (!revisionModalItem) return;
    if (!revisionNotes.trim()) {
      showToast('Please provide revision notes explaining required changes', 'error');
      return;
    }

    setActionLoadingId(revisionModalItem.id);
    try {
      await requestRevisionApprovalRecord(revisionModalItem.id, revisionNotes, profile);
      showToast(`Revision requested for "${revisionModalItem.title}" — Sent back to active work`);
      setRevisionModalItem(null);
      setRevisionNotes('');
      if (detailItem?.id === revisionModalItem.id) {
        setDetailItem(null);
      }
    } catch (err: any) {
      console.error('Revision request failed:', err);
      showToast(`Failed to request revision: ${err?.message || 'Error'}`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ─── Filter Logic ───────────────────────────────────────────────────
  const accessibleApprovals = useMemo(() => {
    if (profile?.role === 'client') {
      return approvals.filter(a => a.client_id === profile.clientId || a.clientId === profile.clientId);
    }
    if (profile?.role === 'admin' && profile.assignedClientIds && profile.assignedClientIds.length > 0) {
      return approvals.filter(a => profile.assignedClientIds.includes(a.client_id || a.clientId));
    }
    return approvals;
  }, [approvals, profile]);

  // Apply Client filter & Source filter
  const clientFilteredApprovals = useMemo(() => {
    return accessibleApprovals.filter(a => {
      if (filterClient && a.client_id !== filterClient && a.clientId !== filterClient) {
        return false;
      }
      if (filterSourceType !== 'all' && a.source_type !== filterSourceType && a.sourceType !== filterSourceType) {
        return false;
      }
      return true;
    });
  }, [accessibleApprovals, filterClient, filterSourceType]);

  // Derived counts based on EXACT records
  const pendingCount   = useMemo(() => clientFilteredApprovals.filter(a => a.status === 'pending').length, [clientFilteredApprovals]);
  const approvedCount  = useMemo(() => clientFilteredApprovals.filter(a => a.status === 'approved').length, [clientFilteredApprovals]);
  const revisionsCount = useMemo(() => clientFilteredApprovals.filter(a => a.status === 'revision_requested').length, [clientFilteredApprovals]);
  const totalCount     = clientFilteredApprovals.length;

  // Queue records to display for active tab
  const queueRecords = useMemo(() => {
    const list = clientFilteredApprovals.filter(a => {
      if (activeTabFilter === 'pending') return a.status === 'pending';
      if (activeTabFilter === 'approved') return a.status === 'approved';
      if (activeTabFilter === 'revision_requested') return a.status === 'revision_requested';
      return true; // 'all'
    });

    // Sort: for pending tab, oldest waiting first or urgent due date
    if (activeTabFilter === 'pending') {
      return [...list].sort((a, b) => {
        if (a.priority === 'Urgent' && b.priority !== 'Urgent') return -1;
        if (b.priority === 'Urgent' && a.priority !== 'Urgent') return 1;
        return new Date(a.submitted_at || a.created_at).getTime() - new Date(b.submitted_at || b.created_at).getTime();
      });
    }

    // Default: newest updated first
    return [...list].sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
  }, [clientFilteredApprovals, activeTabFilter]);

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-70 flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 text-white border border-white/15 shadow-2xl animate-fade-in">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
          {toast.type === 'info' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-[#6C4CFF] dark:text-[#8068FF] mb-1 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approvals & Reviews
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#101828] dark:text-white">Review Queue</h1>
          <p className="text-xs text-[#667085] dark:text-[#AEB3C5] mt-0.5">
            Single centralized review layer for Tasks, Social Content, and Video deliverables
          </p>
        </div>

        {/* Actionable Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-[#667085] dark:text-slate-200 border border-[#D8DEE9] dark:border-white/10 bg-white dark:bg-[#11152D] hover:bg-[#F2F4F7] dark:hover:bg-white/5 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#6C4CFF]' : ''}`} />
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Tabs Strip & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 p-2.5 rounded-2xl shadow-2xs">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'pending',            label: 'Pending',   count: pendingCount,   active: 'text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10' },
            { key: 'approved',           label: 'Approved',  count: approvedCount,  active: 'text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10' },
            { key: 'revision_requested', label: 'Revisions', count: revisionsCount, active: 'text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10' },
            { key: 'all',                label: 'All Items', count: totalCount,     active: 'text-[#101828] dark:text-white border-[#6C4CFF]/40 dark:border-white/25 bg-[#F2F4F7] dark:bg-white/10' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setActiveTabFilter(s.key as any)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                activeTabFilter === s.key
                  ? s.active
                  : 'text-[#667085] dark:text-[#8E99AF] border-transparent hover:bg-[#F2F4F7] dark:hover:bg-white/5'
              }`}
            >
              {s.label}
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                activeTabFilter === s.key ? 'bg-black/10 dark:bg-white/15' : 'bg-[#F2F4F7] dark:bg-white/10 text-[#667085] dark:text-slate-400'
              }`}>
                {s.count}
              </span>
            </button>
          ))}
        </div>

        {/* Dropdowns: Source Type & Client */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Source Type Filter */}
          <select
            value={filterSourceType}
            onChange={e => setFilterSourceType(e.target.value)}
            className="bg-[#F8FAFC] dark:bg-white/5 border border-[#D8DEE9] dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#101828] dark:text-white outline-none cursor-pointer"
          >
            <option value="all">All Sources</option>
            <option value="task">Tasks</option>
            <option value="content">Content Calendar</option>
            <option value="video">Video Production</option>
          </select>

          {/* Client Filter (Admin/SuperAdmin) */}
          {profile?.role !== 'client' && (
            <select
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
              className="bg-[#F8FAFC] dark:bg-white/5 border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-[#101828] dark:text-white outline-none cursor-pointer"
            >
              <option value="">All Clients</option>
              {clients.map(c => (
                <option key={c.clientId} value={c.clientId}>{c.clientName || c.businessName}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ─── MAIN CONTENT AREA / STATE MACHINE ─── */}
      {loadState === 'loading' && queueRecords.length === 0 ? (
        /* Loading State: Skeletons shown ONLY while actively loading */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl bg-[#E4E7EC] dark:bg-white/5 animate-pulse border border-[#D8DEE9] dark:border-white/10 p-5 space-y-4">
              <div className="flex justify-between items-center">
                <div className="h-4 w-28 bg-black/10 dark:bg-white/10 rounded-md" />
                <div className="h-4 w-16 bg-black/10 dark:bg-white/10 rounded-full" />
              </div>
              <div className="h-6 w-3/4 bg-black/10 dark:bg-white/10 rounded-md" />
              <div className="h-4 w-1/2 bg-black/10 dark:bg-white/10 rounded-md" />
              <div className="h-8 w-full bg-black/10 dark:bg-white/10 rounded-xl" />
            </div>
          ))}
        </div>
      ) : loadState === 'error' || loadState === 'timeout' ? (
        /* Error or Timeout state with Retry */
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-center bg-white dark:bg-[#11152D] border border-rose-200 dark:border-rose-500/20 rounded-2xl p-8">
          <AlertTriangle className="w-10 h-10 text-rose-500" />
          <h3 className="text-base font-black text-[#101828] dark:text-white">Approval Data Unavailable</h3>
          <p className="text-xs text-[#667085] dark:text-[#AEB3C5] max-w-md">
            We could not complete the live query. Your local cache is preserved.
          </p>
          <button
            onClick={handleRefresh}
            className="mt-2 px-4 py-2 bg-[#6C4CFF] hover:bg-[#5835F5] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Query
          </button>
        </div>
      ) : queueRecords.length === 0 ? (
        /* Compact Contextual Empty State */
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl p-8">
          {activeTabFilter === 'pending' ? (
            <>
              <BadgeCheck className="w-12 h-12 text-emerald-500" />
              <div>
                <h3 className="text-base font-black text-[#101828] dark:text-white">No approvals waiting</h3>
                <p className="text-xs text-[#667085] dark:text-[#AEB3C5] mt-1">Everything submitted has been reviewed.</p>
              </div>
            </>
          ) : activeTabFilter === 'approved' ? (
            <>
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <div>
                <h3 className="text-base font-black text-[#101828] dark:text-white">No approved items yet</h3>
                <p className="text-xs text-[#667085] dark:text-[#AEB3C5] mt-1">Approved deliverables will be stored here.</p>
              </div>
            </>
          ) : activeTabFilter === 'revision_requested' ? (
            <>
              <RotateCcw className="w-12 h-12 text-amber-500" />
              <div>
                <h3 className="text-base font-black text-[#101828] dark:text-white">No revision requests</h3>
                <p className="text-xs text-[#667085] dark:text-[#AEB3C5] mt-1">Items requiring changes will appear here.</p>
              </div>
            </>
          ) : (
            <>
              <Layers className="w-12 h-12 text-slate-400" />
              <div>
                <h3 className="text-base font-black text-[#101828] dark:text-white">No approval records found</h3>
                <p className="text-xs text-[#667085] dark:text-[#AEB3C5] mt-1">No items match your active filters.</p>
              </div>
            </>
          )}
        </div>
      ) : (
        /* Success with Data: Render Approval Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {queueRecords.map(item => (
            <ApprovalQueueCard
              key={item.id}
              item={item}
              profile={profile}
              isLoading={actionLoadingId === item.id}
              onApprove={() => handleApprove(item)}
              onRequestRevision={() => {
                setRevisionModalItem(item);
                setRevisionNotes(item.review_notes || '');
              }}
              onOpenDetail={() => setDetailItem(item)}
              onOpenSource={() => {
                if (setActiveTab) {
                  if (item.source_type === 'task') setActiveTab('tasks');
                  else if (item.source_type === 'content') setActiveTab('calendar');
                  else if (item.source_type === 'video') setActiveTab('videos');
                } else {
                  setDetailItem(item);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* ─── DETAIL INSPECTION DRAWER ─── */}
      {detailItem && (
        <ApprovalDetailDrawer
          item={detailItem}
          profile={profile}
          onClose={() => setDetailItem(null)}
          onApprove={() => handleApprove(detailItem)}
          onRequestRevision={() => {
            setRevisionModalItem(detailItem);
            setRevisionNotes(detailItem.review_notes || '');
          }}
          onNavigateSource={() => {
            if (setActiveTab) {
              if (detailItem.source_type === 'task') setActiveTab('tasks');
              else if (detailItem.source_type === 'content') setActiveTab('calendar');
              else if (detailItem.source_type === 'video') setActiveTab('videos');
            }
          }}
        />
      )}

      {/* ─── REVISION NOTES MODAL ─── */}
      {revisionModalItem && (
        <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#101828] dark:text-white">Request Changes</h3>
                  <p className="text-xs text-[#667085] dark:text-[#AEB3C5]">Deliverable: {revisionModalItem.title}</p>
                </div>
              </div>
              <button
                onClick={() => setRevisionModalItem(null)}
                className="p-1 rounded-lg text-[#667085] hover:text-black dark:text-slate-400 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase text-[#667085] dark:text-slate-400 tracking-wider block mb-1.5">
                Revision Notes & Feedback <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={revisionNotes}
                onChange={e => setRevisionNotes(e.target.value)}
                placeholder="Explain the required edits (e.g. adjust typography, update brand logo, rewrite caption...)"
                rows={4}
                className="w-full bg-[#F8FAFC] dark:bg-white/5 border border-[#D8DEE9] dark:border-white/10 rounded-xl p-3 text-xs text-[#101828] dark:text-white placeholder-[#98A2B3] dark:placeholder-slate-600 outline-none focus:border-rose-500 resize-none font-sans"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#667085] dark:text-slate-400">
              <span>Revision Cycle: <strong>#{revisionModalItem.revision_count + 1}</strong></span>
              <span>Source will return to: <strong>{revisionModalItem.source_type === 'task' ? 'In Progress' : (revisionModalItem.source_type === 'video' ? 'Editing' : 'Draft/Design')}</strong></span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setRevisionModalItem(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-[#667085] dark:text-slate-400 border border-[#D8DEE9] dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestRevisionSubmit}
                disabled={actionLoadingId === revisionModalItem.id || !revisionNotes.trim()}
                className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {actionLoadingId === revisionModalItem.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit Revision Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── APPROVAL QUEUE CARD ───────────────────────────────────────────────
interface ApprovalQueueCardProps {
  item: CanonicalApprovalRecord;
  profile: any;
  isLoading: boolean;
  onApprove: () => void;
  onRequestRevision: () => void;
  onOpenDetail: () => void;
  onOpenSource: () => void;
}

const ApprovalQueueCard: React.FC<ApprovalQueueCardProps> = ({
  item,
  profile,
  isLoading,
  onApprove,
  onRequestRevision,
  onOpenDetail,
  onOpenSource,
}) => {
  const meta = sourceTypeMeta[item.source_type] || sourceTypeMeta.task;
  const SourceIcon = meta.icon;
  const waitingText = calculateWaitingDuration(item.submitted_at || item.created_at);

  const statusBadge = {
    pending: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30',
    approved: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30',
    revision_requested: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/30',
  }[item.status] || 'bg-slate-100 text-slate-600';

  const statusLabel = {
    pending: 'Pending Review',
    approved: 'Approved',
    revision_requested: 'Revision Requested',
  }[item.status] || item.status;

  return (
    <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl overflow-hidden hover:border-[#6C4CFF]/40 dark:hover:border-white/20 transition-all shadow-2xs flex flex-col justify-between">
      {/* Top Card Body */}
      <div className="p-5 flex-1 space-y-3">
        {/* Source Badge & Status */}
        <div className="flex items-center justify-between gap-2">
          <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${meta.badge}`}>
            <SourceIcon className="w-3 h-3" />
            {meta.label}
          </span>
          
          <div className="flex items-center gap-1.5">
            {item.revision_count > 0 && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                Rev #{item.revision_count}
              </span>
            )}
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${statusBadge}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Deliverable Title & Client */}
        <div>
          <p className="text-[11px] font-black text-[#6C4CFF] dark:text-[#8068FF] uppercase tracking-wider">
            {item.client_name}
          </p>
          <h3 className="text-sm font-black text-[#101828] dark:text-white leading-snug line-clamp-2 mt-0.5 cursor-pointer hover:text-[#6C4CFF] transition-colors" onClick={onOpenDetail}>
            {item.title}
          </h3>
        </div>

        {/* Description / Feedback snippet */}
        {item.description && (
          <p className="text-xs text-[#475467] dark:text-slate-400 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}

        {/* Active Revision Notes if Changes Requested */}
        {item.status === 'revision_requested' && item.review_notes && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl p-2.5">
            <p className="text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-0.5">Requested Changes</p>
            <p className="text-xs text-rose-700 dark:text-rose-300 line-clamp-2">{item.review_notes}</p>
          </div>
        )}

        {/* Submitter & Time Info */}
        <div className="pt-2 border-t border-[#F2F4F7] dark:border-white/5 flex items-center justify-between text-[10px] text-[#667085] dark:text-slate-400">
          <span className="flex items-center gap-1.5 truncate">
            <User className="w-3 h-3 text-[#6C4CFF]" />
            <span className="font-bold truncate">{item.submitted_by_name || 'Team Member'}</span>
          </span>
          <span className="flex items-center gap-1 font-semibold flex-shrink-0">
            <Clock className="w-3 h-3" />
            {waitingText}
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="px-4 py-3 border-t border-[#D8DEE9] dark:border-white/8 bg-[#FAFBFC] dark:bg-[#0C1026] flex items-center justify-between gap-2">
        <button
          onClick={onOpenSource}
          className="text-[11px] font-bold text-[#667085] dark:text-slate-400 hover:text-[#101828] dark:hover:text-white flex items-center gap-1 transition-all cursor-pointer"
        >
          <ExternalLink className="w-3 h-3" /> Open Source
        </button>

        {item.status === 'pending' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onRequestRevision}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 transition-all disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Revise
            </button>
            <button
              onClick={onApprove}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 transition-all disabled:opacity-40 cursor-pointer"
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Approve
            </button>
          </div>
        ) : item.status === 'approved' ? (
          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
          </span>
        ) : (
          <button
            onClick={onRequestRevision}
            className="text-[10px] font-black text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Update Notes
          </button>
        )}
      </div>
    </div>
  );
};

// ─── APPROVAL DETAIL DRAWER ────────────────────────────────────────────
interface ApprovalDetailDrawerProps {
  item: CanonicalApprovalRecord;
  profile: any;
  onClose: () => void;
  onApprove: () => void;
  onRequestRevision: () => void;
  onNavigateSource: () => void;
}

const ApprovalDetailDrawer: React.FC<ApprovalDetailDrawerProps> = ({
  item,
  profile,
  onClose,
  onApprove,
  onRequestRevision,
  onNavigateSource,
}) => {
  const meta = sourceTypeMeta[item.source_type] || sourceTypeMeta.task;
  const SourceIcon = meta.icon;

  return (
    <div className="fixed inset-0 z-60 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40 backdrop-blur-2xs" />
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 border-l border-[#D8DEE9] dark:border-white/10 h-full flex flex-col shadow-2xl text-[#101828] dark:text-white"
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-[#D8DEE9] dark:border-white/10 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1.5 rounded-lg border ${meta.badge}`}>
              <SourceIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-wider text-[#6C4CFF]">{meta.label}</span>
              <h2 className="text-sm font-black truncate">{item.title}</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-[#F8FAFC] dark:bg-white/4 border border-[#D8DEE9] dark:border-white/8 rounded-xl p-3">
              <p className="text-[9px] uppercase text-[#667085] dark:text-slate-400 font-black tracking-wider">Client Brand</p>
              <p className="text-xs font-bold text-[#101828] dark:text-white mt-0.5">{item.client_name}</p>
            </div>
            <div className="bg-[#F8FAFC] dark:bg-white/4 border border-[#D8DEE9] dark:border-white/8 rounded-xl p-3">
              <p className="text-[9px] uppercase text-[#667085] dark:text-slate-400 font-black tracking-wider">Submitted By</p>
              <p className="text-xs font-bold text-[#101828] dark:text-white mt-0.5">{item.submitted_by_name || 'Team Member'}</p>
            </div>
            <div className="bg-[#F8FAFC] dark:bg-white/4 border border-[#D8DEE9] dark:border-white/8 rounded-xl p-3">
              <p className="text-[9px] uppercase text-[#667085] dark:text-slate-400 font-black tracking-wider">Submitted At</p>
              <p className="text-xs font-bold text-[#101828] dark:text-white mt-0.5">
                {item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '—'}
              </p>
            </div>
            <div className="bg-[#F8FAFC] dark:bg-white/4 border border-[#D8DEE9] dark:border-white/8 rounded-xl p-3">
              <p className="text-[9px] uppercase text-[#667085] dark:text-slate-400 font-black tracking-wider">Revision Cycle</p>
              <p className="text-xs font-bold text-[#101828] dark:text-white mt-0.5">Rev #{item.revision_count}</p>
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <div>
              <p className="text-[10px] font-black uppercase text-[#667085] dark:text-slate-400 tracking-wider mb-1.5">Deliverable Details</p>
              <div className="text-xs text-[#344054] dark:text-slate-300 leading-relaxed bg-[#F8FAFC] dark:bg-white/4 border border-[#D8DEE9] dark:border-white/8 rounded-xl p-3.5">
                {item.description}
              </div>
            </div>
          )}

          {/* Creative Link if present */}
          {item.creativeLink && (
            <a
              href={item.creativeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#6C4CFF]/10 border border-[#6C4CFF]/25 text-xs font-bold text-[#6C4CFF] dark:text-[#8068FF] hover:bg-[#6C4CFF]/15 transition-all"
            >
              <ExternalLink className="w-4 h-4" /> Open Attached File / Creative Link
            </a>
          )}

          {/* Revision Notes */}
          {item.review_notes && (
            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl p-3.5 space-y-1">
              <p className="text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">Latest Revision Notes</p>
              <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed">{item.review_notes}</p>
            </div>
          )}

          {/* Audit History Log */}
          <div>
            <p className="text-[10px] font-black uppercase text-[#667085] dark:text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Review Timeline ({item.audit_history?.length || 0})
            </p>
            <div className="space-y-2">
              {(item.audit_history || []).map((ev, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs bg-[#F8FAFC] dark:bg-white/4 p-2.5 rounded-xl border border-[#D8DEE9] dark:border-white/8">
                  <div className="w-2 h-2 rounded-full bg-[#6C4CFF] mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-[#101828] dark:text-white">{ev.action}</span>
                      <span className="text-[9px] text-[#667085] dark:text-slate-400">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[10px] text-[#667085] dark:text-slate-400 mt-0.5">By {ev.actor_name}</p>
                    {ev.notes && <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 italic">"{ev.notes}"</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Drawer Action Footer */}
        <div className="px-6 py-4 border-t border-[#D8DEE9] dark:border-white/10 flex items-center justify-between gap-3 bg-[#FAFBFC] dark:bg-slate-900">
          <button
            onClick={onNavigateSource}
            className="px-3 py-2 rounded-xl text-xs font-bold text-[#667085] dark:text-slate-300 border border-[#D8DEE9] dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-white/5 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Go To Source
          </button>

          {item.status === 'pending' && (
            <div className="flex items-center gap-2">
              <button
                onClick={onRequestRevision}
                className="px-3 py-2 rounded-xl text-xs font-black text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Revise
              </button>
              <button
                onClick={onApprove}
                className="px-4 py-2 rounded-xl text-xs font-black text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApprovalsView;
