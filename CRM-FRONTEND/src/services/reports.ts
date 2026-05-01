import { apiService } from './api';
import type {
  MISReport,
  TurnaroundTimeReport,
  CompletionRateReport,
  ProductivityReport,
  QualityReport,
  FinancialReport,
  ReportSummary,
  GenerateReportData,
  ReportFilters,
} from '@/types/reports';
import type { ApiResponse, PaginationQuery } from '@/types/api';
import type { MISFilters, MISDataResponse, ExportFormat } from '@/types/mis';
import type { ScheduledReport, ScheduledReportData } from '@/types/dto/report.dto';
import { validateResponse } from './schemas/runtime';
import { ReportMetaSchema, ReportListSchema } from './schemas/notification.schema';
import { GenericEntityListSchema, GenericObjectSchema } from './schemas/generic.schema';

export interface ReportQuery extends PaginationQuery {
  reportType?: string;
  dateFrom?: string;
  dateTo?: string;
  generatedBy?: string;
}

export class ReportsService {
  // MIS Reports Management
  async getMISReports(query: ReportQuery = {}): Promise<ApiResponse<MISReport[]>> {
    const response = await apiService.get<MISReport[]>('/mis-reports', query);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(ReportListSchema, response.data, {
        service: 'reports',
        endpoint: 'GET /mis-reports',
      });
    }
    return response;
  }

  async getMISReportById(id: string): Promise<ApiResponse<MISReport>> {
    const response = await apiService.get<MISReport>(`/mis-reports/${id}`);
    if (response?.success && response.data) {
      validateResponse(ReportMetaSchema, response.data, {
        service: 'reports',
        endpoint: 'GET /mis-reports/:id',
      });
    }
    return response;
  }

  async generateMISReport(data: GenerateReportData): Promise<ApiResponse<MISReport>> {
    return apiService.post('/mis-reports/generate', data);
  }

  async deleteMISReport(id: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/mis-reports/${id}`);
  }

  async downloadMISReport(id: string, format: 'PDF' | 'EXCEL' | 'CSV' = 'PDF'): Promise<Blob> {
    return apiService.getBlob(`/mis-reports/${id}/download`, { format });
  }

  // Specific Report Types
  async getTurnaroundTimeReport(
    filters: ReportFilters = {}
  ): Promise<ApiResponse<TurnaroundTimeReport>> {
    const response = await apiService.get<TurnaroundTimeReport>(
      '/reports/turnaround-time',
      filters
    );
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'reports',
        endpoint: 'GET /reports/turnaround-time',
      });
    }
    return response;
  }

  async getCompletionRateReport(
    filters: ReportFilters = {}
  ): Promise<ApiResponse<CompletionRateReport>> {
    const response = await apiService.get<CompletionRateReport>(
      '/reports/completion-rate',
      filters
    );
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'reports',
        endpoint: 'GET /reports/completion-rate',
      });
    }
    return response;
  }

  async getProductivityReport(
    filters: ReportFilters = {}
  ): Promise<ApiResponse<ProductivityReport>> {
    const response = await apiService.get<ProductivityReport>('/reports/productivity', filters);
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'reports',
        endpoint: 'GET /reports/productivity',
      });
    }
    return response;
  }

  async getQualityReport(filters: ReportFilters = {}): Promise<ApiResponse<QualityReport>> {
    const response = await apiService.get<QualityReport>('/reports/quality', filters);
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'reports',
        endpoint: 'GET /reports/quality',
      });
    }
    return response;
  }

  async getFinancialReport(filters: ReportFilters = {}): Promise<ApiResponse<FinancialReport>> {
    const response = await apiService.get<FinancialReport>('/reports/financial', filters);
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'reports',
        endpoint: 'GET /reports/financial',
      });
    }
    return response;
  }

  // Report Summaries
  async getReportSummaries(): Promise<ApiResponse<ReportSummary[]>> {
    const response = await apiService.get<ReportSummary[]>('/reports/summaries');
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'reports',
        endpoint: 'GET /reports/summaries',
      });
    }
    return response;
  }

  async getReportSummary(reportType: string): Promise<ApiResponse<ReportSummary>> {
    const response = await apiService.get<ReportSummary>(`/reports/summaries/${reportType}`);
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'reports',
        endpoint: 'GET /reports/summaries/:type',
      });
    }
    return response;
  }

  // Bulk Operations
  async bulkGenerateReports(
    reportTypes: string[],
    filters: ReportFilters
  ): Promise<ApiResponse<MISReport[]>> {
    return apiService.post('/mis-reports/bulk-generate', { reportTypes, filters });
  }

  async bulkDownloadReports(
    reportIds: string[],
    format: 'PDF' | 'EXCEL' | 'CSV' = 'PDF'
  ): Promise<Blob> {
    const response = await apiService.postRaw<Blob>(
      `/mis-reports/bulk-download?format=${format}`,
      { reportIds },
      {
        responseType: 'blob',
      }
    );
    return response.data;
  }

  // Dashboard Data for Reports
  async getReportsDashboardData(filters: ReportFilters = {}): Promise<ApiResponse<unknown>> {
    const response = await apiService.get<unknown>('/reports/dashboard', filters);
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'reports',
        endpoint: 'GET /reports/dashboard',
      });
    }
    return response;
  }

  // Re-routes to the canonical MIS export endpoint. The previous
  // POST /mis-reports/export had no backend wiring (404).
  async exportMISReports(
    _query: ReportQuery = {},
    format: 'PDF' | 'EXCEL' | 'CSV' = 'EXCEL'
  ): Promise<Blob> {
    const exportFormat = format === 'PDF' ? 'EXCEL' : format;
    return this.exportMISDashboardData({}, exportFormat as ExportFormat);
  }

  // Scheduled Reports
  async getScheduledReports(): Promise<ApiResponse<ScheduledReport[]>> {
    const response = await apiService.get<ScheduledReport[]>('/reports/scheduled');
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'reports',
        endpoint: 'GET /reports/scheduled',
      });
    }
    return response;
  }

  async createScheduledReport(data: ScheduledReportData): Promise<ApiResponse<ScheduledReport>> {
    return apiService.post('/reports/scheduled', data);
  }

  async updateScheduledReport(
    id: string,
    data: ScheduledReportData
  ): Promise<ApiResponse<ScheduledReport>> {
    return apiService.put(`/reports/scheduled/${id}`, data);
  }

  async deleteScheduledReport(id: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/reports/scheduled/${id}`);
  }

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
