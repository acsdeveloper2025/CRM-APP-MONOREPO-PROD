import { apiService } from './api';
import type { Case } from '@/types/case';
import type { ApiResponse, PaginationQuery } from '@/types/api';

// Smart API URL selection
const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isLocalNetwork = hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.');
  const isStaticIP = hostname === '103.14.234.36';
  const isDomain = hostname === 'crm.allcheckservices.com' || hostname === 'www.crm.allcheckservices.com';

  // Priority order for API URL selection:
  // 1. Check if we're on localhost (development)
  if (isLocalhost) {
    return 'http://localhost:3000/api';
  }

  // 2. Check if we're on the local network IP (hairpin NAT workaround)
  if (isLocalNetwork) {
    return 'http://103.14.234.36:3000/api';
  }

  // 3. Check if we're on the domain name (production access)
  if (isDomain) {
    return 'https://crm.allcheckservices.com/api';
  }

  // 4. Check if we're on the static IP (external access)
  if (isStaticIP) {
    return 'http://103.14.234.36:3000/api';
  }

  // 5. Fallback to environment variable or localhost
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
};

export interface CaseListQuery extends PaginationQuery {
  status?: string;
  search?: string;
  assignedTo?: string;
  clientId?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CaseUpdateData {
  status?: string;
  priority?: string;
  notes?: string;
  assignedToId?: string;
}

export interface CreateCaseData {
  // Core case fields
  customerName: string;
  customerCallingCode?: string;
  customerPhone?: string;
  createdByBackendUser?: string;
  verificationType?: string;
  address: string;
  pincode: string;
  verificationTypeId?: string;
  assignedToId: string;
  clientId: string;
  productId?: string;
  applicantType?: string;
  backendContactNumber?: string;
  priority?: string;
  trigger?: string;
  rateTypeId?: string;

  // Deduplication fields
  panNumber?: string;
  deduplicationDecision?: string;
  deduplicationRationale?: string;
}

export class CasesService {
  async getCases(query: CaseListQuery = {}): Promise<ApiResponse<Case[]>> {
    return apiService.get('/cases', query);
  }

  async getCaseById(id: string): Promise<ApiResponse<Case>> {
    return apiService.get(`/cases/${id}`);
  }

  async createCase(data: CreateCaseData): Promise<ApiResponse<Case>> {
    return apiService.post('/cases', data);
  }

  async createCaseWithAttachments(data: CreateCaseData, attachments: File[]): Promise<ApiResponse<Case>> {
    const formData = new FormData();

    // Add case data as JSON string
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    // Add attachment files
    attachments.forEach((file) => {
      formData.append('attachments', file);
    });

    // Use fetch directly for FormData to avoid setting Content-Type header
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/cases/with-attachments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        // Don't set Content-Type - let browser set it with boundary for multipart/form-data
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async updateCaseDetails(id: string, data: CreateCaseData): Promise<ApiResponse<Case>> {
    return apiService.put(`/cases/${id}`, data);
  }

  async updateCaseStatus(id: string, status: string): Promise<ApiResponse<Case>> {
    return apiService.put(`/cases/${id}/status`, { status });
  }

  async updateCasePriority(id: string, priority: string): Promise<ApiResponse<Case>> {
    return apiService.put(`/cases/${id}/priority`, { priority });
  }

  async updateCase(id: string, data: CaseUpdateData): Promise<ApiResponse<Case>> {
    return apiService.put(`/cases/${id}`, data);
  }

  async assignCase(id: string, assignedToId: string, reason?: string): Promise<ApiResponse<Case>> {
    return apiService.put(`/cases/${id}/assign`, { assignedToId, reason });
  }

  async addCaseNote(id: string, note: string): Promise<ApiResponse<Case>> {
    return apiService.post(`/cases/${id}/notes`, { note });
  }

  async completeCase(id: string, data: any): Promise<ApiResponse<Case>> {
    return apiService.post(`/cases/${id}/complete`, data);
  }

  async getCaseAttachments(id: string): Promise<ApiResponse<any[]>> {
    return apiService.get(`/attachments/case/${id}`);
  }

  async downloadAttachment(id: string): Promise<Blob> {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/attachments/${id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
    });
    return response.blob();
  }

  async getCaseHistory(id: string): Promise<ApiResponse<any[]>> {
    return apiService.get(`/cases/${id}/history`);
  }

  async getCasesByStatus(status: string): Promise<ApiResponse<Case[]>> {
    return this.getCases({ status });
  }

  async getPendingReviewCases(): Promise<ApiResponse<Case[]>> {
    return this.getCases({ status: 'COMPLETED' });
  }

  async getPendingCases(): Promise<ApiResponse<Case[]>> {
    // Fetch cases with PENDING and IN_PROGRESS status using custom pending duration sorting
    const [pendingResponse, inProgressResponse] = await Promise.all([
      this.getCases({
        status: 'PENDING',
        sortBy: 'pendingDuration',
        sortOrder: 'desc'
      }),
      this.getCases({
        status: 'IN_PROGRESS',
        sortBy: 'pendingDuration',
        sortOrder: 'desc'
      })
    ]);

    // Combine the results and sort by pending duration
    const pendingCases = pendingResponse.data || [];
    const inProgressCases = inProgressResponse.data || [];
    const allCases = [...pendingCases, ...inProgressCases];

    // Sort combined cases by pending duration (longest pending first)
    allCases.sort((a, b) => {
      const aPendingDuration = (a as any).pendingDurationSeconds || 0;
      const bPendingDuration = (b as any).pendingDurationSeconds || 0;
      return bPendingDuration - aPendingDuration;
    });

    return {
      success: true,
      data: allCases,
      message: 'Pending cases retrieved successfully'
    };
  }

  async approveCase(id: string, feedback?: string): Promise<ApiResponse<Case>> {
    return apiService.post(`/cases/${id}/approve`, { feedback });
  }

  async rejectCase(id: string, reason: string): Promise<ApiResponse<Case>> {
    return apiService.post(`/cases/${id}/reject`, { reason });
  }

  async requestRework(id: string, feedback: string): Promise<ApiResponse<Case>> {
    return apiService.post(`/cases/${id}/rework`, { feedback });
  }

  async exportCases(params: {
    exportType?: 'all' | 'pending' | 'in-progress' | 'completed';
    status?: string;
    search?: string;
    assignedTo?: string;
    clientId?: string;
    priority?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<{ blob: Blob; filename: string }> {
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });

    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/cases/export?${queryParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to export cases');
    }

    // Extract filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'cases_export.xlsx'; // fallback filename

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    const blob = await response.blob();
    return { blob, filename };
  }
}

export const casesService = new CasesService();
