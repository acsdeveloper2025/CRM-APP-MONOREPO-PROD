import type { AuthenticatedRequest } from '../../middleware/auth';

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
