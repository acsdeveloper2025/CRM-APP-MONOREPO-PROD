import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useStandardizedMutation,
  useMutationWithInvalidation,
} from '@/hooks/useStandardizedMutation';
import {
  caseDataService,
  type CaseDataBundle,
  type CaseDataEntry,
} from '@/services/caseDataService';

const bundleKey = (caseId: string) => ['case-data-bundle', caseId];

export const useCaseDataBundle = (caseId: string) => {
  return useQuery({
    queryKey: bundleKey(caseId),
    queryFn: async (): Promise<CaseDataBundle | null> => {
      const response = await caseDataService.getEntriesForCase(caseId);
      return response.data || null;
    },
    enabled: !!caseId,
  });
};

export const useCreateInstance = (caseId: string) => {
  return useMutationWithInvalidation({
    mutationFn: async (instanceLabel?: string) => {
      const response = await caseDataService.createInstance(caseId, instanceLabel);
      return response.data as CaseDataEntry;
    },
    invalidateKeys: [bundleKey(caseId)],
    errorContext: 'Create Instance',
  });
};

export const useSaveInstance = (caseId: string) => {
  return useMutationWithInvalidation({
    mutationFn: async (vars: {
      instanceIndex: number;
      data: Record<string, unknown>;
      templateVersion: number;
    }) => {
      const response = await caseDataService.saveInstance(caseId, vars.instanceIndex, {
        data: vars.data,
        templateVersion: vars.templateVersion,
      });
      return response.data as CaseDataEntry;
    },
    invalidateKeys: [bundleKey(caseId)],
    errorContext: 'Save Instance',
  });
};

export const useDeleteInstance = (caseId: string) => {
  return useMutationWithInvalidation({
    mutationFn: async (instanceIndex: number) => {
      const response = await caseDataService.deleteInstance(caseId, instanceIndex);
      return response.data;
    },
    invalidateKeys: [bundleKey(caseId)],
    errorContext: 'Delete Instance',
  });
};

export const useCompleteCaseDataEntry = (caseId: string) => {
  const queryClient = useQueryClient();
  return useStandardizedMutation({
    mutationFn: async () => {
      const response = await caseDataService.completeEntry(caseId);
      return response.data;
    },
    errorContext: 'Complete Case Data Entry',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bundleKey(caseId) });
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
};
