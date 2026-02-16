import { apiService } from './api';
import type { 
  Invoice, 
  Commission, 
  CommissionSummary,
  CreateInvoiceData,
  UpdateInvoiceData
} from '@/types/billing';
import type { ApiResponse, PaginationQuery } from '@/types/api';



export interface InvoiceQuery extends PaginationQuery {
  clientId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CommissionQuery extends PaginationQuery {
  userId?: string;
  clientId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export class BillingService {
  // Invoice operations
  async getInvoices(query: InvoiceQuery = {}): Promise<ApiResponse<Invoice[]>> {
    return apiService.get('/invoices', query);
  }

  async getInvoiceById(id: string): Promise<ApiResponse<Invoice>> {
    return apiService.get(`/invoices/${id}`);
  }

  async createInvoice(data: CreateInvoiceData): Promise<ApiResponse<Invoice>> {
    return apiService.post('/invoices', data);
  }

  async updateInvoice(id: string, data: UpdateInvoiceData): Promise<ApiResponse<Invoice>> {
    return apiService.put(`/invoices/${id}`, data);
  }

  async deleteInvoice(id: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/invoices/${id}`);
  }

  async sendInvoice(id: string): Promise<ApiResponse<Invoice>> {
    return apiService.post(`/invoices/${id}/send`);
  }

  async markInvoicePaid(id: string, paidDate?: string): Promise<ApiResponse<Invoice>> {
    return apiService.post(`/invoices/${id}/mark-paid`, { paidDate });
  }

  async downloadInvoicePDF(id: string): Promise<Blob> {
    return apiService.getBlob(`/invoices/${id}/download`);
  }

  async getInvoicesByClient(clientId: string): Promise<ApiResponse<Invoice[]>> {
    return this.getInvoices({ clientId });
  }

  async getOverdueInvoices(): Promise<ApiResponse<Invoice[]>> {
    return this.getInvoices({ status: 'OVERDUE' });
  }

  // Commission operations
  async getCommissions(query: CommissionQuery = {}): Promise<ApiResponse<Commission[]>> {
    return apiService.get('/commissions', query);
  }

  async getCommissionById(id: string): Promise<ApiResponse<Commission>> {
    return apiService.get(`/commissions/${id}`);
  }

  async approveCommission(id: string): Promise<ApiResponse<Commission>> {
    return apiService.post(`/commissions/${id}/approve`);
  }

  async markCommissionPaid(id: string, paidDate?: string): Promise<ApiResponse<Commission>> {
    return apiService.post(`/commissions/${id}/mark-paid`, { paidDate });
  }

  async getCommissionsByUser(userId: string): Promise<ApiResponse<Commission[]>> {
    return this.getCommissions({ userId });
  }

  async getCommissionsByClient(clientId: string): Promise<ApiResponse<Commission[]>> {
    return this.getCommissions({ clientId });
  }

  async getCommissionSummary(userId?: string, period?: string): Promise<ApiResponse<CommissionSummary>> {
    const params: Record<string, string> = {};
    if (userId) {params.userId = userId;}
    if (period) {params.period = period;}
    return apiService.get('/commissions/summary', params);
  }

  // Bulk operations
  async bulkApproveCommissions(ids: string[]): Promise<ApiResponse<void>> {
    return apiService.post('/commissions/bulk-approve', { ids });
  }

  async bulkMarkCommissionsPaid(ids: string[], paidDate?: string): Promise<ApiResponse<void>> {
    return apiService.post('/commissions/bulk-mark-paid', { ids, paidDate });
  }

  // Reports
  async getInvoiceReport(query: InvoiceQuery = {}): Promise<ApiResponse<unknown>> {
    return apiService.get('/reports/invoices', query);
  }

  async getCommissionReport(query: CommissionQuery = {}): Promise<ApiResponse<unknown>> {
    return apiService.get('/reports/commissions', query);
  }

  async downloadInvoiceReport(query: InvoiceQuery = {}): Promise<Blob> {
    const response = await apiService.postRaw<Blob>('/reports/invoices/download', query, {
        responseType: 'blob'
    });
    return response.data;
  }

  async downloadCommissionReport(query: CommissionQuery = {}): Promise<Blob> {
    const response = await apiService.postRaw<Blob>('/reports/commissions/download', query, {
        responseType: 'blob'
    });
    return response.data;
  }
}

export const billingService = new BillingService();
