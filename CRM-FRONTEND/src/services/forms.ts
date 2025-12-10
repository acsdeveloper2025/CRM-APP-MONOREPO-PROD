import { apiService } from './api';
import { FormSubmission } from '@/types/form';
import type { VerificationFormData, FormSubmissionResponse } from '@/types/dto/form.dto';

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
    const response = await apiService.get<FormSubmissionsResponse>(`/forms/cases/${caseId}/submissions`);
    return response as unknown as FormSubmissionsResponse;
  },

  // Get form template (for future use)
  async getFormTemplate(formType: string) {
    const response = await apiService.get(`/forms/templates/${formType}`);
    return response;
  },

  // Submit form data (for future use)
  async submitForm(caseId: string, formData: VerificationFormData): Promise<FormSubmissionResponse> {
    const response = await apiService.post(`/forms/cases/${caseId}/submit`, formData);
    return response as unknown as FormSubmissionResponse;
  },

  // Auto-save form data (for future use)
  async autoSaveForm(caseId: string, formData: VerificationFormData) {
    const response = await apiService.post(`/forms/auto-save`, { caseId, formData });
    return response;
  },

  // Get auto-saved form data (for future use)
  async getAutoSavedForm(caseId: string) {
    const response = await apiService.get(`/forms/auto-save/${caseId}`);
    return response;
  },
};
