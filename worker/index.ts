/**
 * DigiExplodeAI — Cloudflare Worker API
 * Replaces Firebase Firestore as the data backend.
 * Firebase is kept ONLY for Authentication.
 *
 * Routes:
 *   /api/clients       GET, POST
 *   /api/clients/:id   GET, PUT, DELETE
 *   /api/employees     GET, POST
 *   /api/employees/:id GET, PUT, DELETE
 *   /api/tasks         GET, POST
 *   /api/tasks/:id     GET, PUT, DELETE
 *   /api/calendar      GET, POST
 *   /api/calendar/:id  GET, PUT, DELETE
 *   /api/worklogs      GET, POST
 *   /api/worklogs/:id  PUT, DELETE
 *   /api/attendance    GET, POST
 *   /api/attendance/:id PUT
 *   /api/approvals     GET, POST
 *   /api/approvals/:id PUT, DELETE
 *   /api/videotracker  GET, POST
 *   /api/videotracker/:id PUT, DELETE
 *   /api/payslips      GET, POST
 *   /api/payslips/:id  PUT, DELETE
 *   /api/hrdocuments   GET, POST
 *   /api/hrdocuments/:id PUT, DELETE
 *   /api/users         GET, POST
 *   /api/users/:id     GET, PUT
 */

export interface Env {
  DB: D1Database;
  KV?: KVNamespace;
}

// ── CORS Headers ──────────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function notFound(msg = 'Not found') {
  return json({ error: msg }, 404);
}

function err(msg: string, status = 500) {
  return json({ error: msg }, status);
}

// ── Simple UID generator ───────────────────────────────────────────────────
function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Route handler ──────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Parse JSON body for mutating methods
    let body: any = {};
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try { body = await request.json(); } catch {}
    }

    // Route segments
    const parts = path.replace(/^\/api\//, '').split('/');
    const resource = parts[0];
    const id = parts[1];

    try {
      switch (resource) {
        // ── CLIENTS ──────────────────────────────────────────────────────
        case 'clients': {
          if (method === 'GET' && !id) {
            const { results } = await env.DB.prepare('SELECT * FROM clients ORDER BY updatedAt DESC').all();
            return json(results);
          }
          if (method === 'GET' && id) {
            const row = await env.DB.prepare('SELECT * FROM clients WHERE clientId = ?').bind(id).first();
            return row ? json(row) : notFound();
          }
          if (method === 'POST') {
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
            return json({ clientId, ...body, createdAt: body.createdAt||now, updatedAt: now }, 201);
          }
          if (method === 'PUT' && id) {
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
            return json({ success: true, clientId: id, updatedAt: now });
          }
          if (method === 'DELETE' && id) {
            await env.DB.prepare('DELETE FROM clients WHERE clientId = ?').bind(id).run();
            return json({ success: true });
          }
          break;
        }

        // ── EMPLOYEES ────────────────────────────────────────────────────
        case 'employees': {
          if (method === 'GET' && !id) {
            const { results } = await env.DB.prepare('SELECT * FROM employees ORDER BY name ASC').all();
            return json(results);
          }
          if (method === 'GET' && id) {
            const row = await env.DB.prepare('SELECT * FROM employees WHERE id = ?').bind(id).first();
            return row ? json(row) : notFound();
          }
          if (method === 'POST') {
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
            return json({ id: empId, employeeId: empId, ...body }, 201);
          }
          if (method === 'PUT' && id) {
            await env.DB.prepare(`
              UPDATE employees SET name=?,email=?,phone=?,role=?,designation=?,department=?,
              joiningDate=?,status=?,monthlySalary=?,weeklyOff=?,notes=? WHERE id=?
            `).bind(
              body.name||'', body.email||'', body.phone||'',
              body.role||'Team Member', body.designation||'', body.department||'Operations',
              body.joiningDate||'', body.status||'Active', body.monthlySalary||0,
              body.weeklyOff||'Sunday', body.notes||'', id
            ).run();
            return json({ success: true });
          }
          if (method === 'DELETE' && id) {
            await env.DB.prepare('DELETE FROM employees WHERE id = ?').bind(id).run();
            return json({ success: true });
          }
          break;
        }

        // ── TASKS ────────────────────────────────────────────────────────
        case 'tasks': {
          if (method === 'GET' && !id) {
            const clientId = url.searchParams.get('clientId');
            const assigneeId = url.searchParams.get('assigneeId');
            const status = url.searchParams.get('status');
            let q = 'SELECT * FROM tasks WHERE 1=1';
            const binds: any[] = [];
            if (clientId) { q += ' AND clientId = ?'; binds.push(clientId); }
            if (assigneeId) { q += ' AND assigneeId = ?'; binds.push(assigneeId); }
            if (status) { q += ' AND status = ?'; binds.push(status); }
            q += ' ORDER BY updatedAt DESC';
            const { results } = await env.DB.prepare(q).bind(...binds).all();
            return json(results);
          }
          if (method === 'GET' && id) {
            const row = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
            return row ? json(row) : notFound();
          }
          if (method === 'POST') {
            const now = new Date().toISOString();
            const taskId = body.id || body.taskId || uid('task');
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
              body.clientId||'', body.clientName||'', body.assigneeId||'', body.assigneeName||'',
              body.dueDate||'', body.scheduledDate||body.dueDate||'', body.completedAt||'',
              body.createdAt||now, now, body.createdBy||'', body.format||'', body.platform||'', body.notes||''
            ).run();
            return json({ id: taskId, taskId, ...body, createdAt: body.createdAt||now, updatedAt: now }, 201);
          }
          if (method === 'PUT' && id) {
            const now = new Date().toISOString();
            await env.DB.prepare(`
              UPDATE tasks SET title=?,description=?,status=?,priority=?,category=?,clientId=?,clientName=?,
              assigneeId=?,assigneeName=?,dueDate=?,scheduledDate=?,completedAt=?,updatedAt=?,format=?,platform=?,notes=?
              WHERE id=?
            `).bind(
              body.title||'', body.description||'', body.status||'Planned',
              body.priority||'Medium', body.category||'Graphic Design',
              body.clientId||'', body.clientName||'', body.assigneeId||'', body.assigneeName||'',
              body.dueDate||'', body.scheduledDate||'', body.completedAt||'',
              now, body.format||'', body.platform||'', body.notes||'', id
            ).run();
            return json({ success: true, updatedAt: now });
          }
          if (method === 'DELETE' && id) {
            await env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
            return json({ success: true });
          }
          break;
        }

        // ── CONTENT CALENDAR ─────────────────────────────────────────────
        case 'calendar': {
          if (method === 'GET' && !id) {
            const clientId = url.searchParams.get('clientId');
            let q = 'SELECT * FROM contentCalendar WHERE 1=1';
            const binds: any[] = [];
            if (clientId) { q += ' AND clientId = ?'; binds.push(clientId); }
            q += ' ORDER BY scheduledDate ASC';
            const { results } = await env.DB.prepare(q).bind(...binds).all();
            // Parse JSON fields
            return json(results.map((r: any) => ({
              ...r,
              platforms: tryParse(r.platforms, []),
            })));
          }
          if (method === 'POST') {
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
            return json({ id: entryId, ...body, createdAt: body.createdAt||now, updatedAt: now }, 201);
          }
          if (method === 'PUT' && id) {
            const now = new Date().toISOString();
            await env.DB.prepare(`
              UPDATE contentCalendar SET title=?,clientId=?,clientName=?,contentType=?,platforms=?,status=?,
              assigneeId=?,assigneeName=?,scheduledDate=?,dueDate=?,caption=?,notes=?,approvalStatus=?,updatedAt=?
              WHERE id=?
            `).bind(
              body.title||'', body.clientId||'', body.clientName||'', body.contentType||'Static Post',
              JSON.stringify(body.platforms||[]), body.status||'Planned',
              body.assigneeId||'', body.assigneeName||'', body.scheduledDate||'', body.dueDate||'',
              body.caption||'', body.notes||'', body.approvalStatus||'pending', now, id
            ).run();
            return json({ success: true, updatedAt: now });
          }
          if (method === 'DELETE' && id) {
            await env.DB.prepare('DELETE FROM contentCalendar WHERE id = ?').bind(id).run();
            return json({ success: true });
          }
          break;
        }

        // ── WORKLOGS ─────────────────────────────────────────────────────
        case 'worklogs': {
          if (method === 'GET' && !id) {
            const employeeId = url.searchParams.get('employeeId');
            let q = 'SELECT * FROM workLogs WHERE 1=1';
            const binds: any[] = [];
            if (employeeId) { q += ' AND employeeId = ?'; binds.push(employeeId); }
            q += ' ORDER BY date DESC';
            const { results } = await env.DB.prepare(q).bind(...binds).all();
            return json(results);
          }
          if (method === 'POST') {
            const now = new Date().toISOString();
            const logId = body.id || uid('log');
            await env.DB.prepare(`
              INSERT INTO workLogs (id,taskId,taskTitle,employeeId,employeeName,clientId,clientName,status,hoursWorked,date,notes,createdAt)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET status=excluded.status, hoursWorked=excluded.hoursWorked, notes=excluded.notes
            `).bind(
              logId, body.taskId||'', body.taskTitle||'', body.employeeId||'', body.employeeName||'',
              body.clientId||'', body.clientName||'', body.status||'Completed',
              body.hoursWorked||0, body.date||now.split('T')[0], body.notes||'', now
            ).run();
            return json({ id: logId, ...body }, 201);
          }
          if (method === 'PUT' && id) {
            await env.DB.prepare(`
              UPDATE workLogs SET status=?,hoursWorked=?,notes=? WHERE id=?
            `).bind(body.status||'Completed', body.hoursWorked||0, body.notes||'', id).run();
            return json({ success: true });
          }
          if (method === 'DELETE' && id) {
            await env.DB.prepare('DELETE FROM workLogs WHERE id = ?').bind(id).run();
            return json({ success: true });
          }
          break;
        }

        // ── ATTENDANCE ───────────────────────────────────────────────────
        case 'attendance': {
          if (method === 'GET' && !id) {
            const date = url.searchParams.get('date');
            const employeeId = url.searchParams.get('employeeId');
            let q = 'SELECT * FROM attendance WHERE 1=1';
            const binds: any[] = [];
            if (date) { q += ' AND date = ?'; binds.push(date); }
            if (employeeId) { q += ' AND employeeId = ?'; binds.push(employeeId); }
            q += ' ORDER BY date DESC';
            const { results } = await env.DB.prepare(q).bind(...binds).all();
            return json(results);
          }
          if (method === 'POST') {
            const now = new Date().toISOString();
            const attId = body.id || body.attendanceId || uid('att');
            await env.DB.prepare(`
              INSERT INTO attendance (id,attendanceId,employeeId,employeeName,date,status,checkIn,checkOut,hoursWorked,notes,createdAt)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET status=excluded.status, checkIn=excluded.checkIn,
              checkOut=excluded.checkOut, hoursWorked=excluded.hoursWorked, notes=excluded.notes
            `).bind(
              attId, attId, body.employeeId||'', body.employeeName||'',
              body.date||now.split('T')[0], body.status||'Present',
              body.checkIn||body.checkInTime||'', body.checkOut||'', body.hoursWorked||0,
              body.notes||'', now
            ).run();
            return json({ id: attId, ...body }, 201);
          }
          if (method === 'PUT' && id) {
            await env.DB.prepare(`
              UPDATE attendance SET status=?,checkIn=?,checkOut=?,hoursWorked=?,notes=? WHERE id=?
            `).bind(body.status||'Present', body.checkIn||'', body.checkOut||'', body.hoursWorked||0, body.notes||'', id).run();
            return json({ success: true });
          }
          break;
        }

        // ── APPROVALS ────────────────────────────────────────────────────
        case 'approvals': {
          if (method === 'GET' && !id) {
            const { results } = await env.DB.prepare('SELECT * FROM approvals ORDER BY createdAt DESC').all();
            return json(results);
          }
          if (method === 'POST') {
            const now = new Date().toISOString();
            const appId = body.id || uid('appr');
            await env.DB.prepare(`
              INSERT INTO approvals (id,taskId,clientId,clientName,title,status,submittedBy,reviewedBy,fileUrl,notes,createdAt,updatedAt)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET status=excluded.status, reviewedBy=excluded.reviewedBy, notes=excluded.notes, updatedAt=excluded.updatedAt
            `).bind(
              appId, body.taskId||'', body.clientId||'', body.clientName||'', body.title||'',
              body.status||'pending', body.submittedBy||'', body.reviewedBy||'',
              body.fileUrl||'', body.notes||'', now, now
            ).run();
            return json({ id: appId, ...body }, 201);
          }
          if (method === 'PUT' && id) {
            const now = new Date().toISOString();
            await env.DB.prepare(`
              UPDATE approvals SET status=?,reviewedBy=?,notes=?,updatedAt=? WHERE id=?
            `).bind(body.status||'pending', body.reviewedBy||'', body.notes||'', now, id).run();
            return json({ success: true });
          }
          if (method === 'DELETE' && id) {
            await env.DB.prepare('DELETE FROM approvals WHERE id = ?').bind(id).run();
            return json({ success: true });
          }
          break;
        }

        // ── VIDEO TRACKER ────────────────────────────────────────────────
        case 'videotracker': {
          if (method === 'GET' && !id) {
            const { results } = await env.DB.prepare('SELECT * FROM videoTracker ORDER BY createdAt DESC').all();
            return json(results);
          }
          if (method === 'POST') {
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
            return json({ id: vidId, ...body }, 201);
          }
          if (method === 'PUT' && id) {
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
            return json({ success: true });
          }
          if (method === 'DELETE' && id) {
            await env.DB.prepare('DELETE FROM videoTracker WHERE id = ?').bind(id).run();
            return json({ success: true });
          }
          break;
        }

        // ── PAYSLIPS ─────────────────────────────────────────────────────
        case 'payslips': {
          if (method === 'GET' && !id) {
            const month = url.searchParams.get('month');
            const employeeId = url.searchParams.get('employeeId');
            let q = 'SELECT * FROM payslips WHERE 1=1';
            const binds: any[] = [];
            if (month) { q += ' AND month = ?'; binds.push(month); }
            if (employeeId) { q += ' AND employeeId = ?'; binds.push(employeeId); }
            q += ' ORDER BY month DESC';
            const { results } = await env.DB.prepare(q).bind(...binds).all();
            return json(results.map((r: any) => ({
              ...r,
              deductions: tryParse(r.deductions, {}),
              earnings: tryParse(r.earnings, {}),
              attendance: tryParse(r.attendance, {}),
            })));
          }
          if (method === 'POST') {
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
              body.generatedAt||'', now, now
            ).run();
            return json({ id: psId, ...body }, 201);
          }
          if (method === 'PUT' && id) {
            const now = new Date().toISOString();
            await env.DB.prepare(`
              UPDATE payslips SET grossPay=?,netPay=?,deductions=?,earnings=?,attendance=?,status=?,generatedAt=?,updatedAt=?
              WHERE id=?
            `).bind(
              body.grossPay||0, body.netPay||0,
              JSON.stringify(body.deductions||{}), JSON.stringify(body.earnings||{}),
              JSON.stringify(body.attendance||{}), body.status||'pending',
              body.generatedAt||'', now, id
            ).run();
            return json({ success: true });
          }
          if (method === 'DELETE' && id) {
            await env.DB.prepare('DELETE FROM payslips WHERE id = ?').bind(id).run();
            return json({ success: true });
          }
          break;
        }

        // ── HR DOCUMENTS ─────────────────────────────────────────────────
        case 'hrdocuments': {
          if (method === 'GET' && !id) {
            const employeeId = url.searchParams.get('employeeId');
            let q = 'SELECT * FROM hrDocuments WHERE 1=1';
            const binds: any[] = [];
            if (employeeId) { q += ' AND employeeId = ?'; binds.push(employeeId); }
            q += ' ORDER BY createdAt DESC';
            const { results } = await env.DB.prepare(q).bind(...binds).all();
            return json(results.map((r: any) => ({ ...r, fields: tryParse(r.fields, {}) })));
          }
          if (method === 'POST') {
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
            return json({ id: docId, ...body }, 201);
          }
          if (method === 'PUT' && id) {
            const now = new Date().toISOString();
            await env.DB.prepare(`
              UPDATE hrDocuments SET status=?,fields=?,updatedAt=? WHERE id=?
            `).bind(body.status||'draft', JSON.stringify(body.fields||{}), now, id).run();
            return json({ success: true });
          }
          if (method === 'DELETE' && id) {
            await env.DB.prepare('DELETE FROM hrDocuments WHERE id = ?').bind(id).run();
            return json({ success: true });
          }
          break;
        }

        // ── USERS ────────────────────────────────────────────────────────
        case 'users': {
          if (method === 'GET' && !id) {
            const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY name ASC').all();
            return json(results);
          }
          if (method === 'GET' && id) {
            const row = await env.DB.prepare('SELECT * FROM users WHERE userId = ?').bind(id).first();
            return row ? json(row) : notFound();
          }
          if (method === 'POST') {
            const now = new Date().toISOString();
            const userId = body.userId || id || uid('user');
            await env.DB.prepare(`
              INSERT INTO users (userId,name,email,role,department,clientId,createdAt,updatedAt)
              VALUES (?,?,?,?,?,?,?,?)
              ON CONFLICT(userId) DO UPDATE SET name=excluded.name, email=excluded.email,
              role=excluded.role, department=excluded.department, clientId=excluded.clientId, updatedAt=excluded.updatedAt
            `).bind(
              userId, body.name||'', body.email||'', body.role||'employee',
              body.department||'', body.clientId||'', body.createdAt||now, now
            ).run();
            return json({ userId, ...body }, 201);
          }
          if (method === 'PUT' && id) {
            const now = new Date().toISOString();
            await env.DB.prepare(`
              UPDATE users SET name=?,email=?,role=?,department=?,clientId=?,updatedAt=? WHERE userId=?
            `).bind(
              body.name||'', body.email||'', body.role||'employee',
              body.department||'', body.clientId||'', now, id
            ).run();
            return json({ success: true });
          }
          break;
        }

        // ── HEALTH CHECK ─────────────────────────────────────────────────
        case 'health': {
          return json({ status: 'ok', timestamp: new Date().toISOString(), db: 'D1' });
        }

        default:
          return notFound('Unknown API route');
      }
    } catch (e: any) {
      console.error('Worker API error:', e);
      return err(`Internal error: ${e?.message || 'Unknown'}`);
    }

    return notFound('Method not allowed');
  },
};

function tryParse(val: any, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
