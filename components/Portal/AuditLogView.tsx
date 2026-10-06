import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck, Search, Filter, RefreshCw, ChevronDown, AlertTriangle,
  Download, Calendar, User, Loader2, Eye, X, Layers, Clock, FileText, Check
} from 'lucide-react';
import { AuditService } from '../../lib/controlPlane/AuditService';
import { AuditRecord } from '../../lib/controlPlane/types';

const MODULE_COLORS: Record<string, { bg: string; text: string }> = {
  'Tasks & Work':        { bg: 'rgba(20,184,166,0.15)', text: '#14B8A6' },
  'Employees':           { bg: 'rgba(53,87,255,0.15)',  text: '#7B9FFF' },
  'Attendance & Leaves': { bg: 'rgba(139,92,246,0.15)', text: '#A78BFA' },
  'HR Documents':        { bg: 'rgba(216,149,34,0.15)', text: '#FBBF24' },
  'Payroll':             { bg: 'rgba(22,163,106,0.15)', text: '#34D399' },
  'Approvals':           { bg: 'rgba(236,72,153,0.15)', text: '#F472B6' },
  'Content Calendar':    { bg: 'rgba(59,130,246,0.15)', text: '#60A5FA' },
  'Video Production':    { bg: 'rgba(239,68,68,0.15)',  text: '#F87171' },
  'Reports':             { bg: 'rgba(168,85,247,0.15)', text: '#C084FC' },
  'Roles & Permissions': { bg: 'rgba(249,115,22,0.15)', text: '#FB923C' },
  'Settings':            { bg: 'rgba(100,116,139,0.15)',text: '#94A3B8' },
  'System':              { bg: 'rgba(99,102,241,0.15)', text: '#818CF8' },
};

export const AuditLogView: React.FC = () => {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [actorFilter, setActorFilter] = useState('All');
  const [selectedEntry, setSelectedEntry] = useState<AuditRecord | null>(null);

  const isSuperAdmin = profile?.role === 'superAdmin';

  const load = () => {
    setLoading(true);
    try {
      const records = AuditService.getRecords();
      setEntries(records);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const handleUpdate = () => load();
    window.addEventListener('digi_audit_updated', handleUpdate);
    return () => window.removeEventListener('digi_audit_updated', handleUpdate);
  }, []);

  const modules = ['All', ...Array.from(new Set(entries.map(e => e.module).filter(Boolean)))];
  const actors = ['All', ...Array.from(new Set(entries.map(e => e.actor_name).filter(Boolean)))];

  const filtered = entries.filter(e => {
    const matchModule = moduleFilter === 'All' || e.module === moduleFilter;
    const matchActor = actorFilter === 'All' || e.actor_name === actorFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || 
      e.actor_name?.toLowerCase().includes(q) || 
      e.action?.toLowerCase().includes(q) || 
      e.entity_id?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q);
    return matchModule && matchActor && matchSearch;
  });

  const handleExportCSV = () => {
    const csv = AuditService.exportCSV(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center font-sans">
        <AlertTriangle className="w-12 h-12 text-rose-500" />
        <p className="font-bold text-base text-slate-300">Access Restricted</p>
        <p className="text-xs text-slate-500">Audit Log is only accessible by authenticated Super Admins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-[#3557FF]" />
            <span className="text-xs font-black uppercase tracking-widest text-[#3557FF]">System · Security Control Plane</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Audit Log & Event Trail</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Immutable log of sensitive actions, mutations, HR letters, payslips, permissions and role changes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#3557FF] text-white shadow-md hover:bg-[#2846DF] transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" /> Export CSV ({filtered.length})
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-[#0E1326] p-3 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search actor, action, task ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent outline-none flex-1 text-xs text-slate-900 dark:text-white"
          />
        </div>

        {/* Module Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase text-slate-400">Module:</span>
          <select
            value={moduleFilter}
            onChange={e => setModuleFilter(e.target.value)}
            className="flex-1 rounded-xl px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none"
          >
            {modules.map(m => <option key={m} value={m} className="bg-slate-900 text-white">{m}</option>)}
          </select>
        </div>

        {/* Actor Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase text-slate-400">Actor:</span>
          <select
            value={actorFilter}
            onChange={e => setActorFilter(e.target.value)}
            className="flex-1 rounded-xl px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none"
          >
            {actors.map(a => <option key={a} value={a} className="bg-slate-900 text-white">{a}</option>)}
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-[#0E1326] rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-[#3557FF]" />
            <span className="text-xs font-semibold">Loading audit trail…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <ShieldCheck className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">No audit activity recorded yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Sensitive operations, employee assignments, role changes and document generations will appear here as they occur.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/3 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3.5">Timestamp</th>
                  <th className="px-4 py-3.5">Actor</th>
                  <th className="px-4 py-3.5">Module</th>
                  <th className="px-4 py-3.5">Action</th>
                  <th className="px-4 py-3.5">Target / Record</th>
                  <th className="px-4 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filtered.map(entry => {
                  const modStyle = MODULE_COLORS[entry.module] || { bg: 'rgba(255,255,255,0.06)', text: '#94A3B8' };
                  return (
                    <tr
                      key={entry.audit_id}
                      onClick={() => setSelectedEntry(entry)}
                      className="hover:bg-slate-50 dark:hover:bg-white/3 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {new Date(entry.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-[#3557FF] text-white font-black text-[10px] flex items-center justify-center shrink-0">
                            {entry.actor_name?.charAt(0) || 'A'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white group-hover:text-[#3557FF] transition-colors">
                              {entry.actor_name}
                            </div>
                            <div className="text-[9px] text-slate-400 uppercase font-semibold">
                              {entry.actor_role}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className="px-2.5 py-1 rounded-md text-[10px] font-black border"
                          style={{
                            background: modStyle.bg,
                            color: modStyle.text,
                            borderColor: `${modStyle.text}30`
                          }}
                        >
                          {entry.module}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200">
                        {entry.action}
                      </td>

                      <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px] max-w-xs truncate">
                        {entry.entity_id || entry.entity_type || '—'}
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEntry(entry);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-[#3557FF]/10 text-slate-600 dark:text-slate-400 hover:text-[#3557FF] text-[10px] font-bold transition-all"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspect Drawer / Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#3557FF]" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">Audit Event Details</h3>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-white/3 p-3 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Event ID</span>
                  <span className="font-mono text-slate-900 dark:text-white break-all">{selectedEntry.event_id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Timestamp</span>
                  <span className="text-slate-900 dark:text-white">{new Date(selectedEntry.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-white/3 p-3 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Actor</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedEntry.actor_name} ({selectedEntry.actor_role})</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Module / Action</span>
                  <span className="text-slate-900 dark:text-white">{selectedEntry.module} · {selectedEntry.action}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black block mb-1">Description</span>
                <p className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-slate-800 dark:text-slate-200 leading-relaxed font-mono text-[11px]">
                  {selectedEntry.description}
                </p>
              </div>

              {selectedEntry.metadata && Object.keys(selectedEntry.metadata).length > 0 && (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black block mb-1">Safe Metadata Payload</span>
                  <pre className="p-3 bg-slate-950 text-emerald-400 rounded-xl overflow-x-auto text-[10px] font-mono border border-slate-800">
                    {JSON.stringify(selectedEntry.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 bg-[#3557FF] text-white rounded-xl text-xs font-bold shadow-md hover:bg-[#2846DF]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogView;
