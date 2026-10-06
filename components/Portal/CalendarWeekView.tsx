import React from 'react';
import { type CalendarEntry } from './ContentCalendar';
import { Plus, Clock } from 'lucide-react';

interface CalendarWeekViewProps {
  entries: CalendarEntry[];
  currentDate: Date;
  onOpenEdit: (entry: CalendarEntry) => void;
  getStatusStyle: (status: CalendarEntry['status']) => string;
  getPlatformIcon: (platform: CalendarEntry['platform']) => React.ReactNode;
  onAddAtDate: (dateStr: string) => void;
  role?: string;
}

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  entries,
  currentDate,
  onOpenEdit,
  getStatusStyle,
  getPlatformIcon,
  onAddAtDate,
  role
}) => {
  // Get start of week (Sunday)
  const getSundayOfCurrentWeek = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.getFullYear(), d.getMonth(), diff);
  };

  const sunday = getSundayOfCurrentWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const nextDay = new Date(sunday);
    nextDay.setDate(sunday.getDate() + i);
    return nextDay;
  });

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-4 bg-slate-100/50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850 p-4 rounded-3xl shadow-inner">
      {weekDays.map((date, idx) => {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const dayEntries = entries.filter(e => e.date === dateStr);
        const isToday = new Date().toDateString() === date.toDateString();

        return (
          <div 
            key={idx} 
            className={`bg-white dark:bg-slate-900 border rounded-2xl p-3 min-h-[300px] flex flex-col justify-between hover:shadow-md transition-all ${
              isToday ? 'border-purple-500 ring-1 ring-purple-500/10 bg-purple-500/5' : 'border-slate-150 dark:border-slate-800'
            }`}
          >
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-black text-slate-400 block tracking-wider">{dayNames[idx]}</span>
                  <span className={`text-base font-black ${isToday ? 'text-purple-500' : 'text-slate-800 dark:text-white'}`}>
                    {date.getDate()}
                  </span>
                </div>
                {role !== 'client' && (
                  <button 
                    onClick={() => onAddAtDate(dateStr)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-purple-500 transition-all"
                    title="Plan Entry"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5">
                {dayEntries.length === 0 ? (
                  <span className="text-[10px] font-medium text-slate-400 italic block py-2">No scheduled posts.</span>
                ) : (
                  dayEntries.map(entry => (
                    <div 
                      key={entry.contentId}
                      onClick={() => onOpenEdit(entry)}
                      className={`text-[10px] font-bold p-2.5 rounded-xl border cursor-pointer hover:scale-[1.01] hover:brightness-105 transition-all space-y-1.5 shadow-sm ${getStatusStyle(entry.status)}`}
                    >
                      <div className="flex items-center gap-1.5 justify-between">
                        <div className="flex items-center gap-1">
                          {getPlatformIcon(entry.platform)}
                          <span className="truncate max-w-[65px]">{entry.topic}</span>
                        </div>
                        <span className="text-[8px] font-black uppercase bg-white/20 px-1 rounded">
                          {entry.contentType}
                        </span>
                      </div>
                      <p className="text-[9px] opacity-80 truncate leading-tight font-semibold">{entry.caption}</p>
                      <div className="flex items-center gap-1 text-[8px] opacity-70">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{entry.time}</span>
                      </div>
                      {((entry.assigneeName && entry.assigneeName !== 'Unassigned') || (entry.uploaderName && entry.uploaderName !== 'Unassigned')) && (
                        <div className="flex flex-col gap-0.5 pt-1 mt-1 border-t border-black/10 dark:border-white/10 text-[7px] font-black uppercase tracking-wider">
                          {entry.assigneeName && entry.assigneeName !== 'Unassigned' && (
                            <div className="truncate opacity-85">🛠️ {entry.assigneeName}</div>
                          )}
                          {entry.uploaderName && entry.uploaderName !== 'Unassigned' && (
                            <div className="truncate opacity-85">📤 {entry.uploaderName}</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="pt-2 text-right border-t border-slate-50 dark:border-slate-850/30 text-[9px] font-black text-slate-400">
              {dayEntries.length} POSTS
            </div>
          </div>
        );
      })}
    </div>
  );
};
