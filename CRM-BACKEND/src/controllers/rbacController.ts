import type { Response } from 'express';
import { query, withTransaction } from '@/config/database';
import {
  LEGACY_RBAC_ROLE_NAMES,
  RBAC_ROLE_CANONICALIZE_SQL_CASE,
  isCanonicalRbacRoleName,
  normalizeRbacRoleName,
} from '@/constants/rbacRoles';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { emitPermissionsUpdated, getSocketIO } from '@/websocket/server';

const ROUTE_KEYS = [
  'mobile-app',
  'dashboard',
  'cases',
  'task-board',
  'visit-execution',
  'review-qc',
  'reports',
  'billing',
  'commission',
  'users',
  'clients',
  'products',
  'territory-mapping',
  'settings',
] as const;

export const getPermissionCatalog = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, code, module, description
       FROM permissions
       ORDER BY module, code`
    );
    res.json({ success: true, data: result.rows });
  } catch (_error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch permissions',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const getRbacRoles = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT
         r.id,
         r.name,
         r.description,
         r.parent_role_id as "parentRoleId",
         pr.name as "parentRoleName",
         r.is_system as "isSystem",
         r.created_at as created_at,
         r.updated_at as updated_at,
         COALESCE(uc."userCount", 0)::int as "userCount"
       FROM roles_v2 r
       LEFT JOIN roles_v2 pr ON pr.id = r.parent_role_id
       LEFT JOIN (
         SELECT
           ${RBAC_ROLE_CANONICALIZE_SQL_CASE} as name,
           COUNT(DISTINCT ur.user_id)::int as "userCount"
         FROM user_roles ur
         JOIN roles_v2 rv ON rv.id = ur.role_id
         GROUP BY 1
       ) uc ON uc.name = r.name
       WHERE r.name <> ALL($1::text[])
       ORDER BY r.name`,
      [[...LEGACY_RBAC_ROLE_NAMES]]
    );
    res.json({ success: true, data: result.rows });
  } catch (_error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch RBAC roles',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const getRbacRoleById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT
         r.id,
         r.name,
         r.description,
         r.parent_role_id as "parentRoleId",
         pr.name as "parentRoleName",
         r.is_system as "isSystem",
         r.created_at as created_at,
         r.updated_at as updated_at,
         COALESCE(uc."userCount", 0)::int as "userCount"
       FROM roles_v2 r
       LEFT JOIN roles_v2 pr ON pr.id = r.parent_role_id
       LEFT JOIN (
         SELECT
           ${RBAC_ROLE_CANONICALIZE_SQL_CASE} as name,
           COUNT(DISTINCT ur.user_id)::int as "userCount"
         FROM user_roles ur
         JOIN roles_v2 rv ON rv.id = ur.role_id
         GROUP BY 1
       ) uc ON uc.name = r.name
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Role not found', error: { code: 'ROLE_NOT_FOUND' } });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (_error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch RBAC role',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const createRbacRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, parentRoleId } = req.body as {
      name?: string;
      description?: string;
      parentRoleId?: string | null;
    };

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Role name is required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }
    const trimmedName = name.trim();
    const canonicalName = normalizeRbacRoleName(trimmedName);
    if (canonicalName && !isCanonicalRbacRoleName(trimmedName)) {
      return res.status(400).json({
        success: false,
        message: `Legacy role "${trimmedName}" is not allowed. Use "${canonicalName}" instead.`,
        error: { code: 'LEGACY_ROLE_ALIAS_FORBIDDEN' },
      });
    }

    const role = await withTransaction(async client => {
      const finalRoleName = canonicalName ?? trimmedName;
      const exists = await client.query('SELECT id FROM roles_v2 WHERE name = $1', [finalRoleName]);
      if (exists.rows.length > 0) {
        const err = new Error('DUPLICATE_ROLE');
        (err as Error & { code?: string }).code = 'DUPLICATE_ROLE';
        throw err;
      }

      const insert = await client.query(
        `INSERT INTO roles_v2 (name, description, parent_role_id, is_system)
         VALUES ($1, $2, $3, false)
         RETURNING id, name, description, parent_role_id as "parent_role_id", is_system as "is_system"`,
        [finalRoleName, description?.trim() || null, parentRoleId || null]
      );
      const created = insert.rows[0];

      if (parentRoleId) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id, allowed)
           SELECT $1, rp.permission_id, rp.allowed
           FROM role_permissions rp
           WHERE rp.role_id = $2
           ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = EXCLUDED.allowed`,
          [created.id, parentRoleId]
        );
        await client.query(
          `INSERT INTO role_routes (role_id, route_key, allowed)
           SELECT $1, rr.route_key, rr.allowed
           FROM role_routes rr
           WHERE rr.role_id = $2
           ON CONFLICT (role_id, route_key) DO UPDATE SET allowed = EXCLUDED.allowed`,
          [created.id, parentRoleId]
        );
      }

      return created;
    });

    res.status(201).json({ success: true, data: role, message: 'RBAC role created successfully' });
  } catch (_error) {
    if ((_error as { code?: string }).code === 'DUPLICATE_ROLE') {
      return res.status(400).json({
        success: false,
        message: 'Role name already exists',
        error: { code: 'DUPLICATE_ROLE' },
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create role',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const updateRbacRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, parentRoleId } = req.body as {
      name?: string;
      description?: string;
      parentRoleId?: string | null;
    };
    const trimmedName = typeof name === 'string' ? name.trim() : undefined;
    const canonicalName = normalizeRbacRoleName(trimmedName);
    if (trimmedName && canonicalName && !isCanonicalRbacRoleName(trimmedName)) {
      return res.status(400).json({
        success: false,
        message: `Legacy role "${trimmedName}" is not allowed. Use "${canonicalName}" instead.`,
        error: { code: 'LEGACY_ROLE_ALIAS_FORBIDDEN' },
      });
    }

    const result = await query(
      `UPDATE roles_v2
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           parent_role_id = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, name, description, parent_role_id as "parent_role_id", is_system as "is_system"`,
      [
        (canonicalName ?? trimmedName) || null,
        description !== undefined ? description : null,
        parentRoleId ?? null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Role not found', error: { code: 'ROLE_NOT_FOUND' } });
    }

    res.json({ success: true, data: result.rows[0], message: 'RBAC role updated successfully' });
  } catch (_error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update role',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const deleteRbacRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const roleRes = await query(
      `SELECT r.*, (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id)::int as "user_count"
       FROM roles_v2 r WHERE r.id = $1`,
      [id]
    );
    const role = roleRes.rows[0];
    if (!role) {
      return res
        .status(404)
        .json({ success: false, message: 'Role not found', error: { code: 'ROLE_NOT_FOUND' } });
    }
    if (role.isSystem) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete system role',
        error: { code: 'SYSTEM_ROLE_DELETE_FORBIDDEN' },
      });
    }
    if (Number(role.userCount) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete role with assigned users',
        error: { code: 'ROLE_HAS_USERS' },
      });
    }

    await query('DELETE FROM roles_v2 WHERE id = $1', [id]);
    res.json({ success: true, message: 'RBAC role deleted successfully' });
  } catch (_error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete role',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const getRolePermissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT p.code, p.module, p.description, COALESCE(rp.allowed, false) as allowed
       FROM permissions p
       LEFT JOIN role_permissions rp
         ON rp.permission_id = p.id
        AND rp.role_id = $1
       ORDER BY p.module, p.code`,
      [id]
    );
    res.json({
      success: true,
      data: {
        roleId: id,
        permissions: result.rows.filter(r => r.allowed).map(r => r.code),
        matrix: result.rows,
      },
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch role permissions',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const updateRolePermissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const permissionCodes = Array.isArray(req.body?.permissionCodes)
      ? (req.body.permissionCodes as string[])
      : [];
    const affectedUsersRes = await query<{ userId: string }>(
      'SELECT DISTINCT user_id FROM user_roles WHERE role_id = $1',
      [id]
    );

    await withTransaction(async client => {
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [id]);
      if (permissionCodes.length > 0) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id, allowed)
           SELECT $1, p.id, true
           FROM permissions p
           WHERE p.code = ANY($2::varchar[])`,
          [id, permissionCodes]
        );
      }
    });

    const io = getSocketIO();
    if (io) {
      emitPermissionsUpdated(
        io,
        affectedUsersRes.rows.map(row => row.userId)
      );
    }

    res.json({ success: true, message: 'Role permissions updated successfully' });
  } catch (_error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update role permissions',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const getRoleRoutes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT rr.route_key as "route_key", rr.allowed
       FROM role_routes rr
       WHERE rr.role_id = $1`,
      [id]
    );
    const map = new Map<string, boolean>();
    for (const key of ROUTE_KEYS) {
      map.set(key, false);
    }
    for (const row of result.rows) {
      map.set(row.routeKey, !!row.allowed);
    }

    res.json({
      success: true,
      data: {
        roleId: id,
        routes: Array.from(map.entries()).map(([routeKey, allowed]) => ({ routeKey, allowed })),
      },
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch role routes',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const updateRoleRoutes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const routeEntries = Array.isArray(req.body?.routes)
      ? (req.body.routes as Array<{ routeKey: string; allowed: boolean }>)
      : [];
    const affectedUsersRes = await query<{ userId: string }>(
      'SELECT DISTINCT user_id FROM user_roles WHERE role_id = $1',
      [id]
    );

    await withTransaction(async client => {
      await client.query('DELETE FROM role_routes WHERE role_id = $1', [id]);
      for (const entry of routeEntries) {
        if (!entry.routeKey) {
          continue;
        }
        await client.query(
          `INSERT INTO role_routes (role_id, route_key, allowed) VALUES ($1, $2, $3)`,
          [id, entry.routeKey, !!entry.allowed]
        );
      }
    });

    const io = getSocketIO();
    if (io) {
      emitPermissionsUpdated(
        io,
        affectedUsersRes.rows.map(row => row.userId)
      );
    }

    res.json({ success: true, message: 'Role routes updated successfully' });
  } catch (_error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update role routes',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
