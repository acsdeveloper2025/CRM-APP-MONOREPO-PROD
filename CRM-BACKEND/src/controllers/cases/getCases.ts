import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { query as dbQuery } from '../../config/database';
import { CaseRow } from '../../types/database';
import { isFieldExecutionActor, isScopedOperationsUser } from '@/security/rbacAccess';
import { CASE_SORT_MAP, buildCasesBaseWhereClause } from './queryBuilder';

// GET /api/cases - List cases with filtering, sorting, and pagination (Enterprise Enhanced)
// Extracted verbatim from casesController (§7 decomposition); behaviour pinned
// by cases.integration.test.ts (nested list envelope + pagination + limit).
export const getCases = async (req: AuthenticatedRequest, res: Response) => {
  const startTime = Date.now();

  try {
    const page = Number(Array.isArray(req.query.page) ? req.query.page[0] : req.query.page || 1);
    const limit = Math.min(
      500,
      Math.max(
        1,
        Number(Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit || 50)
      )
    );
    const sortBy = (
      Array.isArray(req.query.sortBy) ? req.query.sortBy[0] : req.query.sortBy || 'updatedAt'
    ) as string;
    const sortOrder = (
      Array.isArray(req.query.sortOrder) ? req.query.sortOrder[0] : req.query.sortOrder || 'desc'
    ) as string;
    const status = req.query.status as string;

    // Build WHERE via shared helper (single source of WHERE-truth shared
    // with /export + /stats). All filters EXCEPT `status` live in the
    // base (so the stats query can ignore the active tab's status filter
    // and report partition counters for ALL statuses).
    const where = await buildCasesBaseWhereClause(req);
    const baseConditions = where.baseConditions;
    const baseParams = where.baseParams;
    const baseParamIndex = where.baseParamIndex;

    // Track scope flags for downstream logging (preserved from old code).
    const isExecutionActor = isFieldExecutionActor(req.user);
    const isScopedOps = isScopedOperationsUser(req.user);

    // Build FULL WHERE conditions for listing (statistics block was removed
    // 2026-05-23 along with its dedicated baseWhereClause).
    const conditions = [...baseConditions];
    const params = [...baseParams];
    let paramIndex = baseParamIndex;

    // Status filter (applied to listing but NOT to statistics)
    if (status) {
      conditions.push(`c.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    // Build FINAL WHERE clause for listing
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // API contract: sortBy is camelCase. Validated against shared
    // CASE_SORT_MAP (module-scope) — pendingDuration is computed below.
    let safeSortBy =
      sortBy && (CASE_SORT_MAP[sortBy] || sortBy === 'pendingDuration') ? sortBy : 'caseId';
    let safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Custom sorting logic based on status filter
    if (status === 'COMPLETED' && !sortBy) {
      // For completed cases: sort by completion time descending (most recently completed first)
      safeSortBy = 'completedAt';
      safeSortOrder = 'DESC';
    } else if (status === 'IN_PROGRESS' && !sortBy) {
      // For in progress cases: sort by in progress duration descending (longest in progress first)
      safeSortBy = 'pendingDuration';
      safeSortOrder = 'DESC';
    } else if (status === 'PENDING' && !sortBy) {
      // For pending cases: sort by pending duration descending (longest pending first)
      safeSortBy = 'pendingDuration';
      safeSortOrder = 'DESC';
    } else if (!sortBy) {
      // For all cases: sort by case ID descending (newest cases first)
      safeSortBy = 'caseId';
      safeSortOrder = 'DESC';
    }

    // Calculate offset
    const offset = (Number(page) - 1) * Number(limit);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM cases c
      ${whereClause}
    `;

    const countResult = await dbQuery(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Inline statistics block REMOVED 2026-05-23 (post-filter-sweep cleanup).
    // All FE consumers migrated to GET /api/cases/stats during the Case
    // Management sub-sweep (commits dd52c9ea / d0102a25 / 6fadb2df). The
    // inline statsQuery was a wasted SQL round-trip per list fetch — zero
    // refs to `casesData.data.statistics` confirmed via grep before removal.
    // The dedicated /cases/stats endpoint (getCaseStats) is the single
    // source for case aggregates and stays cached via analytics keyGen.

    // Enhanced query with all 13 required fields for mobile app and custom sorting
    let orderByClause;
    if (safeSortBy === 'pendingDuration') {
      // Calculate pending duration: time since latest task assignment
      // (or case creation if never assigned).
      // 2026-04-28 F4.7.1: switched from case_assignment_history (orphan
      // table dropped) to verification_tasks (live task-level assignments).
      orderByClause = `
        ORDER BY
          CASE
            WHEN c.status IN ('PENDING', 'IN_PROGRESS') THEN
              COALESCE(
                EXTRACT(EPOCH FROM (NOW() - (
                  SELECT MAX(vt.assigned_at)
                  FROM verification_tasks vt
                  WHERE vt.case_id = c.id
                ))),
                EXTRACT(EPOCH FROM (NOW() - c.created_at))
              )
            ELSE 0
          END ${safeSortOrder}
      `;
    } else {
      const safeColumn = CASE_SORT_MAP[safeSortBy] || 'c.created_at';
      orderByClause = `ORDER BY ${safeColumn} ${safeSortOrder}`;
    }

    const casesQuery = `
      SELECT
        c.*,
        -- Get representative address, pincode, area from tasks
        (SELECT address FROM verification_tasks WHERE case_id = c.id LIMIT 1) as address,
        (SELECT p2.code FROM verification_tasks vt2 JOIN pincodes p2 ON p2.id = vt2.pincode_id WHERE vt2.case_id = c.id AND vt2.pincode_id IS NOT NULL LIMIT 1) as "taskPincode",
        (SELECT ar2.name FROM verification_tasks vt2 LEFT JOIN areas ar2 ON ar2.id = vt2.area_id WHERE vt2.case_id = c.id AND vt2.area_id IS NOT NULL LIMIT 1) as "taskAreaName",
        -- Client information (Field 3: Client)
        cl.name as client_name,
        cl.code as "clientCode",
        -- Product information (Field 4: Product)
        p.name as product_name,
        p.code as "productCode",
        -- Verification type information (Field 5: Verification Type)
        vt.name as verification_type_name,
        vt.code as "verificationTypeCode",
        -- Rate type information (for Area and Rate Type columns)
        rt.name as rate_type_name,
        rt.description as "rateTypeDescription",
        -- Area information derived from rate type (local/ogl classification)
        CASE
          WHEN LOWER(rt.name) = 'ogl' OR LOWER(rt.name) LIKE 'ogl%' OR LOWER(rt.description) LIKE '%out of geo%' THEN 'ogl'
          WHEN LOWER(rt.name) = 'local' OR LOWER(rt.name) LIKE 'local%' OR (LOWER(rt.description) LIKE '%local%' AND LOWER(rt.description) NOT LIKE '%out of geo%') THEN 'local'
          WHEN LOWER(rt.name) LIKE '%outstation%' OR LOWER(rt.description) LIKE '%outstation%' THEN 'outstation'
          ELSE 'standard'
        END as "areaType",
        -- Created by backend user information (Field 7: Created By Backend User)
        created_user.name as "createdByBackendUserName",
        created_user.email as "createdByBackendUserEmail",
        -- Calculate pending/in-progress duration for frontend display (based on case creation time)
        CASE
          WHEN c.status IN ('PENDING', 'IN_PROGRESS') THEN
            EXTRACT(EPOCH FROM (NOW() - c.created_at))
          ELSE NULL
        END as "pendingDurationSeconds",
        -- NEW: Verification task statistics for multi-task architecture
        COALESCE(task_stats.total_tasks, 0) as "totalTasks",
        COALESCE(task_stats.completed_tasks, 0) as "completedTasks",
        COALESCE(task_stats.pending_tasks, 0) as "pendingTasks",
        COALESCE(task_stats.in_progress_tasks, 0) as "inProgressTasks",
        COALESCE(task_stats.revisit_tasks, 0) as "revisitTasks",
        -- Representative assigned agent from tasks
        assigned_user.id as assigned_to,
        assigned_user.name as "assignedToName",
        assigned_user.email as "assignedToEmail"
      FROM cases c
      LEFT JOIN clients cl ON c.client_id = cl.id
      LEFT JOIN users created_user ON c.created_by_backend_user = created_user.id
      LEFT JOIN products p ON c.product_id = p.id
      LEFT JOIN verification_types vt ON c.verification_type_id = vt.id
      LEFT JOIN LATERAL (
        SELECT rt2.name, rt2.description
        FROM verification_tasks vt3
        LEFT JOIN rate_types rt2 ON rt2.id = vt3.rate_type_id
        WHERE vt3.case_id = c.id AND vt3.rate_type_id IS NOT NULL
        ORDER BY vt3.created_at ASC
        LIMIT 1
      ) rt ON true
      LEFT JOIN LATERAL (
        SELECT u.id, u.name, u.email
        FROM verification_tasks vts
        LEFT JOIN users u ON vts.assigned_to = u.id
        WHERE vts.case_id = c.id AND vts.assigned_to IS NOT NULL
        ORDER BY vts.created_at DESC
        LIMIT 1
      ) assigned_user ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) as total_tasks,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_tasks,
          COUNT(*) FILTER (WHERE status = 'PENDING') as pending_tasks,
          COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress_tasks,
          COUNT(*) FILTER (WHERE task_type = 'REVISIT') as revisit_tasks
        FROM verification_tasks
        WHERE case_id = c.id
      ) task_stats ON true
      ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(Number(limit), offset);

    // Execute query with performance monitoring
    const queryStartTime = Date.now();
    const casesResult = await dbQuery(casesQuery, params);
    const queryTime = Date.now() - queryStartTime;

    // Calculate pagination info
    const totalPages = Math.ceil(total / Number(limit));

    // Transform data to match frontend expectations
    const transformedData = casesResult.rows.map((row: CaseRow & Record<string, unknown>) => ({
      ...row,
      // Provide flat fields for frontend compatibility
      clientName: row.clientName,
      clientCode: row.clientCode,
      productName: row.productName,
      productCode: row.productCode,
      // Transform task statistics (ensure proper field names)
      totalTasks: row.totalTasks || 0,
      completedTasks: row.completedTasks || 0,
      pendingTasks: row.pendingTasks || 0,
      inProgressTasks: row.inProgressTasks || 0,
      revisitTasks: row.revisitTasks || 0,
      // Transform client data to nested object
      client: row.clientName
        ? {
            id: row.clientId,
            name: row.clientName,
            code: row.clientCode,
          }
        : null,
      // Transform assigned user data to nested object
      assignedTo: row.assignedToName
        ? {
            id: row.assignedTo,
            name: row.assignedToName,
            username: row.assignedToEmail,
            employeeId: row.assignedToEmail,
          }
        : null,
      // Transform product data to nested object
      product: row.productName
        ? {
            id: row.productId,
            name: row.productName,
            code: row.productCode,
          }
        : null,
      // Transform created by backend user data to nested object
      createdByBackendUser: row.createdByBackendUserName
        ? {
            id: row.createdByBackendUser,
            name: row.createdByBackendUserName,
            employeeId: row.createdByBackendUserEmail,
          }
        : null,
      // Pass raw assignedTo for backwards compatibility if needed
      assignedToId: row.assignedTo,
    }));

    const response = {
      success: true,
      data: {
        data: transformedData,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages,
        },
      },
      metadata: {
        queryTime,
        totalResponseTime: Date.now() - startTime,
        cached: false,
        resultCount: casesResult.rows.length,
      },
      message: 'Cases retrieved successfully',
    };

    // Add performance headers
    res.set({
      'X-Query-Time': queryTime.toString(),
      'X-Total-Time': (Date.now() - startTime).toString(),
      'X-Result-Count': casesResult.rows.length.toString(),
    });

    logger.info('Cases retrieved', {
      userId: req.user?.id,
      executionActor: isExecutionActor,
      scopedOps: isScopedOps,
      page,
      limit,
      total,
      queryTime,
      totalTime: Date.now() - startTime,
    });

    res.json(response);
  } catch (error) {
    logger.error('Error retrieving cases:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cases',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
