import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService as api } from '@/services/api';
import type { UpdateVerificationTaskRequest, CreateVerificationTaskRequest, VerificationTaskListResponse } from '@/types/verificationTask';

export const useVerificationTasks = (caseId: string) => {
  return useQuery({
    queryKey: ['verification-tasks', caseId],
    queryFn: async () => {
      const response = await api.get(`/cases/${caseId}/verification-tasks`);
      return response.data;
    },
    enabled: !!caseId,
  });
};

export const useUpdateVerificationTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateVerificationTaskRequest }) => {
      const response = await api.put(`/verification-tasks/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
};

export const useCreateVerificationTasks = (caseId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tasks }: { tasks: CreateVerificationTaskRequest[] }) => {
      const response = await api.post(`/cases/${caseId}/verification-tasks`, { tasks });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-tasks', caseId] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
};

export const useAllVerificationTasks = (filters: Record<string, unknown> = {}) => {
  const queryKey = ['all-verification-tasks', filters];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      // Cast response to expected type as structure might vary from standard ApiResponse
      const response = await api.get('/verification-tasks', filters);
      return response as unknown as VerificationTaskListResponse;
    },
  });

  return {
    tasks: data?.tasks || [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    pagination: data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
    statistics: data?.statistics || { pending: 0, assigned: 0, completed: 0 },
    refreshTasks: refetch,
  };
};
