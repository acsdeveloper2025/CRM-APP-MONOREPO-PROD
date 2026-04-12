import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService as api } from '@/services/api';
import { VerificationTasksService } from '@/services/verificationTasks';
import type {
  AssignVerificationTaskRequest,
  CreateVerificationTaskRequest,
  TasksForCaseResponse,
  UpdateVerificationTaskRequest,
  VerificationTask,
  VerificationTaskListResponse,
} from '@/types/verificationTask';

// Helper: coerce to string or return fallback.
const str = (v: unknown, fallback?: string): string | undefined =>
  typeof v === 'string' ? v : fallback;
const strReq = (v: unknown, fallback: string): string =>
  typeof v === 'string' ? v : fallback;
const num = (v: unknown): number | undefined =>
  typeof v === 'number' ? v : v != null ? Number(v) : undefined;

/**
 * Normalize a raw task record from the backend into the typed
 * VerificationTask shape the UI components expect.
 *
 * Cleaned up: the prior implementation had ~30 redundant duplicate
 * ternaries (same typeof check repeated in both branches, so the
 * second branch was dead code) and a broken `taskType` normalizer
 * that dropped every value except 'REVISIT'.
 */
const normalizeTaskForUi = (task: Record<string, unknown>): VerificationTask => {
  const assignedToId = str(task.assignedTo);
  const assignedToName = str(task.assignedToName);
  const assignedToEmployeeId = str(task.assignedToEmployeeId);

  return {
    ...(task as unknown as VerificationTask),
    // Identity
    taskNumber: strReq(task.taskNumber, ''),
    caseId: strReq(task.caseId, ''),
    caseNumber:
      typeof task.caseNumber === 'string' || typeof task.caseNumber === 'number'
        ? String(task.caseNumber)
        : undefined,
    customerName: str(task.customerName),
    // Classification
    verificationTypeId:
      typeof task.verificationTypeId === 'number'
        ? task.verificationTypeId
        : Number(task.verificationTypeId || 0),
    verificationTypeName: str(task.verificationTypeName),
    taskTitle: strReq(task.taskTitle, ''),
    taskDescription: str(task.taskDescription),
    // Assignment — reshape flat fields into nested object for UI
    assignedTo:
      assignedToId || assignedToName
        ? {
            id: assignedToId || '',
            name: assignedToName || 'Unassigned',
            employeeId: assignedToEmployeeId,
          }
        : null,
    assignedToName,
    assignedToEmployeeId,
    assignedBy:
      typeof task.assignedBy === 'string' && typeof task.assignedByName === 'string'
        ? { id: task.assignedBy as string, name: task.assignedByName as string }
        : null,
    assignedByName: str(task.assignedByName),
    assignedAt: str(task.assignedAt),
    // Task type — preserve all values, not just REVISIT
    taskType: typeof task.taskType === 'string' ? task.taskType : null,
    parentTaskId: str(task.parentTaskId) ?? null,
    // Financial
    rateTypeId: num(task.rateTypeId),
    rateTypeName: str(task.rateTypeName),
    estimatedAmount: num(task.estimatedAmount),
    actualAmount: num(task.actualAmount),
    // Applicant / document
    applicantType: str(task.applicantType),
    documentType: str(task.documentType),
    documentNumber: str(task.documentNumber),
    documentDetails: (task.documentDetails as Record<string, unknown> | undefined) || undefined,
    // Dates
    estimatedCompletionDate: str(task.estimatedCompletionDate),
    startedAt: str(task.startedAt),
    inProgressAt: str(task.inProgressAt) ?? str(task.startedAt),
    completedAt: str(task.completedAt),
    createdAt: strReq(task.createdAt, ''),
    updatedAt: strReq(task.updatedAt, ''),
    // Commission
    commissionStatus: str(task.commissionStatus),
    calculatedCommission: num(task.calculatedCommission),
  };
};

export const useVerificationTasks = (caseId: string) => {
  return useQuery({
    queryKey: ['verification-tasks', caseId],
    queryFn: async () => {
      // Exclude KYC tasks — they are shown in a separate "KYC Tasks"
      // tab on the case detail page via useKYCTasksForCase.
      const response = await api.get<TasksForCaseResponse['data']>(
        `/cases/${caseId}/verification-tasks`,
        { excludeTaskType: 'KYC' }
      );
      return {
        caseId:
          typeof response.data.caseId === 'string' ? response.data.caseId : caseId,
        caseNumber:
          typeof response.data.caseNumber === 'string' || typeof response.data.caseNumber === 'number'
            ? String(response.data.caseNumber)
            : '',
        customerName:
          typeof response.data.customerName === 'string' ? response.data.customerName : '',
        totalTasks:
          typeof response.data.totalTasks === 'number' ? response.data.totalTasks : 0,
        completedTasks:
          typeof response.data.completedTasks === 'number' ? response.data.completedTasks : 0,
        completionPercentage:
          typeof response.data.completionPercentage === 'number'
            ? response.data.completionPercentage
            : 0,
        tasks: Array.isArray(response.data.tasks)
          ? response.data.tasks.map((task) => normalizeTaskForUi(task as unknown as Record<string, unknown>))
          : [],
      };
    },
    enabled: !!caseId,
  });
};

export const useVerificationTask = (taskId: string) => {
  return useQuery({
    queryKey: ['verification-task', taskId],
    queryFn: async () => {
      const response = await VerificationTasksService.getTaskById(taskId);
      return response.data ?? response ?? null;
    },
    enabled: !!taskId,
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

export const useAssignVerificationTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: AssignVerificationTaskRequest }) => {
      const response = await VerificationTasksService.assignTask(taskId, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-verification-tasks'] });
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
      const response = await api.get<VerificationTaskListResponse>('/verification-tasks', filters);
      return response.data;
    },
  });

  return {
    tasks: data?.tasks || [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    pagination: data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
    statistics: data?.statistics || { 
      pending: 0, 
      assigned: 0, 
      completed: 0, 
      inProgress: 0, 
      urgent: 0, 
      revoked: 0, 
      onHold: 0, 
      highPriority: 0,
      totalAgents: 0,
      longRunning: 0,
      avgDuration: 0,
      completedToday: 0
    },
    refreshTasks: refetch,
  };
};
