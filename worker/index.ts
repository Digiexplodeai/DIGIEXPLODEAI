/**
 * DigiExplodeAI — Cloudflare Worker API
 * Hardened Zero Trust backend with native RS256 Firebase ID-Token verification,
 * server-controlled RBAC, multi-tenant isolation, and resource-level access control.
 *
 * Routes:
 *   /api/health        GET (Public)
 *   /api/clients       GET, POST (Authenticated, RBAC Scoped)
 *   /api/clients/:id   GET, PUT, DELETE (Authenticated, RBAC Scoped)
 *   /api/employees     GET, POST (Authenticated, RBAC Scoped)
 *   /api/employees/:id GET, PUT, DELETE (Authenticated, RBAC Scoped)
 *   /api/tasks         GET, POST (Authenticated, Client Isolated)
 *   /api/tasks/:id     GET, PUT, DELETE (Authenticated, Client Isolated)
 *   /api/calendar      GET, POST (Authenticated, Client Isolated)
 *   /api/calendar/:id  PUT, DELETE (Authenticated, Client Isolated)
 *   /api/worklogs      GET, POST (Authenticated, Employee Isolated)
 *   /api/worklogs/:id  PUT, DELETE (Authenticated, Employee Isolated)
 *   /api/attendance    GET, POST, PUT (Authenticated, Employee Isolated)
 *   /api/approvals     GET, POST, PUT, DELETE (Authenticated, Client Isolated)
 *   /api/videotracker  GET, POST, PUT, DELETE (Authenticated, Client Isolated)
 *   /api/payslips      GET, POST, PUT, DELETE (Authenticated, Payroll RBAC)
 *   /api/hrdocuments   GET, POST, PUT, DELETE (Authenticated, HR RBAC)
 *   /api/users         GET, POST (Authenticated, User Administration)
 *   /api/users/:id     GET, PUT (Authenticated, User Administration)
 */

import type { Env, AuthenticatedUser } from './types';
import { extractBearerToken, verifyFirebaseIdToken } from './auth';
import {
  resolveUserProfile,
  hasRole,
  canViewPayroll,
  canManagePayroll,
  canViewHRDocuments,
  canManageHRDocuments,
  normalizeRole,
} from './rbac';
import {
  handleRecoveryRequest,
  handleRecoveryVerify,
  handleRecoveryReset,
} from './recovery';

export type { Env, AuthenticatedUser };

// ── CORS Headers Generator ──────────────────────────────────────────────────
function getCorsHeaders(request: Request, env: Env) {
  const origin = request.headers.get('Origin') || '';
  const defaultAllowed = 'https://www.digiexplodeai.com,https://digiexplodeai.com,http://localhost:3000,http://localhost:5173';
  const allowed = (env.ALLOWED_ORIGINS || defaultAllowed).split(',').map(o => o.trim());

  const isAllowed =
    allowed.includes(origin) ||
    origin.endsWith('digiexplodeai.com') ||
    origin.startsWith('http://localhost:');

  const allowOrigin = isAllowed && origin ? origin : 'https://www.digiexplodeai.com';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data: any, status = 200, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

function unauthorized(msg = 'Unauthorized', cors: Record<string, string>) {
  return json({ error: msg }, 401, cors);
}

function forbidden(msg = 'Forbidden', cors: Record<string, string>) {
  return json({ error: msg }, 403, cors);
}

function notFound(msg = 'Not found', cors: Record<string, string>) {
  return json({ error: msg }, 404, cors);
}

function err(msg: string, status = 500, cors: Record<string, string>) {
  return json({ error: msg }, status, cors);
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function tryParse(val: any, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

// ── Main Route Handler ──────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = getCorsHeaders(request, env);
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 1. CORS Preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: cors, status: 204 });
    }

    // Route segments
    const parts = path.replace(/^\/api\//, '').split('/');
    const resource = parts[0];
    const id = parts[1];

    // 2. Health check (Public uptime monitoring)
    if (resource === 'health') {
      return json({ status: 'ok', timestamp: new Date().toISOString(), db: 'D1' }, 200, cors);
    }

    // 2b. Public Password Recovery & OTP endpoints (Zero-Trust Verified)
    if (resource === 'auth') {
      const action = parts[1]; // e.g. 'recovery'
      const subAction = parts[2]; // e.g. 'request', 'verify', 'reset'

      if (action === 'recovery') {
        let body: any = {};
        if (['POST', 'PUT'].includes(method)) {
          try { body = await request.json(); } catch {}
        }

        if (subAction === 'request' && method === 'POST') {
          try {
            const res = await handleRecoveryRequest(body, env);
            return json(res, 200, cors);
          } catch (e: any) {
            return json({ success: false, error: e.message || 'Recovery request failed' }, 400, cors);
          }
        }

        if (subAction === 'verify' && method === 'POST') {
          try {
            const res = await handleRecoveryVerify(body, env);
            return json(res, res.success ? 200 : 400, cors);
          } catch (e: any) {
            return json({ success: false, error: e.message || 'Verification failed' }, 400, cors);
          }
        }

        if (subAction === 'reset' && method === 'POST') {
          try {
            const res = await handleRecoveryReset(body, env);
            return json(res, res.success ? 200 : 400, cors);
          } catch (e: any) {
            return json({ success: false, error: e.message || 'Password reset failed' }, 400, cors);
          }
        }
      }

      return notFound('Auth endpoint not found', cors);
    }

    // 3. Authenticate all protected API routes
    const token = extractBearerToken(request);
    if (!token) {
      return unauthorized('Missing or malformed Authorization header. Expected Bearer <token>', cors);
    }

    const authVerification = await verifyFirebaseIdToken(token, env);
    if (authVerification.success === false) {
      return unauthorized(authVerification.error, cors);
    }

    // 4. Resolve Trusted User Role & Account Status from Server (D1)
    const user: AuthenticatedUser = await resolveUserProfile(
      authVerification.uid,
      authVerification.email,
      authVerification.payload,
      env
    );

    // 5. Account Provisioning & Disablement Enforcement (Deny by default)
    if (!user.isProvisioned) {
      return forbidden('Account is not provisioned. Access denied by default. Please contact an administrator.', cors);
    }
    if (user.status === 'inactive') {
      return forbidden('Account is deactivated. Access denied.', cors);
    }

    // Parse JSON body for mutating methods
    let body: any = {};
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try { body = await request.json(); } catch {}
    }

    try {
      switch (resource) {
        // ── CLIENTS ──────────────────────────────────────────────────────
        case 'clients': {
          if (method === 'GET' && !id) {
            if (user.role === 'client') {
              if (!user.clientId) return json([], 200, cors);
              const { results } = await env.DB.prepare(
                'SELECT * FROM clients WHERE clientId = ?'
              ).bind(user.clientId).all();
              return json(results, 200, cors);
            }
            const { results } = await env.DB.prepare('SELECT * FROM clients ORDER BY updatedAt DESC').all();
            return json(results, 200, cors);
          }

          if (method === 'GET' && id) {
            if (user.role === 'client' && user.clientId !== id) {
              return forbidden("Access denied to other client's records", cors);
            }
            const row = await env.DB.prepare('SELECT * FROM clients WHERE clientId = ?').bind(id).first();
            return row ? json(row, 200, cors) : notFound('Client not found', cors);
          }

          if (method === 'POST') {
            if (!hasRole(user, ['superAdmin', 'admin'])) {
              return forbidden('Only administrators can register clients', cors);
            }
            const now = new Date().toISOString();
            const clientId = body.clientId || uid('client');
            await env.DB.prepare(`
              INSERT INTO clients (clientId,clientName,businessName,category,contactPerson,phone,email,package,startDate,status,assignedAdminId,notes,createdAt,updatedAt)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(clientId) DO UPDATE SET
                clientName=excluded.clientName, businessName=excluded.businessName,
                category=excluded.category, contactPerson=excluded.contactPerson,
                phone=excluded.phone, email=excluded.email, package=excluded.package,
                startDate=excluded.startDate, status=excluded.status,
                assignedAdminId=excluded.assignedAdminId, notes=excluded.notes, updatedAt=excluded.updatedAt
            `).bind(
              clientId, body.clientName||'', body.businessName||'', body.category||'General',
              body.contactPerson||'', body.phone||'', body.email||'', body.package||'Growth',
              body.startDate||'', body.status||'Active', body.assignedAdminId||'', body.notes||'',
              body.createdAt||now, now
            ).run();
            return json({ clientId, ...body, createdAt: body.createdAt||now, updatedAt: now }, 201, cors);
          }

          if (method === 'PUT' && id) {
            if (!hasRole(user, ['superAdmin', 'admin'])) {
              return forbidden('Only administrators can modify client profiles', cors);
            }
            const now = new Date().toISOString();
            await env.DB.prepare(`
              INSERT INTO clients (clientId,clientName,businessName,category,contactPerson,phone,email,package,startDate,status,assignedAdminId,notes,createdAt,updatedAt)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(clientId) DO UPDATE SET
                clientName=excluded.clientName, businessName=excluded.businessName,
                category=excluded.category, contactPerson=excluded.contactPerson,
                phone=excluded.phone, email=excluded.email, package=excluded.package,
                startDate=excluded.startDate, status=excluded.status,
                assignedAdminId=excluded.assignedAdminId, notes=excluded.notes, updatedAt=excluded.updatedAt
            `).bind(
              id, body.clientName||'', body.businessName||'', body.category||'General',
              body.contactPerson||'', body.phone||'', body.email||'', body.package||'Growth',
              body.startDate||'', body.status||'Active', body.assignedAdminId||'', body.notes||'',
              body.createdAt||now, now
            ).run();
            return json({ success: true, clientId: id, updatedAt: now }, 200, cors);
          }

          if (method === 'DELETE' && id) {
            if (user.role !== 'superAdmin') {
              return forbidden('Only Super Admin is authorized to delete client accounts', cors);
            }
            await env.DB.prepare('DELETE FROM clients WHERE clientId = ?').bind(id).run();
            return json({ success: true }, 200, cors);
          }
          break;
        }

        // ── EMPLOYEES ────────────────────────────────────────────────────
        case 'employees': {
          if (user.role === 'client') {
            return forbidden('Clients are not authorized to access employee records', cors);
          }

          if (method === 'GET' && !id) {
            const { results } = await env.DB.prepare('SELECT * FROM employees ORDER BY name ASC').all();
            const isPrivileged = hasRole(user, ['superAdmin', 'admin', 'hr', 'accounts']);
            const sanitized = (results || []).map((emp: any) => {
              if (!isPrivileged) {
                const { monthlySalary, notes, ...rest } = emp;
                return { ...rest, monthlySalary: 0 };
              }
              return emp;
            });
            return json(sanitized, 200, cors);
          }

          if (method === 'GET' && id) {
            const row: any = await env.DB.prepare('SELECT * FROM employees WHERE id = ?').bind(id).first();
            if (!row) return notFound('Employee not found', cors);
            const isPrivileged = hasRole(user, ['superAdmin', 'admin', 'hr', 'accounts']) || user.employeeId === id;
            if (!isPrivileged) {
              const { monthlySalary, notes, ...rest } = row;
              return json({ ...rest, monthlySalary: 0 }, 200, cors);
            }
            return json(row, 200, cors);
          }

          if (method === 'POST') {
            if (!hasRole(user, ['superAdmin', 'admin', 'hr'])) {
              return forbidden('Only Super Admin, Admin, or HR can create employee records', cors);
            }
            const now = new Date().toISOString();
            const empId = body.id || body.employeeId || uid('emp');
            await env.DB.prepare(`
              INSERT INTO employees (id,employeeId,name,email,phone,role,designation,department,joiningDate,status,monthlySalary,weeklyOff,notes,createdAt)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET
                name=excluded.name, email=excluded.email, phone=excluded.phone,
                role=excluded.role, designation=excluded.designation, department=excluded.department,
                joiningDate=excluded.joiningDate, status=excluded.status,
                monthlySalary=excluded.monthlySalary, weeklyOff=excluded.weeklyOff, notes=excluded.notes
            `).bind(
              empId, empId, body.name||'', body.email||'', body.phone||'',
              body.role||'Team Member', body.designation||body.role||'', body.department||'Operations',
              body.joiningDate||'', body.status||'Active', body.monthlySalary||0,
              body.weeklyOff||'Sunday', body.notes||'', body.createdAt||now
            ).run();
            return json({ id: empId, employeeId: empId, ...body }, 201, cors);
          }

          if (method === 'PUT' && id) {
            if (!hasRole(user, ['superAdmin', 'admin', 'hr'])) {
              return forbidden('Only Super Admin, Admin, or HR can modify employee records', cors);
            }
            await env.DB.prepare(`
              UPDATE employees SET name=?,email=?,phone=?,role=?,designation=?,department=?,
              joiningDate=?,status=?,monthlySalary=?,weeklyOff=?,notes=? WHERE id=?
            `).bind(
              body.name||'', body.email||'', body.phone||'',
              body.role||'Team Member', body.designation||'', body.department||'Operations',
              body.joiningDate||'', body.status||'Active', body.monthlySalary||0,
              body.weeklyOff||'Sunday', body.notes||'', id
            ).run();
            return json({ success: true }, 200, cors);
          }

          if (method === 'DELETE' && id) {
            if (!hasRole(user, ['superAdmin', 'admin'])) {
              return forbidden('Only administrators can delete employee profiles', cors);
            }
            await env.DB.prepare('DELETE FROM employees WHERE id = ?').bind(id).run();
            return json({ success: true }, 200, cors);
          }
          break;
        }

        // ── TASKS ────────────────────────────────────────────────────────
        case 'tasks': {
          if (method === 'GET' && !id) {
            let targetClientId = url.searchParams.get('clientId');
            const assigneeId = url.searchParams.get('assigneeId');
            const status = url.searchParams.get('status');

            // Enforce client-to-client tenant isolation
            if (user.role === 'client') {
              targetClientId = user.clientId || 'unassigned_client_scope';
            }

            let q = `SELECT id, taskId, title, description, status, priority, category,
              clientId, clientName, assigneeId, assigneeName, dueDate, scheduledDate,
              completedAt, createdAt, updatedAt, createdBy, format, platform, notes
              FROM tasks WHERE (status != 'Cancelled')`;
            const binds: any[] = [];
            if (targetClientId) { q += ' AND clientId = ?'; binds.push(targetClientId); }
            if (assigneeId) { q += ' AND assigneeId = ?'; binds.push(assigneeId); }
            if (status) { q += ' AND status = ?'; binds.push(status); }
            q += ' ORDER BY updatedAt DESC';

            const { results } = await env.DB.prepare(q).bind(...binds).all();
            return json(results, 200, cors);
          }

          if (method === 'GET' && id) {
            const row: any = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
            if (!row) return notFound('Task not found', cors);

            if (user.role === 'client' && row.clientId !== user.clientId) {
              return forbidden("Access denied: task belongs to another client's workspace", cors);
            }
            return json(row, 200, cors);
          }

          if (method === 'POST') {
            const now = new Date().toISOString();
            const taskId = body.id || body.taskId || uid('task');

            // Enforce client tenant scope
            let assignedClientId = body.clientId || '';
            if (user.role === 'client') {
              assignedClientId = user.clientId || '';
            }

            await env.DB.prepare(`
              INSERT INTO tasks (id,taskId,title,description,status,priority,category,clientId,clientName,
              assigneeId,assigneeName,dueDate,scheduledDate,completedAt,createdAt,updatedAt,createdBy,format,platform,notes)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET
                title=excluded.title, description=excluded.description, status=excluded.status,
                priority=excluded.priority, category=excluded.category, clientId=excluded.clientId,
                clientName=excluded.clientName, assigneeId=excluded.assigneeId, assigneeName=excluded.assigneeName,
                dueDate=excluded.dueDate, scheduledDate=excluded.scheduledDate, completedAt=excluded.completedAt,
                updatedAt=excluded.updatedAt, format=excluded.format, platform=excluded.platform, notes=excluded.notes
            `).bind(
              taskId, taskId, body.title||'', body.description||'',
              body.status||'Planned', body.priority||'Medium', body.category||'Graphic Design',
              assignedClientId, body.clientName||'', body.assigneeId||'', body.assigneeName||'',
              body.dueDate||'', body.scheduledDate||body.dueDate||'', body.completedAt||'',
              body.createdAt||now, now, body.createdBy||user.email, body.format||'', body.platform||'', body.notes||''
            ).run();
            return json({ id: taskId, taskId, ...body, clientId: assignedClientId, createdAt: body.createdAt||now, updatedAt: now }, 201, cors);
          }

          if (method === 'PUT' && id) {
            const existing: any = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
            if (!existing) return notFound('Task not found', cors);

            if (user.role === 'client' && existing.clientId !== user.clientId) {
              return forbidden("Access denied: task belongs to another client's workspace", cors);
            }

            const now = new Date().toISOString();
            const assignedClientId = user.role === 'client' ? (user.clientId || existing.clientId) : (body.clientId || existing.clientId);

            await env.DB.prepare(`
              INSERT INTO tasks (id,taskId,title,description,status,priority,category,clientId,clientName,
              assigneeId,assigneeName,dueDate,scheduledDate,completedAt,createdAt,updatedAt,createdBy,format,platform,notes)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET
                title=excluded.title, description=excluded.description, status=excluded.status,
                priority=excluded.priority, category=excluded.category, clientId=excluded.clientId,
                clientName=excluded.clientName, assigneeId=excluded.assigneeId, assigneeName=excluded.assigneeName,
                dueDate=excluded.dueDate, scheduledDate=excluded.scheduledDate, completedAt=excluded.completedAt,
                updatedAt=excluded.updatedAt, format=excluded.format, platform=excluded.platform, notes=excluded.notes
            `).bind(
              id, id, body.title||existing.title||'', body.description||existing.description||'',
              body.status||existing.status||'Planned', body.priority||existing.priority||'Medium', body.category||existing.category||'Graphic Design',
              assignedClientId, body.clientName||existing.clientName||'', body.assigneeId||existing.assigneeId||'', body.assigneeName||existing.assigneeName||'',
              body.dueDate||existing.dueDate||'', body.scheduledDate||existing.scheduledDate||body.dueDate||'', body.completedAt||existing.completedAt||'',
              existing.createdAt||now, now, existing.createdBy||user.email, body.format||existing.format||'', body.platform||existing.platform||'', body.notes||existing.notes||''
            ).run();
            return json({ success: true, taskId: id, updatedAt: now }, 200, cors);
          }

          if (method === 'DELETE' && id) {
            if (!hasRole(user, ['superAdmin', 'admin'])) {
              return forbidden('Only administrators can delete tasks', cors);
            }
            await env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
            return json({ success: true }, 200, cors);
          }
          break;
        }

        // ── CONTENT CALENDAR ─────────────────────────────────────────────
        case 'calendar': {
          if (method === 'GET' && !id) {
            let targetClientId = url.searchParams.get('clientId');
            if (user.role === 'client') {
              targetClientId = user.clientId || 'unassigned_client_scope';
            }

            let q = 'SELECT * FROM contentCalendar WHERE 1=1';
            const binds: any[] = [];
            if (targetClientId) { q += ' AND clientId = ?'; binds.push(targetClientId); }
            q += ' ORDER BY scheduledDate ASC';

            const { results } = await env.DB.prepare(q).bind(...binds).all();
            return json((results || []).map((r: any) => ({
              ...r,
              platforms: tryParse(r.platforms, []),
            })), 200, cors);
          }

          if (method === 'POST') {
            if (user.role === 'client') {
              return forbidden('Clients cannot create calendar entries directly', cors);
            }
            const now = new Date().toISOString();
            const entryId = body.id || uid('cal');
            await env.DB.prepare(`
              INSERT INTO contentCalendar (id,title,clientId,clientName,contentType,platforms,status,
              assigneeId,assigneeName,scheduledDate,dueDate,caption,notes,approvalStatus,createdAt,updatedAt)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET
                title=excluded.title, clientId=excluded.clientId, clientName=excluded.clientName,
                contentType=excluded.contentType, platforms=excluded.platforms, status=excluded.status,
                assigneeId=excluded.assigneeId, assigneeName=excluded.assigneeName,
                scheduledDate=excluded.scheduledDate, dueDate=excluded.dueDate,
                caption=excluded.caption, notes=excluded.notes, approvalStatus=excluded.approvalStatus, updatedAt=excluded.updatedAt
            `).bind(
              entryId, body.title||'', body.clientId||'', body.clientName||'',
              body.contentType||'Static Post', JSON.stringify(body.platforms||[]),
              body.status||'Planned', body.assigneeId||'', body.assigneeName||'',
              body.scheduledDate||'', body.dueDate||body.scheduledDate||'',
              body.caption||'', body.notes||'', body.approvalStatus||'pending',
              body.createdAt||now, now
            ).run();
            return json({ id: entryId, ...body, createdAt: body.createdAt||now, updatedAt: now }, 201, cors);
          }

          if (method === 'PUT' && id) {
            const existing: any = await env.DB.prepare('SELECT * FROM contentCalendar WHERE id = ?').bind(id).first();
            if (!existing) return notFound('Calendar entry not found', cors);

            if (user.role === 'client' && existing.clientId !== user.clientId) {
              return forbidden("Access denied: calendar entry belongs to another client", cors);
            }

            const now = new Date().toISOString();
            await env.DB.prepare(`
              UPDATE contentCalendar SET title=?,clientId=?,clientName=?,contentType=?,platforms=?,status=?,
              assigneeId=?,assigneeName=?,scheduledDate=?,dueDate=?,caption=?,notes=?,approvalStatus=?,updatedAt=?
              WHERE id=?
            `).bind(
              body.title||existing.title||'', user.role === 'client' ? existing.clientId : (body.clientId||existing.clientId||''),
              body.clientName||existing.clientName||'', body.contentType||existing.contentType||'Static Post',
              JSON.stringify(body.platforms||tryParse(existing.platforms, [])), body.status||existing.status||'Planned',
              body.assigneeId||existing.assigneeId||'', body.assigneeName||existing.assigneeName||'',
              body.scheduledDate||existing.scheduledDate||'', body.dueDate||existing.dueDate||'',
              body.caption||existing.caption||'', body.notes||existing.notes||'',
              body.approvalStatus||existing.approvalStatus||'pending', now, id
            ).run();
            return json({ success: true, updatedAt: now }, 200, cors);
          }

          if (method === 'DELETE' && id) {
            if (!hasRole(user, ['superAdmin', 'admin'])) {
              return forbidden('Only administrators can delete calendar entries', cors);
            }
            await env.DB.prepare('DELETE FROM contentCalendar WHERE id = ?').bind(id).run();
            return json({ success: true }, 200, cors);
          }
          break;
        }

        // ── WORKLOGS ─────────────────────────────────────────────────────
        case 'worklogs': {
          if (user.role === 'client') {
            return forbidden('Clients cannot access employee work logs', cors);
          }

          if (method === 'GET' && !id) {
            let targetEmployeeId = url.searchParams.get('employeeId');
            if (user.role === 'employee') {
              targetEmployeeId = user.employeeId || user.uid;
            }

            // Return both field-name conventions so the frontend classifier works
            // regardless of whether it reads work_date/date or hours/hoursWorked
            let q = `SELECT id,
              taskId, taskTitle,
              taskId AS task_id,
              employeeId, employeeName,
              employeeId AS employee_id,
              clientId, clientName,
              clientId AS client_id,
              status,
              hoursWorked, hoursWorked AS hours,
              date, date AS work_date,
              notes, createdAt
              FROM workLogs WHERE 1=1`;
            const binds: any[] = [];
            if (targetEmployeeId) { q += ' AND employeeId = ?'; binds.push(targetEmployeeId); }
            q += ' ORDER BY date DESC';

            const { results } = await env.DB.prepare(q).bind(...binds).all();
            return json(results, 200, cors);
          }

          if (method === 'POST') {
            const now = new Date().toISOString();
            const logId = body.id || uid('log');
            const targetEmployeeId = user.role === 'employee' ? (user.employeeId || user.uid) : (body.employeeId || body.employee_id || user.uid);
            // Accept both field-name conventions: hours (timer) and hoursWorked (task completion)
            const resolvedHours = Number(body.hoursWorked) || Number(body.hours) || 0;
            // Accept both date field conventions: work_date (snake_case) and date (camelCase)
            const resolvedDate = body.work_date || body.date || now.split('T')[0];
            // Accept both taskId conventions
            const resolvedTaskId = body.taskId || body.task_id || '';

            await env.DB.prepare(`
              INSERT INTO workLogs (id,taskId,taskTitle,employeeId,employeeName,clientId,clientName,status,hoursWorked,date,notes,createdAt)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET
                status=excluded.status,
                hoursWorked=CASE WHEN excluded.hoursWorked > 0 THEN excluded.hoursWorked ELSE hoursWorked END,
                notes=CASE WHEN excluded.notes != '' THEN excluded.notes ELSE notes END
            `).bind(
              logId,
              resolvedTaskId,
              body.taskTitle || body.work_description || body.workDone || '',
              targetEmployeeId,
              body.employeeName || body.employee_name || '',
              body.clientId || body.client_id || '',
              body.clientName || body.client_name || '',
              body.status || 'Completed',
              resolvedHours,
              resolvedDate,
              body.notes || body.work_description || '',
              now
            ).run();
            return json({ id: logId, ...body, employeeId: targetEmployeeId, hoursWorked: resolvedHours }, 201, cors);
          }

          if (method === 'PUT' && id) {
            if (user.role === 'employee') {
              const existing: any = await env.DB.prepare('SELECT * FROM workLogs WHERE id = ?').bind(id).first();
              if (!existing) return notFound('Work log not found', cors);
              if (existing.employeeId !== user.employeeId && existing.employeeId !== user.uid) {
                return forbidden("Access denied: cannot modify another employee's work log", cors);
              }
            }
            await env.DB.prepare(`
              UPDATE workLogs SET status=?,hoursWorked=?,notes=? WHERE id=?
            `).bind(body.status||'Completed', body.hoursWorked||0, body.notes||'', id).run();
            return json({ success: true }, 200, cors);
          }

          if (method === 'DELETE' && id) {
            if (!hasRole(user, ['superAdmin', 'admin'])) {
              return forbidden('Only administrators can delete work logs', cors);
            }
            await env.DB.prepare('DELETE FROM workLogs WHERE id = ?').bind(id).run();
            return json({ success: true }, 200, cors);
          }
          break;
        }

        // ── ATTENDANCE ───────────────────────────────────────────────────
        case 'attendance': {
          if (user.role === 'client') {
            return forbidden('Clients cannot access employee attendance records', cors);
          }

          if (method === 'GET' && !id) {
            const date = url.searchParams.get('date');
            let targetEmployeeId = url.searchParams.get('employeeId');

            if (user.role === 'employee') {
              targetEmployeeId = user.employeeId || user.uid;
            }

            let q = 'SELECT * FROM attendance WHERE 1=1';
            const binds: any[] = [];
            if (date) { q += ' AND date = ?'; binds.push(date); }
            if (targetEmployeeId) { q += ' AND employeeId = ?'; binds.push(targetEmployeeId); }
            q += ' ORDER BY date DESC';

            const { results } = await env.DB.prepare(q).bind(...binds).all();
            return json(results, 200, cors);
          }

          if (method === 'POST') {
            const now = new Date().toISOString();
            const attId = body.id || body.attendanceId || uid('att');
            const targetEmployeeId = user.role === 'employee' ? (user.employeeId || user.uid) : (body.employeeId || user.uid);

            await env.DB.prepare(`
              INSERT INTO attendance (id,attendanceId,employeeId,employeeName,date,status,checkIn,checkOut,hoursWorked,notes,createdAt)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET status=excluded.status, checkIn=excluded.checkIn,
              checkOut=excluded.checkOut, hoursWorked=excluded.hoursWorked, notes=excluded.notes
            `).bind(
              attId, attId, targetEmployeeId, body.employeeName||'',
              body.date||now.split('T')[0], body.status||'Present',
              body.checkIn||body.checkInTime||'', body.checkOut||'', body.hoursWorked||0,
              body.notes||'', now
            ).run();
            return json({ id: attId, ...body, employeeId: targetEmployeeId }, 201, cors);
          }

          if (method === 'PUT' && id) {
            if (user.role === 'employee') {
              const existing: any = await env.DB.prepare('SELECT * FROM attendance WHERE id = ?').bind(id).first();
              if (!existing) return notFound('Attendance record not found', cors);
              if (existing.employeeId !== user.employeeId && existing.employeeId !== user.uid) {
                return forbidden("Access denied: cannot update another employee's attendance", cors);
              }
            }
            await env.DB.prepare(`
              UPDATE attendance SET status=?,checkIn=?,checkOut=?,hoursWorked=?,notes=? WHERE id=?
            `).bind(body.status||'Present', body.checkIn||'', body.checkOut||'', body.hoursWorked||0, body.notes||'', id).run();
            return json({ success: true }, 200, cors);
          }
          break;
        }

        // ── APPROVALS ────────────────────────────────────────────────────
        case 'approvals': {
          if (method === 'GET' && !id) {
            let q = 'SELECT * FROM approvals WHERE 1=1';
            const binds: any[] = [];
            if (user.role === 'client') {
              q += ' AND clientId = ?';
              binds.push(user.clientId || 'unassigned_client_scope');
            }
            q += ' ORDER BY createdAt DESC';
            const { results } = await env.DB.prepare(q).bind(...binds).all();
            return json(results, 200, cors);
          }

          if (method === 'POST') {
            if (user.role === 'client') {
              return forbidden('Clients cannot submit approval items directly', cors);
            }
            const now = new Date().toISOString();
            const appId = body.id || uid('appr');
            await env.DB.prepare(`
              INSERT INTO approvals (id,taskId,clientId,clientName,title,status,submittedBy,reviewedBy,fileUrl,notes,createdAt,updatedAt)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET status=excluded.status, reviewedBy=excluded.reviewedBy, notes=excluded.notes, updatedAt=excluded.updatedAt
            `).bind(
              appId, body.taskId||'', body.clientId||'', body.clientName||'', body.title||'',
              body.status||'pending', body.submittedBy||user.email, body.reviewedBy||'',
              body.fileUrl||'', body.notes||'', now, now
            ).run();
            return json({ id: appId, ...body }, 201, cors);
          }

          if (method === 'PUT' && id) {
            const existing: any = await env.DB.prepare('SELECT * FROM approvals WHERE id = ?').bind(id).first();
            if (!existing) return notFound('Approval not found', cors);

            if (user.role === 'client' && existing.clientId !== user.clientId) {
              return forbidden("Access denied: approval request belongs to another client", cors);
            }

            const now = new Date().toISOString();
            await env.DB.prepare(`
              UPDATE approvals SET status=?,reviewedBy=?,notes=?,updatedAt=? WHERE id=?
            `).bind(body.status||existing.status||'pending', body.reviewedBy||user.email, body.notes||existing.notes||'', now, id).run();
            return json({ success: true }, 200, cors);
          }

          if (method === 'DELETE' && id) {
            if (!hasRole(user, ['superAdmin', 'admin'])) {
              return forbidden('Only administrators can delete approval requests', cors);
            }
            await env.DB.prepare('DELETE FROM approvals WHERE id = ?').bind(id).run();
            return json({ success: true }, 200, cors);
          }
          break;
        }

        // ── VIDEO TRACKER ────────────────────────────────────────────────
        case 'videotracker': {
          if (method === 'GET' && !id) {
            let q = 'SELECT * FROM videoTracker WHERE 1=1';
            const binds: any[] = [];
            if (user.role === 'client') {
              q += ' AND clientId = ?';
              binds.push(user.clientId || 'unassigned_client_scope');
            }
            q += ' ORDER BY createdAt DESC';
            const { results } = await env.DB.prepare(q).bind(...binds).all();
            return json(results, 200, cors);
          }

          if (method === 'POST') {
            if (user.role === 'client') {
              return forbidden('Clients cannot create video production entries', cors);
            }
            const now = new Date().toISOString();
            const vidId = body.id || uid('vid');
            await env.DB.prepare(`
              INSERT INTO videoTracker (id,clientId,clientName,title,status,plannedQuantity,shotQuantity,editedQuantity,
              videographerId,videographerName,editorId,editorName,shootDate,dueDate,footageLink,notes,createdAt,updatedAt)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET status=excluded.status, shotQuantity=excluded.shotQuantity,
              editedQuantity=excluded.editedQuantity, editorId=excluded.editorId,
              editorName=excluded.editorName, updatedAt=excluded.updatedAt
            `).bind(
              vidId, body.clientId||'', body.clientName||'', body.title||'',
              body.status||'pending_shoot', body.plannedQuantity||1, body.shotQuantity||0,
              body.editedQuantity||0, body.videographerId||'', body.videographerName||'',
              body.editorId||'', body.editorName||'', body.shootDate||'', body.dueDate||'',
              body.footageLink||'', body.notes||'', now, now
            ).run();
            return json({ id: vidId, ...body }, 201, cors);
          }

          if (method === 'PUT' && id) {
            if (user.role === 'client') {
              return forbidden('Clients cannot modify video production entries', cors);
            }
            const now = new Date().toISOString();
            await env.DB.prepare(`
              UPDATE videoTracker SET status=?,shotQuantity=?,editedQuantity=?,editorId=?,editorName=?,
              videographerId=?,videographerName=?,shootDate=?,dueDate=?,footageLink=?,notes=?,updatedAt=?
              WHERE id=?
            `).bind(
              body.status||'pending_shoot', body.shotQuantity||0, body.editedQuantity||0,
              body.editorId||'', body.editorName||'', body.videographerId||'', body.videographerName||'',
              body.shootDate||'', body.dueDate||'', body.footageLink||'', body.notes||'', now, id
            ).run();
            return json({ success: true }, 200, cors);
          }

          if (method === 'DELETE' && id) {
            if (!hasRole(user, ['superAdmin', 'admin'])) {
              return forbidden('Only administrators can delete video tracker records', cors);
            }
            await env.DB.prepare('DELETE FROM videoTracker WHERE id = ?').bind(id).run();
            return json({ success: true }, 200, cors);
          }
          break;
        }

        // ── PAYSLIPS ─────────────────────────────────────────────────────
        case 'payslips': {
          if (user.role === 'client') {
            return forbidden('Clients cannot access payroll information', cors);
          }

          if (method === 'GET' && !id) {
            const month = url.searchParams.get('month');
            let targetEmployeeId = url.searchParams.get('employeeId');

            // Restrict employees to only their own payslips
            if (user.role === 'employee') {
              targetEmployeeId = user.employeeId || user.uid;
            }

            if (!canViewPayroll(user, targetEmployeeId)) {
              return forbidden('Unauthorized to access payroll records', cors);
            }

            let q = 'SELECT * FROM payslips WHERE 1=1';
            const binds: any[] = [];
            if (month) { q += ' AND month = ?'; binds.push(month); }
            if (targetEmployeeId) { q += ' AND employeeId = ?'; binds.push(targetEmployeeId); }
            q += ' ORDER BY month DESC';

            const { results } = await env.DB.prepare(q).bind(...binds).all();
            return json((results || []).map((r: any) => ({
              ...r,
              deductions: tryParse(r.deductions, {}),
              earnings: tryParse(r.earnings, {}),
              attendance: tryParse(r.attendance, {}),
            })), 200, cors);
          }

          if (method === 'POST') {
            if (!canManagePayroll(user)) {
              return forbidden('Only Super Admin, Admin, or Accounts can generate payslips', cors);
            }
            const now = new Date().toISOString();
            const psId = body.id || uid('ps');
            await env.DB.prepare(`
              INSERT INTO payslips (id,employeeId,employeeName,month,annualCTC,grossPay,netPay,deductions,earnings,attendance,status,generatedAt,createdAt,updatedAt)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET grossPay=excluded.grossPay, netPay=excluded.netPay,
              deductions=excluded.deductions, earnings=excluded.earnings, attendance=excluded.attendance,
              status=excluded.status, generatedAt=excluded.generatedAt, updatedAt=excluded.updatedAt
            `).bind(
              psId, body.employeeId||'', body.employeeName||'', body.month||'',
              body.annualCTC||0, body.grossPay||0, body.netPay||0,
              JSON.stringify(body.deductions||{}), JSON.stringify(body.earnings||{}),
              JSON.stringify(body.attendance||{}), body.status||'pending',
              body.generatedAt||now, now, now
            ).run();
            return json({ id: psId, ...body }, 201, cors);
          }

          if (method === 'PUT' && id) {
            if (!canManagePayroll(user)) {
              return forbidden('Only Super Admin, Admin, or Accounts can modify payslips', cors);
            }
            const now = new Date().toISOString();
            await env.DB.prepare(`
              UPDATE payslips SET grossPay=?,netPay=?,deductions=?,earnings=?,attendance=?,status=?,generatedAt=?,updatedAt=?
              WHERE id=?
            `).bind(
              body.grossPay||0, body.netPay||0,
              JSON.stringify(body.deductions||{}), JSON.stringify(body.earnings||{}),
              JSON.stringify(body.attendance||{}), body.status||'pending',
              body.generatedAt||now, now, id
            ).run();
            return json({ success: true }, 200, cors);
          }

          if (method === 'DELETE' && id) {
            if (!canManagePayroll(user)) {
              return forbidden('Only Super Admin, Admin, or Accounts can delete payslips', cors);
            }
            await env.DB.prepare('DELETE FROM payslips WHERE id = ?').bind(id).run();
            return json({ success: true }, 200, cors);
          }
          break;
        }

        // ── HR DOCUMENTS ─────────────────────────────────────────────────
        case 'hrdocuments': {
          if (user.role === 'client') {
            return forbidden('Clients cannot access HR documents', cors);
          }

          if (method === 'GET' && !id) {
            let targetEmployeeId = url.searchParams.get('employeeId');
            if (user.role === 'employee') {
              targetEmployeeId = user.employeeId || user.uid;
            }

            if (!canViewHRDocuments(user, targetEmployeeId)) {
              return forbidden('Unauthorized to access HR documents', cors);
            }

            let q = 'SELECT * FROM hrDocuments WHERE 1=1';
            const binds: any[] = [];
            if (targetEmployeeId) { q += ' AND employeeId = ?'; binds.push(targetEmployeeId); }
            q += ' ORDER BY createdAt DESC';

            const { results } = await env.DB.prepare(q).bind(...binds).all();
            return json((results || []).map((r: any) => ({ ...r, fields: tryParse(r.fields, {}) })), 200, cors);
          }

          if (method === 'POST') {
            if (!canManageHRDocuments(user)) {
              return forbidden('Only Super Admin, Admin, or HR can generate HR documents', cors);
            }
            const now = new Date().toISOString();
            const docId = body.id || uid('hrdoc');
            await env.DB.prepare(`
              INSERT INTO hrDocuments (id,docType,employeeId,employeeName,referenceNumber,effectiveDate,status,verificationToken,fields,createdAt,updatedAt)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET status=excluded.status, fields=excluded.fields, updatedAt=excluded.updatedAt
            `).bind(
              docId, body.docType||'', body.employeeId||'', body.employeeName||'',
              body.referenceNumber||'', body.effectiveDate||'', body.status||'draft',
              body.verificationToken||'', JSON.stringify(body.fields||{}), now, now
            ).run();
            return json({ id: docId, ...body }, 201, cors);
          }

          if (method === 'PUT' && id) {
            if (!canManageHRDocuments(user)) {
              return forbidden('Only Super Admin, Admin, or HR can edit HR documents', cors);
            }
            const now = new Date().toISOString();
            await env.DB.prepare(`
              UPDATE hrDocuments SET status=?,fields=?,updatedAt=? WHERE id=?
            `).bind(body.status||'draft', JSON.stringify(body.fields||{}), now, id).run();
            return json({ success: true }, 200, cors);
          }

          if (method === 'DELETE' && id) {
            if (!canManageHRDocuments(user)) {
              return forbidden('Only Super Admin, Admin, or HR can delete HR documents', cors);
            }
            await env.DB.prepare('DELETE FROM hrDocuments WHERE id = ?').bind(id).run();
            return json({ success: true }, 200, cors);
          }
          break;
        }

        // ── USERS & ACCOUNT ADMINISTRATION ───────────────────────────────
        case 'users': {
          if (method === 'GET' && !id) {
            if (!hasRole(user, ['superAdmin', 'admin'])) {
              return forbidden('Only administrators can view all user profiles', cors);
            }
            const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY name ASC').all();
            return json(results, 200, cors);
          }

          if (method === 'GET' && id) {
            if (!hasRole(user, ['superAdmin', 'admin']) && user.uid !== id) {
              return forbidden('Cannot inspect account records of other users', cors);
            }
            const row = await env.DB.prepare('SELECT * FROM users WHERE userId = ?').bind(id).first();
            return row ? json(row, 200, cors) : notFound('User not found', cors);
          }

          if (method === 'POST') {
            const now = new Date().toISOString();
            // Non-superAdmin users can only initialize their own user record on signup
            const userId = user.role === 'superAdmin' ? (body.userId || user.uid) : user.uid;

            // Privilege escalation prevention: non-superAdmins cannot set privileged roles
            let assignedRole: string = user.role;
            if (user.role === 'superAdmin' && body.role) {
              assignedRole = normalizeRole(body.role);
            }

            await env.DB.prepare(`
              INSERT INTO users (userId,name,email,role,department,clientId,createdAt,updatedAt)
              VALUES (?,?,?,?,?,?,?,?)
              ON CONFLICT(userId) DO UPDATE SET name=excluded.name, email=excluded.email,
              role=excluded.role, department=excluded.department, clientId=excluded.clientId, updatedAt=excluded.updatedAt
            `).bind(
              userId, body.name||'', body.email||user.email, assignedRole,
              body.department||'', body.clientId||user.clientId||'', body.createdAt||now, now
            ).run();
            return json({ userId, ...body, role: assignedRole }, 201, cors);
          }

          if (method === 'PUT' && id) {
            // Privilege escalation prevention: users cannot modify other users or escalate their own role
            if (user.role !== 'superAdmin') {
              if (user.uid !== id) {
                return forbidden('Cannot modify account of another user', cors);
              }
              if (body.role && normalizeRole(body.role) !== user.role) {
                return forbidden('Privilege escalation rejected: users cannot self-assign or modify roles', cors);
              }
            }

            const targetRole = user.role === 'superAdmin' && body.role ? normalizeRole(body.role) : user.role;
            const now = new Date().toISOString();

            await env.DB.prepare(`
              UPDATE users SET name=?,email=?,role=?,department=?,clientId=?,updatedAt=? WHERE userId=?
            `).bind(
              body.name||'', body.email||'', targetRole,
              body.department||'', body.clientId||'', now, id
            ).run();
            return json({ success: true, role: targetRole }, 200, cors);
          }
          break;
        }

        // ── SYSTEM CONFIGURATION & PERMISSIONS ────────────────────────
        case 'system': {
          if (id === 'permissions') {
            if (method === 'GET') {
              try {
                const row = await env.DB.prepare(
                  "SELECT value FROM system_settings WHERE key = 'role_permissions'"
                ).first<{ value: string }>();
                if (row && row.value) {
                  return json(JSON.parse(row.value), 200, cors);
                }
              } catch (e) {
                // Table might not exist yet in dev
              }
              return json(null, 200, cors);
            }

            if (method === 'POST') {
              if (!hasRole(user, 'superAdmin', env)) {
                return forbidden('Super Admin authorization required to update platform permissions', cors);
              }
              const now = new Date().toISOString();
              try {
                await env.DB.prepare(`
                  CREATE TABLE IF NOT EXISTS system_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                  )
                `).run();
                await env.DB.prepare(`
                  INSERT INTO system_settings (key, value, updatedAt)
                  VALUES ('role_permissions', ?, ?)
                  ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt
                `).bind(JSON.stringify(body), now).run();
              } catch (e: any) {
                console.warn('System settings D1 persistence notice:', e);
              }
              return json({ success: true, updatedAt: now }, 200, cors);
            }
          }
          break;
        }

        default:
          return notFound('Unknown API route', cors);
      }
    } catch (e: any) {
      console.error('Worker API error:', e);
      return err(`Internal server error: ${e?.message || 'Unknown'}`, 500, cors);
    }

    return notFound('Method not allowed', cors);
  },
};
