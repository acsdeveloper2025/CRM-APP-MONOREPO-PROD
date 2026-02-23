# Complete Codebase Audit (Routes, Hooks, Controllers, Pages, Layout, Security)

## What was checked

This pass was done as a **complete structural + security audit** over:
1. All backend API route files and their app mounts
2. All backend controllers and route/controller linkage
3. All frontend pages and route coverage
4. All frontend hooks and service usage coverage
5. Auth/security flows and status-code correctness
6. Layout/design shell wiring
7. Dependency/version + lint/type-check health
8. Vulnerability assessment and security testing (SAST-style pattern scans + dependency audit attempts)

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

9. **Access + refresh tokens are handled in response/local storage model**
   - Backend returns tokens in response payload and frontend stores refresh token/user info in `localStorage`.
   - Impact: XSS blast radius is higher than strict httpOnly-cookie-only session models.

## C. Frontend pages / routes / hooks / services

10. **Pages present but not routed in `AppRoutes`**
   - `PendingCasesPage`
   - `InProgressCasesPage`
   - `NotificationHistoryPage`
   - `FormSubmissionsPage`
   - `FormsTestPage`
   - Impact: unreachable UI paths or stale feature files.

11. **Hooks with no textual usage references (likely dead code)**
   - `useFilteredFieldUsers`
   - `useTaskMutations`
   - Impact: code drift and maintenance overhead.

12. **Service modules likely unimported (duplication/dead abstraction)**
   - `base`
   - `casesService`
   - `commissionManagementApi`
   - `rateTypeApi`
   - `userApi`
   - `usersService`
   - Impact: parallel API layers and confusion about canonical service modules.

13. **Debug logging in route guard**
   - `ProtectedRoute` logs route/auth state with `console.warn` on route checks.
   - Impact: noisy production console and potential state leakage.

14. **API layer contains production-visible debug logs**
   - API initialization and token refresh paths use `console.warn` / `console.error` frequently.
   - Impact: console noise and operational leakage; should be env-gated/logger-controlled.

## D. Layout / design-shell observations

15. **Desktop layout shell is consistent, but routing split creates separate mobile app shell path**
   - `/mobile` uses `MobileApp`, while desktop pages use `Layout` wrapper.
   - Not a bug by itself, but requires parity checks for permissions/navigation consistency.

16. **Global container strategy is centralized in layout and appears stable**
   - `Layout` uses single content container and responsive paddings.
   - No blocking layout errors found in shell component, but page-level visual consistency still needs screenshot QA.

## E. Vulnerability assessment findings

17. **Hardcoded-like API key values present in deployment script templates**
   - Deployment script contains values resembling real Google Maps keys.
   - Impact: credential leakage / accidental key reuse risk if copied to production without rotation.

18. **Dynamic SQL template usage hotspots detected**
   - Multiple backend files build SQL with template literals that include `${...}` interpolation.
   - Impact: potential SQL injection risk if any interpolated value is not from strict allowlists/validated constants.
   - Note: this is a hotspot list requiring targeted code-level review, not proof of exploit for each instance.

19. **No obvious direct use of high-risk JS eval sinks in app code**
   - Pattern scan did not find `eval(`, `new Function(`, frontend `dangerouslySetInnerHTML`, or backend shell exec usage in app logic.
   - Impact: positive finding, reduces common code-injection vectors.

20. **Rate-limit profile is intentionally generous**
   - Default limit profile favors high-volume operations.
   - Impact: operationally useful, but increases brute-force/abuse tolerance if not endpoint-tiered.

---

## 3) Vulnerability severity matrix (initial)

### Critical
- None proven by static scan in this pass.

### High
- Public rate-limit reset endpoint without auth (#3).
- Public AI test endpoint in app surface (#4).
- Query-string token fallback support (#7).

### Medium
- 401/403 authorization semantic mismatch (#5/#6).
- Hardcoded-like key material in deployment script templates (#17).
- Dynamic SQL interpolation hotspots requiring verification (#18).
- Token handling model with localStorage exposure tradeoff (#9).

### Low
- Debug logging exposure (#13/#14).
- Unrouted/unreferenced files (maintainability and drift risk) (#1/#2/#10/#11/#12).

---

## 4) Security testing performed

### Dependency vulnerability scanning
- Attempted:
  - `npm audit --omit=dev --json`
  - `npm audit --prefix CRM-BACKEND --omit=dev --json`
  - `npm audit --prefix CRM-FRONTEND --omit=dev --json`
- Result: all blocked by npm advisory API `403 Forbidden` in this environment.

### Static security pattern scans
- Executed pattern scans for risky sinks/patterns:
  - Frontend: `dangerouslySetInnerHTML`, `innerHTML =`, `eval(`, `new Function(`
  - Backend: `eval(`, `new Function(`, `child_process`, `exec(`, `spawn(`, `vm.`
- Result: no direct app-level hits for these dangerous sinks.
- Additional scans:
  - key/secret-like string detection in repo text
  - dynamic SQL template interpolation hotspots (`query(\`...${...}\`)`) for manual review queue

### Config/security posture checks
- Verified presence of `helmet`, CORS config, global API rate limiter, and auth middleware usage pattern.
- Verified presence of unauthenticated endpoint exceptions requiring remediation.

---

## 5) Highest-priority fixes (recommended order)

1. Protect or remove `POST /auth/reset-rate-limit` (must require admin auth).
2. Remove or protect `/api/ai-test` in non-dev environments.
3. Return **403** for authenticated-but-forbidden cases in `requireRole`/`requirePermission`.
4. Replace query-token auth fallback with signed short-lived URL strategy (or strict scope).
5. Remove hardcoded-like key material from scripts and rotate any exposed keys.
6. Audit each dynamic SQL interpolation hotspot and convert to parameterized/allowlisted patterns.
7. Remove dead/unmounted route and unreferenced controllers/pages/hooks/services.
8. Gate debug logs by environment or centralized logger.
9. Resolve backend lint debt, then enforce CI lint gate.
10. Add CI security stage: audit/SCA + secret scan + SAST pattern rules.

---

## 6) Validation commands executed

- `npm run -s --prefix CRM-FRONTEND type-check` ✅ pass
- `npm run -s --prefix CRM-BACKEND type-check` ✅ pass
- `npm run -s --prefix CRM-FRONTEND lint` ✅ pass
- `npm run -s --prefix CRM-BACKEND lint` ❌ fail (existing lint/prettier + unused-var issues)
- `npm audit --omit=dev --json` ⚠️ blocked by npm advisory endpoint 403 in this environment
- `npm audit --prefix CRM-BACKEND --omit=dev --json` ⚠️ blocked by npm advisory endpoint 403 in this environment
- `npm audit --prefix CRM-FRONTEND --omit=dev --json` ⚠️ blocked by npm advisory endpoint 403 in this environment
- `rg -n "dangerouslySetInnerHTML|innerHTML\s*=|eval\(|new Function\(" CRM-FRONTEND/src` ✅ no hits
- `rg -n "eval\(|new Function\(|child_process|exec\(|spawn\(|shelljs|vm\." CRM-BACKEND/src` ✅ no high-risk app hits (only Redis `multi.exec()` false-positive pattern)
- `rg -n "(JWT_SECRET|API_KEY|SECRET_KEY|PRIVATE_KEY|BEGIN RSA|BEGIN OPENSSH|password\s*=\s*['\"][^'\"]+['\"])" --glob '!**/node_modules/**'` ✅ findings captured in vulnerability section

---

## 7) Note on completeness

This is a **complete structural + security-focused audit** across routes/controllers/hooks/pages/services/layout/auth/security.
For a full exploit-validated penetration test, the next phase should include running-stack DAST, authenticated API fuzzing, and endpoint-level abuse testing in a staging environment.
