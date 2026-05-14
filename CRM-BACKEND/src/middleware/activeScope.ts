// Active scope middleware — per-request narrowing of data visibility to a
// chosen client / product without ever mutating req.user.assignedClientIds.
//
// Contract (project_scope_control_audit_2026_05_14.md):
//  - Frontend may send X-Active-Client-Id / X-Active-Product-Id headers as
//    HINTS. Backend NEVER trusts them blindly — it validates the value
//    against the authenticated user's assignedClientIds / assignedProductIds
//    and returns 403 if outside the assigned set.
//  - `req.effectiveClientIds` / `req.effectiveProductIds` are populated
//    on every authenticated request:
//       * narrowed to [activeScope.clientId] when a valid header is present;
//       * fall back to `req.user.assignedClientIds` (baseline) otherwise.
//  - `req.user` is read-only; the auth context is frozen by
//    loadUserAuthContext so this file COULDN'T mutate it even by accident.
//  - Cross-tenant routes (dedupe / MIS aggregates / etc.) opt out of
//    narrowing via the declarative `markCrossTenant` route marker. When
//    that marker is in the route chain it overwrites effectiveClientIds /
//    effectiveProductIds back to the baseline assigned set.

import type { Response, NextFunction } from 'express';
import { logger } from '@/config/logger';
import { createAuditLog } from '@/utils/auditLogger';
import type { AuthenticatedRequest } from './auth';

export interface ActiveScope {
  clientId: number | null;
  productId: number | null;
}

export interface RouteMeta {
  /**
   * If true, this route legitimately spans multiple tenants (deduplication,
   * MIS aggregates, super-admin reports, …) and active-scope narrowing is
   * bypassed. Catalogued in project_rls_deferred_2026_04_30.md.
   */
  crossTenant?: boolean;
}

const ACTIVE_CLIENT_HEADER = 'x-active-client-id';
const ACTIVE_PRODUCT_HEADER = 'x-active-product-id';

const parsePositiveInt = (raw: string | string[] | undefined): number | null => {
  if (raw == null) {
    return null;
  }
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Per-route marker. Place BEFORE the route's controller so applyActiveScope
 * (which runs before route-level handlers, in the auth chain) is overridden
 * back to the baseline assigned set for legitimately cross-tenant routes.
 *
 *   router.get('/deduplication/search', markCrossTenant, dedupeController.search);
 */
export const markCrossTenant = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  req.routeMeta = { ...(req.routeMeta ?? {}), crossTenant: true };
  if (req.user) {
    req.effectiveClientIds = [...(req.user.assignedClientIds ?? [])];
    req.effectiveProductIds = [...(req.user.assignedProductIds ?? [])];
  }
  next();
};

/**
 * Reads X-Active-Client-Id / X-Active-Product-Id headers, validates each
 * against the authenticated user's assignedClientIds / assignedProductIds,
 * and populates req.activeScope. Headers are HINTS — backend always
 * intersects.
 *
 * Behaviour:
 *  - Missing or unparseable headers → activeScope = { clientId: null, productId: null }
 *  - Header value ∈ assigned set → activeScope populated
 *  - Header value NOT in assigned set (and user has a non-empty assigned set) → 403
 *  - User has an empty assigned set (super-admin etc.) → header passes through
 *    (controllers fall back to no-filter semantics via the existing
 *    `if (length > 0) push filter` pattern)
 */
export const validateActiveScope = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    // Public route (no auth) — nothing to scope, nothing to validate.
    next();
    return;
  }

  const clientId = parsePositiveInt(req.headers[ACTIVE_CLIENT_HEADER]);
  const productId = parsePositiveInt(req.headers[ACTIVE_PRODUCT_HEADER]);

  if (clientId !== null) {
    const assigned = req.user.assignedClientIds ?? [];
    if (assigned.length > 0 && !assigned.includes(clientId)) {
      logger.warn('Invalid active client scope rejected', {
        userId: req.user.id,
        requestedClientId: clientId,
        assignedClientIds: assigned,
        endpoint: req.originalUrl,
        method: req.method,
      });
      // P10 — persistent audit trail of scope-bypass attempts. Fire and
      // forget; queue-backed createAuditLog falls back to direct insert
      // if Redis is down, and we never want audit failure to mask the
      // 403 response. See project_scope_control_audit_2026_05_14.md.
      void createAuditLog({
        userId: req.user.id,
        action: 'SCOPE_VIOLATION_REJECTED',
        entityType: 'SCOPE',
        details: {
          code: 'INVALID_ACTIVE_SCOPE_CLIENT',
          requestedClientId: clientId,
          assignedClientIds: [...assigned],
          endpoint: req.originalUrl,
          method: req.method,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      }).catch(err => logger.warn('Failed to write SCOPE_VIOLATION_REJECTED audit log', { err }));
      res.status(403).json({
        success: false,
        message: 'Active client scope is not in your assigned clients',
        error: { code: 'INVALID_ACTIVE_SCOPE_CLIENT' },
      });
      return;
    }
  }

  if (productId !== null) {
    const assigned = req.user.assignedProductIds ?? [];
    if (assigned.length > 0 && !assigned.includes(productId)) {
      logger.warn('Invalid active product scope rejected', {
        userId: req.user.id,
        requestedProductId: productId,
        assignedProductIds: assigned,
        endpoint: req.originalUrl,
        method: req.method,
      });
      void createAuditLog({
        userId: req.user.id,
        action: 'SCOPE_VIOLATION_REJECTED',
        entityType: 'SCOPE',
        details: {
          code: 'INVALID_ACTIVE_SCOPE_PRODUCT',
          requestedProductId: productId,
          assignedProductIds: [...assigned],
          endpoint: req.originalUrl,
          method: req.method,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      }).catch(err => logger.warn('Failed to write SCOPE_VIOLATION_REJECTED audit log', { err }));
      res.status(403).json({
        success: false,
        message: 'Active product scope is not in your assigned products',
        error: { code: 'INVALID_ACTIVE_SCOPE_PRODUCT' },
      });
      return;
    }
  }

  req.activeScope = { clientId, productId };
  next();
};

/**
 * Computes req.effectiveClientIds / req.effectiveProductIds from
 * req.activeScope ⊕ req.user.assignedClientIds / assignedProductIds.
 *
 * NEVER mutates req.user. Adds two new request-scoped properties only.
 *
 * Cross-tenant routes must place `markCrossTenant` in their handler chain
 * to override the narrowing back to baseline assigned ids.
 */
export const applyActiveScope = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    next();
    return;
  }

  const assignedClient = req.user.assignedClientIds ?? [];
  const assignedProduct = req.user.assignedProductIds ?? [];
  const scope = req.activeScope;

  req.effectiveClientIds = scope?.clientId != null ? [scope.clientId] : [...assignedClient];
  req.effectiveProductIds = scope?.productId != null ? [scope.productId] : [...assignedProduct];

  next();
};

// Module augmentation: extend AuthenticatedRequest in place. Kept in this
// file (next to the middleware that populates these fields) so future
// reviewers see the contract and the producer in one read.
declare module './auth' {
  interface AuthenticatedRequest {
    activeScope?: ActiveScope;
    effectiveClientIds?: number[];
    effectiveProductIds?: number[];
    routeMeta?: RouteMeta;
  }
}
