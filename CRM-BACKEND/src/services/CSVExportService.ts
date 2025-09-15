import { pool } from '../config/database';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

export interface CSVExportOptions {
  reportType: 'form-submissions' | 'agent-performance' | 'case-analytics' | 'validation-status';
  dateFrom?: string;
  dateTo?: string;
  filters?: Record<string, any>;
  delimiter?: string;
  includeHeaders?: boolean;
  encoding?: 'utf8' | 'utf16le';
}

export interface CSVExportResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  recordCount?: number;
  error?: string;
}

export class CSVExportService {
  private static instance: CSVExportService;

  private constructor() {}

  public static getInstance(): CSVExportService {
    if (!CSVExportService.instance) {
      CSVExportService.instance = new CSVExportService();
    }
    return CSVExportService.instance;
  }

  public async generateCSVReport(options: CSVExportOptions): Promise<CSVExportResult> {
    try {
      // Generate data based on report type
      const data = await this.fetchReportData(options);

      // Convert data to CSV format
      const csvContent = await this.convertToCSV(data, options);

      // Save CSV file
      const fileName = this.generateFileName(options);
      const filePath = path.join(process.cwd(), 'exports', fileName);

      // Ensure exports directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Write CSV file
      await fs.writeFile(filePath, csvContent, { encoding: options.encoding || 'utf8' });

      const stats = await fs.stat(filePath);

      logger.info(`CSV report generated successfully: ${fileName}`);

      return {
        success: true,
        filePath,
        fileName,
        fileSize: stats.size,
        recordCount: data.recordCount || 0
      };

    } catch (error) {
      logger.error('Error generating CSV report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async fetchReportData(options: CSVExportOptions): Promise<any> {
    const { reportType, dateFrom, dateTo, filters } = options;

    switch (reportType) {
      case 'form-submissions':
        return await this.fetchFormSubmissionsData(dateFrom, dateTo, filters);
      case 'agent-performance':
        return await this.fetchAgentPerformanceData(dateFrom, dateTo, filters);
      case 'case-analytics':
        return await this.fetchCaseAnalyticsData(dateFrom, dateTo, filters);
      case 'validation-status':
        return await this.fetchValidationStatusData(dateFrom, dateTo, filters);
      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }
  }

  private async fetchFormSubmissionsData(dateFrom?: string, dateTo?: string, filters?: any): Promise<any> {
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

    if (filters?.formType) {
      whereConditions.push(`fs.form_type = $${paramIndex}`);
      queryParams.push(filters.formType);
      paramIndex++;
    }

    if (filters?.validationStatus) {
      whereConditions.push(`fs.validation_status = $${paramIndex}`);
      queryParams.push(filters.validationStatus);
      paramIndex++;
    }

    if (filters?.agentId) {
      whereConditions.push(`fs.submitted_by = $${paramIndex}`);
      queryParams.push(filters.agentId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        fs.id as submission_id,
        fs.form_type,
        fs.validation_status,
        fs.submitted_at,
        fs.validated_at,
        fs.photos_count,
        fs.attachments_count,
        fs.submission_score,
        fs.time_spent_minutes,
        fs.network_quality,
        fs.agent_name,
        fs.employee_id,
        fs.case_number,
        fs.customer_name,
        fs.case_status,
        fqm.overall_quality_score,
        fqm.completeness_score,
        fqm.accuracy_score,
        fqm.photo_quality_score,
        fqm.timeliness_score,
        EXTRACT(EPOCH FROM (fs.validated_at - fs.submitted_at))/3600 as validation_time_hours
      FROM form_submission_analytics fs
      LEFT JOIN form_quality_metrics fqm ON fs.id = fqm.form_submission_id
      ${whereClause}
      ORDER BY fs.submitted_at DESC
    `;

    const result = await pool.query(query, queryParams);

    return {
      headers: [
        'Submission ID', 'Form Type', 'Validation Status', 'Submitted At', 'Validated At',
        'Photos Count', 'Attachments Count', 'Submission Score', 'Time Spent (min)', 'Network Quality',
        'Agent Name', 'Employee ID', 'Case Number', 'Customer Name', 'Case Status',
        'Overall Quality Score', 'Completeness Score', 'Accuracy Score', 'Photo Quality Score',
        'Timeliness Score', 'Validation Time (hours)'
      ],
      data: result.rows,
      recordCount: result.rows.length,
      reportType: 'form-submissions'
    };
  }

  private async fetchAgentPerformanceData(dateFrom?: string, dateTo?: string, filters?: any): Promise<any> {
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

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

    if (filters?.agentId) {
      whereConditions.push(`u.id = $${paramIndex}`);
      queryParams.push(filters.agentId);
      paramIndex++;
    }

    if (filters?.departmentId) {
      whereConditions.push(`u."departmentId" = $${paramIndex}`);
      queryParams.push(filters.departmentId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        u.id as agent_id,
        u.name as agent_name,
        u."employeeId" as employee_id,
        u.email,
        u.performance_rating,
        d.name as department_name,
        apd.date,
        apd.cases_assigned,
        apd.cases_completed,
        apd.cases_in_progress,
        apd.forms_submitted,
        apd.residence_forms,
        apd.office_forms,
        apd.business_forms,
        apd.attachments_uploaded,
        apd.avg_completion_time_hours,
        apd.quality_score,
        apd.validation_success_rate,
        apd.total_distance_km,
        apd.active_hours,
        apd.login_time,
        apd.logout_time,
        CASE 
          WHEN apd.cases_assigned > 0 
          THEN ROUND((apd.cases_completed * 100.0 / apd.cases_assigned), 2)
          ELSE 0 
        END as completion_rate_percentage
      FROM users u
      LEFT JOIN departments d ON u."departmentId" = d.id
      LEFT JOIN agent_performance_daily apd ON u.id = apd.agent_id
      ${whereClause}
      AND u.role = 'FIELD_AGENT'
      ORDER BY apd.date DESC, u.name
    `;

    const result = await pool.query(query, queryParams);

    return {
      headers: [
        'Agent ID', 'Agent Name', 'Employee ID', 'Email', 'Performance Rating', 'Department',
        'Date', 'Cases Assigned', 'Cases Completed', 'Cases In Progress', 'Forms Submitted',
        'Residence Forms', 'Office Forms', 'Business Forms', 'Attachments Uploaded',
        'Avg Completion Time (hours)', 'Quality Score', 'Validation Success Rate (%)',
        'Total Distance (km)', 'Active Hours', 'Login Time', 'Logout Time', 'Completion Rate (%)'
      ],
      data: result.rows,
      recordCount: result.rows.length,
      reportType: 'agent-performance'
    };
  }

  private async fetchCaseAnalyticsData(dateFrom?: string, dateTo?: string, filters?: any): Promise<any> {
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (dateFrom) {
      whereConditions.push(`"createdAt" >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`"createdAt" <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }

    if (filters?.status) {
      whereConditions.push(`status = $${paramIndex}`);
      queryParams.push(filters.status);
      paramIndex++;
    }

    if (filters?.agentId) {
      whereConditions.push(`"assignedTo" = $${paramIndex}`);
      queryParams.push(filters.agentId);
      paramIndex++;
    }

    if (filters?.clientId) {
      whereConditions.push(`"clientId" = $${paramIndex}`);
      queryParams.push(filters.clientId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        id as case_id,
        "caseId" as case_number,
        "customerName" as customer_name,
        status,
        priority,
        "assignedTo" as assigned_to_id,
        agent_name,
        employee_id,
        client_name,
        form_completion_percentage,
        quality_score,
        forms_submitted_count,
        total_forms_required,
        actual_forms_submitted,
        valid_forms,
        attachment_count,
        completion_days,
        "createdAt" as created_at,
        "updatedAt" as updated_at
      FROM case_completion_analytics
      ${whereClause}
      ORDER BY "createdAt" DESC
    `;

    const result = await pool.query(query, queryParams);

    return {
      headers: [
        'Case ID', 'Case Number', 'Customer Name', 'Status', 'Priority', 'Assigned To ID',
        'Agent Name', 'Employee ID', 'Client Name', 'Form Completion (%)', 'Quality Score',
        'Forms Submitted Count', 'Total Forms Required', 'Actual Forms Submitted', 'Valid Forms',
        'Attachment Count', 'Completion Days', 'Created At', 'Updated At'
      ],
      data: result.rows,
      recordCount: result.rows.length,
      reportType: 'case-analytics'
    };
  }

  private async fetchValidationStatusData(dateFrom?: string, dateTo?: string, filters?: any): Promise<any> {
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

    if (filters?.formType) {
      whereConditions.push(`fs.form_type = $${paramIndex}`);
      queryParams.push(filters.formType);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        fs.form_type,
        fs.validation_status,
        COUNT(*) as form_count,
        AVG(fs.submission_score) as avg_submission_score,
        AVG(fqm.overall_quality_score) as avg_quality_score,
        AVG(fqm.completeness_score) as avg_completeness_score,
        AVG(fqm.accuracy_score) as avg_accuracy_score,
        AVG(fqm.photo_quality_score) as avg_photo_quality_score,
        AVG(fqm.timeliness_score) as avg_timeliness_score,
        AVG(EXTRACT(EPOCH FROM (fs.validated_at - fs.submitted_at))/3600) as avg_validation_time_hours,
        MIN(fs.submitted_at) as earliest_submission,
        MAX(fs.submitted_at) as latest_submission
      FROM form_submissions fs
      LEFT JOIN form_quality_metrics fqm ON fs.id = fqm.form_submission_id
      ${whereClause}
      GROUP BY fs.form_type, fs.validation_status
      ORDER BY fs.form_type, fs.validation_status
    `;

    const result = await pool.query(query, queryParams);

    return {
      headers: [
        'Form Type', 'Validation Status', 'Form Count', 'Avg Submission Score',
        'Avg Quality Score', 'Avg Completeness Score', 'Avg Accuracy Score',
        'Avg Photo Quality Score', 'Avg Timeliness Score', 'Avg Validation Time (hours)',
        'Earliest Submission', 'Latest Submission'
      ],
      data: result.rows,
      recordCount: result.rows.length,
      reportType: 'validation-status'
    };
  }

  private async convertToCSV(data: any, options: CSVExportOptions): Promise<string> {
    const { delimiter = ',', includeHeaders = true } = options;
    const { headers, data: rows } = data;

    let csvContent = '';

    // Add headers if requested
    if (includeHeaders && headers) {
      csvContent += headers.map((header: string) => this.escapeCSVField(header, delimiter)).join(delimiter) + '\n';
    }

    // Add data rows
    rows.forEach((row: any) => {
      const csvRow = headers.map((header: string, index: number) => {
        const value = Object.values(row)[index];
        return this.escapeCSVField(this.formatValue(value), delimiter);
      }).join(delimiter);
      
      csvContent += csvRow + '\n';
    });

    return csvContent;
  }

  private escapeCSVField(field: string, delimiter: string): string {
    if (field === null || field === undefined) {
      return '';
    }

    const fieldStr = String(field);
    
    // If field contains delimiter, newline, or quote, wrap in quotes and escape internal quotes
    if (fieldStr.includes(delimiter) || fieldStr.includes('\n') || fieldStr.includes('\r') || fieldStr.includes('"')) {
      return '"' + fieldStr.replace(/"/g, '""') + '"';
    }
    
    return fieldStr;
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'number') {
      // Format numbers with appropriate precision
      if (Number.isInteger(value)) {
        return value.toString();
      } else {
        return value.toFixed(2);
      }
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  private generateFileName(options: CSVExportOptions): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const reportType = options.reportType.replace(/-/g, '_');
    return `${reportType}_report_${timestamp}.csv`;
  }

  public async generateMultipleCSVReports(reportTypes: CSVExportOptions[]): Promise<CSVExportResult[]> {
    const results: CSVExportResult[] = [];

    for (const options of reportTypes) {
      const result = await this.generateCSVReport(options);
      results.push(result);
    }

    return results;
  }

  public async generateZippedCSVReports(reportTypes: CSVExportOptions[]): Promise<CSVExportResult> {
    try {
      // This would require additional zip library
      // For now, return the first report
      if (reportTypes.length > 0) {
        return await this.generateCSVReport(reportTypes[0]);
      }

      return {
        success: false,
        error: 'No report types specified'
      };

    } catch (error) {
      logger.error('Error generating zipped CSV reports:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
