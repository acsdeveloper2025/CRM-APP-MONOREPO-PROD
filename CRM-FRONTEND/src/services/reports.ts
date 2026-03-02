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
  ReportFilters
} from '@/types/reports';
import type { ApiResponse, PaginationQuery } from '@/types/api';
import type { MISFilters, MISDataResponse, ExportFormat } from '@/types/mis';
import type { ScheduledReport, ScheduledReportData } from '@/types/dto/report.dto';

export interface ReportQuery extends PaginationQuery {
  reportType?: string;
  dateFrom?: string;
  dateTo?: string;
  generatedBy?: string;
}

export class ReportsService {
  // MIS Reports Management
  async getMISReports(query: ReportQuery = {}): Promise<ApiResponse<MISReport[]>> {
    return apiService.get('/mis-reports', query);
  }

  async getMISReportById(id: string): Promise<ApiResponse<MISReport>> {
    return apiService.get(`/mis-reports/${id}`);
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
  async getTurnaroundTimeReport(filters: ReportFilters = {}): Promise<ApiResponse<TurnaroundTimeReport>> {
    return apiService.get('/reports/turnaround-time', filters);
  }

  async getCompletionRateReport(filters: ReportFilters = {}): Promise<ApiResponse<CompletionRateReport>> {
    return apiService.get('/reports/completion-rate', filters);
  }

  async getProductivityReport(filters: ReportFilters = {}): Promise<ApiResponse<ProductivityReport>> {
    return apiService.get('/reports/productivity', filters);
  }

  async getQualityReport(filters: ReportFilters = {}): Promise<ApiResponse<QualityReport>> {
    return apiService.get('/reports/quality', filters);
  }

  async getFinancialReport(filters: ReportFilters = {}): Promise<ApiResponse<FinancialReport>> {
    return apiService.get('/reports/financial', filters);
  }

  // Report Summaries
  async getReportSummaries(): Promise<ApiResponse<ReportSummary[]>> {
    return apiService.get('/reports/summaries');
  }

  async getReportSummary(reportType: string): Promise<ApiResponse<ReportSummary>> {
    return apiService.get(`/reports/summaries/${reportType}`);
  }

  // Bulk Operations
  async bulkGenerateReports(reportTypes: string[], filters: ReportFilters): Promise<ApiResponse<MISReport[]>> {
    return apiService.post('/mis-reports/bulk-generate', { reportTypes, filters });
  }

  async bulkDownloadReports(reportIds: string[], format: 'PDF' | 'EXCEL' | 'CSV' = 'PDF'): Promise<Blob> {
    const response = await apiService.postRaw<Blob>(`/mis-reports/bulk-download?format=${format}`, { reportIds }, {
        responseType: 'blob'
    });
    return response.data;
  }

  // Dashboard Data for Reports
  async getReportsDashboardData(filters: ReportFilters = {}): Promise<ApiResponse<unknown>> {
    return apiService.get('/reports/dashboard', filters);
  }

  async exportMISReports(query: ReportQuery = {}, format: 'PDF' | 'EXCEL' | 'CSV' = 'EXCEL'): Promise<Blob> {
    const response = await apiService.postRaw<Blob>(`/mis-reports/export?format=${format}`, query, {
        responseType: 'blob'
    });
    return response.data;
  }

  // Scheduled Reports
  async getScheduledReports(): Promise<ApiResponse<ScheduledReport[]>> {
    return apiService.get('/reports/scheduled');
  }

  async createScheduledReport(data: ScheduledReportData): Promise<ApiResponse<ScheduledReport>> {
    return apiService.post('/reports/scheduled', data);
  }

  async updateScheduledReport(id: string, data: ScheduledReportData): Promise<ApiResponse<ScheduledReport>> {
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

    if (filters.dateFrom) {params.append('dateFrom', filters.dateFrom);}
    if (filters.dateTo) {params.append('dateTo', filters.dateTo);}
    if (filters.clientId) {params.append('clientId', filters.clientId.toString());}
    if (filters.productId) {params.append('productId', filters.productId.toString());}
    if (filters.verificationTypeId) {params.append('verificationTypeId', filters.verificationTypeId.toString());}
    if (filters.caseStatus) {params.append('caseStatus', filters.caseStatus);}
    if (filters.fieldAgentId) {params.append('fieldAgentId', filters.fieldAgentId);}
    if (filters.backendUserId) {params.append('backendUserId', filters.backendUserId);}
    if (filters.priority) {params.append('priority', filters.priority);}
    if (filters.page) {params.append('page', filters.page.toString());}
    if (filters.limit) {params.append('limit', filters.limit.toString());}

    const response = await apiService.get<MISDataResponse>(
      `/reports/mis-dashboard-data?${params.toString()}`
    );

    // apiService.get already returns response.data, so we return it directly
    return response as unknown as MISDataResponse;
  }

  /**
   * Export MIS Dashboard data to Excel or CSV
   */
  async exportMISDashboardData(filters: MISFilters = {}, format: ExportFormat = 'EXCEL'): Promise<Blob> {
    const params: Record<string, string> = {};

    if (filters.dateFrom) {params.dateFrom = filters.dateFrom;}
    if (filters.dateTo) {params.dateTo = filters.dateTo;}
    if (filters.clientId) {params.clientId = filters.clientId.toString();}
    if (filters.productId) {params.productId = filters.productId.toString();}
    if (filters.verificationTypeId) {params.verificationTypeId = filters.verificationTypeId.toString();}
    if (filters.caseStatus) {params.caseStatus = filters.caseStatus;}
    if (filters.fieldAgentId) {params.fieldAgentId = filters.fieldAgentId;}
    if (filters.backendUserId) {params.backendUserId = filters.backendUserId;}
    if (filters.priority) {params.priority = filters.priority;}
    params.format = format;

    return apiService.getBlob('/reports/mis-dashboard-data/export', params);
  }
}

export const reportsService = new ReportsService();
