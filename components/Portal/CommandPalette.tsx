import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Command, X, Briefcase, Users, CheckSquare, Calendar,
  Film, FileText, ArrowRight, Sparkles, Plus, Clock, ExternalLink,
  ChevronRight, Shield, Zap, TrendingUp
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { DEFAULT_CLIENTS_MASTER } from '../../lib/clientMaster';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
  onOpenCreateTask?: () => void;
  onOpenCreateWorkLog?: () => void;
}

interface SearchItem {
  id: string;
  type: 'client' | 'task' | 'employee' | 'content' | 'video' | 'action';
  title: string;
  subtitle?: string;
  badge?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  setActiveTab,
  onOpenCreateTask,
  onOpenCreateWorkLog
}) => {
  const [queryText, setQueryText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cached collections for fast search
  const [clients, setClients] = useState<any[]>(DEFAULT_CLIENTS_MASTER);
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [content, setContent] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    // Focus input on open
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    // Fetch snapshot of records for indexing
    const loadSearchData = async () => {
      try {
        const [cSnap, tSnap, eSnap, calSnap, vSnap] = await Promise.all([
          getDocs(collection(db, 'clients')),
          getDocs(collection(db, 'tasks')),
          getDocs(collection(db, 'employees')),
          getDocs(collection(db, 'contentCalendar')),
          getDocs(collection(db, 'videoTracker')),
        ]);

        if (!cSnap.empty) setClients(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        if (!tSnap.empty) setTasks(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        if (!eSnap.empty) setEmployees(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        if (!calSnap.empty) setContent(calSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        if (!vSnap.empty) setVideos(vSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.warn('CommandPalette search index load notice:', e);
      }
    };

    loadSearchData();
  }, [isOpen]);

  // Quick Action Items
  const quickActions: SearchItem[] = useMemo(() => [
    {
      id: 'act-cmd-center',
      type: 'action',
      title: 'Go to Command Center',
      subtitle: 'Agency operations dashboard',
      badge: 'Overview',
      action: () => { setActiveTab('dashboard'); onClose(); }
    },
    {
      id: 'act-my-day',
      type: 'action',
      title: 'Go to My Day',
      subtitle: 'Personal priorities and attendance',
      badge: 'Personal',
      action: () => { setActiveTab('myday'); onClose(); }
    },
    {
      id: 'act-create-task',
      type: 'action',
      title: 'Create New Task',
      subtitle: 'Assign deliverable to team member',
      badge: 'Action',
      action: () => {
        if (onOpenCreateTask) onOpenCreateTask();
        else setActiveTab('tasks');
        onClose();
      }
    },
    {
      id: 'act-create-worklog',
      type: 'action',
      title: 'Log Work Done',
      subtitle: 'Submit manual deliverable record',
      badge: 'Action',
      action: () => {
        if (onOpenCreateWorkLog) onOpenCreateWorkLog();
        else setActiveTab('worklog');
        onClose();
      }
    },
    {
      id: 'act-assignment-board',
      type: 'action',
      title: 'Open Assignment Board',
      subtitle: 'Super Admin drag-and-drop task allocation',
      badge: 'Tasks',
      action: () => { setActiveTab('tasks'); onClose(); }
    },
    {
      id: 'act-attendance',
      type: 'action',
      title: 'Open Attendance & Leaves',
      subtitle: 'Daily staff attendance and leave approvals',
      badge: 'People',
      action: () => { setActiveTab('attendance'); onClose(); }
    },
    {
      id: 'act-clients',
      type: 'action',
      title: 'Open Clients Directory',
      subtitle: 'Active brand workspaces & deliverables',
      badge: 'Operations',
      action: () => { setActiveTab('clients'); onClose(); }
    },
  ], [setActiveTab, onClose, onOpenCreateTask, onOpenCreateWorkLog]);

  // Combined Results Filtered by Query
  const searchResults: SearchItem[] = useMemo(() => {
    const q = queryText.toLowerCase().trim();
    if (!q) return quickActions;

    const list: SearchItem[] = [];

    // 1. Clients
    clients.forEach(c => {
      const name = c.clientName || c.name || c.businessName || '';
      const biz = c.businessName || c.category || '';
      if (name.toLowerCase().includes(q) || biz.toLowerCase().includes(q)) {
        list.push({
          id: `cli-${c.id || c.clientId}`,
          type: 'client',
          title: name,
          subtitle: `${biz} · ${c.package || 'Client'}`,
          badge: 'Client',
          action: () => { setActiveTab('clients'); onClose(); }
        });
      }
    });

    // 2. Tasks
    tasks.forEach(t => {
      const title = t.title || '';
      const client = t.clientName || '';
      const assignee = t.assigneeName || '';
      if (title.toLowerCase().includes(q) || client.toLowerCase().includes(q) || assignee.toLowerCase().includes(q)) {
        list.push({
          id: `tsk-${t.id}`,
          type: 'task',
          title: title,
          subtitle: `${client || 'General'} · Assignee: ${assignee || 'Unassigned'} · ${t.status}`,
          badge: t.priority || 'Task',
          action: () => { setActiveTab('tasks'); onClose(); }
        });
      }
    });

    // 3. Employees
    employees.forEach(e => {
      const name = e.name || '';
      const role = e.role || e.designation || '';
      if (name.toLowerCase().includes(q) || role.toLowerCase().includes(q)) {
        list.push({
          id: `emp-${e.id}`,
          type: 'employee',
          title: name,
          subtitle: `${role} · ${e.email || ''}`,
          badge: 'Employee',
          action: () => { setActiveTab('admins'); onClose(); }
        });
      }
    });

    // 4. Content Calendar
    content.forEach(cnt => {
      const topic = cnt.topic || cnt.title || '';
      const client = cnt.clientName || '';
      if (topic.toLowerCase().includes(q) || client.toLowerCase().includes(q)) {
        list.push({
          id: `cnt-${cnt.id}`,
          type: 'content',
          title: topic,
          subtitle: `${client} · ${cnt.contentType || 'Post'} · ${cnt.date || ''}`,
          badge: 'Content',
          action: () => { setActiveTab('calendar'); onClose(); }
        });
      }
    });

    // 5. Videos
    videos.forEach(v => {
      const topic = v.topic || v.title || '';
      const client = v.clientName || '';
      if (topic.toLowerCase().includes(q) || client.toLowerCase().includes(q)) {
        list.push({
          id: `vid-${v.id}`,
          type: 'video',
          title: topic,
          subtitle: `${client} · Status: ${v.status || 'Planned'}`,
          badge: 'Video',
          action: () => { setActiveTab('videos'); onClose(); }
        });
      }
    });

    // Also match quick actions
    quickActions.forEach(act => {
      if (act.title.toLowerCase().includes(q) || act.subtitle?.toLowerCase().includes(q)) {
        list.push(act);
      }
    });

    return list.slice(0, 15);
  }, [queryText, clients, tasks, employees, content, videos, quickActions, setActiveTab, onClose]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, searchResults.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + searchResults.length) % Math.max(1, searchResults.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (searchResults[selectedIndex]) {
          searchResults[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchResults, selectedIndex, onClose]);

  if (!isOpen) return null;

  const getTypeIcon = (type: SearchItem['type']) => {
    switch (type) {
      case 'client': return <Briefcase className="w-4 h-4 text-[#2563FF]" />;
      case 'task': return <CheckSquare className="w-4 h-4 text-[#6C4CFF]" />;
      case 'employee': return <Users className="w-4 h-4 text-[#16A34A]" />;
      case 'content': return <Calendar className="w-4 h-4 text-[#39D9C6]" />;
      case 'video': return <Film className="w-4 h-4 text-[#FF5A5F]" />;
      default: return <Zap className="w-4 h-4 text-[#6C4CFF]" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-70 flex items-start justify-center pt-[12vh] p-4 animate-in fade-in duration-150">
      <div 
        className="bg-white dark:bg-[#11152D] border border-[#D8DEE9] dark:border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[75vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#D8DEE9] dark:border-white/10 bg-[#F7F8FC] dark:bg-[#161B31]">
          <Search className="w-5 h-5 text-[#6C4CFF] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={queryText}
            onChange={e => { setQueryText(e.target.value); setSelectedIndex(0); }}
            placeholder="Search clients, tasks, employees, deliverables, or commands (Ctrl+K)..."
            className="w-full bg-transparent text-sm font-semibold text-[#101828] dark:text-[#F7F8FC] placeholder-[#7A8496] outline-none"
          />
          {queryText ? (
            <button
              onClick={() => setQueryText('')}
              className="p-1 rounded-lg text-[#7A8496] hover:text-[#101828] dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#EEF1F7] dark:bg-white/10 text-[#7A8496] border border-[#D8DEE9] dark:border-white/10 shrink-0">
              ESC
            </span>
          )}
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 space-y-1 flex-1">
          {searchResults.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#7A8496]">
              <p className="font-bold text-[#101828] dark:text-white">No results found for "{queryText}"</p>
              <p className="text-[11px] mt-1">Try searching for a client name, task deliverable, or action.</p>
            </div>
          ) : (
            searchResults.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#6C4CFF]/10 text-[#6C4CFF] dark:text-[#8068FF] border border-[#6C4CFF]/25 shadow-xs'
                      : 'hover:bg-[#F7F8FC] dark:hover:bg-white/5 text-[#101828] dark:text-[#F7F8FC] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-[#6C4CFF] text-white shadow-xs' : 'bg-[#EEF1F7] dark:bg-white/5'
                    }`}>
                      {getTypeIcon(item.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="text-[11px] text-[#475467] dark:text-[#AEB3C5] truncate mt-0.2">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#EEF1F7] dark:bg-white/10 text-[#475467] dark:text-[#AEB3C5]">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-[#6C4CFF]' : 'text-slate-400 opacity-50'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-[#D8DEE9] dark:border-white/10 bg-[#F7F8FC] dark:bg-[#161B31] flex items-center justify-between text-[10px] text-[#7A8496]">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono font-bold bg-[#EEF1F7] dark:bg-white/10 px-1.5 py-0.5 rounded border border-[#D8DEE9] dark:border-white/10">↑↓</kbd> Navigate</span>
            <span><kbd className="font-mono font-bold bg-[#EEF1F7] dark:bg-white/10 px-1.5 py-0.5 rounded border border-[#D8DEE9] dark:border-white/10">↵</kbd> Select</span>
            <span><kbd className="font-mono font-bold bg-[#EEF1F7] dark:bg-white/10 px-1.5 py-0.5 rounded border border-[#D8DEE9] dark:border-white/10">ESC</kbd> Close</span>
          </div>
          <span className="font-bold text-[#6C4CFF] dark:text-[#8068FF]">Digiexplode Omnibar</span>
        </div>
      </div>
    </div>
  );
};
