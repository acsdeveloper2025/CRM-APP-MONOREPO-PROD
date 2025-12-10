import { apiService } from './api';
import type {
  BankBill,
  MISReport,
  TurnaroundTimeReport,
  CompletionRateReport,
  ProductivityReport,
  QualityReport,
  FinancialReport,
  ReportSummary,
  CreateBankBillData,
  UpdateBankBillData,
  GenerateReportData,
  ReportFilters
} from '@/types/reports';
import type { ApiResponse, PaginationQuery } from '@/types/api';
import type { MISFilters, MISDataResponse, ExportFormat } from '@/types/mis';
import type { ScheduledReport, ScheduledReportData } from '@/types/dto/report.dto';

// Smart API URL selection
const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
    const staticIP = import.meta.env.VITE_STATIC_IP || '103.14.234.36';
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isLocalNetwork = hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.');
  const isStaticIP = hostname === staticIP;
  const isDomain = hostname === 'crm.allcheckservices.com' || hostname === 'www.crm.allcheckservices.com';

  // Priority order for API URL selection:
  // 1. Check if we're on localhost (development)
  if (isLocalhost) {
    return 'http://localhost:3000/api';
  }

  // 2. Check if we're on the local network IP (hairpin NAT workaround)
  if (isLocalNetwork) {
    return `http://${staticIP}:3000/api`;
  }

  // 3. Check if we're on the domain name (production access)
  if (isDomain) {
    return 'https://crm.allcheckservices.com/api';
  }

  // 4. Check if we're on the static IP (external access)
  if (isStaticIP) {
    return `http://${staticIP}:3000/api`;
  }

  // 5. Fallback to environment variable or localhost
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
};

export interface BankBillQuery extends PaginationQuery {
  clientId?: string;
  status?: string;
  bankName?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ReportQuery extends PaginationQuery {
  reportType?: string;
  dateFrom?: string;
  dateTo?: string;
  generatedBy?: string;
}

export class ReportsService {
  // Bank Bills Management
  async getBankBills(query: BankBillQuery = {}): Promise<ApiResponse<BankBill[]>> {
    return apiService.get('/bank-bills', query);
  }

  async getBankBillById(id: string): Promise<ApiResponse<BankBill>> {
    return apiService.get(`/bank-bills/${id}`);
  }

  async createBankBill(data: CreateBankBillData): Promise<ApiResponse<BankBill>> {
    return apiService.post('/bank-bills', data);
  }

  async updateBankBill(id: string, data: UpdateBankBillData): Promise<ApiResponse<BankBill>> {
    return apiService.put(`/bank-bills/${id}`, data);
  }

  async deleteBankBill(id: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/bank-bills/${id}`);
  }

  async downloadBankBillPDF(id: string): Promise<Blob> {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/bank-bills/${id}/download`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`,
      },
    });
    return response.blob();
  }

  async markBankBillPaid(id: string, paidAmount: number): Promise<ApiResponse<BankBill>> {
    return apiService.post(`/bank-bills/${id}/mark-paid`, { paidAmount });
  }

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
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/mis-reports/${id}/download?format=${format}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`,
      },
    });
    return response.blob();
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
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/mis-reports/bulk-download?format=${format}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reportIds }),
    });
    return response.blob();
  }

  // Dashboard Data for Reports
  async getReportsDashboardData(filters: ReportFilters = {}): Promise<ApiResponse<unknown>> {
    return apiService.get('/reports/dashboard', filters);
  }

  async getBankBillsSummary(filters: ReportFilters = {}): Promise<ApiResponse<unknown>> {
    return apiService.get('/bank-bills/summary', filters);
  }

  // Export Functions
  async exportBankBills(query: BankBillQuery = {}, format: 'PDF' | 'EXCEL' | 'CSV' = 'EXCEL'): Promise<Blob> {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/bank-bills/export?format=${format}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });
    return response.blob();
  }

  async exportMISReports(query: ReportQuery = {}, format: 'PDF' | 'EXCEL' | 'CSV' = 'EXCEL'): Promise<Blob> {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/mis-reports/export?format=${format}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });
    return response.blob();
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
    params.append('format', format);

    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/reports/mis-dashboard-data/export?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to export MIS data');
    }

    return response.blob();
  }
}

export const reportsService = new ReportsService();
