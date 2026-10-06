import React, { useState, useEffect, useCallback } from 'react';
import {
  collection, onSnapshot, doc, updateDoc, setDoc, addDoc, query, where, getDocs, orderBy
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth, type UserProfile } from '../../context/AuthContext';
import { type ClientData } from './ClientList';
import { mergeWithSuperAdmin, PERMANENT_SUPER_ADMIN_MEMBER } from '../../lib/employeeMaster';
import {
  Users, Plus, Search, X, Loader2, Check, Edit2, UserCheck, UserX,
  Mail, Phone, Calendar, Shield, Briefcase, ChevronRight, Star,
  TrendingUp, Clock, AlertTriangle, FileText, Activity, Zap, Sparkles
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────
export interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  designation?: string;
  department?: string;
  joiningDate?: string;
  status: 'Active' | 'Inactive';
  userId?: string;
  monthlySalary?: number;
  skills?: string[];
  weeklyOff?: string;
  notes?: string;
  createdAt: string;
}

const DEPARTMENTS = ['Design', 'Video Editing', 'Marketing', 'Development', 'Operations', 'Sales', 'Management'];
const DESIGNATIONS = ['Graphic Designer', 'Video Editor', 'Social Media Manager', 'Content Writer', 'Account Manager', 'Developer', 'Photographer', 'Team Lead', 'Manager'];

const INITIAL_DEMO_EMPLOYEES: Employee[] = [
  {
    id: 'emp_vansh_01',
    name: 'Vansh Creative Specialist',
    email: 'vansh@digiexplode.ai',
    phone: '+91 87250 72731',
    role: 'employee',
    designation: 'Video Editor',
    department: 'Video Editing',
    joiningDate: '2024-01-10',
    status: 'Active',
    skills: ['Premiere Pro', 'After Effects', 'Reels Production', 'Color Grading'],
    notes: 'Lead video editor and viral hooks producer for healthcare & luxury brands.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'emp_aman_02',
    name: 'Aman Sharma',
    email: 'aman@digiexplode.ai',
    phone: '+91 98140 33445',
    role: 'employee',
    designation: 'Team Lead',
    department: 'Marketing',
    joiningDate: '2024-01-15',
    status: 'Active',
    skills: ['Meta Ads Manager', 'Google Search & PMax', 'ROAS Optimization'],
    notes: 'Direct-response performance marketing lead.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'emp_neha_03',
    name: 'Neha Kapoor',
    email: 'neha@digiexplode.ai',
    phone: '+91 98720 55667',
    role: 'employee',
    designation: 'Graphic Designer',
    department: 'Design',
    joiningDate: '2024-02-01',
    status: 'Active',
    skills: ['Figma', 'Photoshop', 'Illustrator', 'Visual Identity'],
    notes: 'Brand visual identity and high-converting carousel designer.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'emp_rahul_04',
    name: 'Rahul Verma',
    email: 'rahul@digiexplode.ai',
    phone: '+91 98150 77889',
    role: 'employee',
    designation: 'Social Media Manager',
    department: 'Marketing',
    joiningDate: '2024-02-15',
    status: 'Active',
    skills: ['SEO Dominance', 'Local Citations', 'Content Strategy'],
    notes: 'Organic search growth and local maps optimization.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'emp_priya_05',
    name: 'Priya Patel',
    email: 'priya@digiexplode.ai',
    phone: '+91 98765 99001',
    role: 'employee',
    designation: 'Content Writer',
    department: 'Marketing',
    joiningDate: '2024-03-01',
    status: 'Active',
    skills: ['Direct-Response Copywriting', 'Video Scripts', 'Ad Hooks'],
    notes: 'High-conversion copywriter and script architect.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'emp_rohit_06',
    name: 'Rohit Gupta',
    email: 'rohit@digiexplode.ai',
    phone: '+91 98144 11223',
    role: 'employee',
    designation: 'Account Manager',
    department: 'Operations',
    joiningDate: '2024-03-15',
    status: 'Active',
    skills: ['Client Communication', 'Workload Distribution', 'Quality QA'],
    notes: 'Client account manager for enterprise accounts.',
    createdAt: new Date().toISOString(),
  },
];

const inputCls = 'w-full bg-[#F7F8FC] dark:bg-[#171E31] border border-[#D7DEE9] dark:border-[#293248] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#101828] dark:text-[#F7F8FC] placeholder-[#7A8496] outline-none focus:border-[#5B4BFF] dark:focus:border-[#806CFF] transition-all';

// ─── Main Component ───────────────────────────────────────────────────
export const AdminList: React.FC = () => {
  const { profile: currentUser } = useAuth();
  const [employees, setEmployees]     = useState<Employee[]>(() => {
    const cached = localStorage.getItem('digi_local_employees');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return INITIAL_DEMO_EMPLOYEES;
  });
  const [users, setUsers]             = useState<UserProfile[]>([]);
  const [clients, setClients]         = useState<ClientData[]>([]);
  const [loading, setLoading]         = useState(false);
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDept, setFilterDept]   = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState('overview');

  const isAdmin = currentUser?.role === 'superAdmin' || currentUser?.role === 'admin';

  useEffect(() => {
    // syncHandler must always merge SA to prevent it from disappearing when employee list reloads
    const syncHandler = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        const normalized = e.detail.map((item: any) => ({
          ...item,
          id: item.id || item.employeeId,
          designation: item.designation || item.role || 'Specialist',
          department: item.department || 'Operations',
          status: item.status || 'Active',
        }));
        // IMPORTANT: never displace Super Admin from the list
        setEmployees(mergeWithSuperAdmin(normalized) as Employee[]);
      }
    };

    window.addEventListener('digi_employees_sync', syncHandler);
    window.addEventListener('storage', () => {
      try {
        const cached = localStorage.getItem('digi_local_employees');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) syncHandler({ detail: parsed });
        }
      } catch (e) {}
    });

    // Sync with Firestore if available
    try {
      const empUnsub = onSnapshot(collection(db, 'employees'), snap => {
        if (!snap.empty) {
          const firestoreList = snap.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              employeeId: d.id,
              ...data,
              designation: data.designation || data.role || 'Specialist',
              department: data.department || 'Operations',
              status: data.status || 'Active',
            } as unknown as Employee;
          });
          // CRITICAL: merge Super Admin back in — Firestore snapshot must never strip it
          const merged = mergeWithSuperAdmin(firestoreList) as Employee[];
          setEmployees(merged);
          // Only cache the non-SA employees (SA is always injected from code, not stored)
          // But we store merged anyway — getCachedEmployees + mergeWithSuperAdmin in employeeMaster
          // will re-inject if the cache entry is somehow missing
          localStorage.setItem('digi_local_employees', JSON.stringify(merged));
          console.debug('[AdminList] Firestore snap, merged[0]:', merged[0]?.id, 'total:', merged.length);
        }
      }, err => console.warn('Employees Firestore listener fallback to local:', err));

      const usersUnsub = onSnapshot(collection(db, 'users'), snap => {
        if (!snap.empty) {
          setUsers(snap.docs.map(d => ({ userId: d.id, ...d.data() } as UserProfile)));
        }
      }, err => console.warn('Users error:', err));

      const clientsUnsub = onSnapshot(collection(db, 'clients'), snap => {
        if (!snap.empty) {
          setClients(snap.docs.map(d => ({ clientId: d.id, ...d.data() } as ClientData)));
        }
      }, err => console.warn('Clients error:', err));

      return () => {
        window.removeEventListener('digi_employees_sync', syncHandler);
        empUnsub();
        usersUnsub();
        clientsUnsub();
      };
    } catch (e) {
      console.warn('Offline mode for employees registry active.');
    }
  }, []);

  const handleToggleStatus = useCallback(async (emp: Employee) => {
    const newStatus: 'Active' | 'Inactive' = emp.status === 'Active' ? 'Inactive' : 'Active';
    const updated = employees.map(e => e.id === emp.id ? { ...e, status: newStatus } : e);
    setEmployees(updated);
    localStorage.setItem('digi_local_employees', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('digi_employees_sync', { detail: updated }));

    try {
      await setDoc(doc(db, 'employees', emp.id), { status: newStatus, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      // Handled in local state
    }
  }, [employees]);

  const handleAddEmployee = async (newEmp: Omit<Employee, 'id' | 'createdAt'>) => {
    const empId = `emp_${Date.now()}`;
    const created: any = {
      ...newEmp,
      id: empId,
      employeeId: empId,
      designation: newEmp.designation || newEmp.role || 'Specialist',
      role: newEmp.designation || newEmp.role || 'Specialist',
      department: newEmp.department || 'Operations',
      status: newEmp.status || 'Active',
      createdAt: new Date().toISOString(),
    };

    // Append new employee AFTER existing list, keeping Super Admin always at index 0.
    // NEVER prepend at index 0 — that would risk displacing SA and breaking active member detection.
    const existingWithoutNew = employees.filter(e => e.id !== empId);
    const updated = mergeWithSuperAdmin([...existingWithoutNew, created]) as Employee[];
    setEmployees(updated);
    localStorage.setItem('digi_local_employees', JSON.stringify(updated));
    // Broadcast the update — all subscribers get SA-guaranteed list
    window.dispatchEvent(new CustomEvent('digi_employees_sync', { detail: updated }));
    console.debug('[AdminList] Employee created:', empId, '— active member context UNCHANGED');

    try {
      await setDoc(doc(db, 'employees', empId), {
        ...created,
        createdBy: currentUser?.name || 'Super Admin',
      }, { merge: true });
    } catch (e) {
      // Local state fallback preserved
    }
    setShowCreate(false);
  };

  const filtered = employees.filter(e => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.email?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    if (filterDept && e.department !== filterDept) return false;
    return true;
  });

  const activeCount   = employees.filter(e => e.status === 'Active').length;
  const inactiveCount = employees.filter(e => e.status === 'Inactive').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-[#5B4BFF] dark:text-[#806CFF] mb-1 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> People & Agency Team Registry
          </div>
          <h1 className="text-2xl font-black text-[#101828] dark:text-[#F7F8FC] tracking-tight">Employee Registry</h1>
          <p className="text-xs text-[#475467] dark:text-[#BAC1D1] mt-0.5 font-medium">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{activeCount} active specialists</span>
            {inactiveCount > 0 && <span className="text-[#7A8496] dark:text-[#828BA1]"> · {inactiveCount} inactive</span>}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-[#5B4BFF] hover:bg-[#4E3FE6] dark:bg-[#806CFF] dark:hover:bg-[#725DEF] transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-2.5">
        <div className="flex items-center gap-2 bg-[#F7F8FC] dark:bg-[#111728] border border-[#D7DEE9] dark:border-[#293248] rounded-xl px-3.5 py-2 flex-1 min-w-48">
          <Search className="w-3.5 h-3.5 text-[#7A8496]" />
          <input 
            type="text" 
            placeholder="Search by name, email, or role…" 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-xs text-[#101828] dark:text-[#F7F8FC] placeholder-[#7A8496] outline-none w-full" 
          />
        </div>
        
        <select 
          value={filterStatus} 
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-[#F7F8FC] dark:bg-[#111728] border border-[#D7DEE9] dark:border-[#293248] rounded-xl px-3.5 py-2 text-xs font-bold text-[#101828] dark:text-[#F7F8FC] outline-none cursor-pointer"
        >
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

        <select 
          value={filterDept} 
          onChange={e => setFilterDept(e.target.value)}
          className="bg-[#F7F8FC] dark:bg-[#111728] border border-[#D7DEE9] dark:border-[#293248] rounded-xl px-3.5 py-2 text-xs font-bold text-[#101828] dark:text-[#F7F8FC] outline-none cursor-pointer"
        >
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {(search || filterStatus || filterDept) && (
          <button 
            onClick={() => { setSearch(''); setFilterStatus(''); setFilterDept(''); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800/40 hover:bg-rose-100 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Clear Filters
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => <div key={i} className="h-32 rounded-2xl bg-[#D7DEE9]/40 dark:bg-[#293248]/40 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center bg-white dark:bg-[#111728] border border-dashed border-[#D7DEE9] dark:border-[#293248] rounded-2xl">
          <Users className="w-10 h-10 text-[#7A8496]" />
          <p className="text-xs font-bold text-[#101828] dark:text-[#F7F8FC]">No employees match your filter criteria</p>
          <button 
            onClick={() => { setSearch(''); setFilterStatus(''); setFilterDept(''); }}
            className="text-xs font-bold text-[#5B4BFF] dark:text-[#806CFF] hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(emp => (
            <EmployeeCard
              key={emp.id} 
              emp={emp}
              isAdmin={isAdmin}
              onSelect={() => { setSelectedEmployee(emp); setActiveProfileTab('overview'); }}
              onToggle={() => handleToggleStatus(emp)}
            />
          ))}
        </div>
      )}

      {/* User Accounts Section for Super Admin */}
      {currentUser?.role === 'superAdmin' && (
        <UserAccountsSection users={users} clients={clients} />
      )}

      {/* Employee Profile Drawer */}
      {selectedEmployee && (
        <EmployeeProfileDrawer
          emp={selectedEmployee}
          isAdmin={isAdmin}
          activeTab={activeProfileTab}
          setActiveTab={setActiveProfileTab}
          onClose={() => setSelectedEmployee(null)}
          onUpdate={async (updates) => {
            const updated = employees.map(e => e.id === selectedEmployee.id ? { ...e, ...updates } : e);
            setEmployees(updated);
            setSelectedEmployee({ ...selectedEmployee, ...updates });
            localStorage.setItem('digi_local_employees', JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent('digi_employees_sync', { detail: updated }));
            try {
              await updateDoc(doc(db, 'employees', selectedEmployee.id), { ...updates, updatedAt: new Date().toISOString() });
            } catch (e) {}
          }}
        />
      )}

      {/* Create Employee Modal */}
      {showCreate && isAdmin && (
        <CreateEmployeeModal
          onSave={handleAddEmployee}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
};

// ─── EMPLOYEE CARD ────────────────────────────────────────────────────
const EmployeeCard: React.FC<{ emp: Employee; isAdmin: boolean; onSelect: () => void; onToggle: () => void }> = ({ emp, isAdmin, onSelect, onToggle }) => {
  const initials = emp.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const gradients = [
    'from-[#5B4BFF] to-[#2864FF]',
    'from-[#FF5A5F] to-[#FF7A45]',
    'from-[#2864FF] to-[#39D9C6]',
    'from-[#806CFF] to-[#5B4BFF]',
    'from-[#0F887A] to-[#39D9C6]',
  ];
  const grad = gradients[emp.name.charCodeAt(0) % gradients.length];

  return (
    <div
      onClick={onSelect}
      className={`bg-white dark:bg-[#111728] border rounded-2xl p-5 cursor-pointer hover:border-[#5B4BFF]/50 dark:hover:border-[#806CFF]/50 transition-all group shadow-2xs ${emp.status === 'Active' ? 'border-[#D7DEE9] dark:border-[#293248]' : 'border-[#D7DEE9] dark:border-[#293248] opacity-60'}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center text-white font-black text-base flex-shrink-0 shadow-xs`}>
            {initials}
          </div>
          <div>
            <h3 className="text-xs font-black text-[#101828] dark:text-[#F7F8FC] group-hover:text-[#5B4BFF] dark:group-hover:text-[#806CFF] transition-colors">{emp.name}</h3>
            <p className="text-[11px] text-[#475467] dark:text-[#BAC1D1]">{emp.designation || emp.role || 'Specialist'}</p>
            {emp.department && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#EEECFF] text-[#5B4BFF] border border-[#5B4BFF]/20 dark:bg-[#201D45] dark:text-[#806CFF] dark:border-[#806CFF]/30 mt-1 inline-block">
                {emp.department}
              </span>
            )}
          </div>
        </div>
        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${emp.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#171E31] dark:text-[#BAC1D1] dark:border-[#293248]'}`}>
          {emp.status}
        </span>
      </div>

      <div className="mt-4 pt-3 border-t border-[#D7DEE9]/60 dark:border-[#293248] flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-[#7A8496] dark:text-[#828BA1]">
          <Mail className="w-3.5 h-3.5" />
          <span className="truncate max-w-[160px]">{emp.email}</span>
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {isAdmin && (
            <button
              onClick={onToggle}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${emp.status === 'Active' ? 'text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-800/40 dark:hover:bg-rose-950/30' : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800/40 dark:hover:bg-emerald-950/30'}`}
            >
              {emp.status === 'Active' ? 'Deactivate' : 'Activate'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── EMPLOYEE PROFILE DRAWER ──────────────────────────────────────────
interface DrawerProps {
  emp: Employee;
  isAdmin: boolean;
  activeTab: string;
  setActiveTab: (t: string) => void;
  onClose: () => void;
  onUpdate: (updates: Partial<Employee>) => Promise<void>;
}

const PROFILE_TABS = ['overview', 'attendance', 'tasks', 'skills'];

const EmployeeProfileDrawer: React.FC<DrawerProps> = ({ emp, isAdmin, activeTab, setActiveTab, onClose, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Employee>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(form);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/60 backdrop-blur-xs" />
      <div className="w-full max-w-lg bg-white dark:bg-[#111728] border-l border-[#D7DEE9] dark:border-[#293248] h-full overflow-y-auto shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#D7DEE9] dark:border-[#293248] sticky top-0 bg-white dark:bg-[#111728] z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5B4BFF] to-[#2864FF] flex items-center justify-center text-white font-black text-lg shadow-xs">
                {emp.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-base font-black text-[#101828] dark:text-[#F7F8FC]">{emp.name}</h2>
                <p className="text-xs text-[#475467] dark:text-[#BAC1D1]">{emp.designation || emp.role || 'Specialist'} {emp.department && `· ${emp.department}`}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && !editing && (
                <button onClick={() => { setEditing(true); setForm(emp); }}
                  className="p-2 rounded-xl text-[#7A8496] hover:text-[#101828] dark:hover:text-white hover:bg-[#EEF1F6] dark:hover:bg-[#171E31] transition-all cursor-pointer">
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              <button onClick={onClose} className="p-2 rounded-xl text-[#7A8496] hover:text-[#101828] dark:hover:text-white hover:bg-[#EEF1F6] dark:hover:bg-[#171E31] transition-all cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 bg-[#F7F8FC] dark:bg-[#171E31] rounded-xl p-1 border border-[#D7DEE9] dark:border-[#293248]">
            {PROFILE_TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${activeTab === tab ? 'bg-[#5B4BFF] dark:bg-[#806CFF] text-white shadow-xs' : 'text-[#7A8496] dark:text-[#BAC1D1] hover:text-[#101828] dark:hover:text-white'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {/* Edit form */}
          {editing ? (
            <div className="space-y-3.5">
              <h3 className="text-sm font-black text-[#101828] dark:text-[#F7F8FC]">Edit Specialist Profile</h3>
              {[
                { key: 'name', label: 'Full Name', type: 'text' },
                { key: 'email', label: 'Email', type: 'email' },
                { key: 'phone', label: 'Phone', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[10px] font-bold uppercase text-[#7A8496] dark:text-[#828BA1] tracking-wider mb-1">{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className={inputCls} />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-bold uppercase text-[#7A8496] dark:text-[#828BA1] tracking-wider mb-1">Designation</label>
                <select value={form.designation || ''} onChange={e => setForm(p => ({ ...p, designation: e.target.value }))} className={inputCls}>
                  <option value="">Select…</option>
                  {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-[#7A8496] dark:text-[#828BA1] tracking-wider mb-1">Department</label>
                <select value={form.department || ''} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} className={inputCls}>
                  <option value="">Select…</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-[#7A8496] dark:text-[#828BA1] tracking-wider mb-1">Notes</label>
                <textarea value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setEditing(false); setForm({}); }} className="flex-1 py-2 rounded-xl text-xs font-bold text-[#475467] dark:text-[#BAC1D1] border border-[#D7DEE9] dark:border-[#293248] hover:bg-[#EEF1F6] dark:hover:bg-[#171E31] transition-all cursor-pointer">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-xl text-xs font-black text-white bg-[#5B4BFF] hover:bg-[#4E3FE6] dark:bg-[#806CFF] dark:hover:bg-[#725DEF] disabled:opacity-40 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save Changes
                </button>
              </div>
            </div>
          ) : activeTab === 'overview' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Email',       value: emp.email, icon: Mail },
                  { label: 'Phone',       value: emp.phone || '—', icon: Phone },
                  { label: 'Joined',      value: emp.joiningDate || '2024-01-15', icon: Calendar },
                  { label: 'Status',      value: emp.status, icon: UserCheck },
                  { label: 'Department',  value: emp.department || '—', icon: Briefcase },
                  { label: 'Designation', value: emp.designation || emp.role || '—', icon: Shield },
                ].map(m => (
                  <div key={m.label} className="bg-[#F7F8FC] dark:bg-[#171E31] border border-[#D7DEE9] dark:border-[#293248] rounded-xl p-3.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <m.icon className="w-3.5 h-3.5 text-[#5B4BFF] dark:text-[#806CFF]" />
                      <p className="text-[10px] font-bold uppercase text-[#7A8496] dark:text-[#828BA1] tracking-wider">{m.label}</p>
                    </div>
                    <p className="text-xs font-bold text-[#101828] dark:text-[#F7F8FC] truncate">{m.value}</p>
                  </div>
                ))}
              </div>
              {emp.notes && (
                <div className="bg-[#EEECFF] dark:bg-[#201D45] border border-[#5B4BFF]/20 dark:border-[#806CFF]/30 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-[#5B4BFF] dark:text-[#806CFF] uppercase tracking-wider mb-1">Specialist Notes</p>
                  <p className="text-xs text-[#101828] dark:text-[#F7F8FC] leading-relaxed">{emp.notes}</p>
                </div>
              )}
            </div>
          ) : activeTab === 'attendance' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">22</p>
                  <p className="text-[10px] uppercase text-emerald-600 dark:text-emerald-400 font-bold">Present</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-amber-700 dark:text-amber-300">1</p>
                  <p className="text-[10px] uppercase text-amber-600 dark:text-amber-400 font-bold">Late</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-purple-700 dark:text-purple-300">0</p>
                  <p className="text-[10px] uppercase text-purple-600 dark:text-purple-400 font-bold">Leave</p>
                </div>
              </div>
              <p className="text-xs text-[#475467] dark:text-[#BAC1D1]">Recorded 98.4% punctual attendance this calendar quarter.</p>
            </div>
          ) : activeTab === 'skills' ? (
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#475467] dark:text-[#BAC1D1] uppercase tracking-wider mb-2">Core Competencies</p>
              <div className="flex flex-wrap gap-2">
                {(emp.skills || ['Performance Marketing', 'Creative Production', 'Brand Strategy']).map(s => (
                  <span key={s} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#EEECFF] text-[#5B4BFF] border border-[#5B4BFF]/20 dark:bg-[#201D45] dark:text-[#806CFF] dark:border-[#806CFF]/30">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// ─── CREATE EMPLOYEE MODAL ────────────────────────────────────────────
const CreateEmployeeModal: React.FC<{ onSave: (emp: any) => Promise<void>; onClose: () => void }> = ({ onSave, onClose }) => {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', designation: 'Graphic Designer', department: 'Design',
    joiningDate: new Date().toISOString().split('T')[0], notes: '', status: 'Active' as const,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in-50" onClick={onClose}>
      <div className="bg-white dark:bg-[#111728] border border-[#D7DEE9] dark:border-[#293248] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D7DEE9] dark:border-[#293248]">
          <h2 className="text-base font-black text-[#101828] dark:text-[#F7F8FC] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#5B4BFF] dark:text-[#806CFF]" /> Add Team Member
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#7A8496] hover:text-[#101828] dark:hover:text-white hover:bg-[#EEF1F6] dark:hover:bg-[#171E31] transition-all cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          {[
            { key: 'name', label: 'Full Name *', type: 'text', placeholder: 'e.g. Vikram Singhania' },
            { key: 'email', label: 'Email *', type: 'email', placeholder: 'vikram@digiexplode.ai' },
            { key: 'phone', label: 'Phone', type: 'text', placeholder: '+91 98765 43210' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-[10px] font-bold uppercase text-[#7A8496] dark:text-[#828BA1] tracking-wider mb-1.5">{f.label}</label>
              <input 
                required={f.label.includes('*')} 
                type={f.type} 
                placeholder={f.placeholder}
                value={(form as any)[f.key]} 
                onChange={e => set(f.key, e.target.value)} 
                className={inputCls} 
              />
            </div>
          ))}
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-[#7A8496] dark:text-[#828BA1] tracking-wider mb-1.5">Designation</label>
              <select 
                value={form.designation} 
                onChange={e => set('designation', e.target.value)} 
                className={`${inputCls} cursor-pointer`}
              >
                {DESIGNATIONS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-[#7A8496] dark:text-[#828BA1] tracking-wider mb-1.5">Department</label>
              <select 
                value={form.department} 
                onChange={e => set('department', e.target.value)} 
                className={`${inputCls} cursor-pointer`}
              >
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-[#7A8496] dark:text-[#828BA1] tracking-wider mb-1.5">Joining Date</label>
            <input 
              type="date" 
              value={form.joiningDate} 
              onChange={e => set('joiningDate', e.target.value)} 
              className={inputCls} 
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-[#7A8496] dark:text-[#828BA1] tracking-wider mb-1.5">Notes & Skills</label>
            <textarea 
              value={form.notes} 
              placeholder="e.g. Meta Ads, Video Production, Client handling..."
              onChange={e => set('notes', e.target.value)} 
              rows={2} 
              className={`${inputCls} resize-none`} 
            />
          </div>

          <div className="flex gap-3 pt-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-[#475467] dark:text-[#BAC1D1] border border-[#D7DEE9] dark:border-[#293248] hover:bg-[#EEF1F6] dark:hover:bg-[#171E31] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saving || !form.name || !form.email}
              className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-[#5B4BFF] hover:bg-[#4E3FE6] dark:bg-[#806CFF] dark:hover:bg-[#725DEF] disabled:opacity-40 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Add Employee
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── USER ACCOUNTS SECTION (super admin only) ─────────────────────────
const UserAccountsSection: React.FC<{ users: UserProfile[]; clients: ClientData[] }> = ({ users }) => {
  const roleColors: Record<string, string> = {
    superAdmin: 'bg-[#6C4CFF]/15 text-[#6C4CFF] border-[#6C4CFF]/30',
    admin:      'bg-[#2563FF]/15 text-[#2563FF] border-[#2563FF]/30',
    employee:   'bg-[#39D9C6]/15 text-[#39D9C6] border-[#39D9C6]/30',
    client:     'bg-[#B8F36B]/15 text-[#B8F36B] border-[#B8F36B]/30',
  };

  return (
    <div className="mt-10">
      <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
        <Shield className="w-3.5 h-3.5 text-[#6C4CFF]" /> Portal Security & Fast-Track Permissions (Super Admin View)
      </h2>
      <div className="border border-white/10 rounded-2xl overflow-hidden bg-[#15192B]">
        {users.length === 0 ? (
          <div className="p-4 text-xs text-slate-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#6C4CFF]" /> Super Admin master console active. All agency modules unlocked.
          </div>
        ) : (
          users.map((user, i) => (
            <div key={user.userId} className={`flex items-center gap-4 px-4 py-3 hover:bg-white/3 transition-all ${i < users.length - 1 ? 'border-b border-white/5' : ''}`}>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6C4CFF] to-[#2563FF] flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-200 truncate">{user.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${roleColors[user.role] || roleColors.client}`}>
                {user.role}
              </span>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${user.status === 'active' ? 'bg-[#B8F36B]/15 text-[#B8F36B]' : 'bg-rose-500/10 text-rose-400'}`}>
                {user.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminList;
