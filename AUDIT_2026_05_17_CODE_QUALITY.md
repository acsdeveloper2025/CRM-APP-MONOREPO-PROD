# Code-Level Quality Audit — 2026-05-17

**Scope:** Source-code only. No infra, cloud, DevOps, deploy scripts, GH Actions, dockerfiles, server config, PM2, nginx, signing, fastlane.
**Codebases audited:** CRM-BACKEND (257 .ts), CRM-FRONTEND (371 .ts/.tsx), crm-mobile-native (161 .ts/.tsx).
**Method:** 3 parallel Principal-engineer agents, one per codebase, each scored against 11 dimensions. Synthesis below.
**Confidence:** Findings tagged `[verified]` are direct file reads. `[grep-only]` are pattern-matched and worth confirming before acting.

---

## 0. Executive summary

The three codebases are above-baseline for an in-house regulated CRM, with strong audit discipline visible inline (M-codes, C-codes, D-codes, F-codes from prior rounds). The architecture choices are sound: BE uses `withTransaction` + parameterized queries + central auth/RBAC; FE has lazy routes + axios interceptors + zod runtime validation; mobile has SQLCipher + Keychain + signed photo evidence.

The concentrated risks across all three are:

1. **Zero meaningful test coverage anywhere.** BE 2.3% (6 of 257 files, none on controllers). FE 0.5% (2 of 371). Mobile 0%. For a money + KYC + DPDP-regulated app this is the single largest organizational risk.
2. **God-files.** BE has 9 files >2000 LOC (worst: `mobileFormController.ts` 6352). FE has 14 components >500, 4 over 900 (worst: `TaskCaseCreationForm.tsx` 1561). Mobile has `LegacyFormTemplateBuilders.ts` 7373 (single file dynamically imported into sync hot path).
3. **Silent data corruption.** `usersController.ts:1916, 2144` runs `query('BEGIN')` on the pool — no transaction is actually opened, so partial updates persist on failure. Critical.
4. **Audit-log gap on money path.** `commissionManagementController.ts` has 6 `billing.approve`-gated mutations with **zero `createAuditLog` calls** — approving commission rate changes leaves no audit trail.
5. **PII redaction is incomplete.** BE `logRedact.ts` exists but is only used in 3 files; `name/phone/email/dob/address/lat/lng` are not on its key list. FE `useErrorHandling.ts:222, 240-247` still ships `userId` + full `window.location.href` (including query strings) to telemetry. Mobile `Logger` redacts coord keys but not coord substrings.

---

## 1. Cross-codebase top-10 priorities (do these first)

Ordered by impact × ease. All citations are file:line.

| # | Layer | Finding | File:Line | Fix sketch |
|---|---|---|---|---|
| 1 | BE | Non-transactional `BEGIN/COMMIT` via pool — silent data corruption on partial failure | `controllers/usersController.ts:1916, 1973, 2144, 2202` | Migrate to `withTransaction(client => …)` |
| 2 | BE | 6 `billing.approve` mutations with no audit log | `controllers/commissionManagementController.ts:97, 174, 269, 441, 565, 678` | Wire `createAuditLog` per mutation |
| 3 | BE | 10 routes have **zero** express-validator chains | `routes/storage.ts, geocode.ts, exports.ts, forms.ts, templateReports.ts, verificationTasks.ts, deduplication.ts, user.ts, reverse-geocode-dlq.ts, verificationTypeOutcomes.ts` | Add `param/body/query` validators, esp. `geocode` (lat/lng range) + `storage` (path traversal) |
| 4 | FE | Residual PII leak in telemetry payload | `hooks/useErrorHandling.ts:222, 240-247` | Drop `userId`; `window.location.href` → `window.location.pathname` |
| 5 | Mobile | SSL pinning is **not actually enforced** — `apiClient.ts` uses plain axios; no `react-native-ssl-pinning` import anywhere; `PinningConfigService` is a kill switch for a feature that isn't installed | `api/apiClient.ts:1-10`, `services/PinningConfigService.ts:19-23` | Add `react-native-ssl-pinning` (or `react-native-cert-pinner`), verify `network_security_config.xml` |
| 6 | BE | `mobileLocationController.ts:577` logs raw `(lat,lng)` coords — DPDP §11 PII | `controllers/mobileLocationController.ts:577` | Round to 3 dp or drop from log message |
| 7 | All | Establish baseline tests on money paths first | BE: invoices/commissions/rates controllers • FE: `services/billing.ts`, `services/commissionManagement.ts` • Mobile: `usecases/`, `SyncConflictResolver`, `SyncQueue` | vitest + msw for FE service layer (highest ROI); jest for mobile use-cases |
| 8 | FE | Only ONE `<ErrorBoundary>` (root) — any render crash blanks the whole shell | `App.tsx:81` is the only boundary | Wrap each `<Route element>` in Suspense+ErrorBoundary; handle `ChunkLoadError` with reload |
| 9 | Mobile | `CameraService.ts:311` nests `SyncGateway.enqueueAttachment` inside `DatabaseService.transaction`; `SyncQueue.enqueue` may run `StorageService.cleanupSyncedData(1)` (DELETE on a different connection) → SQLITE_BUSY under load | `services/CameraService.ts:311`, `services/SyncQueue.ts:310` | Pre-check space outside the tx; never nest cleanup |
| 10 | FE | `queryClient.clear()` on every permission_changed WS event drops ENTIRE cache; one admin permission edit triggers 50+ refetches in every other tab | `contexts/AuthContext.tsx:79` | Targeted `invalidateQueries({ queryKey: [...] })` per affected resource |

---

## 2. CRM-BACKEND (Node/Express)

### 2.1 Code-Level Scalability

**Critical**
- `controllers/usersController.ts:1916, 2144` — pool-level `query('BEGIN')` → fresh connection per call, so BEGIN/COMMIT run on different physical connections than the INSERT/DELETE. There is **no transaction**, and partial failure persists. Same pattern in `updateClientAssignments` and `updateProductAssignments`. **Migrate to `withTransaction(client => …)`.**

**High**
- `middleware/auth.ts:46` — `authContextCache` is a process-local `Map` with TTL=5s but no LRU/sweep. Expired entries only evict on read; under churn (mobile reconnects + login bursts) the map grows unbounded between reads. Use `lru-cache`.
- `websocket/server.ts:67` — `SocketRateLimiter.buckets` swept hourly with 60s window; worst-case `users × 7 buckets × 1hr`. Sweep on a multiple of window (5min) + absolute cap.
- `middleware/performanceMonitoring.ts:164` — `metricsBuffer` capped 5000 + 2s flush; on DB stall, metrics silently drop during the outage (the moment you most need them). Add circuit-breaker that disables collection on flush failure.
- `controllers/clientsController.ts:598-672` — serial `await cx.query(INSERT …)` in nested loops over `productIds × vtIds × dtIds`. A 20×10×10 client = ~400 sequential round-trips inside one tx. Batch with multi-row VALUES.
- `controllers/usersController.ts:1930` — `Promise.all(clientIds.map(id => query(INSERT)))` opens N connections **outside** the (non-existent) tx. Fix together with priority #1.

**Medium**
- `services/dbMaintenanceService.ts:79` — `setInterval` runs on every PM2 worker; 6 workers will race on `purge_stale_*`. Redis SET NX leader-election.
- `controllers/pincodesController.ts:313` — `for (const areaId of areaIds) { await query('SELECT id FROM areas WHERE id = $1', …) }` — N+1. Use `WHERE id = ANY($1::int[])`.

### 2.2 Reliability & Error Handling

**Critical** — Same as §2.1's pool-level BEGIN/COMMIT bug. Worth listing separately because the reliability story is "you think you rolled back; you didn't."

**High**
- `controllers/verificationTasksController.ts:221` (+ ~12 other places) — manual `wrapClient(await pool.connect()) + BEGIN/ROLLBACK`. The pattern works but lacks the deadlock-retry that `withTransaction` (config/db.ts:161) gives you on 40P01/40001. Under contention you get 5xx instead of auto-retry. Migrate the remaining sites.
- `controllers/verificationTasksController.ts:251` — `client.query(caseQuery, …)` runs AFTER `client.query('COMMIT')` on line 236, but the connection still isn't released; error paths then try `ROLLBACK` (line 299) on a committed tx. Explicit phase separation; release at commit.
- `controllers/verificationTasksController.ts:280-283` — notification-send failures swallowed with `logger.error` + "Don't fail the request" comment. Field user never knows they got an assignment. Enqueue to retry-backed BullMQ.
- `controllers/casesController.ts:2295` — `SET statement_timeout = 30000` (without `LOCAL`) survives connection release back to pool; next checkout inherits. Use `SET LOCAL`.

**Medium**
- `controllers/mobileAttachmentController.ts:171,195,216,318,333,849,859` — `.catch(() => {})` on unlinks masks ENOSPC/EACCES. Log at warn level.
- `config/db.ts:201` — `throw new Error('Transaction retry exhausted')` loses original PG code/message. Re-throw last captured `err`.
- No global `process.on('unhandledRejection'/'uncaughtException')` observed in sampled `app.ts`. `[grep-only — verify in index.ts]`

### 2.3 Secure Coding

**High**
- **10 routes have zero express-validator usage** (20% of routes): `storage, verificationTasks, exports, forms, templateReports, geocode, deduplication, user, reverse-geocode-dlq, verificationTypeOutcomes`. Worst surfaces are `geocode` (numeric range on lat/lng) and `storage` (path traversal on key — `[needs verify]`). Add validators per route.
- `middleware/performanceMonitoring.ts:224` — `INTERVAL '${RETENTION_HOURS} hours'` is template-literal SQL interpolation. Currently safe (constant 24), but pattern invites regression. Use `make_interval(hours => $1)`.
- `controllers/usersController.ts:2171` — INSERT VALUES `[userId, ...productIds, req.user?.id]`. Parameterized OK, but `[grep-only]` — verify route-level RBAC enforces that target `userId` is in caller's scope.

**Medium**
- `utils/logRedact.ts` exists but is used in only **3 of 257 files**. Most `logger.*(req.body)` paths log raw bodies. Add a lint rule forbidding raw body in logs outside the redact wrapper. **Extend `SENSITIVE_KEYS` with `name`, `phone`, `email`, `dob`, `address`, `lat`/`lng`.**
- `controllers/mobileLocationController.ts:577` — `logger.warn` includes `(${latitude},${longitude})`. Coords are DPDP PII. Round to 3 dp or drop.
- `websocket/server.ts:75` — JWT verified via `verifyJwtWithRotation` + `loadUserAuthContext`, but `[needs verify]` whether WS handshake enforces origin allowlist.
- CSP `styleSrc: ['self', 'unsafe-inline']` (`app.ts:85`) — accepted Tailwind tradeoff; document it.

**Low** — bcrypt + JWT rotation + token-version revocation all correctly wired. No `eval`/`Function` usage.

### 2.4 Algorithmic Performance

**High**
- `controllers/clientsController.ts:598-672` — see §2.1 (4 nested for-loops, serial INSERTs).
- `SELECT *` in 13 files (`userDataExportController.ts:150`, `mobileFormController.ts:2059`, `templateReportsController.ts` ×8, `services/templateFieldPrefillResolver.ts:82, 89`). Future JSONB column additions silently inflate parse cost. Explicit column lists.
- `middleware/auth.ts:198` — `loadUserAuthContext` runs 4 sub-selects with `array_agg(DISTINCT …)` across `user_roles + role_permissions + permissions + user_*_assignments + roles_v2`. Cached at 5s but cold paths hit the join. `[needs verify all FK indexes present]`.
- `controllers/verificationTasksController.ts:251-263` — `SELECT name FROM verification_types WHERE id = $1` inside notification loop (N+1). `verification_types` is small + immutable — boot-time cache.

### 2.5 Maintainability & Clean Code

**High**
- **God files** (LOC counts): `mobileFormController.ts` 6352, `comprehensiveFormFieldMapping.ts` 4917, `casesController.ts` 3335, `usersController.ts` 3316, `TemplateReportService.ts` 3167, `verificationTasksController.ts` 3017, `reportsController.ts` 2440, `invoicesController.ts` 2314, `mobileCaseController.ts` 2060. 9 files >2000, 26 files >1000. Mixed input shapes / business logic / DB access. Refactor target: split per concern.
- 15+ files still do `wrapClient(await pool.connect()) + manual BEGIN/ROLLBACK`. R-CRIT-1 closure log in memory tracks the remaining migration to `withTransaction`.
- Two parallel form-field-mapping systems: `comprehensiveFormFieldMapping.ts` (4917) + 8 per-form-type `*FormFieldMapping.ts` files + `typeAwareFormFieldSchemas.ts` (1225). Genuine duplication.

**Medium**
- `controllers/verificationTasksController.ts:325` — `String(rawTaskId || '')` after `String(req.params.taskId || '')` already coerced. Redundant.
- 266 `code: 'INTERNAL_ERROR'` instances overload one code; mixed with `kycVerificationController.ts:145` style `{success:false, message:'…'}` (no `error.code`). Enforce via response builder.
- `controllers/verificationTasksController.ts:365` — `if (originalTask.taskType === 'KYC' || originalTask.task_type === 'KYC')` — reads both camel + snake; telegraphs the incomplete row-transform migration.

### 2.6 Resource Efficiency

**High**
- `middleware/auth.ts:307` — `loadUserAuthContext` runs on EVERY authenticated request. 5s TTL helps but a cold worker still issues the multi-join. Add Redis-backed L2.
- `controllers/usersController.ts:1930-1942` — `Promise.all(map(query INSERT))` opens N connections, one per id. 200-client user = 200 connection acquisitions.

**Medium**
- `controllers/mobileLocationController.ts:567` — every reverse-geocode hits Google directly; **no in-process or Redis cache** on the inline helper (the gmap: Redis cache only covers static maps). Add `lat:6dp:lng:6dp` Redis cache for reverse-geocode too.
- `controllers/verificationTasksController.ts:263` — boot-cache `verification_types` (small + immutable).
- `app.ts:174` + `:300` — `express.json({ limit: '5mb' })` then `'50mb'` re-applied to `/mobile`. Two parsers compete; works because Express picks more-specific mount, but fragile.

### 2.7 Modularity & Flexibility

**High**
- **No repository layer.** Controllers do raw SQL directly. 95+% of files. Hard to test, hard to swap DB. Long-term: introduce repository pattern for high-traffic entities.
- Controllers reach into Redis directly (`authController.ts:87` `import('@/config/redis')` inline). Tightly coupled.

**Medium**
- `services/storage` (LocalFs + S3 + facade) — model this pattern elsewhere.
- `websocket/server.ts:16` — `let globalSocketIO: SocketIOServer | null = null` — hidden coupling via global singleton.

### 2.8 Interoperability

**Medium**
- `controllers/mobileLocationController.ts:560` — Google Geocoding has 10s AbortController (good) but no `OVER_QUERY_LIMIT`-aware backoff. Would retry forever.
- `controllers/geocodeController.ts:294` — `await fetch(url)` with **no timeout, no retry, no schema validation**. Add `AbortSignal.timeout(10000)` + zod schema for `body.results`.
- BullMQ queues `attempts:3 + exponential backoff + removeOnComplete/Fail` (good). DLQ exists for audit logs only — extend to notifications + geocode.
- `utils/circuitBreaker.ts` exists but only 4-5 import sites. Wrap all external clients (Google, FCM, Redis).

### 2.9 Compliance in Code

**Critical** — Non-functional transactions on permission/scope mutations (§2.1/§2.2) are a compliance bug: auditLog says "replaced", DB shows partial state.

**High**
- **PII in logs** — `mobileLocationController.ts:577` raw coords; `casesController.ts:2311` `payload: redact(req.body)` but redact helper doesn't mask `customerName/phone/address/dob`. Extend `logRedact.ts` SENSITIVE_KEYS.
- **Audit-log coverage on money** — `commissionManagementController.ts` has approve/reject/update at lines 97, 174, 269, 441, 565, 678 with **zero `createAuditLog` calls**. Wire each.
- **Soft-delete consistency** — 27 `deleted_at IS NULL` filters across 85 `FROM users` queries (~32% gap). NEW-CRIT-1 in memory tracks remaining chunks.

### 2.10 User-Centric Logic

**Medium**
- Response shape inconsistency — most return `{success, message, data?, error?}`; `kycVerificationController.ts:145/440/454/484` returns `{success:false, message:…}` without `error.code`. FEs keying on `error.code` get `undefined`.
- 266 uses of `'INTERNAL_ERROR'` overload one code (DB / external / business rule all collapse). Distinct codes (`DB_UNAVAILABLE`, `EXTERNAL_API_FAILED`, `CONFIG_INVALID`).

### 2.11 Testability

**Critical** — 6 of 257 files have tests (2.3%): `errorHandler`, `requestTimeout`, `refreshCsrfGuard`, `circuitBreaker`, `errorMessage`, `auditLogDeadLetter`. **Zero controller / service / queue tests.** Money-handling app. Largest single risk for a regulated workload. `vitest.config.ts` is ready — the gap is authorial discipline.

**High**
- Pure functions are rare. Module-level singletons (`pool`, `globalSocketIO`, `notificationQueue`, `redisClient`) block mocking.
- Implicit env reads bypass `config/index.ts` (`mobileLocationController.ts:561` direct `process.env.GOOGLE_GEOCODING_API_KEY`; `dataEntryMISController.ts:364` direct `process.env.MIS_EXPORT_MAX_ROWS`).

---

## 3. CRM-FRONTEND (React 19 + Vite)

### 3.1 Code-Level Scalability

**Critical**
- **God components mixing fetching + derived state + JSX.** Top 4:
  - `components/cases/TaskCaseCreationForm.tsx` 1561 LOC — every keystroke re-runs filter/map over `clients`/`products` at `:246, 253, 396, 414`.
  - `components/cases/CaseCreationStepper.tsx` 1088 LOC.
  - `components/cases/FullCaseFormStep.tsx` 1012 LOC.
  - `components/verification-tasks/VerificationImages.tsx` 1119 LOC.
  - Only 6 `React.memo` uses in entire codebase.
  - Fix: split into row/card sub-components, `React.memo` thumbnails, move task array to `useReducer` keyed by id, `useMemo` client/product filters.

**High**
- `contexts/AuthContext.tsx:206-261` — single `useEffect` re-runs on every `state.token` change (which happens on every refresh), tearing down + reconnecting socket + re-subscribing listeners. Depend on `state.isAuthenticated` boolean, not `state.token`.

**Medium**
- `App.tsx:68` `gcTime: 30min` + per-row `['product', product.id]` keys + `queryClient.clear()` on permission changes → thundering-herd refetch. See priority #10.
- `hooks/useEnterprisePerformance.ts:307` — `setInterval(updateMemoryInfo, 5000)` runs even with no subscribers. Wasteful timer; hook itself is mostly unused.

### 3.2 Reliability & Error Handling

**Critical** — Only ONE `<ErrorBoundary>` (root `App.tsx:81`). Any render crash blanks the entire shell. Wrap each `<Route element>` with Suspense+ErrorBoundary; handle `ChunkLoadError` with reload.

**High**
- `useStandardizedMutation` defines `onError` but ~110 raw `useMutation` callers frequently omit it. Many `mutation.mutate(...)` paths rely solely on `successMessage`; failures only toast if `errorContext` is passed. Lint rule + finish standardization.
- `routes/AppRoutes.tsx:227` Suspense fallback is a single global spinner; lazy-chunk failures aren't caught by Suspense, only by ErrorBoundary — and only root catches today. Same fix as Critical.

**Medium**
- `contexts/AuthContext.tsx:236-241` — `case:updated` WS event fires 5 separate `invalidateQueries` via `Promise.all`. Bulk-assign storms hammer the API. Debounce (250ms coalesce) + invalidate by broader key.
- Zero optimistic updates anywhere (`grep onMutate` is empty except dead `useEnterprisePerformance`). Round-trip wait on every assign/revoke/complete. UX cost.

**Low** — `services/socket.ts:71` `reconnectionAttempts: 20` — after 20 fails the socket goes silent forever; user sees stale data with no warning. Toast on give-up.

### 3.3 Secure Coding

**High** — `hooks/useErrorHandling.ts:240-247` — `getUserId()` parses `localStorage.getItem('authUser')` and ships `userId` + full `window.location.href` (incl. query strings) to telemetry. The class ErrorBoundary was fixed (M20) but this functional path wasn't. **Priority #4.**

**Medium**
- `utils/security.ts:26-28` `sanitizeSqlInput` — `input.replace(/[';-]/g, '')` is FE security theatre; silently deletes hyphens from names/emails. Delete helper; SQL injection is BE concern.
- `utils/security.ts:254-286` `secureStore/secureRetrieve` — calls itself "encrypted" via `btoa()` (base64). If anyone trusts the name and stores real secrets, they're plaintext. Rename or delete.
- `pages/operations/FieldMonitoringPage.tsx:117-150` — builds InfoWindow HTML by string concat. Values are `escapeHtml()`d (good), but one missing escape from a new contributor = XSS. Render React into a detached div or use `OverlayView`.

**Low** — token storage strategy is correct (access in-memory, refresh in HttpOnly cookie, `Idempotency-Key` per mutation). Defensive cleanup of stale localStorage keys (`services/api.ts:151-156, 638-645`) solid.

### 3.4 Algorithmic Performance / Bundle

**High**
- **No virtualization anywhere.** `grep react-window|react-virtual|virtuoso` → zero. `UsersTable.tsx` 644 LOC + `MISDataTable` + `CompletedCaseTable` render all rows. With BE pagination default 25-row this is OK, but "show 200" / export-view janks. Add `@tanstack/react-virtual` to the 3-4 high-row tables.
- `App.tsx:62-77` `staleTime: 2min` + `refetchOnWindowFocus: false` → users with tab open >2min see stale data on every page change. Override `staleTime: 0` per-screen for money screens.

**Medium**
- Three independent 60s polls + socket listeners: `Header.tsx:52`, `NotificationHistoryPage.tsx:47`, `CaseNotificationsTab.tsx:97`. WS-driven invalidation already wired — drop the polls. Priority #3 cross-cutting.
- `Header.tsx:121` — `setInterval(() => setNow(new Date()), 1000)` — 1Hz re-render of entire `<Header>`. Isolate clock into `<HeaderClock>`, or 30s if display is relative ("X mins ago").

### 3.5 Maintainability & Clean Code

**Critical** — 14 components/pages >500 LOC, 4 over 900:
- `TaskCaseCreationForm.tsx` 1561, `VerificationImages.tsx` 1119, `CaseCreationStepper.tsx` 1088, `FullCaseFormStep.tsx` 1012, `CaseDataTemplatesPage.tsx` 965, `FieldMonitoringPage.tsx` 924, `ReportTemplatesPage.tsx` 903. Each mixes fetching + derived state + business rules + JSX.

**High**
- `hooks/useEnterprisePerformance.ts` 492 LOC — grab-bag (throttle dup, useDebounce dup of `hooks/useDebounce.ts`, `useInfiniteScroll`, unused `useOptimisticUpdate`, `useBatchOperation`, memory polling). "Enterprise" name = nobody knows what's safe to delete. Split + delete unused.
- Triple-duplicated client/product filter logic: `TaskCaseCreationForm.tsx:246, 253` + `ActiveScopeContext.tsx` + BE `X-Active-Client-Id` validation. Centralize in `useScopedClients()`/`useScopedProducts()`.

**Medium**
- `services/api.ts` 790 LOC singleton + `safeFetch` partially duplicates the axios refresh logic (`:664-779`). Route `safeFetch` through axios via `apiService.api.request({…})`.
- Hardcoded route strings everywhere. Extract `ROUTES` constants object.

### 3.6 Resource Efficiency

**High** — three 60s polls (§3.4) + `queryClient.clear()` on permission_changed (`AuthContext.tsx:79`) → entire cache wiped → 50+ refetches per other open tab. Priority #10.

**Medium**
- `hooks/useLocations.ts:97, 190` — manual debounce via `useState<ReturnType<typeof setTimeout>>([null])` — code smell; leaks if unmount mid-debounce. Use repo's `hooks/useDebounce.ts`.

**Low** — `services/api.ts:419` keeps last 1000 `RequestMetrics` in memory (~50KB, fine).

### 3.7 Modularity & Flexibility

**High** — Pages do fetching + presentation in same file (`UsersPage.tsx` 649, `LocationsPage.tsx` 621). Extract `useUsersPageModel()` returning `{users, isLoading, mutations}`; page becomes pure JSX.

**Medium**
- `contexts/AuthContext.tsx` does six unrelated things (auth + WS lifecycle + WS dispatch + cache wipe + scope wipe + toast). Extract `useAuthSocket(token)`, `useNotificationSocket(toast)`.
- `services/api.ts` singleton blocks second axios instance (e.g. for long-poll).

### 3.8 Interoperability

**Good** — runtime zod via `services/schemas/runtime.ts` `validateResponse()` with `[warn-pass / strict-opt-in]` default. Pattern is solid.

**Medium**
- Only ~8 schemas exist for ~40 services. Prioritize money-touching coverage: `billing.ts`, `commissionManagement.ts`, `invoices`.
- `services/socket.ts:71` `reconnectionAttempts: 20` — see §3.2.
- `safeFetch` + axios duplicate refresh logic (see §3.5).

### 3.9 Compliance in Code

**High** — `useErrorHandling.ts` PII leak (priority #4).

**Medium**
- `services/auth.ts:44, 105` stores entire `user` object in `localStorage` `USER_DATA` (name, email, role, assignedClients). XSS = extractable. Store only `{id, name, hasSession: true}`; fetch rest from `/me` on bootstrap (already done via `refreshUserData()` at `AuthContext.tsx:101`).
- No client-side PII masking utilities (`grep mask|redact` → `[needs verify]`). Mobile/PAN/Aadhaar shown full in tables. Add `formatters/pii.ts` (`maskMobile/maskPan/maskAadhaar`).

### 3.10 User-Centric Logic

**High** — Accessibility is sparse: 65 `aria-label|role=` + 18 `alt=` across 371 files. Icon-only `<Button>`s in many tables. Add `aria-label` + lint rule `jsx-a11y/control-has-associated-label`.

**Medium**
- `ErrorBoundary.tsx:127` — "Our team has been notified" but `logErrorToService` (`:83`) only logs to console. User-facing lie. Wire Sentry (commented hook is there) or change copy.
- Empty/error states inconsistent — `<TableSkeleton>` rollout 2026-05-13 covered loading, but `isError` branches often silently fall through React Query defaults.

### 3.11 Testability

**Critical** — 2 test files (`lib/uppercase.test.ts`, `services/api.test.ts`) for 371 source files. **0.5% coverage by file.** Quarterly target: all `services/*.ts` to 60% via vitest + msw (highest ROI).

**High**
- Hooks import `toast` from `sonner` directly; `useErrorHandling` reads `localStorage`/`window.location`. Cannot test without browser env. Inject via notifier/storage context.
- God components untestable (1561-line component requires mocking 10+ hooks).

**Medium** — `App.tsx:62` creates `queryClient` as module-level singleton; export `createAppQueryClient()` factory for test render helper.

---

## 4. crm-mobile-native (React Native 0.84)

### 4.1 Code-Level Scalability

**High**
- `services/NotificationService.ts` 1023 LOC — `loadFromDb` refills single in-memory array on cold start, never paginated. Agent who hasn't opened app for weeks loads thousands of rows into RAM. Page by id with LIMIT 200 + lazy older from `NotificationTrashScreen`.

**Medium**
- `projections/ProjectionUpdater.ts:102` `rebuildAll` — materializes `json_object(...)` for every task on every full rebuild; `rebuildTask`'s catch falls back to `rebuildAll` at line 330. With 45d retention this is O(N) per failure. Window the rebuild or invalidate dirty-set.
- `services/SyncQueue.ts:381` `getPendingItems` calls `recoverExpiredLeases` per fetch (UPDATE per 5-min tick). `SyncEngine._doSync:165` already calls it once per cycle. Drop the per-batch call.
- `services/AttachmentService.ts:236` `cleanupExpiredCache` walks `RNFS.readDir + stat` synchronously, blocks JS thread on devices with thousands of cached files. Chunk via `setImmediate` or move to `runIdleTask`.

### 4.2 Reliability & Error Handling

**Critical** — `services/AuthService.ts:202` `StorageService.clearAllData()` wipes DB on user-change, but next user's `SyncQueue.recoverExpiredLeases()` may have already run in `AuthContext.checkAuthStatus` against the old DB. Small race window on cold-start switch. `[grep-only — verify]`. Gate SyncQueue calls on `currentUserId === expectedUserId` post-clear.

**High**
- `sync/SyncEngine.ts:148-269` — watchdog `setTimeout(1000)` then `this.syncInProgress = true` outside the original promise chain. `AppState=background → daemon tick` between `finally` reset and the setTimeout can yield 2 concurrent `performSync`. Use a single mutex object, not boolean.
- `services/CameraService.ts:311` — see priority #9 (nested SyncGateway.enqueueAttachment inside DatabaseService.transaction; `SyncQueue.enqueue:310` runs cleanupSyncedData DELETE on different connection → SQLITE_BUSY).
- `sync/SyncDownloadService.ts:225` — `await import('../screens/forms/LegacyFormTemplateBuilders')` from sync hot path pulls a 7373-line module on every successful sync if Metro hasn't loaded it. Already eagerly imported by `VerificationFormScreen.tsx:36`. Hoist — module's in bundle anyway.
- `services/MobileSocketService.ts:73` `transports: ['websocket']` only — corporate Wi-Fi that blocks WS makes app dark. Include `'polling'` fallback after WS attempt.
- `database/DatabaseService.ts:99-163` — "ALWAYS recover on init failure" unconditionally deletes encrypted DB on any open error. Transient I/O on cold-start wipes unsynced PENDING + form drafts. Distinguish IOError vs SQLITE_NOTADB; back up to `${dbName}.broken`; toast user once.

**Medium**
- `sync/SyncDownloadService.ts:614` — `deferredUnlinks` loop after commit; process kill mid-loop orphans files (covered by 45d sweep but shows as ghost photos meanwhile).

### 4.3 Secure Coding

**High** — see priority #5 (SSL pinning not enforced).

**High** — `config/index.ts:96-102` — all three env entries point at same production host `https://crm.allcheckservices.com`. Debug APK hits prod. Gate staging via build variant.

**Medium**
- `services/AttachmentService.ts:121` `downloadAndCache` writes to `CachesDirectoryPath/attachments` and returns `file://` URLs. `Attachment.localEncryptedPath` is a misnomer — **files are plaintext on disk**. Rooted device recovers KYC images from `/data/data/<pkg>/cache/`. Move to `DocumentDirectoryPath` + drop on logout, or encrypt blobs.
- `api/apiClient.ts:467` `setBaseUrl(url: string)` — public singleton method with no caller filter. If wired with server-supplied URL it's a redirection primitive. Close or `private`.
- `services/AttachmentService.ts:276` `stripExifMetadata` — `piexif.remove` writes in-place; crash mid-write corrupts JPEG. Write to `${path}.tmp`, atomic rename.

**Low** — `SessionStore.ts` stores access+refresh as single JSON Keychain entry. Keychain leak returns both. Split into two services for defense-in-depth.

### 4.4 Algorithmic Performance

**Medium**
- `screens/tasks/TaskListScreen.tsx:847` — `<FlatList>` has `windowSize=8` + `removeClippedSubviews` but **no `getItemLayout`**. Selector `useSelector(selectTaskById(taskId))` per row at `:143` iterates the selector cache every render.
- `projections/ProjectionUpdater.ts:341` `rebuildDashboard` — DELETE + INSERT…SELECT FROM tasks aggregates over whole table per task change. 1000-task device = full scan per write. Use SQLite UPDATE triggers or memoize delta.
- `screens/forms/VerificationFormScreen.tsx:162` `formProgress = useMemo` walks every section + field per keystroke. Residence + KYC templates have ~40-80 fields with conditionals. Debounce or compute incrementally.

**Low** — `services/LocationService.ts:313` — `adaptiveTimerId = setInterval(…recordLocation('TRAVEL'))` runs in addition to `watchPosition`. When moving, watch + timer both fire → double write rate. Reset timer on each successful watch callback.

### 4.5 Maintainability & Clean Code

**High**
- `screens/forms/LegacyFormTemplateBuilders.ts` 7373 LOC — biggest file in repo. God-module of hand-coded form templates. Move to JSON data files; ship server-driven.
- `screens/forms/VerificationFormScreen.tsx` 1114 LOC + `useState<Record<string, any>>` + `(c: any) =>` predicates (`:75, 169, 209, 432`). Any-typed form values flow through 5 layers. Introduce `FormValues` type (even `unknown` would surface mistakes).

**Medium**
- `services/NotificationService.ts` 1023 LOC mixes FCM listener + persistence + foreground banner + assignment-sync throttling + WS bridge (4+ concerns). Extract `FcmReceiver`, `NotificationStore`, `ForegroundBannerBus`.
- `services/AuthService.ts:360` lazy `require('./LocationService')`; `MobileSocketService.ts:264` lazy `require('./AuthService')` — both indicate cyclic dependency. Extract `SessionEvents` module.

### 4.6 Resource Efficiency

**High**
- `services/LocationService.ts:313` `adaptiveTimerId` setInterval lives forever after `startTracking`. `AuthService.logout:360` lazy-requires LocationService — if require fails (hot-reload reset) watch + timer never clear, GPS stays on.
- `services/AttachmentService.ts:282` — `readFile(..., 'base64')` to strip EXIF loads 5MB JPEG → 7MB base64 string per upload. 20 parallel uploads = 140MB peak JS heap. Use native EXIF stripper (`react-native-exif`) or streaming.

**Medium**
- `sync/BackgroundSyncDaemon.ts:146` — `setInterval(tick, intervalMs)` runs in foreground too; `tick()` immediately bails (`appState !== 'background'`). Wasted timer fire / 5min. Cleanup.
- `config/index.ts:50` `syncIntervalMs: 5min` + `LocationService.ts:30 MOVING_INTERVAL_MS: 60s` + continuous watchPosition + BackgroundSyncDaemon → idle agent burns ~3-5%/hr battery on no work `[needs verify on-device]`.

### 4.7 Modularity & Flexibility

**Medium**
- `services/CameraService.ts` directly imports `react-native-vision-camera` semantics via `LocationService + ImageResizer + AttachmentRepository + SyncGateway + TaskRepository`. Camera library swap requires touching the service. Define `PhotoCapturer` interface; inject.
- `services/LocationService.ts:5` hard-codes `@react-native-community/geolocation`. `react-native-geolocation-service` has saner battery. `GeoProvider` abstraction.
- `config/index.ts:81-93` — production URL hard-coded 3×. Use `react-native-config` or build-time variant.

### 4.8 Interoperability

**High** — `sync/SyncDownloadService.ts:65` `validateResponse(MobileSyncDownloadResponseSchema, payload, …)` is **non-strict** (line 62 comment). Drift only telemetry-warns. BE schema change dropping a required field silently sets tasks to undefined in SQLite. Critical paths (auth, sync) should be strict.

**Medium**
- `services/MobileSocketService.ts:73` — token captured at connect time; access-token rotation (`AuthService:401`) leaves socket using old token. BE may reject mid-session. Re-emit auth on rotation or reconnect.
- `services/NotificationService.ts:551` — `messagingModule.onMessage` + `setBackgroundMessageHandler` — `[needs verify google-services.json firebase.json single-app-instance opt-out]`. If default Firebase app double-inits, FCM tokens flip.
- `api/apiClient.ts:128-147` — captive portal detection only fires on `text/html` response. Some hotels return `application/json` sign-in payloads — undetected.

**Low** — `sync/SyncDownloadService.ts:469` — `INSERT INTO tasks (… 46 columns)`. New column = change SELECT projection + this INSERT. Codegen the column list.

### 4.9 Compliance in Code

**High** — `services/PrivacyConsentService.ts:80` LOC. AuthContext `:223` best-effort `syncWithBackend()` on every login — if call fails (no network), user can use app without backend consent record. DPDP requires demonstrable consent before any processing. `[needs verify gate]`.

**Medium**
- `services/CameraService.ts:268` `sha256OfFile` per photo. SHA chain is per-photo only — no Merkle chain across task's photos. Malicious actor could swap a single photo offline before upload (re-computed hash matches new bytes). Hash original capture bytes before EXIF strip, chain to task ID.
- `utils/logger.ts:66` `SENSITIVE_KEY_PATTERN` catches `latitude/longitude/coord/gps` as keys but **not as value substrings** (e.g. `Logger.error(TAG, 'failed at lat=12.97, lng=77.59', err)`). Add regex-based number-redaction on message string.
- `services/AuthService.ts:380` `Logger.clearBuffer()` on logout (good). But `services/RemoteLogService.ts:85` `console.warn` and in-memory buffer hold PII across crashes; upload may happen under wrong user's token. `[needs verify upload auth]`.

**Low** — Watermark integrity — `CameraService:242` now rejects GPS-less photos (good). But `WatermarkReStamper` writes after SHA-256 is computed — SHA in DB no longer matches file on disk after re-stamp. `[needs verify flow]`.

### 4.10 User-Centric Logic

**High** — `screens/forms/VerificationFormScreen.tsx` 1114 LOC. 12+ `useState` + multiple `useEffect` chains → flicker when `selectedOutcome` changes (`:245-273` vs `:276-300`). Loading skeleton only on initial template; outcome changes show no transitional state. Gate form behind single derived "ready" boolean.

**Medium**
- `services/NotificationService.ts ASSIGNMENT_SYNC_THROTTLE_MS = 8000` hidden in service. Burst of 20 FCMs → agent sees stale list 8s. Surface "Pull to sync" hint when throttled.
- `api/apiClient.ts:155` `isAutoSaveServerError` etc. — each error class has log-level branch but no user toast. Failed auto-save invisible — agent thinks draft is saved. Status pill in form footer.

**Low** — `screens/tasks/TaskListScreen.tsx:438` `Alert.alert('Submit Failed', err.message)` exposes raw `error.toString()` (incl. stack). Friendly message + "Show technical details".

### 4.11 Testability

**Critical** — **Zero application tests.** `find src -name "*.test.*"` → nothing. `package.json` has no `"test"` script. 161 source files, all production code, no coverage. `usecases/` (cleanest layer, pure functions) is trivially testable. Scaffold jest; target `usecases/` + `SyncConflictResolver` + `SyncQueue` first.

**High**
- Singletons everywhere (`AuthService`, `SyncQueue`, `DatabaseService`, `LocationService`, `NetworkService`, `CameraService`). No DI surface; mocking requires jest module-mock per boundary. Extract `ServiceRegistry` or pass deps into use-cases.
- `services/SyncQueue.ts` uses static imports of `StorageService`/`AuthService`/`SyncQueueRepository`/`SyncEngineRepository`. No in-memory fixture for queue.

**Medium**
- `database/DatabaseService.ts` constructs op-sqlite `open()` at runtime — no in-memory abstraction for tests.
- `sync/SyncEngine.ts:30` `class SyncEngineClass` exported as singleton — concurrent-sync invariants need `jest.resetModules` between tests.

---

## 5. Cross-cutting observations

- **Audit discipline.** Inline comments (`M22:`, `C16:`, `D8 (audit 2026-04-21 round 2):`, `NM-11`, `P13.F`) show 30+ prior fix rounds. Keep this style — it gave this audit a head-start.
- **Encryption story is solid on mobile.** SQLCipher via op-sqlite, key in Keychain, `secure_delete = ON`, recovery path documented. The Knox `SECURE_HARDWARE` workaround is intentional + flagged.
- **Auth + RBAC architecture on BE is centralized and well-defended** (rotation, token_version revocation, scopeAccess factories with activeScope intersection per recent P14 work). Don't disturb it casually.
- **The biggest concentrated risk is the complete absence of tests** on a production app with money/legal exposure. One missing test on `SyncConflictResolver.resolveTaskState` could quietly corrupt the entire offline cache. One missing test on `caseStatusSyncService.recalculateCaseStatus` could ship a state-machine bug to thousands of agents undetected.

---

## 6. Recommended sequencing

| Sprint | Focus | Items |
|---|---|---|
| **1 (week 1)** | Stop the bleeding | Priorities 1, 2, 3, 4, 6 (BE transactions, audit logs, validators, FE PII leak, BE coord PII). Pure surgical edits, no architecture. |
| **2 (week 2)** | Defense-in-depth | Priority 5 (mobile SSL pinning), 8 (FE route boundaries), 9 (mobile CameraService tx restructure), 10 (FE cache wipe). |
| **3-4 (week 3-4)** | Test foundation | Priority 7. Scaffold vitest+msw on BE money controllers + FE money services. Scaffold jest on mobile usecases + SyncConflictResolver + SyncQueue. Target 30% on money paths. |
| **5+ (month 2)** | God-file refactors | Top 3 per codebase (BE: mobileFormController.ts, casesController.ts, usersController.ts; FE: TaskCaseCreationForm, CaseCreationStepper, VerificationImages; Mobile: VerificationFormScreen, LegacyFormTemplateBuilders, NotificationService). One per sprint with test coverage as gate. |

---

## 7. What this audit deliberately did NOT cover

Per scope directive:
- Infra (UFW, fail2ban, VPC, security groups)
- Cloud (AWS RDS migration, S3 cutover, ElastiCache)
- DevOps (GH Actions, deploy scripts, PM2, nginx)
- Build tooling (vite config, gradle, fastlane, Android signing)
- Server runtime (NODE_ENV state on prod box, Postgres TZ setting)

Open items in those areas are tracked in:
- `memory/project_day1_audit_fixes_2026_05_16.md`
- `memory/project_l_crit_3_deferred_rds_migration.md`
- `memory/project_deploy_hardening_2026_05_16.md`

---

**Generated:** 2026-05-17 by 3-agent parallel deep audit (BE/FE/Mobile), synthesized by Agent B.

---
---

# PART 2 — Five-Persona Re-Audit (2026-05-17)

**Method:** 5 independent Principal-grade agents, one per persona, each producing a self-contained re-audit. Scope: code + architecture only (no infra). Each agent had access to PART 1 above and was instructed to **extend, not duplicate**. Personas: CTO / Chief Architect, Senior Security & Compliance Expert, Senior DevOps & Infrastructure Engineer (app-level), Senior Code Auditor & Development Engineer, Senior QA & UX Tester.

**Net new findings vs PART 1:** 4 Critical, 9 High, 14 Medium (enumerated in §13 master priority list).


# 8. CTO / Chief Architect persona

Building on PART 1 — I won't restate the 10 cross-cutting priorities (tests, god-files, non-functional BEGIN, audit-log gaps, mobile SSL pinning, PII leaks, validators). This section is the layer above: **what does this code shape do to our $/month, our ability to swap a vendor, and our ship velocity over the next 12 months?**

The three codebases are functionally solid for "small in-house CRM". As a CTO planning for 10× growth, the concern is not bugs — it's the **structural debt that will compound** once we go from 50 agents to 5000.

## 8.1 Cost Optimization

### 8.1.1 External-API spend (Google Maps)

`controllers/mobileLocationController.ts:560-590` [verified] — `reverseGeocodeHelper` calls Google Geocoding directly with **no caching**. The Redis cache for static map tiles (`controllers/geocodeController.ts:15-17`, `gmap:` key, 7d TTL) exists; reverse-geocode (high-volume) is uncached. BullMQ `reverseGeocodeQueue` only enqueues — worker still hits Google per attachment.

Quantification: every uploaded verification photo = one call. Google Geocoding = **$5/1000 requests**. At 5000 agents × 20 photos/day = 100K calls/day = ~**$15K/month** with zero locality cache. Coords at 4-decimal granularity (~11m) cluster heavily — a `geo:{lat:4dp}:{lng:4dp}` Redis key with 90d TTL realistically hits 60-80% on second visit per neighborhood. **Estimated saving: $9-12K/month at 10K-agent scale.** `[verified]`

`controllers/geocodeController.ts:286-294` [verified] — Static-map proxy has Redis cache (good) but no LRU bound on key namespace; `gmap:*` keyspace grows unbounded.

### 8.1.2 In-process state that won't survive horizontal scaling

`ecosystem.config.js:9` [verified] — PM2 runs `instances: 1, exec_mode: 'fork'`. Today single-instance. But every cache/timer assumes that:
- `middleware/auth.ts:46` `authContextCache: Map` (5s TTL, in-process)
- `services/dbMaintenanceService.ts:86` `setInterval` purges
- `services/enterpriseMonitoringService.ts:124` metrics interval
- `middleware/performanceMonitoring.ts:164` `metricsBuffer: PerformanceMetrics[]` (in-memory, 5000 cap)
- `middleware/performanceMonitoring.ts:242, 436` two more flush/cleanup intervals
- `websocket/server.ts:16` `globalSocketIO` singleton

Day we set `instances: 'max'` (4-8 workers), every worker will:
1. Run dbMaintenance purge — N × identical DELETE/5min
2. Each maintain own auth cache (stampede on cold worker)
3. Each emit OTel with duplicate `service.instance.id` collisions
4. WS clients sticky to one worker; **missing `socket.io-redis-adapter` means cross-worker events silently drop**

**Cost angle:** today we can't horizontally scale Node without re-engineering. Only knob is "bigger box" = pure capex. Adding Redis adapter + leader-election on cron = **~3 days of work** that unlocks per-vCPU scaling and probably halves compute cost at 5× load. `[verified]`

### 8.1.3 OTel sampling

`tracing.ts:75-87` [verified] — OTel auto-instrumentations on; `TraceIdRatioBasedSampler` ratio unset → default. At >100 req/s, full-sample tracing 2-3× egress + ~5-8ms/req CPU. Set ratio 0.05 + tail-based on error/slow. **Saving: 30-50% off observability spend at scale.**

### 8.1.4 N+1 you'll feel in cents-per-request

Already in PART 1 §2.1. Adding: `controllers/mobileFormController.ts` (6352 LOC) sampling shows `SELECT *` at `:2059` plus template renderer pulling every section's lookup row-by-row. At 2000 daily mobile submissions, single largest controllable DB CPU draw. **One sprint converting to `WHERE id = ANY($1)` saves ~15-20% RDS CPU.** `[grep-only]`

### 8.1.5 FE polling overlapping WS

`Header.tsx:52`, `CaseNotificationsTab.tsx:97`, `NotificationHistoryPage.tsx:47` — three **60s polls** even though socket.ts pushes notification events. `FieldMonitoringPage.tsx:159, 490, 516, 533` — four more 60s polls on same page. Each open tab issues ~7 useless req/min. 50 admins × 8 tabs × 7 = **~3000 wasted req/min**. PART 1 covered; cost lens = ~30GB/month free egress saved at zero risk. `[verified]`

### 8.1.6 Logging volume

`grep logger.*` returns **1375 hits** in 257 BE files (~5.3/file). At INFO + JSON, every request ~2-4 KB. 100 req/s × 86400s × 3KB = **~25 GB/day** logs. CloudWatch ingestion $0.50/GB = **~$375/month**, ~60% debug-equivalent INFO. Per-controller env gate `LOG_LEVEL_<controller>` to dial down hot paths without redeploy. `[verified count]`

## 8.2 Flexibility & Adaptability

### 8.2.1 The architecture is rigid in 5 places. None have a seam.

| Vendor / Layer | Coupling site | Swap cost today |
|---|---|---|
| **PostgreSQL** | Direct `pool.query` / `client.query` in ~95% of 57 controllers; **no repository layer**; `transformResult`/`camelizeRow` at `config/db.ts:90` hardcoded for Postgres metadata | 4-6 months. Non-swappable. |
| **Google Maps** | Hard URL in `mobileLocationController.ts:567`, `geocodeController.ts:286` — no `GeocodeProvider` interface | 2-3 weeks. |
| **FCM** | `services/PushNotificationService.ts:4` `import admin from 'firebase-admin'` — singleton getInstance() spread across mobileFormController, fieldMonitoringController, notificationQueue | 3-4 weeks. APNS path is parallel-coded (not abstracted). |
| **Redis** | `controllers/authController.ts` does inline `import('@/config/redis')` | 6-8 weeks. Made worse by 37+ direct `process.env` reads bypassing `config/index.ts`. |
| **SQLCipher (mobile)** | `database/DatabaseService.ts` constructs op-sqlite at runtime; no abstraction | Functional swap only; tests already blocked. |

### 8.2.2 Missing dependency injection

`services/PushNotificationService.ts:60-70` [verified] — singleton `getInstance()`. `caseStatusSyncService`, `taskCompletionFinalizer`, `dbMaintenanceService`, `NotificationService`, `attachmentRenditionService` all same shape. Cannot run two FCM configs / two storage buckets / two notification policies in same process for canary or per-tenant variants.

### 8.2.3 No tenancy boundary

`grep tenant_id|tenantId` returns **zero hits** [verified]. Product is structurally single-tenant. Day we white-label or even split staging/prod on same DB, every controller needs surgery. Worth deciding *now* whether multi-tenancy is on the 18-month roadmap. If yes, introduce `req.tenantId` + `WithTenant<T>` SQL builder before adding more controllers.

### 8.2.4 Hard-coded mobile environment

PART 1 §4.3 — all three mobile env entries point at production. No build-variant separation. Add `react-native-config` + `BuildConfig.API_BASE` for canary releases.

### 8.2.5 FE is over-coupled to one shape

`services/api.ts` (790 LOC) singleton. Cannot stand up second axios instance without duplicating refresh logic. Same for `services/socket.ts:71`.

## 8.3 Continuous Improvement Mindset

### 8.3.1 Zero feature flags. Zero kill switches. Zero gradual rollout.

`grep -i 'featureFlag|killSwitch|isFeatureEnabled'` across BE+FE → **0 hits** [verified]. Every code path ships globally + atomically. No mechanism to:
- Enable invoice numbering change for 5% of clients
- Kill-switch the geocode queue if Google quota exhausts
- A/B test a new CaseCreationStepper for one office
- Disable mobile auto-sync for a misbehaving build

Cost of NOT having this: every behavior change = full deploy + full revert + DB rollback playbook. 3 emergency rollback-shaped commits in recent `git log` (`ca9317bb` "amend", `194f655e` "remove orphan", `cd4dda28` "narrow"). With flags, those = config toggles.

**Recommended:** Unleash (open source), LaunchDarkly (paid), or 200-line in-house Redis-backed service. Wire one flag end-to-end (`enableNewInvoiceFormat` is a perfect candidate given F9.2.2 memory work), then 2-3 flags/sprint after.

### 8.3.2 Observability is partial, not actionable

What we have: OTel tracing scaffolded, `enterpriseMonitoringService.ts` setInterval metrics, `performance_metrics` table writes.

What we lack [verified]:
- **No RED/USE dashboards defined in code** — metrics exist, no SLO spec
- **No business metrics** — no counter for invoices generated, tasks completed, FCM delivery rate
- **`PushNotificationService.ts:222`** swallows error to logger only — no counter, no DLQ. We won't know if 30% of FCMs failed yesterday
- `services/NotificationService.ts ASSIGNMENT_SYNC_THROTTLE_MS = 8000` — magic number, no metric on how often throttle fires

**The diagnostic question "is feature X working in prod for tenant Y?" is currently unanswerable without psql.** Single biggest brake on shipping velocity.

### 8.3.3 Test foundation is the gating issue

CTO framing: **a regulated KYC + money app with 0% mobile / 0.5% FE / 2.3% BE tests is uninsurable for an outage caused by a bad deploy.** When (not if) we misposts ₹X lakh of commissions, the post-mortem reads "we had no test for commissionManagementController.approveCommissions because we had no tests for any controller". Risk register item. Minimum bar to claim "ship 10× more often safely": 60% line coverage on money paths + a CI gate that blocks merge if it drops.

### 8.3.4 Per-tenant config knobs absent

Every limit is global: `BUFFER_MAX=5000`, `syncIntervalMs=5min`, `MOVING_INTERVAL_MS=60s`, `STATIC_MAP_CACHE_TTL_SECONDS=604800`. Once second customer arrives, nothing tweakable per-tenant. Move tunables to `config_settings` DB table keyed by `(tenant_id, key)` with defaults.

### 8.3.5 Deploy as the friction multiplier

`ecosystem.config.js` = `instances: 1` + `restart_delay: 5000` + `max_restarts: 10` = **5-50s service interruption per deploy**. No FE versioning beyond Vite hash, no canary, no graceful drain on socket layer, no `/health/ready` returning 503 until cache-warmed. Every deploy = stop-the-world.

## Top 5 CTO-priority items

1. **Geocode Redis cache + bound it.** Add `geo:{lat:4dp}:{lng:4dp}` cache around `mobileLocationController.reverseGeocodeHelper:560`, TTL 90d. Mirror existing `gmap:` pattern. **~1 day; ~$9-12K/month savings at 10K-agent scale; zero behavior change.**
2. **Introduce feature-flag primitive end-to-end.** 200-line Redis-backed `featureFlag(name, { tenantId, userId, percent })` + matching FE `useFeatureFlag(name)`. Wire one real flag. Unblocks safe rollout for everything after. **~1 sprint.**
3. **Repository layer for money entities only.** `InvoiceRepository`, `CommissionRepository`, `RateRepository`. Forces DI, mockable test surface, lets us migrate to RDS Proxy / read replicas later without 50-file diffs. **~2 sprints.**
4. **Make the app horizontally scalable without re-architecture.** socket.io Redis adapter + sticky session; redis-leader election around `dbMaintenanceService` and `metricsCleanupInterval`; `lru-cache` on `authContextCache`. **~3 days. Unblocks `instances: 'max'` in PM2.**
5. **Wire business + RED metrics with one dashboard per money flow.** OTel scaffolded; missing the metric names (`invoice_created_total`, `commission_approved_total`, `fcm_send_failed_total`, `geocode_cache_hit_ratio`) + a PR rule that money-path PRs add a counter. Without this we ship blind. **~1 sprint to scaffold, ongoing discipline after.**


# 9. Senior Security & Compliance Expert persona

**Scope verification:** Code + architecture only. Read in full: `userDataExportController.ts`, `userErasureController.ts`, `userConsentsController.ts`, `authController.ts`, `middleware/auth.ts`, `middleware/rateLimiter.ts`, `middleware/upload.ts`, `middleware/profilePhotoUpload.ts`, `services/storage/StorageService.ts`, `controllers/storageController.ts`, `routes/storage.ts`, `routes/users.ts`, mobile `SessionStore.ts`, `DatabaseKeyStore.ts`, `apiClient.ts`. Sampled: `auditLogger.ts`, multer configs. PART 1 already covered FE PII leak (#4), BE coord PII (#6), missing express-validator surfaces (#3), mobile SSL pinning absence (#5) — extending rather than duplicating.

## 9.1 Authentication & session management

- **S-CRIT-1 [verified] `/api/storage/*` is an authenticated IDOR primitive on the entire object store.** `routes/storage.ts:11` mounts `streamStorageObject` behind `authenticateToken` only — **no entity authorization**. `controllers/storageController.ts:31-72` calls `storage.exists(key)` then `storage.get(key)` for any key the caller can guess. Keys are deterministic per `StorageService.ts:14-22`: `attachments/{case_id}/{attachment_id}.{ext}`, `kyc/{case_id}/{kyc_id}-{doc_type}.{ext}`, `verification/{case_id}/{task_id}/{photo_id}.jpg`. A field agent (lowest-privileged authenticated user) can iterate integer case IDs and download every KYC document, Aadhaar card, PAN, and verification photo. Controller comment even admits the gap ("entity-scoped reads MUST go through the relevant controller, not this one") but mounts the route anyway. **Severity: Critical (CVSS ~9.1).** DPDP §8(5) breach of "reasonable security safeguards"; RBI Outsourcing Master Direction para 5.4 (customer-data confidentiality). **Fix:** unmount `/api/storage/*`; force every read through entity controllers with `cases.client_id ∈ assignedClientIds` checks. If generic streamer is genuinely needed, signed token containing key + caller userId + expiry, signed with `JWT_SECRET`, verified server-side before `storage.get()`.

- **S-CRIT-2 [verified] `/uploads` is unauthenticated static-served at `app.ts:171`.** `app.use('/uploads', express.static(...))`. Anything ever written there is world-readable to anyone who knows or guesses the filename. Storage-keyed access migration in progress but static mount hasn't been removed. **Severity: Critical** (same DPDP/RBI bucket as S-CRIT-1). **Fix:** delete static mount; proxy legacy filenames through `streamStorageObject` after auth + entity check. If branding intentionally public, move to `/public-branding` mount with no PII.

- **S-HIGH-1 [verified] No MFA anywhere.** `grep -r 'MFA|TOTP|2FA|otpauth' src/` empty in BE. Admin accounts (`settings.manage`, `billing.approve`, `user.create`) authenticate with username+password alone. RBI Master Direction on Outsourcing of IT Services (Sept 2023) para 6.3 + IT Act §43A "reasonable security practices" effectively expect MFA on privileged access for entities handling customer financial data. **Severity: High.** **Fix:** TOTP enrollment for any user holding `settings.manage` or `billing.approve`; gate `/api/auth/login` second step on TOTP for those roles. `otplib` is the minimal lift; `users.totp_secret` (encrypted at rest with envelope key) + `users.mfa_enrolled_at`.

- **S-HIGH-2 [verified] `verifyPassword` bcrypt path is a timing oracle.** `authController.ts:461` runs `bcrypt.compare` only when `user` exists. Non-existent user 404s at `:458` before bcrypt cost is paid. Endpoint is auth-gated (narrow), but leaks "which userIds exist" via response-time deltas. **Fix:** run dummy bcrypt compare against a known hash when `user` is null.

- **S-MED-1 [verified] Refresh cookie missing `__Host-` prefix.** `authController.ts:60-69` sets `crm_refresh_token`. Subdomain takeover (attacker pwns `staging.allcheckservices.com`) could overwrite. Rename to `__Host-crm_refresh_token`.

- **S-MED-2 [verified] `recordFailedLogin` only counts per-username.** `authController.ts:175, 189`. No per-IP counter. Attacker rotating between known usernames stays under per-username cap. Add Redis key `login_lockout:ip:{ip}` with higher cap (50/15min) for credential-stuffing across usernames.

- **S-MED-3 [verified] `loadUserAuthContext` caches `tokenVersion` for 5s with Redis pub/sub invalidation.** `middleware/auth.ts:185, 257-259`. If Redis is down, revoked session stays valid for 5s. Fallback path at `:86-89` is local-only invalidation with warn log. **Fix:** read `tokenVersion` directly via small Redis SELECT bypassing cache for that single field, OR Redis SET membership of revoked JTIs.

## 9.2 Authorization (RBAC / IDOR / BOLA)

- **S-HIGH-3 [verified] `mobileAttachmentController` multer disk-storage with controller-derived path + no content-type sniffing.** Sampled `:49-79`. 50MB upload limit in `middleware/upload.ts:21` + only `file.mimetype` (client-supplied, trivially forged). Combined with static `/uploads` mount (S-CRIT-2) = classic "upload PHP/JS file with `image/jpeg` mimetype" vector. **Fix:** sniff magic bytes via `file-type` library inside `fileFilter`; reject any file whose detected MIME differs from declared; never serve user content from path resolving file extension via `Content-Type`.

- **S-MED-4 [verified] `setBaseUrl` on mobile apiClient is server-side-redirect primitive.** PART 1 §4.3 flagged as Med. Restating: if any code path ever wires server response into this setter (current grep shows none), next request ships bearer token to attacker.com. **Fix:** make `private` or require allowlist `url.startsWith('https://crm.allcheckservices.com')`.

## 9.3 Input validation, injection

- **S-MED-5 [verified] `userConsentsController.ts:75-77`** — `source = (typeof req.body?.source === 'string' ? req.body.source : 'MOBILE') as 'MOBILE' | 'WEB'`. TypeScript cast doesn't validate at runtime; attacker can supply `source: 'admin-impersonation'`. DB-level CHECK may save it; if not, audit-log narrative corruption. **Fix:** `if (source !== 'MOBILE' && source !== 'WEB') source = 'MOBILE'`.

- BE SQL surface parameterized end-to-end. One template-literal SQL at `performanceMonitoring.ts:224` already flagged in PART 1 §2.3.

## 9.4 Secrets, encryption at rest, in transit

- **S-HIGH-4 [verified] Mobile SQLCipher key in software-only keystore on devices without StrongBox.** `DatabaseKeyStore.ts:19-23` generates 32-byte hex key, stored with `ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY` deliberately without `SECURITY_LEVEL.SECURE_HARDWARE` (`:42-67` documents Samsung Knox workaround). Tradeoff documented + defensible, but on rooted device the key is extractable; **DB encryption no longer provides defense-in-depth for KYC photos cached in `Attachment.localEncryptedPath`** (which per PART 1 §4.3 are actually PLAINTEXT on disk — `localEncryptedPath` is a misnomer). **Severity: High (DPDP §8 + RBI customer-data confidentiality).** **Fix:** (a) rename `localEncryptedPath` → `localPath` to stop the false-security lie; (b) if encryption feasible, encrypt blob with key derived from SQLCipher key (HKDF) before write; (c) document in DPDP DPIA that root-detection is NOT relied on for KYC protection.

- **S-HIGH-5 [verified] SessionStore holds both access + refresh token in single Keychain entry as JSON.** `SessionStore.ts:11-75`. PART 1 §4.3 flagged as Low. **Bumping to High** in compliance lens: single Keychain leak returns BOTH tokens. Splitting into two services is one extra Keychain call and gives independent attack surfaces. Done routinely in fintech apps for RBI-regulated workloads. **Fix:** two separate `setGenericPassword({ service })` calls.

- **TLS pinning not enforced** — PART 1 #5. Restating: for a financial-services KYC app this is a regulator-visible deficiency under RBI cyber-security guidelines.

## 9.5 Audit-log integrity (IT Act §65B + RBI audit trail)

- **S-HIGH-6 [verified] `audit_logs` table has no tamper-evidence.** `utils/auditLogger.ts` is 25-line wrapper around `enqueueAuditLog`. No hash-chain (`prev_hash`, `row_hash`), no HMAC signature, no append-only enforcement at DB (any DBA or SQL-injection can `UPDATE audit_logs SET …`). For Indian Evidence Act §65B(4) certification — required to admit electronic records as evidence in dispute (commission fraud, KYC fraud) — courts increasingly expect demonstrable tamper-evidence. **Severity: High (RBI Master Direction Annex II "audit-trail integrity"; IT Act §65B).** **Fix:** add `prev_row_hash VARCHAR(64)` + `row_hash VARCHAR(64)` columns; compute `row_hash = SHA256(prev_row_hash || canonical_json(row))` in queue processor before INSERT; cron job verifies chain nightly + alerts on break. Revoke UPDATE/DELETE on `audit_logs` from `acs_user` (only queue role gets INSERT).

- **S-MED-7 [verified] `getUserConsents` returns IP + UA without redaction or self-or-admin check broader than `user.view`.** `userConsentsController.ts:137-181` + `routes/users.ts:584-591`. `user.view` broadly held. IP+UA from consent acceptance is itself personal data (DPDP §2(t)). **Fix:** restrict consent history endpoint to `settings.manage` OR self, mirroring export endpoint's authz model.

## 9.6 DPDP Act 2023 specific gaps

- **S-HIGH-7 [verified] No breach-notification scaffolding.** DPDP §8(6) requires notifying Data Protection Board AND affected data principals within regulator-specified window (draft rules suggest 72hr). No code path for: (a) detecting bulk data egress events, (b) generating notification batches, (c) recording dispatch in `audit_logs`. **Fix:** `data_breach_incidents` table + `/api/admin/incidents` admin surface; Redis-backed bulk-egress detector (>N attachments fetched by single user in <M minutes → flag).

- **S-MED-8 [verified] DPDP §11 export bundle excludes case content "employer's business record."** `userDataExportController.ts:14-21` reasoning correct for field agent's own data principal rights, BUT bundle also excludes audit-log of who accessed THEIR profile (only references audit-log endpoint). For complete §11 access right, export should at minimum embed count + cross-reference URL, which it does. **Severity: Low** — well-thought-out; flagging because regulators may push for inline inclusion.

- **S-MED-9 [verified] No FCM unsubscribe on erasure.** `userErasureController.ts:127` deletes subject's notification_tokens but no FCM admin SDK call to invalidate Google-side token. If device reassigned, FCM messages targeting erased userId may still land. **Fix:** call `messaging().unsubscribeFromTopic` or skip with documentation.

## 9.7 RBI Outsourcing Master Direction surface

- **S-MED-10 [verified] No data-residency assertion.** `S3Storage.ts` accepts any `endpoint`. RBI MD 2023 para 5.5 requires customer data remain in India unless RBI-approved. **Fix:** in `services/storage/index.ts` factory, assert `process.env.S3_REGION` starts with `ap-south-` or `in-`; fail boot otherwise.

- **S-MED-11 [verified] Retention timeline not enforced in code.** `userErasureController.ts:18-21` documents 7-yr KYC retention as manual carve-out; no scheduled job deletes records after retention. DPDP §8(7) "purpose limitation + storage limitation" cuts the other way — retaining beyond purpose breaches DPDP. **Fix:** `dbMaintenanceService` job hard-deletes `verification_attachments` whose `cases.completed_at` older than retention_years + 1, configurable per-client.

## 9.8 PCI-DSS / Aadhaar Act

- **[verified] No card data anywhere** — `grep -r 'card_number|cvv|pci'` empty. PCI surface N/A.
- **[verify before remediating] Aadhaar plaintext check** — `grep -in 'aadhaar|aadhar' kycVerificationController.ts` empty; KYC docs stored as files with `document_type` FK. Aadhaar Act §29(4) prohibits storage of raw Aadhaar except masked. **Search `verification_attachments.metadata`, `form_submissions.field_values`, `case_data_entries.value` JSONB for 12-digit numeric matches**; if present, masking middleware storing `XXXX-XXXX-` + last 4 only.

## Top 5 security & compliance priorities

| Rank | Finding | Why first | Effort |
|---|---|---|---|
| **1** | **S-CRIT-1 + S-CRIT-2** — `/api/storage/*` IDOR + unauthenticated `/uploads` static mount → total KYC exposure | DPDP §8(5); RBI para 5.4; one-line route changes + entity controller plumbing | 2-3 days |
| **2** | **S-HIGH-6** — `audit_logs` lacks tamper-evidence (no hash chain, no HMAC, no append-only DB role) | IT Act §65B admissibility + RBI audit-trail integrity. Required before commission-fraud dispute reaches arbitration | 1 sprint |
| **3** | **S-HIGH-1** — No MFA on admin / `billing.approve` / `settings.manage` accounts | RBI cyber-security expectation; tightly scoped (~10-20 users); `otplib` 200-LOC integration | 3-5 days |
| **4** | **S-HIGH-4 + mobile-photo encryption** — `Attachment.localEncryptedPath` misnomer (plaintext); SQLCipher key not in StrongBox | DPDP §8 + RBI customer-data confidentiality on field devices that get lost/rooted weekly | 1 sprint |
| **5** | **S-HIGH-7** — No DPDP breach-notification scaffolding | DPDP §8(6) — draft rules will compel 72hr notice; need plumbing in place BEFORE first incident | 1 sprint |


# 10. Senior DevOps & Infrastructure Engineer persona (app-level)

Re-audit angle: code patterns that decide whether the AWS deploy will actually scale, fail over, and interoperate when production hits multi-thousand users. **Confidence labels:** `[V]`=read-verified, `[V*]`=verified narrow window, `[G]`=grep-confirmed, `[I]`=architectural inference.

## 10.1 Scalability (app-level)

### CRIT-D1 — Cache-warming pre-fills are tenant-blind and read globally `[V]`
`services/cacheWarmingService.ts:43-50` warms `clients:list` with *every* active client, and `:298-329` warms `cases:recent:pending` / `cases:recent:in-progress` LIMIT 500 with **no `client_id` predicate and no `deleted_at IS NULL`**. These keys are read with no scope suffix (`middleware/enterpriseCache.ts:547` comment confirms they bypass the active-scope-suffix system documented in P11/P13 work). **Any controller reading them returns global rows to scoped users — defeats the entire scope narrowing layer the team just shipped.** Also reads soft-deleted cases (NEW-CRIT-1 still partially open). **Fix:** drop the global pre-fills, warm only true lookup tables (`verification_types`, `products`, `rate_types`).

### CRIT-D2 — Cache-warming runs on every PM2 worker `[I]`
`CacheWarmingService.warmAllCaches` called at boot. With N workers, multi-join `warmActiveUsersCache` runs N times ~30s after every restart. **Fix:** Redis SET NX `cache:warm:lock` TTL 60s (same leader-election fix as `dbMaintenanceService.ts:79`).

### HIGH-D3 — Unbounded pagination on user-facing list `[V]`
`controllers/usersController.ts:270` `Number(req.query.limit || 20)` — no upper bound. `getCases` caps at 500 `[V casesController.ts:285]`. Malicious or buggy caller requests `?limit=1000000` → holds one DB connection + `loadUserAuthContext` cache row for tens of seconds, OOM-pressures Node heap. **Fix:** `const MAX_PAGE_SIZE = 200; const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, n))` in a `parsePagination(req)` helper on every list endpoint.

### HIGH-D4 — 5xx-retry of non-idempotent POSTs on FE `[V]`
`services/api.ts:432-470` `executeWithRetry` retries POST/PUT/DELETE/PATCH on any 5xx, 4 attempts, exponential backoff. `Idempotency-Key` stamp at `:79-89` reuses same UUID across retries (good), BUT `middleware/idempotency.ts` is only mounted on *some* routes. Any route without idempotency middleware = N duplicate writes when LB returns 502 on slow-but-successful query. Combined with BE `withTransaction` retrying deadlocks 6× (`config/db.ts:159`), worst case for `createCase` POST on partial outage = `4 × 6 = 24` row insertions. **Fix:** (a) make `executeWithRetry` opt-in for mutations (retries=0 default for non-GET) OR (b) globally mount idempotency middleware for every `apiRouter.post/put/patch/delete`.

### HIGH-D5 — Socket.IO `transports: ['websocket']` only `[V]`
`services/socket.ts:66` (FE) and `crm-mobile-native/src/services/MobileSocketService.ts:73` both force WS. Corporate proxies / carrier WAFs / hotel Wi-Fi blocking WebSocket upgrade leave app with no realtime — invalidations stop, mobile sync trigger events vanish. Server has Redis adapter wired `[V index.ts:11,82]`. **Fix:** `transports: ['websocket', 'polling']` (polling as fallback only).

### MED-D6 — WS connect storm: `reconnectionAttempts: 20` then silent `[V]`
`services/socket.ts:72` — after 20 fails socket permanently dead with no UI signal. With `reconnectionDelayMax: 30s`, 20 attempts ≈ 8min before silence. `SocketRateLimiter` `connect` bucket is 10/60s `[V websocket/server.ts:58]` — a 2000-user mass-disconnect storm (deploy + LB drain) burns through connect budget in 60s; reconnect attempt 11+ gets `Connection rate limit exceeded`. **Fix:** raise per-user `connect` to ~30/60s OR jitter reconnect; toast "Reconnecting…" after attempt 5, "Realtime offline — refresh" at give-up.

### MED-D7 — `useStandardizedMutation` skipped on most paths, no global queryClient onError `[I]`
With `executeWithRetry` doing 4× exponential retry on 5xx (~15s blocking) + ~110 raw `useMutation` callers without `onError`, slow BE = 15-second blank-state UI per click. Combined with `staleTime: 2min` users see stale carry-over. **Fix:** axios default `retries: 0` for mutations; opt-in retry per mutation.

## 10.2 Reliability (app-level)

### CRIT-D8 — Graceful shutdown closes HTTP server but doesn't wait for in-flight `[V]`
`src/index.ts:188` `server.close(callback)` fires-and-forgets; next line `:193` `io.close()` doesn't await; `:199-205` `await`s queue closes. On SIGTERM under load, BullMQ workers killed mid-job *before* HTTP requests drain. 30s hard timeout `:174-177` `process.exit(1)` fires if any in-flight request hangs. **Fix:** `await new Promise(r => server.close(r))` before BullMQ stop; PM2 `kill_timeout` ≥ 35s.

### CRIT-D9 — Geocoding circuit breaker DEFINED but NOT USED `[V]`
`utils/circuitBreaker.ts:159` declares `circuitBreakers.geocoding`. **Zero call sites use it.** Both `controllers/geocodeController.ts:294` (`await fetch(url)` — no timeout, no retry, no breaker) and `controllers/mobileLocationController.ts:575` (10s AbortController only) call Google directly. Google 5xx at 1% rate at 2000 users → 20 req/s hang for 10s each → 200 stuck connections, exhaust pool (max 500 `[V config/db.ts:23]`). **Fix:** wrap both call sites with `circuitBreakers.geocoding.execute(() => fetchWithTimeout(...))`.

### CRIT-D10 — BE raw `fetch()` with NO timeout `[V]`
`controllers/geocodeController.ts:294` `await fetch(url)` — no `signal: AbortSignal.timeout(...)`. Node 18 `fetch` defaults to no timeout. Single slow Google response holds request thread + (transitively) a DB client. **Fix:** `AbortSignal.timeout(10_000)` + zod-validate response body.

### HIGH-D11 — Mobile sync schema validation non-strict `[V]`
`sync/SyncDownloadService.ts:65` comments explicitly that drift is *telemetry-warn only*. BE schema change dropping required field silently sets thousands of agents' SQLite to `undefined`. On regulated, money-touching, offline-first app, sync is the ONE boundary that MUST be strict. **Fix:** strict mode behind feature flag `MOBILE_STRICT_SYNC` (off week-1, on after clean release cycle). Add force-update flow gated on `MobileSyncDownloadResponseSchema.version` mismatch.

### HIGH-D12 — FE 5xx-retry stacks on top of BE deadlock-retry `[V]`
Cross-reference D4 under reliability: `FE 4 × BE-deadlock 6 = 24 attempts` worst case per transaction. With BE 25s `statement_timeout` + 6 retries: single deadlocked write holds connection ~3-5 min total before responding. **Fix:** disable FE mutation retry entirely; let BE handle 40P01/40001 transparently.

### HIGH-D13 — WS broadcast amplification via `case:updated` listener `[V]`
`contexts/AuthContext.tsx:233-242` — each `case:updated` WS push invalidates 5 query keys. BE emits on assign, revisit, revoke. Bulk-assign 100 cases = 100 events × 5 invalidations × every open tab. **Fix:** debounce/coalesce on FE (250ms) + broader key (`['cases']`); BE could emit one `cases:bulk_updated` for bulk operations.

### MED-D14 — Mobile sync mutex is a boolean `[V]`
`sync/SyncEngine.ts:99-126` — `this.syncInProgress` boolean toggle. Watchdog restart path `:255-269` sets flag in setTimeout but only "double-checks" — gap between `finally` reset and setTimeout callback can interleave with `BackgroundSyncDaemon.tick`. **Fix:** single mutex (`p-mutex`), or `if (await SyncStateService.tryAcquireLock())` against SQLite row.

### MED-D15 — `cacheWarmingService` analytics queries unscoped + LIMIT 500 `[V]`
Even after D1 fixed: `:341-388` `warmAnalyticsCache` aggregates field-agent workload over ALL users without bound; runs on every PM2 worker on every restart. **Fix:** materialized view (refresh hourly) + read view from cache only.

## 10.3 Interoperability (app-level)

### HIGH-D16 — Inconsistent error-envelope keys block client error UX `[V]`
PART 1 flagged 266 `INTERNAL_ERROR` codes + `{success:false, message}` mixed with `{success:false, error:{code,message}}`. Cross-cutting impact: FE axios interceptor at `services/api.ts:31` (`getErrorCode`) reads `error.response.data.error.code`. For controllers returning flat shape (`kycVerificationController.ts:145/440/454/484`), `errorCode` is `undefined`, so **the P8 reactive scope recovery at `:284-298` cannot fire for those endpoints** — INVALID_ACTIVE_SCOPE_* errors from KYC would not clear sessionStorage. Load-bearing scope-control invariant silently broken if KYC ever returns one of the active-scope codes. **Fix:** central `errorResponse(res, code, message, status)` helper; lint rule rejecting raw `res.status(4xx).json({success:false, message})`.

### HIGH-D17 — `X-Active-Client-Id` CORS allowedHeaders fragility `[I]`
`SCOPE_CONTROL_HANDOFF.md:102` calls out the CORS fix (P11.D commit `d12e9077`) as load-bearing. Any future `app.ts` cors change that drops these silently breaks narrowing in browser. **Fix:** dedicated unit test on cors middleware config — currently no test covers this.

### HIGH-D18 — Mobile access token captured at WS-connect time, not refreshed `[V*]`
PART 1 §4.8 — `auth: { token }` captures access-token at connect; rotated tokens (`AuthService:401`) don't propagate to WS. Server-side `verifyJwtWithRotation` eventually 401s next handshake; rate-limit (10/min connect bucket) locks user out. **Fix:** mobile listens for token rotation event + emits `auth:reauthenticate` with new token, OR forces socket reconnect on rotation.

### MED-D19 — Body parser `5mb` vs `50mb` mount-order fragility `[V]`
`app.ts:174` global `5mb`, `:300` `/mobile` re-parses at `50mb`. Future route under `/mobile/x` without `extendedTimeout, express.json({limit:'50mb'})` inherits global — surprise 413. **Fix:** explicit `express.json({limit:'50mb'})` on `/mobile/sync/upload`, `/mobile/attachments` ONLY; rest stays at 5mb.

### MED-D20 — No OpenAPI / shared types surface `[I]`
NEW-HIGH-1 deferred in memory. Practical interop cost: FE `services/schemas/runtime.ts` covers ~8 of 40 services, mobile `MobileSyncDownloadResponseSchema` is non-strict. Renamed BE field detected only when telemetry warns or UI silently shows undefined. **Fix:** start by exporting BE response zod schemas from `shared/` package, FE+mobile import same schemas. Mobile sync first (highest blast radius).

### MED-D21 — Captive-portal detection only catches `text/html` `[V]`
`crm-mobile-native/src/api/apiClient.ts:128-147` — captive portal returning `application/json` (some enterprise WAFs do) undetected; mobile sync silently records "success" with wrong body. **Fix:** also assert `data.success !== undefined` on `/api/*` responses; if neither matches, treat as captive portal.

### LOW-D22 — Notification BullMQ jobIds use `__` separator and `(taskId || caseId)` `[V]`
`queues/notificationQueue.ts:655` `case-assign__${data.taskId || data.caseId}__${data.userId}__${data.assignmentType}`. Falling back to caseId on non-KYC reassign that lacks taskId could collide with different task's assignment under same case → second job silently de-duped within kept-jobs window. **Fix:** require taskId for task-level assignment events; allow caseId only for case-level events.

## 10.4 Quantification: what breaks at 2K vs 20K users

| Driver | 2,000 users | 20,000 users |
|---|---|---|
| DB pool `max=500` `[V db.ts:17]` | OK (≥4× headroom) | Saturates; need RDS Proxy or app pgbouncer |
| `loadUserAuthContext` 5s TTL `[V]` | ~400 join/s cold (manageable) | ~4000/s — needs Redis L2 |
| `cacheWarmingService` × N PM2 workers `[V]` | Boot storm tolerable | Boot becomes unstable — leader-election mandatory |
| WS connect bucket `10/60s/user` `[V]` | OK | Deploy-drain storm self-throttles users out |
| Mobile `WATCHDOG_PER_ITEM_MS = 15s` `[V]` | OK | 1000-item queue → 4hr timeout cap = 20min OK but UI lies about sync state |
| FE `gcTime: 30min` + `clear()` on permission `[V]` | OK | One admin perm edit = 20K browsers refetch ~50 queries each |

## Top 5 app-resilience priorities (sequenced)

1. **Wire geocoding circuit breaker + add timeouts to BE `fetch()`** (D9, D10). Two-line fixes that prevent pool exhaustion on Google outage. `controllers/geocodeController.ts:294` + `mobileLocationController.ts:575`.
2. **Disable FE `executeWithRetry` for non-GET methods by default** (D4, D12). `services/api.ts:535,551,560,570`. Eliminates 24× write amplification.
3. **Tenant-scope or delete the cache-warming globals** (D1, D2, D15). `services/cacheWarmingService.ts:298-329` reads cross-tenant + soft-deleted. Delete global cases/users warm paths; keep only true reference tables. Add Redis leader-election for what remains.
4. **WebSocket polling fallback + reconnect UX signal** (D5, D6, D18). One config line on FE+mobile; add reconnect toast + "realtime offline" banner; mobile re-emit auth on token rotation.
5. **Strict-mode mobile sync schema validation behind feature flag** (D11). `sync/SyncDownloadService.ts:65` — flip `validateResponse` to strict, gated on remote-config until backwards-compat verified on one release cycle. Closes single largest silent-corruption path.


# 11. Senior Code Auditor & Development Engineer persona

**Method:** Independent re-audit on top of PART 1. Goal: surface what the first auditor missed; cite where I concur.

## 11.1 Maintainability

Concurs with PART 1 §1, §2.5, §3.5, §4.5 (god files, mixed concerns).

### Additional findings the first auditor missed

**[CRITICAL] BEGIN-on-pool anti-pattern is wider than reported.** PART 1 priority #1 names `usersController.ts:1916, 2144`. Same `await query('BEGIN')` (which opens BEGIN on fresh pool checkout and runs DELETE/INSERT on different physical connection) found in:
- `controllers/territoryAssignmentsController.ts:371, 690, 882, 981` — four sites, all on user→area / user→pincode replacement
- `controllers/pincodesController.ts:321` — pincode↔area replacement

**5 additional silent-no-tx sites on scope/territory tables.** Same fix (`withTransaction`), same severity. "9 BEGIN sites total" in PART 1 is undercounted.

**[HIGH] `casesController.ts` (3335 LOC) ships ZERO `createAuditLog` calls.** Grepped every exporter: `createCase` (2218), `updateCase` (1114), `exportCases` (1412). Case create/update + PII export with no audit trail. PART 1 caught commission-management gap but not case-management gap — arguably bigger because cases hold customer PII (DPDP §11). Wire `auditLogger` on all three.

**[MEDIUM] Dead dependencies inflate FE bundle.** `package.json` declares:
- `react-window` — zero imports across 371 files. ~30 KB gzip.
- `html2canvas` — zero direct imports; only `html2canvas-pro` used (`VerificationImages.tsx:21`). Shipping both. ~80 KB.
- `react-chartjs-2` + `chart.js` — zero imports; `recharts` is the only chart lib. ~90 KB.
- `react-loader-spinner` — zero imports (`react-loading-indicators` used). ~15 KB.
- `react-icons` — exactly ONE site (`SettingsPage.tsx:31`); `lucide-react` is project standard. Icon-font payload still imports.

Combined: ~200-300 KB shaved with single `npm uninstall`. PART 1 §3.4 says "no virtualization" but didn't notice `react-window` is in deps yet unused.

**[MEDIUM] No functional indexes on case-insensitive lookups.** `clientsController.ts:1708/1728/1731/1751/1754`, `statesController.ts:527`, `citiesController.ts:547/563/579/588` all do `WHERE LOWER(name) = LOWER($1)`. Grep against `acs_db_final_version.sql` finds zero `CREATE INDEX … ON … (LOWER(name))`. Seq scan on lookup table per query. Small tables today, but bulk-import paths hit in tight loops. Add `CREATE INDEX idx_countries_name_lower ON countries (LOWER(name))` per table, or store + query normalized `name_lower` generated column.

**[MEDIUM] Magic-number `staleTime: 2min` + `gcTime: 30min` is global in `App.tsx`.** Money screens (billing, invoices, commissions) inherit same stale window. User editing invoice on /billing then navigating to /invoices sees pre-edit total for up to 2 min. Per-feature `staleTime: 0` for money + KYC queries.

**[LOW] TODO/FIXME density low and clean.** 10 markers across all three codebases (BE 8, FE 2, mobile 0). Genuine debt encoded as inline audit-codes (`M22:`, `NM-11`) — better discipline than most shops.

## 11.2 Modular design & microservices

Concurs with PART 1 §2.7 (no repository layer), §3.7 (pages do fetching + presentation), §4.7 (services tightly coupled to vendor libs).

**[HIGH] React Query cache is hidden monolith.** 288 `useQuery` sites, 110+ `useMutation` callers, but only **4 `invalidateQueries` call locations** in whole FE (`AuthContext.tsx:224-241`, `utils/clearCache.ts:116-117`). Mutations rely on staleTime + refetch-on-mount, not targeted invalidation. Consequence: mutation in feature A doesn't invalidate feature B's cache even when sharing keys, and admin-side permission change blows whole cache (PART 1 priority #10). Long-term fix: per-feature `queryKeys.ts` + per-feature invalidator hooks.

**[HIGH] 60s polls + per-screen `setInterval` (`Header.tsx:121` clock 1Hz) are scattered timers without central scheduler.** First extraction win toward a "presence service": wrap all polls in a single `usePollingScheduler` keyed on `(documentVisible, route)`, saves work AND gives seam to push server-side later.

**[MEDIUM] OFFSET pagination everywhere (45 sites).** Combined with zero `useInfiniteQuery` on FE, deep pages hit `COUNT(*) OVER()` + seq-scan + full re-render. Move money + cases lists to keyset/cursor pagination as precursor to extracting them.

### Top 3 extraction candidates for future microservices

| # | Candidate | Boundary | Cut order | Estimate |
|---|---|---|---|---|
| 1 | **Geocode service** | `geocodeController` + `mobileLocationController` (geocode parts) + `reverseGeocodeQueue` + static-map cache | (a) extract Redis keyspace into namespace, (b) front with HTTP API behind existing controllers, (c) cutover, (d) move queue + worker out | ~2 weeks. Lowest risk, highest signal. |
| 2 | **Billing service** | `invoicesController` + `commissionManagementController` + `commissionsController` + `ratesController` + `gstResolver` + `financialConfigurationValidator` | (a) repo layer for `invoices/commissions/rates/invoice_sequences/commission_calculations` (no SQL outside repo), (b) outbox for `case.status` reads, (c) extract behind feature flag | ~6 weeks. Need test coverage first (current 0%). |
| 3 | **KYC / verification service** | `kycVerificationController` + `verificationTasksController` + `services/task*Validator/Finalizer` + `caseStatusSyncService` | (a) collapse `mobileFormController` 6352 LOC + move `LegacyFormTemplateBuilders` to server-driven JSON, (b) repo layer, (c) extract | ~10 weeks. Mobile coupling is bottleneck. |

## 11.3 Performance (code-level)

Concurs with PART 1 §2.1, §2.4, §3.4, §4.4.

### Additional N+1 hot spots beyond PART 1's enumeration

- `controllers/invoicesController.ts:1119-1122` — serial `await resolveTaskBillingAmount(task)` over `taskCandidates`. Invoice generation for 200-task bills issues 200 sub-queries serially.
- `controllers/invoicesController.ts:1230-1253` — nested `for (line of generatedLines) { await INSERT lineItem; for (linkedTask of line.linkedTasks) { await INSERT link } }`. Two-level serial chain inside tx.
- `controllers/productsController.ts:601-603` — `for (cid of clientIds) await client.query(INSERT)`. Same pattern as territory.
- `controllers/userTerritoryController.ts:157-158` — duplicate of `territoryAssignmentsController` pattern.
- `controllers/casesController.ts:2784-2785` — `for (appData of applicantsData) await client.query(INSERT applicant)`.
- `controllers/casesController.ts:3133-3134` — `for (kyc of kycTasksCreated) await queueCaseAssignmentNotification`. Should be `Promise.all(map)` (queue idempotent).

All fix with multi-row `INSERT VALUES (...),(...)` or `Promise.all`. Pure mechanical wins.

**[HIGH] OFFSET + missing `useInfiniteQuery` is compounding bug.** 45 BE sites use `OFFSET $n`. FE has zero `useInfiniteQuery`. For lists with row counts >1000 (cases, completed cases, audit logs, MIS reports), deep pages get worst-case `COUNT(*) OVER()` + planner-forced seq-scan + full client refetch + full table render. Cursor + infinite query closes all three layers.

**[MEDIUM] `setInterval` schedulers fire even when work impossible:**
- `dbMaintenanceService.ts:86` — every PM2 worker; no leader election (PART 1 caught)
- `performanceMonitoring.ts:242,436` — two independent intervals; cleanup interval (`:436`) does `DELETE … WHERE recorded_at < NOW() - INTERVAL '24 hours'` every N min — if partition rotation is doing its job (memory says perf_metrics partitioned daily as of F11), this is wasted work. Drop after confirming partition pruning.
- `websocket/server.ts:75` — `setInterval(sweep, 3600_000)` with 60s buckets: 59min of stale entries between sweeps (PART 1 caught).

**[MEDIUM] JSON.parse cost on hot paths — 25 sites, several inside loops:**
- `middleware/idempotency.ts` parses cached response bodies every request hit
- `middleware/auth.ts` parses `permissions` jsonb from `roles_v2` per cold authContext load
- `controllers/mobileSyncController.ts`, `mobileFormController.ts`, `mobileAttachmentController.ts`, `mobileCaseController.ts` — each parses `payload`/`formData` blobs on incoming sync packets. 50-task sync bundles + 5MB JSON limit on `/mobile` = meaningful peak JS-heap. `[grep-only — would need flamegraph to size]`.

## 11.4 Other deltas

- **`config/db.ts:201` "Transaction retry exhausted" loses original PG code** (PART 1 §2.2 medium). Makes incident triage on contention much harder. Re-throw `lastError` with `.cause`.
- **WebSocket auth-token rotation BE side.** `websocket/server.ts` verifies JWT at handshake but no listener closes a socket when `token_version` is rotated mid-session. Revoked user keeps WS push channel until next reconnect. `[needs verify in websocket/server.ts handler]`.
- **`logger` discipline.** BE has only 4 raw `console.*` calls (vs 9 FE, 5 mobile) — best-in-class. Risk is `logger.info(req.body)` patterns; fix surface is extending `logRedact.ts` SENSITIVE_KEYS + lint rule, not per-site edits.

## Top 5 code-auditor priorities (delta vs PART 1)

| # | Severity | Finding | Files | Why it ranks |
|---|---|---|---|---|
| 1 | **CRITICAL** | Same silent-no-tx BEGIN-on-pool bug found in 5 NEW sites not in PART 1 list | `territoryAssignmentsController.ts:371, 690, 882, 981`, `pincodesController.ts:321` | Doubles priority-#1 fix surface. Territory/scope partial writes corrupt access control. |
| 2 | **HIGH** | `casesController.ts` (createCase, updateCase, exportCases) has ZERO `createAuditLog` | `controllers/casesController.ts:1114, 1412, 2218` | DPDP §11/§12 require demonstrable processing record for case PII. Bigger gap than commission. |
| 3 | **HIGH** | Targeted `invalidateQueries` severely under-used (4 sites for 110+ mutations) | `services/*.ts` mutation callers; `contexts/AuthContext.tsx:224-241` | Combined with global 2-min staleTime, money screens show stale numbers post-mutation. |
| 4 | **MEDIUM** | 6 dead/duplicated FE deps shipping in bundle | `CRM-FRONTEND/package.json` | ~200-300 KB recoverable with one `npm uninstall`. Plus deletes "is virtualization shipped?" ambiguity. |
| 5 | **MEDIUM** | Missing functional indexes on `LOWER(name)` lookups in 10+ sites | `clientsController/statesController/citiesController` × 10 | Seq scan on every state/city import; bulk client onboarding does this in tight loops. Pure SQL win. |


# 12. Senior QA & User Experience (UX) Tester persona

Independent QA + UX pass over CRM-FRONTEND + crm-mobile-native. Extends PART 1 §3.10 / §4.10 from QA angle: can the team **measure** UX and **regress-test** it.

## 12.1 Performance Testing readiness

**Confidence: HIGH (read the actual harness + tracing wiring).**

Better than it looks at first glance — a real perf harness exists, but is half-wired and zero-evidenced (no `ops-summary.json` in repo, GH workflow note admits "backend boot step is added in follow-up CI commit").

### What exists

| Layer | Asset | State |
|---|---|---|
| k6 smoke (5 VU / 30s) | `CRM-BACKEND/scripts/load/smoke.js` | exists, thresholds set (p95<500, err<1%) |
| k6 scenarios (20→200 VU ramp) | `CRM-BACKEND/scripts/load/scenarios.js:23-44` | 10 endpoints, per-endpoint thresholds |
| CI wiring | `.github/workflows/load-test.yml:80-92` | **does not actually boot the backend** — line 82-87 explicit comment "smoke job runs k6 against the health endpoint only" |
| BE tracing | `CRM-BACKEND/src/tracing.ts` | OTel SDK, opt-in via `OTEL_ENABLED=true`, ratio sampler |
| FE tracing | `CRM-FRONTEND/src/tracing.ts` | OTLP web exporter, opt-in via `VITE_OTEL_ENABLED`, traceparent propagation |
| BE perf middleware | `CRM-BACKEND/src/middleware/performanceMonitoring.ts:39-91` | wired at `app.ts:205`, writes to metrics store |
| BE slow-query | `routes/health.ts:511-545` exposes `health/metrics` window query | requires `performance_metrics` table populated |
| Mobile telemetry | `crm-mobile-native/src/telemetry/MobileTelemetryService.ts` | full sync-health pipeline, Sentry + Datadog **dynamic-`require` optional** (line 72, 79) |
| Mobile health probes | `sync/SyncEngine.ts:131-222` emits backlog / cycle / watchdog events into queue | drains via `flush()` to internal API |

### What is missing / broken

- **k6 CI is a stub.** `.github/workflows/load-test.yml:80-92` runs k6 against backend that never started — smoke "passes" because only assertion that fires is unauthenticated health probe; 5-VU auth+cases path silently no-ops (`smoke.js:40-44`). **Merge gate is theatrical.**
- **OTEL is off in prod by default.** `tracing.ts:30` `enabled = process.env.OTEL_ENABLED === 'true'` — nothing in `ecosystem.config.js` / `start-production.sh` sets it. Tracing infra ships but is dark.
- **Sentry / Datadog are optional `require()` calls on mobile, never installed.** `MobileTelemetryService.ts:71-82` wraps both in try/catch — neither package shows up in `crm-mobile-native/package.json` (grep verified). Telemetry pipeline forwards to own backend endpoint only. **No crash-free-rate dashboard exists.**
- **Sentry on FE is commented out** at `CRM-FRONTEND/src/components/ErrorBoundary.tsx:86` and `hooks/useErrorHandling.ts:235-236`. `ErrorBoundary` renders "Our team has been notified" (line 127) — **this is false.** Either wire Sentry or change copy.
- **No RUM / Web Vitals.** `grep web-vitals|onCLS|onLCP|onFID|onINP|PerformanceObserver` → zero hits. `useEnterprisePerformance.ts` (492 LOC) is unused (zero importers). Dead infra masquerading as instrumentation.
- **Mobile cold-start, FPS, JS-thread blockage, frame-drop telemetry: none.** No Hermes profiling, no `react-native-performance`. Diagnostics screen surfaces queue/network state but never frame budget or memory.
- **Synthetic probes:** `/api/health`, `/health/detailed`, `/health/deep`, `/health/ready`, `/health/live` all exist (`routes/health.ts:43-509`) — solid. No external uptime probe wired in repo.

### "Can the team run a 1000-concurrent-agent sync smoke today?" — No.
1. `scenarios.js` peaks at **200 VU** and does not exercise mobile sync (`POST /api/mobile/sync/upload`, attachments). 10 endpoints all admin-portal reads.
2. No harness simulates mobile flow: login → download tasks → mark IN_PROGRESS → upload form payload → upload N attachments. SyncQueue + SQLite are device-side, untested.
3. DB is unseeded — no fixture for 100K cases / 1M attachments at which slow-paths (`projections/ProjectionUpdater.rebuildDashboard`, `caseStatusSyncService.recalculateCaseStatus`, `getDashboardStats`) actually hurt.

### Weeks-to-wire estimate

| Capability | Effort |
|---|---|
| Real k6 smoke (compose BE + seed) | 1w |
| Mobile-sync k6 scenario (upload, 1000 VU staging) | 2w |
| OTEL enabled in prod + collector + Grafana Tempo | 1.5w |
| Sentry FE + RN, real DSN, source-maps | 1w |
| Web Vitals (`web-vitals` lib + `sendBeacon` to `/api/rum`) + dashboard | 1.5w |
| RN crash-free-rate via Sentry + cold-start trace | 1w |
| Slow-query lane: enable `pg_stat_statements`, surface in admin | 0.5w |
| **Total minimal viable perf platform** | **~7-8 weeks** of one focused engineer |

## 12.2 User-Centric Experience score sheet

10-pt rubric across: Loading / Empty / Error / Form / A11y / Mobile-specific / Error-message clarity / Cognitive-load / Notification / Logout. Score 1-5 (5 = best). Only pages/screens actually read are scored.

### Frontend (admin/ops dashboard)

| Page | Load | Empty | Error | Form | A11y | Err-msg | Cog-load | Notif | Logout | Σ/45 |
|---|---|---|---|---|---|---|---|---|---|---|
| `LoginPage.tsx` (149L) | 4 | n/a | 4 | 4 | 3 | 5 | 5 | n/a | 4 | 29 |
| `CasesPage.tsx` (387L) | 4 | 3 | **2** | 3 | 2 | 2 | 4 | n/a | n/a | 20 |
| `AllTasksPage.tsx` (365L) | 4 | 3 | **4** (Retry button + helpful copy — best in class on FE) | 3 | 2 | 3 | 4 | n/a | n/a | 23 |
| `CaseDetailPage.tsx` (557L) | 4 | 4 | **1** — loading branch returns spinner; if useCase fails, `!caseItem` triggers "Case not found" — **conflates 404 with network error / 500** | 3 | 2 | 2 | 3 | n/a | n/a | 19 |
| `BillingPage.tsx` (364L) | 4 | 3 | 2 | 4 | 3 | 2 | 3 | n/a | n/a | 21 |
| `NotificationHistoryPage.tsx` (551L) | 4 | 4 | 2 | 3 | 3 | 3 | 4 | n/a | n/a | 23 |
| `DashboardPage.tsx` (422L) | 3 | 2 | 2 | n/a | 2 | 2 | 3 | n/a | n/a | 14 |
| `NewCasePage.tsx` (397L) | 3 | n/a | 2 | 3 | 3 | 3 | 2 | n/a | n/a | 16 |

**FE pattern findings:**
- **104 `isLoading` checks vs ~6 real `isError` branches across `src/pages`.** 2026-05-13 sweep landed `<TableSkeleton>` everywhere, but parallel error sweep never happened. React Query silently returns `undefined` on failure → pages render empty-state copy as if zero records. **Operators are blind to outages.**
- A11y is structurally weak. **39 `aria-label` across 371 files.** Icon-only `<Button>` (Refresh, Export, Edit, Delete, ⋮ menus) are unreadable to screen readers. Add `jsx-a11y/control-has-associated-label` lint rule.
- `ErrorBoundary.tsx:127` lies to user ("Our team has been notified") — see §12.1.
- Session-expired UX (`services/api.ts:386, 769`) calls `triggerLogout('Your session has expired…')` then redirects to `/login?reason=…` — LoginPage decodes and toasts. Good flow; only nit: form drafts on unloaded page lost without warning.

### Mobile (field-agent app)

| Screen | Load | Empty | Error | Form | A11y | Mobile-spec | Err-msg | Cog-load | Notif | Logout | Σ/50 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `LoginScreen.tsx` (442L) | 4 | n/a | **5** — `:62-127` `extractErrorMessage` maps 401/403/429/5xx/cert/EPROTO/handshake/ECONNABORTED to user copy. **Reference-grade.** | 4 | 4 | 4 | 5 | 5 | n/a | n/a | 31 |
| `DashboardScreen.tsx` (753L) | 3 | 3 | 2 | n/a | 2 | 4 | 3 | 3 | 4 | n/a | 24 |
| `TaskListScreen.tsx` (1029L) | 3 | 3 | **2** — `:436-439` `Alert.alert('Submit Failed', err instanceof Error ? err.message : String(err))` — raw stack traces leak to user. Same pattern at `:492-498` revoke | 3 | 3 | 4 | 2 | 3 | n/a | n/a | 23 |
| `VerificationFormScreen.tsx` (1114L) | 3 | n/a | 2 | 2 — `formValues: Record<string, any>` (`:75`), autosave failure silent | 2 | 3 | 2 | **1** — biggest file in repo by complexity; agent fills 40-80 conditional fields in one ScrollView | n/a | n/a | 15 |
| `SyncLogsScreen.tsx` (519L) | 4 | 3 | 3 | n/a | 3 | 5 (queue visibility — `pendingItems`, failed-count, Retry All) | 3 | 3 | n/a | n/a | 24 |
| `PrivacyConsentScreen.tsx` (110L) | 4 | n/a | **1** — `:42-45` swallows backend failure, only resets submitting state. **DPDP non-compliance:** user can't tell whether consent was recorded | 3 | 4 | n/a | 1 | 4 | n/a | n/a | 17 |
| `ProfilePhotoCaptureScreen.tsx` | 3 | n/a | 3 | 3 | 3 | 3 (no GPS-acquiring spinner before capture) | 3 | 4 | n/a | n/a | 22 |
| `DiagnosticsScreen.tsx` | 4 | 3 | 3 | n/a | 3 | **5** (best on mobile — surfaces `pendingItems`, sync-health, warn/good highlight) | 3 | 3 | n/a | n/a | 24 |

**Mobile pattern findings:**
- **Sync visibility is good** (DiagnosticsScreen, SyncLogsScreen, NetworkStatusBanner) but **buried in Settings**. Field agent on flaky bus needs persistent "12 pending" pill on Dashboard. Not present.
- **GPS-acquire UX is implicit.** `CameraCaptureScreen.tsx:100-116` requests permission but only warns "GPS unavailable" — no spinner showing "acquiring GPS (accuracy: 38m)". On rural sites this is longest single wait in workflow.
- **Camera workflow:** post-capture watermark + EXIF strip + SHA-256 + upload chain happens silently. Agent can't tell if photo is uploading vs queued vs failed without going to Diagnostics.
- **Form autosave failure silent.** Status pill in form footer ("Saved 12s ago" / "Save failed — will retry") is minimum bar.
- **Raw error strings** (`Alert.alert('Submit Failed', err.message)`) leak across TaskListScreen, SyncLogsScreen, VerificationFormScreen. Need `extractErrorMessage` helper analogous to LoginScreen's, applied across all `Alert.alert` error paths.
- **Logout / session-expired:** `MobileSocketService` pushes `session-revoked`; `AuthContext` consumes — UX side-effect is screen swap to login, no toast explaining why. Cold "kicked to login" is jarring.

### Cross-cutting QA findings

1. **Zero E2E tests.** No Detox / Maestro / Cypress / Playwright config anywhere. 2 FE unit-test files, 0 mobile, ~275 BE source files for 6 BE tests. **A regression in cases list pagination ships to production undetected.**
2. **Error taxonomy is BE-centric.** BE returns `{ error: { code, message } }`; FE/mobile only sometimes map codes to user copy. Centralize an `errorCatalog.ts` shared between FE + RN with `code → user-facing string`.
3. **Audit-driven cleanup is real and visible** (codebase carries `M22:`, `P14`, `B-147` inline tags). Use same discipline to land `Err:` tag on each error site and audit they are user-mapped.

## Top 5 QA & UX priorities

1. **Make the load-test gate real (1 week).** Fix `.github/workflows/load-test.yml:80-92` to actually boot backend with compose + seeded JWT, so `smoke.js` exercises auth + cases + tasks. Today the gate gives false green.
2. **Wire one observability platform end-to-end (2 weeks).** Pick Sentry (already coded-against on mobile, commented-against on FE). Set DSN, install `@sentry/react-native` + `@sentry/react`, delete the "Our team has been notified" copy or make it true. Source-maps in CI.
3. **Error-state parity with loading-state (1.5 weeks FE, 1 week mobile).** Every page using `<TableSkeleton>` needs sibling `<TableError onRetry>`. Every `Alert.alert(..., err.message)` on mobile routes through shared `formatUserError(err)` (model on `LoginScreen.tsx:62-127`). **104 isLoading vs ~6 isError** is single most painful UX gap.
4. **Mobile sync visibility on Dashboard (3-5 days).** Promote `pendingItems` + last-sync-age + failed-count from DiagnosticsScreen into persistent pill on DashboardScreen header. Agents working offline have to dig into Settings to know if anything is stuck. Wire to existing SyncEngine telemetry — no new infra.
5. **A11y lint + form ergonomics pass (2 weeks).** Add `jsx-a11y/control-has-associated-label` to ESLint (FE has 39 aria-labels for 371 files; mobile 56 accessibilityLabels for 161 files). Font-scale=200% smoke on 10 most-used mobile screens. Decompose `VerificationFormScreen.tsx` (1114L, score 15/50) into outcome → section flow so cognitive load drops below 40-80 fields-per-scroll.


---

# 13. Master priority list — across all 12 sections

Consolidated from PART 1 cross-codebase top-10 + 5-persona sections. Ordered by **impact × ease**. Severity uses the higher of the persona-rated values when multiple sections flagged the same item.

## Tier 0 — DO IMMEDIATELY (data-loss or regulator-visible exposure)

| # | Severity | Finding | Owner | Effort |
|---|---|---|---|---|
| **T0-1** | **CRITICAL** | `/api/storage/*` IDOR — any authenticated field agent can iterate case IDs and download every KYC document in the bucket (`routes/storage.ts:11` + `controllers/storageController.ts:31-72`) | BE | 2 days |
| **T0-2** | **CRITICAL** | `/uploads` static mount is unauthenticated (`app.ts:171`) — anything ever written there is world-readable to anyone who guesses the filename | BE | 1 day |
| **T0-3** | **CRITICAL** | Non-functional transactions via `query('BEGIN')` on pool → silent partial-write data corruption. **9 confirmed sites** between PART 1 (`usersController.ts:1916, 1973, 2144, 2202`) and §11 (`territoryAssignmentsController.ts:371, 690, 882, 981` + `pincodesController.ts:321`). Affects scope/territory access-control writes | BE | 3 days |
| **T0-4** | **CRITICAL** | Cache-warming pre-fills `cases:recent:*` + `clients:list` globally, no `client_id` predicate, no `deleted_at IS NULL` — defeats the entire scope-narrowing layer (`services/cacheWarmingService.ts:298-329`) | BE | 1 day |
| **T0-5** | **CRITICAL** | Geocoding circuit breaker DEFINED but NOT USED — Google outage exhausts DB pool (`utils/circuitBreaker.ts:159` exists; `geocodeController.ts:294` + `mobileLocationController.ts:575` bypass it) | BE | 2 days |
| **T0-6** | **CRITICAL** | BE `fetch()` with NO timeout at `geocodeController.ts:294` — single slow Google response holds request thread + DB client | BE | 1 hour |
| **T0-7** | **CRITICAL** | `casesController.ts` createCase / updateCase / exportCases (`:1114, :1412, :2218`) ship ZERO `createAuditLog` — DPDP §11 violation for case PII | BE | 1 day |
| **T0-8** | **CRITICAL** | `commissionManagementController.ts` 6 `billing.approve` mutations (`:97, :174, :269, :441, :565, :678`) ship ZERO audit logs — RBI audit-trail gap on money | BE | 1 day |
| **T0-9** | **CRITICAL** | Mobile SSL pinning is NOT enforced — `apiClient.ts:1-10` is aspirational; `react-native-ssl-pinning` not in deps; field agents susceptible to corporate WAF MITM | Mobile | 3 days |

## Tier 1 — DO THIS QUARTER (compliance / scale-blocker / silent-corruption)

| # | Severity | Finding | Owner |
|---|---|---|---|
| T1-1 | HIGH | `audit_logs` has no tamper-evidence (no hash chain, no HMAC, no append-only DB role) — fails IT Act §65B admissibility | BE |
| T1-2 | HIGH | No MFA on admin / `billing.approve` / `settings.manage` accounts (~10-20 users) — RBI cyber-security expectation | BE |
| T1-3 | HIGH | No DPDP breach-notification scaffolding (incidents table, bulk-egress detector, dispatch path) — DPDP §8(6) 72hr clock | BE |
| T1-4 | HIGH | Mobile sync schema validation non-strict (`sync/SyncDownloadService.ts:65`) — BE schema change silently corrupts thousands of agents' SQLite | Mobile + BE |
| T1-5 | HIGH | 10 BE routes have zero express-validator chains (geocode, storage, exports, forms, templateReports, verificationTasks, deduplication, user, reverse-geocode-dlq, verificationTypeOutcomes) | BE |
| T1-6 | HIGH | FE `executeWithRetry` retries non-idempotent POSTs 4× on 5xx; combined with BE deadlock-retry 6× = 24× write amplification (`services/api.ts:432-470`) | FE |
| T1-7 | HIGH | FE residual PII leak in telemetry payload (`hooks/useErrorHandling.ts:222, 240-247`) | FE |
| T1-8 | HIGH | Mobile `Attachment.localEncryptedPath` is a misnomer (plaintext on disk) — rooted device recovers KYC images from `/data/data/<pkg>/cache/` | Mobile |
| T1-9 | HIGH | BE coord PII in logs (`mobileLocationController.ts:577` raw lat/lng); `logRedact.ts` SENSITIVE_KEYS missing `name/phone/email/dob/address/lat/lng` and only used in 3 of 257 files | BE |
| T1-10 | HIGH | Cache-warming runs on every PM2 worker (cache stampede on cold boot) — blocks `instances: max` migration | BE |
| T1-11 | HIGH | Socket.IO `transports: ['websocket']` only (FE + mobile) — corporate proxies blocking WS leave app realtime-dark | FE + Mobile |
| T1-12 | HIGH | Graceful shutdown closes HTTP server fire-and-forget (`src/index.ts:188`); BullMQ workers killed mid-job on SIGTERM | BE |
| T1-13 | HIGH | Only ONE `<ErrorBoundary>` (root) — any render crash blanks entire shell | FE |
| T1-14 | HIGH | Geocode reverse-lookup has NO Redis cache — projected $9-12K/month at 10K agents | BE |
| T1-15 | HIGH | 14 FE god-components >500 LOC, 4 over 900 (TaskCaseCreationForm 1561) — re-render storm + unmaintainable | FE |
| T1-16 | HIGH | Mobile `LegacyFormTemplateBuilders.ts` 7373 LOC + `useState<Record<string, any>>` form values — biggest file, untyped values flow through 5 layers | Mobile |

## Tier 2 — DO IN H2 (architectural debt, foundation for scale)

| # | Severity | Finding | Owner |
|---|---|---|---|
| T2-1 | HIGH | Zero meaningful tests anywhere (BE 2.3%, FE 0.5%, Mobile 0%) — uninsurable for outage from bad deploy | All |
| T2-2 | HIGH | Zero feature flags, zero kill switches, zero gradual rollout — every behavior change = full deploy + revert playbook | BE + FE + Mobile |
| T2-3 | HIGH | No tenant boundary (`grep tenant_id` → 0 hits) — single-tenant by structure; 6-month surgery if white-label needed | BE |
| T2-4 | HIGH | No repository layer in BE (~95% of 57 controllers do raw SQL) — blocks DI, blocks RDS Proxy, blocks read replicas | BE |
| T2-5 | HIGH | Triple-duplicated client/product filter logic (FE + ActiveScopeContext + BE) — three sources of truth for scope | FE + BE |
| T2-6 | HIGH | `loadUserAuthContext` runs on every authenticated request (5s TTL only); 4 sub-selects with `array_agg(DISTINCT)` | BE |
| T2-7 | MED | 6 dead/duplicated FE deps (~200-300 KB recoverable): `react-window`, `html2canvas`, `react-chartjs-2`, `chart.js`, `react-loader-spinner`, `react-icons` 1-site | FE |
| T2-8 | MED | k6 CI gate is theatrical — never boots the backend | DevOps |
| T2-9 | MED | OTEL off in prod by default; Sentry commented out FE; Datadog optional require mobile — observability ships but is dark | All |
| T2-10 | MED | 104 `isLoading` checks vs ~6 `isError` branches on FE — operators blind to outages | FE |
| T2-11 | MED | Mobile sync visibility (pending items / last sync) buried in Settings instead of Dashboard | Mobile |
| T2-12 | MED | Vendor coupling: no `GeocodeProvider` / `PushProvider` interfaces; swap cost 2-4 weeks per | BE + Mobile |
| T2-13 | MED | Missing functional indexes on `LOWER(name)` lookups in 10+ sites — seq scan on every state/city import | DB |
| T2-14 | MED | 9 BE god-files >2000 LOC (mobileFormController 6352, comprehensiveFormFieldMapping 4917) | BE |
| T2-15 | MED | OFFSET pagination in 45 BE sites + zero `useInfiniteQuery` on FE — deep pages combine 3 anti-patterns | BE + FE |
| T2-16 | MED | Error response shape inconsistency (266 `INTERNAL_ERROR` + flat `{success:false, message}` mixed with `{error:{code,message}}`) — breaks P8 reactive scope recovery for KYC | BE |
| T2-17 | MED | Three independent 60s polls overlap WS-driven invalidation (Header + NotificationHistory + CaseNotificationsTab) | FE |

## Tier 3 — DO ANYTIME (polish, ergonomics, cost saves)

Numerous Medium / Low items per section; not enumerated here. See per-section "Top 5" lists.

---

# 14. Recommended sequencing for 6 weeks

| Week | Focus | Items |
|---|---|---|
| 1 | **Stop the bleeding** | T0-1, T0-2, T0-5, T0-6 (storage exposure + circuit breaker + timeout). All surgical edits. |
| 2 | **Money + scope audit gap** | T0-3 (BEGIN sweep), T0-4 (cache-warming globals), T0-7, T0-8 (audit-log). |
| 3 | **Mobile critical** | T0-9 (SSL pinning), T1-4 (strict sync), T1-8 (encrypt cached attachments) |
| 4 | **Compliance baseline** | T1-1 (audit-log hash chain), T1-2 (MFA), T1-3 (breach scaffolding), T1-9 (PII redaction) |
| 5 | **Reliability foundation** | T1-6 (FE retry), T1-10 (cache-warming leader election), T1-11 (WS polling fallback), T1-12 (graceful shutdown), T1-13 (route ErrorBoundaries) |
| 6 | **Test foundation kickoff** | T2-1 — vitest + msw scaffolding on money controllers + FE money services. Minimum 30% on money paths. Set CI gate that blocks merge if coverage drops. |

**After week 6, evaluate weekly:** Tier 2 items in order of T2-1 (test) → T2-2 (flags) → T2-4 (repo layer) — they compound (tests need the flag + repo to be safe, flags need observability to be useful).

---

# 15. Scope NOT covered

Per scope directive (code + architecture only):
- Infra (UFW, fail2ban, VPC, security groups)
- Cloud (AWS RDS migration, S3 cutover, ElastiCache, AWS Secrets Manager)
- DevOps server-side (GH Actions plumbing beyond the noted load-test gate stub, deploy scripts, PM2, nginx)
- Build tooling (vite config beyond bundle hygiene, gradle, fastlane, Android signing)
- Server runtime state (NODE_ENV on prod box, Postgres TZ setting)
- Cost analysis for AWS line-items (only application-induced cost is in scope)

Open items in those areas are tracked in:
- `memory/project_day1_audit_fixes_2026_05_16.md`
- `memory/project_l_crit_3_deferred_rds_migration.md`
- `memory/project_deploy_hardening_2026_05_16.md`

---

**End of audit.** PART 1 = 3-agent code audit, PART 2 = 5-persona re-audit. Total: 8 Principal-grade agent sessions, ~700 LOC of audit content + master priority list. Generated 2026-05-17 by Agent B.
