---
description: Cloudflare D1 Database Rule - Firestore is NOT used for data storage
globs: ["**/*"]
---

# Cloudflare D1 Database Enforcement

1. **Database Source of Truth**:
   - The active database is **Cloudflare D1** (`digiexplodai-db`), deployed through the Cloudflare Worker.
   - Worker API Base: `https://digiexplodai.digiexplodeai.workers.dev`

2. **Prohibition of Firestore for Storage**:
   - Do NOT write or read database records from Firebase Firestore.
   - Firebase is strictly used for authentication (Google Sign-In / Auth tokens) only.
   - All models, services, storage utilities, and components must query and mutate data via `lib/cloudflareApi.ts` or the Cloudflare Worker endpoints.

3. **Environment & Fallback**:
   - `VITE_WORKER_URL=https://digiexplodai.digiexplodeai.workers.dev`
   - Default fallbacks in API helpers must always target `https://digiexplodai.digiexplodeai.workers.dev`.
