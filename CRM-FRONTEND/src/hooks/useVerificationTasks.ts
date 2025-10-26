import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  VerificationTask,
  CreateVerificationTaskRequest,
  UpdateVerificationTaskRequest,
  AssignVerificationTaskRequest,
  CompleteVerificationTaskRequest,
  VerificationTaskFilters,
  TaskStatus,
  TaskPriority
} from '../types/verificationTask';
import { VerificationTasksService } from '../services/verificationTasks';

/**
 * Transform snake_case task data from backend to camelCase for frontend
 */
function transformTaskData(task: any): VerificationTask {
  return {
    id: task.id,
    taskNumber: task.task_number,
    caseId: task.case_id,
    verificationTypeId: task.verification_type_id,
    verificationTypeName: task.verification_type_name,
    taskTitle: task.task_title,
    taskDescription: task.task_description,
    priority: task.priority,
    assignedTo: task.assigned_to,
    assignedToName: task.assigned_to_name,
    assignedToEmployeeId: task.assigned_to_employee_id,
    assignedBy: task.assigned_by,
    assignedByName: task.assigned_by_name,
    assignedAt: task.assigned_at,
    status: task.status,
    verificationOutcome: task.verification_outcome,
    rateTypeId: task.rate_type_id,
    rateTypeName: task.rate_type_name,
    estimatedAmount: task.estimated_amount,
    actualAmount: task.actual_amount,
    address: task.address,
    pincode: task.pincode,
    latitude: task.latitude,
    longitude: task.longitude,
    trigger: task.trigger,
    applicantType: task.applicant_type,
    documentType: task.document_type,
    documentNumber: task.document_number,
    documentDetails: task.document_details,
    estimatedCompletionDate: task.estimated_completion_date,
    startedAt: task.started_at,
    completedAt: task.completed_at,
    commissionStatus: task.commission_status,
    calculatedCommission: task.calculated_commission,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    createdBy: task.created_by,
    caseNumber: task.case_number,
    customerName: task.customer_name
  };
}

interface UseVerificationTasksState {
  tasks: VerificationTask[];
  loading: boolean;
  error: string | null;
  selectedTasks: string[];
  filters: VerificationTaskFilters;
  summary: {
    totalTasks: number;
    completedTasks: number;
    completionPercentage: number;
  };
}

interface UseVerificationTasksActions {
  // Data fetching
  fetchTasksForCase: (caseId: string) => Promise<void>;
  fetchTaskById: (taskId: string) => Promise<VerificationTask | null>;
  refreshTasks: () => Promise<void>;
  
  // Task management
  createMultipleTasks: (caseId: string, tasks: CreateVerificationTaskRequest[]) => Promise<boolean>;
  updateTask: (taskId: string, updateData: UpdateVerificationTaskRequest) => Promise<boolean>;
  assignTask: (taskId: string, assignmentData: AssignVerificationTaskRequest) => Promise<boolean>;
  completeTask: (taskId: string, completionData: CompleteVerificationTaskRequest) => Promise<boolean>;
  startTask: (taskId: string) => Promise<boolean>;
  cancelTask: (taskId: string, reason?: string) => Promise<boolean>;
  
  // Bulk operations
  bulkAssignTasks: (taskIds: string[], assignedTo: string, reason?: string) => Promise<boolean>;
  selectTask: (taskId: string) => void;
  selectAllTasks: () => void;
  clearSelection: () => void;
  
  // Filtering and sorting
  setFilters: (filters: Partial<VerificationTaskFilters>) => void;
  clearFilters: () => void;
  filterTasksByStatus: (status: TaskStatus) => VerificationTask[];
  filterTasksByPriority: (priority: TaskPriority) => VerificationTask[];
  
  // Utility functions
  getTasksByStatus: (status: TaskStatus) => VerificationTask[];
  getTasksByAssignee: (userId: string) => VerificationTask[];
  calculateProgress: () => { completed: number; total: number; percentage: number };
}

export function useVerificationTasks(initialCaseId?: string): UseVerificationTasksState & UseVerificationTasksActions {
  const [state, setState] = useState<UseVerificationTasksState>({
    tasks: [],
    loading: false,
    error: null,
    selectedTasks: [],
    filters: {},
    summary: {
      totalTasks: 0,
      completedTasks: 0,
      completionPercentage: 0
    }
  });

  const [currentCaseId, setCurrentCaseId] = useState<string | undefined>(initialCaseId);

  // Update summary when tasks change
  useEffect(() => {
    const totalTasks = state.tasks.length;
    const completedTasks = state.tasks.filter(task => task.status === 'COMPLETED').length;
    const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    setState(prev => ({
      ...prev,
      summary: {
        totalTasks,
        completedTasks,
        completionPercentage
      }
    }));
  }, [state.tasks]);

  // Fetch tasks for a case
  const fetchTasksForCase = useCallback(async (caseId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    setCurrentCaseId(caseId);

    try {
      const response = await VerificationTasksService.getTasksForCase(caseId, state.filters);
      console.log('📥 Verification tasks response:', response);

      // Response structure: { success, data: { case_id, tasks: [...] }, message }
      // Transform snake_case data from backend to camelCase
      const tasksData = response.data.tasks || [];
      console.log('📋 Tasks data (snake_case from backend):', tasksData.length, 'tasks');
      if (tasksData.length > 0) {
        console.log('📋 First task sample:', tasksData[0]);
      }

      const transformedTasks = tasksData.map(transformTaskData);
      console.log('✅ Transformed tasks (camelCase for frontend):', transformedTasks.length, 'tasks');
      if (transformedTasks.length > 0) {
        console.log('✅ First transformed task sample:', transformedTasks[0]);
      }

      setState(prev => ({
        ...prev,
        tasks: transformedTasks,
        loading: false
      }));
    } catch (error: any) {
      console.error('❌ Error fetching verification tasks:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch tasks';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false
      }));
      toast.error(errorMessage);
    }
  }, [state.filters]);

  // Fetch single task by ID
  const fetchTaskById = useCallback(async (taskId: string): Promise<VerificationTask | null> => {
    try {
      const response = await VerificationTasksService.getTaskById(taskId);
      // Transform the task data from snake_case to camelCase
      return response.data ? transformTaskData(response.data) : null;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch task';
      toast.error(errorMessage);
      return null;
    }
  }, []);

  // Refresh current tasks
  const refreshTasks = useCallback(async () => {
    if (currentCaseId) {
      await fetchTasksForCase(currentCaseId);
    }
  }, [currentCaseId, fetchTasksForCase]);

  // Create multiple tasks
  const createMultipleTasks = useCallback(async (
    caseId: string, 
    tasks: CreateVerificationTaskRequest[]
  ): Promise<boolean> => {
    setState(prev => ({ ...prev, loading: true }));

    try {
      const response = await VerificationTasksService.createMultipleTasksForCase(caseId, tasks);
      toast.success(response.message);
      
      // Refresh tasks if this is the current case
      if (caseId === currentCaseId) {
        await fetchTasksForCase(caseId);
      }
      
      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to create tasks';
      toast.error(errorMessage);
      setState(prev => ({ ...prev, loading: false }));
      return false;
    }
  }, [currentCaseId, fetchTasksForCase]);

  // Update task
  const updateTask = useCallback(async (
    taskId: string, 
    updateData: UpdateVerificationTaskRequest
  ): Promise<boolean> => {
    try {
      const response = await VerificationTasksService.updateTask(taskId, updateData);
      toast.success(response.message);
      
      // Update task in local state
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(task => 
          task.id === taskId ? { ...task, ...updateData } : task
        )
      }));
      
      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to update task';
      toast.error(errorMessage);
      return false;
    }
  }, []);

  // Assign task
  const assignTask = useCallback(async (
    taskId: string, 
    assignmentData: AssignVerificationTaskRequest
  ): Promise<boolean> => {
    try {
      const response = await VerificationTasksService.assignTask(taskId, assignmentData);
      toast.success(response.message);
      
      // Update task in local state
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(task => 
          task.id === taskId 
            ? { 
                ...task, 
                assignedTo: assignmentData.assignedTo,
                status: 'ASSIGNED' as TaskStatus,
                assignedAt: new Date().toISOString()
              } 
            : task
        )
      }));
      
      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to assign task';
      toast.error(errorMessage);
      return false;
    }
  }, []);

  // Complete task
  const completeTask = useCallback(async (
    taskId: string, 
    completionData: CompleteVerificationTaskRequest
  ): Promise<boolean> => {
    try {
      const response = await VerificationTasksService.completeTask(taskId, completionData);
      toast.success(response.message);
      
      // Update task in local state
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(task => 
          task.id === taskId 
            ? { 
                ...task, 
                status: 'COMPLETED' as TaskStatus,
                verificationOutcome: completionData.verificationOutcome,
                actualAmount: completionData.actualAmount,
                completedAt: new Date().toISOString()
              } 
            : task
        )
      }));
      
      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to complete task';
      toast.error(errorMessage);
      return false;
    }
  }, []);

  // Start task
  const startTask = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      const response = await VerificationTasksService.startTask(taskId);
      toast.success('Task started successfully');
      
      // Update task in local state
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(task => 
          task.id === taskId 
            ? { 
                ...task, 
                status: 'IN_PROGRESS' as TaskStatus,
                startedAt: new Date().toISOString()
              } 
            : task
        )
      }));
      
      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to start task';
      toast.error(errorMessage);
      return false;
    }
  }, []);

  // Cancel task
  const cancelTask = useCallback(async (taskId: string, reason?: string): Promise<boolean> => {
    try {
      const response = await VerificationTasksService.cancelTask(taskId, reason);
      toast.success(response.message);
      
      // Update task in local state
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(task => 
          task.id === taskId 
            ? { ...task, status: 'CANCELLED' as TaskStatus } 
            : task
        )
      }));
      
      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to cancel task';
      toast.error(errorMessage);
      return false;
    }
  }, []);

  // Bulk assign tasks
  const bulkAssignTasks = useCallback(async (
    taskIds: string[], 
    assignedTo: string, 
    reason?: string
  ): Promise<boolean> => {
    try {
      const response = await VerificationTasksService.bulkAssignTasks(taskIds, assignedTo, reason);
      toast.success(response.message);
      
      // Update tasks in local state
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(task => 
          taskIds.includes(task.id)
            ? { 
                ...task, 
                assignedTo,
                status: 'ASSIGNED' as TaskStatus,
                assignedAt: new Date().toISOString()
              } 
            : task
        ),
        selectedTasks: [] // Clear selection after bulk operation
      }));
      
      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to assign tasks';
      toast.error(errorMessage);
      return false;
    }
  }, []);

  // Selection management
  const selectTask = useCallback((taskId: string) => {
    setState(prev => ({
      ...prev,
      selectedTasks: prev.selectedTasks.includes(taskId)
        ? prev.selectedTasks.filter(id => id !== taskId)
        : [...prev.selectedTasks, taskId]
    }));
  }, []);

  const selectAllTasks = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedTasks: prev.tasks.map(task => task.id)
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setState(prev => ({ ...prev, selectedTasks: [] }));
  }, []);

  // Filtering
  const setFilters = useCallback((newFilters: Partial<VerificationTaskFilters>) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters }
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setState(prev => ({ ...prev, filters: {} }));
  }, []);

  // Utility functions
  const filterTasksByStatus = useCallback((status: TaskStatus) => {
    return state.tasks.filter(task => task.status === status);
  }, [state.tasks]);

  const filterTasksByPriority = useCallback((priority: TaskPriority) => {
    return state.tasks.filter(task => task.priority === priority);
  }, [state.tasks]);

  const getTasksByStatus = useCallback((status: TaskStatus) => {
    return state.tasks.filter(task => task.status === status);
  }, [state.tasks]);

  const getTasksByAssignee = useCallback((userId: string) => {
    return state.tasks.filter(task => task.assignedTo === userId);
  }, [state.tasks]);

  const calculateProgress = useCallback(() => {
    const total = state.tasks.length;
    const completed = state.tasks.filter(task => task.status === 'COMPLETED').length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    
    return { completed, total, percentage };
  }, [state.tasks]);

  // Auto-fetch tasks on mount if caseId is provided
  useEffect(() => {
    if (initialCaseId) {
      fetchTasksForCase(initialCaseId);
    }
  }, [initialCaseId, fetchTasksForCase]);

  return {
    // State
    ...state,

    // Actions
    fetchTasksForCase,
    fetchTaskById,
    refreshTasks,
    createMultipleTasks,
    updateTask,
    assignTask,
    completeTask,
    startTask,
    cancelTask,
    bulkAssignTasks,
    selectTask,
    selectAllTasks,
    clearSelection,
    setFilters,
    clearFilters,
    filterTasksByStatus,
    filterTasksByPriority,
    getTasksByStatus,
    getTasksByAssignee,
    calculateProgress
  };
}

/**
 * Hook for fetching all verification tasks across all cases
 * Used for task-centric views (Pending Tasks, In Progress Tasks, All Tasks)
 */
export function useAllVerificationTasks(filters?: {
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
}) {
  const [tasks, setTasks] = useState<VerificationTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [statistics, setStatistics] = useState({
    pending: 0,
    assigned: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    onHold: 0,
    urgent: 0,
    highPriority: 0
  });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await VerificationTasksService.getAllTasks(filters);

      // Transform tasks from snake_case to camelCase
      const transformedTasks = response.data.tasks.map(transformTaskData);

      setTasks(transformedTasks);
      setPagination(response.data.pagination);
      setStatistics(response.data.statistics);
      setLoading(false);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch tasks';
      setError(errorMessage);
      setLoading(false);
      toast.error(errorMessage);
    }
  }, [filters]);

  // Fetch tasks when filters change
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const refreshTasks = useCallback(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    pagination,
    statistics,
    refreshTasks
  };
}
