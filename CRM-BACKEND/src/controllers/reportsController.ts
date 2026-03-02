import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { pool } from '@/config/database';
import { QueryParams } from '@/types/database';
import { getAssignedClientIds } from '@/middleware/clientAccess';
import { getAssignedProductIds } from '@/middleware/productAccess';
import { isFieldExecutionActor, isScopedOperationsUser } from '@/security/rbacAccess';
import { getScopedOperationalUserIds } from '@/security/userScope';
import { CaseAnalyticsRow } from '../types/reports';
import ExcelJS from 'exceljs';

interface MISReportRow {
  task_id: number;
  task_number: string;
  task_title: string;
  task_verification_type: string;
  task_status: string;
  task_priority: string;
  assigned_field_user: string;
  field_user_employee_id: string;
  address: string;
  pincode: string;
  rate_type: string;
  estimated_amount: number;
  actual_amount: number;
  task_created_date: string;
  task_started_date: string;
  task_completion_date: string;
  task_tat_days: number;
  trigger: string;
  applicant_type: string;
  form_submission_id: string;
  form_type: string;
  form_submitted_date: string;
  form_validation_status: string;
  case_number: string;
  customerName: string;
  customerPhone: string;
  customerCallingCode: string;
  client_name: string;
  client_code: string;
  product_name: string;
  case_status: string;
  case_priority: string;
  case_created_date: string;
  backend_user_name: string;
  backend_user_employee_id: string;
  verification_type_name: string;
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
    };
  }

  const scopedUserIds = await getScopedOperationalUserIds(req.user.id);
  if (scopedUserIds) {
    return {
      clientIds: undefined as number[] | undefined,
      productIds: undefined as number[] | undefined,
      scopedUserIds,
    };
  }

  const [clientIds, productIds] = await Promise.all([
    getAssignedClientIds(req.user.id),
    getAssignedProductIds(req.user.id),
  ]);

  return {
    clientIds: clientIds && clientIds.length > 0 ? clientIds : [-1],
    productIds: productIds && productIds.length > 0 ? productIds : [-1],
    scopedUserIds: undefined as string[] | undefined,
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

    // Build WHERE conditions using CORRECT snake_case column names
    const conditions: string[] = [];
    const params: QueryParams = [];
    let paramIndex = 1;
    const userId = req.user?.id;
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
          conditions.push(`EXISTS (
            SELECT 1 FROM verification_tasks vt_scope
            WHERE vt_scope.case_id = c.id
              AND vt_scope.assigned_to = ANY($${paramIndex}::uuid[])
          )`);
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
          conditions.push(`c."clientId" = ANY($${paramIndex}::int[])`);
          params.push(assignedClientIds);
          paramIndex++;
          conditions.push(`c."productId" = ANY($${paramIndex}::int[])`);
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

    // Get form submissions from task_form_submissions table (using snake_case)
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
        c."customerName",
        c."caseId" as case_number,
        u.name as agent_name,
        u."employeeId" as employee_id,
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
    const result = await pool.query(query, params);

    // Get summary statistics (using snake_case)
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
    const summaryResult = await pool.query(summaryQuery, summaryParams);
    const summary = summaryResult.rows[0] || {
      total_submissions: 0,
      valid_submissions: 0,
      pending_submissions: 0,
      invalid_submissions: 0,
      residence_forms: 0,
      office_forms: 0,
      business_forms: 0,
    };

    logger.info('Form submissions fetched', {
      userId: req.user?.id,
      total: summary.total_submissions,
      filters: { formType, dateFrom, dateTo, agentId, validationStatus },
    });

    res.json({
      success: true,
      data: {
        submissions: result.rows,
        summary: {
          totalSubmissions: Number(summary.total_submissions),
          validSubmissions: Number(summary.valid_submissions),
          pendingSubmissions: Number(summary.pending_submissions),
          invalidSubmissions: Number(summary.invalid_submissions),
          residenceForms: Number(summary.residence_forms),
          officeForms: Number(summary.office_forms),
          businessForms: Number(summary.business_forms),
        },
        pagination: {
          limit,
          offset,
          total: Number(summary.total_submissions),
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
      conditions.push(`${alias}."createdAt" >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      const alias = formType.toUpperCase() === 'RESIDENCE' ? 'r' : 'o';
      conditions.push(`${alias}."createdAt" <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }
    if (agentId) {
      const alias = formType.toUpperCase() === 'RESIDENCE' ? 'r' : 'o';
      conditions.push(`${alias}."createdBy" = $${paramIndex}`);
      params.push(agentId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let query = '';
    if (formType.toUpperCase() === 'RESIDENCE') {
      query = `
        SELECT
          r.*,
          c."customerName",
          c."caseId" as "caseNumber",
          u.name as "agentName",
          u."employeeId",
          COUNT(a.id) as "attachmentCount"
        FROM "residenceVerificationReports" r
        LEFT JOIN cases c ON r."caseId" = c."caseId"
        LEFT JOIN users u ON r."createdBy" = u.id
        LEFT JOIN attachments a ON a."caseId" = c.id
        ${whereClause}
        GROUP BY r.id, c."customerName", c."caseId", u.name, u."employeeId"
        ORDER BY r."createdAt" DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
    } else if (formType.toUpperCase() === 'OFFICE') {
      query = `
        SELECT
          o.*,
          c."customerName",
          c."caseId" as "caseNumber",
          u.name as "agentName",
          u."employeeId",
          COUNT(a.id) as "attachmentCount"
        FROM "officeVerificationReports" o
        LEFT JOIN cases c ON o."caseId" = c."caseId"
        LEFT JOIN users u ON o."createdBy" = u.id
        LEFT JOIN attachments a ON a."caseId" = c.id
        ${whereClause}
        GROUP BY o.id, c."customerName", c."caseId", u.name, u."employeeId"
        ORDER BY o."createdAt" DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
    }

    params.push(limit, offset);
    const result = await pool.query(query, params);

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
      conditions.push(`"createdAt" >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`"createdAt" <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get validation status from task_form_submissions (using snake_case)
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

    const validationResult = await pool.query(validationQuery, params);

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
        acc.totalForms += parseInt(row.total_forms);
        acc.validatedForms += parseInt(row.validated_forms);
        acc.pendingForms += parseInt(row.pending_forms);
        acc.invalidForms += parseInt(row.invalid_forms || 0);
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
      conditions.push(`c."createdAt" >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`c."createdAt" <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }
    if (clientId) {
      conditions.push(`c."clientId" = $${paramIndex}`);
      params.push(parseInt(clientId));
      paramIndex++;
    }
    if (agentId) {
      conditions.push(`c."assignedTo" = $${paramIndex}`);
      params.push(agentId);
      paramIndex++;
    }
    if (status) {
      conditions.push(`c.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get comprehensive case analytics using multi-task architecture (snake_case)
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
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN verification_tasks vt ON c.id = vt.case_id
      LEFT JOIN task_form_submissions tfs ON vt.id = tfs.verification_task_id
      ${whereClause}
      GROUP BY c.id, c."caseId", cl.name
      ORDER BY c."createdAt" DESC
    `;

    const analyticsResult = await pool.query(analyticsQuery, params);

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
      SELECT c.*, cl.name as "clientName", u.name as "agentName"
      FROM cases c
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN users u ON c."assignedTo" = u.id
      WHERE c."caseId" = $1
    `;
    const caseResult = await pool.query(caseQuery, [caseId]);

    if (caseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
        error: { code: 'CASE_NOT_FOUND' },
      });
    }

    const caseData = caseResult.rows[0];

    if (isFieldExecutionActor(req.user)) {
      const taskAccess = await pool.query(
        `SELECT 1
         FROM verification_tasks vt
         JOIN cases c ON vt.case_id = c.id
         WHERE c."caseId" = $1 AND vt.assigned_to = $2
         LIMIT 1`,
        [caseId, req.user.id]
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
      if (scopedUserIds) {
        const scopeCheck = await pool.query(
          `SELECT 1
           FROM cases c
           LEFT JOIN verification_tasks vt ON vt.case_id = c.id
           WHERE c."caseId" = $1
             AND (
               c."createdByBackendUser" = ANY($2::uuid[]) OR
               c."assignedTo" = ANY($2::uuid[]) OR
               vt.assigned_to = ANY($2::uuid[])
             )
           LIMIT 1`,
          [caseId, scopedUserIds]
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
        c."createdAt" as event_date,
        creator.name as performed_by,
        'Case created and assigned' as description,
        jsonb_build_object('status', c.status, 'priority', c.priority) as metadata
      FROM cases c
      LEFT JOIN users creator ON c."createdByBackendUser" = creator.id
      WHERE c."caseId" = $1

      UNION ALL

      SELECT
        'RESIDENCE_FORM_SUBMITTED' as event_type,
        r."createdAt" as event_date,
        u.name as performed_by,
        'Residence verification form submitted' as description,
        jsonb_build_object(
          'applicantName', r."applicantName",
          'residenceConfirmed', r."residenceConfirmed",
          'personMet', r."personMet"
        ) as metadata
      FROM "residenceVerificationReports" r
      LEFT JOIN users u ON r."createdBy" = u.id
      WHERE r."caseId" = $1

      UNION ALL

      SELECT
        'OFFICE_FORM_SUBMITTED' as event_type,
        o."createdAt" as event_date,
        u.name as performed_by,
        'Office verification form submitted' as description,
        jsonb_build_object(
          'companyName', o."companyName",
          'officeConfirmed', o."officeConfirmed",
          'personMet', o."personMet"
        ) as metadata
      FROM "officeVerificationReports" o
      LEFT JOIN users u ON o."createdBy" = u.id
      WHERE o."caseId" = $1

      UNION ALL

      SELECT
        'ATTACHMENT_UPLOADED' as event_type,
        a."createdAt" as event_date,
        u.name as performed_by,
        CONCAT('File uploaded: ', a."fileName") as description,
        jsonb_build_object(
          'fileName', a."fileName",
          'fileType', a."fileType",
          'fileSize', a."fileSize"
        ) as metadata
      FROM attachments a
      LEFT JOIN users u ON a."uploadedBy" = u.id
      WHERE a."caseId" = (SELECT id FROM cases WHERE "caseId" = $1)

      ORDER BY event_date ASC
    `;

    const timelineResult = await pool.query(timelineQuery, [caseId]);

    res.json({
      success: true,
      data: {
        case: caseData,
        timeline: timelineResult.rows,
        summary: {
          totalEvents: timelineResult.rows.length,
          formsSubmitted: timelineResult.rows.filter(e => e.event_type.includes('FORM_SUBMITTED'))
            .length,
          attachmentsUploaded: timelineResult.rows.filter(
            e => e.event_type === 'ATTACHMENT_UPLOADED'
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
      conditions.push(`u."departmentId" = $${paramIndex}`);
      params.push(parseInt(departmentId));
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Simple query: Get all verification tasks with agent, client, product, rate type info
    const performanceQuery = `
      SELECT
        u.id as agent_id,
        u.name as agent_name,
        u."employeeId" as employee_id,
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
      LEFT JOIN clients cl ON cas."clientId" = cl.id
      LEFT JOIN products p ON cas."productId" = p.id
      LEFT JOIN "verificationTypes" vtype ON vt.verification_type_id = vtype.id
      LEFT JOIN "rateTypes" rt ON vt.rate_type_id = rt.id
      ${whereClause}
      ORDER BY vt.created_at DESC
    `;

    const result = await pool.query(performanceQuery, params);
    const tasks = result.rows;

    interface AgentPerformanceAccumulator {
      id: string;
      name: string;
      employee_id: string;
      total_tasks: number;
      completed_tasks: number;
      in_tat: number;
      out_tat: number;
      local_tasks: number;
      ogl_tasks: number;
      total_amount: number;
      clients: Set<string>;
      products: Set<string>;
      tasks: Record<string, unknown>[];
    }

    // Group by agent and calculate metrics
    const agentMap = new Map<string, AgentPerformanceAccumulator>();

    tasks.forEach(task => {
      const taskAgentId = task.agent_id;

      if (!agentMap.has(taskAgentId)) {
        agentMap.set(taskAgentId, {
          id: task.agent_id,
          name: task.agent_name,
          employee_id: task.employee_id,
          total_tasks: 0,
          completed_tasks: 0,
          in_tat: 0,
          out_tat: 0,
          local_tasks: 0,
          ogl_tasks: 0,
          total_amount: 0,
          clients: new Set(),
          products: new Set(),
          tasks: [],
        });
      }

      const agent = agentMap.get(taskAgentId);
      agent.total_tasks++;
      agent.tasks.push(task);

      if (task.status === 'COMPLETED') {
        agent.completed_tasks++;

        // TAT calculation (assuming 2 days TAT)
        if (task.completion_days !== null) {
          if (task.completion_days <= 2) {
            agent.in_tat++;
          } else {
            agent.out_tat++;
          }
        }
      }

      // Rate type
      if (task.rate_type?.toLowerCase().includes('local')) {
        agent.local_tasks++;
      } else if (task.rate_type?.toLowerCase().includes('ogl')) {
        agent.ogl_tasks++;
      }

      // Amount
      if (task.actual_amount) {
        agent.total_amount += parseFloat(task.actual_amount);
      } else if (task.estimated_amount) {
        agent.total_amount += parseFloat(task.estimated_amount);
      }

      // Clients and products
      if (task.client_name) {
        agent.clients.add(task.client_name);
      }
      if (task.product_name) {
        agent.products.add(task.product_name);
      }
    });

    // Convert to array and format
    const agents = Array.from(agentMap.values()).map(agent => ({
      id: agent.id,
      name: agent.name,
      employee_id: agent.employee_id,
      total_tasks: agent.total_tasks,
      completed_tasks: agent.completed_tasks,
      pending_tasks: agent.total_tasks - agent.completed_tasks,
      in_tat: agent.in_tat,
      out_tat: agent.out_tat,
      local_tasks: agent.local_tasks,
      ogl_tasks: agent.ogl_tasks,
      total_amount: Math.round(agent.total_amount * 100) / 100,
      clients: Array.from(agent.clients),
      products: Array.from(agent.products),
      completion_rate:
        agent.total_tasks > 0 ? Math.round((agent.completed_tasks / agent.total_tasks) * 100) : 0,
    }));

    // Sort by total tasks
    agents.sort((a, b) => b.total_tasks - a.total_tasks);

    res.json({
      success: true,
      data: {
        summary: {
          totalAgents: agents.length,
          totalTasks: tasks.length,
          completedTasks: agents.reduce((sum, a) => sum + a.completed_tasks, 0),
          inTAT: agents.reduce((sum, a) => sum + a.in_tat, 0),
          outTAT: agents.reduce((sum, a) => sum + a.out_tat, 0),
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
      SELECT u.*, d.name as "departmentName"
      FROM users u
      LEFT JOIN departments d ON u."departmentId" = d.id
      WHERE u.id = $1
        AND EXISTS (
          SELECT 1
          FROM user_roles urf
          JOIN role_permissions rpf ON rpf.role_id = urf.role_id AND rpf.allowed = true
          JOIN permissions pf ON pf.id = rpf.permission_id
          WHERE urf.user_id = u.id AND pf.code = 'visit.submit'
        )
    `;
    const agentResult = await pool.query(agentQuery, [agentId]);

    if (agentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Field agent not found',
        error: { code: 'AGENT_NOT_FOUND' },
      });
    }

    const agent = agentResult.rows[0];

    const conditions: string[] = ['c."assignedTo" = $1'];
    const params: QueryParams = [agentId];
    let paramIndex = 2;

    if (dateFrom) {
      conditions.push(`c."createdAt" >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`c."createdAt" <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Get daily productivity data
    const productivityQuery = `
      SELECT
        DATE(c."createdAt") as work_date,
        COUNT(DISTINCT c.id) as cases_assigned,
        COUNT(DISTINCT CASE WHEN c.status = 'COMPLETED' THEN c.id END) as cases_completed,
        COUNT(DISTINCT r.id) as residence_forms,
        COUNT(DISTINCT o.id) as office_forms,
        COUNT(DISTINCT a.id) as attachments_uploaded
      FROM cases c
      LEFT JOIN "residenceVerificationReports" r ON c."caseId" = r."caseId" AND r."createdBy" = $1
      LEFT JOIN "officeVerificationReports" o ON c."caseId" = o."caseId" AND o."createdBy" = $1
      LEFT JOIN attachments a ON c.id = a.case_id AND a."uploadedBy" = $1
      ${whereClause}
      GROUP BY DATE(c."createdAt")
      ORDER BY work_date DESC
    `;

    const productivityResult = await pool.query(productivityQuery, params);

    res.json({
      success: true,
      data: {
        agent,
        dailyProductivity: productivityResult.rows,
        summary: {
          totalWorkDays: productivityResult.rows.length,
          avgCasesPerDay:
            productivityResult.rows.reduce((sum, day) => sum + parseInt(day.cases_assigned), 0) /
              productivityResult.rows.length || 0,
          avgFormsPerDay:
            productivityResult.rows.reduce(
              (sum, day) => sum + parseInt(day.residence_forms) + parseInt(day.office_forms),
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
      conditions.push(`c."createdAt" >= $${paramIndex}`);
      params.push(dateFrom as string);
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`c."createdAt" <= $${paramIndex}`);
      params.push(dateTo as string);
      paramIndex++;
    }
    if (status) {
      conditions.push(`c.status = $${paramIndex}`);
      params.push(status as string);
      paramIndex++;
    }
    if (clientId) {
      conditions.push(`c."clientId" = $${paramIndex}`);
      params.push(parseInt(clientId as string));
      paramIndex++;
    }
    if (assignedToId) {
      conditions.push(`c."assignedTo" = $${paramIndex}`);
      params.push(assignedToId as string);
      paramIndex++;
    }
    if (priority) {
      conditions.push(`c.priority = $${paramIndex}`);
      params.push(priority as string);
      paramIndex++;
    }

    if (backendScope.scopedUserIds) {
      conditions.push(`(
        c."createdByBackendUser" = ANY($${paramIndex}::uuid[]) OR
        c."assignedTo" = ANY($${paramIndex}::uuid[]) OR
        EXISTS (
          SELECT 1 FROM verification_tasks vt_scope
          WHERE vt_scope.case_id = c.id
            AND vt_scope.assigned_to = ANY($${paramIndex}::uuid[])
        )
      )`);
      params.push(backendScope.scopedUserIds);
      paramIndex++;
    }
    if (backendScope.clientIds) {
      conditions.push(`c."clientId" = ANY($${paramIndex}::int[])`);
      params.push(backendScope.clientIds);
      paramIndex++;
    }
    if (backendScope.productIds) {
      conditions.push(`c."productId" = ANY($${paramIndex}::int[])`);
      params.push(backendScope.productIds);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get cases from database with related data
    const casesQuery = `
      SELECT 
        c.*,
        cl.name as "clientName",
        cl.code as "clientCode",
        u.name as "assignedToName",
        creator.name as "createdByName"
      FROM cases c
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN users u ON c."assignedTo" = u.id
      LEFT JOIN users creator ON c."createdByBackendUser" = creator.id
      ${whereClause}
      ORDER BY c."createdAt" DESC
    `;

    const casesResult = await pool.query(casesQuery, params);
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
      userConditions.push(`u."isActive" = $${userParamIndex}`);
      userParams.push(isActive === 'true');
      userParamIndex++;
    }

    const userWhereClause =
      userConditions.length > 0 ? `WHERE ${userConditions.join(' AND ')}` : '';

    // Get users from database
    const usersQuery = `
      SELECT u.*, COUNT(c."caseId") as "totalCases"
      FROM users u
      LEFT JOIN cases c ON u.id = c."assignedTo"
      ${userWhereClause}
      GROUP BY u.id
      ORDER BY u.name
    `;

    const usersResult = await pool.query(usersQuery, userParams);

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
      conditions.push(`cl."isActive" = $${paramIndex}`);
      params.push(isActive === 'true');
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get clients from database with case counts
    const clientsQuery = `
      SELECT cl.*, COUNT(c."caseId") as "totalCases"
      FROM clients cl
      LEFT JOIN cases c ON cl.id = c."clientId"
      ${whereClause}
      GROUP BY cl.id
      ORDER BY cl.name
    `;

    const clientsResult = await pool.query(clientsQuery, params);

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
        (SELECT COUNT(*) FROM cases) as "totalCases",
        (SELECT COUNT(*) FROM cases WHERE status = 'PENDING') as "pendingCases",
        (SELECT COUNT(*) FROM cases WHERE status = 'IN_PROGRESS') as "inProgressCases",
        (SELECT COUNT(*) FROM cases WHERE status = 'COMPLETED') as "completedCases",
        (SELECT COUNT(*) FROM users WHERE "isActive" = true) as "activeUsers",
        (SELECT COUNT(*) FROM clients WHERE "isActive" = true) as "activeClients"
    `;

    const summaryResult = await pool.query<DashboardSummaryRow>(summaryQuery);
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
        c."caseId" ILIKE $${paramIndex} OR
        c."customerName" ILIKE $${paramIndex} OR
        c."customerPhone" ILIKE $${paramIndex} OR
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
      conditions.push(`c."clientId" = $${paramIndex}`);
      params.push(parseInt(clientId as string));
      paramIndex++;
    }
    if (productId) {
      conditions.push(`c."productId" = $${paramIndex}`);
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
      conditions.push(`c."createdByBackendUser" = $${paramIndex}`);
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

    if (backendScope.scopedUserIds) {
      conditions.push(`(
        vt.assigned_to = ANY($${paramIndex}::uuid[]) OR
        c."createdByBackendUser" = ANY($${paramIndex}::uuid[])
      )`);
      params.push(backendScope.scopedUserIds);
      paramIndex++;
    }
    if (backendScope.clientIds) {
      conditions.push(`c."clientId" = ANY($${paramIndex}::int[])`);
      params.push(backendScope.clientIds);
      paramIndex++;
    }
    if (backendScope.productIds) {
      conditions.push(`c."productId" = ANY($${paramIndex}::int[])`);
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
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN products p ON c."productId" = p.id
      LEFT JOIN "verificationTypes" vt_type ON vt.verification_type_id = vt_type.id
      LEFT JOIN users u ON vt.assigned_to = u.id
      LEFT JOIN users bu ON c."createdByBackendUser" = bu.id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
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
        COALESCE(NULLIF(vt.trigger, ''), NULLIF(vt.task_type, '')) as trigger,
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
        u."employeeId" as field_user_employee_id,

        -- Case-Level Data (SECONDARY/REFERENCE)
        c.id as case_id,
        c."caseId" as case_number,
        c."customerName",
        c."customerPhone",
        c."customerCallingCode",
        c.status as case_status,
        c.priority as case_priority,
        c."createdAt" as case_created_date,
        c.total_tasks_count,
        c.completed_tasks_count,
        c.case_completion_percentage,

        -- Client and Product Data
        cl.name as client_name,
        cl.code as client_code,
        p.name as product_name,

        -- Backend User Data
        bu.name as backend_user_name,
        bu."employeeId" as backend_user_employee_id,

        -- Form Submission Data
        tfs.id as form_submission_id,
        tfs.form_type,
        tfs.submitted_at as form_submitted_date,
        tfs.validation_status as form_validation_status

      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN products p ON c."productId" = p.id
      LEFT JOIN "verificationTypes" vt_type ON vt.verification_type_id = vt_type.id
      LEFT JOIN "rateTypes" rt ON vt.rate_type_id = rt.id
      LEFT JOIN areas ar ON vt.area_id = ar.id
      LEFT JOIN users u ON vt.assigned_to = u.id
      LEFT JOIN users bu ON c."createdByBackendUser" = bu.id
      LEFT JOIN task_form_submissions tfs ON vt.id = tfs.verification_task_id

      ${whereClause}

      ORDER BY vt.created_at DESC
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `;

    params.push(limitNum, offset);
    const result = await pool.query(query, params);

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
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN products p ON c."productId" = p.id
      LEFT JOIN "verificationTypes" vt_type ON vt.verification_type_id = vt_type.id
      LEFT JOIN users u ON vt.assigned_to = u.id
      LEFT JOIN users bu ON c."createdByBackendUser" = bu.id
      ${whereClause}
    `;

    // Remove LIMIT and OFFSET parameters for summary query (last 2 params)
    const summaryResult = await pool.query(summaryQuery, params.slice(0, -2));
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
        total_tasks: parseInt(summary.total_tasks) || 0,
        total_estimated_amount: parseFloat(summary.total_estimated_amount) || 0,
        total_actual_amount: parseFloat(summary.total_actual_amount) || 0,
        completed_tasks: parseInt(summary.completed_tasks) || 0,
        task_completion_rate:
          summary.total_tasks > 0
            ? Math.round((parseInt(summary.completed_tasks) / parseInt(summary.total_tasks)) * 100)
            : 0,
        avg_tat_days: parseFloat(summary.avg_tat_days) || 0,
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
        c."caseId" ILIKE $${paramIndex} OR
        c."customerName" ILIKE $${paramIndex} OR
        c."customerPhone" ILIKE $${paramIndex} OR
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
      conditions.push(`c."clientId" = $${paramIndex}`);
      params.push(parseInt(clientId as string));
      paramIndex++;
    }
    if (productId) {
      conditions.push(`c."productId" = $${paramIndex}`);
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
      conditions.push(`c."createdByBackendUser" = $${paramIndex}`);
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

    if (backendScope.scopedUserIds) {
      conditions.push(`(
        vt.assigned_to = ANY($${paramIndex}::uuid[]) OR
        c."createdByBackendUser" = ANY($${paramIndex}::uuid[])
      )`);
      params.push(backendScope.scopedUserIds);
      paramIndex++;
    }
    if (backendScope.clientIds) {
      conditions.push(`c."clientId" = ANY($${paramIndex}::int[])`);
      params.push(backendScope.clientIds);
      paramIndex++;
    }
    if (backendScope.productIds) {
      conditions.push(`c."productId" = ANY($${paramIndex}::int[])`);
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
        u."employeeId" as field_user_employee_id,

        -- Case-Level Data (SECONDARY/REFERENCE)
        c."caseId" as case_number,
        c."customerName",
        c."customerPhone",
        c."customerCallingCode",
        c.status as case_status,
        c.priority as case_priority,
        c."createdAt" as case_created_date,
        c.total_tasks_count,
        c.completed_tasks_count,
        c.case_completion_percentage,

        -- Client and Product Data
        cl.name as client_name,
        cl.code as client_code,
        p.name as product_name,

        -- Backend User Data
        bu.name as backend_user_name,
        bu."employeeId" as backend_user_employee_id,

        -- Form Submission Data
        tfs.id as form_submission_id,
        tfs.form_type,
        tfs.submitted_at as form_submitted_date,
        tfs.validation_status as form_validation_status

      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN products p ON c."productId" = p.id
      LEFT JOIN "verificationTypes" vt_type ON vt.verification_type_id = vt_type.id
      LEFT JOIN "rateTypes" rt ON vt.rate_type_id = rt.id
      LEFT JOIN users u ON vt.assigned_to = u.id
      LEFT JOIN users bu ON c."createdByBackendUser" = bu.id
      LEFT JOIN task_form_submissions tfs ON vt.id = tfs.verification_task_id
      ${whereClause}
      ORDER BY vt.created_at DESC
    `;

    const result = await pool.query<MISReportRow>(query, params);

    if (format === 'EXCEL') {
      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('MIS Report');

      // Define columns - TASK-FIRST ORDER
      worksheet.columns = [
        // Task-Level Data (PRIMARY)
        { header: 'Task ID', key: 'task_id', width: 12 },
        { header: 'Task Number', key: 'task_number', width: 15 },
        { header: 'Task Title', key: 'task_title', width: 30 },
        { header: 'Verification Type', key: 'verification_type_name', width: 25 },
        { header: 'Task Status', key: 'task_status', width: 15 },
        { header: 'Task Priority', key: 'task_priority', width: 12 },
        { header: 'Field Agent', key: 'assigned_field_user', width: 20 },
        { header: 'Field Agent ID', key: 'field_user_employee_id', width: 15 },
        { header: 'Address', key: 'address', width: 40 },
        { header: 'Pincode', key: 'pincode', width: 10 },
        { header: 'Rate Type', key: 'rate_type', width: 15 },
        { header: 'Estimated Amount', key: 'estimated_amount', width: 18 },
        { header: 'Actual Amount', key: 'actual_amount', width: 15 },
        { header: 'Task Created Date', key: 'task_created_date', width: 20 },
        { header: 'Task Started Date', key: 'task_started_date', width: 20 },
        { header: 'Task Completion Date', key: 'task_completion_date', width: 20 },
        { header: 'Task TAT (Days)', key: 'task_tat_days', width: 15 },
        { header: 'Trigger', key: 'trigger', width: 30 },
        { header: 'Applicant Type', key: 'applicant_type', width: 20 },

        // Form Submission Data
        { header: 'Form Submission ID', key: 'form_submission_id', width: 15 },
        { header: 'Form Type', key: 'form_type', width: 20 },
        { header: 'Form Submitted Date', key: 'form_submitted_date', width: 20 },
        { header: 'Form Validation Status', key: 'form_validation_status', width: 20 },

        // Case-Level Data (SECONDARY/REFERENCE)
        { header: 'Case Number', key: 'case_number', width: 15 },
        { header: 'Customer Name', key: 'customerName', width: 25 },
        { header: 'Customer Phone', key: 'customerPhone', width: 15 },
        { header: 'Calling Code', key: 'customerCallingCode', width: 12 },
        { header: 'Client Name', key: 'client_name', width: 20 },
        { header: 'Client Code', key: 'client_code', width: 15 },
        { header: 'Product', key: 'product_name', width: 20 },
        { header: 'Case Status', key: 'case_status', width: 15 },
        { header: 'Case Priority', key: 'case_priority', width: 12 },
        { header: 'Case Created Date', key: 'case_created_date', width: 20 },
        { header: 'Backend User', key: 'backend_user_name', width: 20 },
        { header: 'Backend User ID', key: 'backend_user_employee_id', width: 15 },
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
          row.task_id || '',
          row.task_number || '',
          `"${row.task_title || ''}"`,
          `"${row.task_verification_type || ''}"`,
          row.task_status || '',
          row.task_priority || '',
          `"${row.assigned_field_user || ''}"`,
          row.field_user_employee_id || '',
          `"${row.address || ''}"`,
          row.pincode || '',
          row.rate_type || '',
          row.estimated_amount || 0,
          row.actual_amount || 0,
          row.task_created_date || '',
          row.task_started_date || '',
          row.task_completion_date || '',
          row.task_tat_days || '',
          `"${row.trigger || ''}"`,
          row.applicant_type || '',
          // Form Submission Data
          row.form_submission_id || '',
          row.form_type || '',
          row.form_submitted_date || '',
          row.form_validation_status || '',
          // Case-Level Data (SECONDARY/REFERENCE)
          row.case_number,
          `"${row.customerName || ''}"`,
          row.customerPhone || '',
          row.customerCallingCode || '',
          `"${row.client_name || ''}"`,
          row.client_code || '',
          `"${row.product_name || ''}"`,
          row.case_status || '',
          row.case_priority || '',
          row.case_created_date || '',
          `"${row.backend_user_name || ''}"`,
          row.backend_user_employee_id || '',
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

  if (backendScope.scopedUserIds) {
    conditions.push(`EXISTS (
      SELECT 1
      FROM invoice_item_tasks iit_scope
      JOIN verification_tasks vt_scope ON vt_scope.id = iit_scope.verification_task_id
      JOIN invoice_items ii_scope ON ii_scope.id = iit_scope.invoice_item_id
      WHERE ii_scope.invoice_id = i.id
        AND vt_scope.assigned_to = ANY($${paramIndex}::uuid[])
    )`);
    params.push(backendScope.scopedUserIds);
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
  const limit = Math.max(1, Math.min(100, Number(input.limit || 20)));
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
      pool.query<{ total: string }>(reportQuery.countQuery, reportQuery.params),
      pool.query<{
        id: number;
        invoice_number: string;
        client_id: number;
        product_id: number | null;
        client_name: string;
        status: string;
        currency: string;
        issue_date: string;
        due_date: string;
        paid_date: string | null;
        subtotal_amount: string;
        tax_amount: string;
        total_amount: string;
        notes: string | null;
        created_at: string;
        updated_at: string;
        client_code: string | null;
        product_name: string | null;
        item_count: number;
        total_quantity: number;
      }>(reportQuery.dataQuery, reportQuery.dataParams),
    ]);

    const total = Number(countResult.rows[0]?.total || 0);

    res.json({
      success: true,
      data: dataResult.rows.map(row => ({
        id: row.id,
        invoiceNumber: row.invoice_number,
        clientId: row.client_id,
        productId: row.product_id,
        clientName: row.client_name,
        clientCode: row.client_code,
        productName: row.product_name,
        status: row.status,
        currency: row.currency,
        issueDate: row.issue_date,
        dueDate: row.due_date,
        paidDate: row.paid_date,
        subtotalAmount: Number(row.subtotal_amount || 0),
        taxAmount: Number(row.tax_amount || 0),
        totalAmount: Number(row.total_amount || 0),
        notes: row.notes || '',
        itemCount: row.item_count,
        totalQuantity: row.total_quantity,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
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
    const result = await pool.query<{
      invoice_number: string;
      client_name: string;
      product_name: string | null;
      status: string;
      issue_date: string;
      due_date: string;
      paid_date: string | null;
      subtotal_amount: string;
      tax_amount: string;
      total_amount: string;
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
          row.invoice_number,
          `"${row.client_name || ''}"`,
          `"${row.product_name || ''}"`,
          row.status,
          row.issue_date || '',
          row.due_date || '',
          row.paid_date || '',
          row.subtotal_amount || '0',
          row.tax_amount || '0',
          row.total_amount || '0',
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
