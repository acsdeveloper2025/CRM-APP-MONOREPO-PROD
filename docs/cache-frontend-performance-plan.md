# Frontend Cache & Performance Implementation Plan

## Goals
- Dashboard first meaningful data < 1s (warm path).
- Case list perceived instant on return navigation.
- Task pages feel real-time without over-fetching.
- No RBAC/scope leakage from client cache.

## 1. Query Architecture Standardization

1. Standardize on React Query for page/server state
- Replace manual effect-based loaders on key pages with `useQuery`/`useInfiniteQuery`.
- Keep local state only for transient UI concerns.

2. Set global sane defaults
- In QueryClient defaults:
  - moderate `staleTime` by domain
  - long enough `gcTime` for back navigation reuse
  - `refetchOnWindowFocus` disabled globally, opt-in on live widgets

3. Remove dual-cache ambiguity
- Either deprecate `apiService` in-memory cache for page flows or integrate it only in service layers with explicit policy.

## 2. Page-by-Page Plan

## 2.1 Dashboard
- Merge multi-widget fetches into one KPI bundle query where possible.
- Prefetch dashboard query right after login/route intent.
- Use short `staleTime` + targeted invalidation on mutation success.

## 2.2 Users
- Load tab-specific queries only when tab is active:
  - activities/sessions disabled unless tab selected.
- Keep users list/stats query keys stable and scoped.

## 2.3 Cases
- Ensure list key includes filters/pagination only (stable serialization).
- Prefetch next page and likely detail query on row hover/focus.
- Invalidate narrowly on mutation success.

## 2.4 Tasks + Task Detail
- Convert task detail + assignment history to React Query.
- Use optimistic updates for workflow buttons with rollback.
- Gate periodic refetch only for active in-progress tasks.

## 2.5 Reports / Billing / Analytics
- Replace card totals derived from paged rows with dedicated summary queries.
- Parallelize independent summary and table queries via query dependencies.
- Use longer stale windows for heavy aggregates with manual refresh control.

## 2.6 Locations/Master Data
- Fetch only active-tab dataset; lazy-load other tabs.
- Cache master lists with long stale windows.

## 2.7 Mobile Web Views
- Replace mock intervals with real API-backed queries where applicable.
- Use short stale windows and on-demand refresh for operational screens.

## 3. Request Deduplication & Waterfall Removal

1. Deduplicate identical in-flight requests by stable query keys.
2. Collapse dependent waterfalls:
- fetch list + stats in one backend response where feasible.
3. Avoid repeated mount fetches by using `enabled` and memoized params.

## 4. Cache Invalidation Strategy (Frontend)

1. On successful mutations:
- invalidate exact domain keys (cases/tasks/users/dashboard) rather than broad clears.

2. On permission updates:
- trigger `/auth/me` refresh, update permission context, invalidate protected queries.

3. On assignment/scope changes:
- clear actor-scoped query caches and reload current page data.

## 5. UI Latency Improvements

1. Skeleton-first rendering per section (cards/table independently).
2. Route-level prefetch for next likely pages.
3. Use `keepPreviousData` for paginated tables.
4. Reduce render churn from object-literal query params.

## 6. Safety Rules

1. Never use client cache as authorization source.
2. Always allow backend 403/404 to drive final access result.
3. Include actor scope in query keys when payload is scope-dependent.

## 7. Measurement Plan

Track before/after for:
- TTFD (time to first data) per major page
- API requests count per page load
- duplicated request ratio
- query cache hit ratio
- p95 interaction latency for list filters and task actions

## 8. Rollout Sequence

1. Foundation
- Query defaults + key factories + metrics hooks.

2. High-impact pages
- Dashboard, Cases, Tasks, Users.

3. Heavy analytics
- Reports, Billing, Analytics, MIS.

4. Master data + mobile web
- Locations and mobile views.

## 9. Definition of Done

1. No duplicate mount calls for inactive tabs.
2. No manual waterfall where queries can be parallelized.
3. Dashboard and case list meet target UX timings.
4. Permission/scope changes reflect immediately after auth refresh event.
