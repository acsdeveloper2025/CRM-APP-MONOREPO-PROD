import type { PoolClient } from 'pg';
import { query } from '@/config/database';
import {
  deriveCapabilitiesFromPermissionCodes,
  type PermissionCapabilityFlags,
} from '@/security/rbacAccess';

type Queryable = Pick<PoolClient, 'query'>;

export type UserCapabilityProfile = {
  id: string;
  isActive: boolean;
  teamLeaderId: string | null;
  managerId: string | null;
  permissionCodes: string[];
  capabilities: PermissionCapabilityFlags;
};

type UserCapabilityRow = {
  id: string;
  isActive: boolean;
  teamLeaderId: string | null;
  managerId: string | null;
  permissionCodes: string[] | null;
};

export const loadUserCapabilityProfile = async (
  userId: string,
  db?: Queryable
): Promise<UserCapabilityProfile | null> => {
  const executor = db ?? { query };
  const result = await executor.query<UserCapabilityRow>(
    `
      SELECT
        u.id,
        u.is_active as "is_active",
        u.team_leader_id as "team_leader_id",
        u.manager_id as "manager_id",
        COALESCE((
          SELECT ARRAY_AGG(DISTINCT p.code ORDER BY p.code)
          FROM user_roles ur
          JOIN role_permissions rp ON rp.role_id = ur.role_id AND rp.allowed = true
          JOIN permissions p ON p.id = rp.permission_id
          WHERE ur.user_id = u.id
        ), ARRAY[]::varchar[]) as "permission_codes"
      FROM users u
      WHERE u.id = $1
        AND u.deleted_at IS NULL
      LIMIT 1
    `,
    [userId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const permissionCodes = row.permissionCodes || [];
  return {
    id: row.id,
    isActive: row.isActive,
    teamLeaderId: row.teamLeaderId ?? null,
    managerId: row.managerId ?? null,
    permissionCodes,
    capabilities: deriveCapabilitiesFromPermissionCodes(permissionCodes),
  };
};

export const isExecutionEligibleUser = (
  profile: Pick<UserCapabilityProfile, 'isActive' | 'capabilities'>
): boolean => profile.isActive && profile.capabilities.executionActor;

export const loadExecutionEligibleUser = async (
  userId: string,
  db?: Queryable
): Promise<UserCapabilityProfile | null> => {
  const profile = await loadUserCapabilityProfile(userId, db);
  if (!profile || !isExecutionEligibleUser(profile)) {
    return null;
  }
  return profile;
};
