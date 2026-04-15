import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { caseDataService, type CaseDataEntry } from '@/services/caseDataService';

export const useCaseDataEntry = (caseId: string) => {
  return useQuery({
    queryKey: ['case-data-entry', caseId],
    queryFn: async () => {
      const response = await caseDataService.getEntryForCase(caseId);
      return response.data || null;
    },
    enabled: !!caseId,
  });
};

export const useCaseDataTemplate = (clientId: number | undefined, productId: number | undefined) => {
  return useQuery({
    queryKey: ['case-data-template', clientId, productId],
    queryFn: async () => {
      if (!clientId || !productId) { return null; }
      const response = await caseDataService.getTemplateForCase(clientId, productId);
      return response.data || null;
    },
    enabled: !!clientId && !!productId,
  });
};

export const useSaveCaseDataEntry = (caseId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { data: Record<string, unknown>; isCompleted?: boolean }) => {
      const response = await caseDataService.createOrUpdateEntry(caseId, data);
      return response.data as CaseDataEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-data-entry', caseId] });
    },
  });
};
