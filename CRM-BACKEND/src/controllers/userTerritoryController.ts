import type { Response } from 'express';
import { logger } from '../config/logger';
import type { AuthenticatedRequest } from '../middleware/auth';
import { query, pool, wrapClient } from '../config/database';
import { EnterpriseCacheService, CacheKeys } from '../services/enterpriseCacheService';
import { isExecutionEligibleUser, loadUserCapabilityProfile } from '../security/userCapabilities';

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
        upa.id as assignment_id,
        upa.pincode_id,
        p.code as pincode_code,
        c.name as city_name,
        s.name as state_name,
        upa.assigned_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', uaa.id,
              'areaId', uaa.area_id,
              'areaName', a.name,
              'assignedAt', uaa.assigned_at
            ) ORDER BY a.name
          ) FILTER (WHERE uaa.id IS NOT NULL),
          '[]'::json
        ) as "area_assignments"
      FROM user_pincode_assignments upa
      JOIN pincodes p ON upa.pincode_id = p.id
      JOIN cities c ON p.city_id = c.id
      JOIN states s ON c.state_id = s.id
      LEFT JOIN user_area_assignments uaa 
        ON upa.id = uaa.user_pincode_assignment_id 
        AND uaa.is_active = true
      LEFT JOIN areas a ON uaa.area_id = a.id
      WHERE upa.user_id = $1 AND upa.is_active = true
      GROUP BY upa.id, upa.pincode_id, p.code, c.name, s.name, upa.assigned_at
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
  const client = wrapClient(await pool.connect());

  try {
    const userId = String(req.params.userId || '');
    const { assignments } = req.body;
    const assignedBy = req.user!.id;

    // Validation
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'assignments array is required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Verify user exists and is execution-eligible for territory operations
    const userProfile = await loadUserCapabilityProfile(userId, client);

    if (!userProfile) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    if (!isExecutionEligibleUser(userProfile)) {
      return res.status(400).json({
        success: false,
        message: 'Territory assignments can only be made for execution-eligible users',
        error: { code: 'INVALID_ROLE' },
      });
    }

    await client.query('BEGIN');

    // Step 1: Deactivate all existing assignments (soft delete)
    await client.query(
      `
      UPDATE user_pincode_assignments 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_active = true
    `,
      [userId]
    );

    await client.query(
      `
      UPDATE user_area_assignments 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_active = true
    `,
      [userId]
    );

    let pincodeCount = 0;
    let areaCount = 0;

    // Step 2: Create new assignments — batched. Previously this was a
    // per-pincode INSERT with a NESTED per-area INSERT loop, i.e.
    // O(pincodes x areas) sequential round-trips (up to ~2500 for a large
    // territory). Now: one multi-row INSERT for the pincode assignments
    // (RETURNING id, pincode_id), map pincode_id -> new assignment id, then a
    // single multi-row INSERT for all area rows.
    const typedAssignments = assignments as Array<{ pincodeId: number; areaIds?: number[] }>;
    const pincodeIds = typedAssignments.map(a => a.pincodeId);

    if (pincodeIds.length > 0) {
      const pincodeValues = pincodeIds
        .map((_id, i) => {
          const o = i * 3;
          return `($${o + 1}, $${o + 2}, $${o + 3}, true)`;
        })
        .join(', ');
      const pincodeParams = pincodeIds.flatMap(pincodeId => [userId, pincodeId, assignedBy]);
      const pincodeResult = await client.query(
        `INSERT INTO user_pincode_assignments (user_id, pincode_id, assigned_by, is_active)
         VALUES ${pincodeValues}
         RETURNING id, pincode_id`,
        pincodeParams
      );
      pincodeCount = pincodeResult.rows.length;

      const assignmentIdByPincode = new Map<string, string>();
      for (const r of pincodeResult.rows) {
        assignmentIdByPincode.set(String(r.pincodeId ?? r.pincode_id), String(r.id));
      }

      // Flatten every area row across all assignments into one batch.
      const areaRows: Array<[string, number, number, string, string]> = [];
      for (const assignment of typedAssignments) {
        const upaId = assignmentIdByPincode.get(String(assignment.pincodeId));
        if (!upaId || !Array.isArray(assignment.areaIds)) {
          continue;
        }
        for (const areaId of assignment.areaIds) {
          areaRows.push([userId, assignment.pincodeId, areaId, upaId, assignedBy]);
        }
      }

      if (areaRows.length > 0) {
        const areaValues = areaRows
          .map((_row, i) => {
            const o = i * 5;
            return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, true)`;
          })
          .join(', ');
        const areaParams = areaRows.flat();
        await client.query(
          `INSERT INTO user_area_assignments
           (user_id, pincode_id, area_id, user_pincode_assignment_id, assigned_by, is_active)
           VALUES ${areaValues}`,
          areaParams
        );
        areaCount = areaRows.length;
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
