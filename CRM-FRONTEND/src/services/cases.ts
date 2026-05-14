import { BaseApiService } from './base';
import { apiService } from './api';
import { attachmentsService } from './attachments';
import type { Case, CaseListResponse } from '@/types/case';
import type { ApiResponse, PaginationQuery } from '@/types/api';
import type {
  CompleteCaseData,
  CreateCaseWithMultipleTasksPayload,
  CreateCaseWithMultipleTasksResponse,
} from '@/types/dto/case.dto';
import type { CaseConfigValidationResult } from '@/types/rateManagement';
import { validateResponse } from './schemas/runtime';
import { CaseSchema, CaseListResponseSchema } from './schemas/case.schema';

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
  customerName?: string;
  customerPhone?: string;
  clientId?: number;
  productId?: number;
  backendContactNumber?: string;
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

export interface CaseConfigValidationPayload {
  clientId: number;
  productId: number;
  verificationTypeId: number;
  areaId: number;
  pincodeId?: number;
  pincode?: string;
  rateTypeId?: number;
}

export class CasesService extends BaseApiService {
  constructor() {
    super('/cases');
  }

  async getCases(query: CaseListQuery = {}): Promise<ApiResponse<CaseListResponse>> {
    const response = await this.get<CaseListResponse>(
      '',
      query as unknown as Record<string, unknown>
    );
    if (response.success && response.data) {
      validateResponse(CaseListResponseSchema, response.data, {
        service: 'cases',
        endpoint: 'GET /cases',
      });
    }
    return response;
  }

  async getCaseById(id: string): Promise<ApiResponse<Case>> {
    const response = await this.get<Case>(`/${id}`);
    if (response.success && response.data) {
      validateResponse(CaseSchema, response.data, {
        service: 'cases',
        endpoint: 'GET /cases/:id',
      });
    }
    return response;
  }

  async createCaseWithMultipleTasks(
    payload: CreateCaseWithMultipleTasksPayload
  ): Promise<ApiResponse<CreateCaseWithMultipleTasksResponse>> {
    // Payload is already in unified format from CaseWithTasksCreationForm
    return this.post('/create', payload);
  }

  async validateConfiguration(
    payload: CaseConfigValidationPayload
  ): Promise<ApiResponse<CaseConfigValidationResult>> {
    return this.post('/config-validation', payload);
  }

  async updateCaseDetails(id: string, data: CreateCaseData): Promise<ApiResponse<Case>> {
    return this.put(`/${id}`, data);
  }

  // P20.A-06: updateCaseStatus / updateCasePriority / addCaseNote /
  // completeCase removed — they POST/PUT to routes that don't exist
  // on the backend (/api/cases/:id/status, /priority, /notes, /complete
  // are not mounted in routes/cases.ts). Zero callers across pages or
  // components; the hooks/useCases.ts wrappers (useUpdateCaseStatus
  // etc.) are removed in the same commit. updateCase remains — it's
  // the canonical PUT /api/cases/:id used by CaseCreationStepper edit
  // mode (and protected by the P14.M-2 body-side scope guard).

  async updateCase(id: string, data: CaseUpdateData): Promise<ApiResponse<Case>> {
    return this.put(`/${id}`, data);
  }

  async getCaseAttachments(id: string): Promise<ApiResponse<unknown[]>> {
    // Delegate to attachments service which uses the correct /api/attachments base path
    return attachmentsService.getAttachmentsByCase(id);
  }

  async uploadCaseAttachments(
    caseId: string,
    files: File[],
    verificationTaskId?: string
  ): Promise<ApiResponse<unknown>> {
    // Delegate to attachments service which uses the correct /api/attachments base path
    return attachmentsService.uploadAttachments({ caseId, files, verificationTaskId });
  }

  async downloadAttachment(id: string): Promise<Blob> {
    // Delegate to attachments service which uses the correct /api/attachments base path
    return attachmentsService.downloadAttachment(id);
  }

  async getCaseHistory(id: string): Promise<ApiResponse<unknown[]>> {
    return this.get(`/${id}/history`);
  }

  async getCasesByStatus(status: string): Promise<ApiResponse<CaseListResponse>> {
    return this.getCases({ status });
  }

  async getPendingReviewCases(): Promise<ApiResponse<CaseListResponse>> {
    return this.getCases({ status: 'COMPLETED' });
  }

  async getPendingCases(): Promise<ApiResponse<Case[]>> {
    // Fetch cases with PENDING and IN_PROGRESS status using custom pending duration sorting
    const [pendingResponse, inProgressResponse] = await Promise.all([
      this.getCases({
        status: 'PENDING',
        sortBy: 'pendingDuration',
        sortOrder: 'desc',
      }),
      this.getCases({
        status: 'IN_PROGRESS',
        sortBy: 'pendingDuration',
        sortOrder: 'desc',
      }),
    ]);

    // Combine the results and sort by pending duration
    const pendingCases = pendingResponse.data?.data || [];
    const inProgressCases = inProgressResponse.data?.data || [];
    const allCases = [...pendingCases, ...inProgressCases];

    // Sort combined cases by pending duration (longest pending first)
    allCases.sort((a, b) => {
      const aPendingDuration = a.pendingDurationSeconds || 0;
      const bPendingDuration = b.pendingDurationSeconds || 0;
      return bPendingDuration - aPendingDuration;
    });

    return {
      success: true,
      data: allCases,
      message: 'Pending cases retrieved successfully',
    };
  }

  // P20.A-06: approveCase / rejectCase / requestRework removed — the
  // backend routes /api/cases/:id/approve, /reject, /rework do not
  // exist; the workflow audit (2026-05-13) made REWORK/APPROVED/
  // REJECTED non-statuses on cases. Zero callers across pages or
  // components.

  async exportCases(
    params: {
      exportType?: 'all' | 'pending' | 'in-progress' | 'completed';
      status?: string;
      search?: string;
      assignedTo?: string;
      clientId?: string;
      priority?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<{ blob: Blob; filename: string }> {
    const queryParams: Record<string, string> = {};

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams[key] = String(value);
      }
    });

    const response = await apiService.getRaw<Blob>('/cases/export', undefined, {
      params: queryParams,
      responseType: 'blob',
    });

    // Extract filename from Content-Disposition header
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'cases_export.xlsx'; // fallback filename

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    return { blob: response.data, filename };
  }
}

export const casesService = new CasesService();
