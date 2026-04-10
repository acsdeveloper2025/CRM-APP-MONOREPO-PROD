import type { Response } from 'express';
import { DeduplicationService, type DeduplicationCriteria } from '@/services/deduplicationService';
import { pool } from '@/config/database';
import { logger } from '@/utils/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';

const deduplicationService = new DeduplicationService(pool);

/**
 * POST /api/cases/deduplication/search
 * Search for potential duplicate cases
 */
export const searchDuplicates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const criteria: DeduplicationCriteria = req.body as DeduplicationCriteria;

    // Validate that at least one search criterion is provided
    const hasValidCriteria = Object.values(criteria).some(
      value => value && typeof value === 'string' && value.trim().length > 0
    );

    if (!hasValidCriteria) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'At least one search criterion must be provided',
          code: 'INVALID_SEARCH_CRITERIA',
        },
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
            code: 'INVALID_PAN_FORMAT',
          },
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
      data: result,
    });
  } catch (error) {
    logger.error('Error in searchDuplicates controller', { error });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to search for duplicates',
        code: 'DEDUPLICATION_SEARCH_ERROR',
      },
    });
  }
};

/**
 * POST /api/cases/deduplication/decision
 * Record deduplication decision
 */
export const recordDeduplicationDecision = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { decision, duplicatesFound, searchCriteria } = req.body;

    if (!decision?.caseId || !decision.decision || !decision.rationale) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing required decision fields',
          code: 'INVALID_DECISION_DATA',
        },
      });
    }

    const validDecisions = ['CREATE_NEW', 'USE_EXISTING', 'MERGE_CASES', 'NO_DUPLICATES_FOUND'];
    if (!validDecisions.includes(decision.decision)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid decision type',
          code: 'INVALID_DECISION_TYPE',
        },
      });
    }

    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'User not authenticated',
          code: 'AUTHENTICATION_REQUIRED',
        },
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
      message: 'Deduplication decision recorded successfully',
    });
  } catch (error) {
    logger.error('Error in recordDeduplicationDecision controller', { error });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to record deduplication decision',
        code: 'DEDUPLICATION_DECISION_ERROR',
      },
    });
  }
};

/**
 * GET /api/cases/:caseId/deduplication/history
 * Get deduplication history for a case
 */
export const getDeduplicationHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = String(req.params.caseId || '');

    if (!caseId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Case ID is required',
          code: 'MISSING_CASE_ID',
        },
      });
    }

    const history = await deduplicationService.getDeduplicationHistory(caseId);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.error('Error in getDeduplicationHistory controller', { error });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch deduplication history',
        code: 'DEDUPLICATION_HISTORY_ERROR',
      },
    });
  }
};

/**
 * GET /api/cases/deduplication/clusters
 * Get potential duplicate case clusters for admin review
 */
export const getDuplicateClusters = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (Number(page) - 1) * Number(limit);

    // Find cases with potential duplicates based on exact matches
    const query = `
      WITH duplicate_groups AS (
        SELECT 
          COALESCE(pan_number, aadhaar_number, applicant_phone, bank_account_number) as group_key,
          COUNT(*) as case_count,
          ARRAY_AGG(
            json_build_object(
              'id', id,
              'caseNumber', case_number,
              'applicantName', applicant_name,
              'status', status,
              'createdAt', created_at,
              'panNumber', pan_number,
              'aadhaarNumber', aadhaar_number,
              'applicantPhone', applicant_phone,
              'bankAccountNumber', bank_account_number
            ) ORDER BY created_at DESC
          ) as cases
        FROM cases
        WHERE (
          pan_number IS NOT NULL OR 
          aadhaar_number IS NOT NULL OR 
          applicant_phone IS NOT NULL OR 
          bank_account_number IS NOT NULL
        )
        GROUP BY group_key
        HAVING COUNT(*) > 1
      )
      SELECT group_key, case_count, cases FROM duplicate_groups
      ORDER BY case_count DESC
      LIMIT $1 OFFSET $2
    `;

    const countQuery = `
      WITH duplicate_groups AS (
        SELECT 
          COALESCE(pan_number, aadhaar_number, applicant_phone, bank_account_number) as group_key,
          COUNT(*) as case_count
        FROM cases
        WHERE (
          pan_number IS NOT NULL OR 
          aadhaar_number IS NOT NULL OR 
          applicant_phone IS NOT NULL OR 
          bank_account_number IS NOT NULL
        )
        GROUP BY group_key
        HAVING COUNT(*) > 1
      )
      SELECT COUNT(*) as total FROM duplicate_groups
    `;

    const [clustersResult, countResult] = await Promise.all([
      pool.query(query, [limit, offset]),
      pool.query(countQuery),
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
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    logger.error('Error in getDuplicateClusters controller', { error });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch duplicate clusters',
        code: 'DUPLICATE_CLUSTERS_ERROR',
      },
    });
  }
};

/**
 * POST /api/cases/dedupe/global-search
 * Global search for cases across all clients and products
 * No permission restrictions - searches entire database
 */
export const searchGlobalDuplicates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mobile, pan, name, address } = req.body;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Validate that at least one search criterion is provided
    const hasValidCriteria = [mobile, pan, name, address].some(
      value => value && typeof value === 'string' && value.trim().length > 0
    );

    if (!hasValidCriteria) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'At least one search criterion must be provided',
          code: 'INVALID_SEARCH_CRITERIA',
        },
      });
    }

    // Build search conditions
    const searchConditions: string[] = [];
    const searchParams: (string | number | boolean | null | undefined)[] = [];
    let paramIndex = 1;

    // Clean and validate PAN
    if (pan?.trim()) {
      const cleanPan = pan.trim().toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid PAN number format',
            code: 'INVALID_PAN_FORMAT',
          },
        });
      }
      searchConditions.push(`c.pan_number = $${paramIndex}`);
      searchParams.push(cleanPan);
      paramIndex++;
    }

    // Clean and validate mobile
    if (mobile?.trim()) {
      const cleanMobile = mobile.trim().replace(/\D/g, '');
      if (cleanMobile.length >= 10) {
        searchConditions.push(`c.customer_phone LIKE '%' || $${paramIndex} || '%'`);
        searchParams.push(cleanMobile);
        paramIndex++;
      }
    }

    // Fuzzy name search
    if (name?.trim()) {
      searchConditions.push(`c.customer_name ILIKE '%' || $${paramIndex} || '%'`);
      searchParams.push(name.trim());
      paramIndex++;
    }

    // Fuzzy address search (in verification_tasks table)
    if (address?.trim()) {
      searchConditions.push(`vt.address ILIKE '%' || $${paramIndex} || '%'`);
      searchParams.push(address.trim());
      paramIndex++;
    }

    if (searchConditions.length === 0) {
      return res.json({
        success: true,
        data: {
          results: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        },
      });
    }

    // Count total matches
    const countQuery = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM cases c
      LEFT JOIN verification_tasks vt ON vt.case_id = c.id
      WHERE (${searchConditions.join(' OR ')})
    `;

    const countResult = await pool.query(countQuery, searchParams);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Get paginated results
    const query = `
      SELECT
        c.id,
        c.case_id,
        c.case_id as case_number,
        c.customer_name,
        c.customer_phone,
        c.pan_number,
        c.status,
        c.created_at,
        cl.name as client_name,
        p.name as product_name,
        vt.address as "address"
      FROM cases c
      LEFT JOIN clients cl ON c.client_id = cl.id
      LEFT JOIN products p ON c.product_id = p.id
      LEFT JOIN verification_tasks vt ON vt.case_id = c.id
      WHERE (${searchConditions.join(' OR ')})
      ORDER BY c.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await pool.query(query, [...searchParams, limit, offset]);

    // Deduplicate results in memory (since we removed DISTINCT ON)
    const uniqueCases = new Map();
    result.rows.forEach(row => {
      if (!uniqueCases.has(row.id)) {
        uniqueCases.set(row.id, row);
      }
    });

    const uniqueRows = Array.from(uniqueCases.values());

    // Calculate match scores and types
    const results = uniqueRows.map(row => {
      const matchTypes: string[] = [];
      let matchScore = 0;

      // Exact PAN match
      if (pan && row.pan_number === pan.trim().toUpperCase()) {
        matchTypes.push('PAN');
        matchScore += 100;
      }

      // Mobile match
      if (mobile) {
        const cleanMobile = mobile.trim().replace(/\D/g, '');
        if (row.customer_phone?.includes(cleanMobile)) {
          matchTypes.push('Mobile');
          matchScore += 80;
        }
      }

      // Name match (fuzzy)
      if (name) {
        const searchName = name.trim().toLowerCase();
        const caseName = (row.customer_name || '').toLowerCase();
        if (caseName.includes(searchName) || searchName.includes(caseName)) {
          matchTypes.push('Name');
          matchScore += 60;
        }
      }

      // Address match (fuzzy)
      if (address) {
        const searchAddr = address.trim().toLowerCase();
        const caseAddr = (row.address || '').toLowerCase();
        if (caseAddr.includes(searchAddr) || searchAddr.includes(caseAddr)) {
          matchTypes.push('Address');
          matchScore += 40;
        }
      }

      return {
        id: row.id,
        caseId: row.case_id,
        caseNumber: row.case_number,
        name: row.customer_name,
        mobile: row.customer_phone,
        pan: row.pan_number,
        client: row.client_name,
        product: row.product_name,
        address: row.address || '',
        status: row.status,
        createdAt: row.created_at,
        matchTypes,
        matchScore,
      };
    });

    // Sort by match score (highest first)
    results.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      success: true,
      data: {
        results,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Error in searchGlobalDuplicates controller', { error });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to search for cases',
        code: 'GLOBAL_SEARCH_ERROR',
      },
    });
  }
};
