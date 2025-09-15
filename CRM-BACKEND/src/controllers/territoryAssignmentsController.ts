import { Request, Response } from 'express';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from '@/types/auth';

// GET /api/territory-assignments/field-agents - List all field agents with their territory assignments
export const getFieldAgentTerritories = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      pincodeId,
      cityId,
      isActive = 'true',
      sortBy = 'userName',
      sortOrder = 'asc'
    } = req.query;

    // Build the WHERE clause
    const conditions: string[] = ['u.role = $1'];
    const params: any[] = ['FIELD'];
    let paramIndex = 2;

    if (search) {
      conditions.push(`(u.name ILIKE $${paramIndex} OR u.username ILIKE $${paramIndex} OR u."employeeId" ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (pincodeId) {
      conditions.push(`upa."pincodeId" = $${paramIndex}`);
      params.push(pincodeId);
      paramIndex++;
    }

    if (cityId) {
      conditions.push(`c.id = $${paramIndex}`);
      params.push(cityId);
      paramIndex++;
    }

    if (isActive !== undefined) {
      conditions.push(`upa."isActive" = $${paramIndex}`);
      params.push(isActive === 'true');
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countSql = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      LEFT JOIN "userPincodeAssignments" upa ON u.id = upa."userId"
      LEFT JOIN pincodes p ON upa."pincodeId" = p.id
      LEFT JOIN cities c ON p."cityId" = c.id
      ${whereClause}
    `;

    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0].total);

    // Calculate pagination
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    // Get field agents with territory assignments using the view
    const sql = `
      SELECT
        u.id as "userId",
        u.name as "userName",
        u.username,
        u."employeeId",
        u."isActive" as "userIsActive",
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'pincodeAssignmentId', upa.id,
              'pincodeId', upa."pincodeId",
              'pincodeCode', p.code,
              'cityName', c.name,
              'stateName', s.name,
              'countryName', co.name,
              'assignedAreas', COALESCE(area_agg.areas, '[]'::json),
              'pincodeAssignedAt', upa."assignedAt",
              'isActive', upa."isActive"
            ) ORDER BY p.code
          ) FILTER (WHERE upa."pincodeId" IS NOT NULL),
          '[]'::json
        ) as "territoryAssignments"
      FROM users u
      LEFT JOIN "userPincodeAssignments" upa ON u.id = upa."userId" AND upa."isActive" = true
      LEFT JOIN pincodes p ON upa."pincodeId" = p.id
      LEFT JOIN cities c ON p."cityId" = c.id
      LEFT JOIN states s ON c."stateId" = s.id
      LEFT JOIN countries co ON c."countryId" = co.id
      LEFT JOIN (
        SELECT
          uaa."userId",
          uaa."pincodeId",
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'areaAssignmentId', uaa.id,
              'areaId', uaa."areaId",
              'areaName', a.name,
              'assignedAt', uaa."assignedAt"
            )
          ) as areas
        FROM "userAreaAssignments" uaa
        LEFT JOIN areas a ON uaa."areaId" = a.id
        WHERE uaa."isActive" = true
        GROUP BY uaa."userId", uaa."pincodeId"
      ) area_agg ON upa."userId" = area_agg."userId" AND upa."pincodeId" = area_agg."pincodeId"
      ${whereClause}
      GROUP BY u.id, u.name, u.username, u."employeeId", u."isActive"
      ORDER BY ${sortBy === 'userName' ? 'u.name' : `u."${sortBy}"`} ${String(sortOrder).toUpperCase()}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limitNum, offset);
    const result = await query(sql, params);

    logger.info(`Retrieved ${result.rows.length} field agents with territories`, {
      userId: (req as any).user?.id,
      page: pageNum,
      limit: limitNum,
      total,
      filters: { search, pincodeId, cityId, isActive }
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
export const getFieldAgentTerritoryById = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Verify user exists and is a field agent
    const userCheck = await query(
      'SELECT id, name, username, "employeeId", role FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const user = userCheck.rows[0];
    if (user.role !== 'FIELD_AGENT') {
      return res.status(400).json({
        success: false,
        message: 'User is not a field agent',
        error: { code: 'INVALID_USER_ROLE' },
      });
    }

    // Get territory assignments using the view
    const sql = `
      SELECT 
        "userId",
        "userName",
        "username",
        "employeeId",
        "pincodeAssignmentId",
        "pincodeId",
        "pincodeCode",
        "cityName",
        "stateName",
        "countryName",
        "assignedAreas",
        "pincodeAssignedAt",
        "assignedBy",
        "isActive"
      FROM "fieldAgentTerritories"
      WHERE "userId" = $1
      ORDER BY "pincodeCode"
    `;

    const result = await query(sql, [userId]);

    logger.info(`Retrieved territory assignments for field agent ${userId}`, {
      userId: (req as any).user?.id,
      targetUserId: userId,
      assignmentCount: result.rows.length
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          employeeId: user.employeeId,
          role: user.role
        },
        territoryAssignments: result.rows
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
export const assignPincodesToFieldAgent = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { pincodeIds } = req.body;

    // Validate input - allow empty arrays for removing all assignments
    if (!Array.isArray(pincodeIds)) {
      return res.status(400).json({
        success: false,
        message: 'pincodeIds must be an array',
        error: { code: 'INVALID_INPUT' },
      });
    }

    // Verify user exists and is a field agent
    const userResult = await query(
      'SELECT id, name, username, role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const user = userResult.rows[0];
    if (user.role !== 'FIELD_AGENT') {
      return res.status(400).json({
        success: false,
        message: 'User is not a field agent',
        error: { code: 'INVALID_USER_ROLE' },
      });
    }

    // Verify all pincodes exist (only if pincodeIds is not empty)
    if (pincodeIds.length > 0) {
      const pincodeCheck = await query(
        `SELECT id, code FROM pincodes WHERE id = ANY($1)`,
        [pincodeIds]
      );

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
      // First, deactivate all existing pincode assignments for this user (and their related area assignments)
      const deactivateAreasResult = await query(
        'UPDATE "userAreaAssignments" SET "isActive" = false WHERE "userId" = $1 AND "isActive" = true RETURNING id',
        [userId]
      );
      const deactivatedAreasCount = deactivateAreasResult.rows.length;

      const deactivatePincodesResult = await query(
        'UPDATE "userPincodeAssignments" SET "isActive" = false WHERE "userId" = $1 AND "isActive" = true RETURNING id',
        [userId]
      );
      const deactivatedPincodesCount = deactivatePincodesResult.rows.length;

      let insertedCount = 0;

      // Then, insert new pincode assignments (only if pincodeIds is not empty)
      if (pincodeIds.length > 0) {
        const insertPromises = pincodeIds.map(async (pincodeId: number) => {
          const result = await query(
            `INSERT INTO "userPincodeAssignments" ("userId", "pincodeId", "assignedBy", "isActive")
             VALUES ($1, $2, $3, true)
             RETURNING id, "pincodeId", "assignedAt"`,
            [userId, pincodeId, (req as any).user?.id]
          );
          return result.rows[0];
        });

        const results = await Promise.all(insertPromises);
        insertedCount = results.length;
      }

      // Commit transaction
      await query('COMMIT');

      logger.info(`Replaced pincode assignments for field agent ${userId}`, {
        userId: (req as any).user?.id,
        targetUserId: userId,
        pincodeIds,
        deactivatedPincodesCount,
        deactivatedAreasCount,
        insertedCount
      });

      res.status(200).json({
        success: true,
        data: {
          userId,
          deactivatedPincodes: deactivatedPincodesCount,
          deactivatedAreas: deactivatedAreasCount,
          newPincodeAssignments: insertedCount,
          totalRequested: pincodeIds.length
        },
        message: `Successfully updated pincode assignments for field agent`,
      });

    } catch (transactionError) {
      // Rollback transaction on error
      await query('ROLLBACK');
      throw transactionError;
    }
  } catch (error) {
    logger.error('Error updating pincode assignments for field agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update pincode assignments for field agent',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/territory-assignments/field-agents/:userId/areas - Assign areas within pincodes to field agent
export const assignAreasToFieldAgent = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { assignments } = req.body; // Array of { pincodeId, areaIds }

    // Validate input - allow empty arrays for removing all area assignments
    if (!Array.isArray(assignments)) {
      return res.status(400).json({
        success: false,
        message: 'assignments must be an array of { pincodeId, areaIds }',
        error: { code: 'INVALID_INPUT' },
      });
    }

    // Verify user exists and is a field agent
    const userResult = await query(
      'SELECT id, name, username, role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const user = userResult.rows[0];
    if (user.role !== 'FIELD_AGENT') {
      return res.status(400).json({
        success: false,
        message: 'User is not a field agent',
        error: { code: 'INVALID_USER_ROLE' },
      });
    }

    // Use replace-all logic: first remove all existing area assignments, then add new ones

    // Step 1: Remove all existing area assignments for this user
    const removeResult = await query(
      `DELETE FROM "userAreaAssignments"
       WHERE "userId" = $1 AND "isActive" = true`,
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
          `SELECT id FROM "userPincodeAssignments"
           WHERE "userId" = $1 AND "pincodeId" = $2 AND "isActive" = true`,
          [userId, pincodeId]
        );

        if (pincodeAssignmentResult.rows.length === 0) {
          assignmentResults.push({
            pincodeId,
            error: 'Field agent not assigned to this pincode',
            assigned: 0,
            requested: areaIds.length
          });
          continue;
        }

        const userPincodeAssignmentId = pincodeAssignmentResult.rows[0].id;

        // Verify areas exist and belong to the pincode
        const areaCheck = await query(
          `SELECT a.id, a.name, pa."pincodeId"
           FROM areas a
           JOIN "pincodeAreas" pa ON a.id = pa."areaId"
           WHERE a.id = ANY($1) AND pa."pincodeId" = $2`,
          [areaIds, pincodeId]
        );

        const validAreaIds = areaCheck.rows.map(row => row.id);
        const invalidAreaIds = areaIds.filter(id => !validAreaIds.includes(parseInt(id)));

        if (invalidAreaIds.length > 0) {
          assignmentResults.push({
            pincodeId,
            error: `Invalid areas for pincode: ${invalidAreaIds.join(', ')}`,
            assigned: 0,
            requested: areaIds.length
          });
          continue;
        }

        // Insert area assignments
        const insertPromises = validAreaIds.map(async (areaId: number) => {
          try {
            const result = await query(
              `INSERT INTO "userAreaAssignments"
               ("userId", "pincodeId", "areaId", "userPincodeAssignmentId", "assignedBy")
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id, "areaId"`,
              [userId, pincodeId, areaId, userPincodeAssignmentId, (req as any).user?.id]
            );
            return result.rows[0];
          } catch (error) {
            logger.warn(`Failed to assign area ${areaId} to user ${userId}:`, error);
            return null;
          }
        });

        const results = await Promise.all(insertPromises);
        const newAreaAssignments = results.filter(result => result !== null);
        totalAssigned += newAreaAssignments.length;

        assignmentResults.push({
          pincodeId,
          assigned: newAreaAssignments.length,
          requested: areaIds.length,
          failed: areaIds.length - newAreaAssignments.length
        });
      }
    }

    logger.info(`Updated area assignments for field agent ${userId}`, {
      userId: (req as any).user?.id,
      targetUserId: userId,
      removedCount,
      totalAssigned,
      totalRequested,
      assignmentResults
    });

    res.status(200).json({
      success: true,
      data: {
        userId,
        removedCount,
        totalAssigned,
        totalRequested,
        assignmentResults
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
export const removePincodeAssignment = async (req: Request, res: Response) => {
  try {
    const { userId, pincodeId } = req.params;

    // Verify assignment exists
    const assignmentCheck = await query(
      `SELECT id FROM "userPincodeAssignments"
       WHERE "userId" = $1 AND "pincodeId" = $2 AND "isActive" = true`,
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
        `DELETE FROM "userAreaAssignments"
         WHERE "userId" = $1 AND "pincodeId" = $2 AND "isActive" = true`,
        [userId, pincodeId]
      );

      // Delete pincode assignment
      await query(
        `DELETE FROM "userPincodeAssignments"
         WHERE "userId" = $1 AND "pincodeId" = $2 AND "isActive" = true`,
        [userId, pincodeId]
      );

      await query('COMMIT');

      logger.info(`Removed pincode assignment ${pincodeId} from field agent ${userId}`, {
        userId: (req as any).user?.id,
        targetUserId: userId,
        pincodeId
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
export const removeAreaAssignment = async (req: Request, res: Response) => {
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
      `SELECT id FROM "userAreaAssignments"
       WHERE "userId" = $1 AND "areaId" = $2 AND "pincodeId" = $3 AND "isActive" = true`,
      [userId, areaId, pincodeId]
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
      `DELETE FROM "userAreaAssignments"
       WHERE "userId" = $1 AND "areaId" = $2 AND "pincodeId" = $3 AND "isActive" = true`,
      [userId, areaId, pincodeId]
    );

    logger.info(`Removed area assignment ${areaId} from field agent ${userId}`, {
      userId: (req as any).user?.id,
      targetUserId: userId,
      areaId,
      pincodeId
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
export const addSinglePincodeAssignment = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
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

    // Verify user exists and is a field agent
    const userResult = await query(
      'SELECT id, name, username, role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const user = userResult.rows[0];
    if (user.role !== 'FIELD_AGENT') {
      return res.status(400).json({
        success: false,
        message: 'User is not a field agent',
        error: { code: 'INVALID_USER_ROLE' },
      });
    }

    // Verify pincode exists
    const pincodeCheck = await query(
      'SELECT id, code FROM pincodes WHERE id = $1',
      [pincodeId]
    );

    if (pincodeCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Pincode not found',
        error: { code: 'INVALID_PINCODE' },
      });
    }

    // Check if pincode is already assigned
    const existingAssignment = await query(
      'SELECT id FROM "userPincodeAssignments" WHERE "userId" = $1 AND "pincodeId" = $2 AND "isActive" = true',
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
      const areaCheck = await query(
        'SELECT id FROM areas WHERE id = ANY($1)',
        [areaIds]
      );

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
        `INSERT INTO "userPincodeAssignments" ("userId", "pincodeId", "assignedBy", "isActive")
         VALUES ($1, $2, $3, true)
         RETURNING id`,
        [userId, pincodeId, (req as any).user?.id]
      );

      // Add area assignments if provided
      let assignedAreasCount = 0;
      if (areaIds.length > 0) {
        const userPincodeAssignmentId = pincodeAssignmentResult.rows[0].id;

        for (const areaId of areaIds) {
          await query(
            `INSERT INTO "userAreaAssignments" ("userId", "pincodeId", "areaId", "userPincodeAssignmentId", "assignedBy", "isActive")
             VALUES ($1, $2, $3, $4, $5, true)`,
            [userId, pincodeId, areaId, userPincodeAssignmentId, (req as any).user?.id]
          );
          assignedAreasCount++;
        }
      }

      // Commit transaction
      await query('COMMIT');

      logger.info(`Added single pincode assignment for field agent ${userId}`, {
        userId: (req as any).user?.id,
        targetUserId: userId,
        targetUserName: user.name,
        pincodeId,
        pincodeCode: pincodeCheck.rows[0].code,
        assignedAreasCount,
        areaIds
      });

      res.json({
        success: true,
        data: {
          userId,
          pincodeId,
          pincodeCode: pincodeCheck.rows[0].code,
          assignedAreas: assignedAreasCount,
          userName: user.name
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
export const removeAllTerritoryAssignments = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Verify user exists and is a field agent
    const userResult = await query(
      'SELECT id, name, username, role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const user = userResult.rows[0];
    if (user.role !== 'FIELD_AGENT') {
      return res.status(400).json({
        success: false,
        message: 'User is not a field agent',
        error: { code: 'INVALID_USER_ROLE' },
      });
    }

    // Start transaction to remove all assignments
    await query('BEGIN');

    try {
      // Get current assignments for logging
      const currentAssignments = await query(
        `SELECT
          COUNT(DISTINCT upa."pincodeId") as pincode_count,
          COUNT(DISTINCT uaa."areaId") as area_count
         FROM "userPincodeAssignments" upa
         LEFT JOIN "userAreaAssignments" uaa ON upa."userId" = uaa."userId" AND upa."pincodeId" = uaa."pincodeId" AND uaa."isActive" = true
         WHERE upa."userId" = $1 AND upa."isActive" = true`,
        [userId]
      );

      const currentCounts = currentAssignments.rows[0];

      // Delete all area assignments
      const deleteAreasResult = await query(
        `DELETE FROM "userAreaAssignments"
         WHERE "userId" = $1 AND "isActive" = true
         RETURNING id`,
        [userId]
      );

      // Delete all pincode assignments
      const deletePincodesResult = await query(
        `DELETE FROM "userPincodeAssignments"
         WHERE "userId" = $1 AND "isActive" = true
         RETURNING id`,
        [userId]
      );

      // Commit transaction
      await query('COMMIT');

      const removedPincodes = deletePincodesResult.rows.length;
      const removedAreas = deleteAreasResult.rows.length;

      logger.info(`Removed all territory assignments for field agent ${userId}`, {
        userId: (req as any).user?.id,
        targetUserId: userId,
        targetUserName: user.name,
        removedPincodes,
        removedAreas,
        previousPincodeCount: currentCounts.pincode_count,
        previousAreaCount: currentCounts.area_count
      });

      res.json({
        success: true,
        data: {
          userId,
          removedPincodes,
          removedAreas,
          userName: user.name
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
