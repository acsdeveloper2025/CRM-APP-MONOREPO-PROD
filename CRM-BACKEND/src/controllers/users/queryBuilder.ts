import type { AuthenticatedRequest } from '../../middleware/auth';
import {
  hasSystemScopeBypass,
  userHasAnyPermission,
  userHasPermission,
} from '@/security/rbacAccess';
import { getScopedOperationalUserIds } from '@/security/userScope';

// Module-scope WHERE-builder for the users list + export endpoints (single
// source of WHERE-truth). Extracted from usersController (§7 decomposition);
// pure function (reads req.query only). Behaviour pinned by
// usersList.integration.test.ts.
export const buildUsersWhereClause = (
  req: AuthenticatedRequest
): { whereClause: string; queryParams: (string | number | boolean)[]; nextParamIndex: number } => {
  const { role, department, isActive, search, consentStatus, createdFrom, createdTo } = req.query;
  const conditions: string[] = ['u.deleted_at IS NULL'];
  const params: (string | number | boolean)[] = [];
  let paramIndex = 1;

  if (role && typeof role === 'string') {
    conditions.push(`EXISTS (
      SELECT 1
      FROM user_roles urf
      JOIN roles_v2 rvf ON rvf.id = urf.role_id
      WHERE urf.user_id = u.id AND rvf.name = $${paramIndex}
    )`);
    params.push(role);
    paramIndex++;
  }

  if (department && typeof department === 'string') {
    conditions.push(`d.name ILIKE $${paramIndex}`);
    params.push(`%${department}%`);
    paramIndex++;
  }

  // 'all' (or undefined) → no filter; 'true'/'false' string OR coerced
  // boolean → flip is_active branch. Never `if (isActive !== undefined)`
  // alone — that silently treats 'all' as false (§9.7 don't-regress).
  if (typeof isActive === 'boolean') {
    conditions.push(`u.is_active = $${paramIndex}`);
    params.push(isActive);
    paramIndex++;
  } else if (isActive === 'true' || isActive === 'false') {
    conditions.push(`u.is_active = $${paramIndex}`);
    params.push(isActive === 'true');
    paramIndex++;
  }

  if (search && typeof search === 'string') {
    conditions.push(`(
      COALESCE(u.name, '') ILIKE $${paramIndex} OR
      COALESCE(u.email, '') ILIKE $${paramIndex} OR
      COALESCE(u.username, '') ILIKE $${paramIndex} OR
      COALESCE(u.employee_id, '') ILIKE $${paramIndex}
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Field Executive Acknowledgement filter (2026-05-13): 'accepted' = at
  // least one row in user_consents for this user; 'pending' = zero rows.
  if (consentStatus === 'accepted') {
    conditions.push(`EXISTS (SELECT 1 FROM user_consents uc WHERE uc.user_id = u.id)`);
  } else if (consentStatus === 'pending') {
    conditions.push(`NOT EXISTS (SELECT 1 FROM user_consents uc WHERE uc.user_id = u.id)`);
  }

  if (typeof createdFrom === 'string' && createdFrom) {
    conditions.push(`u.created_at >= $${paramIndex}`);
    params.push(createdFrom);
    paramIndex++;
  }
  if (typeof createdTo === 'string' && createdTo) {
    conditions.push(`u.created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
    params.push(createdTo);
    paramIndex++;
  }

  return {
    whereClause: `WHERE ${conditions.join(' AND ')}`,
    queryParams: params,
    nextParamIndex: paramIndex,
  };
};

// SORT maps mirror FE SORT_OPTIONS values. Adding a new sort key requires
// updating BOTH the map AND the route validator AND the FE SORT_OPTIONS.
export const ACTIVITY_SORT_MAP: Record<string, string> = {
  createdAt: 'al.created_at',
  action: 'al.action',
  entityType: 'al.entity_type',
};
export const SESSION_SORT_MAP: Record<string, string> = {
  createdAt: 'rt.created_at',
  expiresAt: 'rt.expires_at',
  ipAddress: 'rt.ip_address',
};

export const buildUserActivitiesWhereClause = async (
  req: AuthenticatedRequest
): Promise<{
  whereClause: string;
  queryParams: (string | number | string[])[];
  nextParamIndex: number;
}> => {
  const { search, userId, action, createdFrom, createdTo } = req.query;
  const canViewAllActivities =
    hasSystemScopeBypass(req.user) ||
    userHasPermission(req.user, 'permission.manage') ||
    userHasPermission(req.user, 'role.manage');

  const conditions: string[] = [];
  const params: (string | number | string[])[] = [];
  let paramIndex = 1;

  if (canViewAllActivities) {
    if (userId && typeof userId === 'string') {
      conditions.push(`al.user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }
  } else {
    const hierarchyUserIds = req.user?.id
      ? await getScopedOperationalUserIds(req.user.id)
      : undefined;

    if (hierarchyUserIds && hierarchyUserIds.length > 0) {
      conditions.push(`al.user_id = ANY($${paramIndex}::uuid[])`);
      params.push(hierarchyUserIds);
      paramIndex++;
    } else if (req.user?.id) {
      conditions.push(`al.user_id = $${paramIndex}`);
      params.push(req.user.id);
      paramIndex++;
    }
  }

  if (search && typeof search === 'string') {
    conditions.push(`(al.action ILIKE $${paramIndex} OR al.details::text ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (action && typeof action === 'string') {
    conditions.push(`al.action = $${paramIndex}`);
    params.push(action);
    paramIndex++;
  }

  if (typeof createdFrom === 'string' && createdFrom) {
    conditions.push(`al.created_at >= $${paramIndex}`);
    params.push(createdFrom);
    paramIndex++;
  }
  if (typeof createdTo === 'string' && createdTo) {
    conditions.push(`al.created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
    params.push(createdTo);
    paramIndex++;
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    queryParams: params,
    nextParamIndex: paramIndex,
  };
};

export const buildUserSessionsWhereClause = (
  req: AuthenticatedRequest
): { whereClause: string; queryParams: (string | number)[]; nextParamIndex: number } => {
  const { userId, isActive, search, createdFrom, createdTo } = req.query;
  const canViewOtherSessions =
    hasSystemScopeBypass(req.user) ||
    userHasAnyPermission(req.user, ['user.update', 'territory.assign']);
  const targetUserId = canViewOtherSessions ? (userId as string | undefined) : req.user?.id;

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (targetUserId) {
    conditions.push(`rt.user_id = $${paramIndex}`);
    params.push(targetUserId);
    paramIndex++;
  }

  // 'all' (or undefined) → no filter; 'true' → active (not expired AND not
  // revoked); 'false' → expired OR revoked.
  if (isActive === 'true') {
    conditions.push(`(rt.expires_at > CURRENT_TIMESTAMP AND rt.revoked_at IS NULL)`);
  } else if (isActive === 'false') {
    conditions.push(`(rt.expires_at <= CURRENT_TIMESTAMP OR rt.revoked_at IS NOT NULL)`);
  }

  if (search && typeof search === 'string') {
    conditions.push(
      `(COALESCE(u.name, '') ILIKE $${paramIndex} OR COALESCE(u.username, '') ILIKE $${paramIndex} OR COALESCE(rt.ip_address, '') ILIKE $${paramIndex})`
    );
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (typeof createdFrom === 'string' && createdFrom) {
    conditions.push(`rt.created_at >= $${paramIndex}`);
    params.push(createdFrom);
    paramIndex++;
  }
  if (typeof createdTo === 'string' && createdTo) {
    conditions.push(`rt.created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
    params.push(createdTo);
    paramIndex++;
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    queryParams: params,
    nextParamIndex: paramIndex,
  };
};
