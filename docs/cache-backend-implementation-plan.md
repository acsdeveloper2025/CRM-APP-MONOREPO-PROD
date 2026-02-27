# Backend Cache Implementation Plan (Safe Migration)

## Constraints
- No RBAC regression.
- No scope/hierarchy leakage.
- No behavior changes to workflow semantics.
- Rollout must be reversible per endpoint.

## Phase 0: Baseline and Guardrails

1. Add cache observability before migration
- Metrics:
  - hit/miss ratio by endpoint
  - cache set/invalidate counts
  - stale serve incidents
  - DB latency p50/p95 by endpoint

2. Introduce kill switches
- Env flags per cache domain:
  - `CACHE_MASTER_ENABLED`
  - `CACHE_OPS_ENABLED`
  - `CACHE_AGG_ENABLED`
  - `CACHE_MOBILE_ENABLED`

3. Standardize key builder
- Central key helpers must require:
  - actorId
  - scopeHash
  - queryHash
  - version tag

## Phase 1: Correctness Fixes First

1. Fix unsafe object cache ordering
- Ensure object-level access/scope checks run before cache lookup for scoped resources.
- Move cache middleware behind `validateCaseAccess`/ownership checks where needed.

2. Replace unsafe generic keys
- Replace unscoped case/task detail keys with actor/scope-safe keys.

3. Fix mobile sync keying
- Include sync query parameters (`lastSyncTimestamp`, `limit`, filters) in key hash.

4. Remove duplicate caching paths
- For `/api/cases` choose one caching mechanism (middleware-centric).
- Remove controller-local parallel cache for same payload.

## Phase 2: Domain-by-Domain Cache Rollout

## 2.1 Master Data Domain
- Endpoints:
  - clients/products/verification-types/locations dropdowns
- TTL:
  - 30m+
- Invalidation:
  - entity CRUD events only

## 2.2 Operational Domain
- Endpoints:
  - users stats
  - case/task list counters
  - assignment workload cards
- TTL:
  - 15s-120s
- Invalidation:
  - synchronous on assignment/task/case status events

## 2.3 Aggregate Domain
- Endpoints:
  - dashboard KPI bundles
  - reports/MIS summary APIs
  - billing/commission summary cards
- TTL:
  - 60s-600s
- Invalidation:
  - event + bounded time-window refresh

## 2.4 Mobile Domain
- Endpoints:
  - mobile list sync snapshots
  - mobile task detail slices
- TTL:
  - 15s-60s
- Invalidation:
  - task/assignment lifecycle events

## Phase 3: Invalidation Unification

1. Define canonical invalidation events
- `case.create/update/assign/reassign`
- `visit.start/upload/submit/revoke`
- `user.update/activate/deactivate`
- `assignment.update`
- `rbac.permissions.updated`
- `billing.invoice.updated`
- `commission.updated`

2. Map each event to patterns
- Maintain one source of truth mapping in cache module.
- Eliminate scattered manual `clearByPattern` usage where possible.

3. Add pub/sub propagation
- Publish invalidation messages to Redis channels.
- All API instances subscribe and invalidate locally.

## Phase 4: RBAC and Scope Coherence

1. Scope hash integration
- Build scope hash from:
  - permission version
  - assigned clients/products
  - hierarchy subordinate IDs

2. Auth permission update handling
- On RBAC change, bump permission version and invalidate affected scoped keys.

3. Protect all cached responses
- Ensure cached payload cannot be returned without passing auth and scope checks.

## Phase 5: Performance Hardening

1. Add request coalescing for hot keys
- Prevent thundering herd on cache miss.

2. Add stale-while-revalidate selectively
- Only for non-critical aggregates (never for sensitive operational state).

3. Add background warming for top keys
- Warm high-hit dashboard/list defaults only.

## APIs to Update (Priority)

1. Critical correctness
- `/api/cases/:id`
- `/api/cases/:id/summary`
- `/api/mobile/cases`
- `/api/mobile/tasks`

2. High-load performance
- `/api/dashboard/*`
- `/api/reports/*`
- `/api/verification-tasks*`
- `/api/invoices*`
- `/api/commissions*`

3. Master dropdown consistency
- `/api/clients`
- `/api/products`
- `/api/verification-types`
- location master routes

## What to Never Cache (Backend Rulebook)

1. Responses containing volatile lock/transition state unless versioned.
2. Permission decision outcomes not tied to permission version.
3. Unscoped details for scoped entities.
4. Mutation side-effect confirmation endpoints where immediate freshness is required.

## Rollback Strategy

1. Feature flag rollback
- Disable domain flag to bypass cache immediately.

2. Version bump rollback
- Increment cache version suffix to bypass polluted keys.

3. Emergency invalidation
- Domain-specific pattern purge scripts for ops/agg/mobile.

4. Safe fallback
- All endpoints continue working via DB path when cache disabled.

## Definition of Done

1. No unsafe/unscoped cache keys remain.
2. Cache hit ratio targets met without stale-data incidents.
3. RBAC/scope test suite passes with cache enabled and disabled.
4. Dashboard/list p95 meets target under expected load.
