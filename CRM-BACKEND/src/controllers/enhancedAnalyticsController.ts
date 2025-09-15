import { Request, Response } from 'express';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Enhanced Analytics Controller
 * Leverages new Phase 2 database schema for advanced analytics
 */

// Enhanced Form Submissions Analytics
export const getEnhancedFormSubmissions = async (req: Request, res: Response) => {
  try {
    const {
      limit = 50,
      offset = 0,
      dateFrom,
      dateTo,
      formType,
      validationStatus,
      agentId,
      caseId
    } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    // Build dynamic WHERE clause
    if (dateFrom) {
      whereConditions.push(`fs.submitted_at >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`fs.submitted_at <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }

    if (formType) {
      whereConditions.push(`fs.form_type = $${paramIndex}`);
      queryParams.push(formType);
      paramIndex++;
    }

    if (validationStatus) {
      whereConditions.push(`fs.validation_status = $${paramIndex}`);
      queryParams.push(validationStatus);
      paramIndex++;
    }

    if (agentId) {
      whereConditions.push(`fs.submitted_by = $${paramIndex}`);
      queryParams.push(agentId);
      paramIndex++;
    }

    if (caseId) {
      whereConditions.push(`c."caseId" = $${paramIndex}`);
      queryParams.push(caseId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Main query using the analytics view
    const submissionsQuery = `
      SELECT 
        fs.*,
        fqm.overall_quality_score,
        fqm.completeness_score,
        fqm.accuracy_score,
        fqm.photo_quality_score,
        COUNT(*) OVER() as total_count
      FROM form_submission_analytics fs
      LEFT JOIN form_quality_metrics fqm ON fs.id = fqm.form_submission_id
      ${whereClause}
      ORDER BY fs.submitted_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    // Summary statistics query
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_submissions,
        COUNT(CASE WHEN validation_status = 'VALID' THEN 1 END) as valid_submissions,
        COUNT(CASE WHEN validation_status = 'PENDING' THEN 1 END) as pending_submissions,
        COUNT(CASE WHEN validation_status = 'INVALID' THEN 1 END) as invalid_submissions,
        COUNT(CASE WHEN form_type = 'RESIDENCE' THEN 1 END) as residence_forms,
        COUNT(CASE WHEN form_type = 'OFFICE' THEN 1 END) as office_forms,
        COUNT(CASE WHEN form_type = 'BUSINESS' THEN 1 END) as business_forms,
        AVG(submission_score) as avg_submission_score,
        AVG(photos_count) as avg_photos_per_form,
        AVG(time_spent_minutes) as avg_time_spent_minutes,
        ROUND(
          COUNT(CASE WHEN validation_status = 'VALID' THEN 1 END) * 100.0 / 
          NULLIF(COUNT(*), 0), 2
        ) as validation_rate
      FROM form_submission_analytics
      ${whereClause}
    `;

    const [submissionsResult, summaryResult] = await Promise.all([
      pool.query(submissionsQuery, queryParams),
      pool.query(summaryQuery, queryParams.slice(0, -2)) // Remove limit/offset for summary
    ]);

    res.json({
      success: true,
      data: {
        submissions: submissionsResult.rows,
        summary: summaryResult.rows[0],
        pagination: {
          total: submissionsResult.rows[0]?.total_count || 0,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      }
    });

  } catch (error) {
    logger.error('Error in getEnhancedFormSubmissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enhanced form submissions',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Enhanced Agent Performance Analytics
export const getEnhancedAgentPerformance = async (req: Request, res: Response) => {
  try {
    const {
      dateFrom,
      dateTo,
      agentId,
      departmentId,
      includeDaily = false
    } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    // Build WHERE clause for daily performance data
    if (dateFrom) {
      whereConditions.push(`apd.date >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`apd.date <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }

    if (agentId) {
      whereConditions.push(`u.id = $${paramIndex}`);
      queryParams.push(agentId);
      paramIndex++;
    }

    if (departmentId) {
      whereConditions.push(`u."departmentId" = $${paramIndex}`);
      queryParams.push(departmentId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Enhanced agent performance query
    const performanceQuery = `
      SELECT 
        u.id,
        u.name,
        u."employeeId",
        u.email,
        u.performance_rating,
        u.total_cases_handled,
        u.avg_case_completion_days,
        u.last_active_at,
        d.name as department_name,
        
        -- Aggregated daily metrics
        COUNT(DISTINCT apd.date) as active_days,
        COALESCE(SUM(apd.cases_assigned), 0) as total_cases_assigned,
        COALESCE(SUM(apd.cases_completed), 0) as cases_completed,
        COALESCE(SUM(apd.forms_submitted), 0) as total_forms_submitted,
        COALESCE(SUM(apd.residence_forms), 0) as residence_forms_submitted,
        COALESCE(SUM(apd.office_forms), 0) as office_forms_submitted,
        COALESCE(SUM(apd.business_forms), 0) as business_forms_submitted,
        COALESCE(SUM(apd.attachments_uploaded), 0) as attachments_uploaded,
        COALESCE(AVG(apd.quality_score), 0) as avg_quality_score,
        COALESCE(AVG(apd.validation_success_rate), 0) as avg_validation_success_rate,
        COALESCE(SUM(apd.total_distance_km), 0) as total_distance_km,
        COALESCE(AVG(apd.active_hours), 0) as avg_active_hours_per_day,
        
        -- Performance calculations
        CASE 
          WHEN SUM(apd.cases_assigned) > 0 
          THEN ROUND((SUM(apd.cases_completed) * 100.0 / SUM(apd.cases_assigned)), 2)
          ELSE 0 
        END as completion_rate,
        
        CASE 
          WHEN COUNT(DISTINCT apd.date) > 0 
          THEN ROUND((SUM(apd.forms_submitted) * 1.0 / COUNT(DISTINCT apd.date)), 2)
          ELSE 0 
        END as avg_forms_per_day
        
      FROM users u
      LEFT JOIN departments d ON u."departmentId" = d.id
      LEFT JOIN agent_performance_daily apd ON u.id = apd.agent_id
      ${whereClause}
      AND u.role = 'FIELD_AGENT'
      GROUP BY u.id, u.name, u."employeeId", u.email, u.performance_rating, 
               u.total_cases_handled, u.avg_case_completion_days, u.last_active_at, d.name
      ORDER BY avg_quality_score DESC, completion_rate DESC
    `;

    // Summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT u.id) as total_agents,
        COUNT(DISTINCT CASE WHEN u.last_active_at > NOW() - INTERVAL '7 days' THEN u.id END) as active_agents,
        AVG(u.performance_rating) as avg_performance_rating,
        AVG(u.avg_case_completion_days) as avg_completion_days,
        
        -- From daily performance data
        AVG(apd.quality_score) as avg_quality_score,
        AVG(apd.validation_success_rate) as avg_validation_success_rate,
        SUM(apd.cases_completed) as total_cases_completed,
        SUM(apd.forms_submitted) as total_forms_submitted
        
      FROM users u
      LEFT JOIN agent_performance_daily apd ON u.id = apd.agent_id
      ${whereClause}
      AND u.role = 'FIELD_AGENT'
    `;

    const [performanceResult, summaryResult] = await Promise.all([
      pool.query(performanceQuery, queryParams),
      pool.query(summaryQuery, queryParams)
    ]);

    let dailyData = null;
    if (includeDaily === 'true' && agentId) {
      const dailyQuery = `
        SELECT 
          date,
          cases_assigned,
          cases_completed,
          forms_submitted,
          quality_score,
          validation_success_rate,
          active_hours,
          total_distance_km
        FROM agent_performance_daily
        WHERE agent_id = $1
        ${dateFrom ? 'AND date >= $2' : ''}
        ${dateTo ? `AND date <= $${dateFrom ? '3' : '2'}` : ''}
        ORDER BY date DESC
        LIMIT 30
      `;
      
      const dailyParams = [agentId];
      if (dateFrom) dailyParams.push(dateFrom as string);
      if (dateTo) dailyParams.push(dateTo as string);
      
      const dailyResult = await pool.query(dailyQuery, dailyParams);
      dailyData = dailyResult.rows;
    }

    // Top performers
    const topPerformersQuery = `
      SELECT 
        u.id,
        u.name,
        u."employeeId",
        AVG(apd.quality_score) as avg_quality_score,
        SUM(apd.cases_completed) as total_completed,
        AVG(apd.validation_success_rate) as validation_rate
      FROM users u
      JOIN agent_performance_daily apd ON u.id = apd.agent_id
      ${whereClause}
      AND u.role = 'FIELD_AGENT'
      GROUP BY u.id, u.name, u."employeeId"
      HAVING AVG(apd.quality_score) > 85
      ORDER BY AVG(apd.quality_score) DESC, SUM(apd.cases_completed) DESC
      LIMIT 10
    `;

    const topPerformersResult = await pool.query(topPerformersQuery, queryParams);

    res.json({
      success: true,
      data: {
        agents: performanceResult.rows,
        summary: summaryResult.rows[0],
        topPerformers: topPerformersResult.rows,
        dailyData: dailyData
      }
    });

  } catch (error) {
    logger.error('Error in getEnhancedAgentPerformance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enhanced agent performance',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Enhanced Case Analytics with Timeline
export const getEnhancedCaseAnalytics = async (req: Request, res: Response) => {
  try {
    const {
      limit = 50,
      offset = 0,
      dateFrom,
      dateTo,
      status,
      agentId,
      clientId,
      includeTimeline = false
    } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    // Build WHERE clause
    if (dateFrom) {
      whereConditions.push(`c."createdAt" >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`c."createdAt" <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`c.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (agentId) {
      whereConditions.push(`c."assignedTo" = $${paramIndex}`);
      queryParams.push(agentId);
      paramIndex++;
    }

    if (clientId) {
      whereConditions.push(`c."clientId" = $${paramIndex}`);
      queryParams.push(clientId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Enhanced case analytics query
    const casesQuery = `
      SELECT 
        cca.*,
        COUNT(*) OVER() as total_count,
        
        -- Timeline event counts
        (SELECT COUNT(*) FROM case_timeline_events cte WHERE cte.case_id = cca.id) as timeline_events_count,
        
        -- Latest timeline event
        (SELECT event_type FROM case_timeline_events cte 
         WHERE cte.case_id = cca.id 
         ORDER BY event_timestamp DESC LIMIT 1) as latest_event_type,
         
        (SELECT event_timestamp FROM case_timeline_events cte 
         WHERE cte.case_id = cca.id 
         ORDER BY event_timestamp DESC LIMIT 1) as latest_event_timestamp
         
      FROM case_completion_analytics cca
      ${whereClause}
      ORDER BY cca."createdAt" DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    // Enhanced summary with quality metrics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_cases,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_cases,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress_cases,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_cases,
        
        AVG(form_completion_percentage) as avg_form_completion,
        AVG(quality_score) as avg_quality_score,
        AVG(completion_days) as avg_completion_days,
        
        -- Status distribution
        jsonb_object_agg(
          status, 
          status_count
        ) as status_distribution,
        
        -- Quality distribution
        COUNT(CASE WHEN quality_score >= 90 THEN 1 END) as excellent_quality_cases,
        COUNT(CASE WHEN quality_score >= 80 AND quality_score < 90 THEN 1 END) as good_quality_cases,
        COUNT(CASE WHEN quality_score >= 70 AND quality_score < 80 THEN 1 END) as average_quality_cases,
        COUNT(CASE WHEN quality_score < 70 THEN 1 END) as poor_quality_cases,
        
        ROUND(
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) * 100.0 / 
          NULLIF(COUNT(*), 0), 2
        ) as completion_rate
        
      FROM (
        SELECT 
          status,
          form_completion_percentage,
          quality_score,
          completion_days,
          COUNT(*) as status_count
        FROM case_completion_analytics
        ${whereClause}
        GROUP BY status, form_completion_percentage, quality_score, completion_days
      ) subquery
    `;

    const [casesResult, summaryResult] = await Promise.all([
      pool.query(casesQuery, queryParams),
      pool.query(summaryQuery, queryParams.slice(0, -2))
    ]);

    let timelineData = null;
    if (includeTimeline === 'true' && casesResult.rows.length > 0) {
      const caseIds = casesResult.rows.map(row => row.id);
      const timelineQuery = `
        SELECT 
          case_id,
          event_type,
          event_category,
          event_description,
          event_timestamp,
          performed_by,
          u.name as performed_by_name
        FROM case_timeline_events cte
        LEFT JOIN users u ON cte.performed_by = u.id
        WHERE case_id = ANY($1)
        ORDER BY case_id, event_timestamp DESC
      `;
      
      const timelineResult = await pool.query(timelineQuery, [caseIds]);
      timelineData = timelineResult.rows;
    }

    res.json({
      success: true,
      data: {
        cases: casesResult.rows,
        summary: summaryResult.rows[0],
        timeline: timelineData,
        pagination: {
          total: casesResult.rows[0]?.total_count || 0,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      }
    });

  } catch (error) {
    logger.error('Error in getEnhancedCaseAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enhanced case analytics',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Form Validation Analytics
export const getFormValidationAnalytics = async (req: Request, res: Response) => {
  try {
    const {
      dateFrom,
      dateTo,
      formType,
      agentId
    } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (dateFrom) {
      whereConditions.push(`fs.submitted_at >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`fs.submitted_at <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }

    if (formType) {
      whereConditions.push(`fs.form_type = $${paramIndex}`);
      queryParams.push(formType);
      paramIndex++;
    }

    if (agentId) {
      whereConditions.push(`fs.submitted_by = $${paramIndex}`);
      queryParams.push(agentId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Validation analytics query
    const validationQuery = `
      SELECT 
        fs.form_type,
        fs.validation_status,
        COUNT(*) as form_count,
        AVG(fs.submission_score) as avg_submission_score,
        AVG(fqm.overall_quality_score) as avg_quality_score,
        AVG(fqm.completeness_score) as avg_completeness_score,
        AVG(fqm.accuracy_score) as avg_accuracy_score,
        
        -- Validation time analysis
        AVG(EXTRACT(EPOCH FROM (fs.validated_at - fs.submitted_at))/3600) as avg_validation_time_hours,
        
        -- Common validation errors
        (
          SELECT jsonb_agg(DISTINCT error_message)
          FROM form_validation_logs fvl
          WHERE fvl.form_submission_id = fs.id AND fvl.is_valid = false
        ) as common_errors
        
      FROM form_submissions fs
      LEFT JOIN form_quality_metrics fqm ON fs.id = fqm.form_submission_id
      ${whereClause}
      GROUP BY fs.form_type, fs.validation_status
      ORDER BY fs.form_type, fs.validation_status
    `;

    // Field-level validation analysis
    const fieldValidationQuery = `
      SELECT 
        fvl.field_name,
        COUNT(*) as total_validations,
        COUNT(CASE WHEN fvl.is_valid = false THEN 1 END) as failed_validations,
        ROUND(
          COUNT(CASE WHEN fvl.is_valid = false THEN 1 END) * 100.0 / 
          NULLIF(COUNT(*), 0), 2
        ) as failure_rate,
        array_agg(DISTINCT fvl.error_message) FILTER (WHERE fvl.error_message IS NOT NULL) as error_messages
      FROM form_validation_logs fvl
      JOIN form_submissions fs ON fvl.form_submission_id = fs.id
      ${whereClause}
      GROUP BY fvl.field_name
      ORDER BY failure_rate DESC
      LIMIT 20
    `;

    const [validationResult, fieldValidationResult] = await Promise.all([
      pool.query(validationQuery, queryParams),
      pool.query(fieldValidationQuery, queryParams)
    ]);

    res.json({
      success: true,
      data: {
        validationByType: validationResult.rows,
        fieldValidation: fieldValidationResult.rows
      }
    });

  } catch (error) {
    logger.error('Error in getFormValidationAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch form validation analytics',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};
