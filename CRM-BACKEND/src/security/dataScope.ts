import { query } from '@/config/database';
import { getScopedOperationalUserIds } from '@/security/userScope';
import { isScopedOperationsUser } from '@/security/rbacAccess';

type RequestLike = {
  user?: {
    id?: string;
    permissionCodes?: string[];
    assignedClientIds?: number[];
    assignedProductIds?: number[];
  };
  // Active scope contract (project_scope_control_audit_2026_05_14.md P2).
  // Populated by middleware/activeScope.ts after validation. When set and
  // the route is NOT cross-tenant, resolveDataScope narrows the
  // hierarchy-aggregated scope to the chosen client / product.
  activeScope?: {
    clientId: number | null;
    productId: number | null;
  };
  routeMeta?: {
    crossTenant?: boolean;
  };
};

export type ResolvedDataScope = {
  restricted: boolean;
  scopedUserIds?: string[];
  assignedClientIds?: number[];
  assignedProductIds?: number[];
};

/**
 * Aggregate client IDs assigned to any user in the list.
 * Used so managers/TLs see clients assigned to themselves + subordinates.
 */
const getAggregatedClientIds = async (userIds: string[]): Promise<number[]> => {
  if (userIds.length === 0) {
    return [];
  }
  const result = await query<{ clientId: number }>(
    `SELECT DISTINCT client_id FROM user_client_assignments WHERE user_id = ANY($1::uuid[])`,
    [userIds]
  );
  return result.rows.map(r => r.clientId);
};

/**
 * Aggregate product IDs assigned to any user in the list.
 * Used so managers/TLs see products assigned to themselves + subordinates.
 */
const getAggregatedProductIds = async (userIds: string[]): Promise<number[]> => {
  if (userIds.length === 0) {
    return [];
  }
  const result = await query<{ productId: number }>(
    `SELECT DISTINCT product_id FROM user_product_assignments WHERE user_id = ANY($1::uuid[])`,
    [userIds]
  );
  return result.rows.map(r => r.productId);
};

/**
 * Narrow a hierarchy-aggregated id set by the active scope, unless the
 * route is explicitly cross-tenant. Pure helper — kept local since the
 * narrowing semantics are intentionally identical for clientId / productId.
 */
const narrowByActiveScope = (
  ids: number[] | undefined,
  target: number | null | undefined,
  isCrossTenant: boolean
): number[] | undefined => {
  if (isCrossTenant) {
    return ids;
  }
  if (target == null) {
    return ids;
  }
  if (!ids) {
    // No hierarchy aggregate to narrow against; defer to downstream
    // (controllers fall back to no-filter semantics).
    return ids;
  }
  return ids.includes(target) ? [target] : [];
};

export const resolveDataScope = async (req: RequestLike): Promise<ResolvedDataScope> => {
  if (!req.user?.id || !isScopedOperationsUser(req.user as never)) {
    return { restricted: false };
  }

  const scopedUserIds = await getScopedOperationalUserIds(req.user.id);
  const isCrossTenant = req.routeMeta?.crossTenant === true;
  const targetClientId = req.activeScope?.clientId ?? null;
  const targetProductId = req.activeScope?.productId ?? null;

  // For hierarchy users (Manager/TL), aggregate client/product access across all subordinates
  if (scopedUserIds && scopedUserIds.length > 0) {
    const [aggregatedClientIds, aggregatedProductIds] = await Promise.all([
      getAggregatedClientIds(scopedUserIds),
      getAggregatedProductIds(scopedUserIds),
    ]);

    const fallbackC = req.user.assignedClientIds;
    const fallbackP = req.user.assignedProductIds;
    const cIds = aggregatedClientIds.length > 0 ? aggregatedClientIds : fallbackC;
    const pIds = aggregatedProductIds.length > 0 ? aggregatedProductIds : fallbackP;

    return {
      restricted: true,
      scopedUserIds,
      assignedClientIds: narrowByActiveScope(cIds, targetClientId, isCrossTenant),
      assignedProductIds: narrowByActiveScope(pIds, targetProductId, isCrossTenant),
    };
  }

  // Non-hierarchy scoped users (e.g., BACKEND_USER) — use their own assignments
  return {
    restricted: true,
    scopedUserIds,
    assignedClientIds: narrowByActiveScope(
      req.user.assignedClientIds,
      targetClientId,
      isCrossTenant
    ),
    assignedProductIds: narrowByActiveScope(
      req.user.assignedProductIds,
      targetProductId,
      isCrossTenant
    ),
  };
};

type ScopeAppendOptions = {
  scope: ResolvedDataScope;
  conditions: string[];
  params: Array<string | number | boolean | string[] | number[]>;
  userExpr?: string;
  clientExpr?: string;
  productExpr?: string;
};

const appendArrayCondition = (
  conditions: string[],
  params: Array<string | number | boolean | string[] | number[]>,
  expr: string,
  values: string[] | number[] | undefined,
  cast: 'uuid[]' | 'int[]'
) => {
  if (!values) {
    return;
  }
  if (values.length === 0) {
    conditions.push('1=0');
    return;
  }
  params.push(values);
  conditions.push(`${expr} = ANY($${params.length}::${cast})`);
};

export const appendOperationalScopeConditions = ({
  scope,
  conditions,
  params,
  userExpr,
  clientExpr,
  productExpr,
}: ScopeAppendOptions): void => {
  if (!scope.restricted) {
    return;
  }

  if (userExpr) {
    appendArrayCondition(conditions, params, userExpr, scope.scopedUserIds, 'uuid[]');
  }
  if (clientExpr) {
    appendArrayCondition(conditions, params, clientExpr, scope.assignedClientIds, 'int[]');
  }
  if (productExpr) {
    appendArrayCondition(conditions, params, productExpr, scope.assignedProductIds, 'int[]');
  }
};

export const valueAllowedByScope = (
  values: {
    userId?: string | null;
    clientId?: number | null;
    productId?: number | null;
  },
  scope: ResolvedDataScope
): boolean => {
  if (!scope.restricted) {
    return true;
  }

  if (
    scope.scopedUserIds &&
    values.userId !== undefined &&
    values.userId !== null &&
    !scope.scopedUserIds.includes(values.userId)
  ) {
    return false;
  }

  if (
    scope.assignedClientIds &&
    values.clientId !== undefined &&
    values.clientId !== null &&
    !scope.assignedClientIds.includes(values.clientId)
  ) {
    return false;
  }

  if (
    scope.assignedProductIds &&
    values.productId !== undefined &&
    values.productId !== null &&
    !scope.assignedProductIds.includes(values.productId)
  ) {
    return false;
  }

  return true;
};
