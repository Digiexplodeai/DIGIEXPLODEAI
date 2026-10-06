import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Users, UserX, UserCheck, Search, Filter, Calendar,
  CheckSquare, Clock, AlertTriangle, ArrowRight, RotateCcw,
  Sparkles, Shield, Tag, ChevronDown, Check, X, Loader2,
  AlertCircle, ExternalLink, Flag, Briefcase, Plus, GripVertical
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, updateDoc, doc, addDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { syncTaskToVideoProduction } from '../../lib/productionBridge';
import { isTaskAssignedToEmployee } from '../../lib/employeeMaster';

export interface Task {
  id: string;
  title: string;
  description?: string;
  clientId?: string;
  clientName?: string;
  category?: string;
  assigneeId?: string;
  assigneeName?: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  dueDate?: string;
  status: string;
  createdAt: string;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  email?: string;
  department?: string;
  onLeave?: boolean;
}

interface AssignmentBoardProps {
  tasks: Task[];
  employees: Employee[];
  clients: any[];
  onSelectTask?: (task: Task) => void;
  onOpenCreateTask?: (defaultAssigneeId?: string) => void;
  onUpdateTask?: (taskId: string, targetEmpId?: string, targetEmpName?: string) => void;
}

interface ReassignHistoryAction {
  taskId: string;
  taskTitle: string;
  prevAssigneeId?: string;
  prevAssigneeName?: string;
  newAssigneeId?: string;
  newAssigneeName?: string;
  timestamp: string;
}

export const AssignmentBoard: React.FC<AssignmentBoardProps> = ({
  tasks,
  employees,
  clients,
  onSelectTask,
  onOpenCreateTask,
  onUpdateTask,
}) => {
  const { profile, user } = useAuth();

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Dragging State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  // Undo Toast State
  const [lastAction, setLastAction] = useState<ReassignHistoryAction | null>(null);
  const [undoTimer, setUndoTimer] = useState<number | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter tasks based on search & toolbar
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesSearch = !search ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.clientName?.toLowerCase().includes(search.toLowerCase()) ||
        t.assigneeName?.toLowerCase().includes(search.toLowerCase());

      const matchesClient = !filterClient || t.clientId === filterClient || t.clientName === filterClient;
      const matchesPriority = !filterPriority || t.priority === filterPriority;
      const matchesCategory = !filterCategory || t.category === filterCategory;
      const matchesStatus = !filterStatus || t.status === filterStatus;

      return matchesSearch && matchesClient && matchesPriority && matchesCategory && matchesStatus;
    });
  }, [tasks, search, filterClient, filterPriority, filterCategory, filterStatus]);

  // Handle Reassignment
  const handleReassign = useCallback(async (taskId: string, targetEmpId?: string, targetEmpName?: string) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    const prevId = targetTask.assigneeId;
    const prevName = targetTask.assigneeName || 'Unassigned';
    const newId = targetEmpId || '';
    const newName = targetEmpName || 'Unassigned';

    if (prevId === newId) return;

    // 1. Instant optimistic update
    if (onUpdateTask) {
      onUpdateTask(taskId, newId, newName);
    }

    const actionData: ReassignHistoryAction = {
      taskId,
      taskTitle: targetTask.title,
      prevAssigneeId: prevId,
      prevAssigneeName: prevName,
      newAssigneeId: newId,
      newAssigneeName: newName,
      timestamp: new Date().toISOString()
    };

    try {
      // 2. Update Firestore
      await updateDoc(doc(db, 'tasks', taskId), {
        assigneeId: newId,
        assigneeName: newName,
        updatedAt: new Date().toISOString()
      });

      // 3. Audit Trail in Activity Logs
      await addDoc(collection(db, 'activityLogs'), {
        userId: user?.uid || '',
        userName: profile?.name || 'Super Admin',
        userRole: profile?.role || 'superAdmin',
        action: `reassigned task "${targetTask.title}" from ${prevName} to ${newName}`,
        details: `Task ID: ${taskId}`,
        createdAt: new Date().toISOString()
      });

      // 4. Synchronize assignee with parent Video Production workflow if linked
      syncTaskToVideoProduction({
        ...targetTask,
        assigneeId: newId,
        assigneeName: newName
      } as any, targetTask, profile).catch(e => console.warn('Sync reassignment to video notice:', e));

      // 5. Set Undo Toast
      setLastAction(actionData);
      if (undoTimer) clearTimeout(undoTimer);
      const timer = window.setTimeout(() => {
        setLastAction(null);
      }, 7000);
      setUndoTimer(timer);

    } catch (err) {
      console.warn('Reassignment Firestore notice (state maintained locally):', err);
    }
  }, [tasks, user, profile, undoTimer, onUpdateTask]);

  // Execute Undo
  const handleUndo = useCallback(async () => {
    if (!lastAction) return;
    const { taskId, prevAssigneeId, prevAssigneeName, taskTitle } = lastAction;
    const targetTask = tasks.find(t => t.id === taskId);

    // 1. Instant optimistic rollback
    if (onUpdateTask) {
      onUpdateTask(taskId, prevAssigneeId || '', prevAssigneeName || 'Unassigned');
    }

    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        assigneeId: prevAssigneeId || '',
        assigneeName: prevAssigneeName || 'Unassigned',
        updatedAt: new Date().toISOString()
      });

      if (targetTask) {
        syncTaskToVideoProduction({
          ...targetTask,
          assigneeId: prevAssigneeId || '',
          assigneeName: prevAssigneeName || 'Unassigned'
        } as any, targetTask, profile).catch(e => console.warn('Undo sync to video notice:', e));
      }

      await addDoc(collection(db, 'activityLogs'), {
        userId: user?.uid || '',
        userName: profile?.name || 'Super Admin',
        userRole: profile?.role || 'superAdmin',
        action: `undid reassignment of "${taskTitle}" back to ${prevAssigneeName}`,
        details: `Task ID: ${taskId}`,
        createdAt: new Date().toISOString()
      });

      setLastAction(null);
    } catch (err) {
      console.warn('Undo error notice:', err);
      setLastAction(null);
    }
  }, [lastAction, user, profile, onUpdateTask]);

  // Capacity calculation helper
  const getCapacityBadge = (taskCount: number) => {
    if (taskCount <= 2) return { label: 'Available', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' };
    if (taskCount <= 5) return { label: 'Balanced', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300' };
    if (taskCount <= 8) return { label: 'Busy', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300' };
    return { label: 'Heavy', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300' };
  };

  // Unassigned tasks
  const unassignedTasks = useMemo(() => {
    return filteredTasks.filter(t => {
      if (!t.assigneeId || t.assigneeId === 'unassigned' || !t.assigneeName || t.assigneeName === 'Unassigned') return true;
      const hasAssigned = employees.some(e => isTaskAssignedToEmployee(t, e));
      return !hasAssigned;
    });
  }, [filteredTasks, employees]);

  return (
    <div className="space-y-4 font-sans">
      {/* ─── Toolbar / Filters ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 bg-[#F7F8FC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-3 py-2 flex-1">
            <Search className="w-4 h-4 text-[#7A8496] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter assignments by task, client, employee..."
              className="bg-transparent text-xs font-semibold text-[#101828] dark:text-[#F7F8FC] placeholder-[#7A8496] outline-none w-full"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Client filter */}
          <select
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
            className="bg-[#F7F8FC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-2.5 py-2 text-xs font-bold text-[#101828] dark:text-[#F7F8FC] outline-none cursor-pointer"
          >
            <option value="" className="bg-white dark:bg-[#161B31] text-[#101828] dark:text-white">All Clients</option>
            {(clients && clients.length > 0 ? clients : []).map(c => {
              const val = c.id || c.clientId;
              const label = c.clientName || c.name || c.businessName || 'Client';
              return (
                <option key={val} value={val} className="bg-white dark:bg-[#161B31] text-[#101828] dark:text-white">
                  {label}
                </option>
              );
            })}
          </select>

          {/* Priority filter */}
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="bg-[#F7F8FC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-2.5 py-2 text-xs font-bold text-[#101828] dark:text-[#F7F8FC] outline-none cursor-pointer"
          >
            <option value="" className="bg-white dark:bg-[#161B31] text-[#101828] dark:text-white">All Priorities</option>
            <option value="Urgent" className="bg-white dark:bg-[#161B31] text-[#101828] dark:text-white">Urgent</option>
            <option value="High" className="bg-white dark:bg-[#161B31] text-[#101828] dark:text-white">High</option>
            <option value="Medium" className="bg-white dark:bg-[#161B31] text-[#101828] dark:text-white">Medium</option>
            <option value="Low" className="bg-white dark:bg-[#161B31] text-[#101828] dark:text-white">Low</option>
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-[#F7F8FC] dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 rounded-xl px-2.5 py-2 text-xs font-bold text-[#101828] dark:text-[#F7F8FC] outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="In Review">In Review</option>
            <option value="Done">Done</option>
          </select>

          {(search || filterPriority || filterStatus || filterClient) && (
            <button
              onClick={() => { setSearch(''); setFilterPriority(''); setFilterStatus(''); setFilterClient(''); }}
              className="px-2.5 py-2 rounded-xl text-xs font-bold text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-all flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ─── Undo Reassignment Toast ───────────────────────────────── */}
      {lastAction && (
        <div className="bg-[#101828] dark:bg-[#161B31] border-2 border-[#6C4CFF] text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-[#39D9C6] animate-pulse" />
            <span>
              Reassigned <strong className="text-white">"{lastAction.taskTitle}"</strong> to <strong className="text-[#39D9C6]">{lastAction.newAssigneeName}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={handleUndo}
            className="px-3 py-1 bg-[#6C4CFF] hover:bg-[#5835F5] text-white text-xs font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5 shadow-sm transition-all shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Undo
          </button>
        </div>
      )}

      {/* ─── Super Admin Employee Assignment Kanban Columns ───────── */}
      <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin select-none w-full min-w-0 max-w-full">
        
        {/* Column 1: Unassigned Lane */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOverColumnId('unassigned'); }}
          onDragLeave={() => setDragOverColumnId(null)}
          onDrop={e => {
            e.preventDefault();
            setDragOverColumnId(null);
            const taskId = e.dataTransfer.getData('text/plain');
            if (taskId) handleReassign(taskId, '', 'Unassigned');
          }}
          className={`w-72 sm:w-80 shrink-0 bg-[#F7F8FC] dark:bg-[#11152D] border rounded-2xl p-3.5 flex flex-col gap-3 min-h-[560px] transition-all ${
            dragOverColumnId === 'unassigned'
              ? 'border-2 border-dashed border-[#6C4CFF] bg-[#6C4CFF]/5'
              : 'border-[#D8DEE9] dark:border-white/10'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#D8DEE9] dark:border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-white/10 text-[#7A8496] flex items-center justify-center font-bold text-xs">
                <UserX className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#101828] dark:text-[#F7F8FC]">
                  Unassigned
                </h3>
                <p className="text-[10px] text-[#7A8496] font-medium">Needs owner</p>
              </div>
            </div>

            <span className="text-xs font-black bg-white dark:bg-white/10 border border-[#D8DEE9] dark:border-white/10 text-[#101828] dark:text-white px-2 py-0.5 rounded-full font-mono">
              {unassignedTasks.length}
            </span>
          </div>

          {/* Cards */}
          <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto pr-0.5">
            {unassignedTasks.length === 0 ? (
              <div className="flex-1 border border-dashed border-[#D8DEE9] dark:border-white/10 rounded-xl flex flex-col items-center justify-center p-6 text-center text-xs text-[#7A8496]">
                <Check className="w-6 h-6 text-emerald-500 mb-1" />
                <p className="font-bold text-[#101828] dark:text-white">All tasks assigned</p>
                <p className="text-[10px] mt-0.5">Drag tasks here to unassign.</p>
              </div>
            ) : (
              unassignedTasks.map(task => (
                <AssignmentCard
                  key={task.id}
                  task={task}
                  employees={employees}
                  todayStr={todayStr}
                  onSelectTask={onSelectTask}
                  onReassign={handleReassign}
                  onDragStart={id => setDraggedTaskId(id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Columns 2..N: Active Employees */}
        {employees.map(emp => {
          const empTasks = filteredTasks.filter(t => isTaskAssignedToEmployee(t, emp));
          const dueTodayCount = empTasks.filter(t => (t.dueDate || '').slice(0, 10) === todayStr).length;
          const capacity = getCapacityBadge(empTasks.length);

          return (
            <div
              key={emp.id}
              onDragOver={e => { e.preventDefault(); setDragOverColumnId(emp.id); }}
              onDragLeave={() => setDragOverColumnId(null)}
              onDrop={e => {
                e.preventDefault();
                setDragOverColumnId(null);
                const taskId = e.dataTransfer.getData('text/plain');
                if (taskId) handleReassign(taskId, emp.id, emp.name);
              }}
              className={`w-72 sm:w-80 shrink-0 bg-[#F7F8FC] dark:bg-[#11152D] border rounded-2xl p-3.5 flex flex-col gap-3 min-h-[560px] transition-all ${
                dragOverColumnId === emp.id
                  ? 'border-2 border-dashed border-[#6C4CFF] bg-[#6C4CFF]/5'
                  : 'border-[#D8DEE9] dark:border-white/10'
              }`}
            >
              {/* Employee Column Header */}
              <div className="border-b border-[#D8DEE9] dark:border-white/10 pb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#6C4CFF] to-[#2563FF] text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {emp.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-black text-[#101828] dark:text-[#F7F8FC] truncate">
                        {emp.name}
                      </h3>
                      <p className="text-[10px] text-[#475467] dark:text-[#AEB3C5] truncate">
                        {emp.role || 'Team Member'}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-black bg-white dark:bg-white/10 border border-[#D8DEE9] dark:border-white/10 text-[#101828] dark:text-white px-2 py-0.5 rounded-full font-mono shrink-0">
                    {empTasks.length}
                  </span>
                </div>

                {/* Capacity & Leave Warning Indicator */}
                <div className="flex items-center justify-between gap-2 pt-1 text-[10px]">
                  <span className={`px-2 py-0.5 rounded-md border font-black uppercase tracking-wider ${capacity.color}`}>
                    {capacity.label} · {empTasks.length} Tasks
                  </span>

                  {emp.onLeave ? (
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-bold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> On Leave
                    </span>
                  ) : dueTodayCount > 0 ? (
                    <span className="font-bold text-[#6C4CFF] dark:text-[#8068FF]">
                      {dueTodayCount} due today
                    </span>
                  ) : (
                    <span className="text-[#7A8496]">All on track</span>
                  )}
                </div>
              </div>

              {/* Cards Container */}
              <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto pr-0.5">
                {empTasks.length === 0 ? (
                  <div className="flex-1 border border-dashed border-[#D8DEE9] dark:border-white/10 rounded-xl flex flex-col items-center justify-center p-6 text-center text-xs text-[#7A8496]">
                    <Sparkles className="w-5 h-5 text-[#6C4CFF] mb-1 opacity-70" />
                    <p className="font-bold text-[#101828] dark:text-white">Capacity Available</p>
                    <p className="text-[10px] mt-0.5">Drag tasks here to assign.</p>
                  </div>
                ) : (
                  empTasks.map(task => (
                    <AssignmentCard
                      key={task.id}
                      task={task}
                      employees={employees}
                      todayStr={todayStr}
                      onSelectTask={onSelectTask}
                      onReassign={handleReassign}
                      onDragStart={id => setDraggedTaskId(id)}
                    />
                  ))
                )}
              </div>

              {/* Quick Add to Employee */}
              {onOpenCreateTask && (
                <button
                  type="button"
                  onClick={() => onOpenCreateTask(emp.id)}
                  className="w-full py-2 border border-dashed border-[#D8DEE9] dark:border-white/10 hover:bg-white dark:hover:bg-white/5 text-[11px] font-bold text-[#7A8496] hover:text-[#6C4CFF] rounded-xl flex items-center justify-center gap-1.5 transition-all mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign New Task</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Subcomponent: Assignment Task Card ────────────────────────────────
const AssignmentCard: React.FC<{
  task: Task;
  employees: Employee[];
  todayStr: string;
  onSelectTask?: (task: Task) => void;
  onReassign: (taskId: string, targetId?: string, targetName?: string) => void;
  onDragStart: (id: string) => void;
}> = ({ task, employees, todayStr, onSelectTask, onReassign, onDragStart }) => {
  const [reassignOpen, setReassignOpen] = useState(false);
  const isOverdue = task.dueDate && task.dueDate < todayStr && task.status !== 'Done' && task.status !== 'Completed';

  const priorityBadge = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300';
      case 'High': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300';
      case 'Medium': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-300';
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'Done':
      case 'Completed': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300';
      case 'In Review': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300';
      case 'In Progress': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-300';
    }
  };

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart(task.id);
      }}
      className="bg-white dark:bg-[#161B31] border border-[#D8DEE9] dark:border-white/10 p-3.5 rounded-xl shadow-xs hover:shadow-md hover:border-[#6C4CFF]/40 transition-all space-y-2.5 group cursor-grab active:cursor-grabbing relative"
    >
      {/* Title & Priority */}
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <GripVertical className="w-3.5 h-3.5 text-[#7A8496] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            <h4
              onClick={() => onSelectTask && onSelectTask(task)}
              className="text-xs font-bold text-[#101828] dark:text-[#F7F8FC] leading-snug cursor-pointer hover:text-[#6C4CFF] dark:hover:text-[#8068FF] transition-colors truncate"
            >
              {task.title}
            </h4>
          </div>

          <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-md border shrink-0 ${priorityBadge(task.priority)}`}>
            {task.priority}
          </span>
        </div>

        {task.clientName && (
          <p className="text-[11px] font-medium text-[#475467] dark:text-[#AEB3C5] truncate">
            🏢 {task.clientName}
          </p>
        )}
      </div>

      {/* Metadata & Status */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#D8DEE9]/60 dark:border-white/10 text-[10px]">
        <span className={`px-2 py-0.5 rounded-md border font-bold ${statusBadge(task.status)}`}>
          {task.status}
        </span>

        {task.dueDate && (
          <div className={`flex items-center gap-1 font-bold ${
            isOverdue ? 'text-rose-600 font-extrabold' : 'text-[#7A8496]'
          }`}>
            <Calendar className="w-3 h-3" />
            <span>{task.dueDate}</span>
          </div>
        )}
      </div>

      {/* Touch / Quick Reassign Selector */}
      <div className="pt-1 flex items-center justify-between text-[10px] text-[#7A8496]">
        <span>Assignee:</span>
        <select
          value={task.assigneeId || ''}
          onChange={e => {
            const targetId = e.target.value;
            const targetEmp = employees.find(emp => emp.id === targetId);
            onReassign(task.id, targetId, targetEmp ? targetEmp.name : 'Unassigned');
          }}
          className="bg-[#F7F8FC] dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 text-[#6C4CFF] dark:text-[#8068FF] font-bold px-2 py-0.5 rounded-lg outline-none cursor-pointer max-w-[150px] truncate"
        >
          <option value="">Unassigned</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
};
