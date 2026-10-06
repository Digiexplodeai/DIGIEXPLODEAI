import React from 'react';
import { type CalendarEntry } from './ContentCalendar';
import { Clock, AlertCircle, ChevronLeft, ChevronRight, User, CheckCircle2 } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { persistUpdateTask } from '../../lib/taskStorage';

interface CalendarKanbanViewProps {
  entries: CalendarEntry[];
  onOpenEdit: (entry: CalendarEntry) => void;
  getPlatformIcon: (platform: CalendarEntry['platform']) => React.ReactNode;
}

const KANBAN_COLUMNS: Array<CalendarEntry['status']> = [
  'Idea', 
  'Planned', 
  'In Design', 
  'Sent for Approval', 
  'Changes Required', 
  'Approved', 
  'Posted'
];

export const CalendarKanbanView: React.FC<CalendarKanbanViewProps> = ({
  entries,
  onOpenEdit,
  getPlatformIcon
}) => {

  const handleMoveStatus = async (entry: CalendarEntry, direction: 'left' | 'right') => {
    const currentIndex = KANBAN_COLUMNS.indexOf(entry.status);
    let nextIndex = currentIndex;
    if (direction === 'left' && currentIndex > 0) nextIndex = currentIndex - 1;
    if (direction === 'right' && currentIndex < KANBAN_COLUMNS.length - 1) nextIndex = currentIndex + 1;

    if (nextIndex !== currentIndex) {
      const nextStatus = KANBAN_COLUMNS[nextIndex];
      const nowIso = new Date().toISOString();

      try {
        const docRef = doc(db, 'contentCalendar', entry.contentId);
        await updateDoc(docRef, {
          status: nextStatus,
          postedStatus: nextStatus === 'Posted' ? 'Posted' : 'Not Posted',
          clientApprovalStatus: nextStatus === 'Approved' ? 'Approved' : (nextStatus === 'Changes Required' ? 'Changes Required' : entry.clientApprovalStatus),
          updatedAt: nowIso
        });

        // Sync canonical task
        const taskId = entry.taskId || `task_${entry.contentId}`;
        let canonicalTaskStatus = 'To Do';
        if (nextStatus === 'Posted' || nextStatus === 'Approved') canonicalTaskStatus = 'Done';
        else if (nextStatus === 'Sent for Approval' || nextStatus === 'Changes Required') canonicalTaskStatus = 'In Review';
        else if (['In Design', 'In Progress', 'Editing'].includes(nextStatus)) canonicalTaskStatus = 'In Progress';

        try {
          await persistUpdateTask(taskId, {
            status: canonicalTaskStatus
          });
        } catch (taskErr) {
          console.warn("Canonical task sync note (non-critical):", taskErr);
        }

        if (nextStatus === 'Sent for Approval' || nextStatus === 'Changes Required') {
          try {
            const { createOrUpdateApprovalFromSource } = await import('../../lib/approvalStorage');
            await createOrUpdateApprovalFromSource('content', {
              ...entry,
              status: nextStatus,
              clientApprovalStatus: nextStatus === 'Sent for Approval' ? 'Pending' : (nextStatus === 'Changes Required' ? 'Changes Required' : entry.clientApprovalStatus),
              taskId
            });
          } catch (apprErr) {
            console.warn("Approval sync note in Kanban:", apprErr);
          }
        }
      } catch (err) {
        console.error("Error updating status in Kanban:", err);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-3 bg-slate-100/60 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl overflow-x-auto min-w-[950px]">
      {KANBAN_COLUMNS.map(col => {
        const colEntries = entries.filter(e => e.status === col);
        
        let colHeaderStyle = 'text-slate-500 border-slate-200 dark:border-slate-700';
        if (col === 'Idea') colHeaderStyle = 'text-slate-500 border-slate-300 dark:border-slate-700';
        if (col === 'Planned') colHeaderStyle = 'text-blue-600 dark:text-blue-400 border-blue-400/40';
        if (col === 'In Design') colHeaderStyle = 'text-purple-600 dark:text-purple-400 border-purple-400/40';
        if (col === 'Sent for Approval') colHeaderStyle = 'text-amber-600 dark:text-amber-400 border-amber-400/40';
        if (col === 'Changes Required') colHeaderStyle = 'text-rose-600 dark:text-rose-400 border-rose-400/40';
        if (col === 'Approved') colHeaderStyle = 'text-emerald-600 dark:text-emerald-400 border-emerald-400/40';
        if (col === 'Posted') colHeaderStyle = 'text-teal-600 dark:text-teal-400 border-teal-400/40';

        return (
          <div key={col} className="bg-slate-50/70 dark:bg-slate-900/40 p-3 rounded-2xl min-h-[480px] flex flex-col justify-between space-y-3">
            <div className="space-y-3">
              {/* Header */}
              <div className={`pb-2 border-b-2 flex justify-between items-center ${colHeaderStyle}`}>
                <h4 className="text-[10px] font-black uppercase tracking-widest">{col}</h4>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-950 shadow-xs border border-slate-200 dark:border-slate-800">
                  {colEntries.length}
                </span>
              </div>

              {/* Cards wrapper */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-0.5 custom-scrollbar">
                {colEntries.length === 0 ? (
                  <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center text-[10px] text-slate-400 font-bold italic">
                    Empty Stage
                  </div>
                ) : (
                  colEntries.map(entry => {
                    const isOverdue = new Date(entry.date) < new Date() && entry.status !== 'Posted';
                    return (
                      <div 
                        key={entry.contentId}
                        onClick={() => onOpenEdit(entry)}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-400/40 p-3 rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer space-y-2 group relative"
                      >
                        {/* Overdue Warning Badge */}
                        {isOverdue && (
                          <div className="flex items-center gap-1 text-[8px] font-black text-rose-500 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded px-1.5 py-0.5 w-max">
                            <AlertCircle className="w-2.5 h-2.5" /> Overdue
                          </div>
                        )}

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              {getPlatformIcon(entry.platform)}
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{entry.platform}</span>
                            </div>
                            <span className="text-[8px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-1 rounded">
                              {entry.contentType}
                            </span>
                          </div>
                          <h5 className="text-[11px] font-black text-slate-900 dark:text-white truncate">{entry.topic}</h5>
                          {entry.caption && (
                            <p className="text-[9px] text-slate-400 line-clamp-1 font-medium">{entry.caption}</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[8px] text-slate-400 font-bold pt-1 border-t border-slate-100 dark:border-slate-800">
                          <span className="truncate max-w-[90px]">{entry.clientName}</span>
                          <span>Due: {entry.date}</span>
                        </div>

                        {/* Control buttons for moving status */}
                        <div className="flex items-center justify-between pt-1 text-[9px] text-slate-400 font-bold">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleMoveStatus(entry, 'left'); }}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all"
                              title="Move Left"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleMoveStatus(entry, 'right'); }}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all"
                              title="Move Right"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {entry.assigneeName && entry.assigneeName !== 'Unassigned' && (
                            <span className="text-[8px] font-bold text-purple-600 dark:text-purple-400 truncate max-w-[70px]">
                              {entry.assigneeName}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block text-center opacity-60 pt-2 border-t border-slate-200 dark:border-slate-800">
              {col}
            </span>
          </div>
        );
      })}
    </div>
  );
};
