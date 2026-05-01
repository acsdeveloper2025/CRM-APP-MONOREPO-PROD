import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
import { formsService, FormSubmissionsResponse } from '@/services/forms';
import { FormSubmission } from '@/types/form';
import { VerificationFormData } from '@/types/dto/form.dto';

// Hook to get form submissions for a case
export const useCaseFormSubmissions = (caseId: string) => {
  return useQuery<FormSubmissionsResponse>({
    queryKey: ['case-form-submissions', caseId],
    queryFn: () => formsService.getCaseFormSubmissions(caseId),
    enabled: !!caseId,
    staleTime: 0, // Always fetch fresh data to ensure sections are loaded
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook to get form template
export const useFormTemplate = (formType: string) => {
  return useQuery({
    queryKey: ['form-template', formType],
    queryFn: () => formsService.getFormTemplate(formType),
    enabled: !!formType,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};

// Hook to submit form
export const useSubmitForm = () => {
  const queryClient = useQueryClient();

  return useStandardizedMutation({
    mutationFn: ({ caseId, formData }: { caseId: string; formData: VerificationFormData }) =>
      formsService.submitForm(caseId, formData),
    errorContext: 'Form Submission',
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['case-form-submissions', variables.caseId] });
      queryClient.invalidateQueries({ queryKey: ['case', variables.caseId] });
    },
  });
};

// Auto-save fails silently — user is still typing, surfacing a toast on every
// dropped packet would be noisy.
export const useAutoSaveForm = () => {
  return useStandardizedMutation({
    mutationFn: ({ caseId, formData }: { caseId: string; formData: VerificationFormData }) =>
      formsService.autoSaveForm(caseId, formData),
    errorOptions: { showToast: false },
  });
};

// Hook to get auto-saved form
export const useAutoSavedForm = (caseId: string) => {
  return useQuery({
    queryKey: ['auto-saved-form', caseId],
    queryFn: () => formsService.getAutoSavedForm(caseId),
    enabled: !!caseId,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Utility hook to get form submission by ID
export const useFormSubmission = (caseId: string, submissionId: string) => {
  const { data: formSubmissions } = useCaseFormSubmissions(caseId);

  const submission = formSubmissions?.data?.submissions?.find(
    (sub: FormSubmission) => sub.id === submissionId
  );

  return {
    data: submission,
    isLoading: !formSubmissions,
    error: !submission && formSubmissions ? new Error('Form submission not found') : null,
  };
};

// Utility hook to get the latest form submission for a case
export const useLatestFormSubmission = (caseId: string) => {
  const { data: formSubmissions, isLoading, error } = useCaseFormSubmissions(caseId);

  const latestSubmission = formSubmissions?.data?.submissions?.[0]; // Assuming they're sorted by date

  return {
    data: latestSubmission,
    isLoading,
    error:
      error ||
      (!latestSubmission && formSubmissions ? new Error('No form submissions found') : null),
  };
};

// Utility hook to refresh form submissions cache
export const useRefreshFormSubmissions = () => {
  const queryClient = useQueryClient();

  return (caseId: string) => {
    queryClient.invalidateQueries({
      queryKey: ['case-form-submissions', caseId],
    });
  };
};
