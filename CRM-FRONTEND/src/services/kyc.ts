import { apiService } from './api';
import type { ApiResponse } from '@/types/api';
import { validateResponse } from './schemas/runtime';
import {
  GenericEntitySchema,
  GenericEntityListSchema,
  GenericObjectSchema,
} from './schemas/generic.schema';

export interface KYCCustomField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'number';
  required?: boolean;
}

export interface KYCDocumentType {
  id: number;
  code: string;
  name: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
  customFields: KYCCustomField[];
}

export interface KYCTask {
  id: string;
  verificationTaskId: string;
  caseId: string;
  documentType: string;
  documentNumber: string | null;
  documentHolderName: string | null;
  documentFileName: string | null;
  documentFilePath: string | null;
  documentDetails: Record<string, string>;
  description: string | null;
  typeCustomFields: KYCCustomField[];
  verificationStatus: 'PENDING' | 'PASS' | 'FAIL' | 'REFER';
  remarks: string | null;
  rejectionReason: string | null;
  verifiedAt: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  caseNumber: number;
  customerName: string;
  customerPhone: string | null;
  caseStatus: string;
  taskNumber: string;
  taskStatus: string;
  verifiedByName: string | null;
  assignedToName: string | null;
  assignedByName: string | null;
  documentTypeName: string;
  documentCategory: string;
}

export interface KYCTaskListResponse {
  data: KYCTask[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  statistics: { total: number; pending: number; passed: number; failed: number; referred: number };
}

export interface KYCTaskListQuery {
  page?: number;
  limit?: number;
  status?: string;
  documentType?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  caseId?: string;
}

class KYCService {
  async getDocumentTypes(): Promise<ApiResponse<KYCDocumentType[]>> {
    const response = await apiService.get<KYCDocumentType[]>('/kyc/document-types');
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'kyc',
        endpoint: 'GET /kyc/document-types',
      });
    }
    return response;
  }

  async listTasks(query: KYCTaskListQuery = {}): Promise<ApiResponse<KYCTaskListResponse>> {
    const response = await apiService.get<KYCTaskListResponse>(
      '/kyc/tasks',
      query as Record<string, unknown>
    );
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'kyc',
        endpoint: 'GET /kyc/tasks',
      });
    }
    return response;
  }

  async getTaskDetail(taskId: string): Promise<ApiResponse<KYCTask>> {
    const response = await apiService.get<KYCTask>(`/kyc/tasks/${taskId}`);
    if (response?.success && response.data) {
      validateResponse(GenericEntitySchema, response.data, {
        service: 'kyc',
        endpoint: 'GET /kyc/tasks/:taskId',
      });
    }
    return response;
  }

  async verifyDocument(
    taskId: string,
    data: { status: string; remarks?: string; rejectionReason?: string }
  ): Promise<ApiResponse<{ id: string; status: string }>> {
    return apiService.put(`/kyc/tasks/${taskId}/verify`, data);
  }

  async assignTask(taskId: string, assignedTo: string): Promise<ApiResponse<{ id: string }>> {
    return apiService.put(`/kyc/tasks/${taskId}/assign`, { assignedTo });
  }

  async uploadDocument(taskId: string, file: File): Promise<ApiResponse<{ filePath: string }>> {
    const formData = new FormData();
    formData.append('document', file);
    return apiService.post(`/kyc/tasks/${taskId}/upload`, formData);
  }

  async getTasksForCase(caseId: string): Promise<ApiResponse<KYCTask[]>> {
    const response = await apiService.get<KYCTask[]>(`/kyc/cases/${caseId}/tasks`);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'kyc',
        endpoint: 'GET /kyc/cases/:caseId/tasks',
      });
    }
    return response;
  }

  getExportUrl(
    filters: { status?: string; documentType?: string; dateFrom?: string; dateTo?: string } = {}
  ): string {
    const params = new URLSearchParams();
    if (filters.status) {
      params.append('status', filters.status);
    }
    if (filters.documentType) {
      params.append('documentType', filters.documentType);
    }
    if (filters.dateFrom) {
      params.append('dateFrom', filters.dateFrom);
    }
    if (filters.dateTo) {
      params.append('dateTo', filters.dateTo);
    }
    return `/api/kyc/export?${params.toString()}`;
  }
}

export const kycService = new KYCService();
