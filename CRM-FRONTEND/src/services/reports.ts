import { apiService } from './api';
import type { ApiResponse, PaginationQuery } from '@/types/api';
import type { MISFilters, MISDataResponse, ExportFormat } from '@/types/mis';
// P19/C-6: stripped unused imports — ReportMetaSchema, ReportListSchema,
// GenericEntityListSchema, GenericObjectSchema, the MISReport /
// TurnaroundTimeReport / CompletionRateReport / ProductivityReport /
// QualityReport / FinancialReport / GenerateReportData / ReportFilters
// types from @/types/reports, ScheduledReport / ScheduledReportData
// from @/types/dto/report.dto, validateResponse from ./schemas/runtime.
// All were used only by the dead methods removed below.

export interface ReportQuery extends PaginationQuery {
  reportType?: string;
  dateFrom?: string;
  dateTo?: string;
  generatedBy?: string;
}

export class ReportsService {
  // P19/C-6: removed dead methods that POSTed/GETd routes the backend
  // never registered (silent 404s):
  //   getMISReports, getMISReportById, generateMISReport,
  //   deleteMISReport, downloadMISReport, exportMISReports,
  //   bulkGenerateReports, bulkDownloadReports
  //   getTurnaroundTimeReport, getCompletionRateReport,
  //   getProductivityReport, getQualityReport, getFinancialReport
  //   getScheduledReports, createScheduledReport, updateScheduledReport,
  //   deleteScheduledReport
  // The associated UI consumers (ReportsPage tabs, MISReportsTable,
  // GenerateReportDialog, TurnaroundTimeChart, CompletionRateChart)
  // were removed in the same commit. See audit
  // project_full_app_audit_2026_05_14.md C-6.

  // ===== MIS DASHBOARD APIs =====

  /**
   * Get MIS Dashboard data with filters and pagination
   */
  async getMISDashboardData(filters: MISFilters = {}): Promise<MISDataResponse> {
    const params = new URLSearchParams();

    if (filters.dateFrom) {
      params.append('dateFrom', filters.dateFrom);
    }
    if (filters.dateTo) {
      params.append('dateTo', filters.dateTo);
    }
    if (filters.clientId) {
      params.append('clientId', filters.clientId.toString());
    }
    if (filters.productId) {
      params.append('productId', filters.productId.toString());
    }
    if (filters.verificationTypeId) {
      params.append('verificationTypeId', filters.verificationTypeId.toString());
    }
    if (filters.caseStatus) {
      params.append('caseStatus', filters.caseStatus);
    }
    if (filters.fieldAgentId) {
      params.append('fieldAgentId', filters.fieldAgentId);
    }
    if (filters.backendUserId) {
      params.append('backendUserId', filters.backendUserId);
    }
    if (filters.priority) {
      params.append('priority', filters.priority);
    }
    if (filters.page) {
      params.append('page', filters.page.toString());
    }
    if (filters.limit) {
      params.append('limit', filters.limit.toString());
    }

    const response = await apiService.get<MISDataResponse>(
      `/reports/mis-dashboard-data?${params.toString()}`
    );

    if (response && typeof response === 'object') {
      validateResponse(GenericObjectSchema, response, {
        service: 'reports',
        endpoint: 'GET /reports/mis-dashboard-data',
      });
    }

    // apiService.get already returns response.data, so we return it directly
    return response as unknown as MISDataResponse;
  }

  /**
   * Export MIS Dashboard data to Excel or CSV
   */
  async exportMISDashboardData(
    filters: MISFilters = {},
    format: ExportFormat = 'EXCEL'
  ): Promise<Blob> {
    const params: Record<string, string> = {};

    if (filters.dateFrom) {
      params.dateFrom = filters.dateFrom;
    }
    if (filters.dateTo) {
      params.dateTo = filters.dateTo;
    }
    if (filters.clientId) {
      params.clientId = filters.clientId.toString();
    }
    if (filters.productId) {
      params.productId = filters.productId.toString();
    }
    if (filters.verificationTypeId) {
      params.verificationTypeId = filters.verificationTypeId.toString();
    }
    if (filters.caseStatus) {
      params.caseStatus = filters.caseStatus;
    }
    if (filters.fieldAgentId) {
      params.fieldAgentId = filters.fieldAgentId;
    }
    if (filters.backendUserId) {
      params.backendUserId = filters.backendUserId;
    }
    if (filters.priority) {
      params.priority = filters.priority;
    }
    params.format = format;

    return apiService.getBlob('/reports/mis-dashboard-data/export', params);
  }
}

export const reportsService = new ReportsService();
