# Complete Codebase Audit (Routes, Hooks, Controllers, Pages, Layout)

## What was checked

This pass was done as a **complete structural audit** over:
1. All backend API route files and their app mounts
2. All backend controllers and route/controller linkage
3. All frontend pages and route coverage
4. All frontend hooks and service usage coverage
5. Auth/security flows and status-code correctness
6. Layout/design shell wiring
7. Dependency/version + lint/type-check health

---

## 1) Inventory (full codebase context)

- **Frontend pages:** 39
- **Frontend hooks:** 30
- **Frontend services:** 38
- **Backend controllers:** 48
- **Backend routes:** 42
- **Backend middleware:** 16

---

## 2) Issues & errors list (one by one)

## A. Backend API Routes / Controller wiring

1. **Route file exists but is not mounted in app** (dead/unreachable API surface)
   - `src/routes/configPendingCases.ts` exists, but `app.ts` does not import/mount it.
   - Impact: endpoint(s) in that route file are unreachable and drift from expected API inventory.

2. **Controllers present but not referenced by any route**
   - `clientVerificationTypesController.ts`
   - `searchController.ts`
   - Impact: dead code risk, maintenance overhead, unclear ownership of feature status.

3. **Public rate-limit reset endpoint lacks auth protection**
   - `POST /api/auth/reset-rate-limit` is exposed without `authenticateToken`.
   - Impact: unauthenticated caller can reset limiter buckets (abuse risk).

4. **Temporary AI test endpoint exposed publicly in production app file**
   - `GET /api/ai-test` is mounted directly and not protected by auth.
   - Impact: unnecessary public surface, potential abuse/cost trigger.

## B. Auth / Security behavior issues

5. **Forbidden responses return 401 instead of 403 in role middleware**
   - In `requireRole`, insufficient permission returns status `401` while error code is `FORBIDDEN`.
   - Impact: semantic mismatch, weak API contract clarity.

6. **Forbidden responses return 401 instead of 403 in permission middleware**
   - In `requirePermission`, denial also returns `401` with `FORBIDDEN` code.
   - Impact: same contract inconsistency, impacts frontend and monitoring logic.

7. **JWT accepted via query-string fallback**
   - `authenticateTokenFlexible` reads `req.query.token` when header is missing.
   - Impact: token leakage risk (logs/history/referer), should be narrowly scoped.

8. **Insecure fallback session secret in config**
   - Default: `production-session-secret-change-me`.
   - Impact: if session path is used unexpectedly, security posture is weakened.

## C. Frontend pages / routes / hooks / services

9. **Pages present but not routed in `AppRoutes`**
   - `PendingCasesPage`
   - `InProgressCasesPage`
   - `NotificationHistoryPage`
   - `FormSubmissionsPage`
   - `FormsTestPage`
   - Impact: unreachable UI paths or stale feature files.

10. **Hooks with no textual usage references (likely dead code)**
   - `useFilteredFieldUsers`
   - `useTaskMutations`
   - Impact: code drift and maintenance overhead.

11. **Service modules likely unimported (duplication/dead abstraction)**
   - `base`
   - `casesService`
   - `commissionManagementApi`
   - `rateTypeApi`
   - `userApi`
   - `usersService`
   - Impact: parallel API layers and confusion about canonical service modules.

12. **Debug logging in route guard**
   - `ProtectedRoute` logs route/auth state with `console.warn` on route checks.
   - Impact: noisy production console and potential state leakage.

13. **API layer contains production-visible debug logs**
   - API initialization and token refresh paths use `console.warn` / `console.error` frequently.
   - Impact: console noise and operational leakage; should be env-gated/logger-controlled.

## D. Layout / design-shell observations

14. **Desktop layout shell is consistent, but routing split creates separate mobile app shell path**
   - `/mobile` uses `MobileApp`, while desktop pages use `Layout` wrapper.
   - Not a bug by itself, but requires parity checks for permissions/navigation consistency.

15. **Global container strategy is centralized in layout and appears stable**
   - `Layout` uses single content container and responsive paddings.
   - No blocking layout errors found in shell component, but page-level visual consistency still needs screenshot QA.

---

## 3) Highest-priority fixes (recommended order)

1. Protect or remove `POST /auth/reset-rate-limit` (must require admin auth).
2. Remove or protect `/api/ai-test` in non-dev environments.
3. Return **403** for authenticated-but-forbidden cases in `requireRole`/`requirePermission`.
4. Replace query-token auth fallback with signed short-lived URL strategy (or strict scope).
5. Remove dead/unmounted route and unreferenced controllers/pages/hooks/services.
6. Gate debug logs by environment or centralized logger.
7. Resolve backend lint debt, then enforce CI lint gate.

---

## 4) Validation commands executed

- `npm run -s --prefix CRM-FRONTEND type-check` ✅ pass
- `npm run -s --prefix CRM-BACKEND type-check` ✅ pass
- `npm run -s --prefix CRM-FRONTEND lint` ✅ pass
- `npm run -s --prefix CRM-BACKEND lint` ❌ fail (existing lint/prettier + unused-var issues)
- `npm audit --prefix CRM-FRONTEND --omit=dev --json` ⚠️ blocked by npm advisory endpoint 403 in this environment

---

## 5) Note on completeness

This is a **complete structural and linkage audit** across routes/controllers/hooks/pages/services/layout/auth/security.
For a full business-logic correctness audit of every controller method and every page behavior, the next phase should be domain-by-domain functional testing with seeded data and API contract tests.
