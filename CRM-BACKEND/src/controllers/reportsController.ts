import { Request, Response } from 'express';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from '@/middleware/auth';
import { pool } from '@/config/database';

// ===== PHASE 1: NEW DATA VISUALIZATION & REPORTING APIs =====

// 1.1 FORM SUBMISSION DATA APIs

// GET /api/reports/form-submissions - Get all form submissions with analytics
export const getFormSubmissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      formType,
      dateFrom,
      dateTo,
      agentId,
      validationStatus,
      caseId,
      limit = 100,
      offset = 0
    } = req.query;

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (formType) {
      conditions.push(`form_type = $${paramIndex}`);
      params.push(formType);
      paramIndex++;
    }
    if (dateFrom) {
      conditions.push(`submitted_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`submitted_at <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }
    if (agentId) {
      conditions.push(`submitted_by = $${paramIndex}`);
      params.push(agentId);
      paramIndex++;
    }
    if (validationStatus) {
      conditions.push(`validation_status = $${paramIndex}`);
      params.push(validationStatus);
      paramIndex++;
    }
    if (caseId) {
      conditions.push(`case_id = $${paramIndex}`);
      params.push(caseId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get form submissions with related data using the standardized view
    const query = `
      SELECT
        fs.*,
        c."customerName",
        c."caseId" as "caseNumber",
        u.name as "agentName",
        u."employeeId",
        COUNT(a.id) as "attachmentCount"
      FROM form_submissions_view fs
      LEFT JOIN cases c ON fs.case_id = c.id
      LEFT JOIN users u ON fs.submitted_by = u.id
      LEFT JOIN attachments a ON a.case_id = c.id
      ${whereClause}
      GROUP BY fs.form_type, fs.case_id, fs.submitted_by, fs.submitted_at,
               fs.validation_status, fs.submission_data, fs.photos_count,
               c."customerName", c."caseId", u.name, u."employeeId"
      ORDER BY fs.submitted_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(parseInt(limit as string), parseInt(offset as string));
    const result = await pool.query(query, params);

    // Get summary statistics
    const summaryQuery = `
      SELECT
        COUNT(*) as total_submissions,
        COUNT(CASE WHEN validation_status = 'VALID' THEN 1 END) as valid_submissions,
        COUNT(CASE WHEN validation_status = 'PENDING' THEN 1 END) as pending_submissions,
        COUNT(CASE WHEN form_type = 'RESIDENCE' THEN 1 END) as residence_forms,
        COUNT(CASE WHEN form_type = 'OFFICE' THEN 1 END) as office_forms
      FROM (
        SELECT
          'RESIDENCE' as form_type,
          CASE WHEN "residenceConfirmed" IS NOT NULL THEN 'VALID' ELSE 'PENDING' END as validation_status
        FROM "residenceVerificationReports"
        UNION ALL
        SELECT
          'OFFICE' as form_type,
          CASE WHEN "officeConfirmed" IS NOT NULL THEN 'VALID' ELSE 'PENDING' END as validation_status
        FROM "officeVerificationReports"
      ) all_forms
    `;

    const summaryResult = await pool.query(summaryQuery);
    const summary = summaryResult.rows[0];

    logger.info('Form submissions report generated', {
      userId: req.user?.id,
      totalSubmissions: summary.total_submissions,
      filters: { formType, dateFrom, dateTo, agentId }
    });

    res.json({
      success: true,
      data: {
        submissions: result.rows,
        summary: {
          totalSubmissions: parseInt(summary.total_submissions),
          validSubmissions: parseInt(summary.valid_submissions),
          pendingSubmissions: parseInt(summary.pending_submissions),
          residenceForms: parseInt(summary.residence_forms),
          officeForms: parseInt(summary.office_forms),
          validationRate: summary.total_submissions > 0
            ? (summary.valid_submissions / summary.total_submissions) * 100
            : 0
        },
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: parseInt(summary.total_submissions)
        }
      },
      message: 'Form submissions report generated successfully',
    });
  } catch (error) {
    logger.error('Error generating form submissions report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate form submissions report',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/reports/form-submissions/:formType - Get specific form type submissions
export const getFormSubmissionsByType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { formType } = req.params;
    const { dateFrom, dateTo, agentId, limit = 50, offset = 0 } = req.query;

    if (!['RESIDENCE', 'OFFICE', 'BUSINESS'].includes(formType.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid form type. Must be RESIDENCE, OFFICE, or BUSINESS',
        error: { code: 'INVALID_FORM_TYPE' }
      });
    }

    const conditions: string[] = [];
    const params: any[] = [];
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
    if (agentId) {
      conditions.push(`"createdBy" = $${paramIndex}`);
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

    params.push(parseInt(limit as string), parseInt(offset as string));
    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: {
        formType: formType.toUpperCase(),
        submissions: result.rows,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: result.rows.length
        }
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
    const { dateFrom, dateTo } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];
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

    // Get validation status for all form types
    const validationQuery = `
      SELECT
        'RESIDENCE' as form_type,
        COUNT(*) as total_forms,
        COUNT(CASE WHEN "residenceConfirmed" IS NOT NULL THEN 1 END) as validated_forms,
        COUNT(CASE WHEN "residenceConfirmed" IS NULL THEN 1 END) as pending_forms,
        AVG(CASE WHEN "residenceConfirmed" IS NOT NULL
            THEN EXTRACT(EPOCH FROM ("updatedAt" - "createdAt"))/3600
            END) as avg_validation_time_hours
      FROM "residenceVerificationReports"
      ${whereClause}

      UNION ALL

      SELECT
        'OFFICE' as form_type,
        COUNT(*) as total_forms,
        COUNT(CASE WHEN "officeConfirmed" IS NOT NULL THEN 1 END) as validated_forms,
        COUNT(CASE WHEN "officeConfirmed" IS NULL THEN 1 END) as pending_forms,
        AVG(CASE WHEN "officeConfirmed" IS NOT NULL
            THEN EXTRACT(EPOCH FROM ("updatedAt" - "createdAt"))/3600
            END) as avg_validation_time_hours
      FROM "officeVerificationReports"
      ${whereClause}
    `;

    const validationResult = await pool.query(validationQuery, params);

    const summary = validationResult.rows.reduce((acc, row) => {
      acc.totalForms += parseInt(row.total_forms);
      acc.validatedForms += parseInt(row.validated_forms);
      acc.pendingForms += parseInt(row.pending_forms);
      return acc;
    }, { totalForms: 0, validatedForms: 0, pendingForms: 0 });

    res.json({
      success: true,
      data: {
        summary: {
          ...summary,
          validationRate: summary.totalForms > 0
            ? (summary.validatedForms / summary.totalForms) * 100
            : 0
        },
        byFormType: validationResult.rows,
        generatedAt: new Date().toISOString(),
        generatedBy: req.user?.id
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
    const { dateFrom, dateTo, clientId, agentId, status } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];
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
      params.push(parseInt(clientId as string));
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

    // Get comprehensive case analytics
    const analyticsQuery = `
      SELECT
        c.*,
        cl.name as "clientName",
        u.name as "agentName",
        u."employeeId",
        COUNT(DISTINCT r.id) as "residenceReports",
        COUNT(DISTINCT o.id) as "officeReports",
        COUNT(DISTINCT a.id) as "attachmentCount",
        CASE
          WHEN c.status IN ('COMPLETED', 'APPROVED') AND c."updatedAt" IS NOT NULL
          THEN EXTRACT(EPOCH FROM (c."updatedAt" - c."createdAt"))/86400
          ELSE NULL
        END as "completionDays",
        CASE
          WHEN COUNT(DISTINCT r.id) + COUNT(DISTINCT o.id) > 0
          THEN ROUND(
            (COUNT(CASE WHEN r."residenceConfirmed" IS NOT NULL THEN 1 END) +
             COUNT(CASE WHEN o."officeConfirmed" IS NOT NULL THEN 1 END))::numeric /
            (COUNT(DISTINCT r.id) + COUNT(DISTINCT o.id)) * 100, 2
          )
          ELSE 0
        END as "formCompletionPercentage"
      FROM cases c
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN users u ON c."assignedTo" = u.id
      LEFT JOIN "residenceVerificationReports" r ON c."caseId" = r."caseId"
      LEFT JOIN "officeVerificationReports" o ON c."caseId" = o."caseId"
      LEFT JOIN attachments a ON c.id = a.case_id
      ${whereClause}
      GROUP BY c.id, c."caseId", cl.name, u.name, u."employeeId"
      ORDER BY c."createdAt" DESC
    `;

    const analyticsResult = await pool.query(analyticsQuery, params);

    // Calculate summary metrics
    const cases = analyticsResult.rows;
    const totalCases = cases.length;
    const completedCases = cases.filter(c => ['COMPLETED', 'APPROVED'].includes(c.status)).length;
    const avgCompletionDays = cases
      .filter(c => c.completionDays !== null)
      .reduce((sum, c) => sum + parseFloat(c.completionDays), 0) /
      cases.filter(c => c.completionDays !== null).length || 0;

    const avgFormCompletion = cases.reduce((sum, c) => sum + parseFloat(c.formCompletionPercentage), 0) / totalCases || 0;

    // Status distribution
    const statusDistribution = cases.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      data: {
        summary: {
          totalCases,
          completedCases,
          completionRate: totalCases > 0 ? (completedCases / totalCases) * 100 : 0,
          avgCompletionDays: Math.round(avgCompletionDays * 100) / 100,
          avgFormCompletion: Math.round(avgFormCompletion * 100) / 100,
          statusDistribution
        },
        cases,
        generatedAt: new Date().toISOString(),
        generatedBy: req.user?.id
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
    const { caseId } = req.params;

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
        error: { code: 'CASE_NOT_FOUND' }
      });
    }

    const caseData = caseResult.rows[0];

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
          formsSubmitted: timelineResult.rows.filter(e => e.event_type.includes('FORM_SUBMITTED')).length,
          attachmentsUploaded: timelineResult.rows.filter(e => e.event_type === 'ATTACHMENT_UPLOADED').length
        }
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
    const { dateFrom, dateTo, agentId, departmentId } = req.query;

    const conditions: string[] = ['u.role = $1'];
    const params: any[] = ['FIELD_AGENT'];
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
    if (agentId) {
      conditions.push(`u.id = $${paramIndex}`);
      params.push(agentId);
      paramIndex++;
    }
    if (departmentId) {
      conditions.push(`u."departmentId" = $${paramIndex}`);
      params.push(parseInt(departmentId as string));
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Get comprehensive agent performance data
    const performanceQuery = `
      SELECT
        u.id,
        u.name,
        u."employeeId",
        u.email,
        d.name as "departmentName",
        COUNT(DISTINCT c.id) as "totalCasesAssigned",
        COUNT(DISTINCT CASE WHEN c.status IN ('COMPLETED', 'APPROVED') THEN c.id END) as "casesCompleted",
        COUNT(DISTINCT r.id) as "residenceFormsSubmitted",
        COUNT(DISTINCT o.id) as "officeFormsSubmitted",
        COUNT(DISTINCT a.id) as "attachmentsUploaded",
        AVG(CASE
          WHEN c.status IN ('COMPLETED', 'APPROVED') AND c."updatedAt" IS NOT NULL
          THEN EXTRACT(EPOCH FROM (c."updatedAt" - c."createdAt"))/86400
        END) as "avgCompletionDays",
        ROUND(
          CASE
            WHEN COUNT(DISTINCT r.id) + COUNT(DISTINCT o.id) > 0
            THEN (COUNT(CASE WHEN r."residenceConfirmed" IS NOT NULL THEN 1 END) +
                  COUNT(CASE WHEN o."officeConfirmed" IS NOT NULL THEN 1 END))::numeric /
                 (COUNT(DISTINCT r.id) + COUNT(DISTINCT o.id)) * 100
            ELSE 0
          END, 2
        ) as "formQualityScore",
        COUNT(DISTINCT DATE(c."createdAt")) as "activeDays"
      FROM users u
      LEFT JOIN departments d ON u."departmentId" = d.id
      LEFT JOIN cases c ON u.id = c."assignedTo"
      LEFT JOIN "residenceVerificationReports" r ON c."caseId" = r."caseId" AND r."createdBy" = u.id
      LEFT JOIN "officeVerificationReports" o ON c."caseId" = o."caseId" AND o."createdBy" = u.id
      LEFT JOIN attachments a ON c.id = a.case_id AND a."uploadedBy" = u.id
      ${whereClause}
      GROUP BY u.id, u.name, u."employeeId", u.email, d.name
      ORDER BY "casesCompleted" DESC, "formQualityScore" DESC
    `;

    const performanceResult = await pool.query(performanceQuery, params);
    const agents = performanceResult.rows;

    // Calculate summary metrics
    const totalAgents = agents.length;
    const activeAgents = agents.filter(a => parseInt(a.totalCasesAssigned) > 0).length;
    const avgCasesPerAgent = agents.reduce((sum, a) => sum + parseInt(a.totalCasesAssigned), 0) / totalAgents || 0;
    const avgCompletionRate = agents.reduce((sum, a) => {
      const rate = parseInt(a.totalCasesAssigned) > 0
        ? (parseInt(a.casesCompleted) / parseInt(a.totalCasesAssigned)) * 100
        : 0;
      return sum + rate;
    }, 0) / totalAgents || 0;

    // Top performers
    const topPerformers = agents
      .filter(a => parseInt(a.totalCasesAssigned) > 0)
      .sort((a, b) => {
        const aScore = (parseInt(a.casesCompleted) / parseInt(a.totalCasesAssigned)) * parseFloat(a.formQualityScore);
        const bScore = (parseInt(b.casesCompleted) / parseInt(b.totalCasesAssigned)) * parseFloat(b.formQualityScore);
        return bScore - aScore;
      })
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        summary: {
          totalAgents,
          activeAgents,
          avgCasesPerAgent: Math.round(avgCasesPerAgent * 100) / 100,
          avgCompletionRate: Math.round(avgCompletionRate * 100) / 100
        },
        agents,
        topPerformers,
        generatedAt: new Date().toISOString(),
        generatedBy: req.user?.id
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
    const { agentId } = req.params;
    const { dateFrom, dateTo } = req.query;

    // Verify agent exists
    const agentQuery = `
      SELECT u.*, d.name as "departmentName"
      FROM users u
      LEFT JOIN departments d ON u."departmentId" = d.id
      WHERE u.id = $1 AND u.role = 'FIELD_AGENT'
    `;
    const agentResult = await pool.query(agentQuery, [agentId]);

    if (agentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Field agent not found',
        error: { code: 'AGENT_NOT_FOUND' }
      });
    }

    const agent = agentResult.rows[0];

    const conditions: string[] = ['c."assignedTo" = $1'];
    const params: any[] = [agentId];
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
        COUNT(DISTINCT CASE WHEN c.status IN ('COMPLETED', 'APPROVED') THEN c.id END) as cases_completed,
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
          avgCasesPerDay: productivityResult.rows.reduce((sum, day) => sum + parseInt(day.cases_assigned), 0) / productivityResult.rows.length || 0,
          avgFormsPerDay: productivityResult.rows.reduce((sum, day) => sum + parseInt(day.residence_forms) + parseInt(day.office_forms), 0) / productivityResult.rows.length || 0
        }
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
      format = 'JSON' 
    } = req.query;

    // Build WHERE conditions for database query
    const conditions: string[] = [];
    const params: any[] = [];
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
    if (status) {
      conditions.push(`c.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    if (clientId) {
      conditions.push(`c."clientId" = $${paramIndex}`);
      params.push(parseInt(clientId as string));
      paramIndex++;
    }
    if (assignedToId) {
      conditions.push(`c."assignedTo" = $${paramIndex}`);
      params.push(assignedToId);
      paramIndex++;
    }
    if (priority) {
      conditions.push(`c.priority = $${paramIndex}`);
      params.push(priority);
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
    const completedCases = filteredCases.filter(c => c.status === 'COMPLETED' || c.status === 'APPROVED').length;
    const pendingCases = filteredCases.filter(c => c.status === 'PENDING' || c.status === 'IN_PROGRESS').length;
    
    // Calculate average turnaround time for completed cases
    const completedCasesWithDates = filteredCases.filter(c => c.updatedAt && (c.status === 'COMPLETED' || c.status === 'APPROVED'));
    const avgTurnaroundTime = completedCasesWithDates.length > 0 
      ? completedCasesWithDates.reduce((acc, c) => {
          const days = (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24);
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
        priority: priority as string 
      },
      generatedAt: new Date().toISOString(),
      generatedBy: req.user?.id,
    };

    logger.info('Cases report generated', {
      userId: req.user?.id,
      totalCases,
      filters: { dateFrom, dateTo, clientId, status }
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
    const { 
      dateFrom, 
      dateTo, 
      department, 
      role,
      isActive, 
      format = 'JSON' 
    } = req.query;

    // Build WHERE conditions for users query
    const userConditions: string[] = [];
    const userParams: any[] = [];
    let userParamIndex = 1;

    if (department) {
      userConditions.push(`u.department = $${userParamIndex}`);
      userParams.push(department);
      userParamIndex++;
    }
    if (role) {
      userConditions.push(`u.role = $${userParamIndex}`);
      userParams.push(role);
      userParamIndex++;
    }
    if (isActive !== undefined) {
      userConditions.push(`u."isActive" = $${userParamIndex}`);
      userParams.push(isActive === 'true');
      userParamIndex++;
    }

    const userWhereClause = userConditions.length > 0 ? `WHERE ${userConditions.join(' AND ')}` : '';

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
        dateFrom: dateFrom as string, 
        dateTo: dateTo as string, 
        department: department as string, 
        role: role as string,
        isActive: isActive as string 
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
    const { 
      isActive, 
      format = 'JSON' 
    } = req.query;

    // Build WHERE conditions for clients query
    const conditions: string[] = [];
    const params: any[] = [];
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
        isActive: isActive as string 
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

    const summaryResult = await pool.query(summaryQuery);
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
