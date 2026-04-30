import type { Response } from 'express';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import type { QueryParams } from '@/types/database';
import { isExecutionEligibleUser, loadUserCapabilityProfile } from '@/security/userCapabilities';

const getSingleParam = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  return Array.isArray(value) ? value[0] : undefined;
};

// GET /api/territory-assignments/field-agents - List all field agents with their territory assignments
export const getFieldAgentTerritories = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      pincodeId,
      cityId,
      isActive = 'true',
      sortBy = 'userName',
      sortOrder = 'asc',
    } = req.query;

    // Build the WHERE clause
    const conditions: string[] = [
      `EXISTS (
        SELECT 1
        FROM user_roles urf
        JOIN role_permissions rpf ON rpf.role_id = urf.role_id AND rpf.allowed = true
        JOIN permissions pf ON pf.id = rpf.permission_id
        WHERE urf.user_id = u.id AND pf.code = 'visit.submit'
      )`,
    ];
    const params: QueryParams = [];
    let paramIndex = 1;

    if (search && typeof search === 'string') {
      conditions.push(
        `(u.name ILIKE $${paramIndex} OR u.username ILIKE $${paramIndex} OR u.employee_id ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (pincodeId && typeof pincodeId === 'string') {
      // Support both numeric pincode ID and string pincode code
      const pincodeStr = pincodeId;
      const isNumericId = /^\d+$/.test(pincodeStr) && Number(pincodeStr) < 10000;
      if (isNumericId) {
        conditions.push(`upa.pincode_id = $${paramIndex}`);
        params.push(Number(pincodeStr));
      } else {
        conditions.push(`p.code = $${paramIndex}`);
        params.push(pincodeStr);
      }
      paramIndex++;
    }

    if (cityId) {
      conditions.push(`c.id = $${paramIndex}`);
      params.push(cityId as string);
      paramIndex++;
    }

    if (isActive !== undefined) {
      conditions.push(`upa.is_active = $${paramIndex}`);
      params.push(isActive === 'true');
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countSql = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      LEFT JOIN user_pincode_assignments upa ON u.id = upa.user_id
      LEFT JOIN pincodes p ON upa.pincode_id = p.id
      LEFT JOIN cities c ON p.city_id = c.id
      ${whereClause}
    `;

    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0].total);

    // Calculate pagination
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    // Get field agents with territory assignments using the view
    const sql = `
      SELECT
        u.id as user_id,
        u.name as user_name,
        u.username,
        u.employee_id,
        u.is_active as "userIsActive",
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'pincodeAssignmentId', upa.id,
              'pincodeId', upa.pincode_id,
              'pincodeCode', p.code,
              'cityName', c.name,
              'stateName', s.name,
              'countryName', co.name,
              'assignedAreas', COALESCE(area_agg.areas, '[]'::json),
              'pincodeAssignedAt', upa.assigned_at,
              'isActive', upa.is_active
            ) ORDER BY p.code
          ) FILTER (WHERE upa.pincode_id IS NOT NULL),
          '[]'::json
        ) as "territoryAssignments"
      FROM users u
      LEFT JOIN user_pincode_assignments upa ON u.id = upa.user_id AND upa.is_active = true
      LEFT JOIN pincodes p ON upa.pincode_id = p.id
      LEFT JOIN cities c ON p.city_id = c.id
      LEFT JOIN states s ON c.state_id = s.id
      LEFT JOIN countries co ON c.country_id = co.id
      LEFT JOIN (
        SELECT
          uaa.user_id,
          uaa.pincode_id,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'areaAssignmentId', uaa.id,
              'areaId', uaa.area_id,
              'areaName', a.name,
              'assignedAt', uaa.assigned_at
            )
          ) as areas
        FROM user_area_assignments uaa
        LEFT JOIN areas a ON uaa.area_id = a.id
        WHERE uaa.is_active = true
        GROUP BY uaa.user_id, uaa.pincode_id
      ) area_agg ON upa.user_id = area_agg.user_id AND upa.pincode_id = area_agg.pincode_id
      ${whereClause}
      GROUP BY u.id, u.name, u.username, u.employee_id, u.is_active
      ORDER BY ${(() => {
        const sortColumnMap: Record<string, string> = {
          userName: 'u.name',
          username: 'u.username',
          employeeId: 'u.employee_id',
          isActive: 'u.is_active',
        };
        return sortColumnMap[typeof sortBy === 'string' ? sortBy : ''] || 'u.name';
      })()} ${typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC'}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limitNum, offset);
    const result = await query(sql, params);

    logger.info(`Retrieved ${result.rows.length} field agents with territories`, {
      userId: req.user?.id,
      page: pageNum,
      limit: limitNum,
      total,
      filters: { search, pincodeId, cityId, isActive },
    });

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Error retrieving field agent territories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve field agent territories',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/territory-assignments/field-agents/:userId - Get specific field agent's territory assignments
export const getFieldAgentTerritoryById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getSingleParam(req.params.userId);
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
        error: { code: 'INVALID_INPUT' },
      });
    }

    // Verify user exists and is execution-eligible.
    // 2026-04-28 F1.1.1: derive `role` from RBAC (user_roles → roles_v2)
    // because the `users.role` text column was dropped. Mirrors the
    // PRIMARY_ROLE_NAME_SQL pattern in `utils/userAuth.ts`.
    const userCheck = await query(
      `SELECT
         u.id,
         u.name,
         u.username,
         u.employee_id,
         COALESCE(
           (SELECT rv.name FROM user_roles ur
            JOIN roles_v2 rv ON rv.id = ur.role_id
            WHERE ur.user_id = u.id
            ORDER BY rv.name LIMIT 1),
           'UNASSIGNED'
         ) as role
       FROM users u
       WHERE u.id = $1`,
      [userId]
    );
    const userProfile = await loadUserCapabilityProfile(userId);

    if (userCheck.rows.length === 0 || !userProfile) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const user = userCheck.rows[0];
    if (!isExecutionEligibleUser(userProfile)) {
      return res.status(400).json({
        success: false,
        message: 'User is not execution-eligible',
        error: { code: 'INVALID_USER_ROLE' },
      });
    }

    // Get territory assignments using the view
    const sql = `
      SELECT 
        user_id,
        user_name,
        "username",
        employee_id,
        pincode_assignment_id,
        pincode_id,
        pincode_code,
        city_name,
        state_name,
        country_name,
        assigned_areas,
        pincode_assigned_at,
        assigned_by,
        is_active
      FROM field_agent_territories
      WHERE user_id = $1
      ORDER BY pincode_code
    `;

    const result = await query(sql, [userId]);

    logger.info(`Retrieved territory assignments for field agent ${userId}`, {
      userId: req.user?.id,
      targetUserId: userId,
      assignmentCount: result.rows.length,
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          employeeId: user.employeeId,
          role: user.role,
        },
        territoryAssignments: result.rows,
      },
    });
  } catch (error) {
    logger.error('Error retrieving field agent territory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve field agent territory',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/territory-assignments/field-agents/:userId/pincodes - Assign pincodes to field agent
export const assignPincodesToFieldAgent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getSingleParam(req.params.userId);
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
        error: { code: 'INVALID_INPUT' },
      });
    }
    const { pincodeIds } = req.body;

    // Validate authentication - assignedBy field is required and must reference a valid user
    const authenticatedUserId = req.user?.id;
    if (!authenticatedUserId) {
      logger.error('Pincode assignment attempted without authentication', {
        userId,
        pincodeIds: pincodeIds?.length,
      });
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in and try again.',
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          details: 'User authentication is required to assign pincodes',
        },
      });
    }

    // Validate input - allow empty arrays for removing all assignments
    if (!Array.isArray(pincodeIds)) {
      return res.status(400).json({
        success: false,
        message: 'pincodeIds must be an array',
        error: { code: 'INVALID_INPUT' },
      });
    }

    // Verify user exists and is execution-eligible
    const userResult = await query('SELECT id, name, username FROM users WHERE id = $1', [userId]);
    const userProfile = await loadUserCapabilityProfile(userId);

    if (userResult.rows.length === 0 || !userProfile) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const _user = userResult.rows[0];
    if (!isExecutionEligibleUser(userProfile)) {
      return res.status(400).json({
        success: false,
        message: 'User is not execution-eligible',
        error: { code: 'INVALID_USER_ROLE' },
      });
    }

    // Verify all pincodes exist (only if pincodeIds is not empty)
    if (pincodeIds.length > 0) {
      const pincodeCheck = await query(`SELECT id, code FROM pincodes WHERE id = ANY($1)`, [
        pincodeIds,
      ]);

      if (pincodeCheck.rows.length !== pincodeIds.length) {
        const foundIds = pincodeCheck.rows.map(row => row.id);
        const missingIds = pincodeIds.filter(id => !foundIds.includes(parseInt(id)));
        return res.status(400).json({
          success: false,
          message: `Pincodes not found: ${missingIds.join(', ')}`,
          error: { code: 'INVALID_PINCODES' },
        });
      }
    }

    // Start transaction to replace all pincode assignments
    await query('BEGIN');

    try {
      // First, delete all existing area assignments for this user
      const deleteAreasResult = await query(
        'DELETE FROM user_area_assignments WHERE user_id = $1 RETURNING id',
        [userId]
      );
      const deletedAreasCount = deleteAreasResult.rows.length;

      // Delete all existing pincode assignments for this user
      const deletePincodesResult = await query(
        'DELETE FROM user_pincode_assignments WHERE user_id = $1 RETURNING id',
        [userId]
      );
      const deletedPincodesCount = deletePincodesResult.rows.length;

      let insertedCount = 0;

      // Then, insert new pincode assignments (only if pincodeIds is not empty)
      if (pincodeIds.length > 0) {
        // Use authenticated user ID (already validated above)
        const assignedBy = authenticatedUserId;

        // Use bulk INSERT for better performance
        const values = pincodeIds
          .map((pincodeId: number, index: number) => {
            const offset = index * 3;
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}, true)`;
          })
          .join(', ');

        const params = pincodeIds.flatMap((pincodeId: number) => [userId, pincodeId, assignedBy]);

        const result = await query(
          `INSERT INTO user_pincode_assignments (user_id, pincode_id, assigned_by, is_active)
           VALUES ${values}
           RETURNING id, pincode_id, assigned_at`,
          params
        );
        insertedCount = result.rows.length;
      }

      // Commit transaction
      await query('COMMIT');

      logger.info(`Replaced pincode assignments for field agent ${userId}`, {
        userId: req.user?.id,
        targetUserId: userId,
        pincodeIds,
        deletedPincodesCount,
        deletedAreasCount,
        insertedCount,
      });

      res.status(200).json({
        success: true,
        data: {
          userId,
          deletedPincodes: deletedPincodesCount,
          deletedAreas: deletedAreasCount,
          newPincodeAssignments: insertedCount,
          totalRequested: pincodeIds.length,
        },
        message: `Successfully updated pincode assignments for field agent`,
      });
    } catch (transactionError) {
      // Rollback transaction on error
      await query('ROLLBACK');
      throw transactionError;
    }
  } catch (error) {
    logger.error('Error updating pincode assignments for field agent:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      userId: req.params.userId,
      pincodeIdsCount: req.body.pincodeIds?.length,
      authenticatedUserId: req.user?.id,
    });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      message: 'Failed to update pincode assignments for field agent',
      error: {
        code: 'INTERNAL_ERROR',
        details: errorMessage,
      },
    });
  }
};

// POST /api/territory-assignments/field-agents/:userId/areas - Assign areas within pincodes to field agent
export const assignAreasToFieldAgent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getSingleParam(req.params.userId);
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
        error: { code: 'INVALID_INPUT' },
      });
    }
    const { assignments } = req.body; // Array of { pincodeId, areaIds }

    // Validate authentication - assignedBy field is required and must reference a valid user
    const authenticatedUserId = req.user?.id;
    if (!authenticatedUserId) {
      logger.error('Area assignment attempted without authentication', {
        userId,
        assignmentsCount: assignments?.length,
      });
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in and try again.',
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          details: 'User authentication is required to assign areas',
        },
      });
    }

    // Validate input - allow empty arrays for removing all area assignments
    if (!Array.isArray(assignments)) {
      return res.status(400).json({
        success: false,
        message: 'assignments must be an array of { pincodeId, areaIds }',
        error: { code: 'INVALID_INPUT' },
      });
    }

    // Verify user exists and is execution-eligible
    const userResult = await query('SELECT id, name, username FROM users WHERE id = $1', [userId]);
    const userProfile = await loadUserCapabilityProfile(userId);

    if (userResult.rows.length === 0 || !userProfile) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const _user = userResult.rows[0];
    if (!isExecutionEligibleUser(userProfile)) {
      return res.status(400).json({
        success: false,
        message: 'User is not execution-eligible',
        error: { code: 'INVALID_USER_ROLE' },
      });
    }

    // Use replace-all logic: first remove all existing area assignments, then add new ones

    // Step 1: Remove all existing area assignments for this user
    const removeResult = await query(
      `DELETE FROM user_area_assignments
       WHERE user_id = $1 AND is_active = true`,
      [userId]
    );

    const removedCount = removeResult.rowCount || 0;

    let totalAssigned = 0;
    let totalRequested = 0;
    const assignmentResults = [];

    // Step 2: Add new area assignments if any provided
    if (assignments.length > 0) {
      for (const assignment of assignments) {
        const { pincodeId, areaIds } = assignment;

        if (!Array.isArray(areaIds) || areaIds.length === 0) {
          continue;
        }

        totalRequested += areaIds.length;

        // Verify pincode assignment exists
        const pincodeAssignmentResult = await query(
          `SELECT id FROM user_pincode_assignments
           WHERE user_id = $1 AND pincode_id = $2 AND is_active = true`,
          [userId, pincodeId]
        );

        if (pincodeAssignmentResult.rows.length === 0) {
          assignmentResults.push({
            pincodeId,
            error: 'Field agent not assigned to this pincode',
            assigned: 0,
            requested: areaIds.length,
          });
          continue;
        }

        const userPincodeAssignmentId = pincodeAssignmentResult.rows[0].id;

        // Verify areas exist and belong to the pincode
        const areaCheck = await query(
          `SELECT a.id, a.name, pa.pincode_id
           FROM areas a
           JOIN pincode_areas pa ON a.id = pa.area_id
           WHERE a.id = ANY($1) AND pa.pincode_id = $2`,
          [areaIds, pincodeId]
        );

        const validAreaIds = areaCheck.rows.map(row => row.id);
        const invalidAreaIds = areaIds.filter(id => !validAreaIds.includes(parseInt(id)));

        if (invalidAreaIds.length > 0) {
          assignmentResults.push({
            pincodeId,
            error: `Invalid areas for pincode: ${invalidAreaIds.join(', ')}`,
            assigned: 0,
            requested: areaIds.length,
          });
          continue;
        }

        // Insert area assignments using bulk INSERT for better performance
        try {
          if (validAreaIds.length > 0) {
            const values = validAreaIds
              .map((areaId: number, index: number) => {
                const offset = index * 5;
                return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
              })
              .join(', ');

            const params = validAreaIds.flatMap((areaId: number) => [
              userId,
              pincodeId,
              areaId,
              userPincodeAssignmentId,
              authenticatedUserId,
            ]);

            const result = await query(
              `INSERT INTO user_area_assignments
               (user_id, pincode_id, area_id, user_pincode_assignment_id, assigned_by)
               VALUES ${values}
               RETURNING id, area_id`,
              params
            );

            const newAreaAssignments = result.rows;
            totalAssigned += newAreaAssignments.length;

            assignmentResults.push({
              pincodeId,
              assigned: newAreaAssignments.length,
              requested: areaIds.length,
              failed: 0,
            });
          }
        } catch (error) {
          logger.warn(`Failed to assign areas for pincode ${pincodeId} to user ${userId}:`, error);
          assignmentResults.push({
            pincodeId,
            assigned: 0,
            requested: areaIds.length,
            failed: areaIds.length,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    logger.info(`Updated area assignments for field agent ${userId}`, {
      userId: req.user?.id,
      targetUserId: userId,
      removedCount,
      totalAssigned,
      totalRequested,
      assignmentResults,
    });

    res.status(200).json({
      success: true,
      data: {
        userId,
        removedCount,
        totalAssigned,
        totalRequested,
        assignmentResults,
      },
      message: `Successfully updated area assignments: removed ${removedCount}, assigned ${totalAssigned}`,
    });
  } catch (error) {
    logger.error('Error assigning areas to field agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign areas to field agent',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/territory-assignments/field-agents/:userId/pincodes/:pincodeId - Remove pincode assignment
export const removePincodeAssignment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, pincodeId } = req.params;

    // Verify assignment exists
    const assignmentCheck = await query(
      `SELECT id FROM user_pincode_assignments
       WHERE user_id = $1 AND pincode_id = $2 AND is_active = true`,
      [userId, pincodeId]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pincode assignment not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Deactivate pincode assignment and all related area assignments
    await query('BEGIN');

    try {
      // Delete area assignments
      await query(
        `DELETE FROM user_area_assignments
         WHERE user_id = $1 AND pincode_id = $2 AND is_active = true`,
        [userId, pincodeId]
      );

      // Delete pincode assignment
      await query(
        `DELETE FROM user_pincode_assignments
         WHERE user_id = $1 AND pincode_id = $2 AND is_active = true`,
        [userId, pincodeId]
      );

      await query('COMMIT');

      logger.info(`Removed pincode assignment ${pincodeId} from field agent ${userId}`, {
        userId: req.user?.id,
        targetUserId: userId,
        pincodeId,
      });

      res.json({
        success: true,
        message: 'Pincode assignment removed successfully',
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Error removing pincode assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove pincode assignment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/territory-assignments/field-agents/:userId/areas/:areaId - Remove area assignment
export const removeAreaAssignment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, areaId } = req.params;
    const { pincodeId } = req.query;

    if (!pincodeId) {
      return res.status(400).json({
        success: false,
        message: 'pincodeId query parameter is required',
        error: { code: 'MISSING_PINCODE_ID' },
      });
    }

    // Verify assignment exists
    const assignmentCheck = await query(
      `SELECT id FROM user_area_assignments
       WHERE user_id = $1 AND area_id = $2 AND pincode_id = $3 AND is_active = true`,
      [userId, areaId, Number(pincodeId)]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Area assignment not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Delete area assignment
    await query(
      `DELETE FROM user_area_assignments
       WHERE user_id = $1 AND area_id = $2 AND pincode_id = $3 AND is_active = true`,
      [userId, areaId, Number(pincodeId)]
    );

    logger.info(`Removed area assignment ${areaId} from field agent ${userId}`, {
      userId: req.user?.id,
      targetUserId: userId,
      areaId,
      pincodeId,
    });

    res.json({
      success: true,
      message: 'Area assignment removed successfully',
    });
  } catch (error) {
    logger.error('Error removing area assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove area assignment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/territory-assignments/field-agents/:userId/add-pincode - Add single pincode with areas (incremental)
export const addSinglePincodeAssignment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getSingleParam(req.params.userId);
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
        error: { code: 'INVALID_INPUT' },
      });
    }
    const { pincodeId, areaIds = [] } = req.body;

    // Validate input
    if (!pincodeId || typeof pincodeId !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'pincodeId is required and must be a number',
        error: { code: 'INVALID_INPUT' },
      });
    }

    if (!Array.isArray(areaIds)) {
      return res.status(400).json({
        success: false,
        message: 'areaIds must be an array',
        error: { code: 'INVALID_INPUT' },
      });
    }

    // Verify user exists and is execution-eligible
    const userResult = await query('SELECT id, name, username FROM users WHERE id = $1', [userId]);
    const userProfile = await loadUserCapabilityProfile(userId);

    if (userResult.rows.length === 0 || !userProfile) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const user = userResult.rows[0];
    if (!isExecutionEligibleUser(userProfile)) {
      return res.status(400).json({
        success: false,
        message: 'User is not execution-eligible',
        error: { code: 'INVALID_USER_ROLE' },
      });
    }

    // Verify pincode exists
    const pincodeCheck = await query('SELECT id, code FROM pincodes WHERE id = $1', [pincodeId]);

    if (pincodeCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Pincode not found',
        error: { code: 'INVALID_PINCODE' },
      });
    }

    // Check if pincode is already assigned
    const existingAssignment = await query(
      'SELECT id FROM user_pincode_assignments WHERE user_id = $1 AND pincode_id = $2 AND is_active = true',
      [userId, pincodeId]
    );

    if (existingAssignment.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Pincode is already assigned to this user',
        error: { code: 'PINCODE_ALREADY_ASSIGNED' },
      });
    }

    // Verify all area IDs exist (if provided)
    if (areaIds.length > 0) {
      const areaCheck = await query('SELECT id FROM areas WHERE id = ANY($1)', [areaIds]);

      if (areaCheck.rows.length !== areaIds.length) {
        const foundIds = areaCheck.rows.map(row => row.id);
        const missingIds = areaIds.filter(id => !foundIds.includes(id));
        return res.status(400).json({
          success: false,
          message: `Areas not found: ${missingIds.join(', ')}`,
          error: { code: 'INVALID_AREAS' },
        });
      }
    }

    // Start transaction for incremental assignment
    await query('BEGIN');

    try {
      // Add pincode assignment
      const pincodeAssignmentResult = await query(
        `INSERT INTO user_pincode_assignments (user_id, pincode_id, assigned_by, is_active)
         VALUES ($1, $2, $3, true)
         RETURNING id`,
        [userId, pincodeId, req.user?.id]
      );

      // Add area assignments if provided
      let assignedAreasCount = 0;
      if (areaIds.length > 0) {
        const userPincodeAssignmentId = pincodeAssignmentResult.rows[0].id;

        for (const areaId of areaIds) {
          await query(
            `INSERT INTO user_area_assignments (user_id, pincode_id, area_id, user_pincode_assignment_id, assigned_by, is_active)
             VALUES ($1, $2, $3, $4, $5, true)`,
            [userId, pincodeId, areaId, userPincodeAssignmentId, req.user?.id]
          );
          assignedAreasCount++;
        }
      }

      // Commit transaction
      await query('COMMIT');

      logger.info(`Added single pincode assignment for field agent ${userId}`, {
        userId: req.user?.id,
        targetUserId: userId,
        targetUserName: user.name,
        pincodeId,
        pincodeCode: pincodeCheck.rows[0].code,
        assignedAreasCount,
        areaIds,
      });

      res.json({
        success: true,
        data: {
          userId,
          pincodeId,
          pincodeCode: pincodeCheck.rows[0].code,
          assignedAreas: assignedAreasCount,
          userName: user.name,
        },
        message: `Successfully assigned pincode ${pincodeCheck.rows[0].code} with ${assignedAreasCount} areas`,
      });
    } catch (transactionError) {
      // Rollback transaction on error
      await query('ROLLBACK');
      throw transactionError;
    }
  } catch (error) {
    logger.error('Error adding single pincode assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add pincode assignment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/territory-assignments/field-agents/:userId/all - Remove all territory assignments
export const removeAllTerritoryAssignments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getSingleParam(req.params.userId);
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
        error: { code: 'INVALID_INPUT' },
      });
    }

    // Verify user exists and is execution-eligible
    const userResult = await query('SELECT id, name, username FROM users WHERE id = $1', [userId]);
    const userProfile = await loadUserCapabilityProfile(userId);

    if (userResult.rows.length === 0 || !userProfile) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const user = userResult.rows[0];
    if (!isExecutionEligibleUser(userProfile)) {
      return res.status(400).json({
        success: false,
        message: 'User is not execution-eligible',
        error: { code: 'INVALID_USER_ROLE' },
      });
    }

    // Start transaction to remove all assignments
    await query('BEGIN');

    try {
      // Get current assignments for logging
      const currentAssignments = await query(
        `SELECT
          COUNT(DISTINCT upa.pincode_id) as pincode_count,
          COUNT(DISTINCT uaa.area_id) as area_count
         FROM user_pincode_assignments upa
         LEFT JOIN user_area_assignments uaa ON upa.user_id = uaa.user_id AND upa.pincode_id = uaa.pincode_id AND uaa.is_active = true
         WHERE upa.user_id = $1 AND upa.is_active = true`,
        [userId]
      );

      const currentCounts = currentAssignments.rows[0];

      // Delete all area assignments
      const deleteAreasResult = await query(
        `DELETE FROM user_area_assignments
         WHERE user_id = $1 AND is_active = true
         RETURNING id`,
        [userId]
      );

      // Delete all pincode assignments
      const deletePincodesResult = await query(
        `DELETE FROM user_pincode_assignments
         WHERE user_id = $1 AND is_active = true
         RETURNING id`,
        [userId]
      );

      // Commit transaction
      await query('COMMIT');

      const removedPincodes = deletePincodesResult.rows.length;
      const removedAreas = deleteAreasResult.rows.length;

      logger.info(`Removed all territory assignments for field agent ${userId}`, {
        userId: req.user?.id,
        targetUserId: userId,
        targetUserName: user.name,
        removedPincodes,
        removedAreas,
        previousPincodeCount: currentCounts.pincode_count,
        previousAreaCount: currentCounts.area_count,
      });

      res.json({
        success: true,
        data: {
          userId,
          removedPincodes,
          removedAreas,
          userName: user.name,
        },
        message: `Successfully removed all territory assignments for ${user.name}`,
      });
    } catch (transactionError) {
      // Rollback transaction on error
      await query('ROLLBACK');
      throw transactionError;
    }
  } catch (error) {
    logger.error('Error removing all territory assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove all territory assignments',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
