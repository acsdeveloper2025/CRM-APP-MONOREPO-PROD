# Backend Cache Audit (`crm-backend`)

## Scope
- Audited: `CRM-BACKEND/src`
- Focus: Redis usage, cache middleware coverage, invalidation paths, unsafe caching, and missing cache opportunities.

## 1. Redis Usage Inventory

### 1.1 Enterprise cache layer
- `CRM-BACKEND/src/services/enterpriseCacheService.ts`
  - Redis client/cluster init: `createClient`, `createCluster`
  - Operations: `get`, `set(setEx)`, `delete(del)`, `mget`, `mset`, `increment`, `scanIterator`, `clearByPattern`
  - Stats/health: `info(memory/keyspace)`, `ping`
  - Key helpers: `CacheKeys.*`

### 1.2 Cache middleware
- `CRM-BACKEND/src/middleware/enterpriseCache.ts`
  - Response cache middleware: `EnterpriseCache.create(config)`
  - Invalidation middleware: `EnterpriseCache.invalidate(patterns, { synchronous })`
  - Config registry: `EnterpriseCacheConfigs`
  - Pattern registry: `CacheInvalidationPatterns`

### 1.3 Rate limit using Redis
- `CRM-BACKEND/src/middleware/enterpriseRateLimit.ts`
  - Uses `EnterpriseCacheService.increment()` and `delete()` for rate-limit counters.

### 1.4 Secondary Redis client (non-cache)
- `CRM-BACKEND/src/config/redis.ts`
  - Separate `redisClient` for app/health checks.
- `CRM-BACKEND/src/routes/health.ts`
  - Uses `redisClient.ping`, `setEx`, `get`, `del` for health verification.

### 1.5 Queue Redis (BullMQ)
- `CRM-BACKEND/src/config/queue.ts`
  - Uses Redis for queues/events (`background-sync`, `notifications`, `file-processing`, `geolocation`, `case-assignment`).
  - This is job infra, not API response cache.

### 1.6 Cache warming
- `CRM-BACKEND/src/services/cacheWarmingService.ts`
  - Writes preloaded keys (`clients:list`, `products:list`, `verification-types:list`, `rate-types:list`, `users:list:*`, `cases:recent:*`, `analytics:*`).
  - Periodic refresh and pattern invalidation methods.

### 1.7 Pub/Sub usage
- No Redis pub/sub usage found for cache invalidation broadcasting.
- WebSocket subscribe/unsubscribe exists, but not Redis-backed pub/sub invalidation.

## 2. Cache Middleware Coverage (Route-level)

| Route | Method | Controller | Cache Config / Invalidate | Key Pattern | TTL |
|---|---|---|---|---|---|
| `/api/cases` | GET | `getCases` | `EnterpriseCacheConfigs.caseList` | `user:{userId}:cases:page:{page}:{md5(query)}` | 300s |
| `/api/cases/create` | POST | `createCase` | `invalidate(caseUpdate)` | `api_cache:*:*cases*`, `analytics:*`, workload | n/a |
| `/api/cases/:id/summary` | GET | `getCaseSummaryWithTasks` | `EnterpriseCacheConfigs.caseDetails` | `case:{caseId}` | 900s |
| `/api/cases/:id` | GET | `getCaseById` | `EnterpriseCacheConfigs.caseDetails` | `case:{caseId}` | 900s |
| `/api/cases/:id` | PUT | `updateCase` | `invalidate(assignmentUpdate)` | cases+analytics+mobile+users patterns | n/a |
| `/api/users` | GET | `getUsers` | `EnterpriseCacheConfigs.usersList` | `users:list:{userId}:{md5(query)}` | 300s |
| `/api/users/search` | GET | `searchUsers` | `EnterpriseCacheConfigs.usersList` | `users:list:{userId}:{md5(query)}` | 300s |
| `/api/users/stats` | GET | `getUserStats` | `EnterpriseCacheConfigs.userStats` | `users:stats:{userId}:{md5(query)}` | 30s |
| `/api/users/departments` | GET | `getDepartments` | `EnterpriseCacheConfigs.analytics` | `analytics:{userId}:{path}:{md5(query)}` | 1800s |
| `/api/users/designations` | GET | `getDesignations` | `EnterpriseCacheConfigs.analytics` | same | 1800s |
| `/api/users/activities` | GET | `getUserActivities` | `EnterpriseCacheConfigs.analytics` | same | 1800s |
| `/api/users/sessions` | GET | `getUserSessions` | `EnterpriseCacheConfigs.analytics` | same | 1800s |
| `/api/users/roles/permissions` | GET | `getRolePermissions` | `EnterpriseCacheConfigs.analytics` | same | 1800s |
| `/api/users` | POST | `createUser` | `invalidate(userUpdate)` | `users:*`, `users:stats:*`, `api_cache...` | n/a |
| `/api/users/bulk-operation` | POST | `bulkUserOperation` | `invalidate(userUpdate)` | same | n/a |
| `/api/users/:userId/client-assignments` | POST | `assignClientsToUser` | `invalidate(assignmentUpdate,sync)` | cases/analytics/mobile/users | n/a |
| `/api/users/:userId/client-assignments/:clientId` | DELETE | `removeClientAssignment` | `invalidate(assignmentUpdate,sync)` | same | n/a |
| `/api/users/:userId/product-assignments` | POST | `assignProductsToUser` | `invalidate(assignmentUpdate,sync)` | same | n/a |
| `/api/users/:userId/product-assignments/:productId` | DELETE | `removeProductAssignment` | `invalidate(assignmentUpdate,sync)` | same | n/a |
| `/api/users/:id` | PUT/DELETE | `updateUser/deleteUser` | `invalidate(userUpdate)` | users + stats | n/a |
| `/api/users/:id/activate` | POST | `activateUser` | `invalidate(userUpdate)` | users + stats | n/a |
| `/api/users/:id/deactivate` | POST | `deactivateUser` | `invalidate(userUpdate)` | users + stats | n/a |
| `/api/clients` | GET | `getClients` | `EnterpriseCacheConfigs.clientList` | `clients:list:{userId}:{md5(query)}` | 3600s |
| `/api/clients/:id` | GET | `getClientById` | `EnterpriseCacheConfigs.clientList` | same | 3600s |
| `/api/clients/:id/verification-types` | GET | `getClientVerificationTypes` | `EnterpriseCacheConfigs.verificationTypes` | `verification-types:list:{userId}:{md5(query)}` | 3600s |
| `/api/clients` | POST/PUT/DELETE | client mutations | `invalidate(clientUpdate)` | `clients:*`, `api_cache:*:*clients*` | n/a |
| `/api/products` | GET | `getProducts` | `EnterpriseCacheConfigs.products` | `products:list:{userId}:{md5(query)}` | 3600s |
| `/api/products/stats` | GET | `getProductStats` | `EnterpriseCacheConfigs.analytics` | analytics key | 1800s |
| `/api/products/:id` | GET | `getProductById` | `EnterpriseCacheConfigs.products` | products key | 3600s |
| `/api/products/:id/verification-types` | GET | `getProductVerificationTypes` | `EnterpriseCacheConfigs.verificationTypes` | verification-types key | 3600s |
| `/api/products` | POST/PUT/DELETE | product mutations | `invalidate(productUpdate)` | `products:*`, `api_cache:*:*products*` | n/a |
| `/api/verification-types` | GET | `getVerificationTypes` | `EnterpriseCacheConfigs.verificationTypes` | `verification-types:list:{userId}:{md5(query)}` | 3600s |
| `/api/verification-types/stats` | GET | `getVerificationTypeStats` | `EnterpriseCacheConfigs.analytics` | analytics key | 1800s |
| `/api/verification-types/:id` | GET | `getVerificationTypeById` | `EnterpriseCacheConfigs.verificationTypes` | verification-types key | 3600s |
| `/api/verification-types` | POST/PUT/DELETE | verification type mutations | `invalidate(verificationTypeUpdate)` | verification-types + api_cache patterns | n/a |
| `/api/mobile/cases` | GET | `MobileCaseController.getMobileCases` | `EnterpriseCacheConfigs.mobileSync` | `mobile:sync:{userId}` | 120s |
| `/api/mobile/tasks` | GET | same | `EnterpriseCacheConfigs.mobileSync` | `mobile:sync:{userId}` | 120s |
| `/api/mobile/verification-tasks/:taskId` | GET | `getMobileCase` | `EnterpriseCacheConfigs.caseDetails` | `case:{taskId}` | 900s |
| `/api/mobile/verification-tasks/:taskId/auto-save/:formType` | GET | `getAutoSavedForm` | `EnterpriseCacheConfigs.caseDetails` | `case:{taskId}` | 900s |
| task state mutation routes in `/api/mobile` | POST/PUT | mobile task actions | `invalidate(assignmentUpdate,sync)` | cases/analytics/mobile/users | n/a |
| `/api/users/:userId/territory-assignments/bulk` | POST | `bulkSaveTerritoryAssignments` | `invalidate(assignmentUpdate,sync)` | cases/analytics/mobile/users | n/a |

## 3. Invalidation Logic Audit

### 3.1 Middleware-driven invalidation (route-level)
- `CacheInvalidationPatterns.caseUpdate`
  - Triggered on case creation (`/cases/create`)
- `CacheInvalidationPatterns.assignmentUpdate`
  - Triggered on case update (`/cases/:id`)
  - Triggered on user assignment mutations and mobile task start/complete/revoke/status update endpoints
  - Triggered on territory bulk save route
- `CacheInvalidationPatterns.userUpdate`
  - Triggered on user CRUD/activation/deactivation/bulk operation
- `clientUpdate`, `productUpdate`, `verificationTypeUpdate`
  - Triggered on their corresponding master-data mutations

### 3.2 Direct invalidation (controller/service-level)
- `CRM-BACKEND/src/controllers/userTerritoryController.ts`
  - `clearByPattern('users:list:*')`
  - `delete(CacheKeys.user(userId))`
- `CRM-BACKEND/src/services/cacheWarmingService.ts`
  - `invalidateCasesCaches`: clears `cases:*`, `analytics:case-stats`, `analytics:field-agent-workload`
  - `invalidateUsersCaches`: clears `users:*`, workload analytics
  - `invalidateClientsCaches`: clears `clients:*`

### 3.3 Event mapping status
- User update: covered
- Case update/create: partially covered (see gaps below)
- Assignment update: covered
- Verification status/task transitions: partially covered via mobile and some task flows
- Billing changes: no cache invalidation integration (because billing endpoints are mostly uncached)
- Auth login/logout: no cache invalidation hooks (only rate-limit reset key deletions)

## 4. Unsafe / Incorrect Caching Findings

### Critical
1. `caseDetails` key is not user-scoped and middleware runs before object-level validators on web routes.
- Evidence:
  - Key: `CacheKeys.case(caseId)` in `EnterpriseCacheConfigs.caseDetails`
  - Route order in `CRM-BACKEND/src/routes/cases.ts`: cache middleware before `validateCaseAccess`
- Risk:
  - Cached case payload can be served before scope/ownership validator executes.

2. `/api/mobile/cases` and `/api/mobile/tasks` cache key ignores query parameters.
- Evidence:
  - Key: `mobile:sync:{userId}` only.
  - Controller behavior depends on `lastSyncTimestamp` and `limit`.
- Risk:
  - Different sync requests for same user return stale/wrong batch payload.

### High
3. Dual caching on cases list with inconsistent invalidation.
- Evidence:
  - Route cache middleware on `/api/cases` + manual cache in `casesController.getCases` (`EnterpriseCacheService.get/set` with 60s).
  - Route invalidation patterns do not target `user:{id}:cases:page:{n}:...` controller-level keys.
- Risk:
  - Stale list/statistics after mutations; difficult to reason about freshness.

4. Cache warming writes keys that do not align with route key generators.
- Example:
  - Warms `clients:list`, while route key is `clients:list:{userId}:{md5(query)}`.
- Risk:
  - Warmed keys are mostly not read by middleware; warming cost without hit-rate benefit.

### Medium
5. Overly long TTL for some operationally sensitive endpoints under generic `analytics` config (1800s).
- Affects `users/activities`, `users/sessions`, role-permission listing in current route wiring.
- Risk:
  - Perceived stale UX and delayed operational visibility.

## 5. Missing Caching (High-Impact Endpoints)

No response-cache middleware found for these heavy domains:
- Dashboard APIs (`/api/dashboard/*`)
- Reports/MIS APIs (`/api/reports/*`)
- Verification task list/detail analytics endpoints (`/api/verification-tasks*`)
- Commissions list/summary (`/api/commissions*`)
- Invoices list/stats (`/api/invoices*`) 

Likely impact:
- Repeated expensive aggregations and joins hit PostgreSQL directly on each request.

## 6. Backend Audit Summary
- Existing cache layer is broad but inconsistent in key design and invalidation completeness.
- Most critical correctness risk is object-level access and query-sensitive mobile sync cache keying.
- Current architecture mixes route middleware cache + controller-local cache + warm cache keys with mismatched namespaces.
- Performance opportunity remains large in dashboard/reports/task analytics domains where caching is absent.
