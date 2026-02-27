# Frontend Cache & Request Audit (`crm-frontend`)

## Scope
- Audited: `CRM-FRONTEND/src`
- Focus: request duplication, cache behavior (React Query + API service), page-level waterfalls, and UX latency causes.

## 1. Frontend Cache Architecture (Current)

## 1.1 React Query defaults
- `CRM-FRONTEND/src/App.tsx`
  - Global defaults:
    - `retry: 1`
    - `refetchOnWindowFocus: false`
  - No global `staleTime`/`gcTime` baseline.

## 1.2 API service in-memory cache (secondary layer)
- `CRM-FRONTEND/src/services/api.ts`
  - Has internal `Map` cache + ETag header handling.
  - Cache used only when caller passes `useCache: true` to `getRaw/get`.
  - Most services/pages do not pass `useCache: true`, so this cache is mostly inactive.

## 1.3 Effective result
- Primary cache in practice: React Query.
- Secondary API-cache exists but is underutilized and adds complexity.

## 2. Duplicate Calls / Over-fetching Findings

### 2.1 Users page over-fetches inactive tabs
- File: `CRM-FRONTEND/src/pages/UsersPage.tsx`
- Behavior:
  - Loads users list, activities, and sessions together.
  - `useUserActivities` and `useUserSessions` hooks do not have `enabled` gating.
- Impact:
  - 2 unnecessary APIs on initial `/users` load.

### 2.2 Locations page triggers 5 list APIs on mount
- File: `CRM-FRONTEND/src/pages/LocationsPage.tsx`
- Behavior:
  - Always fetches countries, states, cities, pincodes, areas concurrently, regardless of active tab.
- Impact:
  - Heavy network/CPU on initial render; tab switch appears slower due shared pressure.

### 2.3 Analytics overview always calls verification task list
- File: `CRM-FRONTEND/src/pages/AnalyticsPage.tsx`
- Behavior:
  - Calls `/verification-tasks?limit=100...` unconditionally.
- Impact:
  - Expensive list endpoint fetched even when user is on non-overview tab.

### 2.4 Task detail uses manual effect-based fetching (no React Query reuse)
- File: `CRM-FRONTEND/src/pages/TaskDetailPage.tsx`
- Behavior:
  - Two separate effect-driven calls (`task detail`, `assignment history`) with local state.
- Impact:
  - No query dedupe/caching/retry policy reuse; harder to optimize.

## 3. Waterfall & Coordination Issues

### 3.1 MIS dashboard has mixed query styles and manual orchestration
- File: `CRM-FRONTEND/src/components/reports/MISDashboard.tsx`
- Behavior:
  - Loads 4 dropdown datasets (`clients/products/verificationTypes/users`) with React Query.
  - Separately uses manual `loadData()` effect for MIS table/summary API.
- Impact:
  - Coordination overhead; hard to dedupe and prefetch efficiently.

### 3.2 Billing/Reports cards derive totals from current page slices
- Files:
  - `CRM-FRONTEND/src/pages/BillingPage.tsx`
  - `CRM-FRONTEND/src/pages/ReportsPage.tsx`
- Behavior:
  - Summary numbers are computed from currently loaded list page arrays.
- Impact:
  - Cards may not represent true totals; UX feels inconsistent and “slow/incorrect”.

## 4. React Query Configuration Gaps

## 4.1 Inconsistent per-query freshness policies
- Some hooks have explicit `staleTime`, many rely on default (stale immediately).
- Example of aggressive refetch:
  - `CRM-FRONTEND/src/components/users/DepartmentsTable.tsx` has `staleTime: 0` and `refetchOnWindowFocus: true`.

## 4.2 Query keys with large object identity churn
- Multiple hooks/pages use object literals directly in query keys.
- If objects are recreated frequently, cache misses and unnecessary refetch can happen.

## 5. Endpoint Contract Mismatch Findings

Several frontend report services reference endpoints not visible in current backend route wiring:
- `bank-bills`, `mis-reports`, and several report routes in `CRM-FRONTEND/src/services/reports.ts`.
- Backend routes (`CRM-BACKEND/src/routes/reports.ts`) do not expose those paths.

Impact:
- Failed requests + retries + fallback-to-zero UI patterns can appear as “cache/data slowness”, but root cause is endpoint mismatch.

## 6. Mobile Web View Audit

### 6.1 Mobile shell and report viewer rely heavily on mock/local data
- Files:
  - `CRM-FRONTEND/src/components/mobile/AgentDashboard.tsx`
  - `CRM-FRONTEND/src/components/mobile/MobileReportViewer.tsx`
- Behavior:
  - Periodic refresh in `AgentDashboard` every 30s but using generated mock stats.
  - `MobileReportViewer` loads mock/fallback data path when no offline item.

Impact:
- Perceived responsiveness may be disconnected from backend cache improvements.

## 7. Frontend Audit Summary

Top reasons UI still feels slow despite backend caching:
1. Over-fetching on mount (Users/Locations/Analytics).
2. Mixed fetch orchestration (manual effects + query hooks).
3. Inconsistent freshness policies.
4. Endpoint mismatches causing fallback and retry churn.
5. Secondary API cache exists but is mostly unused (`useCache` rarely enabled).
