// =====================================================
// FRONTEND VERIFICATION TASK TYPES
// =====================================================
// Type definitions for the multi-verification task system (Frontend)

export interface VerificationTask {
  id: string;
  taskNumber: string;
  caseId: string;
  
  // Task Details
  verificationTypeId: number;
  verificationTypeName?: string;
  taskTitle: string;
  taskDescription?: string;
  priority: TaskPriority;
  
  // Assignment Details
  assignedTo?: {
    id: string;
    name: string;
    employeeId?: string;
  } | null;
  assignedToName?: string; // Keep for backward compatibility if needed
  assignedToEmployeeId?: string;
  assignedBy?: {
    id: string;
    name: string;
  } | null;
  assignedByName?: string;
  assignedAt?: string;
  
  // Status and Progress
  status: TaskStatus;
  verificationOutcome?: string;
  
  // Billing Information
  rateTypeId?: number;
  rateTypeName?: string;
  estimatedAmount?: number;
  actualAmount?: number;
  
  // Location and Address (for address verification tasks)
  address?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;

  // Task Context
  trigger?: string;
  applicantType?: string;

  // Document Information (for document verification tasks)
  documentType?: string;
  documentNumber?: string;
  documentDetails?: Record<string, any>;
  
  // Timing and Completion
  estimatedCompletionDate?: string;
  startedAt?: string;
  completedAt?: string;

  // Revocation Fields (field agent initiated)
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;

  // Cancellation Fields (backend user initiated)
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;

  // Commission Information
  commissionStatus?: CommissionStatus;
  calculatedCommission?: number;

  // Audit Fields
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  
  // Case Information (populated)
  caseNumber?: string;
  customerName?: string;
}

export interface CreateVerificationTaskRequest {
  verification_type_id: number;
  task_title: string;
  task_description?: string;
  priority?: TaskPriority;
  assigned_to?: string;
  rate_type_id?: number;
  estimated_amount?: number;
  address?: string;
  pincode?: string;
  area_id?: number;
  applicant_type?: string;
  trigger?: string;
  document_type?: string;
  document_number?: string;
  document_details?: Record<string, any>;
  estimated_completion_date?: string;
}

export interface UpdateVerificationTaskRequest {
  task_title?: string;
  task_description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  verification_outcome?: string;
  actual_amount?: number;
  address?: string;
  pincode?: string;
  document_type?: string;
  document_number?: string;
  document_details?: Record<string, any>;
  estimated_completion_date?: string;
}

export interface AssignVerificationTaskRequest {
  assignedTo: string;
  assignmentReason?: string;
  priority?: TaskPriority;
}

export interface CompleteVerificationTaskRequest {
  verificationOutcome: string;
  actualAmount?: number;
  completionNotes?: string;
  formSubmissionId?: string;
}

export type TaskStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ON_HOLD'
  | 'REVOKED';

export type TaskPriority = 
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'URGENT';

export type CommissionStatus = 
  | 'PENDING'
  | 'CALCULATED'
  | 'APPROVED'
  | 'PAID'
  | 'REJECTED';

export interface VerificationTaskFilters {
  caseId?: string;
  status?: TaskStatus;
  assignedTo?: string;
  verificationTypeId?: number;
  priority?: TaskPriority;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface VerificationTaskSummary {
  caseId: string;
  caseNumber: string;
  customerName: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  assignedTasks: number;
  cancelledTasks: number;
  onHoldTasks: number;
  completionPercentage: number;
  totalEstimatedAmount: number;
  totalActualAmount: number;
  completedAmount: number;
  pendingAmount: number;
}

// =====================================================
// TASK TEMPLATE TYPES
// =====================================================

export interface VerificationTaskTemplate {
  id: number;
  name: string;
  description?: string;
  category: string;
  tasks: TaskTemplateItem[];
  estimatedTotalCost?: number;
  estimatedDurationDays?: number;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTemplateItem {
  taskType: string;
  priority: TaskPriority;
  title: string;
  description?: string;
  estimatedAmount?: number;
  requiresLocation?: boolean;
  requiresDocuments?: boolean;
}

export interface CreateTasksFromTemplateRequest {
  templateId: number;
  caseId: string;
  customizations?: {
    defaultAssignedTo?: string;
    priorityOverride?: TaskPriority;
    address?: string;
    pincode?: string;
    estimatedCompletionDate?: string;
  };
}

// =====================================================
// ENHANCED CASE TYPES
// =====================================================

export interface EnhancedCase {
  id: string;
  caseNumber: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  clientName?: string;
  productName?: string;
  status: string;
  priority: string;
  address?: string;
  pincode?: string;
  hasMultipleTasks: boolean;
  totalTasksCount: number;
  completedTasksCount: number;
  caseCompletionPercentage: number;
  createdAt: string;
  createdByName?: string;
}

export interface CreateCaseWithMultipleTasksRequest {
  case_details: {
    customerName: string;
    customerPhone?: string;
    customerCallingCode?: string;
    customerEmail?: string;
    clientId: number;
    productId: number;
    priority?: string;
    address?: string;
    pincode?: string;
    applicantType?: string;
    backendContactNumber?: string;
    trigger?: string;
  };
  verification_tasks: CreateVerificationTaskRequest[];
}

export interface CaseSummaryResponse {
  case: EnhancedCase;
  taskSummary: {
    totalTasks: number;
    pendingTasks: number;
    assignedTasks: number;
    inProgressTasks: number;
    completedTasks: number;
    cancelledTasks: number;
    onHoldTasks: number;
  };
  financialSummary: {
    totalEstimatedAmount: number;
    totalActualAmount: number;
    completedAmount: number;
    pendingAmount: number;
    totalCommission: number;
    paidCommission: number;
    pendingCommission: number;
  };
  recentActivities: TaskActivity[];
}

export interface TaskActivity {
  type: 'TASK_CREATED' | 'TASK_ASSIGNED' | 'TASK_STARTED' | 'TASK_COMPLETED' | 'TASK_CANCELLED';
  taskId: string;
  taskTitle: string;
  userName?: string;
  timestamp: string;
  details?: Record<string, any>;
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface VerificationTaskResponse {
  success: boolean;
  data: VerificationTask | VerificationTask[];
  message: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TasksForCaseResponse {
  success: boolean;
  data: {
    case_id: string;
    case_number: string;
    customer_name: string;
    total_tasks: number;
    completed_tasks: number;
    completion_percentage: number;
    tasks: VerificationTask[];
  };
  message: string;
}

export interface CreateMultipleTasksResponse {
  success: boolean;
  data: {
    case_id: string;
    tasks_created: number;
    tasks: VerificationTask[];
    total_estimated_amount: number;
  };
  message: string;
}

export interface CreateCaseWithMultipleTasksResponse {
  success: boolean;
  data: {
    case: EnhancedCase;
    verification_tasks: VerificationTask[];
    summary: {
      case_id: string;
      case_number: string;
      customer_name: string;
      total_tasks: number;
      total_estimated_amount: number;
      assigned_tasks: number;
      pending_tasks: number;
    };
  };
  message: string;
}

// =====================================================
// UI STATE TYPES
// =====================================================

export interface TaskFormState {
  isCreating: boolean;
  isUpdating: boolean;
  isAssigning: boolean;
  isCompleting: boolean;
  selectedTasks: string[];
  filters: VerificationTaskFilters;
  sortBy: 'created_at' | 'priority' | 'status' | 'assigned_at' | 'estimated_completion_date';
  sortOrder: 'asc' | 'desc';
}

export interface TaskValidationError {
  field: string;
  message: string;
  taskIndex?: number;
}

// =====================================================
// UTILITY TYPES
// =====================================================

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  PENDING: 'gray',
  ASSIGNED: 'blue',
  IN_PROGRESS: 'yellow',
  COMPLETED: 'green',
  CANCELLED: 'red',
  ON_HOLD: 'orange'
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: 'gray',
  MEDIUM: 'blue',
  HIGH: 'orange',
  URGENT: 'red'
};

export const COMMISSION_STATUS_COLORS: Record<CommissionStatus, string> = {
  PENDING: 'gray',
  CALCULATED: 'blue',
  APPROVED: 'green',
  PAID: 'emerald',
  REJECTED: 'red'
};
