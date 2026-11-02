# DigiExplodeAI — System & Architecture Rules

## 1. Primary Database Architecture (STRICT)
- **DATABASE BACKEND**: The database is exclusively **Cloudflare D1** (`digiexplodai-db`, binding: `DB`), accessed through the Cloudflare Worker API.
- **WORKER API URL**: `https://digiexplodai.digiexplodeai.workers.dev`
- **CLIENT INTERFACE**: All CRUD and persistence operations across the entire application (clients, employees, tasks, work logs, attendance, payroll, calendar) **MUST** use `lib/cloudflareApi.ts` or direct fetch requests to the Cloudflare Worker API endpoints (`/api/clients`, `/api/employees`, `/api/tasks`, `/api/work-logs`, etc.).
- **DO NOT USE FIRESTORE FOR DATABASE STORAGE**: Firestore is **deprecated/prohibited** for data storage. Firebase is only retained for Authentication (Firebase Auth) if needed. Never create, store, or migrate database documents into Firestore.
- **LOCAL & PRODUCTION CONFIGURATION**:
  - `VITE_WORKER_URL=https://digiexplodai.digiexplodeai.workers.dev`
  - The fallback in `lib/cloudflareApi.ts` must always default to `https://digiexplodai.digiexplodeai.workers.dev`.

## 2. Infrastructure & Deployment Links
- **Local Dev Server**: `http://localhost:3000` (runs Vite via `tsx server.ts`)
- **Official Live Website (GoDaddy Custom Domain)**: `https://www.digiexplodeai.com` (Apex domain: `https://digiexplodeai.com`)
- **Live Doctors / Healthcare Page**: `https://www.digiexplodeai.com/doctors`
- **Live Backend & Database (Cloudflare Worker)**: `https://digiexplodai.digiexplodeai.workers.dev`
- **GitHub Repository**: `https://github.com/Digiexplodeai/DIGIEXPLODEAI`


## 3. Cross-Device Multi-User Sync Architecture (PERMANENT RULE)
- **AUTHORITATIVE SOURCE OF TRUTH**: Cloudflare D1 is the single source of truth for all tasks, work logs, attendance, clients, and approvals. Local storage (localStorage) is strictly an optimistic fast-paint cache and must never overwrite newer D1 records or resurrect deleted tasks.
- **AUTOMATIC BACKGROUND SYNC**:
  - Tasks: Background polling interval is 5 seconds (POLL_INTERVAL_MS = 5000) in lib/taskStorage.ts.
  - WorkLogs: Auto-sync polling every 10 seconds in components/Portal/WorkLogView.tsx.
  - Attendance: Auto-sync polling every 10 seconds in components/Portal/AttendanceView.tsx.
  - Window Focus & Visibility: Tab focus and visibility change events trigger instant D1 re-fetching so any user switching between windows or devices sees live data immediately.
- **DEFAULT VIEW & DATE FILTERS**:
  - TasksView.tsx must always default dateFilterMode to ll so all deliverable tasks across all columns (To Do, In Progress, In Review, Done) are visibly accessible immediately across any PC.
  - When in Day mode (day), all past pending tasks must remain visible so active work is never hidden.
- **AUTHENTICATION HEADERS FOR CLOUDFLARE WORKER**:
  - All API calls in lib/cloudflareApi.ts inject X-Agency-Key: digi_emp_session_2026 and X-Agency-* headers (X-Agency-Role, X-Agency-User-Id, X-Agency-Name, X-Agency-Email).
  - Worker authenticates agency sessions seamlessly without relying on third-party auth tokens.
