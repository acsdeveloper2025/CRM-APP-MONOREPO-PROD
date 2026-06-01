import type { Response } from 'express';
import { query, withTransaction } from '@/config/database';
import { logger } from '@/config/logger';
import { invalidateAuthContextCache, type AuthenticatedRequest } from '@/middleware/auth';
import { invalidateClientScopeCache } from '@/middleware/clientAccess';
import { invalidateProductScopeCache } from '@/middleware/productAccess';
import { isOperationsEligibleUser, loadUserCapabilityProfile } from '@/security/userCapabilities';

// GET /api/users/:userId/client-assignments - Get assigned clients for a user
export const getUserClientAssignments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;

    // Validate user exists
    const userResult = await query('SELECT id FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Get client assignments with client details
    const assignmentsResult = await query(
      `
      SELECT
        uca.id,
        uca.client_id,
        uca.created_at,
        uca.updated_at,
        c.name as client_name,
        c.code as "client_code",
        c.email as "client_email",
        c.is_active as "client_is_active"
      FROM user_client_assignments uca
      JOIN clients c ON uca.client_id = c.id
      WHERE uca.user_id = $1
      ORDER BY c.name ASC
    `,
      [userId]
    );

    logger.info(
      `Retrieved ${assignmentsResult.rows.length} client assignments for user ${userId}`,
      {
        userId: req.user?.id,
        targetUserId: userId,
      }
    );

    res.json({
      success: true,
      data: assignmentsResult.rows,
      pagination: {
        page: 1,
        limit: assignmentsResult.rows.length,
        total: assignmentsResult.rows.length,
        totalPages: 1,
      },
      message: 'Client assignments retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving user client assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve client assignments',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/users/:userId/client-assignments - Assign clients to a user
export const assignClientsToUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { clientIds } = req.body;

    // Validate input - allow empty arrays for removing all assignments
    if (!Array.isArray(clientIds)) {
      return res.status(400).json({
        success: false,
        message: 'clientIds must be an array',
        error: { code: 'INVALID_INPUT' },
      });
    }

    // T0-3 (audit 2026-05-17): verify the target user is operations-eligible
    // (Backend User / Manager / Admin / Super Admin) — assigning clients to
    // a Field Agent created orphan rows the rest of the app couldn't honour.
    // Mirrors the isExecutionEligibleUser gate on territoryAssignmentsController.
    const targetProfile = await loadUserCapabilityProfile(String(userId));
    if (!targetProfile) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }
    if (!isOperationsEligibleUser(targetProfile)) {
      return res.status(400).json({
        success: false,
        message:
          'This user role cannot receive client assignments. Use Territory Assignments for field agents.',
        error: { code: 'ROLE_BOUNDARY_VIOLATED' },
      });
    }

    // Validate all client IDs exist (only if clientIds is not empty)
    if (clientIds.length > 0) {
      const clientsResult = await query(`SELECT id FROM clients WHERE id = ANY($1::int[])`, [
        clientIds,
      ]);

      if (clientsResult.rows.length !== clientIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more client IDs are invalid',
          error: { code: 'INVALID_CLIENT_IDS' },
        });
      }
    }

    // T0-3 (audit 2026-05-17): real transaction via withTransaction.
    // Prior `query('BEGIN')` ran on a pool checkout released before the
    // DELETE/INSERT statements — partial writes persisted on mid-tx failure.
    const { deletedCount, insertedCount } = await withTransaction(async client => {
      const deleteResult = await client.query(
        'DELETE FROM user_client_assignments WHERE user_id = $1 RETURNING id',
        [userId]
      );

      let inserted = 0;
      if (clientIds.length > 0) {
        for (const clientId of clientIds) {
          await client.query(
            `INSERT INTO user_client_assignments (user_id, client_id)
             VALUES ($1, $2)
             RETURNING id`,
            [userId, clientId]
          );
          inserted++;
        }
      }

      return {
        deletedCount: deleteResult.rows.length,
        insertedCount: inserted,
      };
    });

    logger.info(`Replaced client assignments for user ${userId}`, {
      userId: req.user?.id,
      targetUserId: userId,
      clientIds,
      deletedCount,
      insertedCount,
    });

    // Invalidate user's auth + client-scope cache so the new assignments
    // take effect immediately on next request.
    invalidateAuthContextCache(String(userId));
    invalidateClientScopeCache(String(userId));

    res.status(200).json({
      success: true,
      data: {
        userId,
        deletedAssignments: deletedCount,
        newAssignments: insertedCount,
        totalRequested: clientIds.length,
      },
      message: `Successfully updated client assignments for user`,
    });
  } catch (error) {
    logger.error('Error updating client assignments for user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update client assignments for user',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/users/:userId/client-assignments/:clientId - Remove client assignment
export const removeClientAssignment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, clientId } = req.params;

    // Validate user exists
    const userResult = await query('SELECT id FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Validate client exists
    const clientResult = await query('SELECT id FROM clients WHERE id = $1', [clientId]);

    if (clientResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
        error: { code: 'CLIENT_NOT_FOUND' },
      });
    }

    // Remove the assignment
    const deleteResult = await query(
      'DELETE FROM user_client_assignments WHERE user_id = $1 AND client_id = $2 RETURNING id',
      [userId, clientId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client assignment not found',
        error: { code: 'ASSIGNMENT_NOT_FOUND' },
      });
    }

    logger.info(`Removed client assignment: user ${userId}, client ${clientId}`, {
      userId: req.user?.id,
      targetUserId: userId,
      removedClientId: clientId,
    });

    invalidateAuthContextCache(String(userId));
    invalidateClientScopeCache(String(userId));

    res.json({
      success: true,
      message: 'Client assignment removed successfully',
    });
  } catch (error) {
    logger.error('Error removing client assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove client assignment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/users/:userId/product-assignments - Get user's product assignments
export const getUserProductAssignments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;

    // Validate user exists
    const userResult = await query('SELECT id FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Get product assignments with product details
    const assignmentsQuery = `
      SELECT
        upa.id,
        upa.user_id,
        upa.product_id,
        upa.assigned_at,
        upa.assigned_by,
        p.name as product_name,
        p.description as "product_description",
        u.name as "assigned_by_name"
      FROM user_product_assignments upa
      JOIN products p ON upa.product_id = p.id
      LEFT JOIN users u ON upa.assigned_by = u.id
      WHERE upa.user_id = $1
      ORDER BY upa.assigned_at DESC
    `;

    const result = await query(assignmentsQuery, [userId]);

    res.json({
      success: true,
      data: result.rows,
      message: 'Product assignments retrieved successfully',
    });
  } catch (error) {
    logger.error('Error fetching user product assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/users/:userId/product-assignments - Assign products to a user
export const assignProductsToUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { productIds } = req.body;

    // Validate input - allow empty arrays for removing all assignments
    if (!Array.isArray(productIds)) {
      return res.status(400).json({
        success: false,
        message: 'productIds must be an array',
        error: { code: 'INVALID_INPUT' },
      });
    }

    // T0-3 (audit 2026-05-17): same role-boundary check as assignClientsToUser.
    const targetProfile = await loadUserCapabilityProfile(String(userId));
    if (!targetProfile) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }
    if (!isOperationsEligibleUser(targetProfile)) {
      return res.status(400).json({
        success: false,
        message:
          'This user role cannot receive product assignments. Use Territory Assignments for field agents.',
        error: { code: 'ROLE_BOUNDARY_VIOLATED' },
      });
    }

    // Validate all product IDs exist (only if productIds is not empty)
    if (productIds.length > 0) {
      const productCheckQuery = `
        SELECT id FROM products WHERE id = ANY($1::int[])
      `;
      const productCheckResult = await query(productCheckQuery, [productIds]);

      if (productCheckResult.rows.length !== productIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more products not found',
          error: { code: 'INVALID_PRODUCTS' },
        });
      }
    }

    // T0-3 (audit 2026-05-17): real transaction via withTransaction.
    const { deletedCount, insertedCount } = await withTransaction(async client => {
      const deleteResult = await client.query(
        'DELETE FROM user_product_assignments WHERE user_id = $1 RETURNING id',
        [userId]
      );

      let inserted = 0;
      if (productIds.length > 0) {
        const insertValues = productIds
          .map(
            (_productId: number, index: number) =>
              `($1, $${index + 2}, $${productIds.length + 2}, CURRENT_TIMESTAMP)`
          )
          .join(', ');

        const insertQuery = `
          INSERT INTO user_product_assignments (user_id, product_id, assigned_by, assigned_at)
          VALUES ${insertValues}
          RETURNING *
        `;

        const insertParams = [userId, ...productIds, req.user?.id];
        const insertResult = await client.query(insertQuery, insertParams);
        inserted = insertResult.rows.length;
      }

      return {
        deletedCount: deleteResult.rows.length,
        insertedCount: inserted,
      };
    });

    logger.info(`Replaced product assignments for user ${userId}`, {
      userId: req.user?.id,
      targetUserId: userId,
      productIds,
      deletedCount,
      insertedCount,
    });

    invalidateAuthContextCache(String(userId));
    invalidateProductScopeCache(String(userId));

    res.status(200).json({
      success: true,
      data: {
        userId,
        deletedAssignments: deletedCount,
        newAssignments: insertedCount,
        totalRequested: productIds.length,
      },
      message: `Successfully updated product assignments for user`,
    });
  } catch (error) {
    logger.error('Error updating product assignments for user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product assignments for user',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/users/:userId/product-assignments/:productId - Remove product assignment
export const removeProductAssignment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, productId } = req.params;

    // Validate user exists
    const userResult = await query('SELECT id FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check if assignment exists
    const assignmentResult = await query(
      'SELECT id FROM user_product_assignments WHERE user_id = $1 AND product_id = $2',
      [userId, productId]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product assignment not found',
        error: { code: 'ASSIGNMENT_NOT_FOUND' },
      });
    }

    // Remove assignment
    await query('DELETE FROM user_product_assignments WHERE user_id = $1 AND product_id = $2', [
      userId,
      productId,
    ]);

    invalidateAuthContextCache(String(userId));
    invalidateProductScopeCache(String(userId));

    res.json({
      success: true,
      message: 'Product assignment removed successfully',
    });
  } catch (error) {
    logger.error('Error removing product assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
