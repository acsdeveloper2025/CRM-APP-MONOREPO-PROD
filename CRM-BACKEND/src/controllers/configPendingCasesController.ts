import type { Response } from 'express';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { configurationQuarantineService } from '@/services/configurationQuarantineService';
import { logger } from '@/config/logger';

/**
 * Admin Controller for Configuration Pending Cases
 * Manages quarantined cases that failed financial configuration validation
 */
export class ConfigPendingCasesController {
  /**
   * List all cases in CONFIG_PENDING state
   * GET /api/admin/config-pending-cases
   */
  static async listConfigPendingCases(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 50,
        clientId,
        errorCode,
      } = req.query;

      const result = await configurationQuarantineService.getConfigPendingCases({
        page: Number(page),
        limit: Number(limit),
        clientId: clientId ? Number(clientId) : undefined,
        errorCode: errorCode as any,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error fetching config pending cases:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch configuration pending cases',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Retry processing for a quarantined case
   * POST /api/admin/config-pending-cases/:caseId/retry
   */
  static async retryProcessing(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { caseId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
        error: { code: 'UNAUTHORIZED' },
      });
      return;
    }

    try {
      const result = await configurationQuarantineService.retryProcessing(caseId, userId);

      if (!result.success) {
        res.status(422).json({
          success: false,
          message: result.message,
          errorCode: result.errorCode,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          caseId,
          tasksCreated: result.tasksCreated,
        },
      });
    } catch (error) {
      logger.error('Error retrying case processing:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retry case processing',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Get details for a specific config pending case
   * GET /api/admin/config-pending-cases/:caseId
   */
  static async getConfigPendingCaseDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { caseId } = req.params;

    try {
      const { query } = await import('@/config/database');
      
      const result = await query(
        `SELECT 
          c.id, c."caseId", c."customerName", c."clientId", c."productId",
          c."verificationTypeId", c.pincode, c.area_id, c.status, c.created_at,
          cl.name as client_name,
          p.name as product_name,
          vt.name as verification_type_name,
          cce.error_code, cce.error_message, cce.error_details, cce.created_at as error_created_at
         FROM cases c
         LEFT JOIN case_configuration_errors cce ON c.id = cce.case_id AND cce.resolved_at IS NULL
         LEFT JOIN clients cl ON c."clientId" = cl.id
         LEFT JOIN products p ON c."productId" = p.id
         LEFT JOIN "verificationTypes" vt ON c."verificationTypeId" = vt.id
         WHERE c.id = $1 AND c.status = 'CONFIG_PENDING'`,
        [caseId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Config pending case not found',
          error: { code: 'NOT_FOUND' },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      logger.error('Error fetching config pending case details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch case details',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }
}
