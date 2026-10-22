/**
 * DigiExplodeAI — Server-Side RBAC & Identity Resolution for Cloudflare Workers
 * Resolves user identity from Cloudflare D1 with strict server control.
 * Enforces Zero Trust tenant isolation, deny-by-default for unprovisioned users,
 * and eliminates unsafe role fallbacks.
 */

import type { AuthenticatedUser, CanonicalRole, Env } from './types';

// The verified primary bootstrap platform owner.
// admin@digiexplode.ai has been removed to prevent unverified domain registration hijacking.
const PRIMARY_BOOTSTRAP_SUPER_ADMIN = 'dilseinvite@gmail.com';

/**
 * Resolves an authenticated user's trusted role, identity, and status from Cloudflare D1.
 * Never trusts client-supplied headers, query parameters, or request body roles.
 * Unprovisioned users are DENIED access by default.
 */
export async function resolveUserProfile(
  uid: string,
  email: string,
  tokenClaims: Record<string, any>,
  env: Env
): Promise<AuthenticatedUser> {
  const cleanEmail = (email || '').trim().toLowerCase();

  // Audit bootstrap Super Admin: Requires matching primary owner email AND strictly verified email status
  const isEmailVerified = tokenClaims.email_verified === true;
  const isBootstrapAdmin = cleanEmail === PRIMARY_BOOTSTRAP_SUPER_ADMIN && isEmailVerified;

  // Prevent email-spoofing account takeover: unverified emails cannot match records by email
  const lookupEmail = isEmailVerified ? cleanEmail : '';

  let isProvisioned = isBootstrapAdmin;
  let role: CanonicalRole = isBootstrapAdmin ? 'superAdmin' : 'employee';
  let status: 'active' | 'inactive' = isBootstrapAdmin ? 'active' : 'inactive';
  let clientId: string | undefined = undefined;
  let employeeId: string | undefined = undefined;

  // 1. Query D1 users table
  try {
    const userRow: any = await env.DB.prepare(
      'SELECT * FROM users WHERE userId = ? OR (email != "" AND LOWER(email) = ?)'
    ).bind(uid, lookupEmail).first();

    if (userRow) {
      isProvisioned = true;
      if (!isBootstrapAdmin && userRow.role) {
        role = normalizeRole(userRow.role);
      }
      status = (userRow.status && (userRow.status.toLowerCase() === 'inactive' || userRow.status.toLowerCase() === 'deactivated'))
        ? 'inactive'
        : 'active';

      // Security requirement: Privileged administrative access strictly requires verified email
      if ((role === 'superAdmin' || role === 'admin') && !isEmailVerified) {
        status = 'inactive';
        isProvisioned = false;
      }

      if (userRow.clientId) {
        clientId = userRow.clientId;
      }
      if (userRow.employeeId) {
        employeeId = userRow.employeeId;
      }

      // Check token revocation timestamp if present in D1
      if (userRow.tokensValidAfter) {
        const tokensValidAfterSec = Math.floor(new Date(userRow.tokensValidAfter).getTime() / 1000);
        const tokenTimestamp = typeof tokenClaims.iat === 'number' ? tokenClaims.iat : (typeof tokenClaims.auth_time === 'number' ? tokenClaims.auth_time : 0);
        if (tokenTimestamp < tokensValidAfterSec) {
          status = 'inactive'; // Session revoked prior to tokensValidAfter
        }
      }
    } else {
      // 2. Secondary check: check D1 employees table
      const empRow: any = await env.DB.prepare(
        'SELECT * FROM employees WHERE id = ? OR (email != "" AND LOWER(email) = ?)'
      ).bind(uid, lookupEmail).first();

      if (empRow) {
        isProvisioned = true;
        employeeId = empRow.id || empRow.employeeId;
        if (!isBootstrapAdmin) {
          role = normalizeRole(empRow.role || 'employee');
        }
        status = (empRow.status && empRow.status.toLowerCase() === 'inactive') ? 'inactive' : 'active';

        // Check token revocation timestamp on employee record if present
        if (empRow.tokensValidAfter) {
          const tokensValidAfterSec = Math.floor(new Date(empRow.tokensValidAfter).getTime() / 1000);
          const tokenTimestamp = typeof tokenClaims.iat === 'number' ? tokenClaims.iat : (typeof tokenClaims.auth_time === 'number' ? tokenClaims.auth_time : 0);
          if (tokenTimestamp < tokensValidAfterSec) {
            status = 'inactive';
          }
        }
      } else {
        // 3. Tertiary check: check D1 clients table
        const clientRow: any = await env.DB.prepare(
          'SELECT * FROM clients WHERE email != "" AND LOWER(email) = ?'
        ).bind(lookupEmail).first();

        if (clientRow) {
          isProvisioned = true;
          clientId = clientRow.clientId;
          if (!isBootstrapAdmin) {
            role = 'client';
          }
          status = (clientRow.status && clientRow.status.toLowerCase() === 'inactive') ? 'inactive' : 'active';

          // Check token revocation timestamp on client record if present
          if (clientRow.tokensValidAfter) {
            const tokensValidAfterSec = Math.floor(new Date(clientRow.tokensValidAfter).getTime() / 1000);
            const tokenTimestamp = typeof tokenClaims.iat === 'number' ? tokenClaims.iat : (typeof tokenClaims.auth_time === 'number' ? tokenClaims.auth_time : 0);
            if (tokenTimestamp < tokensValidAfterSec) {
              status = 'inactive';
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[rbac] D1 user resolution notice:', err);
    if (isBootstrapAdmin) {
      role = 'superAdmin';
      status = 'active';
      isProvisioned = true;
    }
  }

  // Deny unprovisioned users by default: If not found anywhere, do not grant employee access
  if (!isProvisioned) {
    return {
      uid,
      email: cleanEmail,
      role: 'employee',
      clientId: undefined,
      employeeId: undefined,
      status: 'inactive',
      isProvisioned: false,
      isAnonymous: false,
      tokenClaims,
    };
  }

  // Set employeeId for provisioned employees
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
    isProvisioned: true,
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
  if (!user.isProvisioned || user.status === 'inactive') {
    return false;
  }
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
