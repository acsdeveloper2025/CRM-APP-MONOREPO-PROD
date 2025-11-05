import { apiService } from './api';
import type { 
  Invoice, 
  Commission, 
  CommissionSummary,
  CreateInvoiceData,
  UpdateInvoiceData
} from '@/types/billing';
import type { ApiResponse, PaginationQuery } from '@/types/api';

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
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/invoices/${id}/download`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`,
      },
    });
    return response.blob();
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
    const params: any = {};
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
  async getInvoiceReport(query: InvoiceQuery = {}): Promise<ApiResponse<any>> {
    return apiService.get('/reports/invoices', query);
  }

  async getCommissionReport(query: CommissionQuery = {}): Promise<ApiResponse<any>> {
    return apiService.get('/reports/commissions', query);
  }

  async downloadInvoiceReport(query: InvoiceQuery = {}): Promise<Blob> {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/reports/invoices/download`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });
    return response.blob();
  }

  async downloadCommissionReport(query: CommissionQuery = {}): Promise<Blob> {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/reports/commissions/download`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });
    return response.blob();
  }
}

export const billingService = new BillingService();
