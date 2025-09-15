import { apiService } from './api';
import type { ApiResponse, PaginationQuery } from '@/types/api';

// ===== PHASE 1: NEW DATA VISUALIZATION & REPORTING SERVICES =====

// Form Submission Types
export interface FormSubmission {
  form_type: 'RESIDENCE' | 'OFFICE' | 'BUSINESS';
  case_id: string;
  submitted_by: string;
  submitted_at: string;
  validation_status: 'VALID' | 'PENDING' | 'INVALID';
  submission_data: Record<string, any>;
  photos_count: number;
  customerName?: string;
  caseNumber?: string;
  agentName?: string;
  employeeId?: string;
  attachmentCount?: number;
}

export interface FormSubmissionSummary {
  totalSubmissions: number;
  validSubmissions: number;
  pendingSubmissions: number;
  residenceForms: number;
  officeForms: number;
  validationRate: number;
}

export interface FormSubmissionsResponse {
  submissions: FormSubmission[];
  summary: FormSubmissionSummary;
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

// Case Analytics Types
export interface CaseAnalytics {
  id: string;
  caseId: number;
  customerName: string;
  status: string;
  priority: string;
  assignedTo: string;
  clientName: string;
  agentName: string;
  employeeId: string;
  residenceReports: number;
  officeReports: number;
  attachmentCount: number;
  completionDays: number | null;
  formCompletionPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface CaseAnalyticsSummary {
  totalCases: number;
  completedCases: number;
  completionRate: number;
  avgCompletionDays: number;
  avgFormCompletion: number;
  statusDistribution: Record<string, number>;
}

export interface CaseAnalyticsResponse {
  summary: CaseAnalyticsSummary;
  cases: CaseAnalytics[];
  generatedAt: string;
  generatedBy: string;
}

// Agent Performance Types
export interface AgentPerformance {
  id: string;
  name: string;
  employeeId: string;
  email: string;
  departmentName: string;
  totalCasesAssigned: number;
  casesCompleted: number;
  residenceFormsSubmitted: number;
  officeFormsSubmitted: number;
  attachmentsUploaded: number;
  avgCompletionDays: number | null;
  formQualityScore: number;
  activeDays: number;
}

export interface AgentPerformanceSummary {
  totalAgents: number;
  activeAgents: number;
  avgCasesPerAgent: number;
  avgCompletionRate: number;
}

export interface AgentPerformanceResponse {
  summary: AgentPerformanceSummary;
  agents: AgentPerformance[];
  topPerformers: AgentPerformance[];
  generatedAt: string;
  generatedBy: string;
}

// Agent Productivity Types
export interface DailyProductivity {
  work_date: string;
  cases_assigned: number;
  cases_completed: number;
  residence_forms: number;
  office_forms: number;
  attachments_uploaded: number;
}

export interface AgentProductivityResponse {
  agent: AgentPerformance;
  dailyProductivity: DailyProductivity[];
  summary: {
    totalWorkDays: number;
    avgCasesPerDay: number;
    avgFormsPerDay: number;
  };
}

// Query Types
export interface FormSubmissionQuery extends PaginationQuery {
  formType?: 'RESIDENCE' | 'OFFICE' | 'BUSINESS';
  dateFrom?: string;
  dateTo?: string;
  agentId?: string;
  validationStatus?: 'VALID' | 'PENDING' | 'INVALID';
  caseId?: string;
}

export interface CaseAnalyticsQuery {
  dateFrom?: string;
  dateTo?: string;
  clientId?: number;
  agentId?: string;
  status?: string;
}

export interface AgentPerformanceQuery {
  dateFrom?: string;
  dateTo?: string;
  agentId?: string;
  departmentId?: number;
}

export interface AgentProductivityQuery {
  dateFrom?: string;
  dateTo?: string;
}

// Form Validation Status Types
export interface FormValidationStatus {
  form_type: string;
  total_forms: number;
  validated_forms: number;
  pending_forms: number;
  avg_validation_time_hours: number;
}

export interface FormValidationResponse {
  summary: {
    totalForms: number;
    validatedForms: number;
    pendingForms: number;
    validationRate: number;
  };
  byFormType: FormValidationStatus[];
  generatedAt: string;
  generatedBy: string;
}

// Case Timeline Types
export interface CaseTimelineEvent {
  event_type: string;
  event_date: string;
  performed_by: string;
  description: string;
  metadata: Record<string, any>;
}

export interface CaseTimelineResponse {
  case: CaseAnalytics;
  timeline: CaseTimelineEvent[];
  summary: {
    totalEvents: number;
    formsSubmitted: number;
    attachmentsUploaded: number;
  };
}

// Analytics Service Class
export class AnalyticsService {
  // 1.1 Form Submission Data APIs
  async getFormSubmissions(query: FormSubmissionQuery = {}): Promise<ApiResponse<FormSubmissionsResponse>> {
    return apiService.get('/reports/form-submissions', query);
  }

  async getFormSubmissionsByType(formType: string, query: Omit<FormSubmissionQuery, 'formType'> = {}): Promise<ApiResponse<FormSubmissionsResponse>> {
    return apiService.get(`/reports/form-submissions/${formType}`, query);
  }

  async getFormValidationStatus(query: { dateFrom?: string; dateTo?: string } = {}): Promise<ApiResponse<FormValidationResponse>> {
    return apiService.get('/reports/form-validation-status', query);
  }

  // 1.2 Case Analytics APIs
  async getCaseAnalytics(query: CaseAnalyticsQuery = {}): Promise<ApiResponse<CaseAnalyticsResponse>> {
    return apiService.get('/reports/case-analytics', query);
  }

  async getCaseTimeline(caseId: string): Promise<ApiResponse<CaseTimelineResponse>> {
    return apiService.get(`/reports/case-timeline/${caseId}`);
  }

  // 1.3 Agent Performance APIs
  async getAgentPerformance(query: AgentPerformanceQuery = {}): Promise<ApiResponse<AgentPerformanceResponse>> {
    return apiService.get('/reports/agent-performance', query);
  }

  async getAgentProductivity(agentId: string, query: AgentProductivityQuery = {}): Promise<ApiResponse<AgentProductivityResponse>> {
    return apiService.get(`/reports/agent-productivity/${agentId}`, query);
  }
}

export const analyticsService = new AnalyticsService();
