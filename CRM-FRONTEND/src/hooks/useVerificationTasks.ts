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
  const assignedToId = typeof task.assigned_to === 'string' ? task.assigned_to : undefined;
  const assignedToName =
    typeof task.assigned_to_name === 'string'
      ? task.assigned_to_name
      : typeof task.assignedToName === 'string'
        ? task.assignedToName
        : undefined;
  const assignedToEmployeeId =
    typeof task.assigned_to_employee_id === 'string'
      ? task.assigned_to_employee_id
      : typeof task.assignedToEmployeeId === 'string'
        ? task.assignedToEmployeeId
        : undefined;

  return {
    ...(task as unknown as VerificationTask),
    taskNumber:
      typeof task.taskNumber === 'string'
        ? task.taskNumber
        : typeof task.task_number === 'string'
          ? task.task_number
          : '',
    caseId:
      typeof task.caseId === 'string'
        ? task.caseId
        : typeof task.case_id === 'string'
          ? task.case_id
          : '',
    caseNumber:
      typeof task.caseNumber === 'string'
        ? task.caseNumber
        : typeof task.case_number === 'string'
          ? task.case_number
          : undefined,
    customerName:
      typeof task.customerName === 'string'
        ? task.customerName
        : typeof task.customer_name === 'string'
          ? task.customer_name
          : undefined,
    verificationTypeId:
      typeof task.verificationTypeId === 'number'
        ? task.verificationTypeId
        : Number(task.verification_type_id || 0),
    verificationTypeName:
      typeof task.verificationTypeName === 'string'
        ? task.verificationTypeName
        : typeof task.verification_type_name === 'string'
          ? task.verification_type_name
          : undefined,
    taskTitle:
      typeof task.taskTitle === 'string'
        ? task.taskTitle
        : typeof task.task_title === 'string'
          ? task.task_title
          : '',
    taskDescription:
      typeof task.taskDescription === 'string'
        ? task.taskDescription
        : typeof task.task_description === 'string'
          ? task.task_description
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
      typeof task.assigned_by === 'string' && typeof task.assigned_by_name === 'string'
        ? {
            id: task.assigned_by,
            name: task.assigned_by_name,
          }
        : null,
    assignedByName:
      typeof task.assignedByName === 'string'
        ? task.assignedByName
        : typeof task.assigned_by_name === 'string'
          ? task.assigned_by_name
          : undefined,
    assignedAt:
      typeof task.assignedAt === 'string'
        ? task.assignedAt
        : typeof task.assigned_at === 'string'
          ? task.assigned_at
          : undefined,
    rateTypeId:
      typeof task.rateTypeId === 'number'
        ? task.rateTypeId
        : task.rate_type_id != null
          ? Number(task.rate_type_id)
          : undefined,
    rateTypeName:
      typeof task.rateTypeName === 'string'
        ? task.rateTypeName
        : typeof task.rate_type_name === 'string'
          ? task.rate_type_name
          : undefined,
    estimatedAmount:
      typeof task.estimatedAmount === 'number'
        ? task.estimatedAmount
        : task.estimated_amount != null
          ? Number(task.estimated_amount)
          : undefined,
    actualAmount:
      typeof task.actualAmount === 'number'
        ? task.actualAmount
        : task.actual_amount != null
          ? Number(task.actual_amount)
          : undefined,
    applicantType:
      typeof task.applicantType === 'string'
        ? task.applicantType
        : typeof task.applicant_type === 'string'
          ? task.applicant_type
          : undefined,
    documentType:
      typeof task.documentType === 'string'
        ? task.documentType
        : typeof task.document_type === 'string'
          ? task.document_type
          : undefined,
    documentNumber:
      typeof task.documentNumber === 'string'
        ? task.documentNumber
        : typeof task.document_number === 'string'
          ? task.document_number
          : undefined,
    documentDetails:
      (task.documentDetails as Record<string, unknown> | undefined) ||
      (task.document_details as Record<string, unknown> | undefined),
    estimatedCompletionDate:
      typeof task.estimatedCompletionDate === 'string'
        ? task.estimatedCompletionDate
        : typeof task.estimated_completion_date === 'string'
          ? task.estimated_completion_date
          : undefined,
    startedAt:
      typeof task.startedAt === 'string'
        ? task.startedAt
        : typeof task.started_at === 'string'
          ? task.started_at
          : undefined,
    inProgressAt:
      typeof task.inProgressAt === 'string'
        ? task.inProgressAt
        : typeof task.started_at === 'string'
          ? task.started_at
          : undefined,
    completedAt:
      typeof task.completedAt === 'string'
        ? task.completedAt
        : typeof task.completed_at === 'string'
          ? task.completed_at
          : undefined,
    commissionStatus:
      typeof task.commissionStatus === 'string'
        ? task.commissionStatus
        : typeof task.commission_status === 'string'
          ? task.commission_status
          : undefined,
    calculatedCommission:
      typeof task.calculatedCommission === 'number'
        ? task.calculatedCommission
        : task.calculated_commission != null
          ? Number(task.calculated_commission)
          : undefined,
    createdAt:
      typeof task.createdAt === 'string'
        ? task.createdAt
        : typeof task.created_at === 'string'
          ? task.created_at
          : '',
    updatedAt:
      typeof task.updatedAt === 'string'
        ? task.updatedAt
        : typeof task.updated_at === 'string'
          ? task.updated_at
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
          typeof response.data.case_id === 'string' ? response.data.case_id : caseId,
        caseNumber:
          typeof response.data.case_number === 'string' ? response.data.case_number : '',
        customerName:
          typeof response.data.customer_name === 'string' ? response.data.customer_name : '',
        totalTasks:
          typeof response.data.total_tasks === 'number' ? response.data.total_tasks : 0,
        completedTasks:
          typeof response.data.completed_tasks === 'number' ? response.data.completed_tasks : 0,
        completionPercentage:
          typeof response.data.completion_percentage === 'number'
            ? response.data.completion_percentage
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
      return response.data;
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
