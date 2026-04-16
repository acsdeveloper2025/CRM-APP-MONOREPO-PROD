// MIS Dashboard Types

export interface MISFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  clientId?: number;
  productId?: number;
  verificationTypeId?: number;
  caseStatus?:
    | 'PENDING'
    | 'ASSIGNED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'APPROVED'
    | 'REJECTED'
    | 'REVOKED';
  fieldAgentId?: string;
  backendUserId?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  page?: number;
  limit?: number;
}

// TASK-CENTRIC DATA STRUCTURE
// Each row represents ONE verification task (not one case)
export interface MISTaskRowData {
  // Task-Level Data (PRIMARY)
  taskId: number;
  taskNumber: string;
  taskTitle: string;
  verificationTypeName: string;
  taskStatus: string;
  taskPriority: string;
  address: string;
  pincode: string;
  areaName?: string | null;
  rateType: string;
  estimatedAmount: number;
  actualAmount: number;
  taskCreatedDate: string;
  taskStartedDate: string | null;
  taskCompletionDate: string | null;
  taskTatDays: number | null;
  trigger: string;
  applicantType: string;

  // Field User Data
  assignedFieldUser: string;
  fieldUserEmployeeId: string;

  // Case-Level Data (SECONDARY/REFERENCE)
  caseId: number;
  caseNumber: string;
  customerName: string;
  customerPhone: string;
  customerCallingCode: string;
  caseStatus: string;
  casePriority: string;
  caseCreatedDate: string;
  totalTasksCount: number;
  completedTasksCount: number;
  caseCompletionPercentage: number;

  // Client and Product Data
  clientName: string;
  clientCode: string;
  productName: string;

  // Backend User Data
  backendUserName: string;
  backendUserEmployeeId: string;

  // Form Submission Data
  formSubmissionId: string | null;
  formType: string | null;
  formSubmittedDate: string | null;
  formValidationStatus: string | null;
}

export interface MISSummary {
  totalTasks: number;
  totalEstimatedAmount: number;
  totalActualAmount: number;
  completedTasks: number;
  taskCompletionRate: number;
  avgTatDays: number;
}

export interface MISPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MISDataResponse {
  success: boolean;
  data: MISTaskRowData[];
  summary: MISSummary;
  pagination: MISPagination;
  message: string;
}

export type ExportFormat = 'EXCEL' | 'CSV';
