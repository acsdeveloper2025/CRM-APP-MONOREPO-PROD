import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query as dbQuery } from '@/config/database';
import { QueryParams } from '@/types/database';
import { getAssignedClientIds } from '@/middleware/clientAccess';
import { getAssignedProductIds } from '@/middleware/productAccess';
import { isFieldExecutionActor, isScopedOperationsUser } from '@/security/rbacAccess';
import { getScopedOperationalUserIds } from '@/security/userScope';
import { resolveDataScope } from '@/security/dataScope';
import { CaseAnalyticsRow } from '../types/reports';
import ExcelJS from 'exceljs';

interface MISReportRow {
  taskId: number;
  taskNumber: string;
  taskTitle: string;
  taskVerificationType: string;
  taskStatus: string;
  taskPriority: string;
  assignedFieldUser: string;
  fieldUserEmployeeId: string;
  address: string;
  pincode: string;
  rateType: string;
  estimatedAmount: number;
  actualAmount: number;
  taskCreatedDate: string;
  taskStartedDate: string;
  taskCompletionDate: string;
  taskTatDays: number;
  trigger: string;
  applicantType: string;
  formSubmissionId: string;
  formType: string;
  formSubmittedDate: string;
  formValidationStatus: string;
  caseNumber: string;
  customerName: string;
  customerPhone: string;
  customerCallingCode: string;
  clientName: string;
  clientCode: string;
  productName: string;
  caseStatus: string;
  casePriority: string;
  caseCreatedDate: string;
  backendUserName: string;
  backendUserEmployeeId: string;
  verificationTypeName: string;
}

interface DashboardSummaryRow {
  totalCases: string;
  pendingCases: string;
  inProgressCases: string;
  completedCases: string;
  activeUsers: string;
  activeClients: string;
}

const getBackendUserReportScope = async (req: AuthenticatedRequest) => {
  if (!req.user?.id || !isScopedOperationsUser(req.user)) {
    return {
      clientIds: undefined as number[] | undefined,
      productIds: undefined as number[] | undefined,
      scopedUserIds: undefined as string[] | undefined,
      creatorUserIds: undefined as string[] | undefined,
    };
  }

  // Creator-based scope: BACKEND_USER sees only their created cases.
  const rawScopedUserIds = await getScopedOperationalUserIds(req.user.id);
  const creatorUserIds = rawScopedUserIds ?? [req.user.id];

  // Also keep client/product for backwards-compatible filtering
  const scope = await resolveDataScope(req);
  const scopedUserIds = scope.scopedUserIds;

  const clientIds = scope.assignedClientIds;
  const productIds = scope.assignedProductIds;

  return {
    clientIds: clientIds && clientIds.length > 0 ? clientIds : [-1],
    productIds: productIds && productIds.length > 0 ? productIds : [-1],
    scopedUserIds,
    creatorUserIds,
  };
};

// ===== PHASE 1: NEW DATA VISUALIZATION & REPORTING APIs =====

// 1.1 FORM SUBMISSION DATA APIs

// GET /api/reports/form-submissions - Get all form submissions with analytics
export const getFormSubmissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const formType = (req.query.formType as unknown as string) || '';
    const dateFrom = (req.query.dateFrom as unknown as string) || '';
    const dateTo = (req.query.dateTo as unknown as string) || '';
    const agentId = (req.query.agentId as unknown as string) || '';
    const validationStatus = (req.query.validationStatus as unknown as string) || '';
    const caseId = (req.query.caseId as unknown as string) || '';
    const limit = Number(
      Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit || 100
    );
    const offset = Number(
      Array.isArray(req.query.offset) ? req.query.offset[0] : req.query.offset || 0
    );

    // Build WHERE conditions using CORRECT snakeCase column names
    const conditions: string[] = [];
    const params: QueryParams = [];
    let paramIndex = 1;
    const userId = req.user!.id;
    const hierarchyUserIds = userId ? await getScopedOperationalUserIds(userId) : undefined;

    if (isFieldExecutionActor(req.user) && userId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM verification_tasks vt_scope
        WHERE vt_scope.case_id = c.id
          AND vt_scope.assigned_to = $${paramIndex}
      )`);
      params.push(userId);
      paramIndex++;
    } else if (isScopedOperationsUser(req.user) && userId) {
      if (hierarchyUserIds) {
        if (hierarchyUserIds.length === 0) {
          conditions.push('FALSE');
        } else {
          // Creator-based scope (RBAC audit)
          conditions.push(`c.created_by_backend_user = ANY($${paramIndex}::uuid[])`);
          params.push(hierarchyUserIds);
          paramIndex++;
        }
      } else {
        const [assignedClientIds, assignedProductIds] = await Promise.all([
          getAssignedClientIds(userId),
          getAssignedProductIds(userId),
        ]);
        if (
          !assignedClientIds ||
          !assignedProductIds ||
          assignedClientIds.length === 0 ||
          assignedProductIds.length === 0
        ) {
          conditions.push('FALSE');
        } else {
          conditions.push(`c.client_id = ANY($${paramIndex}::int[])`);
          params.push(assignedClientIds);
          paramIndex++;
          conditions.push(`c.product_id = ANY($${paramIndex}::int[])`);
          params.push(assignedProductIds);
          paramIndex++;
        }
      }
    }

    if (dateFrom) {
      conditions.push(`tfs.submitted_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`tfs.submitted_at <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }
    if (agentId) {
      conditions.push(`tfs.submitted_by = $${paramIndex}`);
      params.push(agentId);
      paramIndex++;
    }
    if (validationStatus) {
      conditions.push(`tfs.validation_status = $${paramIndex}`);
      params.push(validationStatus);
      paramIndex++;
    }
    if (caseId) {
      conditions.push(`tfs.case_id = $${paramIndex}`);
      params.push(caseId);
      paramIndex++;
    }
    if (formType) {
      conditions.push(`tfs.form_type = $${paramIndex}`);
      params.push(formType);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get form submissions from taskFormSubmissions table (using snakeCase)
    const query = `
      SELECT
        tfs.id,
        tfs.form_type,
        tfs.case_id,
        tfs.verification_task_id,
        tfs.submitted_by,
        tfs.submitted_at,
        tfs.validation_status,
        tfs.validated_by,
        tfs.validated_at,
        c.customer_name,
        c.case_id as case_number,
        u.name as agent_name,
        u.employee_id as employee_id,
        vt.task_title as verification_type_name,
        0 as attachment_count
      FROM task_form_submissions tfs
      LEFT JOIN cases c ON tfs.case_id = c.id
      LEFT JOIN users u ON tfs.submitted_by = u.id
      LEFT JOIN verification_tasks vt ON tfs.verification_task_id = vt.id
      ${whereClause}
      ORDER BY tfs.submitted_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const result = await dbQuery(query, params);

    // Get summary statistics (using snakeCase)
    const summaryQuery = `
      SELECT
        COUNT(*) as total_submissions,
        COUNT(CASE WHEN validation_status = 'VALID' THEN 1 END) as valid_submissions,
        COUNT(CASE WHEN validation_status = 'PENDING' THEN 1 END) as pending_submissions,
        COUNT(CASE WHEN validation_status = 'INVALID' THEN 1 END) as invalid_submissions,
        COUNT(CASE WHEN form_type = 'RESIDENCE' THEN 1 END) as residence_forms,
        COUNT(CASE WHEN form_type = 'OFFICE' THEN 1 END) as office_forms,
        COUNT(CASE WHEN form_type = 'BUSINESS' THEN 1 END) as business_forms
      FROM task_form_submissions
      ${whereClause.replace(/tfs\./g, '')}
    `;

    const summaryParams = params.slice(0, -2); // Remove limit and offset
    const summaryResult = await dbQuery(summaryQuery, summaryParams);
    const summary = summaryResult.rows[0] || {
      totalSubmissions: 0,
      validSubmissions: 0,
      pendingSubmissions: 0,
      invalidSubmissions: 0,
      residenceForms: 0,
      officeForms: 0,
      businessForms: 0,
    };

    logger.info('Form submissions fetched', {
      userId: req.user?.id,
      total: summary.totalSubmissions,
      filters: { formType, dateFrom, dateTo, agentId, validationStatus },
    });

    res.json({
      success: true,
      data: {
        submissions: result.rows,
        summary: {
          totalSubmissions: Number(summary.totalSubmissions),
          validSubmissions: Number(summary.validSubmissions),
          pendingSubmissions: Number(summary.pendingSubmissions),
          invalidSubmissions: Number(summary.invalidSubmissions),
          residenceForms: Number(summary.residenceForms),
          officeForms: Number(summary.officeForms),
          businessForms: Number(summary.businessForms),
        },
        pagination: {
          limit,
          offset,
          total: Number(summary.totalSubmissions),
        },
      },
      message: 'Form submissions retrieved successfully (table may be empty)',
    });
  } catch (error) {
    logger.error('Error fetching form submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch form submissions',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// GET /api/reports/form-submissions/:formType - Get specific form type submissions
export const getFormSubmissionsByType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const formType = String(req.params.formType || '');
    const dateFrom = (req.query.dateFrom as unknown as string) || '';
    const dateTo = (req.query.dateTo as unknown as string) || '';
    const agentId = (req.query.agentId as unknown as string) || '';
    const limit = Number(
      Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit || 50
    );
    const offset = Number(
      Array.isArray(req.query.offset) ? req.query.offset[0] : req.query.offset || 0
    );

    if (!['RESIDENCE', 'OFFICE', 'BUSINESS'].includes(formType.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid form type. Must be RESIDENCE, OFFICE, or BUSINESS',
        error: { code: 'INVALID_FORM_TYPE' },
      });
    }

    const conditions: string[] = [];
    const params: QueryParams = [];
    let paramIndex = 1;

    if (dateFrom) {
      const alias = formType.toUpperCase() === 'RESIDENCE' ? 'r' : 'o';
      conditions.push(`${alias}.created_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      const alias = formType.toUpperCase() === 'RESIDENCE' ? 'r' : 'o';
      conditions.push(`${alias}.created_at <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }
    if (agentId) {
      const alias = formType.toUpperCase() === 'RESIDENCE' ? 'r' : 'o';
      conditions.push(`${alias}.created_by = $${paramIndex}`);
      params.push(agentId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let query = '';
    if (formType.toUpperCase() === 'RESIDENCE') {
      query = `
        SELECT
          r.*,
          c.customer_name,
          c.case_id as case_number,
          u.name as "agentName",
          u.employee_id,
          COUNT(a.id) as "attachmentCount"
        FROM residence_verification_reports r
        LEFT JOIN cases c ON r.case_id = c.case_id
        LEFT JOIN users u ON r.created_by = u.id
        LEFT JOIN attachments a ON a.case_id = c.id
        ${whereClause}
        GROUP BY r.id, c.customer_name, c.case_id, u.name, u.employee_id
        ORDER BY r.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
    } else if (formType.toUpperCase() === 'OFFICE') {
      query = `
        SELECT
          o.*,
          c.customer_name,
          c.case_id as case_number,
          u.name as "agentName",
          u.employee_id,
          COUNT(a.id) as "attachmentCount"
        FROM office_verification_reports o
        LEFT JOIN cases c ON o.case_id = c.case_id
        LEFT JOIN users u ON o.created_by = u.id
        LEFT JOIN attachments a ON a.case_id = c.id
        ${whereClause}
        GROUP BY o.id, c.customer_name, c.case_id, u.name, u.employee_id
        ORDER BY o.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
    }

    params.push(limit, offset);
    const result = await dbQuery(query, params);

    res.json({
      success: true,
      data: {
        formType: formType.toUpperCase(),
        submissions: result.rows,
        pagination: {
          limit,
          offset,
          total: result.rows.length,
        },
      },
      message: `${formType} form submissions retrieved successfully`,
    });
  } catch (error) {
    logger.error(`Error getting ${req.params.formType} form submissions:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to get ${req.params.formType} form submissions`,
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/reports/form-validation-status - Get form validation status overview
export const getFormValidationStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dateFrom = (req.query.dateFrom as unknown as string) || '';
    const dateTo = (req.query.dateTo as unknown as string) || '';

    const conditions: string[] = [];
    const params: QueryParams = [];
    let paramIndex = 1;

    if (dateFrom) {
      conditions.push(`createdAt >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`createdAt <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get validation status from taskFormSubmissions (using snakeCase)
    const validationQuery = `
      SELECT
        form_type,
        COUNT(*) as total_forms,
        COUNT(CASE WHEN validation_status = 'VALID' THEN 1 END) as validated_forms,
        COUNT(CASE WHEN validation_status = 'PENDING' THEN 1 END) as pending_forms,
        COUNT(CASE WHEN validation_status = 'INVALID' THEN 1 END) as invalid_forms,
        AVG(CASE WHEN validated_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (validated_at - submitted_at))/3600
            END) as avg_validation_time_hours
      FROM task_form_submissions
      ${whereClause}
      GROUP BY form_type
      ORDER BY form_type
    `;

    const validationResult = await dbQuery(validationQuery, params);

    const summary = validationResult.rows.reduce(
      (
        acc: {
          totalForms: number;
          validatedForms: number;
          pendingForms: number;
          invalidForms: number;
        },
        row
      ) => {
        acc.totalForms += parseInt(row.totalForms);
        acc.validatedForms += parseInt(row.validatedForms);
        acc.pendingForms += parseInt(row.pendingForms);
        acc.invalidForms += parseInt(row.invalidForms || 0);
        return acc;
      },
      { totalForms: 0, validatedForms: 0, pendingForms: 0, invalidForms: 0 }
    );

    res.json({
      success: true,
      data: {
        summary: {
          ...summary,
          validationRate:
            summary.totalForms > 0 ? (summary.validatedForms / summary.totalForms) * 100 : 0,
        },
        byFormType: validationResult.rows,
        generatedAt: new Date().toISOString(),
        generatedBy: req.user?.id,
      },
      message: 'Form validation status retrieved successfully',
    });
  } catch (error) {
    logger.error('Error getting form validation status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get form validation status',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// 1.2 CASE ANALYTICS APIs

// GET /api/reports/case-analytics - Comprehensive case analytics
export const getCaseAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dateFrom = (req.query.dateFrom as unknown as string) || '';
    const dateTo = (req.query.dateTo as unknown as string) || '';
    const clientId = (req.query.clientId as unknown as string) || '';
    const agentId = (req.query.agentId as unknown as string) || '';
    const status = (req.query.status as unknown as string) || '';

    const conditions: string[] = [];
    const params: QueryParams = [];
    let paramIndex = 1;

    if (dateFrom) {
      conditions.push(`c.created_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`c.created_at <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }
    if (clientId) {
      conditions.push(`c.client_id = $${paramIndex}`);
      params.push(parseInt(clientId));
      paramIndex++;
    }
    if (agentId) {
      // cases table has no assigned_to column — filter via
      // verification_tasks assignment instead.
      conditions.push(`EXISTS (
        SELECT 1 FROM verification_tasks vt_agent
        WHERE vt_agent.case_id = c.id AND vt_agent.assigned_to = $${paramIndex}
      )`);
      params.push(agentId);
      paramIndex++;
    }
    if (status) {
      conditions.push(`c.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get comprehensive case analytics using multi-task architecture (snakeCase)
    const analyticsQuery = `
      SELECT
        c.*,
        cl.name as client_name,
        COUNT(DISTINCT vt.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN vt.status = 'COMPLETED' THEN vt.id END) as completed_tasks,
        COUNT(DISTINCT tfs.id) as form_submissions,
        0 as attachment_count,
        CASE
          WHEN COUNT(DISTINCT CASE WHEN vt.status = 'COMPLETED' THEN vt.id END) > 0
          THEN AVG(CASE
            WHEN vt.status = 'COMPLETED' AND vt.completed_at IS NOT NULL AND vt.first_assigned_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (vt.completed_at - vt.first_assigned_at))/86400
          END)
          ELSE NULL
        END as completion_days,
        CASE
          WHEN COUNT(DISTINCT vt.id) > 0
          THEN ROUND(
            COUNT(DISTINCT CASE WHEN vt.status = 'COMPLETED' THEN vt.id END)::numeric /
            COUNT(DISTINCT vt.id) * 100, 2
          )
          ELSE 0
        END as task_completion_percentage
      FROM cases c
      LEFT JOIN clients cl ON c.client_id = cl.id
      LEFT JOIN verification_tasks vt ON c.id = vt.case_id
      LEFT JOIN task_form_submissions tfs ON vt.id = tfs.verification_task_id
      ${whereClause}
      GROUP BY c.id, c.case_id, cl.name
      ORDER BY c.created_at DESC
    `;

    const analyticsResult = await dbQuery(analyticsQuery, params);

    // Calculate summary metrics
    const cases = analyticsResult.rows;
    const totalCases = cases.length;
    const completedCases = cases.filter(c => c.status === 'COMPLETED').length;
    const avgCompletionDays =
      cases
        .filter(c => c.completionDays !== null)
        .reduce((sum, c) => sum + parseFloat(c.completionDays), 0) /
        cases.filter(c => c.completionDays !== null).length || 0;

    const avgFormCompletion =
      cases.reduce((sum, c) => sum + parseFloat(c.formCompletionPercentage), 0) / totalCases || 0;

    // Status distribution
    const statusDistribution = cases.reduce(
      (acc: Record<string, number>, c: CaseAnalyticsRow) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    res.json({
      success: true,
      data: {
        summary: {
          totalCases,
          completedCases,
          completionRate: totalCases > 0 ? (completedCases / totalCases) * 100 : 0,
          avgCompletionDays: Math.round(avgCompletionDays * 100) / 100,
          avgFormCompletion: Math.round(avgFormCompletion * 100) / 100,
          statusDistribution,
        },
        cases,
        generatedAt: new Date().toISOString(),
        generatedBy: req.user?.id,
      },
      message: 'Case analytics generated successfully',
    });
  } catch (error) {
    logger.error('Error generating case analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate case analytics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/reports/case-timeline/:caseId - Get detailed case timeline
export const getCaseTimeline = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = String(req.params.caseId || '');

    // Get case details
    const caseQuery = `
      SELECT c.*, cl.name as client_name, u.name as "agent_name"
      FROM cases c
      LEFT JOIN clients cl ON c.client_id = cl.id
      LEFT JOIN users u ON c.assigned_to = u.id
      WHERE c.case_id = $1
    `;
    const caseResult = await dbQuery(caseQuery, [caseId]);

    if (caseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
        error: { code: 'CASE_NOT_FOUND' },
      });
    }

    const caseData = caseResult.rows[0];

    if (isFieldExecutionActor(req.user)) {
      const taskAccess = await dbQuery(
        `SELECT 1
         FROM verification_tasks vt
         JOIN cases c ON vt.case_id = c.id
         WHERE c.case_id = $1 AND vt.assigned_to = $2
         LIMIT 1`,
        [caseId, req.user!.id]
      );
      if (taskAccess.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
          error: { code: 'CASE_ACCESS_DENIED' },
        });
      }
    }

    if (isScopedOperationsUser(req.user) && req.user?.id) {
      const scopedUserIds = await getScopedOperationalUserIds(req.user.id);
      const creatorIds = scopedUserIds ?? [req.user.id];
      if (creatorIds.length > 0) {
        const scopeCheck = await dbQuery(
          `SELECT 1
           FROM cases c
           WHERE c.case_id = $1
             AND c.created_by_backend_user = ANY($2::uuid[])
           LIMIT 1`,
          [caseId, creatorIds]
        );
        if (scopeCheck.rows.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Access denied',
            error: { code: 'CASE_ACCESS_DENIED' },
          });
        }
      } else {
        const [assignedClientIds, assignedProductIds] = await Promise.all([
          getAssignedClientIds(req.user.id),
          getAssignedProductIds(req.user.id),
        ]);

        if (
          assignedClientIds.length === 0 ||
          assignedProductIds.length === 0 ||
          !assignedClientIds.includes(Number(caseData.clientId)) ||
          !assignedProductIds.includes(Number(caseData.productId))
        ) {
          return res.status(403).json({
            success: false,
            message: 'Access denied',
            error: { code: 'CASE_ACCESS_DENIED' },
          });
        }
      }
    }

    // Get timeline events
    const timelineQuery = `
      SELECT
        'CASE_CREATED' as event_type,
        c.created_at as event_date,
        creator.name as performed_by,
        'Case created and assigned' as description,
        jsonb_build_object('status', c.status, 'priority', c.priority) as metadata
      FROM cases c
      LEFT JOIN users creator ON c.created_by_backend_user = creator.id
      WHERE c.case_id = $1

      UNION ALL

      SELECT
        'RESIDENCE_FORM_SUBMITTED' as event_type,
        r.created_at as event_date,
        u.name as performed_by,
        'Residence verification form submitted' as description,
        jsonb_build_object(
          'applicantName', r.applicant_name,
          'residenceConfirmed', r.residence_confirmed,
          'personMet', r.person_met
        ) as metadata
      FROM residence_verification_reports r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.case_id = $1

      UNION ALL

      SELECT
        'OFFICE_FORM_SUBMITTED' as event_type,
        o.created_at as event_date,
        u.name as performed_by,
        'Office verification form submitted' as description,
        jsonb_build_object(
          'companyName', o.company_name,
          'officeConfirmed', o.office_confirmed,
          'personMet', o.person_met
        ) as metadata
      FROM office_verification_reports o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.case_id = $1

      UNION ALL

      SELECT
        'ATTACHMENT_UPLOADED' as event_type,
        a.created_at as event_date,
        u.name as performed_by,
        CONCAT('File uploaded: ', a.file_name) as description,
        jsonb_build_object(
          'fileName', a.file_name,
          'fileType', a.file_type,
          'fileSize', a.file_size
        ) as metadata
      FROM attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.case_id = (SELECT id FROM cases WHERE case_id = $1)

      ORDER BY event_date ASC
    `;

    const timelineResult = await dbQuery(timelineQuery, [caseId]);

    res.json({
      success: true,
      data: {
        case: caseData,
        timeline: timelineResult.rows,
        summary: {
          totalEvents: timelineResult.rows.length,
          formsSubmitted: timelineResult.rows.filter(e => e.eventType.includes('FORM_SUBMITTED'))
            .length,
          attachmentsUploaded: timelineResult.rows.filter(
            e => e.eventType === 'ATTACHMENT_UPLOADED'
          ).length,
        },
      },
      message: 'Case timeline retrieved successfully',
    });
  } catch (error) {
    logger.error('Error getting case timeline:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get case timeline',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// 1.3 AGENT PERFORMANCE APIs

// GET /api/reports/agent-performance - Get agent performance metrics
export const getAgentPerformance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dateFrom = (req.query.dateFrom as unknown as string) || '';
    const dateTo = (req.query.dateTo as unknown as string) || '';
    const agentId = (req.query.agentId as unknown as string) || '';
    const departmentId = (req.query.departmentId as unknown as string) || '';

    // Build WHERE conditions for verification tasks
    const conditions: string[] = [];
    const params: QueryParams = [];
    let paramIndex = 1;

    if (dateFrom) {
      conditions.push(`vt.created_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`vt.created_at <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }
    if (agentId) {
      conditions.push(`vt.assigned_to = $${paramIndex}`);
      params.push(agentId);
      paramIndex++;
    }
    if (departmentId) {
      conditions.push(`u.department_id = $${paramIndex}`);
      params.push(parseInt(departmentId));
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Simple query: Get all verification tasks with agent, client, product, rate type info
    const performanceQuery = `
      SELECT
        u.id as agent_id,
        u.name as agent_name,
        u.employee_id as employee_id,
        vt.id as task_id,
        vt.task_number,
        vt.status,
        vt.created_at,
        vt.updated_at,
        vt.estimated_amount,
        vt.actual_amount,
        cl.name as client_name,
        p.name as product_name,
        vtype.name as verification_type,
        rt.name as rate_type,
        CASE
          WHEN vt.status = 'COMPLETED' AND vt.completed_at IS NOT NULL AND vt.current_assigned_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (vt.completed_at - vt.current_assigned_at))/86400
          ELSE NULL
        END as completion_days
      FROM verification_tasks vt
      INNER JOIN users u ON vt.assigned_to = u.id
      LEFT JOIN cases cas ON vt.case_id = cas.id
      LEFT JOIN clients cl ON cas.client_id = cl.id
      LEFT JOIN products p ON cas.product_id = p.id
      LEFT JOIN verification_types vtype ON vt.verification_type_id = vtype.id
      LEFT JOIN rate_types rt ON vt.rate_type_id = rt.id
      ${whereClause}
      ORDER BY vt.created_at DESC
    `;

    const result = await dbQuery(performanceQuery, params);
    const tasks = result.rows;

    interface AgentPerformanceAccumulator {
      id: string;
      name: string;
      employeeId: string;
      totalTasks: number;
      completedTasks: number;
      inTat: number;
      outTat: number;
      localTasks: number;
      oglTasks: number;
      totalAmount: number;
      clients: Set<string>;
      products: Set<string>;
      tasks: Record<string, unknown>[];
    }

    // Group by agent and calculate metrics
    const agentMap = new Map<string, AgentPerformanceAccumulator>();

    tasks.forEach(task => {
      const taskAgentId = task.agentId;

      if (!agentMap.has(taskAgentId)) {
        agentMap.set(taskAgentId, {
          id: task.agentId,
          name: task.agentName,
          employeeId: task.employeeId,
          totalTasks: 0,
          completedTasks: 0,
          inTat: 0,
          outTat: 0,
          localTasks: 0,
          oglTasks: 0,
          totalAmount: 0,
          clients: new Set(),
          products: new Set(),
          tasks: [],
        });
      }

      // agentMap was just populated above if missing, so .get is non-null here
      const agent = agentMap.get(taskAgentId)!;
      agent.totalTasks++;
      agent.tasks.push(task);

      if (task.status === 'COMPLETED') {
        agent.completedTasks++;

        // TAT calculation (assuming 2 days TAT)
        if (task.completionDays !== null) {
          if (task.completionDays <= 2) {
            agent.inTat++;
          } else {
            agent.outTat++;
          }
        }
      }

      // Rate type
      if (task.rateType?.toLowerCase().includes('local')) {
        agent.localTasks++;
      } else if (task.rateType?.toLowerCase().includes('ogl')) {
        agent.oglTasks++;
      }

      // Amount
      if (task.actualAmount) {
        agent.totalAmount += parseFloat(task.actualAmount);
      } else if (task.estimatedAmount) {
        agent.totalAmount += parseFloat(task.estimatedAmount);
      }

      // Clients and products
      if (task.clientName) {
        agent.clients.add(task.clientName);
      }
      if (task.productName) {
        agent.products.add(task.productName);
      }
    });

    // Convert to array and format
    const agents = Array.from(agentMap.values()).map(agent => ({
      id: agent.id,
      name: agent.name,
      employeeId: agent.employeeId,
      totalTasks: agent.totalTasks,
      completedTasks: agent.completedTasks,
      pendingTasks: agent.totalTasks - agent.completedTasks,
      inTat: agent.inTat,
      outTat: agent.outTat,
      localTasks: agent.localTasks,
      oglTasks: agent.oglTasks,
      totalAmount: Math.round(agent.totalAmount * 100) / 100,
      clients: Array.from(agent.clients),
      products: Array.from(agent.products),
      completionRate:
        agent.totalTasks > 0 ? Math.round((agent.completedTasks / agent.totalTasks) * 100) : 0,
    }));

    // Sort by total tasks
    agents.sort((a, b) => b.totalTasks - a.totalTasks);

    res.json({
      success: true,
      data: {
        summary: {
          totalAgents: agents.length,
          totalTasks: tasks.length,
          completedTasks: agents.reduce((sum, a) => sum + a.completedTasks, 0),
          inTat: agents.reduce((sum, a) => sum + a.inTat, 0),
          outTat: agents.reduce((sum, a) => sum + a.outTat, 0),
        },
        agents,
        generatedAt: new Date().toISOString(),
        generatedBy: req.user?.id,
      },
      message: 'Agent performance report generated successfully',
    });
  } catch (error) {
    logger.error('Error generating agent performance report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate agent performance report',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/reports/agent-productivity/:agentId - Get specific agent productivity
export const getAgentProductivity = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const agentId = String(req.params.agentId || '');
    const dateFrom = (req.query.dateFrom as unknown as string) || '';
    const dateTo = (req.query.dateTo as unknown as string) || '';

    // Verify agent exists
    const agentQuery = `
      SELECT u.*, d.name as "department_name"
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = $1
        AND EXISTS (
          SELECT 1
          FROM user_roles urf
          JOIN role_permissions rpf ON rpf.role_id = urf.role_id AND rpf.allowed = true
          JOIN permissions pf ON pf.id = rpf.permission_id
          WHERE urf.user_id = u.id AND pf.code = 'visit.submit'
        )
    `;
    const agentResult = await dbQuery(agentQuery, [agentId]);

    if (agentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Field agent not found',
        error: { code: 'AGENT_NOT_FOUND' },
      });
    }

    const agent = agentResult.rows[0];

    // cases table has no assigned_to — filter via verification_tasks
    const conditions: string[] = [
      'EXISTS (SELECT 1 FROM verification_tasks vt_a WHERE vt_a.case_id = c.id AND vt_a.assigned_to = $1)',
    ];
    const params: QueryParams = [agentId];
    let paramIndex = 2;

    if (dateFrom) {
      conditions.push(`c.created_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`c.created_at <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Get daily productivity data
    const productivityQuery = `
      SELECT
        DATE(c.created_at) as work_date,
        COUNT(DISTINCT c.id) as cases_assigned,
        COUNT(DISTINCT CASE WHEN c.status = 'COMPLETED' THEN c.id END) as cases_completed,
        COUNT(DISTINCT r.id) as residence_forms,
        COUNT(DISTINCT o.id) as office_forms,
        COUNT(DISTINCT a.id) as attachments_uploaded
      FROM cases c
      LEFT JOIN residence_verification_reports r ON c.case_id = r.case_id AND r.created_by = $1
      LEFT JOIN office_verification_reports o ON c.case_id = o.case_id AND o.created_by = $1
      LEFT JOIN attachments a ON c.id = a.case_id AND a.uploaded_by = $1
      ${whereClause}
      GROUP BY DATE(c.created_at)
      ORDER BY work_date DESC
    `;

    const productivityResult = await dbQuery(productivityQuery, params);

    res.json({
      success: true,
      data: {
        agent,
        dailyProductivity: productivityResult.rows,
        summary: {
          totalWorkDays: productivityResult.rows.length,
          avgCasesPerDay:
            productivityResult.rows.reduce((sum, day) => sum + parseInt(day.casesAssigned), 0) /
              productivityResult.rows.length || 0,
          avgFormsPerDay:
            productivityResult.rows.reduce(
              (sum, day) => sum + parseInt(day.residenceForms) + parseInt(day.officeForms),
              0
            ) / productivityResult.rows.length || 0,
        },
      },
      message: 'Agent productivity data retrieved successfully',
    });
  } catch (error) {
    logger.error('Error getting agent productivity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get agent productivity',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/reports/cases - Cases report
export const getCasesReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      dateFrom,
      dateTo,
      clientId,
      assignedToId,
      status,
      priority,
      format: _format = 'JSON',
    } = req.query;

    // Build WHERE conditions for database query
    const conditions: string[] = [];
    const params: QueryParams = [];
    let paramIndex = 1;
    const backendScope = await getBackendUserReportScope(req);

    if (dateFrom) {
      conditions.push(`c.created_at >= $${paramIndex}`);
      params.push(dateFrom as string);
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`c.created_at <= $${paramIndex}`);
      params.push(dateTo as string);
      paramIndex++;
    }
    if (status) {
      conditions.push(`c.status = $${paramIndex}`);
      params.push(status as string);
      paramIndex++;
    }
    if (clientId) {
      conditions.push(`c.client_id = $${paramIndex}`);
      params.push(parseInt(clientId as string));
      paramIndex++;
    }
    if (assignedToId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM verification_tasks vt_a
        WHERE vt_a.case_id = c.id AND vt_a.assigned_to = $${paramIndex}
      )`);
      params.push(assignedToId as string);
      paramIndex++;
    }
    if (priority) {
      conditions.push(`c.priority = $${paramIndex}`);
      params.push(priority as string);
      paramIndex++;
    }

    if (backendScope.creatorUserIds) {
      conditions.push(`c.created_by_backend_user = ANY($${paramIndex}::uuid[])`);
      params.push(backendScope.creatorUserIds);
      paramIndex++;
    }
    if (backendScope.clientIds) {
      conditions.push(`c.client_id = ANY($${paramIndex}::int[])`);
      params.push(backendScope.clientIds);
      paramIndex++;
    }
    if (backendScope.productIds) {
      conditions.push(`c.product_id = ANY($${paramIndex}::int[])`);
      params.push(backendScope.productIds);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get cases from database with related data
    const casesQuery = `
      SELECT 
        c.*,
        cl.name as client_name,
        cl.code as "clientCode",
        u.name as "assignedToName",
        creator.name as "createdByName"
      FROM cases c
      LEFT JOIN clients cl ON c.client_id = cl.id
      LEFT JOIN users u ON c.assigned_to = u.id
      LEFT JOIN users creator ON c.created_by_backend_user = creator.id
      ${whereClause}
      ORDER BY c.created_at DESC
    `;

    const casesResult = await dbQuery(casesQuery, params);
    const filteredCases = casesResult.rows;

    // Calculate summary statistics
    const totalCases = filteredCases.length;
    const completedCases = filteredCases.filter(c => c.status === 'COMPLETED').length;
    const pendingCases = filteredCases.filter(
      c => c.status === 'PENDING' || c.status === 'IN_PROGRESS'
    ).length;

    // Calculate average turnaround time for completed cases
    const completedCasesWithDates = filteredCases.filter(
      c => c.updatedAt && c.status === 'COMPLETED'
    );
    const avgTurnaroundTime =
      completedCasesWithDates.length > 0
        ? completedCasesWithDates.reduce((acc, c) => {
            const days =
              (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) /
              (1000 * 60 * 60 * 24);
            return acc + days;
          }, 0) / completedCasesWithDates.length
        : 0;

    const report = {
      summary: {
        totalCases,
        completedCases,
        pendingCases,
        completionRate: totalCases > 0 ? (completedCases / totalCases) * 100 : 0,
        avgTurnaroundTime: Math.round(avgTurnaroundTime * 100) / 100,
      },
      data: filteredCases,
      filters: {
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        clientId: clientId as string,
        assignedToId: assignedToId as string,
        status: status as string,
        priority: priority as string,
      },
      generatedAt: new Date().toISOString(),
      generatedBy: req.user?.id,
    };

    logger.info('Cases report generated', {
      userId: req.user?.id,
      totalCases,
      filters: { dateFrom, dateTo, clientId, status },
    });

    res.json({
      success: true,
      data: report,
      message: 'Cases report generated successfully',
    });
  } catch (error) {
    logger.error('Error generating cases report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate cases report',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/reports/users - User performance report
export const getUserPerformanceReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dateFrom = (req.query.dateFrom as unknown as string) || '';
    const dateTo = (req.query.dateTo as unknown as string) || '';
    const department = (req.query.department as unknown as string) || '';
    const role = (req.query.role as unknown as string) || '';
    const isActive = (req.query.isActive as unknown as string) || '';
    const _format = (req.query.format as unknown as string) || 'JSON';

    // Build WHERE conditions for users query
    const userConditions: string[] = [];
    const userParams: QueryParams = [];
    let userParamIndex = 1;

    if (department) {
      userConditions.push(`u.department = $${userParamIndex}`);
      userParams.push(department);
      userParamIndex++;
    }
    if (role) {
      userConditions.push(`EXISTS (
        SELECT 1
        FROM user_roles urf
        JOIN roles_v2 rvf ON rvf.id = urf.role_id
        WHERE urf.user_id = u.id AND rvf.name = $${userParamIndex}
      )`);
      userParams.push(role);
      userParamIndex++;
    }
    if (isActive !== undefined) {
      userConditions.push(`u.isActive = $${userParamIndex}`);
      userParams.push(isActive === 'true');
      userParamIndex++;
    }

    const userWhereClause =
      userConditions.length > 0 ? `WHERE ${userConditions.join(' AND ')}` : '';

    // Get users from database
    const usersQuery = `
      SELECT u.*, COUNT(c.case_id) as total_cases
      FROM users u
      LEFT JOIN cases c ON u.id = c.assigned_to
      ${userWhereClause}
      GROUP BY u.id
      ORDER BY u.name
    `;

    const usersResult = await dbQuery(usersQuery, userParams);

    const report = {
      summary: {
        totalUsers: usersResult.rows.length,
        activeUsers: usersResult.rows.filter(u => u.isActive).length,
      },
      data: usersResult.rows,
      filters: {
        dateFrom,
        dateTo,
        department,
        role,
        isActive,
      },
      generatedAt: new Date().toISOString(),
      generatedBy: req.user?.id,
    };

    res.json({
      success: true,
      data: report,
      message: 'User performance report generated successfully',
    });
  } catch (error) {
    logger.error('Error generating user performance report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate user performance report',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/reports/clients - Client report
export const getClientReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isActive = (req.query.isActive as unknown as string) || '';
    const _format = (req.query.format as unknown as string) || 'JSON';

    // Build WHERE conditions for clients query
    const conditions: string[] = [];
    const params: QueryParams = [];
    let paramIndex = 1;

    if (isActive !== undefined) {
      conditions.push(`cl.is_active = $${paramIndex}`);
      params.push(isActive === 'true');
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get clients from database with case counts
    const clientsQuery = `
      SELECT cl.*, COUNT(c.case_id) as total_cases
      FROM clients cl
      LEFT JOIN cases c ON cl.id = c.client_id
      ${whereClause}
      GROUP BY cl.id
      ORDER BY cl.name
    `;

    const clientsResult = await dbQuery(clientsQuery, params);

    const report = {
      summary: {
        totalClients: clientsResult.rows.length,
        activeClients: clientsResult.rows.filter(c => c.isActive).length,
      },
      data: clientsResult.rows,
      filters: {
        isActive,
      },
      generatedAt: new Date().toISOString(),
      generatedBy: req.user?.id,
    };

    res.json({
      success: true,
      data: report,
      message: 'Client report generated successfully',
    });
  } catch (error) {
    logger.error('Error generating client report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate client report',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/reports/dashboard - Dashboard summary
export const getDashboardReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get basic counts from database
    const summaryQuery = `
      SELECT 
        (SELECT COUNT(*) FROM cases) as total_cases,
        (SELECT COUNT(*) FROM cases WHERE status = 'PENDING') as "pending_cases",
        (SELECT COUNT(*) FROM cases WHERE status = 'IN_PROGRESS') as "in_progress_cases",
        (SELECT COUNT(*) FROM cases WHERE status = 'COMPLETED') as "completed_cases",
        (SELECT COUNT(*) FROM users WHERE is_active = true) as "active_users",
        (SELECT COUNT(*) FROM clients WHERE is_active = true) as "active_clients"
    `;

    const summaryResult = await dbQuery<DashboardSummaryRow>(summaryQuery);
    const summary = summaryResult.rows[0];

    res.json({
      success: true,
      data: {
        summary,
        generatedAt: new Date().toISOString(),
        generatedBy: req.user?.id,
      },
      message: 'Dashboard report generated successfully',
    });
  } catch (error) {
    logger.error('Error generating dashboard report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate dashboard report',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ===== MIS DASHBOARD APIs =====

// GET /api/reports/mis-dashboard-data - Get comprehensive MIS data with case and task details
export const getMISData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      search,
      dateFrom,
      dateTo,
      clientId,
      productId,
      verificationTypeId,
      caseStatus,
      fieldAgentId,
      backendUserId,
      priority,
      page = 1,
      limit = 50,
    } = req.query;

    // Build WHERE conditions - TASK-CENTRIC
    const conditions: string[] = [];
    const params: QueryParams = [];
    let paramIndex = 1;
    const backendScope = await getBackendUserReportScope(req);

    // Search across case number, customer name, customer phone, task number
    if (search && typeof search === 'string' && search.trim()) {
      conditions.push(`(
        c.case_id ILIKE $${paramIndex} OR
        c.customer_name ILIKE $${paramIndex} OR
        c.customer_phone ILIKE $${paramIndex} OR
        vt.task_number ILIKE $${paramIndex}
      )`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Date filters - use task created date
    if (dateFrom) {
      conditions.push(`vt.created_at >= $${paramIndex}`);
      params.push(dateFrom as string);
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`vt.created_at <= $${paramIndex}`);
      params.push(dateTo as string);
      paramIndex++;
    }

    // Client and Product filters
    if (clientId) {
      conditions.push(`c.client_id = $${paramIndex}`);
      params.push(parseInt(clientId as string));
      paramIndex++;
    }
    if (productId) {
      conditions.push(`c.product_id = $${paramIndex}`);
      params.push(parseInt(productId as string));
      paramIndex++;
    }

    // Verification Type filter - use task verification type
    if (verificationTypeId) {
      conditions.push(`vt.verification_type_id = $${paramIndex}`);
      params.push(parseInt(verificationTypeId as string));
      paramIndex++;
    }

    // Status filter - use TASK status (not case status)
    if (caseStatus) {
      conditions.push(`vt.status = $${paramIndex}`);
      params.push(caseStatus as string);
      paramIndex++;
    }

    // Backend User filter
    if (backendUserId) {
      conditions.push(`c.created_by_backend_user = $${paramIndex}`);
      params.push(backendUserId as string);
      paramIndex++;
    }

    // Priority filter - use task priority
    if (priority) {
      conditions.push(`vt.priority = $${paramIndex}`);
      params.push(priority as string);
      paramIndex++;
    }

    // Field Agent filter - direct task assignment
    if (fieldAgentId) {
      conditions.push(`vt.assigned_to = $${paramIndex}`);
      params.push(fieldAgentId as string);
      paramIndex++;
    }

    if (backendScope.creatorUserIds) {
      conditions.push(`c.created_by_backend_user = ANY($${paramIndex}::uuid[])`);
      params.push(backendScope.creatorUserIds);
      paramIndex++;
    }
    if (backendScope.clientIds) {
      conditions.push(`c.client_id = ANY($${paramIndex}::int[])`);
      params.push(backendScope.clientIds);
      paramIndex++;
    }
    if (backendScope.productIds) {
      conditions.push(`c.product_id = ANY($${paramIndex}::int[])`);
      params.push(backendScope.productIds);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Calculate pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Save param indices for LIMIT and OFFSET
    const limitParamIndex = paramIndex;
    const offsetParamIndex = paramIndex + 1;

    // Get total count for pagination - COUNT TASKS (not cases)
    const countQuery = `
      SELECT COUNT(DISTINCT vt.id) as total
      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      LEFT JOIN clients cl ON c.client_id = cl.id
      LEFT JOIN products p ON c.product_id = p.id
      LEFT JOIN verification_types vt_type ON vt.verification_type_id = vt_type.id
      LEFT JOIN users u ON vt.assigned_to = u.id
      LEFT JOIN users bu ON c.created_by_backend_user = bu.id
      ${whereClause}
    `;
    const countResult = await dbQuery(countQuery, params);
    const totalRecords = parseInt(countResult.rows[0].total);

    // Main MIS data query - TASK-CENTRIC APPROACH
    // Each row represents ONE verification task (not one case)
    const query = `
      SELECT
        -- Task-Level Data (PRIMARY)
        vt.id as task_id,
        vt.task_number,
        vt.task_title,
        vt_type.name as verification_type_name,
        vt.status as task_status,
        vt.priority as task_priority,
        vt.address,
        vt.pincode,
        ar.name as area_name,
        rt.name as rate_type,
        vt.estimated_amount,
        vt.actual_amount,
        vt.created_at as task_created_date,
        vt.started_at as task_started_date,
        vt.completed_at as task_completion_date,
        vt.first_assigned_at as bank_sla_start,
        vt.current_assigned_at as agent_sla_start,
        COALESCE(NULLIF(vt.trigger::TEXT, ''), NULLIF(vt.task_type::TEXT, '')) as trigger,
        vt.applicant_type,
        CASE
          WHEN vt.completed_at IS NOT NULL AND vt.first_assigned_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (vt.completed_at - vt.first_assigned_at)) / 86400
          ELSE NULL
        END as task_tat_days,
        CASE
          WHEN vt.completed_at IS NOT NULL AND vt.started_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (vt.completed_at - vt.started_at)) / 3600
          ELSE NULL
        END as visit_duration_hours,

        -- Field User Data
        u.name as assigned_field_user,
        u.employee_id as field_user_employee_id,

        -- Case-Level Data (SECONDARY/REFERENCE)
        c.id as case_id,
        c.case_id as case_number,
        c.customer_name,
        c.customer_phone,
        c.customer_calling_code,
        c.status as case_status,
        c.priority as case_priority,
        c.created_at as case_created_date,
        c.total_tasks_count,
        c.completed_tasks_count,
        c.case_completion_percentage,

        -- Client and Product Data
        cl.name as client_name,
        cl.code as client_code,
        p.name as product_name,

        -- Backend User Data
        bu.name as backend_user_name,
        bu.employee_id as backend_user_employee_id,

        -- Form Submission Data
        tfs.id as form_submission_id,
        tfs.form_type,
        tfs.submitted_at as form_submitted_date,
        tfs.validation_status as form_validation_status

      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      LEFT JOIN clients cl ON c.client_id = cl.id
      LEFT JOIN products p ON c.product_id = p.id
      LEFT JOIN verification_types vt_type ON vt.verification_type_id = vt_type.id
      LEFT JOIN rate_types rt ON vt.rate_type_id = rt.id
      LEFT JOIN areas ar ON vt.area_id = ar.id
      LEFT JOIN users u ON vt.assigned_to = u.id
      LEFT JOIN users bu ON c.created_by_backend_user = bu.id
      LEFT JOIN task_form_submissions tfs ON vt.id = tfs.verification_task_id

      ${whereClause}

      ORDER BY vt.created_at DESC
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `;

    params.push(limitNum, offset);
    const result = await dbQuery(query, params);

    // Calculate summary statistics - TASK-BASED
    const summaryQuery = `
      SELECT
        COUNT(DISTINCT vt.id) as total_tasks,
        SUM(vt.estimated_amount) as total_estimated_amount,
        SUM(vt.actual_amount) as total_actual_amount,
        COUNT(DISTINCT CASE WHEN vt.status = 'COMPLETED' THEN vt.id END) as completed_tasks,
        AVG(CASE
          WHEN vt.completed_at IS NOT NULL AND vt.first_assigned_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (vt.completed_at - vt.first_assigned_at)) / 86400
        END) as avg_tat_days
      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      LEFT JOIN clients cl ON c.client_id = cl.id
      LEFT JOIN products p ON c.product_id = p.id
      LEFT JOIN verification_types vt_type ON vt.verification_type_id = vt_type.id
      LEFT JOIN users u ON vt.assigned_to = u.id
      LEFT JOIN users bu ON c.created_by_backend_user = bu.id
      ${whereClause}
    `;

    // Remove LIMIT and OFFSET parameters for summary query (last 2 params)
    const summaryResult = await dbQuery(summaryQuery, params.slice(0, -2));
    const summary = summaryResult.rows[0];

    logger.info('MIS data retrieved (task-centric)', {
      userId: req.user?.id,
      totalRecords,
      page: pageNum,
      limit: limitNum,
    });

    res.json({
      success: true,
      data: result.rows,
      summary: {
        totalTasks: parseInt(summary.totalTasks) || 0,
        totalEstimatedAmount: parseFloat(summary.totalEstimatedAmount) || 0,
        totalActualAmount: parseFloat(summary.totalActualAmount) || 0,
        completedTasks: parseInt(summary.completedTasks) || 0,
        taskCompletionRate:
          summary.totalTasks > 0
            ? Math.round((parseInt(summary.completedTasks) / parseInt(summary.totalTasks)) * 100)
            : 0,
        avgTatDays: parseFloat(summary.avgTatDays) || 0,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalRecords,
        totalPages: Math.ceil(totalRecords / limitNum),
      },
      message: 'MIS data retrieved successfully (task-centric)',
    });
  } catch (error) {
    logger.error('Error retrieving MIS data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve MIS data',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/reports/mis-dashboard-data/export - Export MIS data to Excel or CSV
export const exportMISData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      search,
      dateFrom,
      dateTo,
      clientId,
      productId,
      verificationTypeId,
      caseStatus,
      fieldAgentId,
      backendUserId,
      priority,
      format = 'EXCEL',
    } = req.query;

    // Build WHERE conditions - TASK-CENTRIC (same as getMISData)
    const conditions: string[] = [];
    const params: QueryParams = [];
    let paramIndex = 1;
    const backendScope = await getBackendUserReportScope(req);

    // Search across case number, customer name, customer phone, task number
    if (search && typeof search === 'string' && search.trim()) {
      conditions.push(`(
        c.case_id ILIKE $${paramIndex} OR
        c.customer_name ILIKE $${paramIndex} OR
        c.customer_phone ILIKE $${paramIndex} OR
        vt.task_number ILIKE $${paramIndex}
      )`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Date filters - use task created date
    if (dateFrom) {
      conditions.push(`vt.created_at >= $${paramIndex}`);
      params.push(dateFrom as string);
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`vt.created_at <= $${paramIndex}`);
      params.push(dateTo as string);
      paramIndex++;
    }

    // Client and Product filters
    if (clientId) {
      conditions.push(`c.client_id = $${paramIndex}`);
      params.push(parseInt(clientId as string));
      paramIndex++;
    }
    if (productId) {
      conditions.push(`c.product_id = $${paramIndex}`);
      params.push(parseInt(productId as string));
      paramIndex++;
    }

    // Verification Type filter - use task verification type
    if (verificationTypeId) {
      conditions.push(`vt.verification_type_id = $${paramIndex}`);
      params.push(parseInt(verificationTypeId as string));
      paramIndex++;
    }

    // Status filter - use TASK status (not case status)
    if (caseStatus) {
      conditions.push(`vt.status = $${paramIndex}`);
      params.push(caseStatus as string);
      paramIndex++;
    }

    // Backend User filter
    if (backendUserId) {
      conditions.push(`c.created_by_backend_user = $${paramIndex}`);
      params.push(backendUserId as string);
      paramIndex++;
    }

    // Priority filter - use task priority
    if (priority) {
      conditions.push(`vt.priority = $${paramIndex}`);
      params.push(priority as string);
      paramIndex++;
    }

    // Field Agent filter - direct task assignment
    if (fieldAgentId) {
      conditions.push(`vt.assigned_to = $${paramIndex}`);
      params.push(fieldAgentId as string);
      paramIndex++;
    }

    if (backendScope.creatorUserIds) {
      conditions.push(`c.created_by_backend_user = ANY($${paramIndex}::uuid[])`);
      params.push(backendScope.creatorUserIds);
      paramIndex++;
    }
    if (backendScope.clientIds) {
      conditions.push(`c.client_id = ANY($${paramIndex}::int[])`);
      params.push(backendScope.clientIds);
      paramIndex++;
    }
    if (backendScope.productIds) {
      conditions.push(`c.product_id = ANY($${paramIndex}::int[])`);
      params.push(backendScope.productIds);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get all data without pagination for export - TASK-CENTRIC
    const query = `
      SELECT
        -- Task-Level Data (PRIMARY)
        vt.id as task_id,
        vt.task_number,
        vt.task_title,
        vt_type.name as task_verification_type,
        vt.status as task_status,
        vt.priority as task_priority,
        vt.address,
        vt.pincode,
        rt.name as rate_type,
        vt.estimated_amount,
        vt.actual_amount,
        vt.created_at as task_created_date,
        vt.started_at as task_started_date,
        vt.completed_at as task_completion_date,
        vt.trigger,
        vt.applicant_type,
        CASE
          WHEN vt.completed_at IS NOT NULL AND vt.first_assigned_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (vt.completed_at - vt.first_assigned_at)) / 86400
          ELSE NULL
        END as task_tat_days,
        CASE
          WHEN vt.completed_at IS NOT NULL AND vt.started_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (vt.completed_at - vt.started_at)) / 3600
          ELSE NULL
        END as visit_duration_hours,

        -- Field User Data
        u.name as assigned_field_user,
        u.employee_id as field_user_employee_id,

        -- Case-Level Data (SECONDARY/REFERENCE)
        c.case_id as case_number,
        c.customer_name,
        c.customer_phone,
        c.customer_calling_code,
        c.status as case_status,
        c.priority as case_priority,
        c.created_at as case_created_date,
        c.total_tasks_count,
        c.completed_tasks_count,
        c.case_completion_percentage,

        -- Client and Product Data
        cl.name as client_name,
        cl.code as client_code,
        p.name as product_name,

        -- Backend User Data
        bu.name as backend_user_name,
        bu.employee_id as backend_user_employee_id,

        -- Form Submission Data
        tfs.id as form_submission_id,
        tfs.form_type,
        tfs.submitted_at as form_submitted_date,
        tfs.validation_status as form_validation_status

      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      LEFT JOIN clients cl ON c.client_id = cl.id
      LEFT JOIN products p ON c.product_id = p.id
      LEFT JOIN verification_types vt_type ON vt.verification_type_id = vt_type.id
      LEFT JOIN rate_types rt ON vt.rate_type_id = rt.id
      LEFT JOIN users u ON vt.assigned_to = u.id
      LEFT JOIN users bu ON c.created_by_backend_user = bu.id
      LEFT JOIN task_form_submissions tfs ON vt.id = tfs.verification_task_id
      ${whereClause}
      ORDER BY vt.created_at DESC
    `;

    const result = await dbQuery<MISReportRow>(query, params);

    if (format === 'EXCEL') {
      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('MIS Report');

      // Define columns - TASK-FIRST ORDER
      worksheet.columns = [
        // Task-Level Data (PRIMARY)
        { header: 'Task ID', key: 'taskId', width: 12 },
        { header: 'Task Number', key: 'taskNumber', width: 15 },
        { header: 'Task Title', key: 'taskTitle', width: 30 },
        { header: 'Verification Type', key: 'verificationTypeName', width: 25 },
        { header: 'Task Status', key: 'taskStatus', width: 15 },
        { header: 'Task Priority', key: 'taskPriority', width: 12 },
        { header: 'Field Agent', key: 'assignedFieldUser', width: 20 },
        { header: 'Field Agent ID', key: 'fieldUserEmployeeId', width: 15 },
        { header: 'Address', key: 'address', width: 40 },
        { header: 'Pincode', key: 'pincode', width: 10 },
        { header: 'Area', key: 'areaName', width: 20 },
        { header: 'Rate Type', key: 'rateType', width: 15 },
        { header: 'Estimated Amount', key: 'estimatedAmount', width: 18 },
        { header: 'Actual Amount', key: 'actualAmount', width: 15 },
        { header: 'Task Created Date', key: 'taskCreatedDate', width: 20 },
        { header: 'Task Started Date', key: 'taskStartedDate', width: 20 },
        { header: 'Task Completion Date', key: 'taskCompletionDate', width: 20 },
        { header: 'Task TAT (Days)', key: 'taskTatDays', width: 15 },
        { header: 'Trigger', key: 'trigger', width: 30 },
        { header: 'Applicant Type', key: 'applicantType', width: 20 },

        // Form Submission Data
        { header: 'Form Submission ID', key: 'formSubmissionId', width: 15 },
        { header: 'Form Type', key: 'formType', width: 20 },
        { header: 'Form Submitted Date', key: 'formSubmittedDate', width: 20 },
        { header: 'Form Validation Status', key: 'formValidationStatus', width: 20 },

        // Case-Level Data (SECONDARY/REFERENCE)
        { header: 'Case Number', key: 'caseNumber', width: 15 },
        { header: 'Customer Name', key: 'customerName', width: 25 },
        { header: 'Customer Phone', key: 'customerPhone', width: 15 },
        { header: 'Calling Code', key: 'customerCallingCode', width: 12 },
        { header: 'Client Name', key: 'clientName', width: 20 },
        { header: 'Client Code', key: 'clientCode', width: 15 },
        { header: 'Product', key: 'productName', width: 20 },
        { header: 'Case Status', key: 'caseStatus', width: 15 },
        { header: 'Case Priority', key: 'casePriority', width: 12 },
        { header: 'Case Created Date', key: 'caseCreatedDate', width: 20 },
        { header: 'Backend User', key: 'backendUserName', width: 20 },
        { header: 'Backend User ID', key: 'backendUserEmployeeId', width: 15 },
      ];

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      // Add data rows
      result.rows.forEach(row => {
        worksheet.addRow(row);
      });

      // Auto-filter
      worksheet.autoFilter = {
        from: 'A1',
        to: `AI1`,
      };

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Set response headers
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=MIS_Report_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      res.send(buffer);
    } else if (format === 'CSV') {
      // Generate CSV - TASK-FIRST ORDER
      const headers = [
        // Task-Level Data (PRIMARY)
        'Task ID',
        'Task Number',
        'Task Title',
        'Verification Type',
        'Task Status',
        'Task Priority',
        'Field Agent',
        'Field Agent ID',
        'Address',
        'Pincode',
        'Rate Type',
        'Estimated Amount',
        'Actual Amount',
        'Task Created Date',
        'Task Started Date',
        'Task Completion Date',
        'Task TAT (Days)',
        'Trigger',
        'Applicant Type',
        // Form Submission Data
        'Form Submission ID',
        'Form Type',
        'Form Submitted Date',
        'Form Validation Status',
        // Case-Level Data (SECONDARY/REFERENCE)
        'Case Number',
        'Customer Name',
        'Customer Phone',
        'Calling Code',
        'Client Name',
        'Client Code',
        'Product',
        'Case Status',
        'Case Priority',
        'Case Created Date',
        'Backend User',
        'Backend User ID',
      ];

      const csvRows = [headers.join(',')];

      result.rows.forEach(row => {
        const values = [
          // Task-Level Data (PRIMARY)
          row.taskId || '',
          row.taskNumber || '',
          `"${row.taskTitle || ''}"`,
          `"${row.taskVerificationType || ''}"`,
          row.taskStatus || '',
          row.taskPriority || '',
          `"${row.assignedFieldUser || ''}"`,
          row.fieldUserEmployeeId || '',
          `"${row.address || ''}"`,
          row.pincode || '',
          row.rateType || '',
          row.estimatedAmount || 0,
          row.actualAmount || 0,
          row.taskCreatedDate || '',
          row.taskStartedDate || '',
          row.taskCompletionDate || '',
          row.taskTatDays || '',
          `"${row.trigger || ''}"`,
          row.applicantType || '',
          // Form Submission Data
          row.formSubmissionId || '',
          row.formType || '',
          row.formSubmittedDate || '',
          row.formValidationStatus || '',
          // Case-Level Data (SECONDARY/REFERENCE)
          row.caseNumber,
          `"${row.customerName || ''}"`,
          row.customerPhone || '',
          row.customerCallingCode || '',
          `"${row.clientName || ''}"`,
          row.clientCode || '',
          `"${row.productName || ''}"`,
          row.caseStatus || '',
          row.casePriority || '',
          row.caseCreatedDate || '',
          `"${row.backendUserName || ''}"`,
          row.backendUserEmployeeId || '',
        ];
        csvRows.push(values.join(','));
      });

      const csvContent = csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=MIS_Report_${new Date().toISOString().split('T')[0]}.csv`
      );
      res.send(csvContent);
    }

    logger.info('MIS data exported', {
      userId: req.user?.id,
      format,
      recordCount: result.rows.length,
    });
  } catch (error) {
    logger.error('Error exporting MIS data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export MIS data',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

type InvoiceReportQueryInput = {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  clientId?: string | number;
  productId?: string | number;
  status?: string;
  page?: string | number;
  limit?: string | number;
};

const getInvoiceReportInput = (req: AuthenticatedRequest): InvoiceReportQueryInput => {
  const source =
    req.method === 'POST' && req.body && typeof req.body === 'object'
      ? (req.body as Record<string, unknown>)
      : (req.query as Record<string, unknown>);

  return {
    search: typeof source.search === 'string' ? source.search : undefined,
    dateFrom: typeof source.dateFrom === 'string' ? source.dateFrom : undefined,
    dateTo: typeof source.dateTo === 'string' ? source.dateTo : undefined,
    clientId:
      typeof source.clientId === 'string' || typeof source.clientId === 'number'
        ? source.clientId
        : undefined,
    productId:
      typeof source.productId === 'string' || typeof source.productId === 'number'
        ? source.productId
        : undefined,
    status: typeof source.status === 'string' ? source.status : undefined,
    page:
      typeof source.page === 'string' || typeof source.page === 'number' ? source.page : undefined,
    limit:
      typeof source.limit === 'string' || typeof source.limit === 'number'
        ? source.limit
        : undefined,
  };
};

const buildInvoiceReportScope = async (req: AuthenticatedRequest) => {
  const backendScope = await getBackendUserReportScope(req);
  const conditions: string[] = [];
  const params: QueryParams = [];
  let paramIndex = 1;

  if (backendScope.creatorUserIds) {
    conditions.push(`EXISTS (
      SELECT 1
      FROM invoice_item_tasks iit_scope
      JOIN verification_tasks vt_scope ON vt_scope.id = iit_scope.verification_task_id
      JOIN cases c_scope ON c_scope.id = vt_scope.case_id
      JOIN invoice_items ii_scope ON ii_scope.id = iit_scope.invoice_item_id
      WHERE ii_scope.invoice_id = i.id
        AND c_scope.created_by_backend_user = ANY($${paramIndex}::uuid[])
    )`);
    params.push(backendScope.creatorUserIds);
    paramIndex++;
  }

  if (backendScope.clientIds) {
    conditions.push(`i.client_id = ANY($${paramIndex}::int[])`);
    params.push(backendScope.clientIds);
    paramIndex++;
  }

  if (backendScope.productIds) {
    conditions.push(`(i.product_id IS NULL OR i.product_id = ANY($${paramIndex}::int[]))`);
    params.push(backendScope.productIds);
    paramIndex++;
  }

  return { conditions, params, paramIndex };
};

const buildInvoiceReportQuery = async (req: AuthenticatedRequest, includePagination: boolean) => {
  const input = getInvoiceReportInput(req);
  const { conditions, params, paramIndex: initialParamIndex } = await buildInvoiceReportScope(req);
  let paramIndex = initialParamIndex;

  if (input.clientId) {
    conditions.push(`i.client_id = $${paramIndex}`);
    params.push(Number(input.clientId));
    paramIndex++;
  }

  if (input.productId) {
    conditions.push(`i.product_id = $${paramIndex}`);
    params.push(Number(input.productId));
    paramIndex++;
  }

  if (input.status) {
    conditions.push(`i.status = $${paramIndex}`);
    params.push(String(input.status).toUpperCase());
    paramIndex++;
  }

  if (input.dateFrom) {
    conditions.push(`i.issue_date >= $${paramIndex}`);
    params.push(input.dateFrom);
    paramIndex++;
  }

  if (input.dateTo) {
    conditions.push(`i.issue_date <= $${paramIndex}`);
    params.push(input.dateTo);
    paramIndex++;
  }

  if (input.search && input.search.trim()) {
    conditions.push(`(
      i.invoice_number ILIKE $${paramIndex} OR
      i.client_name ILIKE $${paramIndex} OR
      COALESCE(i.notes, '') ILIKE $${paramIndex}
    )`);
    params.push(`%${input.search.trim()}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const page = Math.max(1, Number(input.page || 1));
  const limit = Math.max(1, Math.min(500, Number(input.limit || 20)));
  const offset = (page - 1) * limit;

  const countQuery = `SELECT COUNT(*)::text as total FROM invoices i ${whereClause}`;

  const dataParams = [...params];
  let paginationClause = '';
  if (includePagination) {
    dataParams.push(limit, offset);
    paginationClause = `LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  }

  const dataQuery = `
    SELECT
      i.id,
      i.invoice_number,
      i.client_id,
      i.product_id,
      i.client_name,
      i.status,
      i.currency,
      i.issue_date::text,
      i.due_date::text,
      i.paid_date::text,
      i.subtotal_amount::text,
      i.tax_amount::text,
      i.total_amount::text,
      i.notes,
      i.created_at::text,
      i.updated_at::text,
      c.code as client_code,
      p.name as product_name,
      COALESCE(COUNT(ii.id), 0)::int as item_count,
      COALESCE(SUM(ii.quantity), 0)::int as total_quantity
    FROM invoices i
    LEFT JOIN clients c ON c.id = i.client_id
    LEFT JOIN products p ON p.id = i.product_id
    LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
    ${whereClause}
    GROUP BY i.id, c.code, p.name
    ORDER BY i.issue_date DESC, i.id DESC
    ${paginationClause}
  `;

  return {
    countQuery,
    dataQuery,
    params,
    dataParams,
    page,
    limit,
  };
};

export const getInvoicesReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reportQuery = await buildInvoiceReportQuery(req, true);
    const [countResult, dataResult] = await Promise.all([
      dbQuery<{ total: string }>(reportQuery.countQuery, reportQuery.params),
      dbQuery<{
        id: number;
        invoiceNumber: string;
        clientId: number;
        productId: number | null;
        clientName: string;
        status: string;
        currency: string;
        issueDate: string;
        dueDate: string;
        paidDate: string | null;
        subtotalAmount: string;
        taxAmount: string;
        totalAmount: string;
        notes: string | null;
        createdAt: string;
        updatedAt: string;
        clientCode: string | null;
        productName: string | null;
        itemCount: number;
        totalQuantity: number;
      }>(reportQuery.dataQuery, reportQuery.dataParams),
    ]);

    const total = Number(countResult.rows[0]?.total || 0);

    res.json({
      success: true,
      data: dataResult.rows.map(row => ({
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        clientId: row.clientId,
        productId: row.productId,
        clientName: row.clientName,
        clientCode: row.clientCode,
        productName: row.productName,
        status: row.status,
        currency: row.currency,
        issueDate: row.issueDate,
        dueDate: row.dueDate,
        paidDate: row.paidDate,
        subtotalAmount: Number(row.subtotalAmount || 0),
        taxAmount: Number(row.taxAmount || 0),
        totalAmount: Number(row.totalAmount || 0),
        notes: row.notes || '',
        itemCount: row.itemCount,
        totalQuantity: row.totalQuantity,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      pagination: {
        page: reportQuery.page,
        limit: reportQuery.limit,
        total,
        totalPages: Math.ceil(total / reportQuery.limit),
      },
    });
  } catch (error) {
    logger.error('Error retrieving invoice report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve invoice report',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const downloadInvoicesReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reportQuery = await buildInvoiceReportQuery(req, false);
    const result = await dbQuery<{
      invoiceNumber: string;
      clientName: string;
      productName: string | null;
      status: string;
      issueDate: string;
      dueDate: string;
      paidDate: string | null;
      subtotalAmount: string;
      taxAmount: string;
      totalAmount: string;
      currency: string;
    }>(reportQuery.dataQuery, reportQuery.dataParams);

    const headers = [
      'Invoice Number',
      'Client Name',
      'Product Name',
      'Status',
      'Issue Date',
      'Due Date',
      'Paid Date',
      'Subtotal Amount',
      'Tax Amount',
      'Total Amount',
      'Currency',
    ];

    const csvRows = [headers.join(',')];
    result.rows.forEach(row => {
      csvRows.push(
        [
          row.invoiceNumber,
          `"${row.clientName || ''}"`,
          `"${row.productName || ''}"`,
          row.status,
          row.issueDate || '',
          row.dueDate || '',
          row.paidDate || '',
          row.subtotalAmount || '0',
          row.taxAmount || '0',
          row.totalAmount || '0',
          row.currency || 'INR',
        ].join(',')
      );
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Invoice_Report_${new Date().toISOString().split('T')[0]}.csv`
    );
    res.send(csvRows.join('\n'));
  } catch (error) {
    logger.error('Error exporting invoice report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export invoice report',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
