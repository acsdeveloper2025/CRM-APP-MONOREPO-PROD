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
  // Phase 1.4 (2026-05-04): present only when the GET was scoped by
  // (clientId, productId). `hasRate=false` means the doc type is
  // assigned to the (client, product) but no active row in
  // `document_type_rates` — same UX as missing-service-zone-rule
  // for field verification (allow selection but warn).
  isMandatory?: boolean;
  displayOrder?: number;
  rateAmount?: number | string | null;
  hasRate?: boolean;
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
  /** Exclude a status (e.g. 'PENDING' for the completed KYC page). */
  statusNot?: string;
  documentType?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  caseId?: string;
}

class KYCService {
  async getDocumentTypes(filter?: {
    clientId?: number;
    productId?: number;
  }): Promise<ApiResponse<KYCDocumentType[]>> {
    // Phase 1.4 (2026-05-04): backend filters by (clientId, productId) when
    // both are provided — only doc types with an active row in
    // `document_type_rates` for that pair are returned. Without the filter
    // (or with only one), backend returns ALL active doc types
    // (admin-catalog use case).
    const params: Record<string, unknown> = {};
    if (filter?.clientId != null) {
      params.clientId = filter.clientId;
    }
    if (filter?.productId != null) {
      params.productId = filter.productId;
    }
    const response = await apiService.get<KYCDocumentType[]>(
      '/kyc/document-types',
      Object.keys(params).length > 0 ? params : undefined
    );
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

  // Authenticated blob download — `window.open` won't carry the in-memory
  // bearer token (Phase E5 hardening), so this returns the bytes via axios
  // and the caller is responsible for triggering the browser save.
  async exportToExcel(
    filters: { status?: string; documentType?: string; dateFrom?: string; dateTo?: string } = {}
  ): Promise<Blob> {
    const params: Record<string, string> = {};
    if (filters.status) {
      params.status = filters.status;
    }
    if (filters.documentType) {
      params.documentType = filters.documentType;
    }
    if (filters.dateFrom) {
      params.dateFrom = filters.dateFrom;
    }
    if (filters.dateTo) {
      params.dateTo = filters.dateTo;
    }
    const response = await apiService.getRaw<Blob>('/kyc/export', params, {
      responseType: 'blob',
    });
    return response.data;
  }
}

export const kycService = new KYCService();
