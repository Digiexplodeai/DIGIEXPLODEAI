import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { syncTaskCompletionToWorkLog, syncTaskReopenedState } from '../../lib/taskWorkLogSync';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  User, 
  Mail, 
  ShieldAlert, 
  Sparkles, 
  Phone, 
  Briefcase, 
  Calendar, 
  CheckCircle2, 
  ListTodo, 
  Kanban, 
  Clock, 
  Settings, 
  Send, 
  FileText, 
  Check, 
  AlertCircle, 
  ExternalLink, 
  Folder, 
  UserPlus, 
  ChevronRight, 
  ChevronDown, 
  CalendarDays, 
  Layers, 
  MessageSquare, 
  BookOpen, 
  ArrowLeft, 
  CheckSquare, 
  Square, 
  List, 
  Grid, 
  X,
  MoreVertical,
  Flag,
  TrendingUp,
  Eye,
  Download,
  AlertTriangle,
  UserCheck,
  RotateCcw,
  SlidersHorizontal,
  Video,
  ArrowUpDown,
  Building2,
  PieChart
} from 'lucide-react';

// Interfaces based on blueprint and ClickUp system
export interface ClientData {
  clientId: string;
  clientName: string;
  businessName: string;
  category: string;
  contactPerson: string;
  phone: string;
  email: string;
  package: 'Starter' | 'Growth' | 'Premium';
  startDate: string;
  status: 'Active' | 'Paused' | 'Completed';
  assignedAdminId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskData {
  taskId: string;
  clientId: string;
  title: string;
  description: string;
  status: 'To Do' | 'In Progress' | 'In Review' | 'Done';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  assigneeId: string;
  assigneeName: string;
  uploaderId?: string;
  uploaderName?: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  project?: string;
}

export interface DocData {
  docId: string; // matches `${clientId}_guidelines`
  clientId: string;
  brandVoice: string;
  hexColors: string[];
  driveLinks: string;
  generalGuidelines: string;
  updatedAt: string;
}

export interface ChatMsg {
  msgId: string;
  clientId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  createdAt: string;
}

interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: string;
}

import { ensureCentralClientsSeeded, DEFAULT_CLIENTS_MASTER } from '../../lib/clientMaster';

const DEFAULT_AGENCY_TEAM: TeamMember[] = [
  { userId: 'team-1', name: 'Vansh', email: 'admin@digiexplode.com', role: 'superAdmin' },
  { userId: 'team-2', name: 'Aman Sharma', email: 'aman@digiexplode.com', role: 'admin' },
  { userId: 'team-3', name: 'Neha Gupta', email: 'neha@digiexplode.com', role: 'employee' },
  { userId: 'team-4', name: 'Rahul Verma', email: 'rahul@digiexplode.com', role: 'employee' },
  { userId: 'team-5', name: 'Priya Singh', email: 'priya@digiexplode.com', role: 'employee' },
  { userId: 'team-6', name: 'Rohit Kumar', email: 'rohit@digiexplode.com', role: 'employee' },
];

export const ClientList: React.FC = () => {
  const { profile, user } = useAuth();
  
  // Real-time states
  const [clients, setClients] = useState<ClientData[]>(DEFAULT_CLIENTS_MASTER);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(DEFAULT_AGENCY_TEAM);
  const [allTasks, setAllTasks] = useState<TaskData[]>([]);
  const [allApprovals, setAllApprovals] = useState<any[]>([]);
  const [allVideos, setAllVideos] = useState<any[]>([]);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [brandDoc, setBrandDoc] = useState<DocData | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Navigation / Selection State
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'list' | 'board' | 'timeline' | 'docs' | 'chat' | 'settings' | 'workdone'>('board');
  
  // Command Center Operations Filters & States
  const [searchTerm, setSearchTerm] = useState('');
  const [quickFilter, setQuickFilter] = useState<'All' | 'Active' | 'Needs Attention' | 'Unassigned' | 'Pending Approval' | 'On Hold' | 'Completed'>('All');
  const [filterManager, setFilterManager] = useState<string>('All');
  const [filterIndustry, setFilterIndustry] = useState<string>('All');
  const [filterPackage, setFilterPackage] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'updated' | 'name-asc' | 'newest' | 'oldest' | 'pending' | 'due'>('updated');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'cards'>(() => {
    return (localStorage.getItem('digi_client_view_mode') as 'list' | 'cards') || 'list';
  });

  // Bulk Operations State
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  
  // Side Drawer Quick-Preview State
  const [previewClient, setPreviewClient] = useState<ClientData | null>(null);

  // Quick Action Popover States
  const [quickAssignClientId, setQuickAssignClientId] = useState<string | null>(null);
  const [activeMenuClientId, setActiveMenuClientId] = useState<string | null>(null);
  
  // Modal / Form States
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const [clientFormStep, setClientFormStep] = useState<1 | 2 | 3>(1);
  
  // Client Form inputs
  const [clientName, setClientName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('Healthcare');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<'Starter' | 'Growth' | 'Premium'>('Growth');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'Active' | 'Paused' | 'Completed'>('Active');
  const [assignedAdminId, setAssignedAdminId] = useState('');
  const [notes, setNotes] = useState('');

  // Task Form inputs & Modal
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskData | null>(null);
  const [taskClientId, setTaskClientId] = useState<string>('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskStatus, setTaskStatus] = useState<'To Do' | 'In Progress' | 'In Review' | 'Done'>('To Do');
  const [taskPriority, setTaskPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().split('T')[0]);

  // Chat message Input
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Brand Doc inputs
  const [brandVoice, setBrandVoice] = useState('');
  const [hexInput, setHexInput] = useState('');
  const [driveLinks, setDriveLinks] = useState('');
  const [generalGuidelines, setGeneralGuidelines] = useState('');
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  // Accordion State for List View
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'To Do': true,
    'In Progress': true,
    'In Review': true,
    'Done': true,
  });

  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({
    'Project 1': true,
    'Project 2': true,
  });

  const [taskProject, setTaskProject] = useState('Project 1');

  // Quick Add Task States
  const [activeQuickAddPath, setActiveQuickAddPath] = useState<string | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');

  // Calendar Year/Month for Timeline View
  const [calDate, setCalDate] = useState(new Date());

  // Check if client role is locked
  const isClientRole = profile?.role === 'client';
  const effectiveClientId = isClientRole ? profile?.clientId : selectedClientId;
  const todayDateStr = new Date().toISOString().split('T')[0];

  // Save viewMode to localStorage
  const handleToggleViewMode = (mode: 'list' | 'cards') => {
    setViewMode(mode);
    localStorage.setItem('digi_client_view_mode', mode);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.client-menu-container')) {
        setActiveMenuClientId(null);
      }
      if (!target.closest('.quick-assign-container')) {
        setQuickAssignClientId(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  // 1. Initial Listeners for Clients, Team Members, Global Tasks & Approvals
  useEffect(() => {
    if (!profile) return;
    ensureCentralClientsSeeded().catch(e => console.warn("Seed non-fatal:", e));
    
    // A. Listen to clients
    const clientsRef = collection(db, 'clients');
    const unsubscribeClients = onSnapshot(clientsRef, (snapshot) => {
      const clientList: ClientData[] = [];
      snapshot.forEach((doc) => {
        clientList.push({ clientId: doc.id, ...doc.data() } as ClientData);
      });
      if (clientList.length > 0) {
        setClients(clientList);
      } else {
        setClients(DEFAULT_CLIENTS_MASTER);
      }
      setLoading(false);
    }, (error) => {
      console.warn("Clients list listener notice:", error);
      setClients(DEFAULT_CLIENTS_MASTER);
      setLoading(false);
    });

    // B. Listen to agency team members (admins, superAdmins, employees)
    const usersRef = collection(db, 'users');
    const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
      const teamList: TeamMember[] = [];
      snapshot.forEach((doc) => {
        const u = doc.data();
        if (u.role === 'admin' || u.role === 'superAdmin' || u.role === 'employee') {
          teamList.push({ userId: doc.id, ...u } as TeamMember);
        }
      });
      if (teamList.length > 0) {
        setTeamMembers(teamList);
      } else {
        setTeamMembers(DEFAULT_AGENCY_TEAM);
      }
    }, (error) => {
      console.warn("Team members list listener notice:", error);
      setTeamMembers(DEFAULT_AGENCY_TEAM);
    });

    // C. Listen to all tasks across agency for live dashboard metrics
    const tasksRef = collection(db, 'tasks');
    const unsubscribeAllTasks = onSnapshot(tasksRef, (snapshot) => {
      const list: TaskData[] = [];
      snapshot.forEach((doc) => {
        list.push({ taskId: doc.id, id: doc.id, ...doc.data() } as unknown as TaskData);
      });
      setAllTasks(list);
    }, () => {});

    // D. Listen to all contentCalendar entries for approval tracking
    const calRef = collection(db, 'contentCalendar');
    const unsubscribeAllCal = onSnapshot(calRef, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ contentId: doc.id, ...doc.data() });
      });
      setAllApprovals(list);
    }, () => {});

    // E. Listen to videoTracker for video production count
    const vidRef = collection(db, 'videoTracker');
    const unsubscribeAllVid = onSnapshot(vidRef, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ videoId: doc.id, ...doc.data() });
      });
      setAllVideos(list);
    }, () => {});

    return () => {
      unsubscribeClients();
      unsubscribeUsers();
      unsubscribeAllTasks();
      unsubscribeAllCal();
      unsubscribeAllVid();
    };
  }, [profile]);

  // 2. Secondary Listeners when a Client Workspace is active
  useEffect(() => {
    if (!effectiveClientId) {
      setTasks([]);
      setBrandDoc(null);
      setChatMessages([]);
      return;
    }

    // A. Listen to client tasks
    const tasksRef = collection(db, 'tasks');
    const tasksQuery = query(tasksRef, where('clientId', '==', effectiveClientId));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const taskList: TaskData[] = [];
      snapshot.forEach((doc) => {
        taskList.push({ taskId: doc.id, id: doc.id, ...doc.data() } as unknown as TaskData);
      });
      setTasks(taskList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `tasks/${effectiveClientId}`);
    });

    // B. Listen to Brand Docs wiki
    const docRef = doc(db, 'clientDocs', `${effectiveClientId}_guidelines`);
    const unsubscribeDoc = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as DocData;
        setBrandDoc(data);
        setBrandVoice(data.brandVoice || '');
        setDriveLinks(data.driveLinks || '');
        setGeneralGuidelines(data.generalGuidelines || '');
      } else {
        setBrandDoc(null);
        setBrandVoice('');
        setDriveLinks('');
        setGeneralGuidelines('');
      }
    });

    // C. Listen to Workspace chat/feed
    const chatRef = collection(db, 'clientChat');
    const chatQuery = query(chatRef, where('clientId', '==', effectiveClientId));
    const unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
      const msgs: ChatMsg[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ msgId: doc.id, ...doc.data() } as ChatMsg);
      });
      msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setChatMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `clientChat/${effectiveClientId}`);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeDoc();
      unsubscribeChat();
    };
  }, [effectiveClientId]);

  // Scroll Chat to bottom on message updates
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, workspaceTab]);

  // Handle opening active client workspace
  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setWorkspaceTab('board');
  };

  // Quick 1-Click Assign Manager
  const handleQuickAssignManager = async (clientId: string, adminId: string) => {
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        assignedAdminId: adminId || null,
        updatedAt: new Date().toISOString()
      });
      setQuickAssignClientId(null);
    } catch (error) {
      console.warn("Local update fallback for assign manager:", error);
      setClients(prev => prev.map(c => c.clientId === clientId ? { ...c, assignedAdminId: adminId || undefined } : c));
      setQuickAssignClientId(null);
    }
  };

  // Quick 1-Click Status Toggle
  const handleQuickStatusToggle = async (clientId: string, newStatus: 'Active' | 'Paused' | 'Completed') => {
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Local update fallback for status toggle:", error);
      setClients(prev => prev.map(c => c.clientId === clientId ? { ...c, status: newStatus } : c));
    }
  };

  // Bulk Operations
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedClientIds(new Set(filteredClients.map(c => c.clientId)));
    } else {
      setSelectedClientIds(new Set());
    }
  };

  const handleToggleSelectClient = (clientId: string) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const handleBulkAssignManager = async (adminId: string) => {
    if (selectedClientIds.size === 0) return;
    try {
      const ids = Array.from(selectedClientIds) as string[];
      for (const cid of ids) {
        await updateDoc(doc(db, 'clients', cid), {
          assignedAdminId: adminId || null,
          updatedAt: new Date().toISOString()
        });
      }
      setSelectedClientIds(new Set());
      alert(`Account Manager updated for ${ids.length} clients.`);
    } catch (e) {
      console.warn("Bulk manager update fallback:", e);
    }
  };

  const handleBulkChangeStatus = async (newStatus: 'Active' | 'Paused' | 'Completed') => {
    if (selectedClientIds.size === 0) return;
    try {
      const ids = Array.from(selectedClientIds) as string[];
      for (const cid of ids) {
        await updateDoc(doc(db, 'clients', cid), {
          status: newStatus,
          updatedAt: new Date().toISOString()
        });
      }
      setSelectedClientIds(new Set());
      alert(`Status changed to ${newStatus} for ${ids.length} clients.`);
    } catch (e) {
      console.warn("Bulk status update fallback:", e);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const listToExport = selectedClientIds.size > 0 
      ? clients.filter(c => selectedClientIds.has(c.clientId))
      : filteredClients;

    const headers = ["Client Name", "Brand / Business", "Industry", "Contact Person", "Email", "Phone", "Package", "Status", "Account Manager", "Start Date"];
    const rows = listToExport.map(c => {
      const mgr = teamMembers.find(t => t.userId === c.assignedAdminId);
      return [
        `"${c.clientName || ''}"`,
        `"${c.businessName || ''}"`,
        `"${c.category || ''}"`,
        `"${c.contactPerson || ''}"`,
        `"${c.email || ''}"`,
        `"${c.phone || ''}"`,
        `"${c.package || ''}"`,
        `"${c.status || ''}"`,
        `"${mgr ? mgr.name : 'Unassigned'}"`,
        `"${c.startDate || ''}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `digiexplode_clients_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Client CRUD
  const handleOpenAddClient = () => {
    setEditingClient(null);
    setClientFormStep(1);
    setClientName('');
    setBusinessName('');
    setCategory('Healthcare');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setSelectedPackage('Growth');
    setStartDate(new Date().toISOString().split('T')[0]);
    setStatus('Active');
    setAssignedAdminId('');
    setNotes('');
    setIsClientModalOpen(true);
  };

  const handleOpenEditClient = (client: ClientData) => {
    setEditingClient(client);
    setClientFormStep(1);
    setClientName(client.clientName);
    setBusinessName(client.businessName);
    setCategory(client.category || 'General');
    setContactPerson(client.contactPerson || '');
    setPhone(client.phone || '');
    setEmail(client.email || '');
    setSelectedPackage(client.package || 'Growth');
    setStartDate(client.startDate || todayDateStr);
    setStatus(client.status || 'Active');
    setAssignedAdminId(client.assignedAdminId || '');
    setNotes(client.notes || '');
    setIsClientModalOpen(true);
  };

  const handleDeleteClient = async (id: string) => {
    if (confirm("Are you sure you want to remove this client account? This will permanently delete the client record.")) {
      try {
        await deleteDoc(doc(db, 'clients', id));
        if (selectedClientId === id) {
          setSelectedClientId(null);
        }
        if (previewClient?.clientId === id) {
          setPreviewClient(null);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `clients/${id}`);
      }
    }
  };

  const handleSubmitClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !businessName.trim() || !email.trim()) {
      alert("Please check required fields (Client Name, Business Name, Email)!");
      return;
    }

    const targetId = editingClient ? editingClient.clientId : "client_" + Math.random().toString(36).substr(2, 9);
    
    const payload: ClientData = {
      clientId: targetId,
      clientName: clientName.trim(),
      businessName: businessName.trim(),
      category: category.trim() || 'General',
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.trim(),
      package: selectedPackage,
      startDate,
      status,
      assignedAdminId: assignedAdminId || undefined,
      notes: notes.trim(),
      createdAt: editingClient ? editingClient.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'clients', targetId), payload);

      // Auto-bridge client users matching email
      const usersRef = collection(db, 'users');
      const qUsers = query(usersRef, where('email', '==', email.trim().toLowerCase()));
      const userSnap = await getDocs(qUsers);
      if (!userSnap.empty) {
        userSnap.forEach(async (docSnap) => {
          await updateDoc(doc(db, 'users', docSnap.id), {
            clientId: targetId,
            role: 'client'
          });
        });
      }

      setIsClientModalOpen(false);
    } catch (error) {
      console.warn("Client save local fallback:", error);
      setClients(prev => {
        const idx = prev.findIndex(c => c.clientId === targetId);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = payload;
          return cp;
        }
        return [payload, ...prev];
      });
      setIsClientModalOpen(false);
    }
  };

  // Quick Open Task Modal for a specific Client
  const handleOpenQuickTaskModal = (clientId: string) => {
    setTaskClientId(clientId);
    setEditingTask(null);
    setTaskTitle('');
    setTaskDesc('');
    setTaskStatus('To Do');
    setTaskPriority('Medium');
    setTaskAssigneeId('');
    setTaskDueDate(new Date().toISOString().split('T')[0]);
    setIsTaskModalOpen(true);
  };

  // Task CRUD (ClickUp tasks)
  const handleOpenAddTask = (defaultStatus?: 'To Do' | 'In Progress' | 'In Review' | 'Done', defaultProject?: string) => {
    setTaskClientId(effectiveClientId || '');
    setEditingTask(null);
    setTaskTitle('');
    setTaskDesc('');
    setTaskStatus(defaultStatus || 'To Do');
    setTaskPriority('Medium');
    setTaskAssigneeId('');
    setTaskDueDate(new Date().toISOString().split('T')[0]);
    setTaskProject(defaultProject || 'Project 1');
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTask = (task: TaskData) => {
    setTaskClientId(task.clientId);
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDesc(task.description);
    setTaskStatus(task.status);
    setTaskPriority(task.priority);
    setTaskAssigneeId(task.assigneeId);
    setTaskDueDate(task.dueDate);
    setTaskProject(task.project || 'Project 1');
    setIsTaskModalOpen(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
    }
  };

  const handleQuickStatusChange = async (task: TaskData, newStatus: 'To Do' | 'In Progress' | 'In Review' | 'Done') => {
    try {
      const prevStatus = task.status;
      const targetId = task.taskId || (task as any).id;
      await updateDoc(doc(db, 'tasks', targetId), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        ...(newStatus === 'Done' ? { completedAt: new Date().toISOString() } : {})
      });

      // Automatic Work Log Synchronization
      const client = clients.find(c => c.clientId === task.clientId);
      if (newStatus === 'Done') {
        await syncTaskCompletionToWorkLog(
          {
            taskId: targetId,
            title: task.title,
            description: task.description,
            clientId: task.clientId,
            clientName: client?.clientName || client?.businessName || '',
            assigneeId: task.assigneeId,
            assigneeName: task.assigneeName,
            category: (task as any).category || 'Other',
            quantity: 1,
            source: 'task_completion',
          },
          profile,
          user?.uid
        );
      } else if ((prevStatus as string) === 'Done' && (newStatus as string) !== 'Done') {
        await syncTaskReopenedState(targetId);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tasks/${task.taskId || (task as any).id}`);
    }
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      alert("Task title is required!");
      return;
    }
    const targetClientId = taskClientId || effectiveClientId;
    if (!targetClientId) return;

    const taskId = editingTask ? (editingTask.taskId || (editingTask as any).id) : "task_" + Math.random().toString(36).substr(2, 9);
    const assignedUser = teamMembers.find(t => t.userId === taskAssigneeId);
    const targetClient = clients.find(c => c.clientId === targetClientId);

    const payload: TaskData = {
      taskId,
      clientId: targetClientId,
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      status: taskStatus,
      priority: taskPriority,
      assigneeId: taskAssigneeId,
      assigneeName: assignedUser ? assignedUser.name : 'Unassigned',
      dueDate: taskDueDate,
      createdAt: editingTask ? editingTask.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      project: taskProject || 'Project 1'
    };

    try {
      await setDoc(doc(db, 'tasks', taskId), {
        ...payload,
        id: taskId,
        clientName: targetClient?.clientName || targetClient?.businessName || 'Client'
      });
      setIsTaskModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tasks/${taskId}`);
      setIsTaskModalOpen(false);
    }
  };

  // Quick inline task creation in ClickUp list view
  const handleQuickAddTaskSubmit = async (project: string, statusType: 'To Do' | 'In Progress' | 'In Review' | 'Done') => {
    if (!quickTaskTitle.trim() || !effectiveClientId) return;
    const taskId = "task_" + Math.random().toString(36).substr(2, 9);
    const targetClient = clients.find(c => c.clientId === effectiveClientId);
    const payload: TaskData = {
      taskId,
      clientId: effectiveClientId,
      title: quickTaskTitle.trim(),
      description: '',
      status: statusType,
      priority: 'Medium',
      assigneeId: profile?.userId || '',
      assigneeName: profile?.name || 'Unassigned',
      dueDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      project: project || 'Project 1'
    };
    try {
      await setDoc(doc(db, 'tasks', taskId), {
        ...payload,
        id: taskId,
        clientName: targetClient?.clientName || targetClient?.businessName || 'Client'
      });
      setQuickTaskTitle('');
      setActiveQuickAddPath(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tasks/${taskId}`);
    }
  };

  // Guidelines / Brand doc handler
  const handleSaveGuidelines = async () => {
    if (!effectiveClientId) return;
    setIsSavingDoc(true);
    const docId = `${effectiveClientId}_guidelines`;
    const payload: DocData = {
      docId,
      clientId: effectiveClientId,
      brandVoice: brandVoice.trim(),
      hexColors: brandDoc?.hexColors || [],
      driveLinks: driveLinks.trim(),
      generalGuidelines: generalGuidelines.trim(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'clientDocs', docId), payload);
      setIsSavingDoc(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `clientDocs/${docId}`);
      setIsSavingDoc(false);
    }
  };

  const handleAddHexColor = async () => {
    if (!hexInput.trim() || !effectiveClientId) return;
    let formattedHex = hexInput.trim();
    if (!formattedHex.startsWith('#')) formattedHex = '#' + formattedHex;
    const currentColors = brandDoc?.hexColors || [];
    if (currentColors.includes(formattedHex)) {
      setHexInput('');
      return;
    }
    const updatedColors = [...currentColors, formattedHex];
    const docId = `${effectiveClientId}_guidelines`;
    try {
      await setDoc(doc(db, 'clientDocs', docId), {
        clientId: effectiveClientId,
        hexColors: updatedColors,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setHexInput('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `clientDocs/${docId}`);
    }
  };

  const handleRemoveHexColor = async (colorToRemove: string) => {
    if (!effectiveClientId) return;
    const currentColors = brandDoc?.hexColors || [];
    const updatedColors = currentColors.filter(c => c !== colorToRemove);
    const docId = `${effectiveClientId}_guidelines`;
    try {
      await setDoc(doc(db, 'clientDocs', docId), {
        clientId: effectiveClientId,
        hexColors: updatedColors,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `clientDocs/${docId}`);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !effectiveClientId) return;
    const msgId = "msg_" + Math.random().toString(36).substr(2, 9);
    const payload: ChatMsg = {
      msgId,
      clientId: effectiveClientId,
      senderId: profile?.userId || 'unknown',
      senderName: profile?.name || 'Team Member',
      senderRole: profile?.role || 'employee',
      message: newMessage.trim(),
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'clientChat', msgId), payload);
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `clientChat/${msgId}`);
    }
  };

  // ─── DERIVED REAL OPERATIONAL CLIENT DATA ────────────────────────────
  const enhancedClients = useMemo(() => {
    return clients.map(c => {
      const clientTasksList = allTasks.filter(t => t.clientId === c.clientId);
      const pendingTasks = clientTasksList.filter(t => t.status !== 'Done');
      const overdueTasks = pendingTasks.filter(t => t.dueDate && t.dueDate < todayDateStr);
      const clientApprovals = allApprovals.filter(a => a.clientId === c.clientId && (a.clientApprovalStatus === 'Pending' || a.stage === 'Client Review'));
      const clientVideos = allVideos.filter(v => v.clientId === c.clientId && (v.status === 'In Editing' || v.status === 'Recorded'));
      const manager = teamMembers.find(t => t.userId === c.assignedAdminId);
      const isUnassigned = !c.assignedAdminId || c.assignedAdminId === '';

      // Health Status (work delivery health strictly derived from real operational status)
      let workHealth: 'On Track' | 'Needs Attention' | 'Waiting on Client' | 'At Risk' | 'Paused' = 'On Track';
      let healthReason = 'All deliverables on track';

      if (c.status === 'Paused') {
        workHealth = 'Paused';
        healthReason = 'Client contract on hold / paused';
      } else if (overdueTasks.length > 1) {
        workHealth = 'At Risk';
        healthReason = `${overdueTasks.length} overdue deliverables`;
      } else if (overdueTasks.length === 1) {
        workHealth = 'Needs Attention';
        healthReason = `1 overdue task: ${overdueTasks[0].title}`;
      } else if (clientApprovals.length > 0) {
        workHealth = 'Waiting on Client';
        healthReason = `${clientApprovals.length} approval${clientApprovals.length > 1 ? 's' : ''} waiting on client`;
      }

      // Next Action calculation in priority order:
      // Overdue -> Approval waiting -> Nearest upcoming task -> Waiting on client -> All caught up
      let nextActionText = 'All caught up';
      if (overdueTasks.length > 0) {
        nextActionText = `Overdue: ${overdueTasks[0].title} · ${overdueTasks[0].dueDate ? overdueTasks[0].dueDate.slice(5) : 'Past due'}`;
      } else if (clientApprovals.length > 0) {
        const firstAppr = clientApprovals[0];
        nextActionText = `Approve ${firstAppr.title || firstAppr.contentType || 'deliverable'} · Waiting`;
      } else if (pendingTasks.length > 0) {
        const sorted = [...pendingTasks].filter(t => t.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        if (sorted.length > 0) {
          const t = sorted[0];
          const isToday = t.dueDate === todayDateStr;
          nextActionText = `${t.title} · ${isToday ? 'Today' : t.dueDate.slice(5)}`;
        } else {
          nextActionText = `${pendingTasks[0].title}`;
        }
      } else if (c.status === 'Paused') {
        nextActionText = 'Account On Hold';
      }

      return {
        ...c,
        manager,
        isUnassigned,
        pendingTasksCount: pendingTasks.length,
        overdueTasksCount: overdueTasks.length,
        pendingApprovalsCount: clientApprovals.length,
        activeVideosCount: clientVideos.length,
        totalTasksCount: clientTasksList.length,
        workHealth,
        healthReason,
        nextActionText
      };
    });
  }, [clients, allTasks, allApprovals, allVideos, teamMembers, todayDateStr]);

  // ─── AGENCY CLIENT SUMMARY METRICS ──────────────────────────────────
  const summaryMetrics = useMemo(() => {
    const total = enhancedClients.length;
    const active = enhancedClients.filter(c => c.status === 'Active').length;
    const needsAttention = enhancedClients.filter(c => c.workHealth === 'Needs Attention' || c.workHealth === 'At Risk' || c.overdueTasksCount > 0).length;
    const onHold = enhancedClients.filter(c => c.status === 'Paused').length;
    const completed = enhancedClients.filter(c => c.status === 'Completed').length;
    const unassigned = enhancedClients.filter(c => c.isUnassigned).length;

    // Real attention items for alert banner
    const totalOverdueTasks = enhancedClients.reduce((sum, c) => sum + c.overdueTasksCount, 0);
    const clientsWithOverdue = enhancedClients.filter(c => c.overdueTasksCount > 0).length;
    const clientsWithApprovals = enhancedClients.filter(c => c.pendingApprovalsCount > 0).length;
    const totalPendingApprovals = enhancedClients.reduce((sum, c) => sum + c.pendingApprovalsCount, 0);

    return {
      total,
      active,
      needsAttention,
      onHold,
      completed,
      unassigned,
      clientsWithOverdue,
      totalOverdueTasks,
      clientsWithApprovals,
      totalPendingApprovals
    };
  }, [enhancedClients]);

  // ─── FILTERED AND SORTED CLIENTS ────────────────────────────────────
  const filteredClients = useMemo(() => {
    return enhancedClients.filter(c => {
      // 1. Role / assigned admin lock
      if (profile?.role === 'admin') {
        const assignedIds = profile?.assignedClientIds || [];
        if (assignedIds.length > 0 && !assignedIds.includes(c.clientId)) return false;
      }

      // 2. Search matches (Name, Business, Contact, Email, Manager, Category)
      const q = searchTerm.toLowerCase().trim();
      if (q) {
        const mgrName = c.manager?.name.toLowerCase() || '';
        const matchesSearch = 
          c.clientName.toLowerCase().includes(q) ||
          c.businessName.toLowerCase().includes(q) ||
          (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.category && c.category.toLowerCase().includes(q)) ||
          mgrName.includes(q);

        if (!matchesSearch) return false;
      }

      // 3. Quick Filter Tabs
      if (quickFilter === 'Active' && c.status !== 'Active') return false;
      if (quickFilter === 'Needs Attention' && c.workHealth !== 'Needs Attention' && c.workHealth !== 'At Risk' && c.overdueTasksCount === 0) return false;
      if (quickFilter === 'Unassigned' && !c.isUnassigned) return false;
      if (quickFilter === 'Pending Approval' && c.pendingApprovalsCount === 0) return false;
      if (quickFilter === 'On Hold' && c.status !== 'Paused') return false;
      if (quickFilter === 'Completed' && c.status !== 'Completed') return false;

      // 4. Advanced Filter Dropdowns
      if (filterManager !== 'All') {
        if (filterManager === 'unassigned') {
          if (!c.isUnassigned) return false;
        } else if (c.assignedAdminId !== filterManager) {
          return false;
        }
      }

      if (filterIndustry !== 'All' && c.category !== filterIndustry) return false;
      if (filterPackage !== 'All' && c.package !== filterPackage) return false;
      if (filterStatus !== 'All' && c.status !== filterStatus) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'name-asc') return a.clientName.localeCompare(b.clientName);
      if (sortBy === 'newest') return (b.startDate || '').localeCompare(a.startDate || '');
      if (sortBy === 'oldest') return (a.startDate || '').localeCompare(b.startDate || '');
      if (sortBy === 'pending') return b.pendingTasksCount - a.pendingTasksCount;
      if (sortBy === 'due') {
        const aDue = a.nextActionText.includes('·') ? a.nextActionText : '9999-99-99';
        const bDue = b.nextActionText.includes('·') ? b.nextActionText : '9999-99-99';
        return aDue.localeCompare(bDue);
      }
      return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
    });
  }, [enhancedClients, profile, searchTerm, quickFilter, filterManager, filterIndustry, filterPackage, filterStatus, sortBy]);

  // Industry Categories available in active client list
  const availableIndustries = useMemo(() => {
    return Array.from(new Set(clients.map(c => c.category).filter(Boolean)));
  }, [clients]);

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (quickFilter !== 'All') count++;
    if (filterManager !== 'All') count++;
    if (filterIndustry !== 'All') count++;
    if (filterPackage !== 'All') count++;
    if (filterStatus !== 'All') count++;
    if (searchTerm.trim()) count++;
    return count;
  }, [quickFilter, filterManager, filterIndustry, filterPackage, filterStatus, searchTerm]);

  const handleClearAllFilters = () => {
    setQuickFilter('All');
    setFilterManager('All');
    setFilterIndustry('All');
    setFilterPackage('All');
    setFilterStatus('All');
    setSearchTerm('');
  };

  // Helper avatar initials & colors
  const getClientAvatarBg = (name: string) => {
    const char = name.charCodeAt(0) || 0;
    const colors = [
      'from-blue-600 to-indigo-600 text-white',
      'from-emerald-600 to-teal-600 text-white',
      'from-purple-600 to-violet-600 text-white',
      'from-amber-500 to-orange-600 text-white',
      'from-rose-600 to-pink-600 text-white',
      'from-cyan-600 to-blue-600 text-white',
    ];
    return colors[char % colors.length];
  };

  // Calculate stats for current active workspace client
  const activeClientObj = clients.find(c => c.clientId === effectiveClientId);
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter(t => t.status === 'Done').length;
  const progressPercent = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Render client unauthenticated / pending assignment view
  if (isClientRole && !effectiveClientId) {
    return (
      <div className="bg-white dark:bg-[#0E1428] border border-slate-200 dark:border-white/10 rounded-2xl p-12 text-center text-slate-500 max-w-xl mx-auto my-12 space-y-6 shadow-sm">
        <ShieldAlert className="w-16 h-16 text-blue-500 mx-auto animate-pulse" />
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Workspace Assignment Pending</h2>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
          Your client profile is authenticated, but it has not been linked to a specific brand space yet. 
          Please contact your Digiexplode account manager or support team at <span className="text-blue-600 font-extrabold">admin@digiexplode.com</span> to link your account.
        </p>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // CLIENT COMMAND CENTER (DEFAULT OPERATIONS VIEW)
  // ═════════════════════════════════════════════════════════════════════
  if (!effectiveClientId) {
    return (
      <div className="space-y-3.5 pb-24 text-slate-900 dark:text-slate-100 font-sans">
        
        {/* ─── 1. COMPACT OPERATIONAL PAGE HEADER ────────────────────── */}
        <div className="bg-[#0E1428] border border-white/10 rounded-xl px-4 py-3 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-lg font-black text-white tracking-tight">
                  Client Operations Command Center
                </h1>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-400/30 text-blue-300">
                  {enhancedClients.length} Accounts
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Manage accounts, workspaces, deliverables, approvals and client activity.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-white/10 transition-all flex items-center gap-1.5"
              title="Export client list as CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export CSV</span>
            </button>

            {(profile?.role === 'superAdmin' || profile?.role === 'admin') && (
              <button 
                onClick={handleOpenAddClient}
                className="px-3.5 py-1.5 bg-[#2563FF] hover:bg-[#1d4ed8] text-white text-xs font-black rounded-lg shadow-md transition-all flex items-center gap-1.5 uppercase tracking-wider"
              >
                <Plus className="w-3.5 h-3.5" /> Create Client
              </button>
            )}
          </div>
        </div>

        {/* ─── 2. COMPACT INTERACTIVE KPI STRIP ──────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { id: 'All', label: "Total Clients", count: summaryMetrics.total, accentBorder: "border-l-4 border-l-[#3D5AFE]", color: "text-[#3D5AFE]" },
            { id: 'Active', label: "Active", count: summaryMetrics.active, accentBorder: "border-l-4 border-l-[#16A34A]", color: "text-[#16A34A]" },
            { id: 'Needs Attention', label: "Needs Attention", count: summaryMetrics.needsAttention, accentBorder: "border-l-4 border-l-[#F59E0B]", color: "text-[#F59E0B]" },
            { id: 'On Hold', label: "On Hold", count: summaryMetrics.onHold, accentBorder: "border-l-4 border-l-[#F97316]", color: "text-[#F97316]" },
            { id: 'Completed', label: "Completed", count: summaryMetrics.completed, accentBorder: "border-l-4 border-l-[#7C3AED]", color: "text-[#7C3AED]" },
            { id: 'Unassigned', label: "Unassigned", count: summaryMetrics.unassigned, accentBorder: "border-l-4 border-l-[#DC2626]", color: "text-[#DC2626]" },
          ].map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={() => setQuickFilter(card.id as any)}
              className={`h-[72px] px-3.5 py-2.5 rounded-xl border bg-white dark:bg-[#111728] border-slate-200 dark:border-white/10 text-left flex flex-col justify-between transition-all hover:shadow-md ${card.accentBorder} ${
                quickFilter === card.id ? 'ring-2 ring-blue-500 border-blue-500' : ''
              }`}
            >
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {card.label}
              </span>
              <div className="flex items-baseline justify-between">
                <span className={`text-2xl font-black ${card.color}`}>
                  {card.count}
                </span>
                <span className="text-[9px] font-bold uppercase text-slate-400">
                  {card.id === 'All' ? 'Total' : 'Filter'}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* ─── 3. ACTIONABLE ALERTS ROW (ONLY SHOWN WHEN ITEMS EXIST) ── */}
        {(summaryMetrics.clientsWithOverdue > 0 || summaryMetrics.clientsWithApprovals > 0 || summaryMetrics.unassigned > 0) && (
          <div className="bg-slate-100 dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Operational Attention:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {summaryMetrics.totalOverdueTasks > 0 && (
                <button
                  onClick={() => setQuickFilter('Needs Attention')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 hover:bg-rose-100 transition-all flex items-center gap-1"
                >
                  <AlertCircle className="w-3 h-3" />
                  {summaryMetrics.totalOverdueTasks} overdue task{summaryMetrics.totalOverdueTasks > 1 ? 's' : ''}
                </button>
              )}

              {summaryMetrics.totalPendingApprovals > 0 && (
                <button
                  onClick={() => setQuickFilter('Pending Approval')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 hover:bg-blue-100 transition-all flex items-center gap-1"
                >
                  <Clock className="w-3 h-3" />
                  {summaryMetrics.totalPendingApprovals} approval{summaryMetrics.totalPendingApprovals > 1 ? 's' : ''} waiting
                </button>
              )}

              {summaryMetrics.unassigned > 0 && (
                <button
                  onClick={() => setQuickFilter('Unassigned')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 hover:bg-amber-100 transition-all flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" />
                  {summaryMetrics.unassigned} unassigned client{summaryMetrics.unassigned > 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── 4. SEARCH + SMART FILTERS + SORT + VIEW CONTROLS ──────── */}
        <div className="bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-xl p-3 shadow-xs space-y-2.5">
          
          {/* Row 1: Search + Quick status chips + List/Grid toggle */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search clients, brands, contacts, managers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg outline-none font-medium focus:border-blue-500 text-slate-900 dark:text-white"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Status Chips */}
            <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-full">
              {(['All', 'Active', 'Needs Attention', 'Unassigned', 'Pending Approval', 'On Hold'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setQuickFilter(tab)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                    quickFilter === tab
                      ? "bg-[#2563FF] text-white shadow-xs"
                      : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-lg border border-slate-200 dark:border-white/10 self-end lg:self-auto shrink-0">
              <button
                type="button"
                onClick={() => handleToggleViewMode('list')}
                className={`p-1 rounded-md transition-all ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
                title="Operational List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleToggleViewMode('cards')}
                className={`p-1 rounded-md transition-all ${
                  viewMode === 'cards'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
                title="Card View"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Row 2: Filter Button + Active Filter Chips + Sort Dropdown */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Advanced Filter Popover Trigger */}
              <button
                type="button"
                onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  isFilterPanelOpen || activeFiltersCount > 0
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                    : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* Removable Active Filter Chips */}
              {filterManager !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                  Manager: {filterManager === 'unassigned' ? 'Unassigned' : teamMembers.find(t => t.userId === filterManager)?.name || filterManager}
                  <button onClick={() => setFilterManager('All')} className="hover:text-blue-900 ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filterIndustry !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                  Industry: {filterIndustry}
                  <button onClick={() => setFilterIndustry('All')} className="hover:text-blue-900 ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filterPackage !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                  Package: {filterPackage}
                  <button onClick={() => setFilterPackage('All')} className="hover:text-blue-900 ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filterStatus !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                  Status: {filterStatus}
                  <button onClick={() => setFilterStatus('All')} className="hover:text-blue-900 ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {activeFiltersCount > 1 && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="px-2 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Clear All
                </button>
              )}
            </div>

            {/* Sort Options */}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3" /> Sort:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="updated">Recently Updated</option>
                <option value="name-asc">Client Name (A–Z)</option>
                <option value="newest">Newest Client</option>
                <option value="oldest">Oldest Client</option>
                <option value="pending">Most Pending Work</option>
                <option value="due">Next Due Date</option>
              </select>
            </div>
          </div>

          {/* Collapsible Advanced Filters Panel */}
          {isFilterPanelOpen && (
            <div className="pt-3 border-t border-slate-100 dark:border-white/5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 animate-in fade-in">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Account Manager</label>
                <select
                  value={filterManager}
                  onChange={(e) => setFilterManager(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                >
                  <option value="All">All Managers</option>
                  <option value="unassigned">⚠️ Unassigned</option>
                  {teamMembers.map(t => (
                    <option key={t.userId} value={t.userId}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Industry</label>
                <select
                  value={filterIndustry}
                  onChange={(e) => setFilterIndustry(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                >
                  <option value="All">All Industries</option>
                  {availableIndustries.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Package Plan</label>
                <select
                  value={filterPackage}
                  onChange={(e) => setFilterPackage(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                >
                  <option value="All">All Packages</option>
                  <option value="Starter">Starter</option>
                  <option value="Growth">Growth</option>
                  <option value="Premium">Premium</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Lifecycle Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ─── 5. FLOATING CONTEXTUAL BULK ACTIONS BAR ───────────────── */}
        {selectedClientIds.size > 0 && (
          <div className="bg-[#0E1428] border-2 border-blue-500 text-white px-4 py-2.5 rounded-xl shadow-2xl flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
              <span className="text-xs font-black uppercase tracking-wider">
                {selectedClientIds.size} {selectedClientIds.size === 1 ? 'Client' : 'Clients'} Selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedClientIds(new Set())}
                className="text-[11px] underline text-slate-300 hover:text-white font-bold"
              >
                Clear Selection
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Bulk Assign Manager */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[10px] uppercase text-slate-400 font-bold">Assign Manager:</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) handleBulkAssignManager(e.target.value);
                  }}
                  defaultValue=""
                  className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white outline-none cursor-pointer"
                >
                  <option value="" disabled>Select Manager</option>
                  {teamMembers.map(t => (
                    <option key={t.userId} value={t.userId}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Bulk Status */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[10px] uppercase text-slate-400 font-bold">Set Status:</span>
                <button
                  type="button"
                  onClick={() => handleBulkChangeStatus('Active')}
                  className="px-2 py-0.5 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-md text-[10px] font-bold border border-emerald-500/40 uppercase transition-all"
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkChangeStatus('Paused')}
                  className="px-2 py-0.5 bg-amber-600/30 hover:bg-amber-600 text-amber-300 hover:text-white rounded-md text-[10px] font-bold border border-amber-500/40 uppercase transition-all"
                >
                  Paused
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkChangeStatus('Completed')}
                  className="px-2 py-0.5 bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white rounded-md text-[10px] font-bold border border-purple-500/40 uppercase transition-all"
                >
                  Completed
                </button>
              </div>

              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all"
              >
                <Download className="w-3 h-3" /> Export Selected
              </button>
            </div>
          </div>
        )}

        {/* ─── 6. HIGH-DENSITY OPERATIONAL TABLE (DEFAULT VIEW) ──────── */}
        {viewMode === 'list' && (
          <div className="bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-xl shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array(6).fill(0).map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-white/5 animate-pulse border border-slate-200 dark:border-white/5" />
                ))}
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Building2 className="w-10 h-10 text-slate-400 mx-auto opacity-40" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white">
                  No Client Accounts Found
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No clients match your search and filter criteria. Clear filters or create a new client account.
                </p>
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="px-3.5 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg uppercase tracking-wider shadow-sm"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                      <th className="p-3 pl-4 w-10">
                        <input
                          type="checkbox"
                          checked={filteredClients.length > 0 && filteredClients.every(c => selectedClientIds.has(c.clientId))}
                          onChange={handleSelectAll}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="p-3 min-w-[240px]">Client</th>
                      <th className="p-3 min-w-[160px]">Account Manager</th>
                      <th className="p-3 min-w-[130px]">Work Health</th>
                      <th className="p-3 min-w-[130px]">Pending</th>
                      <th className="p-3 min-w-[200px]">Next Action</th>
                      <th className="p-3 min-w-[110px]">Status</th>
                      <th className="p-3 text-right pr-4 min-w-[120px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                    {filteredClients.map((client) => {
                      const isSelected = selectedClientIds.has(client.clientId);
                      return (
                        <tr
                          key={client.clientId}
                          className={`hover:bg-blue-50/40 dark:hover:bg-white/[0.02] transition-colors group ${
                            isSelected ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="p-3 pl-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectClient(client.clientId)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>

                          {/* 1. Client Identity (Name + Brand/Industry/Package line) */}
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${getClientAvatarBg(client.clientName)} flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0`}>
                                {client.clientName.substring(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <p 
                                  onClick={() => handleSelectClient(client.clientId)}
                                  className="font-bold text-slate-900 dark:text-white leading-tight hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate cursor-pointer text-xs"
                                >
                                  {client.clientName}
                                </p>
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                                  <span className="truncate">{client.businessName || client.clientName}</span>
                                  <span>·</span>
                                  <span className="font-semibold text-slate-600 dark:text-slate-300 shrink-0">{client.category || 'General'}</span>
                                  <span>·</span>
                                  <span className="font-black text-blue-600 dark:text-blue-400 uppercase text-[10px] shrink-0">{client.package}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Account Manager (Assigned or Inline Assign Manager Selector) */}
                          <td className="p-3 relative quick-assign-container">
                            {client.manager ? (
                              <div 
                                onClick={() => setQuickAssignClientId(quickAssignClientId === client.clientId ? null : client.clientId)}
                                className="flex items-center gap-1.5 cursor-pointer group/mgr py-0.5 px-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-all w-fit"
                                title="Click to reassign account manager"
                              >
                                <div className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-600 dark:text-blue-400 font-bold text-[9px] flex items-center justify-center shrink-0">
                                  {client.manager.name.charAt(0)}
                                </div>
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate group-hover/mgr:text-blue-600">
                                  {client.manager.name}
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setQuickAssignClientId(quickAssignClientId === client.clientId ? null : client.clientId)}
                                className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 hover:bg-amber-100 transition-all flex items-center gap-1"
                              >
                                <UserPlus className="w-3 h-3 text-amber-500" />
                                <span>Assign Manager</span>
                              </button>
                            )}

                            {/* Quick Manager Selector Popover */}
                            {quickAssignClientId === client.clientId && (
                              <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-[#0E1428] border border-slate-200 dark:border-white/15 rounded-xl shadow-2xl p-1.5 z-40 space-y-1 animate-in fade-in">
                                <p className="text-[9px] font-black uppercase text-slate-400 px-2 py-1 border-b border-slate-100 dark:border-white/5">
                                  Assign Manager
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleQuickAssignManager(client.clientId, '')}
                                  className="w-full text-left px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg font-bold"
                                >
                                  -- Unassigned --
                                </button>
                                {teamMembers.map(t => (
                                  <button
                                    key={t.userId}
                                    type="button"
                                    onClick={() => handleQuickAssignManager(client.clientId, t.userId)}
                                    className={`w-full text-left px-2 py-1 text-xs rounded-lg font-bold flex items-center justify-between hover:bg-blue-50 dark:hover:bg-white/5 ${
                                      client.assignedAdminId === t.userId ? 'text-blue-600 bg-blue-50 dark:bg-white/10' : 'text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    <span>{t.name}</span>
                                    {client.assignedAdminId === t.userId && <Check className="w-3 h-3 text-blue-600" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* 3. Work Health (Decoupled from Manager Assignment) */}
                          <td className="p-3">
                            <span
                              title={client.healthReason}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-help ${
                                client.workHealth === 'On Track'
                                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                                  : client.workHealth === 'Waiting on Client'
                                  ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40'
                                  : client.workHealth === 'Paused'
                                  ? 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400 border border-slate-200 dark:border-white/10'
                                  : client.workHealth === 'At Risk'
                                  ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
                                  : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                client.workHealth === 'On Track' ? 'bg-[#16A34A]' :
                                client.workHealth === 'Waiting on Client' ? 'bg-[#2563EB]' :
                                client.workHealth === 'Paused' ? 'bg-[#667085]' :
                                client.workHealth === 'At Risk' ? 'bg-[#DC2626] animate-ping' :
                                'bg-[#F59E0B] animate-pulse'
                              }`} />
                              {client.workHealth}
                            </span>
                          </td>

                          {/* 4. Pending Items Counters */}
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              {client.pendingTasksCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleSelectClient(client.clientId);
                                    setWorkspaceTab('list');
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${
                                    client.overdueTasksCount > 0
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-300'
                                      : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300'
                                  }`}
                                  title={`${client.pendingTasksCount} open tasks (${client.overdueTasksCount} overdue)`}
                                >
                                  {client.pendingTasksCount} Tasks
                                </button>
                              ) : null}

                              {client.pendingApprovalsCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleSelectClient(client.clientId);
                                    setWorkspaceTab('timeline');
                                  }}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-300"
                                  title={`${client.pendingApprovalsCount} pending approvals`}
                                >
                                  {client.pendingApprovalsCount} Approvals
                                </button>
                              ) : null}

                              {client.activeVideosCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleSelectClient(client.clientId);
                                    setWorkspaceTab('list');
                                  }}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-300"
                                  title={`${client.activeVideosCount} videos in production`}
                                >
                                  {client.activeVideosCount} Videos
                                </button>
                              ) : null}

                              {client.pendingTasksCount === 0 && client.pendingApprovalsCount === 0 && client.activeVideosCount === 0 && (
                                <span className="text-slate-400 font-mono text-xs">—</span>
                              )}
                            </div>
                          </td>

                          {/* 5. Next Action / Due */}
                          <td className="p-3">
                            <p className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[220px]" title={client.nextActionText}>
                              {client.nextActionText}
                            </p>
                          </td>

                          {/* 6. Lifecycle Status */}
                          <td className="p-3">
                            <select
                              value={client.status}
                              onChange={(e) => handleQuickStatusToggle(client.clientId, e.target.value as any)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider outline-none cursor-pointer border ${
                                client.status === 'Active'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40'
                                  : client.status === 'Paused'
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40'
                                  : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40'
                              }`}
                            >
                              <option value="Active" className="bg-[#111728] text-white">Active</option>
                              <option value="Paused" className="bg-[#111728] text-white">On Hold</option>
                              <option value="Completed" className="bg-[#111728] text-white">Completed</option>
                            </select>
                          </td>

                          {/* 7. Actions (Open Button + 3-Dot Overflow Menu) */}
                          <td className="p-3 pr-4 text-right">
                            <div className="flex items-center gap-1.5 justify-end client-menu-container relative">
                              {/* Open Workspace Primary Action */}
                              <button
                                type="button"
                                onClick={() => handleSelectClient(client.clientId)}
                                className="px-2.5 py-1 bg-[#2563FF] hover:bg-[#1d4ed8] text-white text-[11px] font-bold rounded-lg uppercase tracking-wider shadow-xs transition-all flex items-center gap-1"
                                title="Open client workspace"
                              >
                                <span>Open</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>

                              {/* Quick Preview Eye Icon */}
                              <button
                                type="button"
                                onClick={() => setPreviewClient(client)}
                                className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                                title="Quick Preview details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* 3-Dot Overflow Menu Trigger */}
                              <button
                                type="button"
                                onClick={() => setActiveMenuClientId(activeMenuClientId === client.clientId ? null : client.clientId)}
                                className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>

                              {/* 3-Dot Dropdown Menu Popover */}
                              {activeMenuClientId === client.clientId && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#0E1428] border border-slate-200 dark:border-white/15 rounded-xl shadow-2xl p-1 z-40 space-y-0.5 text-left animate-in fade-in">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuClientId(null);
                                      handleSelectClient(client.clientId);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-blue-500" /> Open Workspace
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuClientId(null);
                                      handleOpenQuickTaskModal(client.clientId);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-blue-500" /> Create Task
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuClientId(null);
                                      handleSelectClient(client.clientId);
                                      setWorkspaceTab('workdone');
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                  >
                                    <CheckSquare className="w-3.5 h-3.5 text-emerald-500" /> Add Work Log
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuClientId(null);
                                      handleSelectClient(client.clientId);
                                      setWorkspaceTab('timeline');
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                  >
                                    <CalendarDays className="w-3.5 h-3.5 text-amber-500" /> Add Calendar Item
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuClientId(null);
                                      handleSelectClient(client.clientId);
                                      setWorkspaceTab('timeline');
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                  >
                                    <Clock className="w-3.5 h-3.5 text-purple-500" /> Request Approval
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuClientId(null);
                                      setQuickAssignClientId(client.clientId);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                  >
                                    <UserCheck className="w-3.5 h-3.5 text-blue-400" /> Assign / Change Manager
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuClientId(null);
                                      handleOpenEditClient(client);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-slate-400" /> Edit Client
                                  </button>

                                  <div className="border-t border-slate-100 dark:border-white/5 my-1" />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuClientId(null);
                                      handleDeleteClient(client.clientId);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg flex items-center gap-2"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete Space
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── 7. COMPACT CARD VIEW (VISUAL ALTERNATIVE) ─────────────── */}
        {viewMode === 'cards' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredClients.map((client) => {
              return (
                <div
                  key={client.clientId}
                  className="bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 p-3.5 rounded-xl shadow-xs hover:border-blue-500/50 transition-all flex flex-col justify-between gap-2.5 group"
                >
                  {/* Card Header */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${getClientAvatarBg(client.clientName)} flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0`}>
                          {client.clientName.substring(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <h4 
                            onClick={() => handleSelectClient(client.clientId)}
                            className="font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-blue-500 leading-tight text-xs"
                          >
                            {client.clientName}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate">
                            {client.businessName} · {client.package}
                          </p>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        client.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : client.status === 'Paused'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300'
                      }`}>
                        {client.status === 'Paused' ? 'On Hold' : client.status}
                      </span>
                    </div>

                    {/* Account Manager & Work Health */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-white/5">
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        {client.manager ? client.manager.name : '⚠️ Unassigned'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        client.workHealth === 'On Track' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' :
                        client.workHealth === 'Waiting on Client' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' :
                        client.workHealth === 'Paused' ? 'bg-slate-100 text-slate-600' :
                        client.workHealth === 'At Risk' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300' :
                        'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                      }`}>
                        {client.workHealth}
                      </span>
                    </div>

                    {/* Next Action Text */}
                    <p className="text-[10px] font-mono text-slate-600 dark:text-slate-300 truncate pt-0.5" title={client.nextActionText}>
                      {client.nextActionText}
                    </p>
                  </div>

                  {/* Card Footer Action */}
                  <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setPreviewClient(client)}
                      className="text-[10px] font-bold text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectClient(client.clientId)}
                      className="px-2.5 py-1 bg-[#2563FF] hover:bg-[#1d4ed8] text-white text-[11px] font-bold rounded-lg uppercase tracking-wider transition-all flex items-center gap-1"
                    >
                      <span>Open</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── 8. SIDE DRAWER QUICK-PREVIEW ──────────────────────────── */}
        {previewClient && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end animate-in fade-in">
            <div className="bg-[#0E1428] border-l border-white/10 w-full max-w-md h-full overflow-y-auto p-6 space-y-5 shadow-2xl flex flex-col justify-between">
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${getClientAvatarBg(previewClient.clientName)} flex items-center justify-center font-black text-base uppercase text-white shadow-md`}>
                      {previewClient.clientName.substring(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white leading-tight">
                        {previewClient.clientName}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {previewClient.businessName}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewClient(null)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Identity Badges */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Industry</span>
                    <span className="font-bold text-white mt-0.5 block">{previewClient.category || 'General'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Package</span>
                    <span className="font-bold text-blue-400 mt-0.5 block">{previewClient.package}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Account Director</span>
                    <span className="font-bold text-white mt-0.5 block">
                      {teamMembers.find(t => t.userId === previewClient.assignedAdminId)?.name || 'Unassigned'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Contract Started</span>
                    <span className="font-bold text-slate-300 mt-0.5 block">{previewClient.startDate || '2024-01-01'}</span>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-2 text-xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block pb-1 border-b border-white/5">
                    Main Contact
                  </span>
                  <div className="flex items-center gap-2 text-slate-300">
                    <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>{previewClient.contactPerson || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>{previewClient.email || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>{previewClient.phone || 'Not provided'}</span>
                  </div>
                </div>

                {/* Real Pending Tasks List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Active Deliverables ({allTasks.filter(t => t.clientId === previewClient.clientId && t.status !== 'Done').length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenQuickTaskModal(previewClient.clientId)}
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Add Task
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {allTasks.filter(t => t.clientId === previewClient.clientId && t.status !== 'Done').length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2">✓ No open tasks for this account.</p>
                    ) : (
                      allTasks.filter(t => t.clientId === previewClient.clientId && t.status !== 'Done').map(t => (
                        <div key={t.taskId} className="p-2 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-white truncate">{t.title}</p>
                            <p className="text-[10px] text-slate-400">{t.status} · Due {t.dueDate}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(t, 'Done')}
                            className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition-all shrink-0"
                          >
                            Done
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Drawer Actions */}
              <div className="pt-4 border-t border-white/10 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    handleSelectClient(previewClient.clientId);
                    setPreviewClient(null);
                  }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-all"
                >
                  Enter Full Workspace <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── 9. CREATE / EDIT CLIENT MULTI-STEP MODAL ──────────────── */}
        {isClientModalOpen && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[#0E1428] border border-white/10 rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider text-white">
                    {editingClient ? 'Edit Client Account' : 'Onboard New Agency Client'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Step {clientFormStep} of 3: {clientFormStep === 1 ? 'Basic Details' : clientFormStep === 2 ? 'Contract & Ownership' : 'Contact & Notes'}
                  </p>
                </div>
                <button onClick={() => setIsClientModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitClient} className="space-y-4">
                {clientFormStep === 1 && (
                  <div className="space-y-3 animate-in fade-in">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Client / Doctor / Brand Name *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Dr. Anupam Jindal, Apollo Health, Brand X"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Business / Clinic / Company Name *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Jindal Neurosurgery & Spine Center"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Industry / Category</label>
                      <select 
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="Healthcare">Healthcare & Hospitals</option>
                        <option value="Healthcare & Neurosurgery">Healthcare & Neurosurgery</option>
                        <option value="Healthcare & Gynecology">Healthcare & Gynecology</option>
                        <option value="Healthcare & Orthopaedics">Healthcare & Orthopaedics</option>
                        <option value="Healthcare & Cardiology">Healthcare & Cardiology</option>
                        <option value="Real Estate">Real Estate & Construction</option>
                        <option value="Education">Education & Coaching</option>
                        <option value="Manufacturing">Manufacturing & B2B</option>
                        <option value="Eldercare">Eldercare & Senior Living</option>
                        <option value="Food & Beverage">Food & Beverage / Restaurant</option>
                        <option value="Professional Services">Professional Services</option>
                        <option value="General">General Business</option>
                      </select>
                    </div>
                  </div>
                )}

                {clientFormStep === 2 && (
                  <div className="space-y-3 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Package Plan *</label>
                        <select 
                          value={selectedPackage}
                          onChange={(e) => setSelectedPackage(e.target.value as any)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="Starter">Starter</option>
                          <option value="Growth">Growth</option>
                          <option value="Premium">Premium</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Contract Status *</label>
                        <select 
                          value={status}
                          onChange={(e) => setStatus(e.target.value as any)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="Active">Active</option>
                          <option value="Paused">Paused</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Assign Account Director / Manager</label>
                      <select 
                        value={assignedAdminId}
                        onChange={(e) => setAssignedAdminId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="">-- Leave Unassigned --</option>
                        {teamMembers.map(t => (
                          <option key={t.userId} value={t.userId}>{t.name} ({t.role})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Contract Start Date</label>
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  </div>
                )}

                {clientFormStep === 3 && (
                  <div className="space-y-3 animate-in fade-in">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Contact Person Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Dr. Anupam Jindal / Coordinator"
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Email (For Client Login) *</label>
                        <input 
                          type="email" 
                          required
                          placeholder="client@brand.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Phone Number</label>
                        <input 
                          type="text" 
                          placeholder="+91 98000 00000"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Scope & Internal Notes</label>
                      <textarea 
                        rows={2}
                        placeholder="Content targets, key deliverables, social handles..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-medium outline-none focus:border-blue-500 resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* Step Controls */}
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  {clientFormStep > 1 ? (
                    <button
                      type="button"
                      onClick={() => setClientFormStep((prev) => (prev - 1) as any)}
                      className="px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-bold rounded-xl"
                    >
                      Back
                    </button>
                  ) : <div />}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsClientModalOpen(false)}
                      className="px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-bold rounded-xl"
                    >
                      Cancel
                    </button>

                    {clientFormStep < 3 ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (clientFormStep === 1 && (!clientName || !businessName)) {
                            alert("Please enter client and business name!");
                            return;
                          }
                          setClientFormStep((prev) => (prev + 1) as any);
                        }}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl uppercase tracking-wider"
                      >
                        Next Step
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl uppercase tracking-wider shadow-md"
                      >
                        Save Client Account
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // ACTIVE CLIENT WORKSPACE (CLICKUP DETAILED OPERATIONAL CONTEXT)
  // ═════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* ClickUp-style Workspace Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 p-6 rounded-3xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            {!isClientRole && (
              <button 
                onClick={() => setSelectedClientId(null)}
                className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors"
                title="Back to master directory"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-cyan-500 text-white font-black rounded-2xl flex items-center justify-center text-xl shadow shadow-purple-500/25">
                {activeClientObj?.clientName.substring(0, 2).toUpperCase() || 'SP'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-slate-900 dark:text-white leading-none">
                    {activeClientObj?.clientName} Workspace
                  </h1>
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-cyan-405 px-2 py-0.5 rounded-full">
                    {activeClientObj?.package}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-500 mt-1">
                  Brand: <span className="text-slate-800 dark:text-slate-350">{activeClientObj?.businessName}</span> • Manager: <span className="text-slate-800 dark:text-slate-350">{teamMembers.find(t => t.userId === activeClientObj?.assignedAdminId)?.name || 'Unassigned'}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Project progress indicator */}
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-2.5 px-4 rounded-2xl border border-slate-100 dark:border-slate-850 text-xs font-sans">
              <div>
                <div className="flex justify-between font-black text-slate-700 dark:text-slate-300">
                  <span>Task Progress</span>
                  <span className="ml-2">{progressPercent}%</span>
                </div>
                <div className="w-32 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-1 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-600 to-cyan-400 h-full transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 ml-1">({completedTasksCount}/{totalTasksCount})</span>
            </div>

            <button 
              onClick={handleOpenAddTask}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Add Task
            </button>
          </div>
        </div>

        {/* View switching bar (tabs style clickup) */}
        <div className="flex items-center gap-1 border-t border-slate-100 dark:border-slate-850 pt-4 overflow-x-auto whitespace-nowrap scrollbar-none">
          <button 
            onClick={() => setWorkspaceTab('list')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              workspaceTab === 'list' 
                ? 'bg-purple-50 text-purple-650 dark:bg-purple-950/40 dark:text-cyan-400 border border-purple-100/10' 
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800'
            }`}
          >
            <ListTodo className="w-4 h-4" /> List View
          </button>
          <button 
            onClick={() => setWorkspaceTab('board')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              workspaceTab === 'board' 
                ? 'bg-purple-50 text-purple-650 dark:bg-purple-950/40 dark:text-cyan-400 border border-purple-100/10' 
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800'
            }`}
          >
            <Kanban className="w-4 h-4" /> Board View
          </button>
          <button 
            onClick={() => setWorkspaceTab('timeline')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              workspaceTab === 'timeline' 
                ? 'bg-purple-50 text-purple-650 dark:bg-purple-950/40 dark:text-cyan-400 border border-purple-100/10' 
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800'
            }`}
          >
            <CalendarDays className="w-4 h-4" /> Calendar View
          </button>
          <button 
            onClick={() => setWorkspaceTab('docs')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              workspaceTab === 'docs' 
                ? 'bg-purple-50 text-purple-650 dark:bg-purple-950/40 dark:text-cyan-400 border border-purple-100/10' 
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Brand Docs
          </button>
          <button 
            onClick={() => setWorkspaceTab('chat')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all relative ${
              workspaceTab === 'chat' 
                ? 'bg-purple-50 text-purple-650 dark:bg-purple-950/40 dark:text-cyan-400 border border-purple-100/10' 
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Live Chat
            {chatMessages.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[8px] font-black scale-90">
                {chatMessages.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setWorkspaceTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              workspaceTab === 'settings' 
                ? 'bg-purple-50 text-purple-650 dark:bg-purple-950/40 dark:text-cyan-400 border border-purple-100/10' 
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" /> CRM Settings
          </button>
          {!isClientRole && (
            <button 
              onClick={() => setWorkspaceTab('workdone')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                workspaceTab === 'workdone' 
                  ? 'bg-purple-50 text-purple-650 dark:bg-purple-950/40 dark:text-cyan-400 border border-purple-100/10' 
                  : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800'
              }`}
            >
              <TrendingUp className="w-4 h-4" /> Work Done
            </button>
          )}
        </div>
      </div>

      {/* RENDER ACTIVE SUBTAB VIEW */}
      <div className="transition-all duration-300">
        
        {/* VIEW 1: LIST VIEW */}
        {workspaceTab === 'list' && (() => {
          const uniqueProjects: string[] = Array.from(new Set(tasks.map(t => t.project || 'Project 1')));
          if (uniqueProjects.length === 0) {
            uniqueProjects.push('Project 1');
          }
          uniqueProjects.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

          return (
            <div className="space-y-6 font-sans">
              {uniqueProjects.map(project => {
                const isProjectExpanded = expandedProjects[project] !== false;
                const projectTasks = tasks.filter(t => (t.project || 'Project 1') === project);

                return (
                  <div key={project} className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-850 rounded-2xl p-4 shadow-sm space-y-4">
                    {/* Project Folder Header */}
                    <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-800 pb-3">
                      <div 
                        onClick={() => setExpandedProjects(prev => ({ ...prev, [project]: !isProjectExpanded }))}
                        className="flex items-center gap-2 cursor-pointer select-none group"
                      >
                        <Folder className="w-5 h-5 text-purple-650 dark:text-cyan-400 group-hover:scale-105 transition-transform" />
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none">Team Space</span>
                          <span className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 mt-0.5">
                            {project}
                            {isProjectExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleOpenAddTask('To Do', project)}
                          className="text-[11px] font-black uppercase text-purple-600 dark:text-cyan-400 hover:bg-purple-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-purple-100/10 transition-colors"
                        >
                          + Create List Task
                        </button>
                      </div>
                    </div>

                    {/* Collapsible content of the project (grouped by status) */}
                    {isProjectExpanded && (
                      <div className="space-y-4 pt-1">
                        {(['To Do', 'In Progress', 'In Review', 'Done'] as const).map(statusType => {
                          const statusTasks = projectTasks.filter(t => t.status === statusType);
                          const isStatusExpanded = expandedSections[`${project}_${statusType}`] !== false;
                          
                          // ClickUp status badge colors & prefix symbols
                          const badgeStyles = 
                            statusType === 'To Do' 
                              ? { bg: 'bg-slate-100 dark:bg-slate-800/80', text: 'text-slate-600 dark:text-slate-300', dot: 'border-2 border-slate-400 border-dashed' } 
                              : statusType === 'In Progress' 
                                ? { bg: 'bg-blue-500', text: 'text-white', dot: 'bg-white' } 
                                : statusType === 'In Review' 
                                  ? { bg: 'bg-amber-500', text: 'text-white', dot: 'bg-white' } 
                                  : { bg: 'bg-emerald-500', text: 'text-white', dot: 'bg-white' };

                          return (
                            <div key={statusType} className="overflow-hidden">
                              {/* Status Sub-header bar */}
                              <div className="flex items-center justify-between py-1.5 border-b border-slate-150 dark:border-slate-850">
                                <div 
                                  onClick={() => setExpandedSections(prev => ({ ...prev, [`${project}_${statusType}`]: !isStatusExpanded }))}
                                  className="flex items-center gap-2.5 cursor-pointer select-none"
                                >
                                  {isStatusExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                  
                                  <div className={`flex items-center gap-1.5 py-0.5 px-3 rounded-full text-[10px] font-black uppercase tracking-wider ${badgeStyles.bg} ${badgeStyles.text}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${badgeStyles.dot}`} />
                                    {statusType}
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-400 font-mono">({statusTasks.length})</span>
                                </div>
                              </div>

                              {/* Task grid rows */}
                              {isStatusExpanded && (
                                <div className="mt-2 pl-6">
                                  {/* Column Titles Header */}
                                  {statusTasks.length > 0 && (
                                    <div className="grid grid-cols-12 gap-3 pb-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-850/40 uppercase tracking-wider pl-2">
                                      <div className="col-span-6">Name</div>
                                      <div className="col-span-2 text-center">Assignee</div>
                                      <div className="col-span-2 text-center">Due date</div>
                                      <div className="col-span-1 text-center">Priority</div>
                                      <div className="col-span-1 text-right"></div>
                                    </div>
                                  )}

                                  {/* Task entries */}
                                  {statusTasks.length === 0 ? (
                                    <p className="py-3 text-[11px] text-slate-400 italic font-medium">No tasks in this section.</p>
                                  ) : (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-850/40">
                                      {statusTasks.map(task => {
                                        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Done';
                                        
                                        // Priority flags color mapping
                                        const priorityFlag = 
                                          task.priority === 'Urgent' ? { color: 'text-red-500', label: 'Urgent' } :
                                          task.priority === 'High' ? { color: 'text-orange-500', label: 'High' } :
                                          task.priority === 'Medium' ? { color: 'text-blue-500', label: 'Medium' } :
                                          { color: 'text-slate-405 dark:text-slate-600', label: 'Low' };

                                        return (
                                          <div 
                                            key={task.taskId} 
                                            className="grid grid-cols-12 gap-3 py-2 items-center hover:bg-slate-100/50 dark:hover:bg-slate-900/60 rounded-lg px-2 group transition-all"
                                          >
                                            {/* Name Column */}
                                            <div className="col-span-6 flex items-center gap-3 min-w-0">
                                              {/* Quick Done checkmark circle */}
                                              <button 
                                                onClick={() => {
                                                  const newSt = task.status === 'Done' ? 'To Do' : 'Done';
                                                  handleQuickStatusChange(task, newSt);
                                                }}
                                                className="mt-0.5 shrink-0 hover:scale-110 transition-transform"
                                                title={task.status === 'Done' ? 'Mark incomplete' : 'Mark done'}
                                              >
                                                {task.status === 'Done' ? (
                                                  <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/10" />
                                                ) : (
                                                  <div className="w-5 h-5 border border-slate-350 dark:border-slate-700 rounded-full hover:border-purple-500 hover:bg-purple-500/5 transition-all" />
                                                )}
                                              </button>

                                              <div className="min-w-0 flex-1">
                                                <span 
                                                  onClick={() => handleOpenEditTask(task)}
                                                  className={`text-xs font-semibold cursor-pointer hover:text-purple-600 dark:hover:text-cyan-400 transition-colors ${
                                                    task.status === 'Done' 
                                                      ? 'line-through text-slate-400 dark:text-slate-500' 
                                                      : 'text-slate-800 dark:text-white font-bold'
                                                  }`}
                                                >
                                                  {task.title}
                                                </span>
                                                
                                                {/* Speech bubble indicator if there is a desc */}
                                                {task.description && (
                                                  <div className="flex items-center gap-1 mt-0.5 text-slate-400">
                                                    <MessageSquare className="w-3 h-3 text-slate-350 dark:text-slate-605" />
                                                    <span className="text-[10px] font-medium truncate max-w-sm">{task.description}</span>
                                                  </div>
                                                )}
                                              </div>
                                            </div>

                                            {/* Assignee Column */}
                                            <div className="col-span-2 text-center">
                                              {task.assigneeId ? (
                                                <div 
                                                  onClick={() => handleOpenEditTask(task)}
                                                  className="inline-flex items-center gap-1.5 py-0.5 px-2 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                  title={`Assigned to ${task.assigneeName}`}
                                                >
                                                  <div className="w-3.5 h-3.5 rounded-full bg-purple-500 text-white flex items-center justify-center text-[8px] font-black uppercase">
                                                    {task.assigneeName.substring(0,2)}
                                                  </div>
                                                  <span className="truncate max-w-[65px]">{task.assigneeName}</span>
                                                </div>
                                              ) : (
                                                <button 
                                                  onClick={() => handleOpenEditTask(task)}
                                                  className="inline-flex items-center gap-1 justify-center text-[10px] font-bold text-slate-405 dark:text-slate-500 hover:text-purple-600 transition-colors"
                                                >
                                                  <UserPlus className="w-3.5 h-3.5" />
                                                  <span>Add</span>
                                                </button>
                                              )}
                                            </div>

                                            {/* Due Date Column */}
                                            <div className="col-span-2 text-center">
                                              {task.dueDate ? (
                                                <button 
                                                  onClick={() => handleOpenEditTask(task)}
                                                  className={`inline-flex items-center gap-1 text-[10px] font-mono font-black ${
                                                    isOverdue ? 'text-red-500 font-extrabold' : 'text-slate-600 dark:text-slate-400'
                                                  } hover:underline`}
                                                >
                                                  <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                                  <span>{task.dueDate}</span>
                                                </button>
                                              ) : (
                                                <button 
                                                  onClick={() => handleOpenEditTask(task)}
                                                  className="inline-flex items-center gap-1 justify-center text-[10px] font-bold text-slate-405 dark:text-slate-500 hover:text-purple-655 transition-colors"
                                                >
                                                  <Calendar className="w-3.5 h-3.5" />
                                                  <span>Set</span>
                                                </button>
                                              )}
                                            </div>

                                            {/* Priority Flag Column */}
                                            <div className="col-span-1 text-center">
                                              <button 
                                                onClick={() => handleOpenEditTask(task)}
                                                className={`inline-flex items-center gap-1 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-all ${priorityFlag.color}`}
                                                title={`Priority: ${priorityFlag.label}`}
                                              >
                                                <Flag className="w-3.5 h-3.5 fill-current" />
                                              </button>
                                            </div>

                                            {/* Delete/Edit hover controls */}
                                            <div className="col-span-1 text-right flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                              <button 
                                                onClick={() => handleOpenEditTask(task)}
                                                className="p-1 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 transition-all"
                                                title="Edit Task"
                                              >
                                                <Edit2 className="w-3 h-3" />
                                              </button>
                                              <button 
                                                onClick={() => handleDeleteTask(task.taskId)}
                                                className="p-1 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded text-slate-400 transition-all"
                                                title="Delete Task"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Quick inline "+ Add Task" button or quick input form */}
                                  {activeQuickAddPath === `${project}_${statusType}` ? (
                                    <form 
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        handleQuickAddTaskSubmit(project, statusType);
                                      }}
                                      className="flex items-center gap-2 mt-2 w-full bg-white dark:bg-slate-900 border border-purple-500/30 rounded-xl p-1.5 shadow-xs"
                                    >
                                      <input
                                        type="text"
                                        placeholder="Type task title and press Enter..."
                                        value={quickTaskTitle}
                                        onChange={(e) => setQuickTaskTitle(e.target.value)}
                                        className="flex-1 bg-transparent border-none text-xs font-semibold outline-none px-2 dark:text-white"
                                        autoFocus
                                      />
                                      <div className="flex gap-1.5">
                                        <button
                                          type="submit"
                                          className="py-1 px-3 bg-blue-600 text-white font-bold rounded-lg text-[10px] hover:shadow transition-all"
                                        >
                                          Add
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveQuickAddPath(null);
                                            setQuickTaskTitle('');
                                          }}
                                          className="py-1 px-2 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </form>
                                  ) : (
                                    <button 
                                      onClick={() => {
                                        setActiveQuickAddPath(`${project}_${statusType}`);
                                        setQuickTaskTitle('');
                                      }}
                                      className="w-full text-left py-2 px-3 mt-1.5 rounded-lg border border-dashed border-slate-200 dark:border-slate-800/60 hover:bg-slate-100/40 dark:hover:bg-slate-900/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 transition-all"
                                    >
                                      <Plus className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Add Task to {statusType}</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* VIEW 2: KANBAN BOARD */}
        {workspaceTab === 'board' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto select-none pb-4 font-sans">
            {([
              { key: 'To Do', label: 'To Do', color: '#64748B', bg: 'bg-slate-500/10 text-slate-700' },
              { key: 'In Progress', label: 'In Progress', color: '#2563EB', bg: 'bg-blue-500/10 text-blue-700' },
              { key: 'In Review', label: 'In Review', color: '#F59E0B', bg: 'bg-amber-500/10 text-amber-700' },
              { key: 'Done', label: 'Done', color: '#16A34A', bg: 'bg-emerald-500/10 text-emerald-700' },
            ] as const).map(col => {
              const colTasks = tasks.filter(t => t.status === col.key);
              return (
                <div
                  key={col.key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const droppedTaskId = e.dataTransfer.getData('text/plain');
                    const targetTask = tasks.find(t => t.taskId === droppedTaskId);
                    if (targetTask && targetTask.status !== col.key) {
                      handleQuickStatusChange(targetTask, col.key);
                    }
                  }}
                  className="bg-[#F5F7FB] border border-[#D8DEE9] p-3.5 rounded-2xl min-h-[520px] flex flex-col gap-3 shadow-xs"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between border-b border-[#D8DEE9] pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                      <span className="text-xs font-black uppercase tracking-wider text-[#101828]">
                        {col.label}
                      </span>
                      <span className="text-[10px] font-black bg-white border border-[#D8DEE9] text-[#667085] px-2 py-0.5 rounded-full font-mono">
                        {colTasks.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveQuickAddPath(`board_${col.key}`);
                        setQuickTaskTitle('');
                      }}
                      title={`Add task to ${col.label}`}
                      className="p-1 rounded-lg text-slate-500 hover:text-[#4F46E5] hover:bg-white transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Column Cards Container */}
                  <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto pr-0.5">
                    {colTasks.length === 0 ? (
                      <div className="flex-1 border border-dashed border-[#D8DEE9] rounded-xl flex flex-col items-center justify-center p-6 text-center text-xs text-[#667085] bg-white/40 min-h-[120px] space-y-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                        <span className="text-[11px] font-semibold">No {col.label.toLowerCase()} tasks</span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveQuickAddPath(`board_${col.key}`);
                            setQuickTaskTitle('');
                          }}
                          className="text-[10px] font-bold text-[#4F46E5] hover:underline"
                        >
                          + Add Task
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {colTasks.map(task => {
                          const isOverdue = task.dueDate && new Date(task.dueDate) < new Date(todayDateStr) && task.status !== 'Done';

                          return (
                            <div
                              key={task.taskId}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', task.taskId);
                              }}
                              className="bg-white border border-[#D8DEE9] p-3.5 rounded-xl shadow-xs hover:shadow-md hover:border-[#4F46E5]/40 transition-all space-y-2.5 group cursor-grab active:cursor-grabbing"
                            >
                              {/* Title & Actions */}
                              <div className="space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 
                                    onClick={() => handleOpenEditTask(task)}
                                    className={`text-xs font-bold leading-snug cursor-pointer transition-colors ${
                                      task.status === 'Done' ? 'text-slate-400 line-through' : 'text-[#101828] hover:text-[#4F46E5]'
                                    }`}
                                  >
                                    {task.title}
                                  </h4>

                                  {task.status !== 'Done' && (
                                    <button
                                      type="button"
                                      onClick={() => handleQuickStatusChange(task, 'Done')}
                                      title="Mark Done & Sync to Work Log"
                                      className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>

                                {task.description && (
                                  <p className="text-[11px] font-medium text-[#667085] line-clamp-2">
                                    {task.description}
                                  </p>
                                )}
                              </div>

                              {/* Badges & Due Date */}
                              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#D8DEE9]/60 flex-wrap">
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                  task.priority === 'Urgent' ? 'bg-red-50 text-red-700 border border-red-200' :
                                  task.priority === 'High' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                  task.priority === 'Medium' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                  'bg-slate-50 text-slate-600 border border-slate-200'
                                }`}>
                                  {task.priority}
                                </span>

                                {task.dueDate && (
                                  <div className={`flex items-center gap-1 font-bold text-[10px] ${
                                    isOverdue ? 'text-rose-600 font-extrabold' : 'text-[#667085]'
                                  }`}>
                                    <Calendar className="w-3 h-3" />
                                    <span>{task.dueDate}</span>
                                    {isOverdue && (
                                      <span className="text-[8px] bg-rose-50 text-rose-700 border border-rose-200 px-1 rounded uppercase">
                                        Overdue
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Footer: Assignee & Quick Status Dropdown */}
                              <div className="flex items-center justify-between gap-1.5 pt-1">
                                <span className="text-[10px] font-bold text-slate-600 bg-[#F5F7FB] px-2 py-0.5 rounded-md truncate max-w-[120px]">
                                  👤 {task.assigneeName || 'Unassigned'}
                                </span>

                                <select
                                  value={task.status}
                                  onChange={(e) => handleQuickStatusChange(task, e.target.value as any)}
                                  className="text-[10px] font-bold bg-[#F5F7FB] border border-[#D8DEE9] text-[#4F46E5] hover:border-[#4F46E5] px-2 py-0.5 rounded-lg outline-none cursor-pointer"
                                >
                                  <option value="To Do">To Do</option>
                                  <option value="In Progress">In Progress</option>
                                  <option value="In Review">In Review</option>
                                  <option value="Done">Done</option>
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Quick Add Task button or input form in Kanban */}
                    {activeQuickAddPath === `board_${col.key}` ? (
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleQuickAddTaskSubmit('Project 1', col.key);
                        }}
                        className="flex flex-col gap-2 bg-white border border-[#4F46E5] rounded-xl p-3 shadow-xs mt-1 animate-in fade-in"
                      >
                        <input
                          type="text"
                          placeholder={`Type task title & press Enter...`}
                          value={quickTaskTitle}
                          onChange={(e) => setQuickTaskTitle(e.target.value)}
                          className="w-full bg-transparent border-none text-xs font-semibold outline-none text-[#101828] px-1 placeholder-slate-400"
                          autoFocus
                        />
                        <div className="flex justify-end gap-1.5 pt-1">
                          <button
                            type="submit"
                            className="py-1 px-3 bg-[#4F46E5] text-white font-bold rounded-lg text-[10px] hover:bg-[#4338CA] transition-all"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveQuickAddPath(null);
                              setQuickTaskTitle('');
                            }}
                            className="py-1 px-2 border border-[#D8DEE9] rounded-lg text-[10px] text-slate-500 hover:text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => {
                          setActiveQuickAddPath(`board_${col.key}`);
                          setQuickTaskTitle('');
                        }}
                        className="w-full text-center py-2 border border-dashed border-[#D8DEE9] hover:bg-white text-[11px] font-bold text-slate-500 hover:text-[#4F46E5] rounded-xl flex items-center justify-center gap-1.5 transition-all mt-1"
                      >
                        <Plus className="w-3.5 h-3.5 text-slate-400" />
                        <span>Quick Add Task</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW 3: TIMELINE/CALENDAR */}
        {workspaceTab === 'timeline' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-850">
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-205">Task Deadline Calendar</h3>
                <p className="text-xs font-medium text-slate-400">Schedule view of critical client deliverables.</p>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1))}
                  className="p-1.5 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-500"
                >
                  Prev
                </button>
                <span className="text-xs font-black uppercase text-slate-805 dark:text-white px-2 tracking-widest">
                  {calDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button 
                  onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1))}
                  className="p-1.5 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-500"
                >
                  Next
                </button>
              </div>
            </div>

            {/* Simple Calendar Generation */}
            {(() => {
              const year = calDate.getFullYear();
              const month = calDate.getMonth();
              const firstDay = new Date(year, month, 1).getDay();
              const totalDays = new Date(year, month + 1, 0).getDate();
              
              // Days slots
              const dayCells = [];
              for (let i = 0; i < firstDay; i++) {
                dayCells.push(<div key={`empty-${i}`} className="min-h-[85px] border border-slate-100/60 dark:border-slate-850 bg-slate-50/20 dark:bg-slate-900/10" />);
              }
              for (let d = 1; d <= totalDays; d++) {
                const curDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const daysTasks = tasks.filter(t => t.dueDate === curDateStr);
                const isContractStart = activeClientObj?.startDate === curDateStr;

                dayCells.push(
                  <div key={`day-${d}`} className="min-h-[85px] border border-slate-100/60 dark:border-slate-850 p-2 flex flex-col justify-between hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors">
                    <span className="text-[10px] font-black text-slate-400 font-mono block mb-1">{d}</span>
                    <div className="space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden">
                      {isContractStart && (
                        <span className="text-[8px] bg-emerald-500/10 text-emerald-600 dark:text-cyan-405 font-black uppercase tracking-wider border border-emerald-500/10 p-0.5 rounded block truncate">
                          🚀 Contract Start
                        </span>
                      )}
                      {daysTasks.map(t => (
                        <div 
                          key={t.taskId} 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditTask(t);
                          }}
                          className={`text-[9px] font-bold p-1 rounded border cursor-pointer truncate ${
                            t.status === 'Done' ? 'bg-emerald-500/15 text-emerald-650 border-emerald-500/10' :
                            t.status === 'In Review' ? 'bg-orange-500/15 text-orange-650 border-orange-500/10' :
                            'bg-purple-500/15 text-purple-650 border-purple-500/10'
                          }`}
                          title={`${t.title} (${t.status})`}
                        >
                          {t.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-7 border-t border-l border-slate-100 dark:border-slate-850 rounded-2xl overflow-hidden font-sans">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(w => (
                    <div key={w} className="bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-100 dark:border-slate-850 p-2 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {w}
                    </div>
                  ))}
                  {dayCells}
                </div>
              );
            })()}
          </div>
        )}

        {/* VIEW 4: CLICKUP DOCS (GUIDELINES) */}
        {workspaceTab === 'docs' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
            {/* Left panel edit fields */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-850">
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-205">ClickUp Brand Doc Wiki</h3>
                  <p className="text-xs font-medium text-slate-400">Define core parameters, guidelines, voice parameters and shared files.</p>
                </div>
                <button 
                  onClick={handleSaveGuidelines}
                  disabled={isSavingDoc}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all"
                >
                  {isSavingDoc ? 'Saving Document...' : 'Save Document'}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Brand Tone & Voice parameters</label>
                  <textarea 
                    value={brandVoice}
                    onChange={(e) => setBrandVoice(e.target.value)}
                    rows={3}
                    placeholder="Describe brand language guidelines, e.g., Conversational, technical, professional, quirky..."
                    className="w-full text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Design Canva, Drive, and Deliverables links</label>
                  <textarea 
                    value={driveLinks}
                    onChange={(e) => setDriveLinks(e.target.value)}
                    rows={2}
                    placeholder="e.g. Canva templates, Shared Google Drive asset folders..."
                    className="w-full text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 rounded-xl outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">General Brand Guidelines & Briefing content</label>
                  <textarea 
                    value={generalGuidelines}
                    onChange={(e) => setGeneralGuidelines(e.target.value)}
                    rows={8}
                    placeholder="Write detailed instructions, target audience descriptions, competitor analysis, hashtags rules, design briefs..."
                    className="w-full text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 rounded-xl outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Right panel: Brand Colors palette with Interactive Previews */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-750 dark:text-slate-205">Brand Color Palette</h3>
                <p className="text-xs font-medium text-slate-400">Add client's official brand hex colors.</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    placeholder="e.g. #FF5733"
                    value={hexInput}
                    onChange={(e) => setHexInput(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl outline-none font-mono uppercase"
                  />
                  <button 
                    onClick={handleAddHexColor}
                    className="bg-slate-105 hover:bg-slate-200 dark:bg-slate-800 font-extrabold text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-2">
                  {(brandDoc?.hexColors || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No brand hex colors specified yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      {(brandDoc?.hexColors || []).map(hex => (
                        <div key={hex} className="flex items-center justify-between p-2 border border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md shadow-sm border border-slate-200/45 dark:border-slate-800 shrink-0" style={{ backgroundColor: hex }} />
                            <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-350 uppercase">{hex}</span>
                          </div>
                          <button 
                            onClick={() => handleRemoveHexColor(hex)}
                            className="p-1 hover:text-red-500 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Fast guidelines brief cards */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-850 space-y-3.5">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Quick Guidelines</span>
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 text-xs">
                    <span className="text-indigo-605 font-bold block mb-1">Consistency Key</span>
                    <p className="text-slate-500 dark:text-slate-450 text-[11px] leading-relaxed">Always follow color guidelines when drafting social posters or video overlays.</p>
                  </div>
                  <div className="p-3 bg-purple-500/5 rounded-xl border border-purple-500/10 text-xs">
                    <span className="text-purple-605 font-bold block mb-1">Deliverables assets</span>
                    <p className="text-slate-500 dark:text-slate-450 text-[11px] leading-relaxed">Ensure content is saved to Google Drive link for instant agency-client sharing.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 5: CHAT / DISCUSSIONS */}
        {workspaceTab === 'chat' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl overflow-hidden flex flex-col h-[550px] shadow-sm font-sans">
            {/* Chat top info header */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-850 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Direct Client Discussion Feed
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">Real-time collaborative chat for design approvals and specifications.</p>
              </div>
              <span className="text-[10px] font-black text-slate-400 font-mono">({chatMessages.length} Messages)</span>
            </div>

            {/* Chat Messages flow */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center p-6 text-slate-400 space-y-2">
                  <MessageSquare className="w-10 h-10 text-purple-650 opacity-40" />
                  <p className="text-xs font-bold">No messages in this chat workspace yet.</p>
                  <p className="text-[10px] font-medium max-w-xs text-slate-400/80">Type a message below to coordinate deliverables, ask questions, or provide quick briefs.</p>
                </div>
              ) : (
                chatMessages.map(msg => {
                  const isMe = msg.senderId === profile?.userId;
                  return (
                    <div key={msg.msgId} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-full space-y-1`}>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-450">
                        <span className="text-slate-800 dark:text-slate-205">{msg.senderName}</span>
                        <span className="text-[8px] uppercase font-black bg-slate-100 dark:bg-slate-800 text-slate-500 py-0.5 px-1.5 rounded">
                          {msg.senderRole}
                        </span>
                        <span className="text-[8px] font-mono font-medium text-slate-400">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      
                      <div className={`p-3 rounded-2xl max-w-md text-xs font-sans leading-relaxed ${
                        isMe 
                          ? 'bg-purple-600 text-white rounded-tr-none' 
                          : 'bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 text-slate-800 dark:text-slate-100 rounded-tl-none'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Message composer input bar */}
            <form onSubmit={handleSendChatMessage} className="p-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-850 flex gap-2">
              <input 
                type="text" 
                placeholder="Type your message, query, or updates..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-purple-600 focus:ring-0 p-3 rounded-xl outline-none"
              />
              <button 
                type="submit"
                className="bg-purple-650 hover:bg-purple-700 text-white p-3 px-5 rounded-xl transition-all flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        )}

        {/* VIEW 6: CRM PROFILE & SETTINGS */}
        {workspaceTab === 'settings' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6 font-sans">
            <div className="flex justify-between items-center pb-4 border-b border-slate-105 dark:border-slate-850">
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-205">Client CRM Settings & Parameters</h3>
                <p className="text-xs font-medium text-slate-400">Manage client contract parameters, account information, and tags.</p>
              </div>
              
              {!isClientRole && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleOpenEditClient(activeClientObj!)}
                    className="p-2 px-4 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-black uppercase tracking-wider text-cyan-600 flex items-center gap-1 transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit Profile
                  </button>
                  <button 
                    onClick={() => handleDeleteClient(activeClientObj!.clientId)}
                    className="p-2 px-4 border border-red-200 hover:bg-red-600 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider text-red-505 flex items-center gap-1 transition-all animate-none"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove Client
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-400 block border-b border-slate-100 dark:border-slate-850 pb-2">Business Identification</h4>
                
                <div className="space-y-3.5 text-xs font-medium text-slate-650">
                  <div className="flex justify-between">
                    <span>Company Name:</span>
                    <strong className="text-slate-800 dark:text-white">{activeClientObj?.clientName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Business / Brand:</span>
                    <strong className="text-slate-800 dark:text-white">{activeClientObj?.businessName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Category Niche:</span>
                    <strong className="text-slate-800 dark:text-white">{activeClientObj?.category || 'General'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Contact Person:</span>
                    <strong className="text-slate-800 dark:text-white">{activeClientObj?.contactPerson}</strong>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-400 block border-b border-slate-100 dark:border-slate-850 pb-2">Subscription & Contract details</h4>
                
                <div className="space-y-3.5 text-xs font-medium text-slate-650">
                  <div className="flex justify-between">
                    <span>Email Address:</span>
                    <strong className="text-slate-850 dark:text-white">{activeClientObj?.email}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Phone Number:</span>
                    <strong className="text-slate-850 dark:text-white">{activeClientObj?.phone || '--'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Contract Started:</span>
                    <strong className="text-slate-850 dark:text-white font-mono">{activeClientObj?.startDate}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Service Status:</span>
                    <strong className={`uppercase ${activeClientObj?.status === 'Active' ? 'text-green-500' : 'text-amber-500'}`}>{activeClientObj?.status}</strong>
                  </div>
                </div>
              </div>
            </div>

            {activeClientObj?.notes && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-850 space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-400 block">Scope Notes (Internal)</h4>
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {activeClientObj.notes}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 7: WORK DONE */}
        {workspaceTab === 'workdone' && effectiveClientId && (
          <ClientWorkDoneTab clientId={effectiveClientId} clientName={activeClientObj?.clientName || ''} />
        )}
      </div>

      {/* Interactive Add/Edit Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                {editingTask ? 'Modify ClickUp Task' : 'Create New ClickUp Task'}
              </h2>
              <button onClick={() => setIsTaskModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmitTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Task Title *</label>
                <input 
                  type="text" 
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g., Design July Reels layout"
                  className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 p-2.5 rounded-xl outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">ClickUp Folder / Project Name</label>
                <input 
                  type="text" 
                  value={taskProject}
                  onChange={(e) => setTaskProject(e.target.value)}
                  placeholder="e.g., Project 1, Website Launch, Marketing Campaign"
                  className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 p-2.5 rounded-xl outline-none"
                />
                
                {(() => {
                  const existingProjNames = Array.from(new Set(tasks.map(t => t.project || 'Project 1')));
                  if (!existingProjNames.includes('Project 1')) existingProjNames.push('Project 1');
                  if (!existingProjNames.includes('Project 2')) existingProjNames.push('Project 2');
                  
                  return (
                    <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
                      <span className="text-[10px] text-slate-450 dark:text-slate-400 font-bold uppercase">Quick Selection:</span>
                      {existingProjNames.map(proj => (
                        <button
                          key={proj}
                          type="button"
                          onClick={() => setTaskProject(proj)}
                          className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-950 hover:text-purple-600 dark:hover:text-cyan-400 text-slate-650 dark:text-slate-300 py-0.5 px-2 rounded-md font-semibold transition-all"
                        >
                          {proj}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Description / Spec details</label>
                <textarea 
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Add specific rules, text copies, or checklists..."
                  rows={3}
                  className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 p-2.5 rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Workflow Status</label>
                  <select 
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value as any)}
                    className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 p-2.5 rounded-xl outline-none font-bold"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="In Review">In Review</option>
                    <option value="Done">Done</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Priority</label>
                  <select 
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 p-2.5 rounded-xl outline-none font-bold animate-pulse-none"
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Urgent">Urgent Priority</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Due Date</label>
                  <input 
                    type="date" 
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 p-2.5 rounded-xl outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Assignee</label>
                  <select 
                    value={taskAssigneeId}
                    onChange={(e) => setTaskAssigneeId(e.target.value)}
                    className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 p-2.5 rounded-xl outline-none font-bold"
                  >
                    <option value="">-- Leave Unassigned --</option>
                    {teamMembers.map(t => (
                      <option key={t.userId} value={t.userId}>{t.name} ({t.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsTaskModalOpen(false)}
                  className="py-2.5 px-5 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="py-2.5 px-5 bg-blue-600 text-white font-bold rounded-xl text-sm hover:shadow-lg transition-all"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── CLIENT WORK DONE TAB ─────────────────────────────────────────────
// Aggregates workLogs by clientId and shows monthly breakdown.
const ClientWorkDoneTab: React.FC<{ clientId: string; clientName: string }> = ({ clientId, clientName }) => {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedMonth, setSelectedMonth] = React.useState(new Date().toISOString().slice(0, 7));

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, 'workLogs'), where('clientId', '==', clientId))
        );
        if (!active) return;
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
        all.sort((a: any, b: any) => b.date.localeCompare(a.date));
        setLogs(all);
      } catch {
        try {
          const snap = await getDocs(collection(db, 'workLogs'));
          if (!active) return;
          const all = snap.docs.map(d => ({ id: d.id, ...d.data() as any }))
            .filter((l: any) => l.clientId === clientId || l.clientName === clientName);
          all.sort((a: any, b: any) => b.date.localeCompare(a.date));
          setLogs(all);
        } catch { /* silently skip */ }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [clientId, clientName]);

  const filtered = logs.filter((l: any) => l.date?.startsWith(selectedMonth));

  // Group by category
  const byCat: Record<string, any[]> = {};
  filtered.forEach((l: any) => {
    const k = l.category || 'Other';
    if (!byCat[k]) byCat[k] = [];
    byCat[k].push(l);
  });

  const totalHours = filtered.reduce((sum: number, l: any) => sum + (l.hours || 0), 0);

  return (
    <div className="space-y-4 p-4 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">Work Done This Month</h3>
          <p className="text-xs text-slate-500 mt-0.5">{filtered.length} entries · {totalHours}h logged</p>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
        />
      </div>

      {loading ? (
        <div className="space-y-2">{Array(4).fill(0).map((_, i) => <div key={i} className="h-12 rounded-xl bg-white/4 animate-pulse border border-white/6" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <p className="font-bold text-sm">No work logs for {selectedMonth}</p>
          <p className="text-xs mt-1">Work logs appear here when team members submit their daily logs against this client.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(byCat).map(([cat, items]) => (
              <span key={cat} className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-cyan-400 border border-purple-500/15">
                {cat} ({items.length})
              </span>
            ))}
          </div>
          {/* Log list */}
          <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
            {filtered.map((log: any, i: number) => (
              <div key={log.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/3 transition-all ${i < filtered.length - 1 ? 'border-b border-slate-100 dark:border-slate-800/60' : ''}`}>
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{log.workDone}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {log.employeeName && <span className="text-[10px] text-slate-500">{log.employeeName}</span>}
                    {log.category && <span className="text-[10px] text-slate-400">{log.category}</span>}
                  </div>
                </div>
                {log.hours && <span className="text-[10px] font-bold text-amber-500 flex-shrink-0">{log.hours}h</span>}
                <span className="text-[10px] text-slate-400 flex-shrink-0">{log.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── CLIENT HEALTH BADGE ─────────────────────────────────────────────
// Auto-calculates from real clientTasks data. Shown on each client card.
const ClientHealthBadge: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [score, setScore] = React.useState<number | null>(null);
  const [total, setTotal] = React.useState(0);
  const [done, setDone] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'tasks'), where('clientId', '==', clientId)));
        if (!active) return;
        const all = snap.docs.map(d => d.data());
        const totalCount = all.length;
        const doneCount  = all.filter(t => t.status === 'Done' || t.status === 'Completed').length;
        const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : null;
        setTotal(totalCount);
        setDone(doneCount);
        setScore(pct);
      } catch { /* silently skip */ }
    };
    load();
    return () => { active = false; };
  }, [clientId]);

  if (score === null && total === 0) return null;

  const getHealth = () => {
    if (score === null) return { label: 'No Tasks', color: 'bg-slate-500/10 text-slate-400 border-slate-500/15', bar: 'bg-slate-600' };
    if (score >= 70) return { label: '✓ Healthy', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', bar: 'bg-emerald-500' };
    if (score >= 40) return { label: '! Attention', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', bar: 'bg-amber-500' };
    return { label: '⚠ At Risk', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', bar: 'bg-rose-500' };
  };

  const h = getHealth();
  return (
    <div className="mt-1 mb-1">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${h.color}`}>
          {h.label}
        </span>
        {score !== null && (
          <span className="text-[9px] font-bold text-slate-500">{done}/{total} tasks · {score}%</span>
        )}
      </div>
      {score !== null && (
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${h.bar}`} style={{ width: `${score}%` }} />
        </div>
      )}
    </div>
  );
};

