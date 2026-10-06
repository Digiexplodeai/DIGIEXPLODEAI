import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CanonicalRole, CanonicalAction, RolePermissions } from './types';

const PERMISSIONS_STORAGE_KEY = 'digi_role_permissions_v1';
const PREVIEW_ROLE_KEY = 'digi_preview_as_role';

export const CANONICAL_ROLES: { id: CanonicalRole; label: string; color: string; desc: string }[] = [
  { id: 'superAdmin', label: 'Super Admin', color: '#3557FF', desc: 'Full system control and unrestricted platform access' },
  { id: 'admin',      label: 'Admin',       color: '#2563EB', desc: 'Agency operational management & task assignment' },
  { id: 'teamLeader', label: 'Team Leader', color: '#8B5CF6', desc: 'Team oversight, review submissions and performance' },
  { id: 'employee',   label: 'Employee',    color: '#14B8A6', desc: 'Assigned tasks, own work logs and attendance' },
  { id: 'hr',         label: 'HR',          color: '#D89522', desc: 'Attendance, leave management & HR letters' },
  { id: 'accounts',   label: 'Accounts',    color: '#16A36A', desc: 'Payroll processing and financial reports' },
  { id: 'client',     label: 'Client',      color: '#6B7280', desc: 'Client portal workspace, approvals and reports' },
];

export const CANONICAL_MODULES = [
  'Clients',
  'Tasks & Work',
  'Work Log',
  'Content Calendar',
  'Video Production',
  'Approvals',
  'Employees',
  'Attendance & Leaves',
  'Performance',
  'Reports',
  'HR Documents',
  'Payroll',
  'SEO Studio',
  'Files & Assets',
  'Settings',
];

export const CANONICAL_ACTIONS: CanonicalAction[] = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = CANONICAL_MODULES.reduce((acc, mod) => ({
  ...acc,
  [mod]: {
    superAdmin: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
    admin: {
      view: true,
      create: !['HR Documents', 'Payroll'].includes(mod),
      edit: !['HR Documents', 'Payroll'].includes(mod),
      delete: ['Tasks & Work', 'Work Log', 'Content Calendar', 'Video Production'].includes(mod),
      approve: true,
      export: true,
    },
    teamLeader: {
      view: ['Tasks & Work', 'Work Log', 'Content Calendar', 'Video Production', 'Approvals', 'Attendance & Leaves', 'Performance'].includes(mod),
      create: ['Tasks & Work', 'Work Log', 'Content Calendar', 'Video Production'].includes(mod),
      edit: ['Tasks & Work', 'Work Log', 'Content Calendar', 'Video Production'].includes(mod),
      delete: false,
      approve: ['Approvals', 'Content Calendar', 'Video Production'].includes(mod),
      export: ['Tasks & Work', 'Work Log', 'Reports'].includes(mod),
    },
    employee: {
      view: ['Tasks & Work', 'Work Log', 'Content Calendar', 'Video Production', 'Attendance & Leaves', 'Performance', 'Files & Assets'].includes(mod),
      create: ['Work Log'].includes(mod),
      edit: ['Work Log', 'Tasks & Work'].includes(mod),
      delete: false,
      approve: false,
      export: false,
    },
    hr: {
      view: ['Employees', 'Attendance & Leaves', 'HR Documents', 'Payroll'].includes(mod),
      create: ['Employees', 'Attendance & Leaves', 'HR Documents'].includes(mod),
      edit: ['Employees', 'Attendance & Leaves', 'HR Documents'].includes(mod),
      delete: false,
      approve: ['Attendance & Leaves'].includes(mod),
      export: ['Employees', 'Attendance & Leaves', 'HR Documents'].includes(mod),
    },
    accounts: {
      view: ['Payroll', 'Reports', 'Clients'].includes(mod),
      create: ['Payroll'].includes(mod),
      edit: ['Payroll'].includes(mod),
      delete: false,
      approve: ['Payroll'].includes(mod),
      export: ['Payroll', 'Reports'].includes(mod),
    },
    client: {
      view: ['Content Calendar', 'Approvals', 'Reports'].includes(mod),
      create: false,
      edit: false,
      delete: false,
      approve: ['Approvals', 'Content Calendar'].includes(mod),
      export: ['Reports'].includes(mod),
    },
  }
}), {});

export class PermissionService {
  private static matrix: RolePermissions = DEFAULT_ROLE_PERMISSIONS;
  private static isInitialized = false;
  private static previewRole: CanonicalRole | null = null;

  public static init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    try {
      const raw = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
      if (raw) {
        this.matrix = { ...DEFAULT_ROLE_PERMISSIONS, ...JSON.parse(raw) };
      }
      const preview = sessionStorage.getItem(PREVIEW_ROLE_KEY) as CanonicalRole | null;
      if (preview) {
        this.previewRole = preview;
      }
    } catch (e) {
      console.warn('PermissionService cache error:', e);
    }

    // Load from Firestore
    getDoc(doc(db, 'system', 'rolePermissions')).then(snap => {
      if (snap.exists()) {
        this.matrix = { ...DEFAULT_ROLE_PERMISSIONS, ...(snap.data() as RolePermissions) };
        this.persistCache();
        window.dispatchEvent(new CustomEvent('digi_permissions_updated', { detail: this.matrix }));
      }
    }).catch(err => {
      console.warn('Could not load remote permissions:', err);
    });
  }

  public static getPermissions(): RolePermissions {
    this.init();
    return JSON.parse(JSON.stringify(this.matrix));
  }

  public static async savePermissions(newMatrix: RolePermissions): Promise<void> {
    this.init();

    // Ensure superAdmin permanently retains all true
    const sanitizedMatrix: RolePermissions = { ...newMatrix };
    for (const mod of CANONICAL_MODULES) {
      if (!sanitizedMatrix[mod]) sanitizedMatrix[mod] = {};
      sanitizedMatrix[mod]!.superAdmin = {
        view: true, create: true, edit: true, delete: true, approve: true, export: true
      };
    }

    this.matrix = sanitizedMatrix;
    this.persistCache();
    window.dispatchEvent(new CustomEvent('digi_permissions_updated', { detail: this.matrix }));

    // Persist to Firestore
    try {
      await setDoc(doc(db, 'system', 'rolePermissions'), sanitizedMatrix);
    } catch (e) {
      console.warn('Firestore setDoc rolePermissions fallback:', e);
    }

    // Persist to server API
    try {
      fetch('/api/system/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedMatrix)
      }).catch(() => {});
    } catch (e) {}
  }

  public static getEffectiveRole(userRealRole: CanonicalRole = 'admin'): CanonicalRole {
    this.init();
    if (this.previewRole) {
      return this.previewRole;
    }
    return userRealRole;
  }

  public static setPreviewRole(role: CanonicalRole | null) {
    this.previewRole = role;
    if (typeof window !== 'undefined') {
      if (role) {
        sessionStorage.setItem(PREVIEW_ROLE_KEY, role);
      } else {
        sessionStorage.removeItem(PREVIEW_ROLE_KEY);
      }
      window.dispatchEvent(new CustomEvent('digi_preview_role_changed', { detail: role }));
    }
  }

  public static getPreviewRole(): CanonicalRole | null {
    return this.previewRole;
  }

  public static can(module: string, action: CanonicalAction, userRole: CanonicalRole = 'admin'): boolean {
    this.init();
    const effectiveRole = this.getEffectiveRole(userRole);

    // Super Admin permanently has full access
    if (effectiveRole === 'superAdmin') {
      return true;
    }

    const modPerms = this.matrix[module];
    if (!modPerms) return false;

    const rolePerms = modPerms[effectiveRole];
    if (!rolePerms) return false;

    return rolePerms[action] === true;
  }

  public static assertCan(module: string, action: CanonicalAction, userRole: CanonicalRole = 'admin') {
    if (!this.can(module, action, userRole)) {
      const effectiveRole = this.getEffectiveRole(userRole);
      throw new Error(`Unauthorized: Role '${effectiveRole}' cannot perform '${action}' on module '${module}'.`);
    }
  }

  private static persistCache() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(this.matrix));
      }
    } catch (e) {}
  }
}
