import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { type Employee } from './AttendanceView';
import { Shield, Brain, Sparkles, TrendingUp, AlertTriangle, User, Clock, CheckCircle2 } from 'lucide-react';
import { type Task, subscribeToCanonicalTasks, getCachedTasks } from '../../lib/taskStorage';
import { type CalendarEntry } from './ContentCalendar';

interface CalendarWorkloadViewProps {
  onOpenEdit?: (item: any) => void;
}

export const CalendarWorkloadView: React.FC<CalendarWorkloadViewProps> = ({ onOpenEdit }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<Task[]>(() => getCachedTasks());
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. Subscribe to Employees
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      const list: Employee[] = [];
      snap.forEach(d => list.push({ employeeId: d.id, ...d.data() } as Employee));
      setEmployees(list);
    });

    // 2. Subscribe to canonical Tasks
    const unsubTasks = subscribeToCanonicalTasks((taskList) => {
      setTasks(taskList.filter(t => t.status !== 'Done' && !t.isArchived));
    });

    // 3. Subscribe to Content Calendar items
    const unsubCalendar = onSnapshot(collection(db, 'contentCalendar'), (snap) => {
      const list: CalendarEntry[] = [];
      snap.forEach(d => {
        const item = { contentId: d.id, ...d.data() } as CalendarEntry;
        if (item.status !== 'Posted') {
          list.push(item);
        }
      });
      setCalendarEntries(list);
    });

    return () => {
      unsubEmployees();
      unsubTasks();
      unsubCalendar();
    };
  }, []);

  // Compute unassigned deliverables (either unassigned task or unassigned calendar entry)
  const unassignedItems = [
    ...tasks.filter(t => !t.assigneeId || t.assigneeId === '').map(t => ({
      id: t.id,
      taskId: t.id,
      title: t.title,
      dueDate: t.dueDate || 'No date',
      priority: t.priority || 'Medium',
      clientName: t.clientName || 'General',
      type: 'task'
    })),
    ...calendarEntries.filter(c => (!c.assigneeId || c.assigneeId === '') && !tasks.some(t => t.id === c.taskId || t.id === `task_${c.contentId}`)).map(c => ({
      id: c.contentId,
      contentId: c.contentId,
      title: `${c.platform} ${c.contentType}: ${c.topic}`,
      dueDate: c.date,
      priority: 'Medium',
      clientName: c.clientName,
      type: 'calendar'
    }))
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* Unassigned Deliverables Card */}
        <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-dashed border-amber-300 dark:border-amber-900/60 rounded-3xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 font-black text-sm flex items-center justify-center">
                  ?
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white leading-none">Unassigned Queue</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Awaiting Maker</p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded border bg-amber-500/10 border-amber-500/20 text-amber-500">
                {unassignedItems.length} Pending
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <span>Attention Required</span>
                <span>{unassignedItems.length} Items</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                <div 
                  className="h-full bg-amber-500 transition-all duration-500" 
                  style={{ width: `${unassignedItems.length > 0 ? 100 : 0}%` }} 
                />
              </div>
            </div>

            {/* List */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-850/60">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Unallocated Items</span>
              {unassignedItems.length === 0 ? (
                <span className="text-[10px] font-bold text-slate-400 italic block py-4 text-center">
                  All scheduled tasks and content items have makers assigned!
                </span>
              ) : (
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-0.5 custom-scrollbar">
                  {unassignedItems.map(item => (
                    <div 
                      key={item.id}
                      className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-amber-500/40 transition-all cursor-pointer flex justify-between items-center"
                      onClick={() => onOpenEdit && onOpenEdit(item)}
                    >
                      <div className="truncate space-y-0.5 pr-2">
                        <h5 className="text-[10px] font-black text-slate-900 dark:text-white truncate">{item.title}</h5>
                        <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-400">
                          <span>{item.clientName}</span>
                          <span>·</span>
                          <span>Due: {item.dueDate}</span>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 text-[8px] font-extrabold uppercase rounded bg-amber-500 text-white shrink-0">
                        {item.priority}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Employee Cards */}
        {employees.map(emp => {
          const empTasks = tasks.filter(t => t.assigneeId === emp.employeeId);
          const empCal = calendarEntries.filter(c => c.assigneeId === emp.employeeId && !empTasks.some(t => t.id === c.taskId || t.id === `task_${c.contentId}`));
          
          const totalActive = empTasks.length + empCal.length;
          // Assuming 6 active tasks is 100% capacity
          const workloadPercentage = Math.min(Math.round((totalActive / 6) * 100), 100);
          
          let workloadColor = 'bg-emerald-500';
          let workloadBg = 'bg-emerald-500/10 border-emerald-500/20';
          let workloadText = 'text-emerald-600 dark:text-emerald-400';
          
          if (workloadPercentage > 65 && workloadPercentage <= 90) {
            workloadColor = 'bg-amber-500';
            workloadBg = 'bg-amber-500/10 border-amber-500/20';
            workloadText = 'text-amber-600 dark:text-amber-400';
          } else if (workloadPercentage > 90) {
            workloadColor = 'bg-rose-500';
            workloadBg = 'bg-rose-500/10 border-rose-500/20';
            workloadText = 'text-rose-600 dark:text-rose-400';
          }

          return (
            <div 
              key={emp.employeeId} 
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3.5">
                {/* Employee profile header */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-slate-200 dark:border-slate-800 text-purple-600 dark:text-purple-400 font-black text-sm flex items-center justify-center">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white leading-none">{emp.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">{emp.role}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded border ${workloadBg} ${workloadText}`}>
                    {workloadPercentage}% Load
                  </span>
                </div>

                {/* Workload Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <span>Active Capacity</span>
                    <span>{totalActive} Active Items</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                    <div className={`h-full ${workloadColor} transition-all duration-500`} style={{ width: `${workloadPercentage}%` }} />
                  </div>
                  {workloadPercentage >= 85 && (
                    <div className="flex items-center gap-1 text-[9px] font-bold text-amber-500">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Approaching high load capacity.</span>
                    </div>
                  )}
                </div>

                {/* Active Deliverables list */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-850/60">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Assigned Deliverables</span>
                  {totalActive === 0 ? (
                    <span className="text-[10px] font-bold text-slate-400 italic block py-4 text-center">
                      Available for new assignments.
                    </span>
                  ) : (
                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-0.5 custom-scrollbar">
                      {empTasks.map(t => (
                        <div 
                          key={t.id}
                          className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800/80 rounded-xl hover:border-purple-500/30 transition-all cursor-pointer flex justify-between items-center"
                          onClick={() => onOpenEdit && onOpenEdit(t)}
                        >
                          <div className="truncate space-y-0.5 pr-2">
                            <h5 className="text-[10px] font-black text-slate-900 dark:text-white truncate">{t.title}</h5>
                            <span className="text-[8px] font-bold text-slate-400">Due: {t.dueDate} · {t.clientName}</span>
                          </div>
                          <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                            {t.priority}
                          </span>
                        </div>
                      ))}

                      {empCal.map(c => (
                        <div 
                          key={c.contentId}
                          className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800/80 rounded-xl hover:border-blue-500/30 transition-all cursor-pointer flex justify-between items-center"
                          onClick={() => onOpenEdit && onOpenEdit(c)}
                        >
                          <div className="truncate space-y-0.5 pr-2">
                            <h5 className="text-[10px] font-black text-slate-900 dark:text-white truncate">{c.topic}</h5>
                            <span className="text-[8px] font-bold text-slate-400">{c.platform} · {c.date}</span>
                          </div>
                          <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shrink-0">
                            {c.contentType}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
