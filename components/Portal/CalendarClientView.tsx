import React, { useState, useMemo } from 'react';
import { type CalendarEntry } from './ContentCalendar';
import { type ClientData } from './ClientList';
import { ClientSelect } from './ClientSelect';
import { 
  Clock, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  TrendingUp,
  Share2,
  ExternalLink,
  Sparkles,
  Download,
  Loader2,
  Check,
  X
} from 'lucide-react';
import { generateMonthlyPDFReport } from '../../lib/pdfReportGenerator';

interface CalendarClientViewProps {
  entries: CalendarEntry[];
  clients: ClientData[];
  onOpenEdit: (entry: CalendarEntry) => void;
  getStatusStyle: (status: CalendarEntry['status']) => string;
  getPlatformIcon: (platform: CalendarEntry['platform']) => React.ReactNode;
  initialClientId?: string;
  onTriggerReportTab?: (clientId: string, monthStr: string) => void;
}

export const CalendarClientView: React.FC<CalendarClientViewProps> = ({
  entries,
  clients,
  onOpenEdit,
  getStatusStyle,
  getPlatformIcon,
  initialClientId,
  onTriggerReportTab
}) => {
  // Selected client state
  const [selectedClientId, setSelectedClientId] = useState<string>(() => {
    return initialClientId || (clients.length > 0 ? clients[0].clientId : '');
  });

  // Current Month for client view
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfFeedback, setPdfFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Month navigation
  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const currentMonthStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const activeClient = useMemo(() => {
    return clients.find(c => c.clientId === selectedClientId) || clients[0] || null;
  }, [clients, selectedClientId]);

  // Client entries for this selected month
  const clientEntries = useMemo(() => {
    if (!activeClient) return [];
    return entries
      .filter(e => {
        const matchesClient = e.clientId === activeClient.clientId || 
          (e.clientName && activeClient.clientName && e.clientName.toLowerCase() === activeClient.clientName.toLowerCase());
        const matchesMonth = (e.date && e.date.startsWith(currentMonthStr)) || e.month === currentMonthStr;
        return matchesClient && matchesMonth;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [entries, activeClient, currentMonthStr]);

  // Client-specific metrics
  const metrics = useMemo(() => {
    const totalPlanned = clientEntries.length;
    const totalPosts = clientEntries.filter(e => ['Static Post', 'Carousel', 'Post', 'Graphic'].includes(e.contentType || (e as any).work_type)).length;
    const totalReels = clientEntries.filter(e => ['Reel', 'Video', 'Reel/Short', 'YouTube Short'].includes(e.contentType || (e as any).work_type)).length;
    const totalStories = clientEntries.filter(e => ['Story'].includes(e.contentType || (e as any).work_type)).length;
    const totalWebsite = clientEntries.filter(e => ['Website Work', 'Website Update', 'Landing Page', 'Website'].includes(e.contentType || (e as any).work_type)).length;
    
    const totalPosted = clientEntries.filter(e => e.status === 'Posted' || e.postedStatus === 'Posted').length;
    const totalApproved = clientEntries.filter(e => e.status === 'Approved').length;
    const totalPending = clientEntries.filter(e => e.status !== 'Posted' && e.status !== 'Approved' && e.status !== 'Cancelled').length;
    const changesRequested = clientEntries.filter(e => 
      e.status === 'Changes Required' || 
      (e.status as string) === 'Changes Requested' || 
      e.clientApprovalStatus === 'Changes Required'
    ).length;

    const completionPercentage = totalPlanned > 0 ? Math.round((totalPosted / totalPlanned) * 100) : 0;

    return {
      totalPlanned,
      totalPosts,
      totalReels,
      totalStories,
      totalWebsite,
      totalPending,
      totalApproved,
      totalPosted,
      changesRequested,
      completionPercentage
    };
  }, [clientEntries]);

  // Direct PDF report download without native browser alerts
  const handleQuickDownloadPdf = async () => {
    if (!activeClient) return;
    try {
      setIsGeneratingPdf(true);
      setPdfFeedback(null);
      const { doc, filename } = await generateMonthlyPDFReport({
        client: activeClient,
        month: currentMonthStr,
        year: viewDate.getFullYear(),
        reportType: 'Social Content Report',
        entries
      });
      doc.save(filename);
      setPdfFeedback({ message: `Successfully generated PDF: ${filename}`, type: 'success' });
      setTimeout(() => setPdfFeedback(null), 4000);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setPdfFeedback({ message: 'Failed to generate PDF report. Please try again.', type: 'error' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PDF Generation Toast Banner */}
      {pdfFeedback && (
        <div className={`p-3 rounded-2xl flex items-center justify-between text-xs font-bold transition-all ${
          pdfFeedback.type === 'error'
            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60'
            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60'
        }`}>
          <div className="flex items-center gap-2">
            {pdfFeedback.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            <span>{pdfFeedback.message}</span>
          </div>
          <button onClick={() => setPdfFeedback(null)} className="p-1 hover:opacity-75"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Top Client Selection & Month Navigation Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Client Selector */}
          <div className="flex-1 max-w-md">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
              Active Client Brand Workspace (21 Central Accounts)
            </label>
            <ClientSelect
              clients={clients}
              selectedClientId={selectedClientId}
              onSelectClient={(id) => setSelectedClientId(id)}
              placeholder="Select client workspace..."
            />
          </div>

          {/* Month Navigation & PDF Export */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-2xl">
              <button 
                onClick={handlePrevMonth}
                className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-all"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider min-w-[130px] text-center">
                {monthName}
              </span>
              <button 
                onClick={handleNextMonth}
                className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-all"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleQuickDownloadPdf}
              disabled={isGeneratingPdf || !activeClient}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold rounded-2xl text-xs shadow-sm hover:shadow-md transition-all inline-flex items-center gap-2"
            >
              {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Export Executive PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Planned</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{metrics.totalPlanned}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-500">Static Posts</span>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{metrics.totalPosts}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-500">Reels & Videos</span>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{metrics.totalReels}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500">Approved</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{metrics.totalApproved}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-teal-500">Published</span>
          <p className="text-2xl font-black text-teal-600 dark:text-teal-400">{metrics.totalPosted}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">In Production</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{metrics.totalPending}</p>
        </div>
      </div>

      {/* Deliverables List for this Client */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {activeClient?.clientName} · Content Schedule ({monthName})
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {metrics.completionPercentage}% of monthly deliverables published
            </p>
          </div>
          <span className="text-xs font-black text-slate-500 dark:text-slate-400">
            {clientEntries.length} Total Items
          </span>
        </div>

        {clientEntries.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium italic text-xs">
            No deliverables scheduled for {activeClient?.clientName} in {monthName}.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[550px] overflow-y-auto custom-scrollbar">
            {clientEntries.map(entry => (
              <div 
                key={entry.contentId}
                onClick={() => onOpenEdit(entry)}
                className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-850/30 transition-all cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 rounded-xl shrink-0 mt-0.5">
                    {getPlatformIcon(entry.platform)}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900 dark:text-white">{entry.topic}</span>
                      <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded border ${getStatusStyle(entry.status)}`}>
                        {entry.status}
                      </span>
                    </div>
                    {entry.caption && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-xl font-medium">
                        {entry.caption}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 pt-1">
                      <span className="text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded">
                        {entry.contentType}
                      </span>
                      <span>Due: {entry.date}</span>
                      {entry.assigneeName && entry.assigneeName !== 'Unassigned' && (
                        <span>Maker: <strong>{entry.assigneeName}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                <button className="py-1 px-3 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all self-end sm:self-center">
                  Inspect
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
