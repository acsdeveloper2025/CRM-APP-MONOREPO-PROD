import { apiService } from './api';
import {
  VerificationTask,
  CreateVerificationTaskRequest,
  UpdateVerificationTaskRequest,
  AssignVerificationTaskRequest,
  CompleteVerificationTaskRequest,
  VerificationTaskFilters,
  VerificationTaskResponse,
  TasksForCaseResponse,
  CreateMultipleTasksResponse,
  CreateCaseWithMultipleTasksRequest,
  CreateCaseWithMultipleTasksResponse,
  CaseSummaryResponse,
  CreateTasksFromTemplateRequest
} from '../types/verificationTask';

/**
 * Verification Tasks Service
 * Handles all API calls related to verification tasks
 */
export class VerificationTasksService {

  /**
   * Get all verification tasks across all cases with filtering
   */
  static async getAllTasks(filters?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    status?: string;
    priority?: string;
    assignedTo?: string;
    verificationTypeId?: number;
    clientId?: number;
    productId?: number;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    success: boolean;
    data: {
      tasks: VerificationTask[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
      statistics: {
        pending: number;
        assigned: number;
        inProgress: number;
        completed: number;
        cancelled: number;
        onHold: number;
        urgent: number;
        highPriority: number;
      };
    };
    message: string;
  }> {
    const params = new URLSearchParams();

    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.assignedTo) params.append('assignedTo', filters.assignedTo);
    if (filters?.verificationTypeId) params.append('verificationTypeId', filters.verificationTypeId.toString());
    if (filters?.clientId) params.append('clientId', filters.clientId.toString());
    if (filters?.productId) params.append('productId', filters.productId.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);

    const response = await apiService.get(`/verification-tasks?${params.toString()}`);
    return response as any;
  }

  /**
   * Create multiple verification tasks for a case
   */
  static async createMultipleTasksForCase(
    caseId: string,
    tasks: CreateVerificationTaskRequest[]
  ): Promise<CreateMultipleTasksResponse> {
    const response = await apiService.post(`/cases/${caseId}/verification-tasks`, {
      tasks
    });
    return response.data;
  }

  /**
   * Get all verification tasks for a case
   */
  static async getTasksForCase(
    caseId: string,
    filters?: VerificationTaskFilters
  ): Promise<TasksForCaseResponse> {
    const params = new URLSearchParams();

    if (filters?.status) params.append('status', filters.status);
    if (filters?.assignedTo) params.append('assigned_to', filters.assignedTo);
    if (filters?.verificationTypeId) params.append('verification_type_id', filters.verificationTypeId.toString());
    if (filters?.priority) params.append('priority', filters.priority);

    const response = await apiService.get(`/cases/${caseId}/verification-tasks?${params.toString()}`);
    // apiService.get returns { success, data, message }
    // We return the full response to match TasksForCaseResponse type
    return response as TasksForCaseResponse;
  }

  /**
   * Get a single verification task by ID
   */
  static async getTaskById(taskId: string): Promise<VerificationTaskResponse> {
    const response = await apiService.get(`/verification-tasks/${taskId}`);
    return response.data;
  }

  /**
   * Update a verification task
   */
  static async updateTask(
    taskId: string,
    updateData: UpdateVerificationTaskRequest
  ): Promise<VerificationTaskResponse> {
    const response = await apiService.put(`/verification-tasks/${taskId}`, updateData);
    return response.data;
  }

  /**
   * Assign or reassign a verification task
   */
  static async assignTask(
    taskId: string,
    assignmentData: AssignVerificationTaskRequest
  ): Promise<VerificationTaskResponse> {
    // Transform camelCase to snake_case for backend
    const backendData = {
      assigned_to: assignmentData.assignedTo,
      assignment_reason: assignmentData.assignmentReason,
      priority: assignmentData.priority
    };
    const response = await apiService.post(`/verification-tasks/${taskId}/assign`, backendData);
    return response.data;
  }

  /**
   * Complete a verification task
   */
  static async completeTask(
    taskId: string,
    completionData: CompleteVerificationTaskRequest
  ): Promise<VerificationTaskResponse> {
    // Transform camelCase to snake_case for backend
    const backendData = {
      verification_outcome: completionData.verificationOutcome,
      actual_amount: completionData.actualAmount,
      completion_notes: completionData.completionNotes,
      form_submission_id: completionData.formSubmissionId
    };
    const response = await apiService.post(`/verification-tasks/${taskId}/complete`, backendData);
    return response.data;
  }

  /**
   * Start working on a verification task
   */
  static async startTask(taskId: string): Promise<VerificationTaskResponse> {
    const response = await apiService.post(`/verification-tasks/${taskId}/start`);
    return response.data;
  }

  /**
   * Cancel a verification task
   */
  static async cancelTask(
    taskId: string, 
    cancellationReason?: string
  ): Promise<VerificationTaskResponse> {
    const response = await apiService.post(`/verification-tasks/${taskId}/cancel`, {
      cancellation_reason: cancellationReason
    });
    return response.data;
  }

  /**
   * Bulk assign multiple tasks
   */
  static async bulkAssignTasks(
    taskIds: string[],
    assignedTo: string,
    assignmentReason?: string
  ): Promise<{ success: boolean; data: { updated_tasks: number; tasks: VerificationTask[] }; message: string }> {
    const response = await apiService.post('/verification-tasks/bulk-assign', {
      task_ids: taskIds,
      assigned_to: assignedTo,
      assignment_reason: assignmentReason
    });
    return response.data;
  }

  /**
   * Get task assignment history
   */
  static async getTaskAssignmentHistory(taskId: string): Promise<{
    success: boolean;
    data: Array<{
      id: string;
      assignedFrom?: string;
      assignedTo: string;
      assignedBy: string;
      assignmentReason?: string;
      assignedAt: string;
      assignedToName?: string;
      assignedByName?: string;
      assignedFromName?: string;
    }>;
    message: string;
  }> {
    const response = await apiService.get(`/verification-tasks/${taskId}/assignment-history`);
    return response.data;
  }

  /**
   * Get tasks assigned to current user (for mobile/field users)
   */
  static async getMyTasks(filters?: {
    status?: string;
    priority?: string;
  }): Promise<{
    success: boolean;
    data: {
      tasks: Array<{
        id: string;
        taskNumber: string;
        caseId: string;
        caseNumber: string;
        customerName: string;
        taskTitle: string;
        verificationType: string;
        status: string;
        priority: string;
        address?: string;
        estimatedAmount?: number;
        assignedAt: string;
        estimatedCompletionDate?: string;
      }>;
      summary: {
        totalAssigned: number;
        pending: number;
        inProgress: number;
        completedToday: number;
        completedThisWeek: number;
        totalEarnings: number;
        pendingCommission: number;
      };
    };
    message: string;
  }> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);

    const response = await apiService.get(`/mobile/my-verification-tasks?${params.toString()}`);
    return response.data;
  }

  /**
   * Submit verification for a task (mobile)
   */
  static async submitTaskVerification(
    taskId: string,
    submissionData: {
      verification_outcome: string;
      form_data?: Record<string, any>;
      attachments?: string[];
      geo_location?: {
        latitude: number;
        longitude: number;
        accuracy?: number;
      };
      actual_amount?: number;
    }
  ): Promise<VerificationTaskResponse> {
    const response = await apiService.post(`/mobile/verification-tasks/${taskId}/submit`, submissionData);
    return response.data;
  }
}

/**
 * Enhanced Cases Service
 * Handles case operations with multi-verification support
 */
export class EnhancedCasesService {
  
  /**
   * Create case with multiple verification tasks
   * Uses unified /cases/create endpoint
   */
  static async createCaseWithMultipleTasks(
    caseData: CreateCaseWithMultipleTasksRequest
  ): Promise<CreateCaseWithMultipleTasksResponse> {
    const response = await apiService.post('/cases/create', caseData);
    return response.data;
  }

  /**
   * Get case summary with verification tasks
   */
  static async getCaseSummaryWithTasks(caseId: string): Promise<CaseSummaryResponse> {
    const response = await apiService.get(`/cases/${caseId}/summary`);
    return response.data;
  }

  /**
   * Create tasks from template
   */
  static async createTasksFromTemplate(
    templateData: CreateTasksFromTemplateRequest
  ): Promise<CreateMultipleTasksResponse> {
    const response = await apiService.post(
      `/cases/${templateData.caseId}/verification-tasks/from-template`,
      templateData
    );
    return response.data;
  }
}

/**
 * Task Templates Service
 * Handles verification task templates
 */
export class TaskTemplatesService {
  
  /**
   * Get available task templates
   */
  static async getAvailableTemplates(): Promise<{
    success: boolean;
    data: Array<{
      id: number;
      name: string;
      description?: string;
      category: string;
      estimatedTotalCost?: number;
      estimatedDurationDays?: number;
      tasks: Array<{
        taskType: string;
        priority: string;
        title: string;
        description?: string;
        estimatedAmount?: number;
        requiresLocation?: boolean;
        requiresDocuments?: boolean;
      }>;
    }>;
    message: string;
  }> {
    const response = await apiService.get('/verification-task-templates');
    return response.data;
  }

  /**
   * Create tasks from template
   */
  static async createTasksFromTemplate(
    caseId: string,
    templateId: number,
    customizations?: {
      defaultAssignedTo?: string;
      priorityOverride?: string;
      address?: string;
      pincode?: string;
      estimatedCompletionDate?: string;
    }
  ): Promise<CreateMultipleTasksResponse> {
    const response = await apiService.post(`/cases/${caseId}/verification-tasks/from-template`, {
      template_id: templateId,
      customizations
    });
    return response.data;
  }
}

/**
 * Task Commission Service
 * Handles commission-related operations for tasks
 */
export class TaskCommissionService {
  
  /**
   * Calculate commission for completed task
   */
  static async calculateTaskCommission(taskId: string): Promise<{
    success: boolean;
    data: {
      taskId: string;
      taskNumber: string;
      commissionCalculation: {
        id: string;
        baseAmount: number;
        commissionAmount: number;
        calculatedCommission: number;
        calculationMethod: string;
        status: string;
        userId: string;
        userName: string;
      };
    };
    message: string;
  }> {
    const response = await apiService.post(`/verification-tasks/${taskId}/calculate-commission`);
    return response.data;
  }

  /**
   * Get task commission history
   */
  static async getTaskCommissionHistory(taskId: string): Promise<{
    success: boolean;
    data: Array<{
      id: string;
      calculatedCommission: number;
      status: string;
      calculationDate: string;
      approvedAt?: string;
      paidAt?: string;
    }>;
    message: string;
  }> {
    const response = await apiService.get(`/verification-tasks/${taskId}/commission-history`);
    return response.data;
  }

  /**
   * Bulk calculate commissions for all completed tasks in a case
   */
  static async bulkCalculateCommissions(caseId: string): Promise<{
    success: boolean;
    data: {
      caseId: string;
      calculatedTasks: number;
      totalCommission: number;
    };
    message: string;
  }> {
    const response = await apiService.post(`/cases/${caseId}/calculate-all-commissions`);
    return response.data;
  }
}
