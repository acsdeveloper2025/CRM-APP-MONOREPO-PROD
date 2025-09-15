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
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/bank-bills/${id}/download`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
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
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/mis-reports/${id}/download?format=${format}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
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
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/mis-reports/bulk-download?format=${format}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reportIds }),
    });
    return response.blob();
  }

  // Dashboard Data for Reports
  async getReportsDashboardData(filters: ReportFilters = {}): Promise<ApiResponse<any>> {
    return apiService.get('/reports/dashboard', filters);
  }

  async getBankBillsSummary(filters: ReportFilters = {}): Promise<ApiResponse<any>> {
    return apiService.get('/bank-bills/summary', filters);
  }

  // Export Functions
  async exportBankBills(query: BankBillQuery = {}, format: 'PDF' | 'EXCEL' | 'CSV' = 'EXCEL'): Promise<Blob> {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/bank-bills/export?format=${format}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });
    return response.blob();
  }

  async exportMISReports(query: ReportQuery = {}, format: 'PDF' | 'EXCEL' | 'CSV' = 'EXCEL'): Promise<Blob> {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/mis-reports/export?format=${format}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });
    return response.blob();
  }

  // Scheduled Reports
  async getScheduledReports(): Promise<ApiResponse<any[]>> {
    return apiService.get('/reports/scheduled');
  }

  async createScheduledReport(data: any): Promise<ApiResponse<any>> {
    return apiService.post('/reports/scheduled', data);
  }

  async updateScheduledReport(id: string, data: any): Promise<ApiResponse<any>> {
    return apiService.put(`/reports/scheduled/${id}`, data);
  }

  async deleteScheduledReport(id: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/reports/scheduled/${id}`);
  }
}

export const reportsService = new ReportsService();
