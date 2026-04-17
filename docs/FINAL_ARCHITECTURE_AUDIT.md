# COMPREHENSIVE CRM MONOREPO AUDIT REPORT

**Date:** 2026-04-16
**Auditor:** Claude (Staff-level Engineering Audit)
**Codebase:** CRM-APP-MONOREPO-PROD

---

## 1. System Overview

This is a **field verification CRM** used by a company (AllCheck Services) to manage physical address/identity verification cases for banks and financial institutions. The system covers the complete lifecycle:

**Business Domain:** A bank client submits verification cases → the CRM creates tasks → assigns them to field agents → agents visit addresses, capture geo-tagged photos, fill verification forms → data is reviewed → reports are generated → invoices and commissions are calculated.

**Architecture:**

```
┌─────────────────────┐     ┌───────────────────┐     ┌─────────────────────┐
│   CRM-FRONTEND      │     │   CRM-BACKEND     │     │  crm-mobile-native  │
│   React 19 + Vite   │────▶│   Express 5 + PG  │◀────│  React Native 0.84  │
│   Web Dashboard      │     │   Node.js API     │     │  SQLite offline-first│
│   ~79K lines TS/TSX │     │   ~105K lines TS  │     │  ~35K lines TS/TSX  │
└─────────────────────┘     └───────┬───────────┘     └─────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
               PostgreSQL       Redis          Socket.IO
               (raw SQL)     (cache/queue)    (real-time)
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                Firebase FCM    Google Gemini   SMTP Email
                (push notifs)   (AI reports)   (report delivery)
```

**Total codebase: ~220K lines of TypeScript** across 3 apps.

---

## 2. Repo Structure Breakdown

| Directory | Purpose | Tech Stack |
|---|---|---|
| `CRM-BACKEND/` | REST API server | Express 5, pg (raw SQL), Redis, BullMQ, Socket.IO, JWT |
| `CRM-FRONTEND/` | Admin web dashboard | React 19, Vite 7, React Query, shadcn/ui, React Router 7 |
| `crm-mobile-native/` | Field agent app | React Native 0.84, SQLite (encrypted), offline-first sync |
| `db/backups/` | Database backup scripts | Shell scripts |
| `scripts/` | Root-level utility scripts | Node.js |
| `.github/workflows/` | CI/CD | GitHub Actions |

**Connectivity:** Frontend and Mobile both communicate with the Backend API. Frontend uses REST + WebSocket (Socket.IO). Mobile uses REST with an offline-first sync engine. There is no shared code/types package between apps — types are duplicated.

---

## 3. Backend Deep Dive

### 3.1 API Surface

**46 route files** defining **~300+ endpoints** across these domains:

| Domain | Route prefix | Endpoints |
|---|---|---|
| Auth | `/api/auth` | 6 (login, refresh, logout, me, rate-limit resets) |
| Cases | `/api/cases` | 12 (CRUD, export, dedup, analytics, images) |
| Verification Tasks | `/api/verification-tasks` | 17 (CRUD, assign, revoke, complete, bulk, history) |
| Mobile | `/api/mobile` | 55+ (full parallel API for mobile with sync, forms, attachments, location, telemetry) |
| Users | `/api/users` | 26 (CRUD, territory assignments, client/product assignments, sessions) |
| Clients | `/api/clients` | 7 + document type sub-routes |
| Products | `/api/products` | 7 |
| Dashboard | `/api/dashboard` | 10 KPI/chart endpoints |
| Reports | `/api/reports` | 15 (cases, users, clients, invoices, MIS, analytics) |
| Exports | `/api/exports` | 18 (generate, download, scheduled reports) |
| Invoices | `/api/invoices` | 10 |
| Commissions | `/api/commissions` + `/api/commission-management` | 7 + 12 |
| Attachments | `/api/attachments` | 10 |
| KYC | `/api/kyc` | 8 |
| RBAC | `/api/rbac` + `/api/roles` | 10 + 10 (partially duplicated) |
| Notifications | `/api/notifications` | 14 |
| Locations | `/api/countries,states,cities,pincodes,areas` | 40+ (CRUD + bulk import) |
| AI Reports | `/api/ai-reports` + `/api/template-reports` | 4 + 4 |
| Other | health, audit-logs, security, field-monitoring, etc. | 20+ |

### 3.2 Database

**Driver:** `pg` (node-postgres) — **no ORM, all raw SQL**.

**Schema:** ~80+ tables across these domains:
- **Core business:** `cases`, `verification_tasks`, `applicants`, `visits`, `verifications`
- **9 verification report tables:** `residence_verification_reports`, `office_verification_reports`, `business_verification_reports`, `builder_verification_reports`, etc.
- **Forms/submissions:** `form_submissions`, `task_form_submissions`, `auto_saves`
- **Financial:** `commission_calculations`, `commission_rate_types`, `rates`, `service_zone_rules`
- **Auth/RBAC:** `users`, `roles_v2`, `permissions`, `user_roles`, `role_permissions`, `refreshTokens`
- **Territory/Geo:** areas, pincodes, cities, states, countries with assignment junction tables
- **Case data entry:** `case_data_templates`, `case_data_template_fields`, `case_data_entries`, `case_data_values` (with trigger-based projection sync)

**Pool:** Dynamic sizing based on `TOTAL_CONCURRENT_USERS` (default 2000 → 333 max connections). 25s statement timeout. Transaction wrapper with deadlock auto-retry (6 retries).

**Key DB pattern:** `camelizeRow()` at the pool boundary converts all `snake_case` column names to `camelCase`, but **additively** — both keys exist on the same object. This has already caused a production bug (documented as "B3 fix" in `verificationTasks.ts`).

### 3.3 Core Business Flows

**Case Creation → Assignment → Field Work → Submission → Review → Report → Billing:**

1. **Case Creation** (`POST /api/cases/create`): Validates client+product config, deduplication check, creates `cases` row + `applicants`, optionally creates verification tasks immediately via `verificationTaskCreationService`. Financial configuration validated pre-creation.

2. **Task Assignment** (`POST /verification-tasks/:taskId/assign`): Validates scope access (client/product/pincode), checks field agent availability, updates `verification_tasks.assigned_to`, writes `task_assignment_history`. BullMQ `caseAssignmentProcessor` handles async assignment queuing.

3. **Field Work** (Mobile): Agent receives assignment via sync download → starts visit (`POST /mobile/verification-tasks/:taskId/start`) → captures geo-tagged photos → fills dynamic verification form → submits (`POST /mobile/verification-tasks/:taskId/verification/{type}`).

4. **Form Submission** (Mobile → Backend): Type-specific endpoints (residence, office, business, etc.) receive form data + validate → write to corresponding `*_verification_reports` table → update task status to COMPLETED → trigger commission calculation.

5. **Review/Rework**: Tasks can be revisited (`POST /verification-tasks/revisit/:taskId`) which resets status. Tasks can be revoked (`POST /verification-tasks/:taskId/revoke`).

6. **Report Generation**: AI reports via Google Gemini (`POST /api/ai-reports/.../generate`) or template-based reports (`POST /api/template-reports/.../generate`). PDF generation via Puppeteer. Excel/CSV export via exceljs/papaparse.

7. **Billing**: Commission auto-calculated on task completion based on rate types, service zone rules, and field agent assignments. Invoices created, approved, marked paid via `/api/invoices` and `/api/commissions`.

### 3.4 Auth System

**Dual JWT tokens:**
- Access token (1-day default) — in-memory on frontend, Keychain on mobile
- Refresh token (30-day) — HttpOnly SameSite=Strict cookie (browser), Keychain (mobile)
- CSRF guard on refresh endpoint via Origin allowlist + `X-Requested-With` header

**RBAC:** 6 roles (`SUPER_ADMIN`, `MANAGER`, `TEAM_LEADER`, `BACKEND_USER`, `FIELD_AGENT`, `KYC_VERIFIER`) with ~40+ permission codes. Wildcard `*` for super-admin. Per-request auth context loaded from DB with 30s process-local cache.

### 3.5 Backend Issues Found

| Severity | Issue | Location |
|---|---|---|
| **CRITICAL** | `/uploads` directory served without authentication — KYC documents, verification photos accessible to anyone with a URL | `CRM-BACKEND/src/app.ts:159` |
| **HIGH** | `.env` and `.env.bak` exist on disk (though gitignored — verify no secrets leaked in git history) | `CRM-BACKEND/.env` |
| **HIGH** | Inline SQL in route files (verificationTasks.ts, security.ts) — 80+ line handlers with raw SQL in route layer, violating separation of concerns | `src/routes/verificationTasks.ts` |
| **HIGH** | Stub/placeholder routes in production (forms.ts, user.ts) return fake responses, could confuse API consumers | `src/routes/forms.ts`, `src/routes/user.ts` |
| **HIGH** | Duplicate RBAC route registration — `/api/rbac` and `/api/roles` mount near-identical CRUD for roles/permissions | `src/routes/rbac.ts`, `src/routes/roles.ts` |
| **MEDIUM** | camelCase/snake_case dual-key pattern is a live footgun (already caused B3 bug) | `src/utils/rowTransform.ts` |
| **MEDIUM** | Legacy role middleware stubs (`requireRole`, `requireAdmin`, etc.) always return 403 — any route accidentally using them is broken | `src/middleware/auth.ts` |
| **MEDIUM** | `bull` v4 AND `bullmq` v5 are both installed — should consolidate to one | `package.json` |
| **MEDIUM** | Both `bcrypt` and `bcryptjs` installed (native + pure-JS) | `package.json` |
| **MEDIUM** | Migrations disabled in production (`runMigrations()` commented out in index.ts) — schema changes require manual DB import | `src/index.ts` |
| **LOW** | ~49K lines across 62 controller files — some controllers are 2800+ lines (usersController.ts) | `src/controllers/` |

---

## 4. Frontend Analysis

### 4.1 Architecture

**Stack:** React 19 + Vite 7 + TypeScript 5.9 + React Router 7 + React Query 5 + shadcn/ui (Radix + Tailwind)

**50 routes** (2 public, 48 protected) covering: dashboard, cases, tasks (6 filtered views + TAT monitoring), clients, products, locations (6 geo levels), users, billing, commissions, reports, analytics, MIS, KYC, RBAC admin, settings, field monitoring.

### 4.2 State Management

**Dual approach (React Query primary, Redux legacy):**
- React Query handles all data fetching via domain-specific hooks (`useCases`, `useUsers`, etc.)
- Redux Toolkit store exists with 4 slices (`cases`, `users`, `ui`, `cache`) but appears to be legacy/unused
- `enterpriseStore.ts` defines Redux store, but it's unclear if a `<Provider>` wraps the app tree — likely dead code from a migration to React Query

### 4.3 API Layer

- `ApiService` singleton with axios, auto-retry (3 attempts, exponential backoff), in-memory cache (5min TTL, 1000 max), ETag support
- Token refresh with queued-request replay pattern (prevents race conditions)
- Runtime Zod schema validation on API responses (non-strict mode logs drift, doesn't break)

### 4.4 Frontend Issues Found

| Severity | Issue | Location |
|---|---|---|
| **HIGH** | Redux store appears dead/legacy — entire `enterpriseStore.ts` + `enterpriseApiClient.ts` should be removed if React Query fully replaced it | `src/store/` |
| **MEDIUM** | Dead page files: `FormViewerPage.tsx`, `RolePermissionsAdminPage.tsx` — removed from routes but files remain | `src/pages/` |
| **MEDIUM** | Duplicate service files: `rateTypes.ts` + `rateTypeApi.ts`, `commissionManagement.ts` + `commissionManagementApi.ts` — two implementations of the same API | `src/services/` |
| **MEDIUM** | Two notification libraries installed: `sonner` (active) + `react-hot-toast` (unused) | `package.json` |
| **MEDIUM** | Two chart libraries installed: `recharts` 3.x + `chart.js` 4.x | `package.json` |
| **MEDIUM** | Duplicate types files: `form.ts` + `forms.ts` in types directory | `src/types/` |
| **LOW** | `BaseApiService` exports `apiService` name that shadows the core `apiService` from `api.ts` — confusing imports | `src/services/base.ts` |
| **LOW** | `logger.warn` used for info-level messages (token refresh success, API init) — pollutes console | `src/services/api.ts` |
| **LOW** | `.DS_Store` files checked into repo in multiple directories | Various |

---

## 5. Mobile App Analysis

### 5.1 Architecture

**Stack:** React Native 0.84 + React 19 + SQLite (encrypted via SQLCipher) + offline-first sync engine

**Screens:** 16 screens across auth (login, force-update), main tabs (5 task-status-filtered lists), task detail, verification form, camera/watermark, profile, sync logs, data cleanup

**Navigation:** Stack + Bottom Tab hybrid. Deep linking via `crmapp://` scheme.

### 5.2 Offline-First Design (Impressive)

This is the most architecturally mature component of the system:

- **SQLite as source of truth** — 13 tables including task store, attachment tracking, form submissions, sync queue, audit log, notification store, key-value store, and 3 read-optimized projection tables
- **Sync queue** with priority levels (CRITICAL → LOW), CAS lease system to prevent double-processing, dynamic lease timeouts based on payload size
- **Conflict resolution** via `SyncConflictResolver` — local wins if sync queue has pending items, server wins if clock skew > 1 hour, freshness comparison otherwise
- **Background sync daemon** every 5 minutes + triggered on network reconnect + FCM push
- **Projection tables** for read performance (denormalized views updated by `ProjectionUpdater`)
- **Custom ProjectionStore** (observable pattern, no Redux) for in-memory read cache with LRU eviction at 500 tasks

### 5.3 Photo Pipeline

- VisionCamera at 720p → GPS watermark composited via ViewShot → saved to `photos/` dir with thumbnail → attachment enqueued in sync queue
- Two-phase GPS resolve (fast 3s + precise 15s) for immediate UX + accurate final stamp
- `WatermarkReStampQueue` handles deferred re-rendering when address isn't ready at save time
- Max 20 files per task, mandatory min 5 photos + 1 selfie for submission
- Post-sync cleanup deletes local files (keeps DB records pointing to remote URLs)

### 5.4 Security

- **SQLCipher encryption** with 64-char hex key from Keychain (release builds)
- **No AsyncStorage** — everything in encrypted SQLite or Keychain
- **FCM payload hardening:** Zod validation + type allowlist + actionUrl scheme allowlist
- **Push navigation hardening:** taskId validated via regex + DB existence before navigate

### 5.5 Mobile Issues Found

| Severity | Issue | Location |
|---|---|---|
| **HIGH** | SSL pinning not implemented (comment says "planned" but not done) — MITM risk | `src/api/apiClient.ts` |
| **MEDIUM** | No biometric auth (Face ID/TouchID) — device lock screen is the only barrier | Auth flow |
| **MEDIUM** | `LegacyFormTemplateBuilders.ts` contains hardcoded form templates as fallback — these can drift from server-defined templates | `src/screens/forms/` |
| **MEDIUM** | Form upload defers up to 15 times (~75 min) waiting for attachment uploads — edge case where a very large set of photos could delay form submission beyond user expectation | `src/sync/uploaders/FormUploader.ts` |
| **LOW** | Reverse geocoding for watermark depends on external service (Google Maps?) — no graceful degradation if the service is down beyond the re-stamp queue | `WatermarkPreviewScreen.tsx` |

---

## 6. End-to-End Flow Mapping

### Complete Case Lifecycle

```
BANK CLIENT                  WEB DASHBOARD                    BACKEND API                         MOBILE APP
─────────────────────────────────────────────────────────────────────────────────────────────────────────────

1. Submit Case Request
                          → POST /api/cases/create ──────→ INSERT cases, applicants
                            (CaseCreationStepper)           Dedup check (fuzzy match)
                                                            Financial config validation
                                                            INSERT verification_tasks (1 per type)
                                                            INSERT task_assignment_history
                                                            ← 201 Created

2. Assign to Field Agent
                          → POST /api/verification-         UPDATE verification_tasks.assigned_to
                            tasks/:id/assign                 INSERT task_assignment_history
                            (TaskAssignmentModal)            FCM push → CASE_ASSIGNED
                                                            Cache invalidation
                                                            ← 200 OK
                                                                                            ← FCM push received
                                                                                              SyncEngine.performSync()
3. Field Agent Receives                                                                     → GET /api/mobile/sync/download
                                                          ← paginated task list              ← upsertTaskFromServer()
                                                            (conflict resolution)              ProjectionUpdater.rebuild()

4. Start Visit                                                                              → POST /api/mobile/verification-
                                                          ← UPDATE tasks.status=IN_PROGRESS    tasks/:id/start
                                                            INSERT task_status_transitions     (idempotent)

5. Capture Photos                                                                             CameraCaptureScreen
                                                                                              → WatermarkPreviewScreen
                                                                                              → GPS 2-phase resolve
                                                                                              → ViewShot composite
                                                                                              → CameraService.savePhoto()
                                                                                              → INSERT attachments (local)
                                                                                              → SyncQueue.enqueue(ATTACHMENT)

6. Fill Verification Form                                                                     VerificationFormScreen
                                                                                              Step 1: photos (min 5+1)
                                                                                              Step 2: select outcome
                                                                                              Step 3: dynamic form fields
                                                                                              → useFormAutosave (debounced)
                                                                                            → POST /api/mobile/.../auto-save

7. Submit Verification                                                                        SubmitVerificationUseCase
                                                                                              → INSERT form_submissions (local)
                                                                                              → SyncQueue.enqueue(FORM_SUBMISSION)
                                                                                              → SyncService.performSync()

8. Sync Upload                                                                              → POST /api/mobile/verification-
                                                          ← Idempotency-Key check             tasks/:id/attachments (multipart)
                                                            INSERT verification_attachments  → POST /api/mobile/verification-
                                                            sharp thumbnail generation         tasks/:id/verification/residence
                                                          ← INSERT residence_verification_   ← 200 OK / 409 (already submitted)
                                                            reports
                                                            UPDATE verification_tasks
                                                              .status=COMPLETED
                                                            Commission calculation trigger
                                                            Case status sync

9. Review (Web Dashboard)
                          → GET /api/cases/:id ──────────→ SELECT cases + tasks + forms
                            (CaseDetailPage)                 + attachments + reports
                          → GET /api/verification-images
                            (VerificationImages)

10. Generate Report
                          → POST /api/ai-reports/         → Google Gemini API call
                            .../generate                     Generate narrative report
                            (GenerateReportDialog)         → Puppeteer PDF render
                          ← Download PDF                   ← PDF stored, URL returned

11. Invoice & Commission
                          → POST /api/invoices ───────────→ INSERT invoices (auto-calculated
                            (CreateInvoiceDialog)            from rates + service zones)
                          → POST /api/commissions/         → UPDATE commission_calculations
                            :id/approve                      .status=APPROVED
                            (CommissionsTable)
```

### DB Changes Per Step

| Step | Tables Modified |
|---|---|
| Case Creation | `cases`, `applicants`, `verification_tasks`, `case_timeline_events`, `task_assignment_history` |
| Assignment | `verification_tasks`, `task_assignment_history`, `notifications` |
| Start Visit | `verification_tasks`, `task_status_transitions`, `locations` |
| Photo Capture | `verification_attachments`, `locations` |
| Form Submit | `*_verification_reports`, `form_submissions`, `verification_tasks`, `task_status_transitions` |
| Commission | `commission_calculations`, `task_commission_calculations` |
| Invoice | `invoices` (lines from commission data) |

---

## 7. Key Issues & Risks

### CRITICAL

1. **Unauthenticated file serving** — `express.static('/uploads')` serves verification photos, KYC documents, and case attachments without any authentication. Anyone with a direct URL can access sensitive identity documents and verification evidence.
   - **Location:** `CRM-BACKEND/src/app.ts:159`

2. **No SSL pinning on mobile** — The mobile app communicates over HTTPS but has no certificate pinning. In hostile network environments (field agents on public WiFi), this enables MITM attacks on the API traffic containing personal data and verification evidence.
   - **Location:** `crm-mobile-native/src/api/apiClient.ts`

### HIGH

3. **Inline SQL in route handlers** — The `verificationTasks.ts` route file contains ~80-line inline SQL handlers including bulk-assign with transaction management. This violates separation of concerns and makes the code harder to test, audit, and maintain.

4. **Dead Redux store** — The entire Redux Toolkit setup (`enterpriseStore.ts`, `enterpriseApiClient.ts`, 4 slices) appears to be legacy code from before the React Query migration. It adds ~2000 lines of unused code and dependency weight.

5. **Stub endpoints in production** — `src/routes/forms.ts` and `src/routes/user.ts` contain placeholder handlers that return fake/empty responses. These are mounted on the production API router.

6. **Duplicate RBAC routes** — Both `/api/rbac/roles` and `/api/roles` expose nearly identical role CRUD operations, creating confusion about which is canonical.

### MEDIUM

7. **camelCase/snake_case dual-key pattern** — The additive row transform means `row.case_id` and `row.caseId` coexist. This already caused a production bug (B3) and is a persistent footgun for any new inline handler.

8. **Duplicate dependency installations** — `bull` + `bullmq`, `bcrypt` + `bcryptjs`, `sonner` + `react-hot-toast`, `recharts` + `chart.js` — unnecessary bundle/install weight.

9. **No shared types package** — TypeScript interfaces for API contracts are duplicated across all 3 apps. Changes to an API response shape require manual sync in 3 places.

10. **Legacy form templates in mobile** — `LegacyFormTemplateBuilders.ts` hardcodes form definitions as a fallback when server templates aren't available. These can silently drift from the canonical server definitions.

11. **Mobile form upload defer limit** — The `FormUploader` waits up to ~75 minutes for all attachments to upload before submitting the form. For agents with poor connectivity uploading many photos, this could mean the form submission is significantly delayed or stuck.

12. **49K lines across 62 controllers** — Several controllers exceed 2000 lines (`usersController.ts`: 2802, `verificationTasksController.ts`: 2644). These are monolithic and hard to maintain.

### LOW

13. **Dead page files** — `FormViewerPage.tsx`, `RolePermissionsAdminPage.tsx` removed from routes but not from disk.
14. **Duplicate service files** — `rateTypes.ts`/`rateTypeApi.ts`, `commissionManagement.ts`/`commissionManagementApi.ts`.
15. **Logger misuse** — `logger.warn()` used for info-level events (successful token refresh, service init).
16. **`.DS_Store` files** tracked in frontend repo.

---

## 8. Quick Wins (DO NOT IMPLEMENT — Suggestions Only)

These are suggestions ordered by impact/effort ratio:

1. **Add auth middleware to `/uploads` static serving** — Wrap the `express.static` in a middleware that checks JWT. Highest security impact, ~10 lines of code.

2. **Remove stub routes** (`forms.ts`, `user.ts`) — Delete the placeholder endpoints. They serve no purpose and could cause confusion. 2 files deleted.

3. **Delete dead Redux store** — Remove `enterpriseStore.ts`, `enterpriseApiClient.ts`, and all Redux Toolkit dependencies if React Query is fully operational. ~2000 lines removed, bundle size reduced.

4. **Consolidate duplicate packages** — Remove `bull` (keep `bullmq`), `bcryptjs` (keep `bcrypt`), `react-hot-toast` (keep `sonner`), one of `recharts`/`chart.js`.

5. **Extract inline SQL from verificationTasks.ts** — Move the bulk-assign, assignment-history, and task-detail inline handlers into the controller/service layer. Pure refactor, no behavior change.

6. **Delete dead page files** — Remove `FormViewerPage.tsx`, `RolePermissionsAdminPage.tsx`. Simple cleanup.

7. **Merge duplicate service files** — Consolidate `rateTypes.ts`+`rateTypeApi.ts` and `commissionManagement.ts`+`commissionManagementApi.ts` into single files.

8. **Remove one of the duplicate RBAC route files** — Choose `/api/rbac` or `/api/roles` as canonical and deprecate/remove the other.

9. **Create a shared types package** — Even a simple `crm-shared-types/` directory with API contract interfaces would prevent drift between frontend, backend, and mobile.

10. **Implement SSL pinning on mobile** — Use `react-native-ssl-pinning` or TrustKit. Significant security improvement for field agent devices.

---

## 9. Summary Mental Model

Think of this system as **three concentric circles**:

**Inner circle (Mobile):** The most architecturally mature component. Clean offline-first design with SQLite, sync queue, conflict resolution, projection tables, encrypted storage, hardened FCM handling. The ~35K lines are well-structured with clear separation (use cases, repositories, services, sync engine).

**Middle circle (Backend):** Large (~105K lines) but functional. The raw SQL approach gives fine-grained control but creates maintenance burden. The middleware/auth/RBAC system is comprehensive. Main issues are organizational: inline SQL in routes, dead code, duplicate packages, and the critical unauthenticated file serving.

**Outer circle (Frontend):** Standard React Query + shadcn/ui dashboard (~79K lines). Clean routing and permission system. Main debt is the dead Redux store and duplicate service files from an incomplete migration.

**The seams between circles are the weak points:** no shared types, the camelCase/snake_case conversion at the DB boundary, and the sync protocol between mobile and backend (which is well-designed but complex).

---

## Appendix A: Technology Inventory

### Backend Dependencies
| Package | Version | Purpose |
|---|---|---|
| `express` | ^5.1.0 | HTTP framework |
| `pg` | ^8.16.3 | PostgreSQL driver (raw SQL, no ORM) |
| `redis` | ^5.8.2 | Cache + rate limiting |
| `bullmq` / `bull` | ^5.56.9 / ^4.16.5 | Job queues |
| `jsonwebtoken` | ^9.0.2 | JWT auth |
| `bcrypt` / `bcryptjs` | ^6 / ^3 | Password hashing |
| `multer` | ^2.0.2 | File uploads |
| `socket.io` | ^4.8.1 | WebSocket |
| `@google/generative-ai` | ^0.24.0 | Gemini AI reports |
| `firebase-admin` | ^13.0 | FCM push notifications |
| `@parse/node-apn` | ^8.0 | APNS push notifications |
| `nodemailer` | ^8.0.5 | Email delivery |
| `helmet` | ^8.1 | Security headers |
| `puppeteer` | ^24 | PDF generation |
| `sharp` | ^0.34 | Image processing/thumbnails |
| `winston` | ^3.17 | Structured logging |
| `@opentelemetry/*` | various | Distributed tracing |

### Frontend Dependencies
| Package | Version | Purpose |
|---|---|---|
| `react` | 19.2 | UI framework |
| `react-router-dom` | 7.8 | Routing |
| `@tanstack/react-query` | 5.x | Data fetching |
| `axios` | 1.11 | HTTP client |
| `@reduxjs/toolkit` | (legacy) | State management (unused?) |
| `react-hook-form` + `zod` | 7.x / 4.x | Form handling + validation |
| `recharts` + `chart.js` | 3.x / 4.x | Charts (duplicate) |
| `socket.io-client` | 4.x | Real-time notifications |
| `@opentelemetry/*` | various | Frontend tracing |

### Mobile Dependencies
| Package | Version | Purpose |
|---|---|---|
| `react-native` | 0.84.1 | Mobile framework |
| `react-native-sqlite-storage` | ^6.0.1 | Local SQLite database |
| `react-native-keychain` | ^10.0.0 | Secure token storage |
| `react-native-vision-camera` | ^4.7.3 | Camera capture |
| `react-native-view-shot` | ^4.0.3 | Watermark compositing |
| `react-native-fs` | ^2.20.0 | File system |
| `@react-native-firebase/messaging` | ^23.8.6 | FCM push |
| `@react-native-community/geolocation` | ^3.4.0 | GPS/location |
| `axios` | ^1.13.6 | HTTP client |
| `zod` | ^4.3.6 | Schema validation |

### RBAC Roles
| Role | Scope |
|---|---|
| `SUPER_ADMIN` | Full access (wildcard `*`) |
| `MANAGER` | Scoped to assigned clients/products |
| `TEAM_LEADER` | Scoped + reports + KYC |
| `BACKEND_USER` | Data entry, case management, MIS, billing |
| `FIELD_AGENT` | Task ownership enforced |
| `KYC_VERIFIER` | KYC document verification |

---

## Appendix B: Full Route Listing

### Auth Routes (`/api/auth`)
```
POST   /login                          → login
POST   /refresh-token                  → refreshToken
POST   /logout                         → logout
GET    /me                             → getCurrentUser
POST   /reset-rate-limit               → resetRateLimit (admin)
POST   /reset-user-rate-limit/:userId  → resetUserRateLimit (admin)
```

### Case Routes (`/api/cases`)
```
GET    /                                            → getCases
POST   /config-validation                           → validateCaseConfiguration
POST   /create                                      → createCase
POST   /dedupe/global-search                        → searchGlobalDuplicates
GET    /export                                      → exportCases
GET    /analytics/field-agent-workload              → getFieldAgentWorkload
GET    /verification-images/:imageId/serve          → serveVerificationImage
GET    /verification-images/:imageId/thumbnail      → serveVerificationThumbnail
GET    /:id/summary                                 → getCaseSummaryWithTasks
GET    /:id/verification-images                     → getVerificationImages
GET    /:id                                         → getCaseById
PUT    /:id                                         → updateCase
```

### Verification Task Routes (`/api/verification-tasks`)
```
GET    /verification-tasks                              → getAllTasks
GET    /verification-tasks/export                       → exportTasksToExcel
POST   /verification-tasks/revisit/:taskId             → revisitTask
POST   /verification-tasks/bulk-assign                 → bulkAssign
GET    /verification-tasks/:taskId/validate            → validateTask
GET    /verification-tasks/:taskId/assignment-history  → getAssignmentHistory
POST   /verification-tasks/:taskId/start               → startTask
POST   /verification-tasks/:taskId/cancel              → cancelTask
POST   /verification-tasks/:taskId/assign              → assignTask
POST   /verification-tasks/:taskId/revoke              → revokeTask
POST   /verification-tasks/:taskId/complete            → completeTask
PUT    /verification-tasks/:taskId                     → updateTask
GET    /verification-tasks/:taskId                     → getTaskById
POST   /cases/:caseId/verification-tasks               → createMultipleTasksForCase
GET    /cases/:caseId/verification-tasks               → getTasksForCase
```

### Mobile Routes (`/api/mobile`) — 55+ endpoints
```
Auth:      login, refresh, logout, version-check, config, notifications/register
Tasks:     GET tasks, GET task/:id, GET status, POST start, POST complete, POST revoke, POST operations
Forms:     POST verification/{type} (9 types), POST forms, GET forms, POST/GET auto-save
Attach:    POST attachments (multipart), GET attachments, DELETE attachment, GET verification-images
Location:  POST capture, POST validate, GET reverse-geocode, GET location-history, GET trail
Sync:      POST enterprise, POST upload, GET download, GET changes, GET status, GET health
Other:     POST telemetry/ingest, POST audit/logs, PUT priority
```

### All Other Route Prefixes
```
/api/users                    (26 endpoints)
/api/clients                  (7 + document type sub-routes)
/api/products                 (7 endpoints)
/api/dashboard                (10 endpoints)
/api/reports                  (15 endpoints)
/api/exports                  (18 endpoints)
/api/invoices                 (10 endpoints)
/api/commissions              (7 endpoints)
/api/commission-management    (12 endpoints)
/api/attachments              (10 endpoints)
/api/kyc                      (8 endpoints)
/api/rbac                     (10 endpoints)
/api/roles                    (10 endpoints — duplicate of rbac)
/api/notifications            (14 endpoints)
/api/countries                (7 endpoints)
/api/states                   (7 endpoints)
/api/cities                   (8 endpoints)
/api/pincodes                 (10 endpoints)
/api/areas                    (7 endpoints)
/api/verification-types       (6 endpoints)
/api/document-types           (7 endpoints)
/api/document-type-rates      (4 endpoints)
/api/rate-types               (7 endpoints)
/api/rates                    (5 endpoints)
/api/rate-type-assignments    (5 endpoints)
/api/territory-assignments    (8 endpoints)
/api/service-zone-rules       (6 endpoints)
/api/ai-reports               (4 endpoints)
/api/template-reports         (4 endpoints)
/api/case-data-templates      (7 endpoints)
/api/case-data-entries        (8 endpoints)
/api/deduplication            (4 endpoints)
/api/enhanced-analytics       (5 endpoints)
/api/field-monitoring         (3 endpoints)
/api/audit-logs               (8 endpoints)
/api/security                 (3 endpoints)
/api/health                   (7 endpoints)
/api/departments              (5 endpoints)
/api/designations             (6 endpoints)
```
