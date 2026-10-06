import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Plus, AlertCircle, Clock, CheckCircle2, User, ArrowLeft, ArrowRight, Flag
} from 'lucide-react';
import { 
  type Task, 
  getTaskAgeingInfo, 
  normalizeTaskStatus,
  getNextWorkflowStatus,
  getPrevWorkflowStatus
} from '../../lib/taskStorage';

interface TaskScheduleCalendarProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onOpenCreateTask: (dateStr?: string) => void;
  onStatusChange: (taskId: string, targetStatus: any, source: any) => void;
  onRescheduleTask?: (taskId: string, newDate: string) => void;
}

export const TaskScheduleCalendar: React.FC<TaskScheduleCalendarProps> = ({
  tasks,
  onSelectTask,
  onOpenCreateTask,
  onStatusChange,
  onRescheduleTask
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = useMemo(() => {
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentDate]);

  // Generate calendar days for month grid
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const pDay = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, pDay);
      const dateStr = prevDate.toISOString().split('T')[0];
      days.push({
        dateStr,
        dayNum: pDay,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(year, month, d);
      const ymStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr: ymStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: ymStr === todayStr,
      });
    }

    // Next month padding to fill complete weeks
    const remaining = 42 - days.length;
    for (let n = 1; n <= remaining; n++) {
      const nextDate = new Date(year, month + 1, n);
      const dateStr = nextDate.toISOString().split('T')[0];
      days.push({
        dateStr,
        dayNum: n,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [year, month, todayStr]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);
    if (taskId && onRescheduleTask) {
      onRescheduleTask(taskId, targetDateStr);
    }
  };

  return (
    <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl shadow-xs p-4 space-y-4 font-sans">
      {/* Calendar Header Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-[#D8DEE9] dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#5B4BFF]/10 text-[#5B4BFF] dark:text-[#806CFF] flex items-center justify-center font-bold">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-black text-[#101828] dark:text-white">
              {monthName}
            </h2>
            <p className="text-[11px] text-[#667085] dark:text-[#AEB3C5]">
              Date-based Task Scheduling & Operational Timeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-xs font-bold bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 hover:bg-[#EEECFF] hover:text-[#5B4BFF] rounded-xl transition-all cursor-pointer"
          >
            Today
          </button>
          <div className="flex items-center bg-[#F8FAFC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl p-0.5">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white dark:hover:bg-[#11152D] rounded-lg text-[#475467] dark:text-[#AEB3C5] cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white dark:hover:bg-[#11152D] rounded-lg text-[#475467] dark:text-[#AEB3C5] cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => onOpenCreateTask(todayStr)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#5B4BFF] hover:bg-[#4E3FE6] text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Schedule Task</span>
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-black uppercase tracking-wider text-[#7A8496] py-1 border-b border-[#D8DEE9]/60 dark:border-white/10">
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>

      {/* Calendar Month Grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map(day => {
          const dayTasks = tasks.filter(t => (t.scheduledDate || t.scheduled_date) === day.dateStr);

          return (
            <div
              key={day.dateStr}
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, day.dateStr)}
              className={`min-h-[120px] rounded-xl p-2 flex flex-col justify-between border transition-all ${
                day.isToday
                  ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-400/60 dark:border-blue-700/60 shadow-2xs ring-1 ring-blue-500/20'
                  : day.isCurrentMonth
                  ? 'bg-slate-50/50 dark:bg-slate-900/30 border-[#D8DEE9]/70 dark:border-white/5 hover:border-[#5B4BFF]/40'
                  : 'bg-slate-100/30 dark:bg-slate-950/20 border-transparent opacity-40'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between pb-1">
                <span
                  className={`text-xs font-black w-6 h-6 flex items-center justify-center rounded-full ${
                    day.isToday
                      ? 'bg-[#5B4BFF] text-white'
                      : day.isCurrentMonth
                      ? 'text-[#101828] dark:text-white'
                      : 'text-[#98A2B3]'
                  }`}
                >
                  {day.dayNum}
                </span>

                <button
                  onClick={() => onOpenCreateTask(day.dateStr)}
                  title={`Add task for ${day.dateStr}`}
                  className="opacity-0 hover:opacity-100 group-hover:opacity-100 p-0.5 text-[#7A8496] hover:text-[#5B4BFF] rounded transition-opacity cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Task Cards on this Day */}
              <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[140px] custom-scrollbar pr-0.5">
                {dayTasks.map(task => {
                  const normStatus = normalizeTaskStatus(task.status);
                  const isDone = normStatus === 'Done';
                  const ageing = getTaskAgeingInfo(task, todayStr);
                  const prevStatus = getPrevWorkflowStatus(normStatus);
                  const nextStatus = getNextWorkflowStatus(normStatus);

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={e => handleDragStart(e, task.id)}
                      onClick={() => onSelectTask(task)}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition-all shadow-2xs group relative space-y-1 ${
                        isDone
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 opacity-75'
                          : ageing.isOverdue
                          ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                          : 'bg-white dark:bg-[#161B31] border-[#D8DEE9] dark:border-white/10 hover:border-[#5B4BFF]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[8px] font-black text-[#5B4BFF] dark:text-[#806CFF] uppercase truncate max-w-[80px]">
                          {task.clientName || 'General'}
                        </span>
                        {ageing.isOverdue ? (
                          <span className="text-[8px] font-black px-1 rounded bg-rose-600 text-white flex items-center gap-0.5">
                            <AlertCircle className="w-2 h-2" /> Overdue
                          </span>
                        ) : ageing.pendingDays > 0 && !isDone ? (
                          <span className={`text-[8px] font-bold px-1 rounded border ${ageing.pendingColorClass}`}>
                            {ageing.pendingBadge}
                          </span>
                        ) : null}
                      </div>

                      <h5 className={`text-[10px] font-bold leading-tight truncate ${
                        isDone ? 'line-through text-[#667085]' : 'text-[#101828] dark:text-white'
                      }`}>
                        {task.title}
                      </h5>

                      {/* Workflow One-Click Status Controls */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#D8DEE9]/40 dark:border-white/5 text-[9px]">
                        <div className="flex items-center gap-1">
                          <button
                            disabled={!prevStatus}
                            onClick={e => {
                              e.stopPropagation();
                              if (prevStatus) onStatusChange(task.id, prevStatus, 'left_arrow');
                            }}
                            title={prevStatus ? `Move back to ${prevStatus}` : 'Cannot move backward'}
                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-[#475467] dark:text-[#BAC1D1]"
                          >
                            <ArrowLeft className="w-2.5 h-2.5" />
                          </button>
                          <span className="font-semibold text-[8px] text-[#667085] dark:text-[#BAC1D1] truncate max-w-[50px]">
                            {normStatus}
                          </span>
                          <button
                            disabled={!nextStatus}
                            onClick={e => {
                              e.stopPropagation();
                              if (nextStatus) onStatusChange(task.id, nextStatus, 'right_arrow');
                            }}
                            title={nextStatus ? `Advance to ${nextStatus}` : 'Already Done'}
                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-[#475467] dark:text-[#BAC1D1]"
                          >
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        {task.assigneeName && (
                          <span className="text-[8px] font-medium text-[#7A8496] truncate max-w-[45px]">
                            {task.assigneeName.split(' ')[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {dayTasks.length === 0 && (
                <div className="text-center py-4 text-[9px] text-[#98A2B3] italic">
                  —
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
