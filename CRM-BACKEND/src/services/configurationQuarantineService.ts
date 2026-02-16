import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { PoolClient } from 'pg';
import { FinancialConfigErrorCode } from './financialConfigurationValidator';

/**
 * Request Source Types
 */
export enum RequestSource {
  MANUAL_UI = 'MANUAL_UI',           // User creating case via frontend
  API_INTEGRATION = 'API_INTEGRATION', // External API calls
  BULK_UPLOAD = 'BULK_UPLOAD',       // CSV/Excel bulk import
  EXTERNAL_INGESTION = 'EXTERNAL_INGESTION', // Bank API, webhooks, etc.
}

/**
 * Configuration Quarantine Service
 * 
 * Handles cases that fail financial configuration validation during bulk operations.
 * Instead of rejecting the entire batch, quarantines individual cases for admin review.
 */
export const configurationQuarantineService = {
  /**
   * Quarantine a case with configuration error
   * Sets case status to CONFIG_PENDING and logs error details
   */
  quarantineCase: async (
    client: PoolClient,
    caseId: string,
    errorCode: FinancialConfigErrorCode,
    errorMessage: string,
    errorDetails: {
      clientId: number;
      productId: number;
      verificationTypeId: number;
      pincodeId: number;
      areaId?: number | null;
    }
  ): Promise<void> => {
    try {
      // Update case status to CONFIG_PENDING
      await client.query(
        `UPDATE cases SET status = 'CONFIG_PENDING', "updatedAt" = NOW() WHERE id = $1`,
        [caseId]
      );

      // Log configuration error
      await client.query(
        `INSERT INTO case_configuration_errors 
         (case_id, error_code, error_message, error_details)
         VALUES ($1, $2, $3, $4)`,
        [caseId, errorCode, errorMessage, JSON.stringify(errorDetails)]
      );

      logger.info(`Case ${caseId} quarantined with error: ${errorCode}`);
    } catch (error) {
      logger.error('Failed to quarantine case:', error);
      throw error;
    }
  },

  /**
   * Retry processing for a quarantined case
   * Re-validates configuration and creates tasks if valid
   */
  retryProcessing: async (
    caseId: string,
    userId: string
  ): Promise<{
    success: boolean;
    message: string;
    tasksCreated?: number;
    errorCode?: FinancialConfigErrorCode;
  }> => {
    const { pool } = await import('@/config/database');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get case details
      const caseResult = await client.query(
        `SELECT id, "caseId", "clientId", "productId", "verificationTypeId", 
                pincode, area_id, status, "customerName"
         FROM cases WHERE id = $1`,
        [caseId]
      );

      if (caseResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Case not found',
        };
      }

      const caseData = caseResult.rows[0];

      // Verify case is in CONFIG_PENDING state
      if (caseData.status !== 'CONFIG_PENDING') {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: `Case is not in CONFIG_PENDING state (current: ${caseData.status})`,
        };
      }

      // Resolve pincode ID
      let pincodeId: number | null = null;
      if (caseData.pincode) {
        const pinRes = await client.query(
          'SELECT id FROM pincodes WHERE code = $1',
          [caseData.pincode.toString()]
        );
        if (pinRes.rows[0]) {
          pincodeId = pinRes.rows[0].id;
        }
      }

      if (!pincodeId) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Invalid or missing pincode',
        };
      }

      // Re-validate financial configuration
      const { financialConfigurationValidator } = await import('./financialConfigurationValidator');
      const validationResult = await financialConfigurationValidator.validateTaskConfiguration(
        caseData.clientId,
        caseData.productId,
        caseData.verificationTypeId,
        pincodeId,
        caseData.area_id
      );

      if (!validationResult.isValid) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: validationResult.errorMessage || 'Configuration still invalid',
          errorCode: validationResult.errorCode,
        };
      }

      // Configuration is now valid - create verification tasks
      // Get task template from original case creation (if stored) or use defaults
      const taskData = {
        verification_type_id: caseData.verificationTypeId,
        task_title: `Verification for ${caseData.customerName}`,
        task_description: 'Auto-generated task from retry processing',
        priority: 'MEDIUM',
        rate_type_id: validationResult.rateTypeId,
        estimated_amount: validationResult.amount,
        address: null, // Would need to be stored in case or retrieved
        pincode: caseData.pincode,
        service_zone_id: validationResult.serviceZoneId,
      };

      // Insert verification task
      const taskResult = await client.query(
        `INSERT INTO verification_tasks (
          case_id, verification_type_id, task_title, task_description,
          priority, rate_type_id, estimated_amount, pincode,
          service_zone_id, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', $10)
        RETURNING id`,
        [
          caseId,
          taskData.verification_type_id,
          taskData.task_title,
          taskData.task_description,
          taskData.priority,
          taskData.rate_type_id,
          taskData.estimated_amount,
          taskData.pincode,
          taskData.service_zone_id,
          userId,
        ]
      );

      // Update case status to PENDING
      await client.query(
        `UPDATE cases SET 
          status = 'PENDING',
          total_tasks_count = 1,
          "updatedAt" = NOW()
         WHERE id = $1`,
        [caseId]
      );

      // Mark configuration error as resolved
      await client.query(
        `UPDATE case_configuration_errors 
         SET resolved_at = NOW(), resolved_by = $1
         WHERE case_id = $2 AND resolved_at IS NULL`,
        [userId, caseId]
      );

      await client.query('COMMIT');

      logger.info(`Successfully processed quarantined case ${caseId}`);

      return {
        success: true,
        message: 'Case processed successfully',
        tasksCreated: 1,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to retry case processing:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Get all cases in CONFIG_PENDING state with error details
   */
  getConfigPendingCases: async (filters?: {
    page?: number;
    limit?: number;
    clientId?: number;
    errorCode?: FinancialConfigErrorCode;
  }) => {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;

    const conditions: string[] = ["c.status = 'CONFIG_PENDING'"];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.clientId) {
      conditions.push(`c."clientId" = $${paramIndex}`);
      params.push(filters.clientId);
      paramIndex++;
    }

    if (filters?.errorCode) {
      conditions.push(`cce.error_code = $${paramIndex}`);
      params.push(filters.errorCode);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const result = await query(
      `SELECT 
        c.id, c."caseId", c."customerName", c."clientId", c."productId",
        c."verificationTypeId", c.pincode, c.created_at,
        cl.name as client_name,
        p.name as product_name,
        vt.name as verification_type_name,
        cce.error_code, cce.error_message, cce.error_details, cce.created_at as error_created_at
       FROM cases c
       LEFT JOIN case_configuration_errors cce ON c.id = cce.case_id AND cce.resolved_at IS NULL
       LEFT JOIN clients cl ON c."clientId" = cl.id
       LEFT JOIN products p ON c."productId" = p.id
       LEFT JOIN "verificationTypes" vt ON c."verificationTypeId" = vt.id
       WHERE ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM cases c
       LEFT JOIN case_configuration_errors cce ON c.id = cce.case_id AND cce.resolved_at IS NULL
       WHERE ${whereClause}`,
      params
    );

    return {
      cases: result.rows,
      total: parseInt(countResult.rows[0].total),
      page,
      limit,
    };
  },
};
