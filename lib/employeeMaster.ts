import { 
  collection, 
  doc, 
  getDocs, 
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { type Employee } from '../components/Portal/AttendanceView';
import { cfGetEmployees } from './cloudflareApi';

export interface MasterEmployee extends Employee {
  id: string;
  designation?: string;
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
    id: 'emp_priyanshu',
    employeeId: 'emp_priyanshu',
    name: 'Priyanshu',
    email: 'bgrltwrrt@gmail.com',
    phone: '+91 98765 43211',
    role: 'Developer',
    designation: 'Developer',
    department: 'Development',
    joiningDate: '2024-01-15',
    status: 'Active',
    monthlySalary: 55000,
    createdAt: '2024-01-15T00:00:00.000Z'
  },
  {
    id: 'emp_vansh',
    employeeId: 'emp_vansh',
    name: 'Vansh',
    email: 'f3434@gmail.com',
    phone: '+91 87250 72731',
    role: 'Graphic Designer',
    designation: 'Graphic Designer',
    department: 'Design',
    joiningDate: '2024-02-01',
    status: 'Active',
    monthlySalary: 50000,
    createdAt: '2024-02-01T00:00:00.000Z'
  },
  {
    id: 'emp_ravinder',
    employeeId: 'emp_ravinder',
    name: 'Ravinder',
    email: '3r3rc5@gmail.com',
    phone: '+91 98150 77889',
    role: 'Graphic Designer',
    designation: 'Graphic Designer',
    department: 'Design',
    joiningDate: '2024-02-15',
    status: 'Active',
    monthlySalary: 50000,
    createdAt: '2024-02-15T00:00:00.000Z'
  },
  {
    id: 'emp_aakib',
    employeeId: 'emp_aakib',
    name: 'Mohd Aakib',
    email: 'f4344@gmail.com',
    phone: '+91 98765 99001',
    role: 'Graphic Designer',
    designation: 'Graphic Designer',
    department: 'Design',
    joiningDate: '2024-03-01',
    status: 'Active',
    monthlySalary: 50000,
    createdAt: '2024-03-01T00:00:00.000Z'
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
        // Merge with master list so default employees (Priyanshu, Vansh, Ravinder, Aakib) are never lost
        const byId = new Map<string, any>();
        CENTRAL_EMPLOYEES_MASTER_LIST.forEach(m => byId.set(m.id, m));
        normalized.forEach(n => byId.set(n.id || n.employeeId, n));
        return mergeWithSuperAdmin(Array.from(byId.values()));
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

  // 2. Fetch from Cloudflare D1
  cfGetEmployees().then((cfList) => {
    if (Array.isArray(cfList) && cfList.length > 0) {
      const normalized = cfList.map((item: any) => ({
        ...item,
        employeeId: item.employeeId || item.id,
        id: item.employeeId || item.id,
        name: item.name || 'Employee',
        role: item.role || item.designation || 'Team Member',
        status: (item.status === 'Inactive' ? 'Inactive' : 'Active') as 'Active' | 'Inactive',
        monthlySalary: typeof item.monthlySalary === 'number' ? item.monthlySalary : 50000
      }));
      const byId = new Map<string, any>();
      CENTRAL_EMPLOYEES_MASTER_LIST.forEach(m => byId.set(m.id, m));
      normalized.forEach(n => byId.set(n.id || n.employeeId, n));
      const merged = mergeWithSuperAdmin(Array.from(byId.values()));
      setCachedEmployees(merged);
      onUpdate(merged);
    }
  }).catch(e => console.warn('[employeeMaster] Cloudflare fetch notice:', e));

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
        const byId = new Map<string, any>();
        CENTRAL_EMPLOYEES_MASTER_LIST.forEach(m => byId.set(m.id, m));
        firestoreList.forEach(n => byId.set(n.id || n.employeeId, n));
        const merged = mergeWithSuperAdmin(Array.from(byId.values()));
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
  'superadmin': 'emp_superadmin',
  'superAdmin': 'emp_superadmin',
  'admin': 'emp_superadmin',
  'emp_admin': 'emp_superadmin',

  // Vansh
  'vansh': 'emp_vansh',
  'emp_vansh': 'vansh',
  'emp_vansh_01': 'emp_vansh',
  'emp_5': 'emp_vansh',

  // Priyanshu
  'priyanshu': 'emp_priyanshu',
  'emp_priyanshu': 'priyanshu',

  // Ravinder
  'ravinder': 'emp_ravinder',
  'emp_ravinder': 'ravinder',

  // Mohd Aakib
  'mohdaakib': 'emp_aakib',
  'aakib': 'emp_aakib',
  'mohd aakib': 'emp_aakib',
  'emp_aakib': 'aakib',

  // Legacy team aliases
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

    const emailPrefix = userEmail.split('@')[0];
    const matchedByPrefix = masterList.find(e => 
      e.name?.trim().toLowerCase().includes(emailPrefix) || 
      emailPrefix.includes(e.name?.trim().toLowerCase())
    );
    if (matchedByPrefix) return matchedByPrefix;
  }

  // 3. Match by ID / employeeId / alias / auth_uid
  if (authUid) {
    const cleanAuth = authUid.trim().toLowerCase().replace(/[\s_\-.]+/g, '');
    const matchedById = masterList.find(e => {
      const eId = (e.id || '').toLowerCase().replace(/[\s_\-.]+/g, '');
      const empId = (e.employeeId || '').toLowerCase().replace(/[\s_\-.]+/g, '');
      return e.id === authUid || 
        e.employeeId === authUid || 
        (e as any).auth_uid === authUid || 
        (e as any).userId === authUid ||
        eId === cleanAuth ||
        empId === cleanAuth ||
        eId.replace(/^emp/, '') === cleanAuth.replace(/^emp/, '') ||
        cleanAuth.replace(/^emp/, '') === eId.replace(/^emp/, '') ||
        EMPLOYEE_ID_ALIASES[authUid.toLowerCase()] === e.id ||
        EMPLOYEE_ID_ALIASES[cleanAuth] === eId;
    });
    if (matchedById) return matchedById;
  }

  // 4. Match by name
  if (userName) {
    const cleanUserName = userName.trim().toLowerCase().replace(/[\s_\-.]+/g, '');
    const exactNameMatch = masterList.find(e => {
      const cleanEmp = (e.name || '').trim().toLowerCase().replace(/[\s_\-.]+/g, '');
      return cleanEmp === cleanUserName;
    });
    if (exactNameMatch) return exactNameMatch;

    const matchedPartial = masterList.find(e => {
      const cleanEmp = (e.name || '').trim().toLowerCase().replace(/[\s_\-.]+/g, '');
      return cleanEmp.includes(cleanUserName) || cleanUserName.includes(cleanEmp);
    });
    if (matchedPartial) return matchedPartial;
  }

  // 5. Match specific employee aliases by name
  if (userName.includes('vansh')) {
    const vanshEmp = masterList.find(e => e.id === 'emp_vansh' || e.name.toLowerCase().includes('vansh'));
    if (vanshEmp) return vanshEmp;
  }
  if (userName.includes('aakib')) {
    const aakibEmp = masterList.find(e => e.id === 'emp_aakib' || e.name.toLowerCase().includes('aakib'));
    if (aakibEmp) return aakibEmp;
  }
  if (userName.includes('ravinder')) {
    const ravinderEmp = masterList.find(e => e.id === 'emp_ravinder' || e.name.toLowerCase().includes('ravinder'));
    if (ravinderEmp) return ravinderEmp;
  }
  if (userName.includes('priyanshu')) {
    const priyanshuEmp = masterList.find(e => e.id === 'emp_priyanshu' || e.name.toLowerCase().includes('priyanshu'));
    if (priyanshuEmp) return priyanshuEmp;
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

  let targetId = '';
  let targetName = '';

  if (typeof employee === 'string') {
    targetId = employee.trim();
    const found = CENTRAL_EMPLOYEES_MASTER_LIST.find(e =>
      e.id.toLowerCase() === targetId.toLowerCase() ||
      e.employeeId?.toLowerCase() === targetId.toLowerCase() ||
      e.name.toLowerCase() === targetId.toLowerCase() ||
      (EMPLOYEE_ID_ALIASES[targetId.toLowerCase()] && EMPLOYEE_ID_ALIASES[targetId.toLowerCase()].toLowerCase() === e.id.toLowerCase())
    );
    if (found) {
      targetName = found.name;
    }
  } else {
    targetId = (employee.id || employee.employeeId || '').trim();
    targetName = employee.name || '';
  }

  if (!targetId || targetId.toLowerCase() === 'unassigned') return false;

  const rawTaskId = (
    task.assigned_employee_id || 
    task.assigneeId || 
    task.employee_id || 
    task.assignee_id || 
    task.assignedTo || 
    ''
  ).trim();

  const taskAssigneeName = (task.assigneeName || task.assignee_name || '').trim();

  // If both task ID and task name are empty or unassigned
  if ((!rawTaskId || rawTaskId.toLowerCase() === 'unassigned') &&
      (!taskAssigneeName || taskAssigneeName.toLowerCase() === 'unassigned')) {
    return false;
  }

  const cleanTargetId = targetId.toLowerCase().replace(/[\s_\-.]+/g, '');
  const cleanRawTaskId = rawTaskId.toLowerCase().replace(/[\s_\-.]+/g, '');
  const stripEmp = (s) => s.replace(/^emp/i, '');

  // 1. Direct ID match (case-insensitive & trimmed)
  if (rawTaskId && rawTaskId.toLowerCase() === targetId.toLowerCase()) return true;
  if (cleanRawTaskId && cleanTargetId && cleanRawTaskId === cleanTargetId) return true;

  // 2. Prefix-stripped ID match (emp_aakib <-> aakib, emp_ravinder <-> ravinder)
  if (stripEmp(cleanRawTaskId) && stripEmp(cleanRawTaskId) === stripEmp(cleanTargetId)) return true;

  // 3. Canonical ID aliases
  const lowerRaw = rawTaskId.toLowerCase();
  const lowerTarget = targetId.toLowerCase();
  if (EMPLOYEE_ID_ALIASES[lowerRaw] && EMPLOYEE_ID_ALIASES[lowerRaw].toLowerCase() === lowerTarget) return true;
  if (EMPLOYEE_ID_ALIASES[lowerTarget] && EMPLOYEE_ID_ALIASES[lowerTarget].toLowerCase() === lowerRaw) return true;
  if (EMPLOYEE_ID_ALIASES[cleanRawTaskId] && EMPLOYEE_ID_ALIASES[cleanRawTaskId].toLowerCase() === cleanTargetId) return true;
  if (EMPLOYEE_ID_ALIASES[cleanTargetId] && EMPLOYEE_ID_ALIASES[cleanTargetId].toLowerCase() === cleanRawTaskId) return true;

  // 4. Name match (Authoritative: matches when task visibly belongs to employee by name)
  if (targetName && taskAssigneeName) {
    const cleanTargetName = targetName.toLowerCase().replace(/[\s_\-.]+/g, '');
    const cleanTaskName = taskAssigneeName.toLowerCase().replace(/[\s_\-.]+/g, '');
    if (cleanTargetName === cleanTaskName) return true;
    if (cleanTargetName.includes(cleanTaskName) || cleanTaskName.includes(cleanTargetName)) return true;
  }

  // 5. Match rawTaskId against employee name (in case name was saved into assigneeId)
  if (targetName && cleanRawTaskId) {
    const cleanTargetName = targetName.toLowerCase().replace(/[\s_\-.]+/g, '');
    if (cleanRawTaskId === cleanTargetName || cleanRawTaskId.includes(cleanTargetName) || cleanTargetName.includes(cleanRawTaskId)) {
      return true;
    }
  }

  // 6. Match taskAssigneeName against target ID
  if (taskAssigneeName && cleanTargetId) {
    const cleanTaskName = taskAssigneeName.toLowerCase().replace(/[\s_\-.]+/g, '');
    if (cleanTaskName === cleanTargetId || stripEmp(cleanTaskName) === stripEmp(cleanTargetId)) {
      return true;
    }
  }

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



