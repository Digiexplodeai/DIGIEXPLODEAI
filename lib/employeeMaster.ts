import { 
  collection, 
  doc, 
  getDocs, 
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { type Employee } from '../components/Portal/AttendanceView';

export interface MasterEmployee extends Employee {
  id: string;
}
export type CanonicalEmployee = MasterEmployee;

export const CENTRAL_EMPLOYEES_MASTER_LIST: MasterEmployee[] = [
  {
    id: 'emp_superadmin',
    employeeId: 'emp_superadmin',
    name: 'Digiexplode Super Admin',
    email: 'admin@digiexplode.ai',
    phone: '+91 87250 72730',
    role: 'Super Admin / Managing Director',
    department: 'Leadership & Executive',
    joiningDate: '2024-01-01',
    status: 'Active',
    monthlySalary: 250000,
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 'emp_1',
    employeeId: 'emp_1',
    name: 'Aman Sharma',
    email: 'aman@digiexplode.ai',
    phone: '+91 98000 22222',
    role: 'Performance Marketer',
    department: 'Growth & Ads',
    joiningDate: '2024-01-15',
    status: 'Active',
    monthlySalary: 65000,
    createdAt: '2024-01-15T00:00:00.000Z'
  },
  {
    id: 'emp_2',
    employeeId: 'emp_2',
    name: 'Neha Gupta',
    email: 'neha@digiexplode.ai',
    phone: '+91 98000 33333',
    role: 'Senior Video Editor',
    department: 'Creative Production',
    joiningDate: '2024-02-01',
    status: 'Active',
    monthlySalary: 60000,
    createdAt: '2024-02-01T00:00:00.000Z'
  },
  {
    id: 'emp_3',
    employeeId: 'emp_3',
    name: 'Rahul Verma',
    email: 'rahul@digiexplode.ai',
    phone: '+91 98000 44444',
    role: 'Full Stack & SEO Lead',
    department: 'Engineering',
    joiningDate: '2024-02-15',
    status: 'Active',
    monthlySalary: 75000,
    createdAt: '2024-02-15T00:00:00.000Z'
  },
  {
    id: 'emp_4',
    employeeId: 'emp_4',
    name: 'Priya Singh',
    email: 'priya@digiexplode.ai',
    phone: '+91 98000 55555',
    role: 'Creative Visual Designer',
    department: 'Design & Branding',
    joiningDate: '2024-03-01',
    status: 'Active',
    monthlySalary: 55000,
    createdAt: '2024-03-01T00:00:00.000Z'
  },
  {
    id: 'emp_5',
    employeeId: 'emp_5',
    name: 'Vansh',
    email: 'vansh@digiexplode.ai',
    phone: '+91 98000 11111',
    role: 'Creative Specialist',
    department: 'Executive',
    joiningDate: '2024-01-01',
    status: 'Active',
    monthlySalary: 150000,
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 'emp_6',
    employeeId: 'emp_6',
    name: 'Rohit Kumar',
    email: 'rohit@digiexplode.ai',
    phone: '+91 98000 66666',
    role: 'Content Strategist',
    department: 'Copy & Social',
    joiningDate: '2024-03-10',
    status: 'Active',
    monthlySalary: 50000,
    createdAt: '2024-03-10T00:00:00.000Z'
  }
];

export const DEFAULT_EMPLOYEES_MASTER = CENTRAL_EMPLOYEES_MASTER_LIST;
export const LOCAL_STORAGE_EMPLOYEES_KEY = 'digi_local_employees';

let isEmployeeSeedingCompleted = false;

/**
 * PERMANENT SUPER ADMIN MEMBER — the canonical, stable Super Admin entry.
 * Always constructed from the hardcoded master, never from Firestore or localStorage.
 * This is the source of truth for Super Admin identity.
 */
export const PERMANENT_SUPER_ADMIN_MEMBER: MasterEmployee = CENTRAL_EMPLOYEES_MASTER_LIST[0]; // emp_superadmin

/**
 * Merges any employee list so that emp_superadmin is ALWAYS first.
 * Deduplicates by id/employeeId. Does NOT mutate the input array.
 * This guarantees Super Admin can never be displaced by Firestore updates.
 */
export function mergeWithSuperAdmin<T extends Record<string, any>>(employees: T[]): T[] {
  // Filter out any existing super-admin entries (may come from Firestore if seeded)
  const withoutSuperAdmin = employees.filter(
    e => e.id !== 'emp_superadmin' && e.employeeId !== 'emp_superadmin'
  );
  return [PERMANENT_SUPER_ADMIN_MEMBER as unknown as T, ...withoutSuperAdmin];
}

/**
 * Loads cached employees immediately from local storage.
 * ALWAYS includes emp_superadmin as the first entry regardless of what is cached.
 */
export const getCachedEmployees = (): MasterEmployee[] => {
  if (typeof window === 'undefined') return DEFAULT_EMPLOYEES_MASTER;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EMPLOYEES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed.map((item: any) => ({
          ...item,
          employeeId: item.employeeId || item.id,
          id: item.employeeId || item.id,
          name: item.name || item.fullName || 'Employee',
          role: item.role || item.designation || 'Team Member',
          status: item.status || 'Active'
        }));
        // Super Admin must always be present — merge guarantees it
        return mergeWithSuperAdmin(normalized);
      }
    }
  } catch (e) {
    console.warn('Could not read cached employees:', e);
  }
  return DEFAULT_EMPLOYEES_MASTER;
};

/**
 * Updates local cache with full employees list
 */
export const setCachedEmployees = (employees: MasterEmployee[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_EMPLOYEES_KEY, JSON.stringify(employees));
  } catch (e) {
    console.warn('Could not write cached employees:', e);
  }
};

/**
 * Ensures all agency employees are seeded into Firestore.
 */
export async function ensureCentralEmployeesSeeded(): Promise<void> {
  if (isEmployeeSeedingCompleted) return;
  
  try {
    const empRef = collection(db, 'employees');
    const snapshot = await getDocs(empRef);
    
    const existingById = new Set<string>();
    const existingByName = new Set<string>();
    
    snapshot.forEach((docSnap) => {
      existingById.add(docSnap.id);
      const data = docSnap.data();
      if (data.name) existingByName.add(data.name.trim().toLowerCase());
    });

    const seedingPromises: Promise<void>[] = [];
    for (const masterEmp of CENTRAL_EMPLOYEES_MASTER_LIST) {
      const normalizedName = masterEmp.name.trim().toLowerCase();
      if (!existingById.has(masterEmp.employeeId) && !existingByName.has(normalizedName)) {
        seedingPromises.push(
          setDoc(doc(db, 'employees', masterEmp.employeeId), masterEmp, { merge: true })
        );
      }
    }

    if (seedingPromises.length > 0) {
      await Promise.all(seedingPromises);
    }
    isEmployeeSeedingCompleted = true;
  } catch (error) {
    console.warn('Central employees seeding notice (offline or permission wait):', error);
  }
}

/**
 * Subscribes to live Firestore employees collection with automatic fallback & instant cache hydration.
 * GUARANTEE: emp_superadmin is ALWAYS first in every emitted list, regardless of Firestore contents.
 * Creating/deleting employees in Firestore will NEVER remove or displace the Super Admin member.
 */
export function subscribeToCanonicalEmployees(
  onUpdate: (employees: MasterEmployee[]) => void,
  onError?: (err: any) => void
): () => void {
  // 1. Emit initial cached employees immediately — mergeWithSuperAdmin guarantees SA is first
  const initial = mergeWithSuperAdmin(getCachedEmployees());
  console.debug('[employeeMaster] initial emit, member[0]:', initial[0]?.id, 'total:', initial.length);
  onUpdate(initial);

  // 2. Trigger non-blocking seed
  ensureCentralEmployeesSeeded().catch(e => console.warn('Employee seed notice:', e));

  // 3. Firestore snapshot listener
  const unsub = onSnapshot(collection(db, 'employees'), (snapshot) => {
    if (!snapshot.empty) {
      const firestoreList: MasterEmployee[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const empId = d.employeeId || docSnap.id;
        firestoreList.push({
          id: empId,
          employeeId: empId,
          name: d.name || d.fullName || 'Employee',
          email: d.email || '',
          phone: d.phone || '',
          role: d.role || d.designation || 'Team Member',
          department: d.department || 'Creative Operations',
          joiningDate: d.joiningDate || new Date().toISOString().split('T')[0],
          status: (d.status === 'Inactive' ? 'Inactive' : 'Active') as 'Active' | 'Inactive',
          monthlySalary: typeof d.monthlySalary === 'number' ? d.monthlySalary : 50000,
          createdAt: d.createdAt || new Date().toISOString()
        });
      });

      if (firestoreList.length > 0) {
        // CRITICAL: Always merge Super Admin in — Firestore list must never displace it
        const merged = mergeWithSuperAdmin(firestoreList);
        setCachedEmployees(merged);
        console.debug('[employeeMaster] Firestore update, member[0]:', merged[0]?.id, 'total:', merged.length);
        onUpdate(merged);
        return;
      }
    }

    // Empty Firestore or quota exceeded — always guarantee SA in fallback
    const cached = getCachedEmployees(); // getCachedEmployees already merges SA
    onUpdate(cached.length > 0 ? cached : DEFAULT_EMPLOYEES_MASTER);
  }, (err) => {
    console.warn('Employees listener note (using resilient local cache):', err);
    const cached = getCachedEmployees(); // getCachedEmployees already merges SA
    onUpdate(cached.length > 0 ? cached : DEFAULT_EMPLOYEES_MASTER);
    if (onError) onError(err);
  });

  return unsub;
}

export const EMPLOYEE_ID_ALIASES: Record<string, string> = {
  'demo-super-admin-01': 'emp_superadmin',
  'emp_superadmin': 'demo-super-admin-01',
  'superAdmin': 'emp_superadmin',
  'admin': 'emp_superadmin',
  'emp_admin': 'emp_superadmin',
  'superadmin': 'emp_superadmin',
  'emp_vansh_01': 'emp_5',
  'emp_5': 'emp_vansh_01',
  'emp_aman_02': 'emp_1',
  'emp_1': 'emp_aman_02',
  'emp_neha_03': 'emp_2',
  'emp_2': 'emp_neha_03',
  'emp_rahul_04': 'emp_3',
  'emp_3': 'emp_rahul_04',
  'emp_priya_05': 'emp_4',
  'emp_4': 'emp_priya_05',
  'emp_rohit_06': 'emp_6',
  'emp_6': 'emp_rohit_06',
};

/**
 * Normalizes any timestamp representation into a standard JS Date.
 * Supports: Firebase Timestamp, ISO string, JS Date, YYYY-MM-DD, MM/DD/YYYY, millisecond numbers.
 */
export function normalizeDate(input: any): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  
  // Firebase Timestamp object (with toDate method)
  if (typeof input.toDate === 'function') {
    try {
      const d = input.toDate();
      if (!isNaN(d.getTime())) return d;
    } catch {}
  }

  // Firestore timestamp with seconds
  if (typeof input.seconds === 'number') {
    const d = new Date(input.seconds * 1000 + (input.nanoseconds ? Math.floor(input.nanoseconds / 1000000) : 0));
    if (!isNaN(d.getTime())) return d;
  }

  // Numeric epoch
  if (typeof input === 'number') {
    const d = new Date(input);
    if (!isNaN(d.getTime())) return d;
  }

  // String representation
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return null;

    // YYYY-MM-DD or YYYY-MM
    if (/^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{4}-\d{2}/.test(s)) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    }

    // MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
      const parts = s.split('/');
      const d = new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
      if (!isNaN(d.getTime())) return d;
    }

    // General ISO parse
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

/**
 * Checks whether a given timestamp falls within the [startOfMonth, startOfNextMonth) range.
 * selectedMonth format: "YYYY-MM" (e.g. "2026-09")
 */
export function isTimestampInMonthRange(input: any, selectedMonth: string): boolean {
  if (!input || !selectedMonth) return false;
  
  if (typeof input === 'string' && input.startsWith(selectedMonth)) {
    return true;
  }

  const d = normalizeDate(input);
  if (!d) return false;

  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed

  const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
  const startOfNextMonth = new Date(year, month + 1, 1, 0, 0, 0, 0);

  return d.getTime() >= startOfMonth.getTime() && d.getTime() < startOfNextMonth.getTime();
}

export function matchEmployeeToRecord(
  emp: { id: string; employeeId?: string; name?: string },
  record: {
    employeeId?: string;
    employee_id?: string;
    assigneeId?: string;
    assignee_id?: string;
    userId?: string;
    user_id?: string;
    assignedTo?: string;
    employeeName?: string;
    employee_name?: string;
    assigneeName?: string;
    name?: string;
  },
  allEmployees: { id: string; name: string }[]
): boolean {
  const targetId = emp.id || emp.employeeId;
  const rawId = record.employeeId || record.employee_id || record.assigneeId || record.assignee_id || record.userId || record.user_id || record.assignedTo;
  
  if (rawId) {
    if (rawId === targetId || rawId === emp.employeeId || rawId === emp.id) return true;
    if (EMPLOYEE_ID_ALIASES[rawId] === targetId || EMPLOYEE_ID_ALIASES[rawId] === emp.employeeId) return true;
    if (EMPLOYEE_ID_ALIASES[targetId] === rawId) return true;
  }

  // Safe fallback by name only if unique in master set
  const rawName = record.employeeName || record.employee_name || record.assigneeName || record.name;
  if (rawName && emp.name) {
    const normalizedRaw = rawName.trim().toLowerCase();
    const normalizedEmp = emp.name.trim().toLowerCase();
    
    if (normalizedRaw === normalizedEmp) {
      const matches = allEmployees.filter(e => e.name.trim().toLowerCase() === normalizedRaw);
      if (matches.length <= 1) return true;
    }
  }

  return false;
}

/**
 * Resolves the logged-in Agency OS user to the canonical employee record.
 * Checks authenticated currentUser.uid, user profile, email, name, and ID aliases.
 */
export function resolveCurrentEmployee(
  user: { uid?: string; email?: string | null; displayName?: string | null } | null | undefined,
  profile: { userId?: string; name?: string; email?: string; role?: string } | null | undefined,
  employeesList: MasterEmployee[] = CENTRAL_EMPLOYEES_MASTER_LIST
): MasterEmployee | null {
  const masterList = employeesList && employeesList.length > 0 ? employeesList : CENTRAL_EMPLOYEES_MASTER_LIST;
  
  const authUid = user?.uid || profile?.userId;
  const userEmail = (user?.email || profile?.email || '').trim().toLowerCase();
  const userName = (profile?.name || user?.displayName || '').trim().toLowerCase();
  const userRole = profile?.role;

  // 1. Super Admin resolution
  if (userRole === 'superAdmin' || userRole === 'admin' || userName.includes('super admin') || userEmail.includes('admin@digiexplode.ai')) {
    const superAdminEmp = masterList.find(e => 
      e.id === 'emp_superadmin' || 
      e.employeeId === 'emp_superadmin' || 
      e.name.toLowerCase().includes('super admin') ||
      e.email.toLowerCase() === 'admin@digiexplode.ai'
    );
    if (superAdminEmp) return superAdminEmp;
  }

  // 2. Direct match by email
  if (userEmail) {
    const matchedByEmail = masterList.find(e => e.email?.trim().toLowerCase() === userEmail);
    if (matchedByEmail) return matchedByEmail;

    // Email prefix matching (e.g. vansh@... -> Vansh)
    const emailPrefix = userEmail.split('@')[0];
    const matchedByPrefix = masterList.find(e => 
      e.name?.trim().toLowerCase().includes(emailPrefix) || 
      emailPrefix.includes(e.name?.trim().toLowerCase())
    );
    if (matchedByPrefix) return matchedByPrefix;
  }

  // 3. Match by ID / employeeId / alias / auth_uid
  if (authUid) {
    const matchedById = masterList.find(e => 
      e.id === authUid || 
      e.employeeId === authUid || 
      (e as any).auth_uid === authUid || 
      (e as any).userId === authUid ||
      EMPLOYEE_ID_ALIASES[authUid] === e.id ||
      EMPLOYEE_ID_ALIASES[authUid] === e.employeeId
    );
    if (matchedById) return matchedById;
  }

  // 4. Match by name
  if (userName) {
    const exactNameMatch = masterList.find(e => e.name?.trim().toLowerCase() === userName);
    if (exactNameMatch) return exactNameMatch;

    const words = userName.split(/\s+/).filter(w => w.length > 2);
    for (const word of words) {
      if (['admin', 'super', 'user', 'team', 'member', 'specialist'].includes(word)) continue;
      const matched = masterList.find(e => e.name?.trim().toLowerCase().includes(word));
      if (matched) return matched;
    }
  }

  // 5. Match if user has employee role or employee name
  if (profile?.role === 'employee' || userName.includes('employee') || userName.includes('vansh')) {
    const vanshEmp = masterList.find(e => e.id === 'emp_5' || e.name.toLowerCase().includes('vansh'));
    if (vanshEmp) return vanshEmp;
  }

  return masterList[0] || null;
}

/**
 * Verifies whether a canonical task is assigned to a specific employee.
 * Strictly checks assigned_employee_id and ID aliases.
 * NEVER does loose substring name comparisons.
 */
export function isTaskAssignedToEmployee(
  task: {
    assigneeId?: string;
    assignee_id?: string;
    assigned_employee_id?: string;
    employee_id?: string;
    assignedTo?: string;
    assigneeName?: string;
    assignee_name?: string;
  } | null | undefined,
  employee: MasterEmployee | string | null | undefined
): boolean {
  if (!task || !employee) return false;
  
  const targetId = (typeof employee === 'string' ? employee : (employee.id || employee.employeeId || '')).trim();
  if (!targetId || targetId === 'unassigned') return false;

  const rawTaskId = (
    task.assigned_employee_id || 
    task.assigneeId || 
    task.employee_id || 
    task.assignee_id || 
    task.assignedTo || 
    ''
  ).trim();

  if (!rawTaskId || rawTaskId === 'unassigned') return false;

  // Direct ID match
  if (rawTaskId === targetId) return true;

  // Canonical ID aliases (e.g. emp_aman_02 <-> emp_1, emp_vansh_01 <-> emp_5)
  if (EMPLOYEE_ID_ALIASES[rawTaskId] === targetId) return true;
  if (EMPLOYEE_ID_ALIASES[targetId] === rawTaskId) return true;

  return false;
}

export const LOCAL_STORAGE_VIEW_AS_KEY = 'digi_view_as_emp_id';

/**
 * Gets currently active View-As employee ID from local storage
 */
export function getViewAsEmployeeId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LOCAL_STORAGE_VIEW_AS_KEY);
}

/**
 * Sets View-As employee ID in local storage and broadcasts change
 */
export function setViewAsEmployeeId(empId: string | null) {
  if (typeof window === 'undefined') return;
  if (empId) {
    localStorage.setItem(LOCAL_STORAGE_VIEW_AS_KEY, empId);
  } else {
    localStorage.removeItem(LOCAL_STORAGE_VIEW_AS_KEY);
  }
  window.dispatchEvent(new Event('digi_view_as_changed'));
}



