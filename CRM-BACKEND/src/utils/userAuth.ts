import { query } from '@/config/database';
import { createError } from '@/middleware/errorHandler';
import { createAuditLog } from '@/utils/auditLogger';

/**
 * Utility functions for universal UUID-based authentication
 * This module handles UUID authentication for ALL user roles
 * accessing the CaseFlow mobile application and web interface.
 */

export interface UserAuthInfo {
  id: string;
  username: string;
  name: string;
  authUuid: string;
  isActive: boolean;
  role: string;
  roleName?: string;
}

const PRIMARY_ROLE_NAME_SQL = `
  COALESCE(
    (SELECT rv.name FROM user_roles ur JOIN roles_v2 rv ON rv.id = ur.role_id WHERE ur.user_id = u.id ORDER BY rv.name LIMIT 1),
    'UNASSIGNED'
  )
`;

/**
 * Generate a new authUuid for any user role
 * Works for all user types without role restrictions
 */
export const generateUserAuthUuid = async (
  userId: string,
  adminUserId?: string
): Promise<string> => {
  // Get user information (no role restrictions)
  const userRes = await query(
    `SELECT u.id, u.username,
            ${PRIMARY_ROLE_NAME_SQL} as role,
            ${PRIMARY_ROLE_NAME_SQL} as role_name
     FROM users u
     WHERE u.id = $1`,
    [userId]
  );

  const user = userRes.rows[0];
  if (!user) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Generate new UUID and update the user (no role restrictions)
  const newAuthUuid = await query(
    `UPDATE users
     SET auth_uuid = gen_random_uuid(), updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING auth_uuid`,
    [userId]
  );

  if (newAuthUuid.rows.length === 0) {
    throw createError('Failed to generate auth UUID', 500, 'UUID_GENERATION_FAILED');
  }

  const authUuid = newAuthUuid.rows[0].authUuid;

  // Audit the UUID generation
  await createAuditLog({
    action: 'USER_UUID_GENERATED',
    entityType: 'USER',
    entityId: userId,
    userId: adminUserId,
    details: {
      username: user.username,
      role: user.role,
      roleName: user.roleName,
      generatedBy: adminUserId ? 'ADMIN' : 'SYSTEM',
    },
  });

  return authUuid;
};

/**
 * Revoke authUuid for any user (set to null)
 * This effectively disables UUID authentication for the user
 */
export const revokeUserAuthUuid = async (userId: string, adminUserId?: string): Promise<void> => {
  // Get user information (no role restrictions)
  const userRes = await query(
    `SELECT u.id, u.username,
            ${PRIMARY_ROLE_NAME_SQL} as role,
            ${PRIMARY_ROLE_NAME_SQL} as role_name
     FROM users u
     WHERE u.id = $1`,
    [userId]
  );

  const user = userRes.rows[0];
  if (!user) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Revoke the authUuid (no role restrictions)
  const result = await query(
    `UPDATE users
     SET auth_uuid = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw createError('Failed to revoke auth UUID', 500, 'UUID_REVOCATION_FAILED');
  }

  // Audit the UUID revocation
  await createAuditLog({
    action: 'USER_UUID_REVOKED',
    entityType: 'USER',
    entityId: userId,
    userId: adminUserId,
    details: {
      username: user.username,
      role: user.role,
      roleName: user.roleName,
      revokedBy: adminUserId ? 'ADMIN' : 'SYSTEM',
    },
  });
};

/**
 * Get user authentication information by user ID
 */
export const getUserAuthInfo = async (userId: string): Promise<UserAuthInfo | null> => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.name, u.auth_uuid, u.is_active,
              ${PRIMARY_ROLE_NAME_SQL} as role,
              ${PRIMARY_ROLE_NAME_SQL} as role_name
       FROM users u
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      authUuid: user.authUuid,
      isActive: user.isActive,
      role: user.role,
      roleName: user.roleName,
    };
  } catch (_error) {
    return null;
  }
};

/**
 * Validate if an authUuid belongs to an active user (any role)
 */
export const validateUserAuthUuid = async (authUuid: string): Promise<boolean> => {
  try {
    const result = await query(
      `SELECT u.id
       FROM users u
       WHERE u.auth_uuid = $1 AND u.is_active = true`,
      [authUuid]
    );

    return result.rows.length > 0;
  } catch (_error) {
    return false;
  }
};

/**
 * Get user by authUuid (any role)
 */
export const getUserByAuthUuid = async (authUuid: string): Promise<UserAuthInfo | null> => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.name, u.auth_uuid, u.is_active,
              ${PRIMARY_ROLE_NAME_SQL} as role,
              ${PRIMARY_ROLE_NAME_SQL} as role_name
       FROM users u
       WHERE u.auth_uuid = $1`,
      [authUuid]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      authUuid: user.authUuid,
      isActive: user.isActive,
      role: user.role,
      roleName: user.roleName,
    };
  } catch (_error) {
    return null;
  }
};

// Legacy exports for backward compatibility (DEPRECATED)
export const generateFieldAgentAuthUuid = generateUserAuthUuid;
export const revokeFieldAgentAuthUuid = revokeUserAuthUuid;
export const getFieldAgentAuthInfo = getUserAuthInfo;
export const validateFieldAgentAuthUuid = validateUserAuthUuid;
export type FieldAgentAuthInfo = UserAuthInfo;
