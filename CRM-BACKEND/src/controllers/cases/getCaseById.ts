import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { query as dbQuery } from '../../config/database';
import { QueryParams } from '../../types/database';
import { isFieldExecutionActor, isScopedOperationsUser } from '@/security/rbacAccess';
import { getScopedOperationalUserIds } from '@/security/userScope';

// GET /api/cases/:id - Get case by ID
// Extracted verbatim from casesController (§7 decomposition); behaviour pinned
// by cases.integration.test.ts (GET /api/cases/:id found 200 + 404).
export const getCaseById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? String(rawId[0]) : String(rawId || '');
    logger.info(`getCaseById called with id: ${id}`);

    // Check if id is numeric (caseId) or UUID (id)
    const isNumeric = /^\d+$/.test(id);

    // Role-based access control
    const userId = req.user!.id;
    const isExecutionActor = isFieldExecutionActor(req.user);
    const isScopedOps = isScopedOperationsUser(req.user);
    const hierarchyUserIds = userId ? await getScopedOperationalUserIds(userId) : undefined;

    // Build query with role-based filtering
    let caseQuery = `
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
        -- Verification task statistics
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
      WHERE ${isNumeric ? 'c.case_id = $1' : 'c.id = $1'}
    `;

    const queryParams: QueryParams = [isNumeric ? parseInt(id) : id];

    // Add role-based filtering for FIELD_AGENT - filter by task-level assignment AND pincode/area
    if (isExecutionActor) {
      const { getAssignedPincodeIds } = await import('@/middleware/pincodeAccess');
      const { getAssignedAreaIds } = await import('@/middleware/areaAccess');

      const assignedPincodeIds = await getAssignedPincodeIds(userId);
      const assignedAreaIds = await getAssignedAreaIds(userId);

      // Build complex filter: (assigned to task) OR (task in assigned pincode/area)
      const fieldAgentConditions: string[] = [];
      let paramIndex = queryParams.length + 1;

      // Condition 1: Directly assigned to a task
      fieldAgentConditions.push(`EXISTS (
        SELECT 1 FROM verification_tasks vt
        WHERE vt.case_id = c.id
        AND vt.assigned_to = $${paramIndex}
      )`);
      queryParams.push(userId);
      paramIndex++;

      // Condition 2: Task in assigned pincode (F5.1.2 Phase B: int FK swap)
      if (assignedPincodeIds && assignedPincodeIds.length > 0) {
        fieldAgentConditions.push(`EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = c.id
          AND vt.pincode_id = ANY($${paramIndex}::int[])
        )`);
        queryParams.push(assignedPincodeIds);
        paramIndex++;
      }

      // Condition 3: Task in assigned area
      if (assignedAreaIds && assignedAreaIds.length > 0) {
        fieldAgentConditions.push(`EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = c.id
          AND vt.area_id = ANY($${paramIndex}::int[])
        )`);
        queryParams.push(assignedAreaIds);
        paramIndex++;
      }

      // Apply the combined filter
      if (fieldAgentConditions.length > 0) {
        caseQuery += ` AND (${fieldAgentConditions.join(' OR ')})`;
      } else {
        // No assignments, deny access
        return res.status(403).json({
          success: false,
          message: 'Access denied: No territory assignments found for your account',
          error: { code: 'NO_TERRITORY_ACCESS' },
        });
      }
    } else if (isScopedOps) {
      if (hierarchyUserIds) {
        if (hierarchyUserIds.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: No users found in your reporting scope',
            error: { code: 'NO_HIERARCHY_SCOPE' },
          });
        }
        caseQuery += ` AND (
          c.created_by_backend_user = ANY($${queryParams.length + 1}::uuid[]) OR
          EXISTS (
            SELECT 1 FROM verification_tasks vt_scope
            WHERE vt_scope.case_id = c.id
              AND vt_scope.assigned_to = ANY($${queryParams.length + 1}::uuid[])
          )
        )`;
        queryParams.push(hierarchyUserIds);
      } else {
        // Filter by client and product assignments for BACKEND_USER
        const { getAssignedClientIds } = await import('@/middleware/clientAccess');
        const { getAssignedProductIds } = await import('@/middleware/productAccess');

        let assignedClientIds = await getAssignedClientIds(userId);
        let assignedProductIds = await getAssignedProductIds(userId);

        // P13.B — narrow by active scope when the user has locked scope to
        // a specific client/product. Same intersection pattern as P13.A:
        // if the active scope value is not in the user's baseline assigned
        // set, fall through to [-1] so the query returns no rows.
        if (req.activeScope?.clientId != null && assignedClientIds) {
          assignedClientIds = assignedClientIds.includes(req.activeScope.clientId)
            ? [req.activeScope.clientId]
            : [-1];
        }
        if (req.activeScope?.productId != null && assignedProductIds) {
          assignedProductIds = assignedProductIds.includes(req.activeScope.productId)
            ? [req.activeScope.productId]
            : [-1];
        }

        if (assignedClientIds && assignedClientIds.length > 0) {
          caseQuery += ` AND c.client_id = ANY($${queryParams.length + 1}::int[])`;
          queryParams.push(assignedClientIds);
        } else if (assignedClientIds && assignedClientIds.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: No clients assigned to your account',
            error: { code: 'NO_CLIENT_ACCESS' },
          });
        }

        if (assignedProductIds && assignedProductIds.length > 0) {
          caseQuery += ` AND c.product_id = ANY($${queryParams.length + 1}::int[])`;
          queryParams.push(assignedProductIds);
        } else if (assignedProductIds && assignedProductIds.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: No products assigned to your account',
            error: { code: 'NO_PRODUCT_ACCESS' },
          });
        }
      }

      // P13.B — active scope intersection applies regardless of which
      // upstream branch (hierarchy vs baseline assigned-IDs) was taken.
      // When the user has locked scope to a specific client/product,
      // reject cases outside that scope.
      if (req.activeScope?.clientId != null) {
        caseQuery += ` AND c.client_id = $${queryParams.length + 1}`;
        queryParams.push(req.activeScope.clientId);
      }
      if (req.activeScope?.productId != null) {
        caseQuery += ` AND c.product_id = $${queryParams.length + 1}`;
        queryParams.push(req.activeScope.productId);
      }
    }

    const result = await dbQuery(caseQuery, queryParams);

    if (result.rows.length === 0) {
      const message = isExecutionActor
        ? 'Case not found or access denied. You can only view cases assigned to you.'
        : 'Case not found';

      return res.status(404).json({
        success: false,
        message,
        error: { code: 'NOT_FOUND' },
      });
    }

    const caseRow = result.rows[0];

    // F5.3.1 cleanup (2026-04-29): legacy `verifications` + `visits` tables
    // were dropped. The applicants list is now flat — verification work
    // lives on `verification_tasks` (returned by /api/verification-tasks
    // endpoints) and KYC docs on `kyc_document_verifications`.
    const applicantsResult = await dbQuery(
      `SELECT id, name, mobile, role
         FROM applicants
        WHERE case_id = $1
        ORDER BY created_at ASC`,
      [caseRow.id]
    );
    const applicants = applicantsResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      mobile: row.mobile,
      role: row.role,
      verifications: [] as Array<unknown>, // shape kept for backwards-compat; always empty
    }));

    // Transform data to match frontend expectations (Backward Compatibility + New Hierarchy)
    const transformedData = {
      ...caseRow,
      applicants,
      // Provide flat fields for frontend compatibility (derived from first applicant/verification/visit)
      clientName: caseRow.clientName,
      clientCode: caseRow.clientCode,
      assignedToName: caseRow.assignedToName,
      productName: caseRow.productName,
      productCode: caseRow.productCode,
      // Task statistics
      totalTasks: caseRow.totalTasks || 0,
      completedTasks: caseRow.completedTasks || 0,
      pendingTasks: caseRow.pendingTasks || 0,
      inProgressTasks: caseRow.inProgressTasks || 0,
      revisitTasks: caseRow.revisitTasks || 0,
      // Transform client data
      client: caseRow.clientName
        ? {
            id: caseRow.clientId,
            name: caseRow.clientName,
            code: caseRow.clientCode,
          }
        : null,
      // Transform assigned user
      assignedTo: caseRow.assignedToName
        ? {
            id: caseRow.assignedTo,
            name: caseRow.assignedToName,
            username: caseRow.assignedToEmail,
            employeeId: caseRow.assignedToEmail,
          }
        : null,
      // Transform product data
      product: caseRow.productName
        ? {
            id: caseRow.productId,
            name: caseRow.productName,
            code: caseRow.productCode,
          }
        : null,
      // Transform created by user
      createdByBackendUser: caseRow.createdByBackendUserName
        ? {
            id: caseRow.createdByBackendUser,
            name: caseRow.createdByBackendUserName,
            employeeId: caseRow.createdByBackendUserEmail,
          }
        : null,
    };

    logger.info('Case hierarchy retrieved', {
      userId: req.user?.id,
      caseId: id,
      applicantCount: applicants.length,
    });

    res.json({
      success: true,
      data: transformedData,
      message: 'Case retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve case',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
