const { execSync } = require('child_process');
const fs = require('fs');

const content = execSync('git show 8c83e2e:lib/clientMaster.ts', { encoding: 'utf-8' });
const match = content.match(/export const CENTRAL_CLIENT_MASTER_LIST: CentralClient\[\] = (\[[\s\S]*?\]);\s*export const DEFAULT_CLIENTS_MASTER/);
if (!match) {
  console.error('Match not found');
  process.exit(1);
}

const list = eval(match[1]);

let sql = `-- Remove dummy placeholders
DELETE FROM clients WHERE clientId IN ('client_001', 'client_002');

`;

for (const c of list) {
  const esc = (s) => (s || '').toString().replace(/'/g, "''");
  const cid = esc(c.clientId || c.id);
  const cname = esc(c.clientName || c.name);
  const bname = esc(c.businessName);
  const cat = esc(c.category);
  const cp = esc(c.contactPerson);
  const ph = esc(c.phone);
  const em = esc(c.email);
  const pkg = esc(c.package);
  const sd = esc(c.startDate);
  const st = esc(c.status || 'Active');
  const nt = esc(c.notes || '');
  const ca = esc(c.createdAt || new Date().toISOString());
  const ua = esc(c.updatedAt || new Date().toISOString());

  sql += `INSERT OR REPLACE INTO clients (clientId, clientName, businessName, category, contactPerson, phone, email, package, startDate, status, notes, createdAt, updatedAt) VALUES ('${cid}', '${cname}', '${bname}', '${cat}', '${cp}', '${ph}', '${em}', '${pkg}', '${sd}', '${st}', '${nt}', '${ca}', '${ua}');\n`;
}

fs.writeFileSync('worker/seed_real_clients.sql', sql, 'utf-8');
console.log('Successfully generated worker/seed_real_clients.sql for', list.length, 'clients');
