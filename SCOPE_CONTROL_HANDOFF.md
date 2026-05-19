# Scope Control — Session Handoff (2026-05-14)

Paste this prompt to start a fresh session continuing the scope control work.

---

## Context for next session

Read these memory files first (in order):
1. `MEMORY.md` (index)
2. `project_scope_control_audit_2026_05_14.md` (current work — phase ledger, leak closures, don't-regress)
3. `feedback_use_karpathy_guidelines.md`, `feedback_ask_before_acting.md`, `feedback_cave_mode.md`, `feedback_sql_live_db_apply.md`

## Where we are

**Active Scope (Client/Product) feature: P0–P13.A complete locally. 24 local commits ahead of `origin/main`. NOTHING PUSHED — per user directive, work stays local until everything is done.**

Commit range: `09fb12b4`..`38cf6b75`.

| Phase | What | Commit |
|---|---|---|
| P0 / P0.5 | Query-param 403 guards (7 routes) | `09fb12b4`, `c756f88e` |
| P1 | `validateActiveScope` + `applyActiveScope` + `markCrossTenant` middleware (never mutates `req.user`) | `2cff1908` |
| P2 | `resolveDataScope` narrows by `activeScope` | `494de081` |
| P3 | FE `ActiveScopeContext` + sessionStorage + axios `X-Active-Client/Product-Id` headers | `237a05a0` |
| P4 | FE `ScopeSelector` UI + clients/products `markCrossTenant` | `08a48d92` |
| P5 | `queryClient.clear()` on scope change | `3ea628cc` |
| P6 | `queryClient.clear()` on permission refresh (was invalidate-5) | `7ef665d9` |
| P7 | Demo Mode MVP (lock + banner) | `2642addc` |
| P8 | 403 `INVALID_ACTIVE_SCOPE_*` reactive recovery | `841a6eee` |
| P9 | Exports use `effectiveClientIds` (case-analytics) | `9e934625` |
| P10 | `SCOPE_VIOLATION_REJECTED` audit log | `5b4cf0ee` |
| P11.A.1 | `getCases` narrowing | `7a281a1b` |
| P11.A.2 | `exportCases` narrowing | `384f338e` |
| P11.A.3 | verificationTasks list + Excel narrowing | `02440483` |
| P11.A.4 | per-case access check on `/cases/:id/tasks` | `231b56d6` |
| P11.A.5 | 6 clientsController sub-resource gates | `260e1de4` |
| P11.A.6 | verificationAttachmentController per-case gate | `69ff7427` |
| P11.B | `/config-validation` route guard | `df93a48a` |
| P11.C | `enterpriseCache` key includes activeScope | `bdc24751` |
| **P11.D** | **CORS `allowedHeaders` ← `X-Active-Client/Product-Id` (preflight unblocker)** | **`d12e9077`** |
| **P12** | **Demo Mode password re-auth — `POST /auth/verify-password` + `PasswordConfirmDialog`** | **`b9b2a4ea`** |
| **P13.A** | **`dashboardKPIController` narrows by `req.activeScope`** | **`38cf6b75`** |

## What's pending (user's open ask)

### 1. P13.B/C/D — close 4 remaining `getAssignedClientIds` direct sites

Post-P13.A grep surfaced 4 controllers that still call `getAssignedClientIds(userId)` directly without intersecting `req.activeScope`. Apply the same pattern as P13.A:

```ts
if (req.activeScope?.clientId != null && clientIds) {
  clientIds = clientIds.includes(req.activeScope.clientId)
    ? [req.activeScope.clientId]
    : [-1];
}
if (req.activeScope?.productId != null && productIds) {
  productIds = productIds.includes(req.activeScope.productId)
    ? [req.activeScope.productId]
    : [-1];
}
```

Sites:
- `CRM-BACKEND/src/controllers/verificationAttachmentController.ts:267` (separate handler from P11.A.6's fix at :211)
- `CRM-BACKEND/src/controllers/attachmentsController.ts:138`
- `CRM-BACKEND/src/controllers/casesController.ts:945, 948` (handler between getCases and getCaseById)
- `CRM-BACKEND/src/controllers/casesController.ts:1829, 1832` (per-case check in `getCaseSummaryWithTasks`)

Verify each via `grep -n "getAssignedClientIds" CRM-BACKEND/src/controllers/*.ts` before touching.

### 2. Page-by-page narrowing audit (started, not finished)

User feedback: "do page by page navigaion check each page each card maksure all filter properly currently dashboard card showing both even after filter also data entry page".

Dashboard ✓ verified (PENDING TASKS card 2→1 when scoped to HDFC via P13.A).
Remaining pages to check via Claude Preview console:
- `/case-management/all-cases` (started, navigation eval failed last time — try `preview_eval` with `window.location.href = '…'`)
- `/case-management/in-progress`, `/case-management/completed`, `/case-management/pending`
- All Task Management pages (6 of them — `/task-management/*`)
- **Data Entry MIS** (user specifically called this out as NOT filtering)
- Reports & MIS pages
- Billing, Commissions, Invoices pages
- KYC pages
- Notifications page

For each: lock scope to one client → walk every card + list + filter → verify counts narrow correctly + no cross-client rows leak. If a card stays cross-client when it shouldn't, trace it to the controller and add a P13.x phase.

### 3. Push — ONLY after P13.B/C/D + page audit fully complete

24 commits are local. User directive: don't push until everything's done.

## Don't-regress (load-bearing rules)

**BE invariants:**
- `req.user.assignedClientIds` / `assignedProductIds` are **frozen** by `Object.freeze` in [auth.ts:248-257](CRM-BACKEND/src/middleware/auth.ts). Never mutate — use `req.activeScope` / `req.effectiveClientIds` / `req.effectiveProductIds` / `req.routeMeta`.
- `X-Active-Client-Id` / `X-Active-Product-Id` headers are **HINTS**. `validateActiveScope` rejects values outside `assignedClientIds` with 403 `INVALID_ACTIVE_SCOPE_CLIENT/PRODUCT`. Any new code path that reads these headers must re-validate.
- `markCrossTenant` is the ONLY mechanism to opt a route out of narrowing. Currently on: `routes/clients.ts GET /`, `routes/products.ts GET /` (metadata).
- Direct `getAssignedClientIds(userId)` calls remain as the baseline filter. P11.A.x + P13.A add active-scope intersection ON TOP. Don't refactor to a single helper without preserving both layers.
- 5 new 403 error codes: `INVALID_ACTIVE_SCOPE_CLIENT`, `INVALID_ACTIVE_SCOPE_PRODUCT`, `CASE_NOT_IN_ACTIVE_SCOPE`, `CLIENT_NOT_IN_ACTIVE_SCOPE`, `PRODUCT_NOT_IN_ACTIVE_SCOPE`. SCOPE_VIOLATION_REJECTED audit fires for the first two.
- `enterpriseCache` active-scope suffix `:as:c<N>:p<M>` MUST stay at END of key (wildcard invalidation depends on it).
- **CORS `allowedHeaders` in `app.ts` MUST include `X-Active-Client-Id` + `X-Active-Product-Id`** — without them browser preflight fails silently with `net::ERR_FAILED`.

**FE invariants:**
- `sessionStorage['acs.activeScope']` ONLY — never `localStorage`. JSON `{selectedClientId, selectedProductId, isDemoMode}`.
- `queryClient.clear()` is MANDATORY (NOT predicate-based invalidate) on: logout, scope change, permission refresh, WS `permission_changed`, 403 INVALID_ACTIVE_SCOPE_*.
- Provider stack order (App.tsx): `ErrorBoundary → ThemeProvider → QueryClientProvider → AuthProvider → ActiveScopeProvider → PermissionProvider → LayoutProvider → Router`. Don't reorder.
- `ScopeSelector` hides when `assignedClientIds.length <= 1`.
- Demo Mode is FE-only state. BE has no `isDemoMode` field.

**Demo Mode password flow (P12):**
- `POST /api/auth/verify-password` is the SINGLE accountability gate. Lock AND unlock both go through it.
- **Option A locked in**: re-auths the CURRENT logged-in user's password — NOT admin handover (explicitly rejected — would let any field user bypass with shared creds).
- Body: `{password, intent: 'lock' | 'unlock'}`. `intent` is REQUIRED so audit event code is correct (`SCOPE_DEMO_LOCK` / `SCOPE_DEMO_UNLOCK` / `SCOPE_DEMO_VERIFY_FAILED`).
- `authRateLimit` applies (brute force bounded).
- FE: `PasswordConfirmDialog` is the ONLY caller of `/auth/verify-password`. Used by both `ScopeSelector` lock button + `DemoModeBanner` unlock button.

## Test user

`pradnya.mohite` / `Pradnya@2026` — has 2 clients + product assignments + assigned cases. Use this account to verify narrowing in browser.

## Verification recipe

1. Start BE: in `CRM-BACKEND/`, `npm run dev` (ts-node-dev/nodemon).
2. Start FE: in `CRM-FRONTEND/`, `npm run dev`.
3. Use `mcp__Claude_Preview__preview_start` against FE URL.
4. Login as `pradnya.mohite`.
5. Set scope via UI ScopeSelector OR directly:
   ```js
   preview_eval: sessionStorage.setItem('acs.activeScope', JSON.stringify({selectedClientId: 22, selectedProductId: null, isDemoMode: false})); location.reload();
   ```
6. Walk each page; for each card/list use `preview_network` to inspect the response and confirm `clientIds`/`productIds` in the request body or the row counts narrow correctly.

## Behavioral rules

- **Ask before each fix + each commit.** Don't chain. See `feedback_ask_before_acting.md`.
- **Cave mode** — terse output, no recaps, no status tables in chat (the memory file is the record).
- **Karpathy guidelines** — surgical changes, simplicity first, every changed line traces to the request.
- **Update memory after each fix** — `feedback_update_memory_each_fix.md` (append phase row + commit hash to `project_scope_control_audit_2026_05_14.md`).
- **No push until user says push.**

---

## Suggested opening for next session

```
Resume scope control work. Read MEMORY.md + project_scope_control_audit_2026_05_14.md + SCOPE_CONTROL_HANDOFF.md. Confirm phase ledger, then start P13.B by closing the 4 remaining direct getAssignedClientIds sites. Ask before each fix and each commit.
```
