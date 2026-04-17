import { apiService } from './api';
import type { ApiResponse } from '@/types/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReportTemplatePageSize = 'A4' | 'LETTER' | 'LEGAL';
export type ReportTemplatePageOrientation = 'portrait' | 'landscape';

export interface ReportTemplate {
  id: number;
  clientId: number;
  productId: number;
  name: string;
  version: number;
  isActive: boolean;
  htmlContent: string;
  pageSize: ReportTemplatePageSize;
  pageOrientation: ReportTemplatePageOrientation;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportTemplateListItem extends Omit<ReportTemplate, 'htmlContent'> {
  clientName: string;
  productName: string;
  generatedCount: string;
  htmlContent?: string;
}

export interface ReportTemplatesListResponse {
  data: ReportTemplateListItem[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export interface ReportTemplateValidateResult {
  valid: boolean;
  error?: string;
}

export interface CreateReportTemplatePayload {
  clientId: number;
  productId: number;
  name: string;
  htmlContent: string;
  pageSize?: ReportTemplatePageSize;
  pageOrientation?: ReportTemplatePageOrientation;
}

export interface UpdateReportTemplatePayload {
  name?: string;
  htmlContent?: string;
  pageSize?: ReportTemplatePageSize;
  pageOrientation?: ReportTemplatePageOrientation;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ReportTemplatesService {
  async list(params?: {
    clientId?: number;
    productId?: number;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<ApiResponse<ReportTemplateListItem[]>> {
    // Backend already returns { data: ReportTemplateListItem[], pagination: {...} } inside the
    // success envelope. Our apiService is typed to put that top-level payload into `.data`, so
    // callers get the list via res.data and pagination via res.pagination.
    return apiService.get('/report-templates', params);
  }

  async getById(id: number): Promise<ApiResponse<ReportTemplateListItem>> {
    return apiService.get(`/report-templates/${id}`);
  }

  async getByConfig(
    clientId: number,
    productId: number
  ): Promise<ApiResponse<ReportTemplate | null>> {
    return apiService.get('/report-templates/by-config', { clientId, productId });
  }

  async validate(htmlContent: string): Promise<ApiResponse<ReportTemplateValidateResult>> {
    return apiService.post('/report-templates/validate', { htmlContent });
  }

  async create(payload: CreateReportTemplatePayload): Promise<ApiResponse<ReportTemplate>> {
    return apiService.post('/report-templates', payload);
  }

  async update(
    id: number,
    payload: UpdateReportTemplatePayload
  ): Promise<ApiResponse<ReportTemplate>> {
    return apiService.put(`/report-templates/${id}`, payload);
  }

  async deactivate(id: number): Promise<ApiResponse<unknown>> {
    return apiService.delete(`/report-templates/${id}`);
  }

  /**
   * Convert a PDF file (bank-provided RCU report format) into a draft
   * Handlebars template using Claude AI. Returns the generated HTML plus
   * validation status + token usage — admin reviews in the editor and
   * saves via the normal create endpoint.
   */
  async convertFromPdf(
    clientId: number,
    productId: number,
    file: File
  ): Promise<
    ApiResponse<{
      htmlContent: string;
      validatedOk: boolean;
      validationError: string | null;
      model: string;
      dataEntryFieldsUsed: Array<{ fieldKey: string; fieldLabel: string }>;
      usage: {
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheCreationTokens: number;
        elapsedMs: number;
      };
    }>
  > {
    const form = new FormData();
    form.append('file', file);
    form.append('clientId', String(clientId));
    form.append('productId', String(productId));
    return apiService.post('/report-templates/convert-from-pdf', form, {
      headers: { 'Content-Type': undefined as unknown as string },
      // Conversion can take 30-60s on first request (model warms up). Keep
      // the axios timeout above the backend's expected ceiling.
      timeout: 120_000,
    });
  }

  /**
   * Generate a PDF for the given case. Returns the raw blob plus the
   * filename the server suggested via Content-Disposition. The caller
   * is responsible for triggering the browser download.
   */
  async generate(caseId: string): Promise<{ blob: Blob; filename: string }> {
    const response = await apiService.postRaw<Blob>(
      `/report-templates/generate/${encodeURIComponent(caseId)}`,
      undefined,
      { responseType: 'blob' }
    );

    const contentDisposition = response.headers['content-disposition'] as string | undefined;
    let filename = `Report_${caseId}.pdf`;
    if (contentDisposition) {
      const match = /filename="([^"]+)"/.exec(contentDisposition);
      if (match) {
        filename = match[1];
      }
    }
    return { blob: response.data, filename };
  }
}

export const reportTemplatesService = new ReportTemplatesService();
