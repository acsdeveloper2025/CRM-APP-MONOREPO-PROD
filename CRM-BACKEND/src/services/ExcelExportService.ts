// Disabled no-return-await rule for Excel export service as it uses return await pattern
// Disabled require-await rule for Excel export service as some methods are async for consistency
import ExcelJS from 'exceljs';
import { query as dbQuery } from '../config/database';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';
import type {
  ReportData,
  FormSubmissionsReportData,
  AgentPerformanceReportData,
  CaseAnalyticsReportData,
  ValidationStatusReportData,
  FormSubmissionRow,
  AgentPerformanceRow,
  DailyPerformanceRow,
  CaseAnalyticsRow,
  ValidationStatusRow,
  FormTypeBreakdownRow,
} from '../types/reports';

export interface ExcelExportOptions {
  reportType: 'form-submissions' | 'agent-performance' | 'case-analytics' | 'validation-status';
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
      case 'form-submissions':
        return this.fetchFormSubmissionsData(dateFrom, dateTo, filters);
      case 'agent-performance':
        return this.fetchAgentPerformanceData(dateFrom, dateTo, filters);
      case 'case-analytics':
        return this.fetchCaseAnalyticsData(dateFrom, dateTo, filters);
      case 'validation-status':
        return this.fetchValidationStatusData(dateFrom, dateTo, filters);
      default:
        throw new Error(`Unsupported report type: ${String(reportType)}`);
    }
  }

  private async fetchFormSubmissionsData(
    dateFrom?: string,
    dateTo?: string,
    filters?: Record<string, unknown>
  ): Promise<FormSubmissionsReportData> {
    const whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;

    if (dateFrom) {
      whereConditions.push(`fs.submittedAt >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`fs.submittedAt <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }

    if (filters?.formType) {
      whereConditions.push(`fs.formType = $${paramIndex}`);
      queryParams.push(filters.formType as string);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Main submissions query
    const submissionsQuery = `
      SELECT 
        fs.id,
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
        fqm.photo_quality_score
      FROM form_submission_analytics fs
      LEFT JOIN form_quality_metrics fqm ON fs.id = fqm.form_submission_id
      ${whereClause}
      ORDER BY fs.submitted_at DESC
    `;

    // Summary query
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
        AVG(time_spent_minutes) as avg_time_spent
      FROM form_submission_analytics
      ${whereClause}
    `;

    // Form type breakdown
    const formTypeQuery = `
      SELECT 
        form_type,
        validation_status,
        COUNT(*) as count,
        AVG(submission_score) as avg_score
      FROM form_submission_analytics
      ${whereClause}
      GROUP BY form_type, validation_status
      ORDER BY form_type, validation_status
    `;

    const [submissionsResult, summaryResult, formTypeResult] = await Promise.all([
      dbQuery(submissionsQuery, queryParams),
      dbQuery(summaryQuery, queryParams),
      dbQuery(formTypeQuery, queryParams),
    ]);

    return {
      submissions: submissionsResult.rows,
      summary: summaryResult.rows[0],
      formTypeBreakdown: formTypeResult.rows,
      reportType: 'Form Submissions Report',
      generatedAt: new Date().toISOString(),
      dateRange: { from: dateFrom, to: dateTo },
    };
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
      whereConditions.push(`createdAt >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`createdAt <= $${paramIndex}`);
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

  private async fetchValidationStatusData(
    dateFrom?: string,
    dateTo?: string,
    _filters?: Record<string, unknown>
  ): Promise<ValidationStatusReportData> {
    const whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;

    if (dateFrom) {
      whereConditions.push(`fs.submittedAt >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`fs.submittedAt <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const validationQuery = `
      SELECT 
        fs.form_type,
        fs.validation_status,
        COUNT(*) as form_count,
        AVG(fs.submission_score) as avg_submission_score,
        AVG(fqm.overall_quality_score) as avg_quality_score,
        AVG(fqm.completeness_score) as avg_completeness,
        AVG(fqm.accuracy_score) as avg_accuracy
      FROM form_submissions fs
      LEFT JOIN form_quality_metrics fqm ON fs.id = fqm.form_submission_id
      ${whereClause}
      GROUP BY fs.form_type, fs.validation_status
      ORDER BY fs.form_type, fs.validation_status
    `;

    const result = await dbQuery(validationQuery, queryParams);

    return {
      validationData: result.rows,
      reportType: 'Form Validation Status Report',
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
      case 'form-submissions':
        this.createFormSubmissionsWorksheets(workbook, data as FormSubmissionsReportData, options);
        break;
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
      case 'validation-status':
        this.createValidationStatusWorksheets(
          workbook,
          data as ValidationStatusReportData,
          options
        );
        break;
    }
  }

  private createFormSubmissionsWorksheets(
    workbook: ExcelJS.Workbook,
    data: FormSubmissionsReportData,
    options: ExcelExportOptions
  ): void {
    // Summary worksheet
    if (options.includeSummary !== false) {
      const summarySheet = workbook.addWorksheet('Summary');
      this.createSummarySheet(summarySheet, data.summary, 'Form Submissions Summary');
    }

    // Main data worksheet
    const dataSheet = workbook.addWorksheet('Form Submissions');

    // Headers
    const headers = [
      'Form Type',
      'Validation Status',
      'Agent Name',
      'Employee ID',
      'Case Number',
      'Customer Name',
      'Submission Score',
      'Quality Score',
      'Photos Count',
      'Time Spent (min)',
      'Network Quality',
      'Submitted At',
    ];

    dataSheet.addRow(headers);
    this.styleHeaderRow(dataSheet, 1);

    // Data rows
    data.submissions.forEach((submission: FormSubmissionRow) => {
      dataSheet.addRow([
        submission.formType,
        submission.validationStatus,
        submission.agentName || 'N/A',
        submission.employeeId || 'N/A',
        submission.caseNumber,
        submission.customerName,
        submission.submissionScore || 'N/A',
        submission.overallQualityScore || 'N/A',
        submission.photosCount || 0,
        submission.timeSpentMinutes || 'N/A',
        submission.networkQuality || 'N/A',
        new Date(submission.submittedAt).toLocaleDateString(),
      ]);
    });

    this.autoFitColumns(dataSheet);

    // Form type breakdown worksheet
    if (data.formTypeBreakdown && data.formTypeBreakdown.length > 0) {
      const breakdownSheet = workbook.addWorksheet('Form Type Breakdown');

      const breakdownHeaders = ['Form Type', 'Validation Status', 'Count', 'Average Score'];
      breakdownSheet.addRow(breakdownHeaders);
      this.styleHeaderRow(breakdownSheet, 1);

      data.formTypeBreakdown.forEach((item: FormTypeBreakdownRow) => {
        breakdownSheet.addRow([
          item.formType,
          item.validationStatus,
          item.count,
          item.avgScore ? parseFloat(String(item.avgScore)).toFixed(2) : 'N/A',
        ]);
      });

      this.autoFitColumns(breakdownSheet);
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

      summarySheet.addRow([
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
      ]);
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
        dailySheet.addRow([
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
        ]);
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
      casesSheet.addRow([
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
      ]);
    });

    this.autoFitColumns(casesSheet);
  }

  private createValidationStatusWorksheets(
    workbook: ExcelJS.Workbook,
    data: ValidationStatusReportData,
    _options: ExcelExportOptions
  ): void {
    const validationSheet = workbook.addWorksheet('Validation Status');

    const headers = [
      'Form Type',
      'Validation Status',
      'Form Count',
      'Avg Submission Score',
      'Avg Quality Score',
      'Avg Completeness',
      'Avg Accuracy',
    ];

    validationSheet.addRow(headers);
    this.styleHeaderRow(validationSheet, 1);

    data.validationData.forEach((item: ValidationStatusRow) => {
      validationSheet.addRow([
        item.formType,
        item.validationStatus,
        item.formCount,
        item.avgSubmissionScore ? parseFloat(String(item.avgSubmissionScore)).toFixed(2) : 'N/A',
        item.avgQualityScore ? parseFloat(String(item.avgQualityScore)).toFixed(2) : 'N/A',
        item.avgCompleteness ? parseFloat(String(item.avgCompleteness)).toFixed(2) : 'N/A',
        item.avgAccuracy ? parseFloat(String(item.avgAccuracy)).toFixed(2) : 'N/A',
      ]);
    });

    this.autoFitColumns(validationSheet);
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

      worksheet.addRow([displayKey, displayValue]);
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
