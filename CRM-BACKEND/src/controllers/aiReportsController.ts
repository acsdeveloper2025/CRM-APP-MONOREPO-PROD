import { Request, Response } from 'express';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { createAuditLog } from '../utils/auditLogger';
import { AuthenticatedRequest } from '../middleware/auth';
import { geminiAIService, VerificationReportData } from '../services/GeminiAIService';
import { getReportTemplate, getRiskAssessment } from '../utils/reportTemplates';

/**
 * Generate AI-powered verification report for a form submission
 */
export const generateFormSubmissionReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId, submissionId } = req.params;
    const userId = req.user?.id;

    if (!caseId || !submissionId) {
      return res.status(400).json({
        success: false,
        message: 'Case ID and Submission ID are required'
      });
    }

    logger.info('Generating AI report for form submission', {
      caseId,
      submissionId,
      userId
    });

    // First get the case UUID from the case ID
    const caseUuidQuery = `
      SELECT id, "caseId" FROM cases WHERE "caseId" = $1
    `;
    const caseUuidResult = await pool.query(caseUuidQuery, [parseInt(caseId)]);

    if (caseUuidResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    const caseUuid = caseUuidResult.rows[0].id;

    // Get case details using UUID
    const caseQuery = `
      SELECT c.*, u.name as assigned_to_name, cl.name as client_name
      FROM cases c
      LEFT JOIN users u ON c."assignedTo" = u.id
      LEFT JOIN clients cl ON c."clientId" = cl.id
      WHERE c.id = $1
    `;
    const caseResult = await pool.query(caseQuery, [caseUuid]);

    if (caseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    const caseData = caseResult.rows[0];

    // Get form submission data based on verification type
    const submissionData = await getFormSubmissionData(caseUuid, submissionId, caseData.verificationType);

    if (!submissionData) {
      return res.status(404).json({
        success: false,
        message: 'Form submission not found'
      });
    }

    // Prepare data for AI report generation
    const reportData: VerificationReportData = {
      verificationType: caseData.verificationType,
      outcome: submissionData.verification_outcome || submissionData.form_type || 'UNKNOWN',
      formData: submissionData,
      caseDetails: {
        caseId: caseData.caseId?.toString() || caseId,
        customerName: caseData.customerName,
        address: `${caseData.addressStreet}, ${caseData.addressCity}, ${caseData.addressState} ${caseData.addressPincode}`,
        verificationDate: submissionData.verification_date || new Date().toISOString().split('T')[0],
        agentName: caseData.assigned_to_name || 'Unknown Agent'
      },
      geoLocation: submissionData.latitude && submissionData.longitude ? {
        latitude: parseFloat(submissionData.latitude),
        longitude: parseFloat(submissionData.longitude),
        address: submissionData.captured_address
      } : undefined,
      photos: await getSubmissionPhotos(caseUuid, submissionId),
      metadata: {
        submissionId,
        clientName: caseData.client_name,
        priority: caseData.priority,
        status: caseData.status
      }
    };

    // Generate AI report
    const aiResult = await geminiAIService.generateVerificationReport(reportData);

    if (!aiResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate AI report',
        error: aiResult.error
      });
    }

    // Get additional template-based insights
    const template = getReportTemplate(caseData.verificationType, reportData.outcome);
    const riskAssessment = getRiskAssessment(caseData.verificationType, reportData.outcome);

    // Combine AI report with template insights
    const enhancedReport = {
      ...aiResult.report,
      templateInsights: {
        verificationType: template.verificationType,
        statusCategory: template.statusCategory,
        keyFields: template.keyFields,
        riskAssessment: {
          level: riskAssessment.level,
          factors: riskAssessment.factors,
          mitigation: riskAssessment.mitigation
        },
        recommendations: template.recommendations
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: userId,
        caseId,
        submissionId,
        verificationType: caseData.verificationType,
        outcome: reportData.outcome
      }
    };

    // Save report to database
    const savedReport = await saveAIReport(caseUuid, submissionId, enhancedReport, userId);

    // Create audit log
    await createAuditLog({
      action: 'AI_REPORT_GENERATED',
      entityType: 'AI_REPORT',
      entityId: savedReport.id,
      userId: userId!,
      details: {
        caseId,
        submissionId,
        verificationType: caseData.verificationType,
        outcome: reportData.outcome,
        confidence: aiResult.report?.confidence
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    logger.info('AI report generated successfully', {
      caseId,
      submissionId,
      reportId: savedReport.id,
      confidence: aiResult.report?.confidence
    });

    res.json({
      success: true,
      data: {
        report: enhancedReport,
        reportId: savedReport.id
      },
      message: 'AI verification report generated successfully'
    });

  } catch (error) {
    logger.error('Error generating AI report:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get saved AI report for a form submission
 */
export const getFormSubmissionReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId, submissionId } = req.params;

    // First get the case UUID from the case ID
    const caseUuidQuery = `
      SELECT id FROM cases WHERE "caseId" = $1
    `;
    const caseUuidResult = await pool.query(caseUuidQuery, [parseInt(caseId)]);

    if (caseUuidResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    const caseUuid = caseUuidResult.rows[0].id;

    const query = `
      SELECT * FROM ai_reports
      WHERE case_id = $1 AND submission_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [caseUuid, submissionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'AI report not found'
      });
    }

    const report = result.rows[0];

    res.json({
      success: true,
      data: {
        id: report.id,
        report: report.report_data,
        generatedAt: report.created_at,
        generatedBy: report.generated_by
      },
      message: 'AI report retrieved successfully'
    });

  } catch (error) {
    logger.error('Error retrieving AI report:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Test Gemini AI connection
 */
export const testAIConnection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await geminiAIService.testConnection();

    res.json({
      success: result.success,
      message: result.success ? 'AI connection successful' : 'AI connection failed',
      error: result.error
    });

  } catch (error) {
    logger.error('Error testing AI connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test AI connection',
      error: error.message
    });
  }
};

/**
 * Get AI report statistics
 */
export const getReportStatistics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dateFrom, dateTo, verificationType } = req.query;

    let whereClause = '';
    const params: any[] = [];

    if (dateFrom || dateTo || verificationType) {
      const conditions: string[] = [];

      if (dateFrom) {
        conditions.push(`created_at >= $${params.length + 1}`);
        params.push(dateFrom);
      }

      if (dateTo) {
        conditions.push(`created_at <= $${params.length + 1}`);
        params.push(dateTo);
      }

      if (verificationType) {
        conditions.push(`(report_data->'metadata'->>'verificationType') = $${params.length + 1}`);
        params.push(verificationType);
      }

      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const statsQuery = `
      SELECT
        COUNT(*) as total_reports,
        AVG((report_data->>'confidence')::numeric) as average_confidence,
        COUNT(CASE WHEN (report_data->'templateInsights'->'riskAssessment'->>'level') = 'LOW' THEN 1 END) as low_risk,
        COUNT(CASE WHEN (report_data->'templateInsights'->'riskAssessment'->>'level') = 'MEDIUM' THEN 1 END) as medium_risk,
        COUNT(CASE WHEN (report_data->'templateInsights'->'riskAssessment'->>'level') = 'HIGH' THEN 1 END) as high_risk
      FROM ai_reports ${whereClause}
    `;

    const result = await pool.query(statsQuery, params);
    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        totalReports: parseInt(stats.total_reports) || 0,
        averageConfidence: parseFloat(stats.average_confidence) || 0,
        riskDistribution: {
          low: parseInt(stats.low_risk) || 0,
          medium: parseInt(stats.medium_risk) || 0,
          high: parseInt(stats.high_risk) || 0
        },
        verificationTypeBreakdown: [] // TODO: Implement detailed breakdown
      }
    });

  } catch (error) {
    logger.error('Error getting report statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get report statistics'
    });
  }
};

/**
 * Get form submission data based on verification type
 */
async function getFormSubmissionData(caseId: string, submissionId: string, verificationType: string) {
  const tableMap: Record<string, string> = {
    'RESIDENCE': '"residenceVerificationReports"',
    'RESIDENCE_CUM_OFFICE': '"residenceCumOfficeVerificationReports"',
    'OFFICE': '"officeVerificationReports"',
    'BUSINESS': '"businessVerificationReports"',
    'BUILDER': '"builderVerificationReports"',
    'NOC': '"nocVerificationReports"',
    'DSA_CONNECTOR': '"dsaConnectorVerificationReports"',
    'PROPERTY_APF': '"propertyApfVerificationReports"',
    'PROPERTY_INDIVIDUAL': '"propertyIndividualVerificationReports"'
  };

  const tableName = tableMap[verificationType.toUpperCase()];
  if (!tableName) {
    throw new Error(`Unknown verification type: ${verificationType}`);
  }

  const query = `SELECT * FROM ${tableName} WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`;
  const result = await pool.query(query, [caseId]);

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get photos associated with the submission
 */
async function getSubmissionPhotos(caseId: string, submissionId: string) {
  try {
    const query = `
      SELECT "mimeType", "fileSize", "createdAt"
      FROM attachments
      WHERE case_id = $1
      AND "mimeType" LIKE 'image/%'
      ORDER BY "createdAt" DESC
    `;
    
    const result = await pool.query(query, [caseId]);
    
    return result.rows.map(row => ({
      type: 'verification',
      metadata: {
        fileSize: row.fileSize,
        capturedAt: row.createdAt
      }
    }));
  } catch (error) {
    logger.error('Error fetching submission photos:', error);
    return [];
  }
}

/**
 * Save AI report to database
 */
async function saveAIReport(caseId: string, submissionId: string, reportData: any, userId: string) {
  const query = `
    INSERT INTO ai_reports (case_id, submission_id, report_data, generated_by, created_at)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING id, created_at
  `;
  
  const result = await pool.query(query, [
    caseId,
    submissionId,
    JSON.stringify(reportData),
    userId
  ]);

  return result.rows[0];
}
