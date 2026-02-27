# Database Load Analysis (`crm-backend`)

## Scope
- Audited: `CRM-BACKEND/src/controllers`, `CRM-BACKEND/src/services`, `CRM-BACKEND/src/routes`
- Focus: endpoints causing high PostgreSQL load, expensive query patterns, repeated aggregate computation, and precompute/cache candidates.

## 1. Highest Load Domains

## 1.1 Verification Tasks
- Key files:
  - `CRM-BACKEND/src/controllers/verificationTasksController.ts`
  - `CRM-BACKEND/src/routes/verificationTasks.ts`
- Why high load:
  - Frequent list access + status transitions + dashboard-style counts.
  - Repeated filtered counts and workload aggregation.
- Query pattern risks:
  - Multiple `COUNT(*)` with similar filters.
  - Potential repeated joins against case/user/client dimensions.

## 1.2 Cases
- Key files:
  - `CRM-BACKEND/src/controllers/casesController.ts`
  - `CRM-BACKEND/src/routes/cases.ts`
- Why high load:
  - Core operational list/detail pages are high QPS.
  - List, details, summaries, and assignment updates generate repeated reads.
- Query pattern risks:
  - Paginated list + additional stats queries for same filter context.
  - Per-case detail joins used in hot paths.

## 1.3 Dashboard / KPI
- Key files:
  - `CRM-BACKEND/src/controllers/dashboardController.ts`
  - `CRM-BACKEND/src/services/dashboardKPIService.ts`
- Why high load:
  - Dashboard fan-out to multiple aggregate metrics per request.
- Query pattern risks:
  - Parallel aggregate scans over same operational window.
  - Recomputed counters for every page open/refresh.

## 1.4 Reports / MIS / Analytics
- Key files:
  - `CRM-BACKEND/src/controllers/reportsController.ts`
  - `CRM-BACKEND/src/controllers/templateReportsController.ts`
  - `CRM-BACKEND/src/controllers/enhancedAnalyticsController.ts`
- Why high load:
  - Heavy grouped analytics and date-window reporting.
- Query pattern risks:
  - `GROUP BY`, filtered rollups, and join-heavy report extraction.
  - Duplicate aggregate computation across adjacent report endpoints.

## 1.5 Billing / Commissions
- Key files:
  - `CRM-BACKEND/src/controllers/invoicesController.ts`
  - `CRM-BACKEND/src/controllers/commissionsController.ts`
- Why high load:
  - Summary cards + list views often query same billing windows repeatedly.
- Query pattern risks:
  - Repeated totals by status/client/product.
  - Similar scans for count and amount summaries.

## 2. Expensive Query Patterns (Cross-Cutting)

1. Repeated count + list execution on same filter
- Pattern: run list query and separate count query repeatedly.
- Impact: doubles DB work for high-traffic list endpoints.

2. Recomputed dashboard aggregates per request
- Pattern: aggregate metrics recalculated every load.
- Impact: avoidable CPU/IO under concurrent traffic.

3. Grouped reports without pre-aggregation
- Pattern: direct `GROUP BY` over operational tables.
- Impact: higher latency on large time windows.

4. Similar filters executed in separate endpoints
- Pattern: adjacent cards/widgets execute independent SQL with near-identical predicates.
- Impact: unnecessary duplication.

5. Potential N+1 style follow-up lookups in workflow flows
- Pattern: iterative related-entity queries in controller/service flows.
- Impact: latency spikes under batch operations.

## 3. Endpoints Most Likely to Drive DB Load

## 3.1 Operational lists (high frequency)
- `/api/cases`
- `/api/verification-tasks`
- `/api/mobile/cases`
- `/api/mobile/tasks`

## 3.2 Aggregate-heavy dashboards/reports
- `/api/dashboard/*`
- `/api/reports/*`
- `/api/analytics/*`
- `/api/verification-tasks/stats` and related summary endpoints

## 3.3 Financial summaries
- `/api/invoices*`
- `/api/commissions*`

## 4. Recommended Cache/Precompute Targeting

## 4.1 Materialized cache candidates (short TTL + event invalidation)
- Dashboard KPI bundles
- Verification task operational summaries
- Case workload counters by assignee/client/product

## 4.2 Aggregate cache candidates (medium TTL + event invalidation)
- MIS trend charts
- TAT/SLA rollups
- Billing and commission summary cards

## 4.3 Master lookup cache candidates (long TTL)
- Clients, products, verification types, locations
- Role/permission matrix read models

## 5. Query Reduction Opportunities (Without Schema Change)

1. Consolidate count/list queries using shared filtered CTEs.
2. Memoize expensive dashboard bundle responses by scoped key.
3. Cache common report windows (today, 7d, 30d) per user scope.
4. Replace repeated per-widget fetch with one aggregated endpoint payload.
5. Introduce async precompute refresh for non-critical trend slices.

## 6. Observability Gaps (Need Before Rollout)

1. Missing endpoint-level query latency baseline.
2. No per-endpoint cache hit/miss dashboard correlated to DB load.
3. No standardized SQL timing tags by controller/action.

## 7. DB Analysis Summary
- Current load concentrates in operational list APIs and aggregate-heavy dashboard/report APIs.
- Largest wins come from scoped aggregate caching and consolidated query execution.
- Correctness requirements (RBAC/scope/hierarchy) require cache keys to include actor scope and invalidation on workflow mutations.
