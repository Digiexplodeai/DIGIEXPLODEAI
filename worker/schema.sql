-- ============================================================
-- DigiExplodeAI — Cloudflare D1 Schema
-- All agency data — replaces Firebase Firestore
-- ============================================================

-- 1. CLIENTS
CREATE TABLE IF NOT EXISTS clients (
  clientId       TEXT PRIMARY KEY,
  clientName     TEXT NOT NULL,
  businessName   TEXT DEFAULT '',
  category       TEXT DEFAULT 'General',
  contactPerson  TEXT DEFAULT '',
  phone          TEXT DEFAULT '',
  email          TEXT DEFAULT '',
  package        TEXT DEFAULT 'Growth',
  startDate      TEXT DEFAULT '',
  status         TEXT DEFAULT 'Active',
  assignedAdminId TEXT DEFAULT '',
  notes          TEXT DEFAULT '',
  createdAt      TEXT NOT NULL,
  updatedAt      TEXT NOT NULL
);

-- 2. EMPLOYEES
CREATE TABLE IF NOT EXISTS employees (
  id             TEXT PRIMARY KEY,
  employeeId     TEXT,
  name           TEXT NOT NULL,
  email          TEXT DEFAULT '',
  phone          TEXT DEFAULT '',
  role           TEXT DEFAULT 'Team Member',
  designation    TEXT DEFAULT '',
  department     TEXT DEFAULT 'Operations',
  joiningDate    TEXT DEFAULT '',
  status         TEXT DEFAULT 'Active',
  monthlySalary  REAL DEFAULT 0,
  weeklyOff      TEXT DEFAULT 'Sunday',
  notes          TEXT DEFAULT '',
  createdAt      TEXT NOT NULL
);

-- 3. TASKS
CREATE TABLE IF NOT EXISTS tasks (
  id             TEXT PRIMARY KEY,
  taskId         TEXT,
  title          TEXT NOT NULL,
  description    TEXT DEFAULT '',
  status         TEXT DEFAULT 'Planned',
  priority       TEXT DEFAULT 'Medium',
  category       TEXT DEFAULT 'Graphic Design',
  clientId       TEXT DEFAULT '',
  clientName     TEXT DEFAULT '',
  assigneeId     TEXT DEFAULT '',
  assigneeName   TEXT DEFAULT '',
  dueDate        TEXT DEFAULT '',
  scheduledDate  TEXT DEFAULT '',
  completedAt    TEXT DEFAULT '',
  createdAt      TEXT NOT NULL,
  updatedAt      TEXT NOT NULL,
  createdBy      TEXT DEFAULT '',
  format         TEXT DEFAULT '',
  platform       TEXT DEFAULT '',
  notes          TEXT DEFAULT ''
);

-- 4. CONTENT CALENDAR
CREATE TABLE IF NOT EXISTS contentCalendar (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  clientId       TEXT DEFAULT '',
  clientName     TEXT DEFAULT '',
  contentType    TEXT DEFAULT 'Static Post',
  platforms      TEXT DEFAULT '[]',
  status         TEXT DEFAULT 'Planned',
  assigneeId     TEXT DEFAULT '',
  assigneeName   TEXT DEFAULT '',
  scheduledDate  TEXT DEFAULT '',
  dueDate        TEXT DEFAULT '',
  caption        TEXT DEFAULT '',
  notes          TEXT DEFAULT '',
  approvalStatus TEXT DEFAULT 'pending',
  createdAt      TEXT NOT NULL,
  updatedAt      TEXT NOT NULL
);

-- 5. WORK LOGS
CREATE TABLE IF NOT EXISTS workLogs (
  id             TEXT PRIMARY KEY,
  taskId         TEXT DEFAULT '',
  taskTitle      TEXT DEFAULT '',
  employeeId     TEXT DEFAULT '',
  employeeName   TEXT DEFAULT '',
  clientId       TEXT DEFAULT '',
  clientName     TEXT DEFAULT '',
  status         TEXT DEFAULT 'Completed',
  hoursWorked    REAL DEFAULT 0,
  date           TEXT NOT NULL,
  notes          TEXT DEFAULT '',
  createdAt      TEXT NOT NULL
);

-- 6. ATTENDANCE
CREATE TABLE IF NOT EXISTS attendance (
  id             TEXT PRIMARY KEY,
  attendanceId   TEXT,
  employeeId     TEXT DEFAULT '',
  employeeName   TEXT DEFAULT '',
  date           TEXT NOT NULL,
  status         TEXT DEFAULT 'Present',
  checkIn        TEXT DEFAULT '',
  checkOut       TEXT DEFAULT '',
  hoursWorked    REAL DEFAULT 0,
  notes          TEXT DEFAULT '',
  createdAt      TEXT NOT NULL
);

-- 7. APPROVALS
CREATE TABLE IF NOT EXISTS approvals (
  id             TEXT PRIMARY KEY,
  taskId         TEXT DEFAULT '',
  clientId       TEXT DEFAULT '',
  clientName     TEXT DEFAULT '',
  title          TEXT NOT NULL,
  status         TEXT DEFAULT 'pending',
  submittedBy    TEXT DEFAULT '',
  reviewedBy     TEXT DEFAULT '',
  fileUrl        TEXT DEFAULT '',
  notes          TEXT DEFAULT '',
  createdAt      TEXT NOT NULL,
  updatedAt      TEXT NOT NULL
);

-- 8. VIDEO TRACKER
CREATE TABLE IF NOT EXISTS videoTracker (
  id               TEXT PRIMARY KEY,
  clientId         TEXT DEFAULT '',
  clientName       TEXT DEFAULT '',
  title            TEXT NOT NULL,
  status           TEXT DEFAULT 'pending_shoot',
  plannedQuantity  INTEGER DEFAULT 1,
  shotQuantity     INTEGER DEFAULT 0,
  editedQuantity   INTEGER DEFAULT 0,
  videographerId   TEXT DEFAULT '',
  videographerName TEXT DEFAULT '',
  editorId         TEXT DEFAULT '',
  editorName       TEXT DEFAULT '',
  shootDate        TEXT DEFAULT '',
  dueDate          TEXT DEFAULT '',
  footageLink      TEXT DEFAULT '',
  notes            TEXT DEFAULT '',
  createdAt        TEXT NOT NULL,
  updatedAt        TEXT NOT NULL
);

-- 9. PAYROLL
CREATE TABLE IF NOT EXISTS payslips (
  id              TEXT PRIMARY KEY,
  employeeId      TEXT DEFAULT '',
  employeeName    TEXT DEFAULT '',
  month           TEXT NOT NULL,
  annualCTC       REAL DEFAULT 0,
  grossPay        REAL DEFAULT 0,
  netPay          REAL DEFAULT 0,
  deductions      TEXT DEFAULT '{}',
  earnings        TEXT DEFAULT '{}',
  attendance      TEXT DEFAULT '{}',
  status          TEXT DEFAULT 'pending',
  generatedAt     TEXT DEFAULT '',
  createdAt       TEXT NOT NULL,
  updatedAt       TEXT NOT NULL
);

-- 10. HR DOCUMENTS
CREATE TABLE IF NOT EXISTS hrDocuments (
  id              TEXT PRIMARY KEY,
  docType         TEXT NOT NULL,
  employeeId      TEXT DEFAULT '',
  employeeName    TEXT DEFAULT '',
  referenceNumber TEXT DEFAULT '',
  effectiveDate   TEXT DEFAULT '',
  status          TEXT DEFAULT 'draft',
  verificationToken TEXT DEFAULT '',
  fields          TEXT DEFAULT '{}',
  createdAt       TEXT NOT NULL,
  updatedAt       TEXT NOT NULL
);

-- 11. USERS (for auth profile sync)
CREATE TABLE IF NOT EXISTS users (
  userId      TEXT PRIMARY KEY,
  name        TEXT DEFAULT '',
  email       TEXT DEFAULT '',
  role        TEXT DEFAULT 'employee',
  department  TEXT DEFAULT '',
  clientId    TEXT DEFAULT '',
  createdAt   TEXT NOT NULL,
  updatedAt   TEXT NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_clientId ON tasks(clientId);
CREATE INDEX IF NOT EXISTS idx_tasks_assigneeId ON tasks(assigneeId);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_dueDate ON tasks(dueDate);
CREATE INDEX IF NOT EXISTS idx_calendar_clientId ON contentCalendar(clientId);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON contentCalendar(scheduledDate);
CREATE INDEX IF NOT EXISTS idx_worklogs_employeeId ON workLogs(employeeId);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_employeeId ON attendance(employeeId);

-- Initial Clients
INSERT OR IGNORE INTO clients (clientId, clientName, businessName, category, contactPerson, phone, email, package, startDate, status, createdAt, updatedAt)
VALUES 
  ('client_001', 'DigiExplode Media', 'DigiExplode Media Pvt Ltd', 'Marketing & Advertising', 'Priyanshu', '+91 9876543210', 'admin@digiexplode.ai', 'Premium', '2026-01-01', 'Active', datetime('now'), datetime('now')),
  ('client_002', 'Apex Healthcare', 'Apex Health Clinic', 'Healthcare', 'Dr. Sharma', '+91 9876543211', 'contact@apexhealth.com', 'Growth', '2026-02-15', 'Active', datetime('now'), datetime('now'));
