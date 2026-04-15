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
}

export interface CaseDataTemplate {
  id: number;
  clientId: number;
  productId: number;
  name: string;
  version: number;
  isActive: boolean;
  fields: CaseDataTemplateField[];
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
  }): Promise<ApiResponse<{ data: CaseDataTemplate[]; pagination: unknown }>> {
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
