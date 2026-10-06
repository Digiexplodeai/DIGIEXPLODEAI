import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  RotateCcw, Sparkles, CheckSquare, X
} from 'lucide-react';
import { type Task } from '../../lib/taskStorage';

interface MiniCalendarWidgetProps {
  tasks: Task[];
  selectedDate: string | null; // YYYY-MM-DD or null for all
  onSelectDate: (dateStr: string | null) => void;
  className?: string;
  isCollapsible?: boolean;
}

export const MiniCalendarWidget: React.FC<MiniCalendarWidgetProps> = ({
  tasks,
  selectedDate,
  onSelectDate,
  className = '',
  isCollapsible = false
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      const [y, m, d] = selectedDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  });

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const monthLabel = useMemo(() => {
    return currentMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, [currentMonth]);

  // Compute tasks per date map
  const taskCountByDate = useMemo(() => {
    const map: Record<string, { total: number; overdue: number; urgent: number }> = {};
    tasks.forEach(t => {
      const d = t.scheduledDate || t.scheduled_date || (t.createdAt ? t.createdAt.slice(0, 10) : todayStr);
      if (!map[d]) {
        map[d] = { total: 0, overdue: 0, urgent: 0 };
      }
      map[d].total += 1;
      const isDone = (t.status || '').toLowerCase().includes('done') || (t.status || '').toLowerCase().includes('completed');
      if (!isDone && t.dueDate && t.dueDate < todayStr) {
        map[d].overdue += 1;
      }
      if (t.priority === 'Urgent') {
        map[d].urgent += 1;
      }
    });
    return map;
  }, [tasks, todayStr]);

  // Calendar days generation
  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      taskStats: { total: number; overdue: number; urgent: number } | undefined;
    }> = [];

    // Prev month padding
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const pDay = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, pDay);
      const dateStr = prevDate.toISOString().split('T')[0];
      days.push({
        dateStr,
        dayNum: pDay,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: selectedDate === dateStr,
        taskStats: taskCountByDate[dateStr],
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: selectedDate === dateStr,
        taskStats: taskCountByDate[dateStr],
      });
    }

    // Trailing padding to fill complete weeks (35 or 42 cells)
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let n = 1; n <= remaining; n++) {
      const nextDate = new Date(year, month + 1, n);
      const dateStr = nextDate.toISOString().split('T')[0];
      days.push({
        dateStr,
        dayNum: n,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: selectedDate === dateStr,
        taskStats: taskCountByDate[dateStr],
      });
    }

    return days;
  }, [year, month, todayStr, selectedDate, taskCountByDate]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleGoToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date());
    onSelectDate(todayStr);
  };

  return (
    <div className={`bg-white dark:bg-[#111728] border border-[#D7DEE9] dark:border-[#293248] rounded-2xl p-3 shadow-xs select-none ${className}`}>
      {/* Mini Calendar Header */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#D7DEE9]/60 dark:border-[#293248]">
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="w-3.5 h-3.5 text-[#5B4BFF] dark:text-[#806CFF]" />
          <span className="text-xs font-black text-[#101828] dark:text-[#F7F8FC]">
            {monthLabel}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleGoToday}
            title="Focus Today"
            className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-[#EEECFF] text-[#5B4BFF] dark:bg-[#201D45] dark:text-[#806CFF] hover:bg-[#5B4BFF] hover:text-white transition-all cursor-pointer"
          >
            Today
          </button>
          <div className="flex items-center bg-[#F8FAFC] dark:bg-[#171E31] rounded-lg border border-[#D7DEE9] dark:border-[#293248] p-0.5">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1 hover:bg-white dark:hover:bg-[#111728] rounded text-[#475467] dark:text-[#BAC1D1] transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1 hover:bg-white dark:hover:bg-[#11152D] rounded text-[#475467] dark:text-[#BAC1D1] transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black uppercase tracking-wider text-[#7A8496] dark:text-[#8C97AC] pb-1">
        <div>Su</div>
        <div>Mo</div>
        <div>Tu</div>
        <div>We</div>
        <div>Th</div>
        <div>Fr</div>
        <div>Sa</div>
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((d, idx) => {
          const hasTasks = d.taskStats && d.taskStats.total > 0;
          const hasOverdue = d.taskStats && d.taskStats.overdue > 0;

          return (
            <button
              key={`${d.dateStr}-${idx}`}
              type="button"
              onClick={() => {
                if (d.isSelected) {
                  onSelectDate(null); // Deselect on second click
                } else {
                  onSelectDate(d.dateStr);
                }
              }}
              className={`relative h-7 w-full flex items-center justify-center rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                d.isSelected
                  ? 'bg-[#5B4BFF] text-white font-black shadow-2xs ring-2 ring-[#5B4BFF]/30 scale-105 z-10'
                  : d.isToday
                  ? 'bg-[#EEECFF] dark:bg-[#201D45] text-[#5B4BFF] dark:text-[#806CFF] font-black border border-[#5B4BFF]/40'
                  : d.isCurrentMonth
                  ? hasTasks
                    ? 'bg-[#F4F2FF] dark:bg-[#1A1838] text-[#101828] dark:text-[#F7F8FC] hover:bg-[#EEECFF] dark:hover:bg-[#252250] font-black'
                    : 'text-[#344054] dark:text-[#BAC1D1] hover:bg-[#F8FAFC] dark:hover:bg-[#171E31]'
                  : 'text-slate-300 dark:text-slate-700 opacity-40 hover:opacity-80'
              }`}
              title={`${d.dateStr}${hasTasks ? ` · ${d.taskStats?.total} task(s)` : ''}`}
            >
              <span>{d.dayNum}</span>

              {/* Task Count Dot / Indicator */}
              {hasTasks && !d.isSelected && (
                <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                  hasOverdue ? 'bg-rose-500' : 'bg-[#5B4BFF] dark:bg-[#806CFF]'
                }`} />
              )}

              {/* Count badge on hover or if >= 2 tasks */}
              {hasTasks && d.taskStats && d.taskStats.total >= 2 && !d.isSelected && (
                <span className="absolute -top-1 -right-1 text-[7px] font-black w-3.5 h-3.5 rounded-full bg-[#5B4BFF] text-white flex items-center justify-center leading-none shadow-2xs">
                  {d.taskStats.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Date Filter Badge / Reset */}
      {selectedDate && (
        <div className="mt-2.5 pt-2 border-t border-[#D7DEE9]/60 dark:border-[#293248] flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold text-[#5B4BFF] dark:text-[#806CFF]">Date Filter:</span>
            <span className="font-black text-[#101828] dark:text-white truncate">{selectedDate}</span>
          </div>
          <button
            type="button"
            onClick={() => onSelectDate(null)}
            className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300 hover:bg-rose-100 flex items-center gap-0.5 cursor-pointer"
          >
            <X className="w-2.5 h-2.5" /> Clear
          </button>
        </div>
      )}
    </div>
  );
};
