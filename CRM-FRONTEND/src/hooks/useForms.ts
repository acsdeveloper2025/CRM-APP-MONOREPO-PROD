import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formsService, FormSubmissionsResponse } from '@/services/forms';
import { FormSubmission } from '@/types/form';

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
  
  return useMutation({
    mutationFn: ({ caseId, formData }: { caseId: string; formData: any }) =>
      formsService.submitForm(caseId, formData),
    onSuccess: (data, variables) => {
      // Invalidate and refetch case form submissions
      queryClient.invalidateQueries({
        queryKey: ['case-form-submissions', variables.caseId],
      });
      // Invalidate case data as well since it might have been updated
      queryClient.invalidateQueries({
        queryKey: ['case', variables.caseId],
      });
    },
  });
};

// Hook to auto-save form
export const useAutoSaveForm = () => {
  return useMutation({
    mutationFn: ({ caseId, formData }: { caseId: string; formData: any }) =>
      formsService.autoSaveForm(caseId, formData),
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
    error: error || (!latestSubmission && formSubmissions ? new Error('No form submissions found') : null),
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
