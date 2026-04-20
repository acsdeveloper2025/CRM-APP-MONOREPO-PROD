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
   * Handlebars template via local text extraction + placeholder binding.
   * Admin reviews the draft in the editor and saves via the normal
   * create endpoint.
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
        elapsedMs: number;
        pagesCount: number;
        textItemsCount: number;
      };
    }>
  > {
    const form = new FormData();
    form.append('file', file);
    form.append('clientId', String(clientId));
    form.append('productId', String(productId));
    return apiService.post('/report-templates/convert-from-pdf', form, {
      headers: { 'Content-Type': undefined as unknown as string },
      timeout: 60_000,
    });
  }

  /**
   * Render a template with sample/real context on the backend and return
   * the rendered HTML string. The caller opens it in a new tab via a
   * blob URL so admins can visually check layout + placeholder substitution
   * before saving.
   */
  async previewHtml(payload: { htmlContent: string; sampleCaseId?: string }): Promise<string> {
    const response = await apiService.postRaw<string>('/report-templates/preview-html', payload, {
      responseType: 'text',
      transformResponse: (data: string) => data,
    });
    return response.data;
  }

  /**
   * Fetch the authoritative Handlebars placeholder catalog from the backend.
   * Static per-deploy; the editor panel renders this to replace any hand-
   * mirrored field list that could drift from the real render context.
   */
  async getContextSchema(): Promise<
    ApiResponse<{
      groups: Array<{
        id: string;
        title: string;
        note?: string;
        items: Array<{ placeholder: string; description: string }>;
      }>;
    }>
  > {
    return apiService.get('/report-templates/context-schema');
  }

  /**
   * Generate a PDF for the given case. Returns the raw blob plus the
   * filename the server suggested via Content-Disposition. The caller
   * is responsible for triggering the browser download.
   *
   * Optional logo/stamp files are uploaded as multipart and override the
   * template's default branding for this render only. Nothing is persisted.
   */
  async generate(
    caseId: string,
    branding?: { logo?: File | null; stamp?: File | null }
  ): Promise<{ blob: Blob; filename: string }> {
    const form = new FormData();
    if (branding?.logo) {
      form.append('logo', branding.logo);
    }
    if (branding?.stamp) {
      form.append('stamp', branding.stamp);
    }

    const hasFiles = form.has('logo') || form.has('stamp');
    const body = hasFiles ? form : undefined;
    const config = hasFiles
      ? {
          responseType: 'blob' as const,
          headers: { 'Content-Type': undefined as unknown as string },
        }
      : { responseType: 'blob' as const };

    const response = await apiService.postRaw<Blob>(
      `/report-templates/generate/${encodeURIComponent(caseId)}`,
      body,
      config
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
