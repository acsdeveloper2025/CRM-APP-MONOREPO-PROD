import { useQuery } from '@tanstack/react-query';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { kycService, type KYCTaskListQuery } from '@/services/kyc';

const kycKeys = {
  all: ['kyc'] as const,
  documentTypes: () => [...kycKeys.all, 'document-types'] as const,
  tasks: (query: KYCTaskListQuery) => [...kycKeys.all, 'tasks', query] as const,
  task: (id: string) => [...kycKeys.all, 'task', id] as const,
  caseTasks: (caseId: string) => [...kycKeys.all, 'case', caseId] as const,
};

export const useKYCDocumentTypes = () => {
  return useQuery({
    queryKey: kycKeys.documentTypes(),
    queryFn: () => kycService.getDocumentTypes(),
    select: (data) => data.data || [],
    staleTime: 30 * 60 * 1000, // 30 min cache
  });
};

export const useKYCTasks = (query: KYCTaskListQuery = {}) => {
  return useQuery({
    queryKey: kycKeys.tasks(query),
    queryFn: () => kycService.listTasks(query),
    select: (response) => ({
      data: response.data || [],
      pagination: response.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
      statistics: response.statistics || {
        total: 0,
        pending: 0,
        passed: 0,
        failed: 0,
        referred: 0,
      },
    }),
  });
};

export const useKYCTaskDetail = (taskId: string) => {
  return useQuery({
    queryKey: kycKeys.task(taskId),
    queryFn: () => kycService.getTaskDetail(taskId),
    select: (data) => data.data || null,
    enabled: !!taskId,
  });
};

export const useKYCTasksForCase = (caseId: string) => {
  return useQuery({
    queryKey: kycKeys.caseTasks(caseId),
    queryFn: () => kycService.getTasksForCase(caseId),
    select: (data) => data.data || [],
    enabled: !!caseId,
  });
};

export const useVerifyKYCDocument = () => {
  return useMutationWithInvalidation({
    mutationFn: ({
      taskId,
      data,
    }: {
      taskId: string;
      data: { status: string; remarks?: string; rejectionReason?: string };
    }) => kycService.verifyDocument(taskId, data),
    invalidateKeys: [kycKeys.all],
    errorContext: 'KYC Verification',
  });
};

export const useAssignKYCTask = () => {
  return useMutationWithInvalidation({
    mutationFn: ({ taskId, assignedTo }: { taskId: string; assignedTo: string }) =>
      kycService.assignTask(taskId, assignedTo),
    invalidateKeys: [kycKeys.all],
    errorContext: 'KYC Task Assignment',
  });
};

export const useUploadKYCDocument = () => {
  return useMutationWithInvalidation({
    mutationFn: ({ taskId, file }: { taskId: string; file: File }) =>
      kycService.uploadDocument(taskId, file),
    invalidateKeys: [kycKeys.all],
    errorContext: 'KYC Document Upload',
  });
};
