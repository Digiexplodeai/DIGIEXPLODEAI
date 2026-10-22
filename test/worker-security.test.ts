/**
 * DigiExplodeAI — Automated Security Test Suite
 * Validates Phase 2B Cloudflare Worker API Authentication, Zero Trust RBAC,
 * Token Verification, Tenant Isolation, and Existing Task Workflow Continuity.
 */

import worker from '../worker/index';
import type { Env } from '../worker/types';
import { base64UrlEncode } from '../worker/auth';

// ── In-Memory Mock D1 Database ──────────────────────────────────────────────
class MockD1Statement {
  constructor(private sql: string, private binds: any[], private db: MockD1Database) {}

  bind(...values: any[]) {
    return new MockD1Statement(this.sql, values, this.db);
  }

  async all() {
    return this.db.executeAll(this.sql, this.binds);
  }

  async first() {
    const res = await this.all();
    return res.results[0] || null;
  }

  async run() {
    return this.db.executeRun(this.sql, this.binds);
  }
}

class MockD1Database {
  tables: Record<string, any[]> = {
    clients: [
      { clientId: 'client_nexus', clientName: 'Nexus Coaching', status: 'Active', updatedAt: '2026-10-01' },
      { clientId: 'client_acme', clientName: 'Acme Corp', status: 'Active', updatedAt: '2026-10-01' },
    ],
    employees: [
      { id: 'emp_priyanshu', employeeId: 'emp_priyanshu', name: 'Priyanshu', email: 'priyanshu@digiexplode.ai', role: 'Developer', status: 'Active', monthlySalary: 55000 },
      { id: 'emp_vansh', employeeId: 'emp_vansh', name: 'Vansh', email: 'vansh@digiexplode.ai', role: 'Graphic Designer', status: 'Active', monthlySalary: 50000 },
      { id: 'emp_inactive_user', employeeId: 'emp_inactive_user', name: 'Inactive Emp', email: 'inactive@digiexplode.ai', role: 'employee', status: 'Inactive', monthlySalary: 30000 },
    ],
    tasks: [
      { id: 'task_nexus_1', taskId: 'task_nexus_1', title: 'Nexus Reel', clientId: 'client_nexus', assigneeId: 'emp_priyanshu', status: 'Planned', updatedAt: '2026-10-01' },
      { id: 'task_acme_1', taskId: 'task_acme_1', title: 'Acme Billboard', clientId: 'client_acme', assigneeId: 'emp_vansh', status: 'Planned', updatedAt: '2026-10-01' },
    ],
    contentCalendar: [
      { id: 'cal_nexus_1', title: 'Nexus Launch', clientId: 'client_nexus', scheduledDate: '2026-10-25', platforms: '["Instagram"]', status: 'Planned' },
      { id: 'cal_acme_1', title: 'Acme Promo', clientId: 'client_acme', scheduledDate: '2026-10-26', platforms: '["LinkedIn"]', status: 'Planned' },
    ],
    workLogs: [
      { id: 'log_priyanshu_1', taskId: 'task_nexus_1', employeeId: 'emp_priyanshu', hoursWorked: 4, date: '2026-10-20', status: 'Completed' },
      { id: 'log_vansh_1', taskId: 'task_acme_1', employeeId: 'emp_vansh', hoursWorked: 5, date: '2026-10-20', status: 'Completed' },
    ],
    attendance: [
      { id: 'att_priyanshu_1', employeeId: 'emp_priyanshu', date: '2026-10-20', status: 'Present', checkIn: '09:00', checkOut: '17:00', hoursWorked: 8 },
      { id: 'att_vansh_1', employeeId: 'emp_vansh', date: '2026-10-20', status: 'Present', checkIn: '09:30', checkOut: '17:30', hoursWorked: 8 },
    ],
    approvals: [
      { id: 'appr_nexus_1', taskId: 'task_nexus_1', clientId: 'client_nexus', title: 'Nexus Logo', status: 'pending' },
    ],
    videoTracker: [
      { id: 'vid_nexus_1', clientId: 'client_nexus', title: 'Nexus Video', status: 'pending_shoot' },
    ],
    payslips: [
      { id: 'ps_priyanshu_10', employeeId: 'emp_priyanshu', employeeName: 'Priyanshu', month: '2026-10', grossPay: 55000, netPay: 51000, status: 'finalized' },
      { id: 'ps_vansh_10', employeeId: 'emp_vansh', employeeName: 'Vansh', month: '2026-10', grossPay: 50000, netPay: 46500, status: 'finalized' },
    ],
    hrDocuments: [
      { id: 'hr_priyanshu_1', docType: 'appointment', employeeId: 'emp_priyanshu', employeeName: 'Priyanshu', status: 'finalized' },
      { id: 'hr_vansh_1', docType: 'appointment', employeeId: 'emp_vansh', employeeName: 'Vansh', status: 'finalized' },
    ],
    users: [
      { userId: 'uid_superadmin', name: 'Super Admin', email: 'dilseinvite@gmail.com', role: 'superAdmin', status: 'active' },
      { userId: 'uid_accounts_lead', name: 'Finance Head', email: 'finance@digiexplode.ai', role: 'accounts', status: 'active' },
      { userId: 'uid_priyanshu', name: 'Priyanshu Dev', email: 'priyanshu@digiexplode.ai', role: 'employee', employeeId: 'emp_priyanshu', status: 'active' },
      { userId: 'uid_nexus_client', name: 'Nexus Rep', email: 'nexus@nexuscoaching.com', role: 'client', clientId: 'client_nexus', status: 'active' },
      { userId: 'uid_inactive', name: 'Deactivated User', email: 'inactive@digiexplode.ai', role: 'employee', status: 'inactive' },
    ]
  };

  prepare(sql: string) {
    return new MockD1Statement(sql, [], this);
  }

  executeAll(sql: string, binds: any[]): { results: any[] } {
    const s = sql.trim();

    // SELECT users
    if (s.includes('FROM users')) {
      if (s.includes('WHERE userId = ?')) {
        const id = binds[0];
        const res = this.tables.users.filter(u => u.userId === id);
        return { results: res };
      }
      return { results: [...this.tables.users] };
    }

    // SELECT employees
    if (s.includes('FROM employees')) {
      if (s.includes('WHERE id = ?')) {
        const id = binds[0];
        const res = this.tables.employees.filter(e => e.id === id || e.employeeId === id);
        return { results: res };
      }
      return { results: [...this.tables.employees] };
    }

    // SELECT clients
    if (s.includes('FROM clients')) {
      if (s.includes('WHERE clientId = ?')) {
        const id = binds[0];
        const res = this.tables.clients.filter(c => c.clientId === id);
        return { results: res };
      }
      return { results: [...this.tables.clients] };
    }

    // SELECT tasks
    if (s.includes('FROM tasks')) {
      if (s.includes('WHERE id = ?')) {
        const id = binds[0];
        const res = this.tables.tasks.filter(t => t.id === id);
        return { results: res };
      }
      let filtered = [...this.tables.tasks];
      if (s.includes('clientId = ?')) {
        const cId = binds[0];
        filtered = filtered.filter(t => t.clientId === cId);
      }
      return { results: filtered };
    }

    // SELECT worklogs
    if (s.includes('FROM workLogs')) {
      if (s.includes('WHERE id = ?')) {
        const id = binds[0];
        return { results: this.tables.workLogs.filter(w => w.id === id) };
      }
      let filtered = [...this.tables.workLogs];
      if (s.includes('employeeId = ?')) {
        const empId = binds[0];
        filtered = filtered.filter(w => w.employeeId === empId);
      }
      return { results: filtered };
    }

    // SELECT attendance
    if (s.includes('FROM attendance')) {
      if (s.includes('WHERE id = ?')) {
        const id = binds[0];
        return { results: this.tables.attendance.filter(a => a.id === id) };
      }
      let filtered = [...this.tables.attendance];
      if (s.includes('employeeId = ?')) {
        const empId = binds[binds.length - 1];
        filtered = filtered.filter(a => a.employeeId === empId);
      }
      return { results: filtered };
    }

    // SELECT payslips
    if (s.includes('FROM payslips')) {
      if (s.includes('WHERE id = ?')) {
        const id = binds[0];
        return { results: this.tables.payslips.filter(p => p.id === id) };
      }
      let filtered = [...this.tables.payslips];
      if (s.includes('employeeId = ?')) {
        const empId = binds[binds.length - 1];
        filtered = filtered.filter(p => p.employeeId === empId);
      }
      return { results: filtered };
    }

    // SELECT hrDocuments
    if (s.includes('FROM hrDocuments')) {
      if (s.includes('WHERE id = ?')) {
        const id = binds[0];
        return { results: this.tables.hrDocuments.filter(h => h.id === id) };
      }
      let filtered = [...this.tables.hrDocuments];
      if (s.includes('employeeId = ?')) {
        const empId = binds[0];
        filtered = filtered.filter(h => h.employeeId === empId);
      }
      return { results: filtered };
    }

    return { results: [] };
  }

  executeRun(sql: string, binds: any[]): { success: boolean } {
    const s = sql.trim();
    if (s.startsWith('INSERT INTO tasks')) {
      this.tables.tasks.push({ id: binds[0], taskId: binds[1], title: binds[2], clientId: binds[7], assigneeId: binds[9], status: binds[4] });
      return { success: true };
    }
    if (s.startsWith('UPDATE tasks')) {
      return { success: true };
    }
    if (s.startsWith('UPDATE users')) {
      return { success: true };
    }
    if (s.startsWith('INSERT INTO workLogs')) {
      this.tables.workLogs.push({ id: binds[0], taskId: binds[1], employeeId: binds[3], status: binds[7] });
      return { success: true };
    }
    if (s.startsWith('INSERT INTO payslips')) {
      this.tables.payslips.push({ id: binds[0], employeeId: binds[1], month: binds[3], grossPay: binds[5], netPay: binds[6] });
      return { success: true };
    }
    return { success: true };
  }
}

// ── JWT Signer for Tests using Web Crypto ────────────────────────────────────
interface KeyBundle {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  jwk: any;
}

async function createTestKeypair(kid = 'test_key_01'): Promise<KeyBundle> {
  const keypair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: { name: 'SHA-256' },
    },
    true,
    ['sign', 'verify']
  );

  const jwk: any = await crypto.subtle.exportKey('jwk', keypair.publicKey);
  jwk.kid = kid;
  jwk.alg = 'RS256';
  jwk.use = 'sig';

  return {
    privateKey: keypair.privateKey,
    publicKey: keypair.publicKey,
    jwk,
  };
}

async function signJwt(payload: Record<string, any>, keyBundle: KeyBundle, headerOverride?: any): Promise<string> {
  const header = headerOverride || {
    alg: 'RS256',
    kid: keyBundle.jwk.kid,
    typ: 'JWT',
  };

  const enc = new TextEncoder();
  const rawHeader = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const rawPayload = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const dataToSign = enc.encode(`${rawHeader}.${rawPayload}`);

  const sigBytes = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyBundle.privateKey, dataToSign);
  const rawSig = base64UrlEncode(new Uint8Array(sigBytes));

  return `${rawHeader}.${rawPayload}.${rawSig}`;
}

// ── TEST HARNESS RUNNER ──────────────────────────────────────────────────────
async function runAllSecurityTests() {
  console.log('\n🔒 RUNNING DIGIEXPLODEAI AUTOMATED SECURITY TEST SUITE (PHASE 2B)\n' + '='.repeat(68));

  const PRIMARY_KEY = await createTestKeypair('firebase_test_key_1');
  const WRONG_KEY = await createTestKeypair('firebase_wrong_key_2');
  const PROJECT_ID = 'gen-lang-client-0746984388';

  const mockDb = new MockD1Database();
  const env: Env = {
    DB: mockDb as any,
    FIREBASE_PROJECT_ID: PROJECT_ID,
    ALLOWED_ORIGINS: 'https://digiexplodeai.vercel.app,http://localhost:3000',
    TEST_JWKS: [PRIMARY_KEY.jwk],
  };

  const nowSec = Math.floor(Date.now() / 1000);

  // Helper token factory
  const createToken = async (opts: {
    uid?: string;
    email?: string;
    exp?: number;
    aud?: string;
    iss?: string;
    isAnon?: boolean;
    key?: KeyBundle;
    header?: any;
  }) => {
    const payload: any = {
      sub: opts.uid || 'uid_priyanshu',
      email: opts.email || 'priyanshu@digiexplode.ai',
      aud: opts.aud || PROJECT_ID,
      iss: opts.iss || `https://securetoken.google.com/${PROJECT_ID}`,
      iat: nowSec - 60,
      auth_time: nowSec - 60,
      exp: opts.exp !== undefined ? opts.exp : nowSec + 3600,
    };
    if (opts.isAnon) {
      payload.firebase = { sign_in_provider: 'anonymous' };
    }
    return signJwt(payload, opts.key || PRIMARY_KEY, opts.header);
  };

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (!condition) {
      console.error(`❌ FAILED: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
    passed++;
    console.log(`✅ PASS: ${msg}`);
  }

  // 1. Missing token → 401
  {
    const req = new Request('https://api.digiexplode.ai/api/tasks', { method: 'GET' });
    const res = await worker.fetch(req, env);
    assert(res.status === 401, 'Test 1: Missing token returns 401 Unauthorized');
  }

  // 2. Malformed token → 401
  {
    const req = new Request('https://api.digiexplode.ai/api/tasks', {
      method: 'GET',
      headers: { Authorization: 'Bearer this.is.not.a.valid.jwt' },
    });
    const res = await worker.fetch(req, env);
    assert(res.status === 401, 'Test 2: Malformed token structure returns 401 Unauthorized');
  }

  // 3. Expired token → 401
  {
    const expiredToken = await createToken({ exp: nowSec - 300 }); // expired 5 mins ago
    const req = new Request('https://api.digiexplode.ai/api/tasks', {
      method: 'GET',
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const res = await worker.fetch(req, env);
    const body: any = await res.json();
    assert(res.status === 401 && body.error.includes('expired'), 'Test 3: Expired token returns 401 Unauthorized');
  }

  // 4. Incorrect Firebase project → 401
  {
    const wrongProjectToken = await createToken({ aud: 'wrong-firebase-project-id' });
    const req = new Request('https://api.digiexplode.ai/api/tasks', {
      method: 'GET',
      headers: { Authorization: `Bearer ${wrongProjectToken}` },
    });
    const res = await worker.fetch(req, env);
    const body: any = await res.json();
    assert(res.status === 401 && body.error.includes('audience'), 'Test 4: Incorrect Firebase project returns 401 Unauthorized');
  }

  // 5. Invalid JWT signature → 401
  {
    // Signed with wrong private key
    const forgedToken = await createToken({ key: WRONG_KEY, header: { alg: 'RS256', kid: PRIMARY_KEY.jwk.kid } });
    const req = new Request('https://api.digiexplode.ai/api/tasks', {
      method: 'GET',
      headers: { Authorization: `Bearer ${forgedToken}` },
    });
    const res = await worker.fetch(req, env);
    assert(res.status === 401, 'Test 5: Forged JWT signature returns 401 Unauthorized');
  }

  // 6. Valid employee token → permitted employee operations
  {
    const empToken = await createToken({ uid: 'uid_priyanshu', email: 'priyanshu@digiexplode.ai' });
    // Should be able to view employee directory (with salary masked to 0)
    const reqEmp = new Request('https://api.digiexplode.ai/api/employees', {
      method: 'GET',
      headers: { Authorization: `Bearer ${empToken}` },
    });
    const resEmp = await worker.fetch(reqEmp, env);
    const list: any = await resEmp.json();
    assert(resEmp.status === 200, 'Test 6a: Valid employee can access permitted employee directory');
    assert(list.every((e: any) => e.monthlySalary === 0), 'Test 6b: Employee directory automatically masks sensitive salaries');
  }

  // 7. Employee requesting another employee's restricted data → 403
  {
    const empToken = await createToken({ uid: 'uid_priyanshu', email: 'priyanshu@digiexplode.ai' });
    // Priyanshu attempts to update Vansh's work log
    const req = new Request('https://api.digiexplode.ai/api/worklogs/log_vansh_1', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${empToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ hoursWorked: 10 }),
    });
    const res = await worker.fetch(req, env);
    assert(res.status === 403, "Test 7: Employee modifying another employee's work log is rejected with 403 Forbidden");
  }

  // 8. Client requesting another client's data → 403
  {
    const clientNexusToken = await createToken({ uid: 'uid_nexus_client', email: 'nexus@nexuscoaching.com' });
    // Nexus client attempts to access Acme task
    const req = new Request('https://api.digiexplode.ai/api/tasks/task_acme_1', {
      method: 'GET',
      headers: { Authorization: `Bearer ${clientNexusToken}` },
    });
    const res = await worker.fetch(req, env);
    assert(res.status === 403, "Test 8: Client accessing another client's task is rejected with 403 Forbidden");
  }

  // 9. Employee requesting payroll → 403
  {
    const empToken = await createToken({ uid: 'uid_priyanshu', email: 'priyanshu@digiexplode.ai' });
    // Employee attempts to generate a payroll entry
    const req = new Request('https://api.digiexplode.ai/api/payslips', {
      method: 'POST',
      headers: { Authorization: `Bearer ${empToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'emp_priyanshu', month: '2026-11', grossPay: 100000 }),
    });
    const res = await worker.fetch(req, env);
    assert(res.status === 403, 'Test 9: Employee generating payroll is rejected with 403 Forbidden');
  }

  // 10. Authorized Accounts user accessing permitted payroll functions → success
  {
    const accountsToken = await createToken({ uid: 'uid_accounts_lead', email: 'finance@digiexplode.ai' });
    const req = new Request('https://api.digiexplode.ai/api/payslips', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accountsToken}` },
    });
    const res = await worker.fetch(req, env);
    assert(res.status === 200, 'Test 10: Authorized Accounts user successfully accesses payroll');
  }

  // 11. Unauthorized role modification → 403
  {
    const empToken = await createToken({ uid: 'uid_priyanshu', email: 'priyanshu@digiexplode.ai' });
    // Employee attempts to escalate own role to superAdmin
    const req = new Request('https://api.digiexplode.ai/api/users/uid_priyanshu', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${empToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'superAdmin' }),
    });
    const res = await worker.fetch(req, env);
    assert(res.status === 403, 'Test 11: Privilege escalation attempt to self-assign role returns 403 Forbidden');
  }

  // 12. Anonymous Firebase user requesting protected data → rejection
  {
    const anonToken = await createToken({ uid: 'anon_guest_123', isAnon: true });
    const req = new Request('https://api.digiexplode.ai/api/tasks', {
      method: 'GET',
      headers: { Authorization: `Bearer ${anonToken}` },
    });
    const res = await worker.fetch(req, env);
    const body: any = await res.json();
    assert(res.status === 401 && body.error.includes('Anonymous'), 'Test 12: Anonymous Firebase token is rejected with 401');
  }

  // 13. Inactive user → rejection
  {
    const inactiveToken = await createToken({ uid: 'uid_inactive', email: 'inactive@digiexplode.ai' });
    const req = new Request('https://api.digiexplode.ai/api/tasks', {
      method: 'GET',
      headers: { Authorization: `Bearer ${inactiveToken}` },
    });
    const res = await worker.fetch(req, env);
    const body: any = await res.json();
    assert(res.status === 403 && body.error.includes('deactivated'), 'Test 13: Inactive/deactivated user is rejected with 403 Forbidden');
  }

  // 14. Direct API calls cannot bypass authorization
  {
    // Multiple endpoints with no token
    const endpoints = ['/api/clients', '/api/employees', '/api/payslips', '/api/hrdocuments', '/api/users'];
    let allFailed = true;
    for (const ep of endpoints) {
      const res = await worker.fetch(new Request(`https://api.digiexplode.ai${ep}`, { method: 'GET' }), env);
      if (res.status !== 401) allFailed = false;
    }
    assert(allFailed, 'Test 14: Direct unauthenticated API calls to all sensitive endpoints return 401');
  }

  // 15. Existing task workflows function under valid authorization
  {
    const adminToken = await createToken({ uid: 'uid_superadmin', email: 'dilseinvite@gmail.com' });
    // 15a: Create task
    const createReq = new Request('https://api.digiexplode.ai/api/tasks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Autonomous AI Campaign', clientId: 'client_nexus', assigneeId: 'emp_priyanshu', status: 'Planned' }),
    });
    const createRes = await worker.fetch(createReq, env);
    assert(createRes.status === 201, 'Test 15a: Authorized administrator can create tasks');

    // 15b: Read tasks
    const readReq = new Request('https://api.digiexplode.ai/api/tasks', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const readRes = await worker.fetch(readReq, env);
    assert(readRes.status === 200, 'Test 15b: Authorized administrator can read and list tasks');

    // 15c: Update task
    const updateReq = new Request('https://api.digiexplode.ai/api/tasks/task_nexus_1', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Completed', completedAt: new Date().toISOString() }),
    });
    const updateRes = await worker.fetch(updateReq, env);
    assert(updateRes.status === 200, 'Test 15c: Authorized administrator can update task status and complete tasks');
  }

  // 16. Health check remains public
  {
    const healthReq = new Request('https://api.digiexplode.ai/api/health', { method: 'GET' });
    const healthRes = await worker.fetch(healthReq, env);
    assert(healthRes.status === 200, 'Test 16: Public health check endpoint remains accessible without authentication');
  }

  console.log('='.repeat(68));
  console.log(`\n🎉 ALL ${passed}/${total} SECURITY AND REGRESSION TESTS PASSED SUCCESSFULLY!\n`);
}

runAllSecurityTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED WITH ERROR:', err);
  process.exit(1);
});
