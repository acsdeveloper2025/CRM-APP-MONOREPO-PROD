import type { PoolClient } from 'pg';
import { query } from '@/config/database';
import { normalizeRbacRoleName } from '@/constants/rbacRoles';

type Queryable = Pick<PoolClient, 'query'>;

export type UserHierarchyScope = {
  userIds: string[];
  scopeRole?: 'MANAGER' | 'TEAM_LEADER';
};

type ScopeUserRow = {
  id: string;
  teamLeaderId: string | null;
  managerId: string | null;
  roles: string[] | null;
  role: string | null;
};

const loadScopeUser = async (userId: string, db?: Queryable): Promise<ScopeUserRow | null> => {
  const executor = db ?? { query };
  const result = await executor.query<ScopeUserRow>(
    `
      SELECT
        u.id,
        u.team_leader_id as "teamLeaderId",
        u.manager_id as "managerId",
        COALESCE((
          SELECT ARRAY_AGG(rv.name ORDER BY rv.name)
          FROM user_roles ur
          JOIN roles_v2 rv ON rv.id = ur.role_id
          WHERE ur.user_id = u.id
        ), ARRAY[]::text[]) as roles,
        u.role
      FROM users u
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] ?? null;
};

const resolveCanonicalRole = (user: ScopeUserRow): string | undefined => {
  const roleSet = new Set((user.roles || []).map(role => normalizeRbacRoleName(role) ?? role));
  if (roleSet.has('SUPER_ADMIN')) {
    return 'SUPER_ADMIN';
  }
  if (roleSet.has('MANAGER')) {
    return 'MANAGER';
  }
  if (roleSet.has('TEAM_LEADER')) {
    return 'TEAM_LEADER';
  }
  if (roleSet.has('BACKEND_USER')) {
    return 'BACKEND_USER';
  }
  if (roleSet.has('FIELD_AGENT')) {
    return 'FIELD_AGENT';
  }
  return normalizeRbacRoleName(user.role) ?? user.role ?? undefined;
};

export const getUserScope = async (userId: string, db?: Queryable): Promise<UserHierarchyScope> => {
  const executor = db ?? { query };
  const user = await loadScopeUser(userId, db);
  if (!user) {
    return { userIds: [] };
  }

  const role = resolveCanonicalRole(user);

  if (role === 'TEAM_LEADER') {
    const result = await executor.query<{ id: string }>(
      `
        SELECT u.id
        FROM users u
        WHERE u."deletedAt" IS NULL
          AND u.team_leader_id = $1
      `,
      [userId]
    );
    return {
      userIds: result.rows.map(row => row.id),
      scopeRole: 'TEAM_LEADER',
    };
  }

  if (role === 'MANAGER') {
    const result = await executor.query<{ id: string }>(
      `
        WITH RECURSIVE scoped_users AS (
          SELECT u.id
          FROM users u
          WHERE u."deletedAt" IS NULL
            AND u.manager_id = $1
          UNION
          SELECT child.id
          FROM users child
          JOIN scoped_users parent_scope ON child.manager_id = parent_scope.id
          WHERE child."deletedAt" IS NULL
        )
        SELECT DISTINCT id
        FROM scoped_users
      `,
      [userId]
    );

    return {
      userIds: result.rows.map(row => row.id),
      scopeRole: 'MANAGER',
    };
  }

  return { userIds: [] };
};

export const getScopedOperationalUserIds = async (
  userId: string,
  db?: Queryable
): Promise<string[] | undefined> => {
  const scope = await getUserScope(userId, db);
  return scope.scopeRole ? scope.userIds : undefined;
};
