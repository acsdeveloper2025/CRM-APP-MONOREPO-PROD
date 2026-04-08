import { apiService } from './api';
import type { ApiResponse } from '@/types/api';

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
  is_active: boolean;
  sort_order: number;
  custom_fields: KYCCustomField[];
}

export interface KYCTask {
  id: string;
  verification_task_id: string;
  case_id: string;
  document_type: string;
  document_number: string | null;
  document_holder_name: string | null;
  document_file_name: string | null;
  document_file_path: string | null;
  document_details: Record<string, string>;
  description: string | null;
  type_custom_fields: KYCCustomField[];
  verification_status: 'PENDING' | 'PASS' | 'FAIL' | 'REFER';
  remarks: string | null;
  rejection_reason: string | null;
  verified_at: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  case_number: number;
  customer_name: string;
  customer_phone: string | null;
  case_status: string;
  task_number: string;
  task_status: string;
  verified_by_name: string | null;
  assigned_to_name: string | null;
  assigned_by_name: string | null;
  document_type_name: string;
  document_category: string;
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
    return apiService.get('/kyc/document-types');
  }

  async listTasks(query: KYCTaskListQuery = {}): Promise<ApiResponse<KYCTaskListResponse>> {
    return apiService.get('/kyc/tasks', query as Record<string, unknown>);
  }

  async getTaskDetail(taskId: string): Promise<ApiResponse<KYCTask>> {
    return apiService.get(`/kyc/tasks/${taskId}`);
  }

  async verifyDocument(taskId: string, data: { status: string; remarks?: string; rejectionReason?: string }): Promise<ApiResponse<{ id: string; status: string }>> {
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
    return apiService.get(`/kyc/cases/${caseId}/tasks`);
  }

  getExportUrl(filters: { status?: string; documentType?: string; dateFrom?: string; dateTo?: string } = {}): string {
    const params = new URLSearchParams();
    if (filters.status) {params.append('status', filters.status);}
    if (filters.documentType) {params.append('documentType', filters.documentType);}
    if (filters.dateFrom) {params.append('dateFrom', filters.dateFrom);}
    if (filters.dateTo) {params.append('dateTo', filters.dateTo);}
    return `/api/kyc/export?${params.toString()}`;
  }
}

export const kycService = new KYCService();
