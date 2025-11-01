// MIS Dashboard Types

export interface MISFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  clientId?: number;
  productId?: number;
  verificationTypeId?: number;
  caseStatus?: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
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
  task_id: number;
  task_number: string;
  task_title: string;
  verification_type_name: string;
  task_status: string;
  task_priority: string;
  address: string;
  pincode: string;
  rate_type: string;
  estimated_amount: number;
  actual_amount: number;
  task_created_date: string;
  task_started_date: string | null;
  task_completion_date: string | null;
  task_tat_days: number | null;
  trigger: string;
  applicant_type: string;

  // Field User Data
  assigned_field_user: string;
  field_user_employee_id: string;

  // Case-Level Data (SECONDARY/REFERENCE)
  case_id: number;
  case_number: string;
  customerName: string;
  customerPhone: string;
  customerCallingCode: string;
  case_status: string;
  case_priority: string;
  case_created_date: string;
  total_tasks_count: number;
  completed_tasks_count: number;
  case_completion_percentage: number;

  // Client and Product Data
  client_name: string;
  client_code: string;
  product_name: string;

  // Backend User Data
  backend_user_name: string;
  backend_user_employee_id: string;

  // Form Submission Data
  form_submission_id: string | null;
  form_type: string | null;
  form_submitted_date: string | null;
  form_validation_status: string | null;
}

export interface MISSummary {
  total_tasks: number;
  total_estimated_amount: number;
  total_actual_amount: number;
  completed_tasks: number;
  approved_tasks: number;
  rejected_tasks: number;
  task_completion_rate: number;
  avg_tat_days: number;
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

