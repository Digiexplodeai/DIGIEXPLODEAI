import { cfGetPermissions, cfSavePermissions } from '../cloudflareApi';
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
  'Marketing & Leads',
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
      view: ['Tasks & Work', 'Work Log', 'Content Calendar', 'Video Production', 'Attendance & Leaves', 'Performance', 'Files & Assets', 'Reports'].includes(mod),
      create: ['Work Log'].includes(mod),
      edit: ['Work Log', 'Tasks & Work'].includes(mod),
      delete: false,
      approve: false,
      export: ['Reports'].includes(mod),
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

    // Load from Cloudflare D1 / Worker backend
    cfGetPermissions().then(data => {
      if (data && typeof data === 'object') {
        this.matrix = { ...DEFAULT_ROLE_PERMISSIONS, ...data };
        this.persistCache();
        window.dispatchEvent(new CustomEvent('digi_permissions_updated', { detail: this.matrix }));
      }
    }).catch(err => {
      // Fallback: direct local API
      fetch('/api/system/permissions').then(r => r.json()).then(data => {
        if (data && typeof data === 'object') {
          this.matrix = { ...DEFAULT_ROLE_PERMISSIONS, ...data };
          this.persistCache();
          window.dispatchEvent(new CustomEvent('digi_permissions_updated', { detail: this.matrix }));
        }
      }).catch(() => {});
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

    // Persist to Cloudflare Worker D1
    try {
      await cfSavePermissions(sanitizedMatrix);
    } catch (e) {
      // Fallback to local server API
      try {
        await fetch('/api/system/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sanitizedMatrix)
        });
      } catch (err) {}
    }
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
