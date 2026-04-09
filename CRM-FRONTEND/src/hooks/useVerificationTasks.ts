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

const normalizeTaskForUi = (task: Record<string, unknown>): VerificationTask => {
  const assignedToId = typeof task.assignedTo === 'string' ? task.assignedTo : undefined;
  const assignedToName =
    typeof task.assignedToName === 'string'
      ? task.assignedToName
      : typeof task.assignedToName === 'string'
        ? task.assignedToName
        : undefined;
  const assignedToEmployeeId =
    typeof task.assignedToEmployeeId === 'string'
      ? task.assignedToEmployeeId
      : typeof task.assignedToEmployeeId === 'string'
        ? task.assignedToEmployeeId
        : undefined;

  return {
    ...(task as unknown as VerificationTask),
    taskNumber:
      typeof task.taskNumber === 'string'
        ? task.taskNumber
        : typeof task.taskNumber === 'string'
          ? task.taskNumber
          : '',
    caseId:
      typeof task.caseId === 'string'
        ? task.caseId
        : typeof task.caseId === 'string'
          ? task.caseId
          : '',
    caseNumber:
      typeof task.caseNumber === 'string'
        ? task.caseNumber
        : typeof task.caseNumber === 'string' || typeof task.caseNumber === 'number'
          ? String(task.caseNumber)
          : undefined,
    customerName:
      typeof task.customerName === 'string'
        ? task.customerName
        : typeof task.customerName === 'string'
          ? task.customerName
          : undefined,
    verificationTypeId:
      typeof task.verificationTypeId === 'number'
        ? task.verificationTypeId
        : Number(task.verificationTypeId || 0),
    verificationTypeName:
      typeof task.verificationTypeName === 'string'
        ? task.verificationTypeName
        : typeof task.verificationTypeName === 'string'
          ? task.verificationTypeName
          : undefined,
    taskTitle:
      typeof task.taskTitle === 'string'
        ? task.taskTitle
        : typeof task.taskTitle === 'string'
          ? task.taskTitle
          : '',
    taskDescription:
      typeof task.taskDescription === 'string'
        ? task.taskDescription
        : typeof task.taskDescription === 'string'
          ? task.taskDescription
          : undefined,
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
        ? {
            id: task.assignedBy,
            name: task.assignedByName,
          }
        : null,
    assignedByName:
      typeof task.assignedByName === 'string'
        ? task.assignedByName
        : typeof task.assignedByName === 'string'
          ? task.assignedByName
          : undefined,
    assignedAt:
      typeof task.assignedAt === 'string'
        ? task.assignedAt
        : typeof task.assignedAt === 'string'
          ? task.assignedAt
          : undefined,
    taskType:
      task.taskType === 'REVISIT' || task.taskType === 'REVISIT' ? 'REVISIT' : null,
    parentTaskId:
      typeof task.parentTaskId === 'string'
        ? task.parentTaskId
        : typeof task.parentTaskId === 'string'
          ? task.parentTaskId
          : null,
    rateTypeId:
      typeof task.rateTypeId === 'number'
        ? task.rateTypeId
        : task.rateTypeId != null
          ? Number(task.rateTypeId)
          : undefined,
    rateTypeName:
      typeof task.rateTypeName === 'string'
        ? task.rateTypeName
        : typeof task.rateTypeName === 'string'
          ? task.rateTypeName
          : undefined,
    estimatedAmount:
      typeof task.estimatedAmount === 'number'
        ? task.estimatedAmount
        : task.estimatedAmount != null
          ? Number(task.estimatedAmount)
          : undefined,
    actualAmount:
      typeof task.actualAmount === 'number'
        ? task.actualAmount
        : task.actualAmount != null
          ? Number(task.actualAmount)
          : undefined,
    applicantType:
      typeof task.applicantType === 'string'
        ? task.applicantType
        : typeof task.applicantType === 'string'
          ? task.applicantType
          : undefined,
    documentType:
      typeof task.documentType === 'string'
        ? task.documentType
        : typeof task.documentType === 'string'
          ? task.documentType
          : undefined,
    documentNumber:
      typeof task.documentNumber === 'string'
        ? task.documentNumber
        : typeof task.documentNumber === 'string'
          ? task.documentNumber
          : undefined,
    documentDetails:
      (task.documentDetails as Record<string, unknown> | undefined) ||
      (task.documentDetails as Record<string, unknown> | undefined),
    estimatedCompletionDate:
      typeof task.estimatedCompletionDate === 'string'
        ? task.estimatedCompletionDate
        : typeof task.estimatedCompletionDate === 'string'
          ? task.estimatedCompletionDate
          : undefined,
    startedAt:
      typeof task.startedAt === 'string'
        ? task.startedAt
        : typeof task.startedAt === 'string'
          ? task.startedAt
          : undefined,
    inProgressAt:
      typeof task.inProgressAt === 'string'
        ? task.inProgressAt
        : typeof task.startedAt === 'string'
          ? task.startedAt
          : undefined,
    completedAt:
      typeof task.completedAt === 'string'
        ? task.completedAt
        : typeof task.completedAt === 'string'
          ? task.completedAt
          : undefined,
    commissionStatus:
      typeof task.commissionStatus === 'string'
        ? task.commissionStatus
        : typeof task.commissionStatus === 'string'
          ? task.commissionStatus
          : undefined,
    calculatedCommission:
      typeof task.calculatedCommission === 'number'
        ? task.calculatedCommission
        : task.calculatedCommission != null
          ? Number(task.calculatedCommission)
          : undefined,
    createdAt:
      typeof task.createdAt === 'string'
        ? task.createdAt
        : typeof task.createdAt === 'string'
          ? task.createdAt
          : '',
    updatedAt:
      typeof task.updatedAt === 'string'
        ? task.updatedAt
        : typeof task.updatedAt === 'string'
          ? task.updatedAt
          : '',
  };
};

export const useVerificationTasks = (caseId: string) => {
  return useQuery({
    queryKey: ['verification-tasks', caseId],
    queryFn: async () => {
      const response = await api.get<TasksForCaseResponse['data']>(`/cases/${caseId}/verification-tasks`);
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
