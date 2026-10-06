import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { type CalendarEntry } from './ContentCalendar';
import { type ClientData } from './ClientList';
import { CustomProgressCircle, CustomBarChart } from './CustomCharts';
import { 
  Plus, 
  Sparkles, 
  Award, 
  Clock, 
  MessageSquare, 
  Instagram, 
  Facebook, 
  Youtube, 
  PlusCircle, 
  CheckCircle2, 
  TrendingUp, 
  Activity, 
  BellRing,
  ArrowRight,
  Film,
  CheckCircle,
  Video,
  Trash2
} from 'lucide-react';

export interface VideoEntry {
  id: string;
  clientName: string;
  videoCount: number;
  shotDate: string; // YYYY-MM-DD
  status: 'Pending' | 'Shot' | 'Edited';
  editorName: string;
  shotTakenBy: string;
  editorAssigned: string;
  notes: string;
  createdAt: string;
}

interface DashboardOverviewProps {
  setActiveTab: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ setActiveTab }) => {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [clientTasks, setClientTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Today's Focus Tasks / Daily Checklist (saved to localStorage per user)
  const [focusTasks, setFocusTasks] = useState<{ id: string; text: string; completed: boolean }[]>(() => {
    try {
      const stored = localStorage.getItem(`focus_tasks_${profile?.userId || 'guest'}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [newFocusTaskText, setNewFocusTaskText] = useState('');

  useEffect(() => {
    if (profile?.userId) {
      localStorage.setItem(`focus_tasks_${profile.userId}`, JSON.stringify(focusTasks));
    }
  }, [focusTasks, profile?.userId]);

  const handleAddFocusTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFocusTaskText.trim()) return;
    const newTask = {
      id: "focus_" + Math.random().toString(36).substr(2, 9),
      text: newFocusTaskText.trim(),
      completed: false,
    };
    setFocusTasks(prev => [...prev, newTask]);
    setNewFocusTaskText('');
  };

  const toggleFocusTask = (id: string) => {
    setFocusTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteFocusTask = (id: string) => {
    setFocusTasks(prev => prev.filter(t => t.id !== id));
  };

  // Stats Counters
  useEffect(() => {
    if (!profile) return;

    setLoading(true);
    let q;
    const colRef = collection(db, 'contentCalendar');

    if (profile?.role === 'client') {
      q = query(colRef, where('clientId', '==', profile.clientId || 'none'));
    } else if (profile?.role === 'admin') {
      if (profile.assignedClientIds && profile.assignedClientIds.length > 0) {
        q = query(colRef, where('clientId', 'in', profile.assignedClientIds));
      } else {
        q = query(colRef, where('clientId', '==', 'none'));
      }
    } else {
      q = colRef;
    }

    const unsubscribeEntries = onSnapshot(q, (snapshot) => {
      const all: CalendarEntry[] = [];
      snapshot.forEach((doc) => {
        all.push({ contentId: doc.id, ...doc.data() } as CalendarEntry);
      });
      setEntries(all);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'contentCalendar');
      setLoading(false);
    });

    let unsubscribeClients = () => {};
    if (profile?.role !== 'employee') {
      const clientsRef = collection(db, 'clients');
      unsubscribeClients = onSnapshot(clientsRef, (snapshot) => {
        const clientList: ClientData[] = [];
        snapshot.forEach((doc) => {
          clientList.push({ clientId: doc.id, ...doc.data() } as ClientData);
        });
        setClients(clientList);
      }, (error) => {
        console.warn("Could not load clients list on dashboard: ", error);
      });
    } else {
      setClients([]);
    }

    // Subscribe to Video Tracker
    const videosRef = collection(db, 'videoTracker');
    const unsubscribeVideos = onSnapshot(videosRef, (snapshot) => {
      const videoList: VideoEntry[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const count = typeof data.videoCount === 'number' 
          ? data.videoCount 
          : (parseInt(data.topic) || 1);
        videoList.push({
          id: doc.id,
          clientName: data.clientName || 'Unknown',
          videoCount: count,
          shotDate: data.shotDate || data.recordingDate || '',
          status: data.status || 'Shot',
          editorName: data.editorName || data.editedBy || '',
          shotTakenBy: data.shotTakenBy || data.recordedBy || '',
          editorAssigned: data.editorAssigned || '',
          notes: data.notes || '',
          createdAt: data.createdAt || new Date().toISOString()
        } as VideoEntry);
      });
      setVideos(videoList);
    }, (error) => {
      console.warn("Could not load videos tracker list on dashboard: ", error);
    });

    // Subscribe to Tasks
    const tasksRef = collection(db, 'clientTasks');
    const unsubscribeTasks = onSnapshot(tasksRef, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ taskId: doc.id, ...doc.data() });
      });
      setClientTasks(list);
    }, (error) => {
      console.warn("Could not load tasks for dashboard widgets: ", error);
    });

    // Subscribe to Employees
    const empRef = collection(db, 'employees');
    const unsubscribeEmployees = onSnapshot(empRef, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ employeeId: doc.id, ...doc.data() });
      });
      setEmployees(list);
    }, (error) => {
      console.warn("Could not load employees for dashboard workload: ", error);
    });

    // Subscribe to Notifications
    const notifRef = collection(db, 'notifications');
    const unsubscribeNotifications = onSnapshot(notifRef, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
      setNotifications(list);
    }, (error) => {
      console.warn("Could not load notifications: ", error);
    });

    return () => {
      unsubscribeEntries();
      unsubscribeClients();
      unsubscribeVideos();
      unsubscribeTasks();
      unsubscribeEmployees();
      unsubscribeNotifications();
    };
  }, [profile]);

  // Aggregate stats parameters
  const totalPlannedThisMonth = entries.length;
  const pendingApprovalsCount = entries.filter(e => e.clientApprovalStatus === 'Pending' || e.status === 'Sent for Approval').length;
  const approvedCount = entries.filter(e => e.clientApprovalStatus === 'Approved').length;
  const postedCount = entries.filter(e => e.postedStatus === 'Posted').length;

  const instaDone = entries.filter(e => e.platform === 'Instagram' && e.postedStatus === 'Posted').length;
  const fbDone = entries.filter(e => e.platform === 'Facebook' && e.postedStatus === 'Posted').length;
  const ytDone = entries.filter(e => e.platform === 'YouTube' && e.postedStatus === 'Posted').length;

  // Active client details
  const activeClients = clients.filter(c => c.status === 'Active');

  // Filter today's posting agenda items
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTasks = entries.filter(e => e.date === todayStr);

  // Custom charts mock aggregation
  const platformChartData = [
    { name: 'Instagram', value: entries.filter(e => e.platform === 'Instagram').length, color: 'bg-pink-500' },
    { name: 'Facebook', value: entries.filter(e => e.platform === 'Facebook').length, color: 'bg-blue-600' },
    { name: 'YouTube', value: entries.filter(e => e.platform === 'YouTube').length, color: 'bg-red-650' },
    { name: 'LinkedIn', value: entries.filter(e => e.platform === 'LinkedIn').length, color: 'bg-cyan-600' },
  ];

  // Helper matchers for logged-in user
  const myName = (profile?.name || '').toLowerCase();
  const myEmail = (profile?.email || '').toLowerCase();

  const isMyAssignedVideo = (video: VideoEntry) => {
    const assigned = (video.editorAssigned || '').toLowerCase();
    return assigned !== '' && (assigned === myName || myEmail.includes(assigned) || myName.includes(assigned));
  };

  const isMyShotVideo = (video: VideoEntry) => {
    const shooter = (video.shotTakenBy || '').toLowerCase();
    return shooter !== '' && (shooter === myName || myEmail.includes(shooter) || myName.includes(shooter));
  };

  const myPendingFilmingCount = videos.filter(v => v.status === 'Pending' && isMyShotVideo(v)).reduce((sum, v) => sum + (v.videoCount || 0), 0);
  const myPendingEditingCount = videos.filter(v => v.status === 'Shot' && isMyAssignedVideo(v)).reduce((sum, v) => sum + (v.videoCount || 0), 0);
  const myCompletedEditsCount = videos.filter(v => v.status === 'Edited' && v.editorName.toLowerCase() === myName).reduce((sum, v) => sum + (v.videoCount || 0), 0);
  const myCompletedShootsCount = videos.filter(v => (v.status === 'Shot' || v.status === 'Edited') && isMyShotVideo(v)).reduce((sum, v) => sum + (v.videoCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Visual greeting line */}
      <div className="bg-gradient-to-r from-[#0E1428] via-[#0D1F3C] to-[#0E1428] p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        {/* Glow circle overlay */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-550/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-12 w-64 h-64 bg-purple-550/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative space-y-2 max-w-xl">
          <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/40 px-3 py-1 rounded inline-block">
            DigiexplodeAI Portal Access
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            Welcome Back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-blue-400">{profile?.name || 'Partner'}</span>!
          </h2>
          <p className="text-xs sm:text-sm font-medium text-slate-300 leading-relaxed">
            {profile?.role === 'superAdmin' 
              ? 'Full management dashboard loaded. Here is your agency overview performance state.'
              : profile?.role === 'employee'
                ? 'Your active production desk is loaded. Track your upcoming shoots and assigned video edits below.'
                : 'Our designs are waiting for your overview. Examine calendar entries below.'}
          </p>
        </div>
      </div>

      {/* KPI Stats Panel Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {profile?.role === 'employee' ? (
          <>
            {/* Staff Metric 1 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 p-4 sm:p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[10px] font-black uppercase text-amber-500 block">Pending Shoots (Filming)</span>
              <h3 className="text-2xl font-black text-slate-905 dark:text-white flex items-center gap-1.5">
                <Video className="w-5 h-5 text-amber-500" />
                {myPendingFilmingCount}
              </h3>
              <p className="text-[9px] font-bold text-slate-450 dark:text-slate-400">Assigned shoots remaining</p>
            </div>

            {/* Staff Metric 2 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 p-4 sm:p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[10px] font-black uppercase text-indigo-500 block">Pending Video Edits</span>
              <h3 className="text-2xl font-black text-slate-905 dark:text-white flex items-center gap-1.5">
                <Film className="w-5 h-5 text-indigo-500" />
                {myPendingEditingCount}
              </h3>
              <p className="text-[9px] font-bold text-slate-450 dark:text-slate-400">Edits waiting for completion</p>
            </div>

            {/* Staff Metric 3 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 p-4 sm:p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[10px] font-black uppercase text-emerald-500 block">My Completed Shoots</span>
              <h3 className="text-2xl font-black text-emerald-500 flex items-center gap-1.5">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                {myCompletedShootsCount}
              </h3>
              <p className="text-[9px] font-bold text-slate-450 dark:text-slate-400">Total filmed videos</p>
            </div>

            {/* Staff Metric 4 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 p-4 sm:p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[10px] font-black uppercase text-cyan-500 block">My Completed Edits</span>
              <h3 className="text-2xl font-black text-cyan-550 flex items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-cyan-550" />
                {myCompletedEditsCount}
              </h3>
              <p className="text-[9px] font-bold text-slate-450 dark:text-slate-400">Total completed video edits</p>
            </div>
          </>
        ) : (
          <>
            {/* Metric 1 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 p-4 sm:p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 block">Planned Posts</span>
              <h3 className="text-2xl font-black text-slate-905 dark:text-white">{totalPlannedThisMonth}</h3>
              <p className="text-[9px] font-bold text-slate-450 dark:text-slate-400">Total Month Campaign</p>
            </div>

            {/* Metric 2 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 p-4 sm:p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[10px] font-black uppercase text-amber-500 block">Pending Reviews</span>
              <h3 className="text-2xl font-black text-amber-500">{pendingApprovalsCount}</h3>
              <p className="text-[9px] font-bold text-slate-450 dark:text-slate-400">Requires Feedback</p>
            </div>

            {/* Metric 3 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 p-4 sm:p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[10px] font-black uppercase text-emerald-500 block">Approved Assets</span>
              <h3 className="text-2xl font-black text-emerald-500">{approvedCount}</h3>
              <p className="text-[9px] font-bold text-slate-450 dark:text-slate-400">Ready for Publish</p>
            </div>

            {/* Metric 4 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 p-4 sm:p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 block">Published Posts</span>
              <h3 className="text-2xl font-black text-purple-600 dark:text-cyan-400">{postedCount}</h3>
              <p className="text-[9px] font-bold text-slate-450 dark:text-slate-400">Live this month</p>
            </div>
          </>
        )}
      </div>

      {/* Live Operations Command Deck with requested widgets */}
      {profile?.role !== 'client' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-500" />
                Live Operations Command Deck
              </h3>
              <p className="text-[11px] font-bold text-slate-450 mt-0.5">Real-time indicators across client workspaces, deadlines, and staff allocation.</p>
            </div>
            <span className="text-[10px] font-black bg-purple-500/10 text-purple-600 dark:text-cyan-400 px-3 py-1 rounded-xl uppercase tracking-widest border border-purple-500/10">
              Agency Active Pulse
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Widget 1: Awaiting Approval & Unassigned Tasks */}
            <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-850/80 space-y-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Queue Backlogs</span>
              <div className="divide-y divide-slate-150/40 dark:divide-slate-850/40 space-y-2.5">
                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs font-bold text-slate-650 dark:text-slate-300">Awaiting Approval</span>
                  <span className="text-xs font-black text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/10">{pendingApprovalsCount} posts</span>
                </div>
                <div className="flex justify-between items-center pt-2.5">
                  <span className="text-xs font-bold text-slate-650 dark:text-slate-300">Unassigned Tasks</span>
                  <span className="text-xs font-black text-purple-500 bg-purple-500/10 px-2.5 py-0.5 rounded-lg border border-purple-500/10">
                    {clientTasks.filter(t => (!t.assigneeId || t.assigneeId === '') && t.status !== 'Done').length} tasks
                  </span>
                </div>
              </div>
            </div>

            {/* Widget 2: Deadlines Tracker */}
            <div className="bg-slate-50 dark:bg-slate-955/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-850/80 space-y-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Deadlines & SLA</span>
              <div className="divide-y divide-slate-150/40 dark:divide-slate-850/40 space-y-2.5">
                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs font-bold text-slate-650 dark:text-slate-300">Work Due Today</span>
                  <span className="text-xs font-black text-blue-500 bg-blue-500/10 px-2.5 py-0.5 rounded-lg border border-blue-500/10">
                    {clientTasks.filter(t => t.dueDate === new Date().toISOString().split('T')[0] && t.status !== 'Done').length} active
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2.5">
                  <span className="text-xs font-bold text-slate-650 dark:text-slate-300">Overdue Tasks</span>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg border ${
                    clientTasks.filter(t => t.status !== 'Done' && t.dueDate && t.dueDate < new Date().toISOString().split('T')[0]).length > 0
                      ? 'text-rose-500 bg-rose-500/10 border-rose-500/10'
                      : 'text-slate-400 bg-slate-100/50 dark:bg-slate-900'
                  }`}>
                    {clientTasks.filter(t => t.status !== 'Done' && t.dueDate && t.dueDate < new Date().toISOString().split('T')[0]).length} critical
                  </span>
                </div>
              </div>
            </div>

            {/* Widget 3: Employee Workloads */}
            <div className="bg-slate-50 dark:bg-slate-955/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-850/80 space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Staff Shoots & Tasks</span>
              <div className="space-y-1.5 max-h-[85px] overflow-y-auto pr-0.5">
                {employees.length === 0 ? (
                  <span className="text-[10px] text-slate-400 italic font-bold">No active employees.</span>
                ) : (
                  employees.map(emp => {
                    const activeCount = clientTasks.filter(t => t.assigneeId === emp.employeeId && t.status !== 'Done').length;
                    const empNameLower = emp.name.toLowerCase();
                    const pendingShoots = videos.filter(v => v.status === 'Pending' && (v.shotTakenBy || '').toLowerCase() === empNameLower).reduce((sum, v) => sum + (v.videoCount || 0), 0);
                    const pendingEdits = videos.filter(v => v.status === 'Shot' && (v.editorAssigned || '').toLowerCase() === empNameLower).reduce((sum, v) => sum + (v.videoCount || 0), 0);
                    return (
                      <div key={emp.employeeId} className="flex justify-between items-center text-[10px] font-bold border-b border-slate-100/10 pb-1">
                        <div className="truncate pr-1">
                          <span className="text-slate-650 dark:text-slate-300 truncate max-w-[90px] block">{emp.name}</span>
                          <span className="text-[8px] text-slate-400 uppercase tracking-widest">{emp.role}</span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {pendingShoots > 0 && (
                            <span className="bg-amber-500/10 text-amber-500 px-1 py-0.2 rounded font-black text-[8px]" title="Pending Shoots">
                              🎥 {pendingShoots}
                            </span>
                          )}
                          {pendingEdits > 0 && (
                            <span className="bg-indigo-500/10 text-indigo-400 px-1 py-0.2 rounded font-black text-[8px]" title="Pending Edits">
                              🎬 {pendingEdits}
                            </span>
                          )}
                          {activeCount > 0 && (
                            <span className="bg-purple-500/10 text-purple-400 px-1 py-0.2 rounded font-black text-[8px]" title="Active Tasks">
                              📋 {activeCount}
                            </span>
                          )}
                          {pendingShoots === 0 && pendingEdits === 0 && activeCount === 0 && (
                            <span className="text-green-500 text-[8px] font-black uppercase">Free</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Widget 4: Client-wise Pending Work */}
            <div className="bg-slate-50 dark:bg-slate-955/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-850/80 space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Client Pending Work</span>
              <div className="space-y-1.5 max-h-[85px] overflow-y-auto pr-0.5">
                {clients.length === 0 ? (
                  <span className="text-[10px] text-slate-400 italic font-bold">No active clients.</span>
                ) : (
                  clients.slice(0, 3).map(c => {
                    const pendingCount = clientTasks.filter(t => t.clientId === c.clientId && t.status !== 'Done').length;
                    return (
                      <div key={c.clientId} className="flex justify-between items-center text-[11px] font-bold">
                        <span className="text-slate-600 dark:text-slate-350 truncate max-w-[100px]">{c.clientName}</span>
                        <span className="text-cyan-550 bg-cyan-550/5 px-1.5 py-0.2 rounded font-black">{pendingCount} pending</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Live System Notification Feed */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-850/60">
            <h4 className="text-[10px] font-black uppercase text-purple-650 dark:text-purple-400 tracking-wider mb-2">Live Agency Alerts & Notifications</h4>
            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
              {notifications.length === 0 ? (
                <div className="p-3 bg-slate-50 dark:bg-slate-955/20 text-center rounded-xl text-[10px] text-slate-450 italic font-bold border border-slate-100 dark:border-slate-850">
                  No notifications recorded.
                </div>
              ) : (
                notifications.slice(0, 4).map(n => (
                  <div key={n.id} className="p-2.5 bg-slate-50/50 dark:bg-slate-955/40 border border-slate-100 dark:border-slate-855 rounded-xl flex justify-between items-start text-[11px] font-semibold gap-4 shadow-2xs hover:shadow-sm transition-all">
                    <div className="space-y-0.5">
                      <p className="text-slate-850 dark:text-slate-200">{n.message}</p>
                      <span className="text-[9px] text-slate-400">Triggered by: <strong>{n.actorName || 'System'}</strong></span>
                    </div>
                    <span className="text-[9px] text-slate-450 dark:text-slate-500 whitespace-nowrap shrink-0">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Second level: Charts vs Production Queue based on role */}
      {profile?.role === 'employee' ? (
        /* Staff Assignments Panel Row */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* 1. Shoots to Film (Pending Status) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-750 dark:text-slate-205">My Pending Shoots ({videos.filter(v => v.status === 'Pending' && isMyShotVideo(v)).length} tasks)</h3>
              </div>
              <span className="text-[10px] font-black bg-amber-50 dark:bg-amber-950/35 text-amber-750 dark:text-amber-400 px-2.5 py-0.5 rounded-full uppercase">Filming Needed</span>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {videos.filter(v => v.status === 'Pending' && isMyShotVideo(v)).length === 0 ? (
                <div className="text-center py-8 text-slate-400 italic text-xs font-medium bg-slate-50/55 dark:bg-slate-950/20 rounded-2xl border border-dashed border-slate-150 dark:border-slate-850">
                  🎉 No pending shoots assigned to you!
                </div>
              ) : (
                videos.filter(v => v.status === 'Pending' && isMyShotVideo(v)).map(video => (
                  <div key={video.id} className="bg-slate-50 dark:bg-slate-955 p-4 rounded-2xl border border-slate-155 dark:border-slate-850 space-y-2 relative group hover:border-indigo-300 dark:hover:border-indigo-900 transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{video.clientName}</h4>
                        <p className="text-[10px] text-slate-450 mt-0.5 font-semibold">Shoot Date: {video.shotDate || 'No date set'}</p>
                      </div>
                      <span className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                        <Film className="w-3 h-3" />
                        {video.videoCount} {video.videoCount === 1 ? 'Video' : 'Videos'}
                      </span>
                    </div>
                    {video.notes && (
                      <p className="text-[10px] bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-xl text-slate-500 dark:text-slate-400 leading-relaxed italic border border-slate-100 dark:border-slate-850">
                        {video.notes}
                      </p>
                    )}
                    <div className="pt-1 flex justify-end">
                      <button
                        onClick={() => setActiveTab('videos')}
                        className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-350 flex items-center gap-1"
                      >
                        Update Shoot Status <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. Edits to Complete (Shot Status) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Film className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-755 dark:text-slate-205">My Assigned Edits ({videos.filter(v => v.status === 'Shot' && isMyAssignedVideo(v)).length} tasks)</h3>
              </div>
              <span className="text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/35 text-indigo-755 dark:text-indigo-400 px-2.5 py-0.5 rounded-full uppercase">Editing Needed</span>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {videos.filter(v => v.status === 'Shot' && isMyAssignedVideo(v)).length === 0 ? (
                <div className="text-center py-8 text-slate-400 italic text-xs font-medium bg-slate-50/55 dark:bg-slate-950/20 rounded-2xl border border-dashed border-slate-150 dark:border-slate-850">
                  🎉 No pending video edits assigned to you!
                </div>
              ) : (
                videos.filter(v => v.status === 'Shot' && isMyAssignedVideo(v)).map(video => (
                  <div key={video.id} className="bg-slate-50 dark:bg-slate-955 p-4 rounded-2xl border border-slate-155 dark:border-slate-850 space-y-2 relative group hover:border-indigo-300 dark:hover:border-indigo-900 transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{video.clientName}</h4>
                        <p className="text-[10px] text-slate-450 mt-0.5 font-semibold">Shot Date: {video.shotDate || 'No date set'}</p>
                      </div>
                      <span className="text-[10px] font-black text-indigo-655 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                        <Film className="w-3 h-3" />
                        {video.videoCount} {video.videoCount === 1 ? 'Video' : 'Videos'}
                      </span>
                    </div>
                    {video.notes && (
                      <p className="text-[10px] bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-xl text-slate-500 dark:text-slate-400 leading-relaxed italic border border-slate-100 dark:border-slate-850">
                        {video.notes}
                      </p>
                    )}
                    <div className="pt-1 flex justify-end">
                      <button
                        onClick={() => setActiveTab('videos')}
                        className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-350 flex items-center gap-1"
                      >
                        Complete and Mark Edited <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      ) : (
        /* Circular Progress Gauge & Channel mix graphs for Client and Admin roles */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Circular Progress Gauge */}
          <CustomProgressCircle 
            percentage={totalPlannedThisMonth > 0 ? (postedCount / totalPlannedThisMonth) * 100 : 0}
            title="Campaign Fulfillment Ratio"
            subtitle="Delivered Schedules"
            size={140}
          />

          {/* Platform Content mix metrics bar chart */}
          <div className="lg:col-span-2">
            <CustomBarChart 
              data={platformChartData} 
              title="Channels Content Distribution volume" 
            />
          </div>
        </div>
      )}

      {/* Third level: Posting Agenda, Focus Tasks Checklist, and shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Today's Scheduling Bullet Reminder */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-sidebar-divider pb-3">
              <BellRing className="w-5 h-5 text-purple-650" />
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-755 dark:text-slate-205">Today's Posting Agenda</h3>
            </div>

            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {todayTasks.length === 0 ? (
                <p className="text-xs text-slate-400 italic font-medium py-4 text-center">No social media assets scheduled for publication today.</p>
              ) : (
                todayTasks.map(task => (
                  <div key={task.contentId} className="flex justify-between items-center bg-slate-50 dark:bg-slate-955 p-3 rounded-xl border border-slate-100 dark:border-slate-900 text-xs font-bold font-sans">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[9px] bg-purple-50 dark:bg-purple-950/40 text-purple-650 dark:text-purple-400 px-2 py-0.5 rounded uppercase font-extrabold shrink-0">
                        {task.platform}
                      </span>
                      <span className="truncate text-slate-800 dark:text-slate-150 max-w-xs">{task.topic}</span>
                    </div>
                    <span className="text-slate-400 text-[10px] shrink-0 font-mono pl-1">🕒 {task.time}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Postings scheduled</span>
            <span className="text-xs font-mono font-black text-slate-700 dark:text-slate-350">{todayTasks.length}</span>
          </div>
        </div>

        {/* Today's Focus Tasks / Quick Checklist */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between border-b border-sidebar-divider pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-755 dark:text-slate-205">Today's Focus Tasks</h3>
              </div>
              {focusTasks.some(t => t.completed) && (
                <button 
                  onClick={() => setFocusTasks(prev => prev.filter(t => !t.completed))}
                  className="text-[9px] font-black uppercase text-red-500 hover:text-red-600 tracking-wider transition-colors"
                >
                  Clear Done
                </button>
              )}
            </div>

            {/* Quick Task input form */}
            <form onSubmit={handleAddFocusTask} className="flex gap-1.5">
              <input
                type="text"
                placeholder="Write task for the day..."
                value={newFocusTaskText}
                onChange={(e) => setNewFocusTaskText(e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-xs font-semibold outline-none text-slate-800 dark:text-white placeholder:text-slate-400"
              />
              <button 
                type="submit"
                className="bg-purple-650 hover:bg-purple-700 text-white p-2 rounded-xl transition-all shadow hover:shadow-md flex items-center justify-center shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            {/* Focus tasks list */}
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1 flex-1">
              {focusTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400 space-y-1">
                  <p className="text-xs italic font-medium">Your daily checklist is empty.</p>
                  <p className="text-[10px] uppercase font-bold text-slate-400/80">Type a task above to start</p>
                </div>
              ) : (
                focusTasks.map(task => (
                  <div 
                    key={task.id} 
                    className="flex justify-between items-center bg-slate-50 dark:bg-slate-955 p-2.5 rounded-xl border border-slate-100 dark:border-slate-900 group transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => toggleFocusTask(task.id)}
                        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          task.completed 
                            ? 'bg-emerald-500 border-emerald-500 text-white' 
                            : 'border-slate-300 dark:border-slate-705 hover:border-purple-500 bg-white dark:bg-slate-900'
                        }`}
                      >
                        {task.completed && <CheckCircle2 className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                      </button>
                      <span className={`text-xs font-semibold truncate select-none ${
                        task.completed 
                          ? 'line-through text-slate-400 dark:text-slate-500 font-medium' 
                          : 'text-slate-800 dark:text-slate-150'
                      }`}>
                        {task.text}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteFocusTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded text-slate-400 transition-all ml-1.5 shrink-0"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span>Completed tasks</span>
            <span className="text-xs font-mono font-black text-slate-700 dark:text-slate-350">
              {focusTasks.filter(t => t.completed).length} / {focusTasks.length}
            </span>
          </div>
        </div>

        {/* Fast Action Shortcuts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-755 dark:text-slate-205">Console shortcuts</h3>
            <p className="text-xs font-medium text-slate-400">Instantly switch tabs to execute actions.</p>
          </div>

          <div className="space-y-2 mt-4 font-sans">
            {profile?.role !== 'employee' && (
              <>
                <button 
                  onClick={() => setActiveTab('calendar')}
                  className="w-full text-left py-2.5 px-4 font-bold text-xs uppercase tracking-wider text-purple-600 bg-purple-50/50 hover:bg-purple-100/55 rounded-xl border border-purple-100/20 transition-all flex justify-between items-center"
                >
                  Examine Calendar <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setActiveTab('approvals')}
                  className="w-full text-left py-2.5 px-4 font-bold text-xs uppercase tracking-wider text-cyan-600 bg-cyan-50/50 hover:bg-cyan-100/55 rounded-xl border border-cyan-100/20 transition-all flex justify-between items-center"
                >
                  Verify Review Queue <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button 
              onClick={() => setActiveTab('videos')}
              className="w-full text-left py-2.5 px-4 font-bold text-xs uppercase tracking-wider text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100/60 rounded-xl border border-indigo-100/20 transition-all flex justify-between items-center"
            >
              Video Production Desk <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {(profile?.role === 'superAdmin' || profile?.role === 'admin') && (
              <button 
                onClick={() => setActiveTab('attendance')}
                className="w-full text-left py-2.5 px-4 font-bold text-xs uppercase tracking-wider text-emerald-650 bg-emerald-50/50 hover:bg-emerald-100/60 rounded-xl border border-emerald-100/20 transition-all flex justify-between items-center"
              >
                Staff Attendance <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {profile?.role === 'employee' && (
              <button 
                onClick={() => setActiveTab('attendance')}
                className="w-full text-left py-2.5 px-4 font-bold text-xs uppercase tracking-wider text-cyan-600 bg-cyan-50/50 hover:bg-cyan-100/60 rounded-xl border border-cyan-100/20 transition-all flex justify-between items-center"
              >
                My Attendance Desk <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {profile?.role === 'superAdmin' && (
              <button 
                onClick={() => setActiveTab('clients')}
                className="w-full text-left py-2.5 px-4 font-bold text-xs uppercase tracking-wider text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-all flex justify-between items-center"
              >
                Onboard Client <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


