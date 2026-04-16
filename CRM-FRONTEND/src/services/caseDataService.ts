import { apiService } from './api';
import type { ApiResponse } from '@/types/api';

// Template types
export interface CaseDataTemplateField {
  id: number;
  templateId: number;
  fieldKey: string;
  fieldLabel: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTISELECT' | 'BOOLEAN' | 'TEXTAREA';
  isRequired: boolean;
  displayOrder: number;
  section: string | null;
  placeholder: string | null;
  defaultValue: string | null;
  validationRules: Record<string, unknown>;
  options: Array<{ label: string; value: string }>;
  isActive: boolean;
  /**
   * Sprint 5: null = normal dynamic field (stored in JSONB).
   * Non-null = read-only mirror of a system source (customer_name,
   * verifier_name, etc.) — value comes from `prefillValue` on render,
   * never edited, never stored in JSONB.
   */
  prefillSource?: string | null;
  /**
   * Populated by the backend on bundle render when prefillSource is
   * set. Undefined on template-editor endpoints (they don't resolve).
   */
  prefillValue?: unknown;
}

export interface CaseDataTemplate {
  id: number;
  clientId: number;
  productId: number;
  name: string;
  version: number;
  isActive: boolean;
  fields: CaseDataTemplateField[];
  /** Populated by the list endpoint (subquery count); individual
   *  template reads return the full fields array instead. */
  fieldCount?: number;
  createdAt: string;
  updatedAt: string;
}

// Entry types (one row = one instance)
export interface CaseDataEntry {
  id: number;
  caseId: string;
  templateId: number;
  templateVersion: number;
  instanceIndex: number;
  instanceLabel: string;
  data: Record<string, unknown>;
  isCompleted: boolean;
  completedAt: string | null;
  completedBy: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseDataBundle {
  entries: CaseDataEntry[];
  template: CaseDataTemplate | null;
  caseStatus: string;
}

class CaseDataService {
  // ---------------- Templates ----------------
  async getTemplates(params?: {
    clientId?: number;
    productId?: number;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ data: CaseDataTemplate[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>> {
    return apiService.get('/case-data-templates', params);
  }

  async getTemplateById(id: number): Promise<ApiResponse<CaseDataTemplate>> {
    return apiService.get(`/case-data-templates/${id}`);
  }

  async getTemplateForCase(
    clientId: number,
    productId: number
  ): Promise<ApiResponse<CaseDataTemplate>> {
    return apiService.get('/case-data-templates/by-config', { clientId, productId });
  }

  async createTemplate(data: {
    clientId: number;
    productId: number;
    name: string;
    fields: Array<
      Omit<CaseDataTemplateField, 'id' | 'templateId' | 'isActive' | 'createdAt' | 'updatedAt'>
    >;
  }): Promise<ApiResponse<CaseDataTemplate>> {
    return apiService.post('/case-data-templates', data);
  }

  async updateTemplate(
    id: number,
    data: {
      name?: string;
      fields?: Array<
        Omit<CaseDataTemplateField, 'id' | 'templateId' | 'isActive' | 'createdAt' | 'updatedAt'>
      >;
    }
  ): Promise<ApiResponse<CaseDataTemplate>> {
    return apiService.put(`/case-data-templates/${id}`, data);
  }

  /**
   * Parse an uploaded .xlsx / .csv into a draft field list for the
   * import-preview UI. Server does NOT persist; admin reviews the
   * returned fields, adjusts types / options / required flags, then
   * calls createTemplate() to save.
   */
  async parseUpload(
    clientId: number,
    productId: number,
    file: File
  ): Promise<
    ApiResponse<{
      clientId: number;
      productId: number;
      sheetName: string | null;
      rowCount: number;
      fields: Array<
        Omit<CaseDataTemplateField, 'id' | 'templateId' | 'isActive' | 'createdAt' | 'updatedAt'>
      >;
      existingTemplateId: number | null;
      existingTemplateVersion: number | null;
    }>
  > {
    const form = new FormData();
    form.append('file', file);
    form.append('clientId', String(clientId));
    form.append('productId', String(productId));
    // The shared axios instance defaults Content-Type to application/json.
    // For multipart uploads we must drop that default so axios re-derives
    // the header from the FormData body (which adds the required boundary
    // parameter). Setting Content-Type to a literal "multipart/form-data"
    // would skip the boundary and break multer parsing on the backend.
    return apiService.post('/case-data-templates/parse-upload', form, {
      headers: { 'Content-Type': undefined as unknown as string },
    });
  }

  // ---------------- Entries (multi-instance) ----------------

  /**
   * Returns the bundle for a case: all instances + the template used to
   * render them + the current case status.
   */
  async getEntriesForCase(caseId: string): Promise<ApiResponse<CaseDataBundle>> {
    return apiService.get(`/case-data-entries/${caseId}`);
  }

  async createInstance(
    caseId: string,
    instanceLabel?: string
  ): Promise<ApiResponse<CaseDataEntry>> {
    return apiService.post(`/case-data-entries/${caseId}/instances`, {
      ...(instanceLabel ? { instanceLabel } : {}),
    });
  }

  /**
   * Save (draft) data for a specific instance. Pass the templateVersion
   * the form was rendered against so the server can hard-reject stale
   * saves after an admin publishes a new version.
   */
  async saveInstance(
    caseId: string,
    instanceIndex: number,
    payload: { data: Record<string, unknown>; templateVersion: number }
  ): Promise<ApiResponse<CaseDataEntry>> {
    return apiService.put(`/case-data-entries/${caseId}/instances/${instanceIndex}`, payload);
  }

  async deleteInstance(caseId: string, instanceIndex: number): Promise<ApiResponse<unknown>> {
    return apiService.delete(`/case-data-entries/${caseId}/instances/${instanceIndex}`);
  }

  async completeEntry(caseId: string): Promise<ApiResponse<unknown>> {
    return apiService.post(`/case-data-entries/${caseId}/complete`, {});
  }
}

export const caseDataService = new CaseDataService();
