// Disabled no-return-await rule for CSV export service as it uses return await pattern
// Disabled require-await rule for CSV export service as some methods are async for consistency
import { query as dbQuery } from '../config/database';
import { logger } from '../utils/logger';
import { escapeFormula } from '../utils/formulaGuard';
import path from 'path';
import fs from 'fs/promises';

export interface CSVExportOptions {
  reportType: 'agent-performance' | 'case-analytics';
  dateFrom?: string;
  dateTo?: string;
  filters?: Record<string, unknown>;
  delimiter?: string;
  includeHeaders?: boolean;
  encoding?: 'utf8' | 'utf16le';
  /**
   * Active-scope context (project_scope_control_audit_2026_05_14.md P9).
   * When `effectiveClientIds.length > 0`, the case-analytics fetch
   * intersects `client_id = ANY(effectiveClientIds)` so the export
   * cannot leak rows outside the caller's scope. Admin users without
   * assignments leave this empty -> no intersection, current behaviour.
   */
  scopeCtx?: {
    effectiveClientIds?: readonly number[];
  };
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
      const csvContent = this.convertToCSV(data, options);

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
        recordCount: (data.recordCount as number) || 0,
      };
    } catch (error) {
      logger.error('Error generating CSV report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async fetchReportData(options: CSVExportOptions): Promise<Record<string, unknown>> {
    const { reportType, dateFrom, dateTo, filters, scopeCtx } = options;

    switch (reportType) {
      case 'agent-performance':
        return this.fetchAgentPerformanceData(dateFrom, dateTo, filters);
      case 'case-analytics':
        return this.fetchCaseAnalyticsData(dateFrom, dateTo, filters, scopeCtx);
      default:
        throw new Error(`Unsupported report type: ${String(reportType)}`);
    }
  }

  private async fetchAgentPerformanceData(
    dateFrom?: string,
    dateTo?: string,
    filters?: Record<string, unknown>
  ): Promise<{
    headers: string[];
    data: unknown[];
    recordCount: number;
    reportType: string;
  }> {
    const whereConditions = [];
    const queryParams = [];
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
      whereConditions.push(`u.department_id = $${paramIndex}`);
      queryParams.push(filters.departmentId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        u.id as agent_id,
        u.name as agent_name,
        u.employee_id as employee_id,
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
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN agent_performance_daily apd ON u.id = apd.agent_id
      ${whereClause}
      AND EXISTS (
        SELECT 1
        FROM user_roles urf
        JOIN role_permissions rpf ON rpf.role_id = urf.role_id AND rpf.allowed = true
        JOIN permissions pf ON pf.id = rpf.permission_id
        WHERE urf.user_id = u.id AND pf.code = 'visit.submit'
      )
      ORDER BY apd.date DESC, u.name
      LIMIT 5000
    `;

    const result = await dbQuery(query, queryParams);

    return {
      headers: [
        'Agent ID',
        'Agent Name',
        'Employee ID',
        'Email',
        'Performance Rating',
        'Department',
        'Date',
        'Cases Assigned',
        'Cases Completed',
        'Cases In Progress',
        'Forms Submitted',
        'Residence Forms',
        'Office Forms',
        'Business Forms',
        'Attachments Uploaded',
        'Avg Completion Time (hours)',
        'Quality Score',
        'Validation Success Rate (%)',
        'Total Distance (km)',
        'Active Hours',
        'Login Time',
        'Logout Time',
        'Completion Rate (%)',
      ],
      data: result.rows,
      recordCount: result.rows.length,
      reportType: 'agent-performance',
    };
  }

  private async fetchCaseAnalyticsData(
    dateFrom?: string,
    dateTo?: string,
    filters?: Record<string, unknown>,
    scopeCtx?: CSVExportOptions['scopeCtx']
  ): Promise<{
    headers: string[];
    data: unknown[];
    recordCount: number;
    reportType: string;
  }> {
    const whereConditions = [];
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    // P9 — active-scope intersection. When the caller has a narrowed
    // effective scope (a scoped-ops user, or any user with an active
    // X-Active-Client-Id header), the export MUST be restricted to
    // those clients regardless of what `filters.clientId` says.
    const effectiveClientIds = scopeCtx?.effectiveClientIds ?? [];
    if (effectiveClientIds.length > 0) {
      whereConditions.push(`client_id = ANY($${paramIndex}::int[])`);
      queryParams.push([...effectiveClientIds]);
      paramIndex++;
    }

    if (dateFrom) {
      whereConditions.push(`created_at >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`created_at <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }

    if (filters?.status) {
      whereConditions.push(`status = $${paramIndex}`);
      queryParams.push(filters.status);
      paramIndex++;
    }

    if (filters?.agentId) {
      whereConditions.push(`assigned_to = $${paramIndex}`);
      queryParams.push(filters.agentId);
      paramIndex++;
    }

    if (filters?.clientId) {
      whereConditions.push(`client_id = $${paramIndex}`);
      queryParams.push(filters.clientId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        id as case_id,
        case_id as case_number,
        customer_name as customer_name,
        status,
        priority,
        assigned_to as assigned_to_id,
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
        created_at as created_at,
        updated_at as updated_at
      FROM case_completion_analytics
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 5000
    `;

    const result = await dbQuery(query, queryParams);

    return {
      headers: [
        'Case ID',
        'Case Number',
        'Customer Name',
        'Status',
        'Priority',
        'Assigned To ID',
        'Agent Name',
        'Employee ID',
        'Client Name',
        'Form Completion (%)',
        'Quality Score',
        'Forms Submitted Count',
        'Total Forms Required',
        'Actual Forms Submitted',
        'Valid Forms',
        'Attachment Count',
        'Completion Days',
        'Created At',
        'Updated At',
      ],
      data: result.rows,
      recordCount: result.rows.length,
      reportType: 'case-analytics',
    };
  }

  private convertToCSV(data: Record<string, unknown>, options: CSVExportOptions): string {
    const { delimiter = ',', includeHeaders = true } = options;
    const { headers, data: rows } = data;

    let csvContent = '';

    // Add headers if requested
    if (includeHeaders && headers) {
      csvContent += `${(headers as string[])
        .map((header: string) => this.escapeCSVField(header, delimiter))
        .join(delimiter)}\n`;
    }

    // Add data rows
    (rows as Record<string, unknown>[]).forEach((row: Record<string, unknown>) => {
      const csvRow = (headers as string[])
        .map((header: string, index: number) => {
          const value = Object.values(row)[index];
          return this.escapeCSVField(this.formatValue(value), delimiter);
        })
        .join(delimiter);

      csvContent += `${csvRow}\n`;
    });

    return csvContent;
  }

  private escapeCSVField(field: string, delimiter: string): string {
    if (field === null || field === undefined) {
      return '';
    }

    const fieldStr = escapeFormula(field);

    // If field contains delimiter, newline, or quote, wrap in quotes and escape internal quotes
    if (
      fieldStr.includes(delimiter) ||
      fieldStr.includes('\n') ||
      fieldStr.includes('\r') ||
      fieldStr.includes('"')
    ) {
      return `"${fieldStr.replace(/"/g, '""')}"`;
    }

    return fieldStr;
  }

  private formatValue(value: unknown): string {
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

    return String(value as string | number | boolean | undefined);
  }

  private generateFileName(options: CSVExportOptions): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const reportType = options.reportType.replace(/-/g, '_');
    return `${reportType}_report_${timestamp}.csv`;
  }

  public async generateMultipleCSVReports(
    reportTypes: CSVExportOptions[]
  ): Promise<CSVExportResult[]> {
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
        error: 'No report types specified',
      };
    } catch (error) {
      logger.error('Error generating zipped CSV reports:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
