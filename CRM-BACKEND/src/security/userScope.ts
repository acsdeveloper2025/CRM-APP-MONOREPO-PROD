import type { PoolClient } from 'pg';
import { query } from '@/config/database';
import { loadUserCapabilityProfile } from '@/security/userCapabilities';

type Queryable = Pick<PoolClient, 'query'>;

export type UserHierarchyScope = {
  userIds: string[];
  scopeRole?: 'SYSTEM' | 'MANAGER' | 'TEAM_LEADER';
};

type ScopeUserRow = {
  id: string;
  teamLeaderId: string | null;
  managerId: string | null;
};

const loadScopeUser = async (userId: string, db?: Queryable): Promise<ScopeUserRow | null> => {
  const executor = db ?? { query };
  const result = await executor.query<ScopeUserRow>(
    `
      SELECT
        u.id,
        u.team_leader_id as "team_leader_id",
        u.manager_id as "manager_id"
      FROM users u
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] ?? null;
};

export const getSubordinateUsers = async (
  userId: string,
  db?: Queryable
): Promise<{ teamMemberIds: string[]; managedTreeIds: string[] }> => {
  const executor = db ?? { query };
  const [teamMembers, managedTree] = await Promise.all([
    executor.query<{ id: string }>(
      `
        SELECT u.id
        FROM users u
        WHERE u.deleted_at IS NULL
          AND u.team_leader_id = $1
      `,
      [userId]
    ),
    executor.query<{ id: string }>(
      `
        WITH RECURSIVE managed_users AS (
          SELECT u.id
          FROM users u
          WHERE u.deleted_at IS NULL
            AND u.manager_id = $1
          UNION
          SELECT child.id
          FROM users child
          JOIN managed_users parent_scope ON child.manager_id = parent_scope.id
          WHERE child.deleted_at IS NULL
        )
        SELECT DISTINCT id
        FROM managed_users
      `,
      [userId]
    ),
  ]);

  return {
    teamMemberIds: teamMembers.rows.map(row => row.id),
    managedTreeIds: managedTree.rows.map(row => row.id),
  };
};

export const getSupervisingUsers = async (
  userId: string,
  db?: Queryable
): Promise<{ teamLeaderId: string | null; managerId: string | null }> => {
  const user = await loadScopeUser(userId, db);
  if (!user) {
    return { teamLeaderId: null, managerId: null };
  }
  return {
    teamLeaderId: user.teamLeaderId ?? null,
    managerId: user.managerId ?? null,
  };
};

export const getUserScope = async (userId: string, db?: Queryable): Promise<UserHierarchyScope> => {
  const [user, capabilityProfile, subordinates] = await Promise.all([
    loadScopeUser(userId, db),
    loadUserCapabilityProfile(userId, db),
    getSubordinateUsers(userId, db),
  ]);

  if (!user || !capabilityProfile) {
    return { userIds: [] };
  }

  // System-scope users (SUPER_ADMIN with settings.manage) see everything
  if (capabilityProfile.capabilities.systemScopeBypass) {
    return { userIds: [], scopeRole: 'SYSTEM' };
  }

  if (!capabilityProfile.capabilities.supervisoryOrGlobal) {
    return { userIds: [] };
  }

  const managedTreeIds = subordinates.managedTreeIds.filter(id => id !== userId);
  if (managedTreeIds.length > 0 && !user.teamLeaderId) {
    return {
      userIds: [userId, ...managedTreeIds],
      scopeRole: 'MANAGER',
    };
  }

  const teamMemberIds = subordinates.teamMemberIds.filter(id => id !== userId);
  if (teamMemberIds.length > 0 && user.managerId) {
    return {
      userIds: [userId, ...teamMemberIds],
      scopeRole: 'TEAM_LEADER',
    };
  }

  // User has supervisory permissions but no subordinates yet — still include self
  return { userIds: [userId] };
};

export const getScopedOperationalUserIds = async (
  userId: string,
  db?: Queryable
): Promise<string[] | undefined> => {
  const scope = await getUserScope(userId, db);
  // System scope (SUPER_ADMIN) sees everything — return undefined (no filter)
  if (scope.scopeRole === 'SYSTEM') {
    return undefined;
  }
  // Return user IDs if any scope was resolved (including self-only for supervisory users)
  return scope.userIds.length > 0 ? scope.userIds : undefined;
};
