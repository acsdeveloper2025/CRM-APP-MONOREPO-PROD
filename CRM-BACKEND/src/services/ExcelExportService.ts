// Disabled no-return-await rule for Excel export service as it uses return await pattern
// Disabled require-await rule for Excel export service as some methods are async for consistency
import ExcelJS from 'exceljs';
import { query as dbQuery } from '../config/database';
import { logger } from '../utils/logger';
import { escapeFormulaRow } from '../utils/formulaGuard';
import path from 'path';
import fs from 'fs/promises';
import type {
  ReportData,
  AgentPerformanceReportData,
  CaseAnalyticsReportData,
  AgentPerformanceRow,
  DailyPerformanceRow,
  CaseAnalyticsRow,
} from '../types/reports';

export interface ExcelExportOptions {
  reportType: 'agent-performance' | 'case-analytics';
  dateFrom?: string;
  dateTo?: string;
  filters?: Record<string, unknown>;
  includeCharts?: boolean;
  includeSummary?: boolean;
  sheetNames?: string[];
}

export interface ExcelExportResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
}

export class ExcelExportService {
  private static instance: ExcelExportService;

  private constructor() {}

  public static getInstance(): ExcelExportService {
    if (!ExcelExportService.instance) {
      ExcelExportService.instance = new ExcelExportService();
    }
    return ExcelExportService.instance;
  }

  public async generateExcelReport(options: ExcelExportOptions): Promise<ExcelExportResult> {
    try {
      // Create new workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'CRM Analytics System';
      workbook.lastModifiedBy = 'CRM Analytics System';
      workbook.created = new Date();
      workbook.modified = new Date();

      // Generate data based on report type
      const data = await this.fetchReportData(options);

      // Create worksheets based on report type
      this.createWorksheets(workbook, data, options);

      // Save Excel file
      const fileName = this.generateFileName(options);
      const filePath = path.join(process.cwd(), 'exports', fileName);

      // Ensure exports directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Write Excel file
      await workbook.xlsx.writeFile(filePath);

      const stats = await fs.stat(filePath);

      logger.info(`Excel report generated successfully: ${fileName}`);

      return {
        success: true,
        filePath,
        fileName,
        fileSize: stats.size,
      };
    } catch (error) {
      logger.error('Error generating Excel report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async fetchReportData(options: ExcelExportOptions): Promise<ReportData> {
    const { reportType, dateFrom, dateTo, filters } = options;

    switch (reportType) {
      case 'agent-performance':
        return this.fetchAgentPerformanceData(dateFrom, dateTo, filters);
      case 'case-analytics':
        return this.fetchCaseAnalyticsData(dateFrom, dateTo, filters);
      default:
        throw new Error(`Unsupported report type: ${String(reportType)}`);
    }
  }

  private async fetchAgentPerformanceData(
    dateFrom?: string,
    dateTo?: string,
    _filters?: Record<string, unknown>
  ): Promise<AgentPerformanceReportData> {
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

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Agent performance summary
    const performanceQuery = `
      SELECT 
        u.id,
        u.name,
        u.employee_id,
        u.email,
        u.performance_rating,
        d.name as department_name,
        COUNT(DISTINCT apd.date) as active_days,
        COALESCE(SUM(apd.cases_assigned), 0) as total_cases_assigned,
        COALESCE(SUM(apd.cases_completed), 0) as cases_completed,
        COALESCE(SUM(apd.forms_submitted), 0) as total_forms_submitted,
        COALESCE(SUM(apd.residence_forms), 0) as residence_forms,
        COALESCE(SUM(apd.office_forms), 0) as office_forms,
        COALESCE(SUM(apd.business_forms), 0) as business_forms,
        COALESCE(AVG(apd.quality_score), 0) as avg_quality_score,
        COALESCE(AVG(apd.validation_success_rate), 0) as avg_validation_rate,
        COALESCE(SUM(apd.total_distance_km), 0) as total_distance,
        COALESCE(AVG(apd.active_hours), 0) as avg_active_hours
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
      GROUP BY u.id, u.name, u.employee_id, u.email, u.performance_rating, d.name
      ORDER BY avg_quality_score DESC
    `;

    // Daily performance data
    const dailyQuery = `
      SELECT 
        apd.date,
        u.name as agent_name,
        u.employee_id,
        apd.cases_assigned,
        apd.cases_completed,
        apd.forms_submitted,
        apd.quality_score,
        apd.validation_success_rate,
        apd.active_hours,
        apd.total_distance_km
      FROM agent_performance_daily apd
      JOIN users u ON apd.agent_id = u.id
      ${whereClause}
      ORDER BY apd.date DESC, u.name
    `;

    const [performanceResult, dailyResult] = await Promise.all([
      dbQuery(performanceQuery, queryParams),
      dbQuery(dailyQuery, queryParams),
    ]);

    return {
      agents: performanceResult.rows,
      dailyPerformance: dailyResult.rows,
      reportType: 'Agent Performance Report',
      generatedAt: new Date().toISOString(),
      dateRange: { from: dateFrom, to: dateTo },
    };
  }

  private async fetchCaseAnalyticsData(
    dateFrom?: string,
    dateTo?: string,
    _filters?: Record<string, unknown>
  ): Promise<CaseAnalyticsReportData> {
    const whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;

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

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const casesQuery = `
      SELECT * FROM case_completion_analytics
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 5000
    `;

    const summaryQuery = `
      SELECT 
        COUNT(*) as total_cases,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_cases,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress_cases,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_cases,
        AVG(completion_days) as avg_completion_days,
        AVG(quality_score) as avg_quality_score,
        AVG(form_completion_percentage) as avg_form_completion
      FROM case_completion_analytics
      ${whereClause}
    `;

    const [casesResult, summaryResult] = await Promise.all([
      dbQuery(casesQuery, queryParams),
      dbQuery(summaryQuery, queryParams),
    ]);

    return {
      cases: casesResult.rows,
      summary: summaryResult.rows[0],
      reportType: 'Case Analytics Report',
      generatedAt: new Date().toISOString(),
      dateRange: { from: dateFrom, to: dateTo },
    };
  }

  private createWorksheets(
    workbook: ExcelJS.Workbook,
    data: ReportData,
    options: ExcelExportOptions
  ): void {
    switch (options.reportType) {
      case 'agent-performance':
        this.createAgentPerformanceWorksheets(
          workbook,
          data as AgentPerformanceReportData,
          options
        );
        break;
      case 'case-analytics':
        this.createCaseAnalyticsWorksheets(workbook, data as CaseAnalyticsReportData, options);
        break;
    }
  }

  private createAgentPerformanceWorksheets(
    workbook: ExcelJS.Workbook,
    data: AgentPerformanceReportData,
    _options: ExcelExportOptions
  ): void {
    // Agent summary worksheet
    const summarySheet = workbook.addWorksheet('Agent Performance Summary');

    const headers = [
      'Agent Name',
      'Employee ID',
      'Department',
      'Performance Rating',
      'Active Days',
      'Cases Assigned',
      'Cases Completed',
      'Completion Rate',
      'Forms Submitted',
      'Quality Score',
      'Validation Rate',
      'Total Distance (km)',
    ];

    summarySheet.addRow(headers);
    this.styleHeaderRow(summarySheet, 1);

    data.agents.forEach((agent: AgentPerformanceRow) => {
      const completionRate =
        agent.totalCasesAssigned > 0
          ? `${((agent.casesCompleted / agent.totalCasesAssigned) * 100).toFixed(1)}%`
          : 'N/A';

      summarySheet.addRow(
        escapeFormulaRow([
          agent.name,
          agent.employeeId || 'N/A',
          agent.departmentName || 'N/A',
          agent.performanceRating || 'N/A',
          agent.activeDays,
          agent.totalCasesAssigned,
          agent.casesCompleted,
          completionRate,
          agent.totalFormsSubmitted,
          agent.avgQualityScore ? parseFloat(String(agent.avgQualityScore)).toFixed(1) : 'N/A',
          agent.avgValidationRate
            ? `${parseFloat(String(agent.avgValidationRate)).toFixed(1)}%`
            : 'N/A',
          agent.totalDistance ? parseFloat(String(agent.totalDistance)).toFixed(1) : 'N/A',
        ])
      );
    });

    this.autoFitColumns(summarySheet);

    // Daily performance worksheet
    if (data.dailyPerformance && data.dailyPerformance.length > 0) {
      const dailySheet = workbook.addWorksheet('Daily Performance');

      const dailyHeaders = [
        'Date',
        'Agent Name',
        'Employee ID',
        'Cases Assigned',
        'Cases Completed',
        'Forms Submitted',
        'Quality Score',
        'Validation Rate',
        'Active Hours',
        'Distance (km)',
      ];

      dailySheet.addRow(dailyHeaders);
      this.styleHeaderRow(dailySheet, 1);

      data.dailyPerformance.forEach((daily: DailyPerformanceRow) => {
        dailySheet.addRow(
          escapeFormulaRow([
            new Date(daily.date).toLocaleDateString(),
            daily.agentName,
            daily.employeeId || 'N/A',
            daily.casesAssigned || 0,
            daily.casesCompleted || 0,
            daily.formsSubmitted || 0,
            daily.qualityScore ? parseFloat(String(daily.qualityScore)).toFixed(1) : 'N/A',
            daily.validationSuccessRate
              ? `${parseFloat(String(daily.validationSuccessRate)).toFixed(1)}%`
              : 'N/A',
            daily.activeHours ? parseFloat(String(daily.activeHours)).toFixed(1) : 'N/A',
            daily.totalDistanceKm ? parseFloat(String(daily.totalDistanceKm)).toFixed(1) : 'N/A',
          ])
        );
      });

      this.autoFitColumns(dailySheet);
    }
  }

  private createCaseAnalyticsWorksheets(
    workbook: ExcelJS.Workbook,
    data: CaseAnalyticsReportData,
    options: ExcelExportOptions
  ): void {
    // Summary worksheet
    if (options.includeSummary !== false) {
      const summarySheet = workbook.addWorksheet('Summary');
      this.createSummarySheet(summarySheet, data.summary, 'Case Analytics Summary');
    }

    // Cases worksheet
    const casesSheet = workbook.addWorksheet('Cases');

    const headers = [
      'Case ID',
      'Customer Name',
      'Agent Name',
      'Client',
      'Status',
      'Priority',
      'Completion Days',
      'Quality Score',
      'Form Completion %',
      'Forms Submitted',
      'Valid Forms',
      'Attachments',
      'Created At',
      'Updated At',
    ];

    casesSheet.addRow(headers);
    this.styleHeaderRow(casesSheet, 1);

    data.cases.forEach((caseItem: CaseAnalyticsRow) => {
      casesSheet.addRow(
        escapeFormulaRow([
          caseItem.caseId,
          caseItem.customerName,
          caseItem.agentName || 'Unassigned',
          caseItem.clientName || 'N/A',
          caseItem.status,
          caseItem.priority || 'N/A',
          caseItem.completionDays ? parseFloat(String(caseItem.completionDays)).toFixed(1) : 'N/A',
          caseItem.qualityScore || 'N/A',
          caseItem.formCompletionPercentage || 'N/A',
          caseItem.actualFormsSubmitted || 0,
          caseItem.validForms || 0,
          caseItem.attachmentCount || 0,
          new Date(caseItem.createdAt).toLocaleDateString(),
          new Date(caseItem.updatedAt).toLocaleDateString(),
        ])
      );
    });

    this.autoFitColumns(casesSheet);
  }

  private createSummarySheet(
    worksheet: ExcelJS.Worksheet,
    summary: Record<string, unknown>,
    title: string
  ): void {
    // Title
    worksheet.addRow([title]);
    worksheet.getRow(1).font = { bold: true, size: 16 };
    worksheet.addRow([]);

    // Summary data
    Object.entries(summary).forEach(([key, value]) => {
      const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      let displayValue = value;

      if (typeof value === 'number' && !Number.isInteger(value)) {
        displayValue = value.toFixed(2);
      }

      worksheet.addRow(escapeFormulaRow([displayKey, displayValue]));
    });

    this.autoFitColumns(worksheet);
  }

  private styleHeaderRow(worksheet: ExcelJS.Worksheet, rowNumber: number): void {
    const headerRow = worksheet.getRow(rowNumber);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '007bff' },
    };
    headerRow.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  }

  private autoFitColumns(worksheet: ExcelJS.Worksheet): void {
    worksheet.columns.forEach(column => {
      if (column.values) {
        const lengths = column.values.map(v =>
          v && (typeof v === 'string' || typeof v === 'number') ? v.toString().length : 0
        );
        const maxLength = Math.max(...lengths.filter(v => typeof v === 'number'));
        column.width = Math.min(Math.max(maxLength + 2, 10), 50);
      }
    });
  }

  private generateFileName(options: ExcelExportOptions): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const reportType = options.reportType.replace(/-/g, '_');
    return `${reportType}_report_${timestamp}.xlsx`;
  }
}
