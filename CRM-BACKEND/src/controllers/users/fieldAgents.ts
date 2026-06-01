import type { Response } from 'express';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import { logger } from '@/config/logger';

export const getAvailableFieldAgents = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pincodeId, areaId } = req.query;

    if (!pincodeId) {
      return res.status(400).json({
        success: false,
        message: 'pincodeId is required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    let sql: string;
    let params: (string | number)[];

    if (areaId) {
      // Filter by both pincode AND area
      sql = `
        SELECT DISTINCT
          u.id,
          u.name,
          u.email,
          u.employee_id
        FROM users u
        INNER JOIN user_pincode_assignments upa
          ON u.id = upa.user_id
          AND upa.pincode_id = $1
          AND upa.is_active = true
        INNER JOIN user_area_assignments uaa
          ON u.id = uaa.user_id
          AND uaa.pincode_id = $1
          AND uaa.area_id = $2
          AND uaa.is_active = true
        WHERE EXISTS (
          SELECT 1
          FROM user_roles urf
          JOIN role_permissions rpf ON rpf.role_id = urf.role_id AND rpf.allowed = true
          JOIN permissions pf ON pf.id = rpf.permission_id
          WHERE urf.user_id = u.id AND pf.code = 'visit.submit'
        )
          AND u.is_active = true
        ORDER BY u.name
      `;
      params = [Number(pincodeId), Number(areaId)];
    } else {
      // Filter by pincode only
      sql = `
        SELECT DISTINCT
          u.id,
          u.name,
          u.email,
          u.employee_id
        FROM users u
        INNER JOIN user_pincode_assignments upa
          ON u.id = upa.user_id
          AND upa.pincode_id = $1
          AND upa.is_active = true
        WHERE EXISTS (
          SELECT 1
          FROM user_roles urf
          JOIN role_permissions rpf ON rpf.role_id = urf.role_id AND rpf.allowed = true
          JOIN permissions pf ON pf.id = rpf.permission_id
          WHERE urf.user_id = u.id AND pf.code = 'visit.submit'
        )
          AND u.is_active = true
        ORDER BY u.name
      `;
      params = [Number(pincodeId)];
    }

    const result = await query(sql, params);

    logger.info(`Retrieved ${result.rows.length} available field agents`, {
      userId: req.user?.id,
      pincodeId,
      areaId,
      count: result.rows.length,
    });

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching available field agents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch field agents',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const getAssignableUsersByRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';

    // Strict allow-list: only roles that legitimately receive case-time
    // assignments. Prevents the endpoint from leaking arbitrary user
    // lists by passing `?role=ADMIN` etc.
    const ASSIGNABLE_ROLES = new Set([
      'KYC_VERIFIER',
      'FIELD_AGENT',
      'BACKEND_USER',
      'TEAM_LEADER',
      'MANAGER',
    ]);

    if (!role || !ASSIGNABLE_ROLES.has(role)) {
      return res.status(400).json({
        success: false,
        message: 'A valid role query parameter is required',
        error: {
          code: 'INVALID_ROLE',
          allowedRoles: Array.from(ASSIGNABLE_ROLES),
        },
      });
    }

    // Roles live in `roles_v2` (column `name`); the legacy `roles` table
    // was dropped. user_roles.role_id → roles_v2.id.
    const result = await query<{
      id: string;
      name: string;
      email: string | null;
      employeeId: string | null;
    }>(
      `
        SELECT
          u.id,
          u.name,
          u.email,
          u.employee_id as "employeeId"
        FROM users u
        WHERE u.is_active = true
          AND EXISTS (
            SELECT 1
            FROM user_roles ur
            JOIN roles_v2 r ON r.id = ur.role_id
            WHERE ur.user_id = u.id
              AND r.name = $1
          )
        ORDER BY u.name
      `,
      [role]
    );

    return res.json({
      success: true,
      data: result.rows,
      message: 'Assignable users retrieved successfully',
    });
  } catch (error) {
    logger.error('Get assignable users by role error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch assignable users',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
