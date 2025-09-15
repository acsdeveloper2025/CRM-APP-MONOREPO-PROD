import { apiService } from './api';
import { FormSubmission } from '@/types/form';

export interface FormSubmissionsResponse {
  success: boolean;
  message: string;
  data: {
    caseId: string;
    submissions: FormSubmission[];
    totalCount: number;
  };
}

export const formsService = {
  // Get form submissions for a case
  async getCaseFormSubmissions(caseId: string): Promise<FormSubmissionsResponse> {
    const response = await apiService.get(`/forms/cases/${caseId}/submissions`);
    return response;
  },

  // Get form template (for future use)
  async getFormTemplate(formType: string) {
    const response = await apiService.get(`/forms/templates/${formType}`);
    return response;
  },

  // Submit form data (for future use)
  async submitForm(caseId: string, formData: any) {
    const response = await apiService.post(`/forms/cases/${caseId}/submit`, formData);
    return response;
  },

  // Auto-save form data (for future use)
  async autoSaveForm(caseId: string, formData: any) {
    const response = await apiService.post(`/forms/auto-save`, { caseId, formData });
    return response;
  },

  // Get auto-saved form data (for future use)
  async getAutoSavedForm(caseId: string) {
    const response = await apiService.get(`/forms/auto-save/${caseId}`);
    return response;
  },
};
