# CRM-APP-MONOREPO-PROD — Complete Codebase Understanding Report

> **Generated:** 2026-04-15
> **Purpose:** Persistent mental model of the entire system — architecture, data flow, business logic, APIs, risks, and recommendations. Built from code analysis + existing audit documentation. No assumptions; all unclear items flagged explicitly.

---

## Table of Contents

1. [PHASE 1 — Repo Discovery](#phase-1--repo-discovery)
2. [PHASE 2 — Folder & File Level Analysis](#phase-2--folder--file-level-analysis)
3. [PHASE 3 — Architecture Mapping](#phase-3--architecture-mapping)
4. [PHASE 4 — Business Logic](#phase-4--business-logic)
5. [PHASE 5 — API Analysis](#phase-5--api-analysis)
6. [PHASE 6 — Database & Data Flow](#phase-6--database--data-flow)
7. [PHASE 7 — Frontend & Mobile Flow](#phase-7--frontend--mobile-flow)
8. [PHASE 8 — Integrations](#phase-8--integrations)
9. [PHASE 9 — Issues & Risks](#phase-9--issues--risks)
10. [PHASE 10 — Gap Analysis](#phase-10--gap-analysis)
11. [PHASE 11 — Final Structured Report](#phase-11--final-structured-report)
12. [Unclear / Unverified Items](#items-explicitly-marked-unclear--unverified)

---

## PHASE 1 — REPO DISCOVERY

The monorepo contains **three interconnected applications** plus shared infra/docs:

| Repo | Purpose | Tech Stack | Entry Point | Connects To |
|------|---------|-----------|-------------|-------------|
| **CRM-BACKEND** | REST API + WebSocket server for all CRM operations | Node.js 22, Express, TypeScript, PostgreSQL 17 (raw SQL via `pg`), Redis, BullMQ, Socket.IO, JWT | `src/index.ts` → `src/app.ts` | Serves both CRM-FRONTEND (via `/api/*`) and crm-mobile-native (via `/api/mobile/*`). Connects to PostgreSQL (data), Redis (cache/queues/Socket.IO adapter), FCM+APNS (push), SMTP (email), Google Maps, Gemini AI |
| **CRM-FRONTEND** | Admin/ops web dashboard (back-office staff, managers, reviewers) | React 19, Vite 7, TypeScript 5, Tailwind 4, Radix UI, React Query 5, React Router 7, React Hook Form + Zod, Socket.IO client, Axios | `src/main.tsx` → `src/App.tsx` → `src/components/AppRoutes.tsx` | Talks to backend over HTTP (`/api`) + WebSocket (Socket.IO). Access token in-memory, refresh token via HttpOnly cookie |
| **crm-mobile-native** | Field-agent mobile app (offline-first verification execution) | React Native 0.84, React 19, React Navigation 7, SQLite (optional SQLCipher), Keychain, Vision Camera, FCM, Axios | `index.js` → `App.tsx` → `src/navigation/RootNavigator.tsx` | Talks to backend over HTTP (`/api/mobile`). Offline-first: SQLite local mirror + lease-based sync queue. Tokens in Keychain/Keystore. No WebSocket (uses polling + FCM) |
| **db/**, **scripts/**, root `ecosystem.config.js`, `start-production.sh` | Deployment infra | PM2 fork mode, PostgreSQL SQL dumps, shell scripts | — | Launches CRM-BACKEND; frontend served via separate Nginx or static host |

Total: **3 deployable apps + 1 shared database** (acs_db with 97 tables).

---

## PHASE 2 — FOLDER & FILE LEVEL ANALYSIS

### CRM-BACKEND/src/

| Folder | Purpose | Notable files |
|--------|---------|---------------|
| `config/` | Env + infra config | `db.ts` (pg pool 30–500 conns, camelCase transform), `index.ts` (env resolution), `logger.ts`, `queue.ts` (BullMQ) |
| `controllers/` | 54 HTTP handlers | `casesController.ts`, `authController.ts`, `verificationTasksController.ts`, `mobileFormController.ts`, reportControllers |
| `routes/` | 46 route modules mounted at `/api` + `/api/v1` | auth, cases, users, clients, attachments, verification-tasks, reports, exports, mobile, dashboard, kyc, commission, rbac, forms, notifications, audit-logs |
| `middleware/` | 24 middlewares | `auth.ts` (JWT + 30s auth-context cache), `authorize.ts`, `errorHandler.ts`, `rateLimiter.ts`, `upload.ts` (multer), `sanitize.ts` |
| `services/` | 29 business logic services | caseAssignmentService, verificationTaskCreationService, EnterpriseCacheService, CacheWarmingService, PushNotificationService (FCM+APNS), EmailDeliveryService, TemplateReportService (123KB), GeminiAIService, ScheduledReportsService |
| `security/` | Authorization primitives | rbacAccess.ts, userScope.ts, dataScope.ts, notificationScope.ts |
| `utils/` | 37 helpers | audit logging, circuit breaker, CSV parser, 8 per-verification-type form validators, row snake↔camel transform, log redaction |
| `db/`, `migrations/` | Raw SQL migrations | 015_db_cleanup.sql, 016_case_data_entry.sql |
| `websocket/` | Socket.IO handlers | server.ts, mobileEvents.ts, eventTypes.ts |
| `jobs/` + `queues/` | BullMQ processors | caseAssignmentProcessor.ts, auditLogQueue.ts, notificationQueue.ts |
| `types/` | 11 TS interface files | auth, cases, verificationTasks, mobile, api responses, forms |

### CRM-FRONTEND/src/

| Folder | Purpose |
|--------|---------|
| `pages/` (43 files, ~14K LOC) | Full-page components, one per route (LoginPage, CasesPage, TaskDetailPage, RBACAdminPage, FieldMonitoringPage, KYCDashboardPage, RateManagementPage, etc.) |
| `components/ui/` (41 files) | shadcn-style primitives built on Radix UI (button, dialog, table, select, date-range-picker, unified-filter-panel, badge, etc.) |
| `components/` (domain dirs) | cases/, users/, verification-tasks/, forms/, dashboard/, rate-management/, reports/, analytics/, billing/, locations/, clients/, kyc/, auth/, commission/, attachments/, maps/ |
| `services/` (46 files) | Axios wrapper `api.ts`, BaseApiService `base.ts`, per-domain clients (cases, users, clients, verificationTasks, kyc, rateManagement, etc.), `sessionManager.ts` (10min auto-logout), `socket.ts`, Zod schemas under `services/schemas/` |
| `hooks/` (30 files) | useAuth, usePermissions, useStandardizedQuery/Mutation (auto-toast), useCases, useDashboardKPI, useUnifiedSearch (800ms debounce + URL sync), useVerificationTasks, useResponsive |
| `contexts/` | AuthContext, PermissionContext, ThemeContext, LayoutContext |
| `types/` (26 files) | Domain types + `constants.ts` with enums (CASE_STATUS, USER_ROLES, storage keys) |
| `store/` | `enterpriseStore.ts` (Zustand) — **dead code**, unused |

### crm-mobile-native/src/

| Folder | Purpose |
|--------|---------|
| `api/` | apiClient.ts (Axios with JWT refresh, W3C traceparent), endpoints.ts (mirrors `/api/mobile`), Zod schemas |
| `screens/` | 17 screens: auth/, main/ (Dashboard, Profile, DigitalIdCard, SyncLogs), tasks/ (Assigned, InProgress, Saved, Completed, Detail, Attachments), forms/ (VerificationFormScreen) |
| `navigation/` | RootNavigator.tsx — Stack + Tab, deep linking (`crmapp://`), FCM tap-to-navigate |
| `context/` | AuthContext, ThemeContext, TaskContext |
| `database/` | DatabaseService.ts (SQLite, deferred migrations), schema.ts (8 migrations) |
| `repositories/` | Data access: TaskRepository, FormRepository, AttachmentRepository, SyncQueueRepository, LocationRepository |
| `services/` | AuthService, LocationService (stale-fix detection, Phase M27), NotificationService (FCM), CameraService, NetworkService, SyncQueue, VersionService, DatabaseKeyStore (derives SQLCipher key from Keychain) |
| `sync/` | SyncEngine, SyncDownloadService, SyncUploadService, SyncProcessor, SyncRetryPolicy, SyncWatchdogService (M24), SyncScheduler, BackgroundSyncDaemon, per-type uploaders, SyncConflictResolver |
| `usecases/` | StartVisitUseCase, CompleteTaskUseCase, SubmitVerificationUseCase, CapturePhotoUseCase |
| `telemetry/` | MobileTelemetryService (OpenTelemetry) |
| `patches/` (11 patches) | gradle-plugin, netinfo (53K lines), screens, vision-camera, keychain — compatibility fixes for RN 0.84 |

---

## PHASE 3 — ARCHITECTURE MAPPING

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                     │
│  ┌─────────────────┐                  ┌─────────────────────────┐   │
│  │  CRM-FRONTEND   │                  │  crm-mobile-native      │   │
│  │  (React SPA)    │                  │  (React Native)         │   │
│  │  Admin/Ops/KYC  │                  │  Field agents (offline) │   │
│  └────────┬────────┘                  └──────────┬──────────────┘   │
│           │ HTTPS + Socket.IO (WS)               │ HTTPS + FCM      │
│           │ JWT (in-memory) + refresh cookie     │ JWT in Keychain  │
└───────────┼────────────────────────────────────┬─┼──────────────────┘
            ▼                                    ▼ ▼
    ┌──────────────────────────────────────────────────────────────┐
    │                 CRM-BACKEND (Express)                        │
    │   ┌──── Middleware chain ──────────────────────────────┐     │
    │   │ Helmet → CORS → logging → rateLimiter → auth       │     │
    │   │        → authorize → sanitize → validator → route  │     │
    │   └────────────────────────────────────────────────────┘     │
    │                                                              │
    │  /api/*           (web routes, 47 route files)               │
    │  /api/v1/*        (alias for client migration)               │
    │  /api/mobile/*    (mobile routes w/ 50MB body, idempotency)  │
    │  WebSocket `/`    (Socket.IO w/ Redis adapter, rate-limited) │
    │                                                              │
    │  Queues (BullMQ): case-assignment, notifications,            │
    │                   file-processing, geolocation,              │
    │                   background-sync, audit-log                 │
    └─────┬────────────────┬──────────────┬───────────────┬───────┘
          ▼                ▼              ▼               ▼
    ┌──────────┐    ┌────────────┐  ┌──────────┐   ┌─────────────┐
    │PostgreSQL│    │   Redis    │  │FCM/APNS  │   │  Gemini AI  │
    │ acs_db   │    │ cache +    │  │  push    │   │  Google Maps│
    │ 97 tables│    │ queues +   │  │          │   │  SMTP       │
    │          │    │ WS adapter │  │          │   │             │
    └──────────┘    └────────────┘  └──────────┘   └─────────────┘
```

### Data Flow — Request Lifecycle (web)
1. User action in page → hook (`useCases`) → service method → Axios instance
2. Request interceptor attaches Bearer access token + `If-None-Match` etag + request metrics
3. Backend: Helmet → CORS → morgan → rate limiter → `auth.ts` (JWT + 30s auth-context cache) → `authorize.ts` (permission check) → sanitizer → validator → controller
4. Controller → service → raw SQL via `pg` pool → `camelizeRow()` transform → JSON response
5. Response interceptor: on 401 `INVALID_TOKEN`/`TOKEN_EXPIRED` → `/auth/refresh-token` (HttpOnly cookie) → retry queued requests
6. React Query caches (2min stale / 10min gc) → component re-renders

### Data Flow — Mobile offline submission
1. Agent fills form offline → writes to SQLite (`form_submissions`, `attachments`)
2. Operation enqueued into `sync_queue` with status=PENDING + 5min lease
3. SyncScheduler (5min interval) or BackgroundSyncDaemon (iOS headless) triggers SyncEngine
4. SyncEngine: download new assignments → upload queued items via per-type uploaders
5. Each upload: POST `/api/mobile/verification-tasks/:taskId/verification/...` (with `mobile_idempotency_keys` dedup)
6. Backend persists → triggers `update_case_completion_percentage()` → WebSocket broadcast to web reviewers

---

## PHASE 4 — BUSINESS LOGIC

### Core Entities
- **Case** — Customer/client master verification request (`cases`, INT PK, `caseId` string). Status: `PENDING → IN_PROGRESS → COMPLETED | ON_HOLD | REVOKED`. Has 1+ verification_tasks.
- **Verification Task** — Atomic field execution unit (`verification_tasks`, UUID PK). Status: `PENDING → ASSIGNED → IN_PROGRESS → (SAVED) → COMPLETED | REVOKED`. Evidence flags: `is_form_submitted`, `is_location_captured`, `is_photo_captured`, `is_revoked`.
- **Form Submission** — Structured field data (`form_submissions`, JSONB) + per-type report table (residence/office/business/builder/property-individual/property-apf/dsa/noc/residence-cum-office = 9 report tables).
- **Attachment** — Photos/documents (`attachments`, `verification_attachments` link table with unique(task_id, photo_type)).
- **User + Role** — RBAC via `users`, `roles_v2`, `permissions`, `role_permissions`, `user_roles`.
- **Scope assignments** — `userClientAssignments`, `userProductAssignments`, `userPincodeAssignments`, `userAreaAssignments`.

### Case Lifecycle (step-by-step)
1. **Create** — Backend user submits case via `POST /cases`. Validates client+product+verification_type+pincode→area→rate_type.
2. **Task creation** — `verificationTaskCreationService` creates 1+ tasks per case based on required verification types.
3. **Assignment** — `case-assignment` queue processor selects field agent by territory + workload balancing. Records in `case_assignment_history`.
4. **Execution** — Field agent opens mobile app, starts visit (GPS validated within 100m, Phase M27), fills dynamic form, captures watermarked photos, submits.
5. **Sync** — Mobile queues → uploads via `/api/mobile/verification-tasks/:taskId/verification/{type}` with idempotency key.
6. **Review** — Backend reviewer (web KYC dashboard) examines submission, approves/rejects with comments. Records in `task_status_transitions`.
7. **Commission** — On approval: `task_commission_calculations` INSERT using rate from `rateTypes` × territory rules. Aggregated into `commission_payment_batches`.
8. **Revocation** — Admin revokes any stage → `task_revocations` INSERT, `is_revoked=true`, reason logged. No commission paid.
9. **Completion** — Trigger `update_case_completion_percentage()` rolls up on every task status change. Case auto-COMPLETED when % = 100.
10. **Invoice** — Billing module creates `invoices` → `invoice_items` → `invoice_item_tasks` (unique per task).

### Validation Rules (observed)
- Phone: E.164 regex `^\+?[1-9]\d{1,14}$`
- Password: ≥6 chars (weak — backend spec); password policy configurable via SecurityUXPage
- File upload: 50MB max; MIME+extension whitelist (PDF, JPG, PNG, GIF, DOCX, DOC)
- Username: 3–50 chars
- GPS fix: ≤100m accuracy, ≤30s age (mobile M27)
- Form: per-verification-type validators (8 files in `utils/`) — **risk: divergent logic**
- Deduplication: fuzzy match on customer name/phone/address (`caseDeduplicationAudit`)

### Assignment Logic
- `caseAssignmentService.ts` (queue-based, 5 retries exp backoff)
- Filters candidate agents by: territory (pincode∈userPincodeAssignments), client/product access, active status
- Picks least-loaded (current task count)
- Priority ordering: URGENT > HIGH > MEDIUM > LOW

### Review & Approval Flow
- Reviewer on web KYC dashboard (`KYCDashboardPage`, `KYCVerificationPage`) sees PENDING queue
- Views photos + form data + GPS overlay
- Decision: APPROVED / REJECTED / REFERRED (+ reason)
- Revoke path: admin in ops can revoke any COMPLETED task → `task_revocations`

---

## PHASE 5 — API ANALYSIS

### Endpoint groups (~200+ endpoints total)

| Domain | Base Path | Key endpoints | Used by |
|--------|----------|---------------|---------|
| **Auth** | `/api/auth` | POST `/login`, POST `/refresh-token`, GET `/user`, POST `/logout` | LoginPage, AuthContext (web); LoginScreen (mobile) |
| **Cases** | `/api/cases` | GET `/`, GET `/:id`, POST, PUT, DELETE, POST `/:id/verification-tasks`, POST `/export` | CasesPage, CaseDetailPage, NewCasePage, DedupePage |
| **Verification Tasks** | `/api/verification-tasks`, `/api/cases/:id/verification-tasks` | GET, POST `/:id/submit`, POST `/:id/approve`, POST `/:id/reject`, POST `/:id/revoke`, GET `/export` | AllTasksPage, TaskDetailPage, KYC pages |
| **Clients** | `/api/clients` | CRUD + `/:id/document-types` | ClientsPage |
| **Users** | `/api/users`, `/api/user` | CRUD + PATCH `/:id/roles`, `/:id/client-assignments`, `/:id/product-assignments`, `/:id/territory`, GET `/me` | UsersPage, UserPermissionsPage |
| **Attachments** | `/api/attachments` | POST `/upload` (multipart 50MB), GET `/:id`, DELETE `/:id`, GET `/verification-task/:taskId` | CaseDetailPage, TaskDetailPage, mobile |
| **Reports + Analytics** | `/api/reports`, `/api/enhanced-analytics`, `/api/ai-reports` | POST `/`, scheduled reports, AI insights (Gemini) | ReportsPage, AnalyticsPage, MISDashboardPage |
| **Exports** | `/api/exports` | POST `/csv`, POST `/excel` (2-min timeout) | Cases/Tasks export buttons |
| **KYC** | `/api/kyc` | POST, GET, PATCH `/document-verifications/:id` | KYCDashboardPage, KYCVerificationPage |
| **Verification Types** | `/api/verification-types` | CRUD | VerificationTypesPage |
| **RBAC** | `/api/rbac`, `/api/permissions` | GET `/roles`, POST `/roles`, PUT `/roles/:id`, GET `/permissions` | RBACAdminPage, RolePermissionsAdminPage |
| **Forms** | `/api/forms` | GET, POST `/:formId/submit`, GET `/submissions/:id` | FormViewerPage, dynamic forms |
| **Notifications** | `/api/notifications` | GET, PATCH `/:id/read`, POST `/subscribe` | Header/notification bell |
| **Mobile** | `/api/mobile` | auth, sync (6/min), telemetry, location (60/min), cases, tasks, forms | crm-mobile-native only |
| **Dashboard** | `/api/dashboard` | GET `/kpis`, `/case-status-distribution`, `/timeline` | DashboardPage |
| **Audit Logs** | `/api/audit-logs` | GET (read-only) | Admin log viewer |
| **Health** | `/health`, `/health/deep` | liveness + DB/Redis/cache/queue stats | PM2 + monitoring |
| **Rate Management** | `/api/rate-management/*` | rateTypes, serviceZoneRules, rateTypeAssignments, rateAssignments, documentTypeRates | RateManagementPage |
| **Commission** | `/api/commission-management` | rules, payouts, approvals | CommissionsPage, CommissionManagementPage |
| **Field Monitoring** | `/api/field-monitoring` | agent locations, trails | FieldMonitoringPage |
| **Billing** | `/api/invoices` | CRUD | BillingPage |

### Request/Response shape
- Success: `{ success: true, data: T, message?: string }` (sometimes `meta` for pagination)
- Error: `{ success: false, message, error: { code, details? } }`
- Pagination: `?page=1&limit=20` most places; some endpoints use `offset/size` — **inconsistency risk**
- Auth login response shape: both `data.accessToken` and `data.tokens.accessToken` seen in code → AuthService handles both (API versioning artifact)

### Inconsistencies/Risks
- Dual versioning `/api/*` + `/api/v1/*` — no dropdate for legacy
- Mobile uses `/api/mobile` prefix but web uses top-level `/api` — no version header strategy
- Some list endpoints missing cursor-based pagination (large data sets force offset pagination, performance risk)
- `SELECT *` in 20+ controllers returns 30-50 unnecessary columns (audit finding)

---

## PHASE 6 — DATABASE & DATA FLOW

**97 tables in 8 domains** (acs_db, PostgreSQL 17). No ORM — raw SQL via `pg` pool.

### Domain breakdown
1. **Identity & Auth** (8): users, roles_v2, permissions, role_permissions, user_roles, refreshTokens, trusted_devices, notification_tokens
2. **User Scope** (5): userClientAssignments, userProductAssignments, userPincodeAssignments, userAreaAssignments, territoryAssignmentAudit
3. **Case Lifecycle** (9): cases (INT PK), verification_tasks (UUID PK), task_assignment_history, case_assignment_history, case_assignment_queue_status, case_assignment_conflicts, case_status_history, case_timeline_events, caseDeduplicationAudit
4. **Evidence & Forms** (8): verification_attachments, attachments, locations, form_submissions, task_form_submissions, auto_saves + 9 **per-type report tables** (residence, office, business, builder, residenceCumOffice, dsaConnector, propertyIndividual, propertyApf, noc)
5. **Master Data** (17): clients, products, verificationTypes, documentTypes, documentTypeRates, rateTypes, rates, rateHistory, rateTypeAssignments, countries→states→cities→pincodes→areas, pincodeAreas, clientDocumentTypes, clientProducts, productVerificationTypes
6. **Notifications & Monitoring** (10): notifications, notification_delivery_log, notification_preferences, mobile_notification_queue, mobile_notification_audit, mobile_device_sync, performance_metrics, query_performance, system_health_metrics, security_audit_events
7. **Billing & Commission** (8): task_commission_calculations, commission_calculations, commission_payment_batches, commission_batch_items, field_user_commission_assignments, invoices, invoice_items, invoice_item_tasks
8. **Mobile Reliability** (2): mobile_idempotency_keys, mobile_operation_log
9. **Case Data Templates** (3, Apr 2026): case_data_templates, case_data_template_fields, case_data_entries
10. **Legacy** (3): applicants, visits, verifications — still present but non-primary

### ER Summary (text)
```
users ── user_roles ── roles_v2 ── role_permissions ── permissions
  │
  ├── userClientAssignments ──→ clients ──→ products ──→ verificationTypes
  ├── userPincodeAssignments ──→ pincodes ──→ cities ──→ states ──→ countries
  │                                      └──→ pincodeAreas ──→ areas
  ├── refreshTokens, notification_tokens, trusted_devices
  │
  └── (as assigned_to) verification_tasks
                         │
cases ──────────────────→│ (1:N)
 ├── case_assignment_history, case_timeline_events
 ├── caseDeduplicationAudit
 └── (via tasks)
      ├── verification_attachments ──→ attachments
      ├── locations (1:1 with task)
      ├── task_form_submissions ──→ form_submissions (JSONB)
      ├── 9× typed report tables (residenceVerificationReports, etc.)
      ├── task_commission_calculations ──→ commission_payment_batches
      └── invoice_item_tasks ──→ invoice_items ──→ invoices
```

### Data integrity & risks
- **INT PK on cases, UUID PK on verification_tasks** — mixed strategy
- **9 per-type report tables** — schema duplication; new verification type = new table
- **JSONB-heavy form storage** — `camelizeRow` only transforms top-level, JSONB internals stay snake_case → inconsistent responses
- **Mobile SQLite mirrors server tables** — possible divergence over time as server schema evolves
- **Transaction retry logic** wraps writes (6 retries for deadlock/serialization)

### Missing composite indexes (per audit)
- `(assigned_to, status)` on verification_tasks — 50–100× faster agent lists
- `(task_id, status)` on form_submissions — 10–40× faster form queries
- `(pincode, status)` on verification_tasks — 20–50× faster territory queries
- Trigram/FTS on address text
- `(user_id, device_id)` on mobile_device_sync

### Migration state
- Full SQL dump baseline: `db/backups/acs_db_2026-02-25_final_full.sql` (97 tables, 16 views, 47 funcs, 51 triggers)
- `CRM-BACKEND/migrations/` — incremental SQL post-baseline
- **015_db_cleanup.sql (2026-04-12):** dropped 48 duplicate indexes, pruned test data, reset sequences
- **016_case_data_entry.sql (2026-04-13):** added case_data_templates + fields + entries; permission `case_data_template.manage`
- Minimal migrations overall; major updates historically via manual SQL dumps

---

## PHASE 7 — FRONTEND & MOBILE FLOW

### Web Frontend Screen → API Map

| Screen | Primary APIs | Data shown | Form/State |
|--------|--------------|-----------|-----------|
| LoginPage | POST `/auth/login` | Username/password form, rate-limit detection | React Hook Form + Zod |
| DashboardPage | `/dashboard/kpis`, `/case-status-distribution`, `/timeline` | KPI cards, charts | React Query |
| CasesPage | GET `/cases` (paginated) + export | Case table with filters, unified search (800ms debounce + URL sync) | React Query + useUnifiedFilters |
| CaseDetailPage | GET `/cases/:id`, attachments, tasks | Tabs: info, tasks, attachments, timeline | React Query mutations |
| NewCasePage | GET form schema, POST `/cases`, POST `/attachments/upload` | Dynamic form + Google Maps location picker | RHF + Zod |
| AllTasksPage/Pending/InProgress/Completed/Revisit/Revoked | GET `/verification-tasks?status=...` | Task list w/ filters, bulk actions | React Query |
| TaskDetailPage | GET `/verification-tasks/:id`, POST submit/approve/reject | Task header, form data, photos, outcome selector | RHF |
| KYCDashboardPage / KYCVerificationPage | `/kyc/document-verifications/...` | Document image viewer (zoom/pan/mark regions), approve/reject/refer | Custom canvas state |
| UsersPage | GET `/users`, `/users/:tab` (activities, sessions) | Tabbed table: users/activities/sessions, bulk CSV import | React Query + mutations |
| UserPermissionsPage / RBACAdminPage | `/rbac/roles`, `/permissions`, PATCH user/role | Permission matrix (roles × codes) | Custom grid state |
| ClientsPage | `/clients` CRUD + `/document-types` | Client master table | React Query |
| LocationsPage | `/locations` (zones/cities/pincodes) | Hierarchical editor | React Query |
| RateManagementPage | `/rate-management/*` (6 tabs) | rate types, zone rules, assignments, report | React Query + RHF |
| ReportsPage / AnalyticsPage / MISDashboardPage | `/reports`, `/analytics`, `/ai-reports` | Generated reports + charts (Recharts) | React Query |
| BillingPage / CommissionsPage | `/invoices`, `/commissions` | Invoice + commission tables, PDF export | React Query |
| FieldMonitoringPage | `/field-monitoring/agents`, `/track/:userId` | Google Maps + agent markers + trails | Custom map state |
| SettingsPage / SecurityUXPage | `/settings`, `/security/password-policy` | Company config, 2FA, session timeout | RHF |
| CaseDataTemplatesPage | `/case-data-templates` CRUD (Apr 2026) | Form schema builder | Custom drag-drop state |

**State management:** React Query is primary for server data; React Context for auth/permission/theme/layout; RHF + Zod for forms; no Redux/Zustand in use (legacy `enterpriseStore.ts` unused).

**Error handling:** `useStandardizedQuery/Mutation` auto-toasts; `ErrorBoundary` wraps the app; `sessionManager` logs out at 10min idle (9min warning). Form validation on client (Zod) + server echo.

**Gaps:** No unit/E2E tests; no i18n; no service worker/offline; access token still reads from localStorage on init (violates Phase E5 in-memory-only spec).

### Mobile Screen → API Map

| Screen | APIs | Data | Notes |
|--------|------|------|-------|
| LoginScreen | POST `/auth/login` → Keychain | Tokens + user profile | Keychain (WHEN_UNLOCKED_THIS_DEVICE_ONLY) |
| Dashboard | Local SQLite (TaskRepository.getTaskStats) | Task counts by status + last sync | Offline-first |
| Assigned/InProgress/Saved/Completed | Local SQLite | Task cards | Status-filtered views |
| TaskDetailScreen | Local + `/verification-tasks/:id` | Task meta, timeline, sync status | Start visit validates GPS ≤100m |
| VerificationFormScreen | `/verification-tasks/:id/forms`, `/verification/:type`, auto-save every 10s | Dynamic form + photo gallery | useFormAutosave hook |
| CameraCaptureScreen / WatermarkPreviewScreen | Local (vision-camera) | Captured photo + watermark (case#, customer, timestamp, GPS) | Phase M7 TODO: EXIF strip |
| Profile / DigitalIdCard | Local `user_session` | User info | Profile photo upload flow unclear |
| SyncLogsScreen | Local sync_queue | Sync status, failures | Diagnostic/support |

**Navigation:** React Navigation v7, Stack + Tabs, deep linking `crmapp://task/:taskId`, FCM tap-to-navigate with M6 taskId validation.

**Form handling:** Dynamic form schema fetched from backend (`FormTemplateService`); auto-save every 10s to `form_submissions`; submit enqueues + marks COMPLETED locally.

---

## PHASE 8 — INTEGRATIONS

| Integration | Purpose | Location |
|-------------|---------|----------|
| **PostgreSQL 17** | Primary DB, 30–500 pg pool | Backend db.ts |
| **Redis 7** | Cache, BullMQ queues, Socket.IO adapter, session | Backend redis config |
| **BullMQ (6 queues)** | case-assignment, notifications, file-processing, geolocation, background-sync, audit-log | Backend queues/jobs |
| **Socket.IO** | Real-time case/task/notification/location updates; Redis pub-sub for PM2 multi-instance | Backend websocket/ + FE services/socket.ts |
| **Firebase Cloud Messaging** | Android + iOS push (also APNS for iOS) | PushNotificationService |
| **SMTP (Nodemailer)** | Email delivery (submission/approval/rejection/deadline) | EmailDeliveryService |
| **Google Maps API** | Location picker (web), reverse geocoding, field monitoring map | Frontend config, backend geolocation queue |
| **Gemini AI** | AI-generated case insights + reports | GeminiAIService (`/ai-reports`) |
| **Puppeteer + jsPDF + html2canvas** | PDF report generation | TemplateReportService |
| **Multer** | Disk-based file upload (./uploads/), 50MB limit | Backend middleware/upload.ts |
| **JWT (HS256)** | Access 1d, refresh 30d (HttpOnly cookie web; Keychain mobile) | Backend authController |
| **bcryptjs** | Password hashing | Backend auth |
| **OpenTelemetry** | Tracing (backend + mobile); feature-gated on frontend (`VITE_OTEL_ENABLED`) | All three apps |
| **Vision Camera + FCM + Keychain (mobile)** | Native modules | React Native |

### Background jobs (node-cron in backend)
- Metrics cleanup every 6h (7-day retention)
- Metrics batch flush every 2s
- Cache refresh every 10min (warmAllCaches)
- Audit log queue drain (Bull worker)

**Cron (scheduled reports):** User-defined via `/api/reports/scheduled`, stored as report configs, executed via node-cron.

---

## PHASE 9 — ISSUES & RISKS

### 🔴 Critical / High

1. **Secrets committed to repo** (security audit): Firebase admin JSON, `.env.production`, deploy scripts with embedded JWT secrets + DB URL, default admin creds in README. **Blocks public release; requires key rotation + git history rewrite.**
2. **Refresh token XSS exposure**: Frontend still reads access token from localStorage on init, contradicting Phase E5 (in-memory only). Access token exfiltration via XSS possible until first refresh.
3. **No CSRF protection** on state-changing endpoints (backend comment: "Bearer tokens inherently CSRF-safe" — but cookie-based refresh path is not).
4. **TypeScript strict mode disabled** on backend (`strict: false`, `strictNullChecks: false`) — opens door to null/undefined bugs.
5. **No test coverage** visible on frontend or mobile; backend has 2 test files (errorHandler, requestTimeout).
6. **Performance**: SELECT * in 20+ controllers; 200KB avg case list payload; missing 5 critical composite indexes; will break at ~5000 ops/day target per audit.
7. **Audit log durability**: falls back to direct DB insert if Redis down; if that also fails, events lost (only stdout log).

### 🟠 Medium

8. **9 per-verification-type report tables** — schema explosion; every new verification type requires migration.
9. **8 per-type form validators in utils/** — divergent validation logic risk.
10. **Shallow camelCase transform** — JSONB internals stay snake_case, response inconsistency.
11. **Sync queue lease expiry (5min)** — large attachments (50MB) can exceed lease → duplicate submissions despite idempotency keys (dependence on backend enforcement).
12. **Mobile EXIF stripping TODO** — photos uploaded with embedded GPS/timestamp (agent location history leak).
13. **Reverse-geocode TODO** — mobile still uses client-side Google Maps key (should proxy through backend, Phase M7).
14. **Frontend bundle**: largest pages at 500–800 LOC (CaseDataTemplatesPage 785, FieldMonitoringPage 727, LocationsPage 653, UsersPage 556) — refactor candidates.
15. **Dead code**: `enterpriseStore.ts` (Zustand), `enterpriseApiClient.ts` wrapper, `MISDashboardPage` stub.
16. **Dual API versioning** `/api` + `/api/v1` — no deprecation dropdate.
17. **Mobile patches (11)** — heavy patches on netinfo/screens/gradle suggest upstream incompatibilities with RN 0.84; upgrade path risky.
18. **In-memory caches**: auth context cache (30s), enterprise cache (10min refresh), performance metrics buffer (flush every 2s, no size cap) — OOM risk under burst load.
19. **Rate limit bucket memory** — 2000+ users × hourly sweep = ~60K entries/hour ceiling.
20. **No orphaned file cleanup** — `uploads/` disk can leak over time (no visible cron).

### 🟡 Low / UX

21. Access hybrid in localStorage + in-memory (should pick one).
22. No i18n; all UI strings English-only.
23. Inconsistent pagination param names across endpoints.
24. No service worker / offline web.
25. No accessibility audit for multi-select-dropdown keyboard nav.
26. PDF export limited (no invoice PDF despite being advertised in code).
27. CORS `cors: true` in Vite dev config (allow-all dev server).
28. Hardcoded allowed host `crm.allcheckservices.com` in vite.config.ts.
29. Session timeout fixed 9/10min, not per-role configurable.
30. Biometric auth not implemented on mobile.

---

## PHASE 10 — GAP ANALYSIS

| Area | Current | Expected | Gap |
|------|---------|----------|-----|
| **Case → Invoice traceability** | Works via invoice_item_tasks | Aggregation + approval workflow | Present; no automated invoice generation cron observed |
| **Commission payout approval** | Tables exist (commission_payment_batches) | Multi-stage approval with audit | Page exists; backend service not deeply verified |
| **Mobile offline ↔ server conflict** | SyncConflictResolver.ts | Explicit UX prompt | Implemented but user-facing conflict UI sparse |
| **Real-time to mobile** | FCM only (no WS) | Acceptable for mobile | Adequate |
| **Field-agent performance reporting** | AnalyticsPage + field monitoring map | Cohort comparisons, SLA tracking | Partial; TAT monitoring exists |
| **Test automation** | Minimal | Unit + E2E | Major gap |
| **Disaster recovery** | SQL dumps in db/backups/ | Point-in-time recovery | Not documented |
| **Internationalization** | None | Field agents may be multi-lingual | Gap if expanding to non-English markets |
| **Role-configurable session timeout** | Fixed | Admin-customizable | Gap |
| **Biometric mobile login** | Not implemented | Industry standard | Gap |
| **EXIF strip on mobile** | TODO | Privacy compliance | Gap |
| **Image CDN / S3 storage** | Local disk uploads/ | S3 or equivalent | Gap — disk leak + scale ceiling |
| **Backups / Redis durability** | Redis cache only | RDB/AOF persistence documented | Unknown |
| **CI/CD** | No visible pipeline | GitHub Actions etc. | Unknown from code |
| **Audit trail coverage** | Strong on task/case, weak on config edits | Full config mutation log | Partial |
| **Health alerting** | `/health/deep` exists | Prometheus/Grafana/pager | Unknown from code |

---

## PHASE 11 — FINAL STRUCTURED REPORT

### 1. System Overview (plain English)

This is a **B2B CRM platform for field-verification services** (KYC, address/residence/office/business checks) used by an organization providing verification services to clients (likely financial institutions — DSA/bank verifications, builder checks, NOC clearance).

Three apps cooperate:
- **Web (CRM-FRONTEND)** — back-office staff create cases, assign tasks, review submissions, run reports, manage masters (clients, products, locations, rates), and handle KYC decisions.
- **Mobile (crm-mobile-native)** — field agents in the field receive tasks, navigate to customer locations, capture watermarked photos, fill dynamic forms, and submit — all offline-first.
- **Backend (CRM-BACKEND)** — single API + WebSocket server handling auth, RBAC with geographic scoping, case/task lifecycle, document flow, notifications, reports, commissions, and mobile sync.

Backbone: PostgreSQL (97 tables) + Redis (queues, cache, Socket.IO) + FCM/APNS (push) + Gemini (AI reports).

### 2. Architecture Diagram
See Phase 3.

### 3. Core Business Flow (end-to-end)

```
1. Admin creates Client + Product + VerificationType + rate rules + territories
2. Backend user creates Case → POST /cases → verification_tasks auto-created
3. case-assignment queue selects field agent (territory + load balance)
4. Mobile agent logs in → sync downloads assignment → sees in Assigned tab
5. Agent taps task → "Start Visit" → GPS validated → IN_PROGRESS
6. Agent captures watermarked photos + fills dynamic form (auto-save 10s)
7. Agent submits → queued in SQLite sync_queue (offline-safe)
8. Sync engine uploads form (/mobile/verification-tasks/:id/verification/:type)
   + attachments + location with idempotency key
9. Backend triggers update_case_completion_percentage()
10. Socket.IO broadcasts case/task update to web reviewers
11. Reviewer on KYC dashboard approves/rejects/refers
12. On approval: task_commission_calculations inserted, payout batched
13. Case auto-COMPLETED when all tasks final → invoice lines created
14. Admin exports CSV/Excel/PDF reports
```

### 4. Module-wise Breakdown
See Phase 2.

### 5. API Map
See Phase 5.

### 6. Data Model Summary
See Phase 6.

### 7. Major Issues & Risks
See Phase 9 (prioritized 🔴🟠🟡).

### 8. Recommendations (no code)

**Must-do before scaling / public release:**
1. **Rotate all secrets** (Firebase, DB, JWT) and rewrite git history to purge committed `.env.*` + `firebase-service-account.json`. Remove hardcoded admin creds from README.
2. **Move access token fully in-memory** — remove localStorage read path; rely solely on HttpOnly refresh cookie.
3. **Add 5 composite indexes** (assigned_to+status, task_id+status, pincode+status, user_id+device_id, address trigram/FTS).
4. **Replace SELECT *** in 20+ controllers with column projections and add `?fields=` response filtering.
5. **Add composite form-template cache** to eliminate ~2000 redundant daily queries.
6. **Enable TypeScript strict mode** on backend incrementally.
7. **Add CSRF protection** for cookie-authenticated endpoints.

**Should-do (next quarter):**
8. **Introduce test pyramid** — backend unit (vitest already set up), frontend component (Vitest + Testing Library), mobile logic (Jest), and E2E (Playwright for web, Detox for mobile).
9. **Consolidate 9 per-type report tables** into a single `verification_reports` with typed JSONB payload + type discriminator + per-type view. Reduces schema churn.
10. **Unify 8 form validators** behind a single meta-validator that reads field schema from DB.
11. **Move file storage to S3/compatible object store** (disk uploads/ won't scale; add orphan-file cron).
12. **Implement EXIF stripping + backend-side reverse geocoding** (mobile Phase M7) — privacy + API-key hardening.
13. **Replace raw localStorage-based session sync** with BroadcastChannel API for multi-tab consistency.
14. **Standardize pagination params** and deprecate the `/api/v1` alias on a clear schedule.
15. **Add biometric login** (Face ID / Touch ID) on mobile with Keychain-backed session.

**Could-do (tech health):**
16. Refactor 500+ LOC pages into smaller components.
17. Introduce a feature flag system.
18. i18n scaffolding for future expansion.
19. Service worker for web offline support.
20. Deprecate unused Zustand store + enterprise API wrapper.
21. Add Prometheus metrics endpoint + Grafana dashboard; wire `/health/deep` to alerting.
22. Role-configurable session timeout.
23. Upgrade React Native base and attempt to drop large patches (netinfo 53K, gradle 13K).

---

## Items Explicitly Marked UNCLEAR / UNVERIFIED

- Whether Redis runs with RDB/AOF persistence configured (code uses fail-open fallback).
- CI/CD pipeline (no GitHub Actions workflow visible in `.github/`).
- Whether `applicants`, `visits`, `verifications` legacy tables still receive writes.
- Whether mobile `ProfilePhotoCaptureScreen` has a completed backend endpoint.
- Whether the `enterpriseStore.ts` Zustand store is truly dead or conditionally enabled via flag.
- Exact commission rule evaluator logic (service not deeply read).
- Field-level encryption for PII columns at rest (not visible in schema dump).
- SOC2/ISO evidence controls beyond audit_logs.
- Whether the mobile app has Detox/integration tests outside `src/`.

---

*End of report. This document is the authoritative system understanding reference; update when major architectural changes land.*
