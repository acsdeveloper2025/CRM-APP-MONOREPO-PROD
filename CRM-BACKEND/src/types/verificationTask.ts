// =====================================================
// VERIFICATION TASK TYPES
// =====================================================
// Type definitions for the multi-verification task system

export interface VerificationTask {
  id: string;
  taskNumber: string;
  caseId: string;

  // Task Details
  verificationTypeId: number;
  taskTitle: string;
  taskDescription?: string;
  priority: TaskPriority;

  // Assignment Details
  assignedTo?: string;
  assignedBy?: string;
  assignedAt?: string;

  // Status and Progress
  status: TaskStatus;
  verificationOutcome?: string;

  // Billing Information
  rateTypeId?: number;
  estimatedAmount?: number;
  actualAmount?: number;

  // Location and Address (for address verification tasks)
  address?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;

  // Document Information (for document verification tasks)
  documentType?: string;
  documentNumber?: string;
  documentDetails?: Record<string, unknown>;

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

  // Audit Fields
  createdAt: string;
  updatedAt: string;
  createdBy?: string;

  // Populated fields (from joins)
  verificationTypeName?: string;
  assignedToName?: string;
  assignedByName?: string;
  rateTypeName?: string;
  caseNumber?: string;
  customerName?: string;
}

export interface CreateVerificationTaskData {
  caseId: string;
  verificationTypeId: number;
  taskTitle: string;
  taskDescription?: string;
  priority?: TaskPriority;
  assignedTo?: string;
  rateTypeId?: number;
  estimatedAmount?: number;
  address?: string;
  pincode?: string;
  documentType?: string;
  documentNumber?: string;
  documentDetails?: Record<string, unknown>;
  estimatedCompletionDate?: string;
}

export interface UpdateVerificationTaskData {
  taskTitle?: string;
  taskDescription?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  assignedTo?: string; // Allow assignment during update
  verificationOutcome?: string;
  actualAmount?: number;
  address?: string;
  pincode?: string;
  documentType?: string;
  documentNumber?: string;
  documentDetails?: Record<string, unknown>;
  estimatedCompletionDate?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AssignVerificationTaskData {
  assignedTo: string;
  assignedBy: string;
  assignmentReason?: string;
  priority?: TaskPriority;
}

export interface CompleteVerificationTaskData {
  verificationOutcome: string;
  actualAmount?: number;
  completionNotes?: string;
  formSubmissionId?: string;
}

export interface RevokeVerificationTaskData {
  reason: string;
  revokedBy: string;
}

export interface CancelVerificationTaskData {
  reason: string;
  cancelledBy: string;
}

export type TaskStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ON_HOLD'
  | 'REVOKED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

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
  cancelledTasks: number;
  completionPercentage: number;
  totalEstimatedAmount: number;
  totalActualAmount: number;
  completedAmount: number;
  pendingAmount: number;
}

// =====================================================
// TASK COMMISSION TYPES
// =====================================================

export interface TaskCommissionCalculation {
  id: string;
  verificationTaskId: string;
  caseId: string;
  taskNumber: string;

  // User and Assignment Details
  userId: string;
  clientId: number;
  rateTypeId: number;

  // Financial Calculations
  baseAmount: number;
  commissionAmount: number;
  calculatedCommission: number;
  currency: string;

  // Calculation Details
  calculationMethod: 'FIXED_AMOUNT' | 'PERCENTAGE';
  calculationDate: string;

  // Payment Status
  status: CommissionStatus;
  approvedBy?: string;
  approvedAt?: string;
  paidBy?: string;
  paidAt?: string;
  paymentMethod?: string;
  transactionId?: string;
  rejectionReason?: string;

  // Task Completion Details
  taskCompletedAt: string;
  verificationOutcome?: string;

  // Audit Fields
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  notes?: string;

  // Populated fields
  userName?: string;
  userEmail?: string;
  clientName?: string;
  rateTypeName?: string;
  taskTitle?: string;
  customerName?: string;
}

export interface CreateTaskCommissionData {
  verificationTaskId: string;
  caseId: string;
  taskNumber: string;
  userId: string;
  clientId: number;
  rateTypeId: number;
  baseAmount: number;
  commissionAmount?: number;
  commissionPercentage?: number;
  calculatedCommission: number;
  currency?: string;
  calculationMethod: 'FIXED_AMOUNT' | 'PERCENTAGE';
  taskCompletedAt: string;
  verificationOutcome?: string;
  notes?: string;
}

export interface UpdateTaskCommissionData {
  status?: CommissionStatus;
  approvedBy?: string;
  approvedAt?: string;
  paidBy?: string;
  paidAt?: string;
  paymentMethod?: string;
  transactionId?: string;
  rejectionReason?: string;
  notes?: string;
}

export type CommissionStatus = 'PENDING' | 'CALCULATED' | 'APPROVED' | 'PAID' | 'REJECTED';

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
  createdBy?: string;
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

export interface CreateTaskTemplateData {
  name: string;
  description?: string;
  category: string;
  tasks: TaskTemplateItem[];
  estimatedTotalCost?: number;
  estimatedDurationDays?: number;
}

export interface CreateTasksFromTemplateData {
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
// TASK ASSIGNMENT TYPES
// =====================================================

export interface TaskAssignmentHistory {
  id: string;
  verificationTaskId: string;
  caseId: string;
  assignedFrom?: string;
  assignedTo: string;
  assignedBy: string;
  assignmentReason?: string;
  assignedAt: string;
  taskStatusBefore?: TaskStatus;
  taskStatusAfter?: TaskStatus;
  createdAt: string;

  // Populated fields
  assignedToName?: string;
  assignedByName?: string;
  assignedFromName?: string;
}

export interface BulkTaskAssignmentData {
  taskIds: string[];
  assignedTo: string;
  assignedBy: string;
  assignmentReason?: string;
  priority?: TaskPriority;
}

// =====================================================
// TASK FORM SUBMISSION TYPES
// =====================================================

export interface TaskFormSubmission {
  id: string;
  verificationTaskId: string;
  caseId: string;
  formSubmissionId: string;
  formType: string;
  submittedBy: string;
  submittedAt: string;
  validationStatus: 'PENDING' | 'VALID' | 'INVALID';
  validatedBy?: string;
  validatedAt?: string;
  validationNotes?: string;
  createdAt: string;
  updatedAt: string;

  // Populated fields
  submittedByName?: string;
  validatedByName?: string;
  taskTitle?: string;
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

export interface TaskSummaryResponse {
  success: boolean;
  data: {
    case: {
      id: string;
      caseNumber: string;
      customerName: string;
      status: string;
      hasMultipleTasks: boolean;
      totalTasksCount: number;
      completedTasksCount: number;
      caseCompletionPercentage: number;
      createdAt: string;
    };
    taskSummary: {
      totalTasks: number;
      pendingTasks: number;
      inProgressTasks: number;
      completedTasks: number;
      cancelledTasks: number;
    };
    financialSummary: {
      totalEstimatedAmount: number;
      totalActualAmount: number;
      completedAmount: number;
      pendingAmount: number;
      totalCommission: number;
      paidCommission: number;
    };
    recentActivities: TaskActivity[];
  };
  message: string;
}

export interface TaskActivity {
  type: 'TASK_CREATED' | 'TASK_ASSIGNED' | 'TASK_STARTED' | 'TASK_COMPLETED' | 'TASK_CANCELLED';
  taskId: string;
  taskTitle: string;
  userName?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

// =====================================================
// MOBILE API TYPES
// =====================================================

export interface MobileVerificationTaskResponse {
  id: string;
  taskNumber: string;
  caseId: string;
  caseNumber: string;
  customerName: string;
  taskTitle: string;
  verificationType: string;
  status: TaskStatus;
  priority: TaskPriority;
  address?: string;
  estimatedAmount?: number;
  assignedAt: string;
  estimatedCompletionDate?: string;
  documentType?: string;
  documentDetails?: Record<string, unknown>;
}

export interface MobileTaskSummary {
  totalAssigned: number;
  pending: number;
  inProgress: number;
  completedToday: number;
  completedThisWeek: number;
  totalEarnings: number;
  pendingCommission: number;
}
