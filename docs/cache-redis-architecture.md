# Redis Enterprise Cache Architecture Plan

## Goals
- Fast list and dashboard responses.
- Strict correctness for operational data.
- No stale cross-user/cross-scope leakage.
- Reduced PostgreSQL read pressure.

## 1. Cache Domains

## 1.1 Master Data Cache (Long TTL)
- Data:
  - clients
  - products
  - verification types
  - locations
  - static dropdown metadata
- TTL:
  - 30m to 24h based on mutation frequency.
- Invalidation:
  - event-driven on create/update/delete of master entities.

## 1.2 Operational Cache (Short TTL)
- Data:
  - user stats cards
  - assignment counts
  - live workload counters
  - agent presence summaries
- TTL:
  - 15s to 120s.
- Invalidation:
  - workflow mutations (assign/reassign/start/submit/revoke/update status).

## 1.3 Aggregate Cache (Medium TTL)
- Data:
  - dashboard KPI bundles
  - MIS aggregates
  - TAT/SLA summaries
  - billing/commission summary cards
- TTL:
  - 60s to 600s (with event invalidation for sensitive slices).

## 1.4 Session/Auth Cache
- Data:
  - token/session metadata
  - permission snapshot version
  - rate-limit counters
  - user presence heartbeat
- TTL:
  - aligned to token/session lifetime for auth metadata.
  - short rolling TTL for presence.

## 2. Key Naming Standard

Format:
`acs:{env}:{domain}:{resource}:{scope}:{hashOrId}:v{schemaVersion}`

Examples:
- `acs:prod:master:clients:userScope:{scopeHash}:v1`
- `acs:prod:ops:users:stats:{userId}:{queryHash}:v1`
- `acs:prod:ops:cases:list:{actorId}:{scopeHash}:{queryHash}:v2`
- `acs:prod:agg:dashboard:kpi:{actorId}:{scopeHash}:{window}:v1`
- `acs:prod:sess:ratelimit:auth:login:{ip}:v1`

Rules:
1. Include actor or scope for permission/scoped responses.
2. Include query hash where filters affect response.
3. Include version suffix to support safe migrations.
4. Never reuse generic keys for user-scoped resources.

## 3. Scope-Safe Key Composition

Every scoped response key must include:
- `actorId`
- `scopeHash` derived from:
  - permission codes/capabilities snapshot version
  - assigned client IDs
  - assigned product IDs
  - hierarchy subordinate user IDs (where applicable)

This prevents stale permission/scope leakage after assignment or RBAC updates.

## 4. TTL Strategy Matrix

| Domain | TTL | Refresh | Invalidation Mode |
|---|---:|---|---|
| Master data | 1800s-86400s | lazy + warm | entity mutation events |
| Operational cards/lists | 15s-120s | lazy | synchronous on workflow mutations |
| Aggregate analytics | 60s-600s | lazy + periodic warm | event + time window |
| Session/auth | token-aligned | on access | auth/permission events |
| Mobile sync snapshots | 15s-60s | lazy | assignment/task mutation events |

## 5. Invalidation Event Map

## 5.1 Case lifecycle events
- `case.create`, `case.update`, `case.assign`, `case.reassign`
- Invalidate:
  - case list/detail
  - dashboard ops counters
  - assignment/workload slices
  - affected mobile sync keys

## 5.2 Visit/task workflow events
- `visit.start`, `visit.upload`, `visit.submit`, `visit.revoke`, task status transitions
- Invalidate:
  - verification task lists/details
  - dashboard task cards
  - TAT/SLA incremental aggregates
  - affected mobile sync keys

## 5.3 User/assignment/scope events
- user activation/deactivation
- client/product assignment changes
- hierarchy parent-child changes
- Invalidate:
  - users list/stats
  - scoped lists (cases/tasks/reports/billing)
  - dashboard scoped bundles

## 5.4 RBAC permission events
- role permission matrix update
- user role remap
- Invalidate:
  - auth snapshot
  - all actor-scoped page/data caches by permission version

## 5.5 Financial events
- invoice generation/update
- commission calculation/approval/payout
- Invalidate:
  - billing/commission summaries
  - financial lists scoped by client/product

## 6. Pub/Sub Invalidation Design

Use Redis pub/sub channel per domain:
- `acs:invalidate:ops`
- `acs:invalidate:agg`
- `acs:invalidate:master`
- `acs:invalidate:auth`

Message payload:
```json
{
  "event": "case.assign",
  "tenant": "acs",
  "affectedActorIds": [101, 203],
  "affectedScopeHashes": ["..."],
  "patterns": ["acs:prod:ops:cases:list:*"],
  "ts": 1760000000000
}
```

Consumers:
- backend API instances (multi-node consistency)
- websocket gateway (permission update propagation)

## 7. What Must Never Be Cached

1. Mutation responses that include transient workflow locks unless explicitly versioned.
2. Authorization decision outcomes detached from permission/scope version.
3. Unscoped object details (e.g., generic `case:{id}`) for scoped resources.
4. Mobile sync responses without request-window/query-scoped keys.
5. Sensitive one-time tokens/secrets in shared cache keys.

## 8. Warm Cache Policy

Warm only high-hit, stable, read-heavy keys:
- master dropdowns
- common dashboard KPI bundles by top scopes
- default list filters for high-volume pages

Do not warm highly personalized or low-hit query combinations.

## 9. SLO Targets

- Dashboard API p95: < 300ms
- Core list API p95: < 250ms
- Mobile sync incremental p95: < 400ms
- Redis hit ratio:
  - master > 95%
  - operational > 80%
  - aggregate > 85%

## 10. Architecture Summary
- Redis should be split by data criticality and mutation profile.
- All operational caches must be scope-aware and event-invalidated.
- Pub/sub invalidation is required for correctness in multi-instance runtime.
