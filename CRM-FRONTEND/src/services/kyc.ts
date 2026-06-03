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
  // BE column `verification_status` is the workflow state (PENDING /
  // ASSIGNED / IN_PROGRESS / COMPLETED / REVOKED). The legacy values
  // PASS/FAIL/REFER are kept in the union for back-compat with existing
  // FE consumers that compare against them — those comparisons never
  // match real BE data (outcomes live in `finalStatus`, not here) and
  // are flagged as a separate pre-existing display bug.
  verificationStatus:
    | 'PENDING'
    | 'ASSIGNED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'REVOKED'
    | 'PASS'
    | 'FAIL'
    | 'REFER';
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
  dateFrom?: string;
  dateTo?: string;
  /** F9.1: filter to rows that have been rechecked at least once. */
  recheckedOnly?: boolean;
  /** Read-only KYC Verifier portal: restrict to docs assigned to this user. */
  assignedTo?: string;
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

  // F9.1: KYC state-transition endpoints (parity with field tasks).
  async startTask(taskId: string): Promise<ApiResponse<{ id: string; status: string }>> {
    return apiService.post(`/kyc/tasks/${taskId}/start`, {});
  }

  async revokeTask(
    taskId: string,
    revokeReason: string
  ): Promise<ApiResponse<{ id: string; status: string }>> {
    return apiService.post(`/kyc/tasks/${taskId}/revoke`, { revokeReason });
  }

  async recheckTask(taskId: string): Promise<ApiResponse<{ id: string; status: string }>> {
    return apiService.post(`/kyc/tasks/${taskId}/recheck`, {});
  }

  // P3 (2026-06-02): non-destructive reverification — opens a new billable cycle.
  async reverifyTask(
    taskId: string,
    opts?: { assignedTo?: string; reason?: string }
  ): Promise<ApiResponse<{ id: string; cycle: number; status: string }>> {
    return apiService.post(`/kyc/tasks/${taskId}/reverify`, opts || {});
  }

  // P3 (2026-06-02): Recheck = clone a completed KYC doc into a new editable
  // Pending task (replaces reverify). Bills as a fresh KYC.
  async recheckClone(
    taskId: string,
    payload: {
      documentTypeId?: number;
      documentNumber?: string;
      documentHolderName?: string;
      documentDetails?: Record<string, string>;
      assignedTo: string;
    }
  ): Promise<ApiResponse<{ id: string; verificationTaskId: string }>> {
    return apiService.post(`/kyc/tasks/${taskId}/recheck-clone`, payload);
  }

  async getCycles(taskId: string): Promise<ApiResponse<KYCCycle[]>> {
    return apiService.get<KYCCycle[]>(`/kyc/tasks/${taskId}/cycles`);
  }

  async getMis(): Promise<ApiResponse<KYCMis>> {
    return apiService.get<KYCMis>(`/kyc/mis`);
  }

  async uploadDocument(taskId: string, file: File): Promise<ApiResponse<{ filePath: string }>> {
    const formData = new FormData();
    formData.append('document', file);
    return apiService.post(`/kyc/tasks/${taskId}/upload`, formData);
  }

  // P2 (2026-06-02): attach the completion report file (source's reply) to the
  // active reverification cycle. Uploaded just before /verify on completion.
  async uploadReport(taskId: string, file: File): Promise<ApiResponse<{ filePath: string }>> {
    const formData = new FormData();
    formData.append('report', file);
    return apiService.post(`/kyc/tasks/${taskId}/report`, formData);
  }

  // C2 (2026-06-03): KYC document/report bytes are served only via the
  // row-scoped, bearer-authenticated endpoints (the raw /uploads/kyc mount is
  // blocked). Fetch as a blob and hand back an object URL the caller opens.
  async getDocumentObjectUrl(taskId: string): Promise<string> {
    const response = await apiService.getRaw<Blob>(
      `/kyc/tasks/${taskId}/document`,
      {},
      { responseType: 'blob' }
    );
    return URL.createObjectURL(response.data);
  }

  async getCycleReportObjectUrl(taskId: string, cycleNumber: number): Promise<string> {
    const response = await apiService.getRaw<Blob>(
      `/kyc/tasks/${taskId}/cycles/${cycleNumber}/report`,
      {},
      { responseType: 'blob' }
    );
    return URL.createObjectURL(response.data);
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
    filters: {
      status?: string;
      statusNot?: string;
      documentType?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<Blob> {
    const params: Record<string, string> = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params[key] = String(value);
      }
    });
    const response = await apiService.getRaw<Blob>('/kyc/export', params, {
      responseType: 'blob',
    });
    return response.data;
  }
}

// P3/P6 (2026-06-02): one row per reverification cycle.
export interface KYCCycle {
  cycle_number: number;
  status: string;
  assigned_verifier_id: string | null;
  assigned_verifier_name: string | null;
  assigned_at: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  completed_at: string | null;
  final_status: string | null;
  rate_amount: string | null;
  billable: boolean;
  billed: boolean;
  report_received_at: string | null;
  created_at: string;
  // P2 (2026-06-02): per-cycle completion report attachment.
  report_file_path: string | null;
  report_file_name: string | null;
  report_uploaded_at: string | null;
}

// P5 (2026-06-02): KYC MIS metrics over the cycle table.
export interface KYCMis {
  totalAssigned: number;
  pendingWithVerifier: number;
  completed: number;
  reverificationCount: number;
  billableCount: number;
  billedCount: number;
  eligibleRevenue: number;
  realizedRevenue: number;
}

export const kycService = new KYCService();
