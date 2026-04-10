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
  const result = await query<{ client_id: number }>(
    `SELECT DISTINCT client_id FROM user_client_assignments WHERE user_id = ANY($1::uuid[])`,
    [userIds]
  );
  return result.rows.map(r => r.client_id);
};

/**
 * Aggregate product IDs assigned to any user in the list.
 * Used so managers/TLs see products assigned to themselves + subordinates.
 */
const getAggregatedProductIds = async (userIds: string[]): Promise<number[]> => {
  if (userIds.length === 0) {
    return [];
  }
  const result = await query<{ product_id: number }>(
    `SELECT DISTINCT product_id FROM user_product_assignments WHERE user_id = ANY($1::uuid[])`,
    [userIds]
  );
  return result.rows.map(r => r.product_id);
};

export const resolveDataScope = async (req: RequestLike): Promise<ResolvedDataScope> => {
  if (!req.user?.id || !isScopedOperationsUser(req.user as never)) {
    return { restricted: false };
  }

  const scopedUserIds = await getScopedOperationalUserIds(req.user.id);

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
      assignedClientIds: cIds,
      assignedProductIds: pIds,
    };
  }

  // Non-hierarchy scoped users (e.g., BACKEND_USER) — use their own assignments
  return {
    restricted: true,
    scopedUserIds,
    assignedClientIds: req.user.assignedClientIds,
    assignedProductIds: req.user.assignedProductIds,
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
