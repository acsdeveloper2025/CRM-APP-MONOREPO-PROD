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

export const resolveDataScope = async (req: RequestLike): Promise<ResolvedDataScope> => {
  if (!req.user?.id || !isScopedOperationsUser(req.user as never)) {
    return { restricted: false };
  }

  const scopedUserIds = await getScopedOperationalUserIds(req.user.id);
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
