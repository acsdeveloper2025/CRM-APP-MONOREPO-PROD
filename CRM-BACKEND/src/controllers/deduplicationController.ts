import { Request, Response } from 'express';
import { DeduplicationService, DeduplicationCriteria, DeduplicationDecision } from '@/services/deduplicationService';
import { pool } from '@/config/database';
import { logger } from '@/utils/logger';
import { AuthenticatedRequest } from '@/middleware/auth';

const deduplicationService = new DeduplicationService(pool);

/**
 * POST /api/cases/deduplication/search
 * Search for potential duplicate cases
 */
export const searchDuplicates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const criteria: DeduplicationCriteria = req.body as DeduplicationCriteria;

    // Validate that at least one search criterion is provided
    const hasValidCriteria = Object.values(criteria).some(value => 
      value && typeof value === 'string' && value.trim().length > 0
    );

    if (!hasValidCriteria) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'At least one search criterion must be provided',
          code: 'INVALID_SEARCH_CRITERIA'
        }
      });
    }

    // Clean and validate criteria
    const cleanCriteria: DeduplicationCriteria = {};

    if (criteria.customerName?.trim()) {
      cleanCriteria.customerName = criteria.customerName.trim();
    }

    if (criteria.panNumber?.trim()) {
      const pan = criteria.panNumber.trim().toUpperCase();
      // Basic PAN validation (5 letters, 4 digits, 1 letter)
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid PAN number format',
            code: 'INVALID_PAN_FORMAT'
          }
        });
      }
      cleanCriteria.panNumber = pan;
    }

    if (criteria.customerPhone?.trim()) {
      const phone = criteria.customerPhone.trim().replace(/\D/g, '');
      if (phone.length >= 10) {
        cleanCriteria.customerPhone = phone;
      }
    }

    const result = await deduplicationService.searchDuplicates(cleanCriteria);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error in searchDuplicates controller', { error });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to search for duplicates',
        code: 'DEDUPLICATION_SEARCH_ERROR'
      }
    });
  }
};

/**
 * POST /api/cases/deduplication/decision
 * Record deduplication decision
 */
export const recordDeduplicationDecision = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { decision, duplicatesFound, searchCriteria } = req.body as any;

    if (!decision || !decision.caseId || !decision.decision || !decision.rationale) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing required decision fields',
          code: 'INVALID_DECISION_DATA'
        }
      });
    }

    const validDecisions = ['CREATE_NEW', 'USE_EXISTING', 'MERGE_CASES'];
    if (!validDecisions.includes(decision.decision)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid decision type',
          code: 'INVALID_DECISION_TYPE'
        }
      });
    }

    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'User not authenticated',
          code: 'AUTHENTICATION_REQUIRED'
        }
      });
    }

    await deduplicationService.recordDeduplicationDecision(
      decision,
      duplicatesFound || [],
      searchCriteria || {},
      req.user.id
    );

    res.json({
      success: true,
      message: 'Deduplication decision recorded successfully'
    });

  } catch (error) {
    logger.error('Error in recordDeduplicationDecision controller', { error });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to record deduplication decision',
        code: 'DEDUPLICATION_DECISION_ERROR'
      }
    });
  }
};

/**
 * GET /api/cases/:caseId/deduplication/history
 * Get deduplication history for a case
 */
export const getDeduplicationHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId } = req.params;

    if (!caseId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Case ID is required',
          code: 'MISSING_CASE_ID'
        }
      });
    }

    const history = await deduplicationService.getDeduplicationHistory(caseId);

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    logger.error('Error in getDeduplicationHistory controller', { error });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch deduplication history',
        code: 'DEDUPLICATION_HISTORY_ERROR'
      }
    });
  }
};

/**
 * GET /api/cases/deduplication/clusters
 * Get potential duplicate case clusters for admin review
 */
export const getDuplicateClusters = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Find cases with potential duplicates based on exact matches
    const query = `
      WITH duplicate_groups AS (
        SELECT 
          COALESCE("panNumber", "aadhaarNumber", "applicantPhone", "bankAccountNumber") as group_key,
          COUNT(*) as case_count,
          ARRAY_AGG(
            json_build_object(
              'id', id,
              'caseNumber', "caseNumber",
              'applicantName', "applicantName",
              'status', status,
              'createdAt', "createdAt",
              'panNumber', "panNumber",
              'aadhaarNumber', "aadhaarNumber",
              'applicantPhone', "applicantPhone",
              'bankAccountNumber', "bankAccountNumber"
            ) ORDER BY "createdAt" DESC
          ) as cases
        FROM cases
        WHERE (
          "panNumber" IS NOT NULL OR 
          "aadhaarNumber" IS NOT NULL OR 
          "applicantPhone" IS NOT NULL OR 
          "bankAccountNumber" IS NOT NULL
        )
        GROUP BY group_key
        HAVING COUNT(*) > 1
      )
      SELECT * FROM duplicate_groups
      ORDER BY case_count DESC
      LIMIT $1 OFFSET $2
    `;

    const countQuery = `
      WITH duplicate_groups AS (
        SELECT 
          COALESCE("panNumber", "aadhaarNumber", "applicantPhone", "bankAccountNumber") as group_key,
          COUNT(*) as case_count
        FROM cases
        WHERE (
          "panNumber" IS NOT NULL OR 
          "aadhaarNumber" IS NOT NULL OR 
          "applicantPhone" IS NOT NULL OR 
          "bankAccountNumber" IS NOT NULL
        )
        GROUP BY group_key
        HAVING COUNT(*) > 1
      )
      SELECT COUNT(*) as total FROM duplicate_groups
    `;

    const [clustersResult, countResult] = await Promise.all([
      pool.query(query, [limit, offset]),
      pool.query(countQuery)
    ]);

    const clusters = clustersResult.rows;
    const total = parseInt(countResult.rows[0]?.total || '0');

    res.json({
      success: true,
      data: {
        clusters,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Error in getDuplicateClusters controller', { error });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch duplicate clusters',
        code: 'DUPLICATE_CLUSTERS_ERROR'
      }
    });
  }
};
