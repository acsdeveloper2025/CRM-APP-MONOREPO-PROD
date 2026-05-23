import { apiService } from './api';
import type {
  Invoice,
  Commission,
  CommissionSummary,
  CreateInvoiceData,
  UpdateInvoiceData,
  InvoiceStats,
} from '@/types/billing';
import type { ApiResponse, PaginationQuery } from '@/types/api';
import { validateResponse } from './schemas/runtime';
import { InvoiceSchema, InvoiceListSchema } from './schemas/notification.schema';
import {
  GenericEntitySchema,
  GenericEntityListSchema,
  GenericObjectSchema,
} from './schemas/generic.schema';

export interface InvoiceQuery extends PaginationQuery {
  clientId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
    const response = await apiService.get<Invoice[]>('/invoices', query);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(InvoiceListSchema, response.data, {
        service: 'billing',
        endpoint: 'GET /invoices',
      });
    }
    return response;
  }

  async getInvoiceById(id: string): Promise<ApiResponse<Invoice>> {
    const response = await apiService.get<Invoice>(`/invoices/${id}`);
    if (response?.success && response.data) {
      validateResponse(InvoiceSchema, response.data, {
        service: 'billing',
        endpoint: 'GET /invoices/:id',
      });
    }
    return response;
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

  async downloadInvoiceFile(id: string, format: 'PDF' | 'EXCEL' = 'PDF'): Promise<Blob> {
    return apiService.getBlob(`/invoices/${id}/download`, { format });
  }

  async downloadInvoicePDF(id: string): Promise<Blob> {
    return this.downloadInvoiceFile(id, 'PDF');
  }

  async downloadInvoiceExcel(id: string): Promise<Blob> {
    return this.downloadInvoiceFile(id, 'EXCEL');
  }

  async getInvoicesByClient(clientId: string): Promise<ApiResponse<Invoice[]>> {
    return this.getInvoices({ clientId });
  }

  async getOverdueInvoices(): Promise<ApiResponse<Invoice[]>> {
    return this.getInvoices({ status: 'OVERDUE' });
  }

  // DB-wide aggregates (NOT page-limited). Use this for header stat cards;
  // never derive totals from getInvoices() which paginates.
  async getInvoiceStats(period?: string): Promise<ApiResponse<InvoiceStats>> {
    const params: Record<string, string> = {};
    if (period) {
      params.period = period;
    }
    const response = await apiService.get<InvoiceStats>('/invoices/stats', params);
    if (response?.success && response.data) {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'billing',
        endpoint: 'GET /invoices/stats',
      });
    }
    return response;
  }

  // Commission operations
  async getCommissions(query: CommissionQuery = {}): Promise<ApiResponse<Commission[]>> {
    const response = await apiService.get<Commission[]>('/commissions', query);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'billing',
        endpoint: 'GET /commissions',
      });
    }
    return response;
  }

  async getCommissionById(id: string): Promise<ApiResponse<Commission>> {
    const response = await apiService.get<Commission>(`/commissions/${id}`);
    if (response?.success && response.data) {
      validateResponse(GenericEntitySchema, response.data, {
        service: 'billing',
        endpoint: 'GET /commissions/:id',
      });
    }
    return response;
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

  async getCommissionSummary(
    userId?: string,
    period?: string
  ): Promise<ApiResponse<CommissionSummary>> {
    const params: Record<string, string> = {};
    if (userId) {
      params.userId = userId;
    }
    if (period) {
      params.period = period;
    }
    const response = await apiService.get<CommissionSummary>('/commissions/summary', params);
    if (response?.success && response.data) {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'billing',
        endpoint: 'GET /commissions/summary',
      });
    }
    return response;
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
    const response = await apiService.get<unknown>('/reports/invoices', query);
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'billing',
        endpoint: 'GET /reports/invoices',
      });
    }
    return response;
  }

  async getCommissionReport(query: CommissionQuery = {}): Promise<ApiResponse<unknown>> {
    const response = await apiService.get<unknown>('/reports/commissions', query);
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'billing',
        endpoint: 'GET /reports/commissions',
      });
    }
    return response;
  }

  async downloadInvoiceReport(query: InvoiceQuery = {}): Promise<Blob> {
    const response = await apiService.postRaw<Blob>('/reports/invoices/download', query, {
      responseType: 'blob',
    });
    return response.data;
  }

  async downloadCommissionReport(query: CommissionQuery = {}): Promise<Blob> {
    const response = await apiService.postRaw<Blob>('/reports/commissions/download', query, {
      responseType: 'blob',
    });
    return response.data;
  }

  /**
   * Export invoices to xlsx. Mirrors list filters via the shared BE
   * WHERE-builder. 10k row hard cap server-side. Respects sortBy/sortOrder.
   */
  async exportInvoicesToExcel(filters?: InvoiceQuery): Promise<Blob> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    const response = await apiService.getRaw<Blob>(
      `/invoices/export?${params.toString()}`,
      undefined,
      { responseType: 'blob' }
    );
    return response.data;
  }
}

export const billingService = new BillingService();
