export interface BaseReportData {
  generatedAt: string;
  dateRange: { from?: string; to?: string };
}

export interface FormSubmissionRow {
  id: string;
  form_type: string;
  agent_name?: string;
  case_number: string;
  customer_name: string;
  validation_status: string;
  submission_score?: number;
  photos_count?: number;
  submitted_at: Date | string;
  overall_quality_score?: number;
  network_quality?: string;
  employee_id?: string;
  case_status?: string;
  sender_name?: string;
  time_spent_minutes?: number;
  attachments_count?: number;
  completeness_score?: number;
  accuracy_score?: number;
  photo_quality_score?: number;
}

export interface FormSubmissionsReportData extends BaseReportData {
  reportType: 'Form Submissions Report';
  submissions: FormSubmissionRow[];
  summary: {
    total_submissions: string | number;
    valid_submissions: string | number;
    pending_submissions: string | number;
    invalid_submissions?: string | number;
    residence_forms?: string | number;
    office_forms?: string | number;
    business_forms?: string | number;
    avg_submission_score: string | number;
    avg_photos_per_form: string | number;
    avg_time_spent?: string | number;
  };
  formTypeBreakdown?: FormTypeBreakdownRow[];
}

export interface FormTypeBreakdownRow {
  form_type: string;
  validation_status: string;
  count: string | number;
  avg_score: string | number;
}

export interface AgentPerformanceRow {
  id: string;
  name: string;
  employeeId?: string;
  email: string;
  department_name?: string;
  total_cases_assigned: number;
  cases_completed: number;
  total_forms_submitted: number;
  avg_quality_score?: string | number;
  avg_validation_success_rate?: string | number;
  performance_rating?: string;
  active_days?: number;
  residence_forms?: number;
  office_forms?: number;
  business_forms?: number;
  total_distance?: string | number;
  avg_active_hours?: string | number;
  avg_validation_rate?: string | number;
}

export interface DailyPerformanceRow {
  date: Date | string;
  agent_name: string;
  employeeId?: string;
  cases_assigned: number;
  cases_completed: number;
  forms_submitted: number;
  quality_score?: string | number;
  validation_success_rate?: string | number;
  active_hours?: string | number;
  total_distance_km?: string | number;
}

export interface AgentPerformanceReportData extends BaseReportData {
  reportType: 'Agent Performance Report';
  agents: AgentPerformanceRow[];
  dailyPerformance?: DailyPerformanceRow[];
}

export interface CaseAnalyticsRow {
  caseId: string;
  customerName: string;
  agent_name?: string;
  client_name?: string;
  status: string;
  priority?: string;
  completion_days?: number;
  quality_score?: number;
  actual_forms_submitted?: number;
  valid_forms?: number;
  attachment_count?: number;
  form_completion_percentage?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CaseAnalyticsReportData extends BaseReportData {
  reportType: 'Case Analytics Report';
  cases: CaseAnalyticsRow[];
  summary: {
    total_cases: string | number;
    completed_cases: string | number;
    in_progress_cases?: string | number;
    pending_cases?: string | number;
    avg_completion_days: string | number;
    avg_quality_score: string | number;
    avg_form_completion?: string | number;
  };
}

export interface ValidationStatusRow {
  form_type: string;
  validation_status: string;
  form_count: string | number;
  avg_submission_score?: string | number;
  avg_quality_score?: string | number;
  avg_completeness?: string | number;
  avg_accuracy?: string | number;
}

export interface ValidationStatusReportData extends BaseReportData {
  reportType: 'Form Validation Status Report';
  validationData: ValidationStatusRow[];
}

export type ReportData =
  | FormSubmissionsReportData
  | AgentPerformanceReportData
  | CaseAnalyticsReportData
  | ValidationStatusReportData;
