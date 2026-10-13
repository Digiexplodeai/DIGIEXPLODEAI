const fs = require('fs');

const employees = [
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

let sql = '';
for (const e of employees) {
  const esc = (s) => (s || '').toString().replace(/'/g, "''");
  sql += `INSERT OR REPLACE INTO employees (id, employeeId, name, email, phone, role, designation, department, joiningDate, status, monthlySalary, weeklyOff, notes, createdAt) VALUES ('${esc(e.id)}', '${esc(e.employeeId || e.id)}', '${esc(e.name)}', '${esc(e.email)}', '${esc(e.phone)}', '${esc(e.role)}', '${esc(e.designation || e.role)}', '${esc(e.department || 'Operations')}', '${esc(e.joiningDate)}', '${esc(e.status || 'Active')}', ${e.monthlySalary || 0}, 'Sunday', '', '${esc(e.createdAt || new Date().toISOString())}');\n`;
}

fs.writeFileSync('worker/seed_employees.sql', sql, 'utf-8');
console.log('Successfully wrote worker/seed_employees.sql');
