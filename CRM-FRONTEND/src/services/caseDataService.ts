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

// Entry types
export interface CaseDataEntry {
  id: number;
  caseId: string;
  templateId: number;
  data: Record<string, unknown>;
  isCompleted: boolean;
  completedAt: string | null;
  completedBy: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  template?: CaseDataTemplate;
}

class CaseDataService {
  // Templates
  async getTemplates(params?: {
    clientId?: number;
    productId?: number;
  }): Promise<ApiResponse<{ data: CaseDataTemplate[]; pagination: unknown }>> {
    return apiService.get('/case-data-templates', params);
  }

  async getTemplateById(id: number): Promise<ApiResponse<CaseDataTemplate>> {
    return apiService.get(`/case-data-templates/${id}`);
  }

  async getTemplateForCase(clientId: number, productId: number): Promise<ApiResponse<CaseDataTemplate>> {
    return apiService.get('/case-data-templates/by-config', { clientId, productId });
  }

  async createTemplate(data: {
    clientId: number;
    productId: number;
    name: string;
    fields: Array<Omit<CaseDataTemplateField, 'id' | 'templateId' | 'isActive' | 'createdAt' | 'updatedAt'>>;
  }): Promise<ApiResponse<CaseDataTemplate>> {
    return apiService.post('/case-data-templates', data);
  }

  async updateTemplate(
    id: number,
    data: {
      name?: string;
      fields?: Array<Omit<CaseDataTemplateField, 'id' | 'templateId' | 'isActive' | 'createdAt' | 'updatedAt'>>;
    }
  ): Promise<ApiResponse<CaseDataTemplate>> {
    return apiService.put(`/case-data-templates/${id}`, data);
  }

  // Entries
  async getEntryForCase(caseId: string): Promise<ApiResponse<CaseDataEntry | null>> {
    return apiService.get(`/case-data-entries/${caseId}`);
  }

  async createOrUpdateEntry(
    caseId: string,
    data: { data: Record<string, unknown> }
  ): Promise<ApiResponse<CaseDataEntry>> {
    return apiService.post(`/case-data-entries/${caseId}`, data);
  }

  async updateEntry(
    caseId: string,
    data: { data: Record<string, unknown> }
  ): Promise<ApiResponse<CaseDataEntry>> {
    return apiService.put(`/case-data-entries/${caseId}`, data);
  }

  async completeEntry(caseId: string): Promise<ApiResponse<unknown>> {
    return apiService.post(`/case-data-entries/${caseId}/complete`, {});
  }
}

export const caseDataService = new CaseDataService();
