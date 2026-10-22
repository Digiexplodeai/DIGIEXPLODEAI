/**
 * DigiExplodeAI — Server-Side RBAC & Identity Resolution for Cloudflare Workers
 * Resolves user identity from Cloudflare D1 with strict server control.
 * Enforces Zero Trust tenant isolation and least privilege.
 */

import type { AuthenticatedUser, CanonicalRole, Env } from './types';

const BOOTSTRAP_SUPER_ADMIN_EMAILS = [
  'dilseinvite@gmail.com',
  'admin@digiexplode.ai',
];

/**
 * Resolves an authenticated user's trusted role, identity, and status from Cloudflare D1.
 * Never trusts client-supplied headers, query parameters, or request body roles.
 */
export async function resolveUserProfile(
  uid: string,
  email: string,
  tokenClaims: Record<string, any>,
  env: Env
): Promise<AuthenticatedUser> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const isBootstrapAdmin = BOOTSTRAP_SUPER_ADMIN_EMAILS.includes(cleanEmail);

  let role: CanonicalRole = isBootstrapAdmin ? 'superAdmin' : 'employee';
  let status: 'active' | 'inactive' = 'active';
  let clientId: string | undefined = undefined;
  let employeeId: string | undefined = undefined;

  // 1. Query D1 users table
  try {
    const userRow: any = await env.DB.prepare(
      'SELECT * FROM users WHERE userId = ? OR (email != "" AND LOWER(email) = ?)'
    ).bind(uid, cleanEmail).first();

    if (userRow) {
      if (!isBootstrapAdmin && userRow.role) {
        role = normalizeRole(userRow.role);
      }
      if (userRow.status && (userRow.status.toLowerCase() === 'inactive' || userRow.status.toLowerCase() === 'deactivated')) {
        status = 'inactive';
      }
      if (userRow.clientId) {
        clientId = userRow.clientId;
      }
      if (userRow.employeeId) {
        employeeId = userRow.employeeId;
      }
    } else {
      // 2. Fallback: check employees table
      const empRow: any = await env.DB.prepare(
        'SELECT * FROM employees WHERE id = ? OR (email != "" AND LOWER(email) = ?)'
      ).bind(uid, cleanEmail).first();

      if (empRow) {
        employeeId = empRow.id || empRow.employeeId;
        if (!isBootstrapAdmin) {
          role = normalizeRole(empRow.role || 'employee');
        }
        if (empRow.status && empRow.status.toLowerCase() === 'inactive') {
          status = 'inactive';
        }
      } else {
        // 3. Fallback: check clients table
        const clientRow: any = await env.DB.prepare(
          'SELECT * FROM clients WHERE email != "" AND LOWER(email) = ?'
        ).bind(cleanEmail).first();

        if (clientRow) {
          clientId = clientRow.clientId;
          if (!isBootstrapAdmin) {
            role = 'client';
          }
          if (clientRow.status && clientRow.status.toLowerCase() === 'inactive') {
            status = 'inactive';
          }
        } else if (tokenClaims.role) {
          // 4. Token custom claims fallback (if verified server-minted claim present)
          if (!isBootstrapAdmin) {
            role = normalizeRole(tokenClaims.role);
          }
          if (tokenClaims.clientId) clientId = tokenClaims.clientId;
          if (tokenClaims.employeeId) employeeId = tokenClaims.employeeId;
        }
      }
    }
  } catch (err) {
    console.warn('[rbac] D1 user resolution notice:', err);
    // If D1 query fails or tables not yet created, preserve bootstrap admin
    if (isBootstrapAdmin) {
      role = 'superAdmin';
    }
  }

  // Fallback employeeId for employees
  if (role === 'employee' && !employeeId) {
    employeeId = uid;
  }

  return {
    uid,
    email: cleanEmail,
    role,
    clientId,
    employeeId,
    status,
    isAnonymous: false,
    tokenClaims,
  };
}

/**
 * Normalizes input role string to CanonicalRole
 */
export function normalizeRole(roleStr: string): CanonicalRole {
  const clean = (roleStr || '').trim().toLowerCase();
  switch (clean) {
    case 'superadmin':
    case 'super_admin':
      return 'superAdmin';
    case 'admin':
    case 'agencyadmin':
    case 'agency_admin':
      return 'admin';
    case 'teamleader':
    case 'team_leader':
    case 'teamlead':
      return 'teamLeader';
    case 'hr':
      return 'hr';
    case 'accounts':
    case 'finance':
      return 'accounts';
    case 'client':
      return 'client';
    case 'employee':
    default:
      return 'employee';
  }
}

/**
 * Verifies if user has one of the allowed roles.
 * Super Admin always has full access across all operations.
 */
export function hasRole(user: AuthenticatedUser, allowedRoles: CanonicalRole[]): boolean {
  if (user.role === 'superAdmin') {
    return true;
  }
  return allowedRoles.includes(user.role);
}

/**
 * Validates client-to-client multi-tenant isolation.
 * For client role, targetClientId MUST match user's assigned clientId.
 */
export function validateClientTenant(user: AuthenticatedUser, targetClientId?: string | null): boolean {
  if (user.role !== 'client') {
    return true; // Agency team members can access clients according to module permissions
  }
  if (!user.clientId || !targetClientId) {
    return false;
  }
  return user.clientId.trim().toLowerCase() === targetClientId.trim().toLowerCase();
}

/**
 * Checks if user is authorized to view or mutate a specific employee's personal record.
 */
export function validateEmployeeOwnership(user: AuthenticatedUser, targetEmployeeId?: string | null): boolean {
  if (user.role === 'superAdmin' || user.role === 'admin' || user.role === 'hr') {
    return true;
  }
  if (user.role === 'employee') {
    if (!targetEmployeeId || !user.employeeId) return false;
    return user.employeeId.trim().toLowerCase() === targetEmployeeId.trim().toLowerCase();
  }
  return false;
}

/**
 * Checks if user is authorized to view payroll records.
 */
export function canViewPayroll(user: AuthenticatedUser, targetEmployeeId?: string | null): boolean {
  if (user.role === 'superAdmin' || user.role === 'admin' || user.role === 'accounts' || user.role === 'hr') {
    return true;
  }
  if (user.role === 'employee') {
    if (!targetEmployeeId || !user.employeeId) return false;
    return user.employeeId.trim().toLowerCase() === targetEmployeeId.trim().toLowerCase();
  }
  return false;
}

/**
 * Checks if user is authorized to create, update, or delete payroll records.
 */
export function canManagePayroll(user: AuthenticatedUser): boolean {
  return user.role === 'superAdmin' || user.role === 'admin' || user.role === 'accounts';
}

/**
 * Checks if user is authorized to view HR letters and documents.
 */
export function canViewHRDocuments(user: AuthenticatedUser, targetEmployeeId?: string | null): boolean {
  if (user.role === 'superAdmin' || user.role === 'admin' || user.role === 'hr') {
    return true;
  }
  if (user.role === 'employee') {
    if (!targetEmployeeId || !user.employeeId) return false;
    return user.employeeId.trim().toLowerCase() === targetEmployeeId.trim().toLowerCase();
  }
  return false;
}

/**
 * Checks if user is authorized to generate or edit HR documents.
 */
export function canManageHRDocuments(user: AuthenticatedUser): boolean {
  return user.role === 'superAdmin' || user.role === 'admin' || user.role === 'hr';
}
