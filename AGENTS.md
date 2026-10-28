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
