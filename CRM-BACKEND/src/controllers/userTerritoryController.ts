import type { Response } from 'express';
import { logger } from '../config/logger';
import type { AuthenticatedRequest } from '../middleware/auth';
import { query, pool } from '../config/database';
import { EnterpriseCacheService, CacheKeys } from '../services/enterpriseCacheService';

/**
 * GET /api/users/:userId/territory-assignments
 * Fetch user's territory assignments (pincodes and areas)
 */
export const getUserTerritoryAssignments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.params.userId || '');

    // Fetch pincode assignments with areas
    const result = await query(
      `
      SELECT 
        upa.id as "assignmentId",
        upa."pincodeId",
        p.code as "pincodeCode",
        c.name as "cityName",
        s.name as "stateName",
        upa."assignedAt",
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', uaa.id,
              'areaId', uaa."areaId",
              'areaName', a.name,
              'assignedAt', uaa."assignedAt"
            ) ORDER BY a.name
          ) FILTER (WHERE uaa.id IS NOT NULL),
          '[]'::json
        ) as "areaAssignments"
      FROM "userPincodeAssignments" upa
      JOIN pincodes p ON upa."pincodeId" = p.id
      JOIN cities c ON p."cityId" = c.id
      JOIN states s ON c."stateId" = s.id
      LEFT JOIN "userAreaAssignments" uaa 
        ON upa.id = uaa."userPincodeAssignmentId" 
        AND uaa."isActive" = true
      LEFT JOIN areas a ON uaa."areaId" = a.id
      WHERE upa."userId" = $1 AND upa."isActive" = true
      GROUP BY upa.id, upa."pincodeId", p.code, c.name, s.name, upa."assignedAt"
      ORDER BY p.code
    `,
      [userId]
    );

    logger.info(`Retrieved territory assignments for user ${userId}`, {
      userId,
      pincodeCount: result.rows.length,
    });

    res.json({
      success: true,
      data: {
        pincodeAssignments: result.rows,
      },
    });
  } catch (error) {
    logger.error('Error fetching user territory assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch territory assignments',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
/**
 * POST /api/users/:userId/territory-assignments/bulk
 * Bulk save territory assignments (pincodes and areas)
 * Body: { assignments: [{ pincodeId: number, areaIds: number[] }] }
 */
export const bulkSaveTerritoryAssignments = async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();

  try {
    const userId = String(req.params.userId || '');
    const { assignments } = req.body;
    const assignedBy = req.user.id;

    // Validation
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'assignments array is required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Verify user exists and is a FIELD_AGENT
    const userCheck = await client.query('SELECT id, role FROM users WHERE id = $1', [userId]);

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    if (userCheck.rows[0].role !== 'FIELD_AGENT') {
      return res.status(400).json({
        success: false,
        message: 'Territory assignments can only be made for FIELD_AGENT users',
        error: { code: 'INVALID_ROLE' },
      });
    }

    await client.query('BEGIN');

    // Step 1: Deactivate all existing assignments (soft delete)
    await client.query(
      `
      UPDATE "userPincodeAssignments" 
      SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = $1 AND "isActive" = true
    `,
      [userId]
    );

    await client.query(
      `
      UPDATE "userAreaAssignments" 
      SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = $1 AND "isActive" = true
    `,
      [userId]
    );

    let pincodeCount = 0;
    let areaCount = 0;

    // Step 2: Create new assignments
    for (const assignment of assignments) {
      const { pincodeId, areaIds } = assignment;

      // Insert pincode assignment
      const pincodeResult = await client.query(
        `
        INSERT INTO "userPincodeAssignments" 
        ("userId", "pincodeId", "assignedBy", "isActive")
        VALUES ($1, $2, $3, true)
        RETURNING id
      `,
        [userId, pincodeId, assignedBy]
      );

      const userPincodeAssignmentId = pincodeResult.rows[0].id;
      pincodeCount++;

      // Insert area assignments
      if (areaIds && areaIds.length > 0) {
        for (const areaId of areaIds) {
          await client.query(
            `
            INSERT INTO "userAreaAssignments" 
            ("userId", "pincodeId", "areaId", "userPincodeAssignmentId", "assignedBy", "isActive")
            VALUES ($1, $2, $3, $4, $5, true)
          `,
            [userId, pincodeId, areaId, userPincodeAssignmentId, assignedBy]
          );

          areaCount++;
        }
      }
    }

    await client.query('COMMIT');

    logger.info(`Bulk saved territory assignments for user ${userId}`, {
      userId,
      assignedBy,
      pincodeCount,
      areaCount,
    });

    // Manually invalidate cache synchronously
    const deletedCount = await EnterpriseCacheService.clearByPattern('users:list:*');
    logger.info(`Invalidated ${deletedCount} user list cache keys`);

    // Also invalidate specific user cache just in case
    await EnterpriseCacheService.delete(CacheKeys.user(userId));

    res.json({
      success: true,
      data: {
        pincodeAssignmentsCreated: pincodeCount,
        areaAssignmentsCreated: areaCount,
        message: 'Territory assignments saved successfully',
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error bulk saving territory assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save territory assignments',
      error: { code: 'INTERNAL_ERROR' },
    });
  } finally {
    client.release();
  }
};
