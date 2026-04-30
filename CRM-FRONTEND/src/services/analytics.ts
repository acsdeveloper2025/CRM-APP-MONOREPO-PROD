import { apiService } from './api';
import type { ApiResponse, PaginationQuery } from '@/types/api';
import { validateResponse } from './schemas/runtime';
import { GenericObjectSchema } from './schemas/generic.schema';

// ===== PHASE 1: NEW DATA VISUALIZATION & REPORTING SERVICES =====

// Form Submission Types
export interface FormSubmission {
  formType: 'RESIDENCE' | 'OFFICE' | 'BUSINESS';
  caseId: string;
  submittedBy: string;
  submittedAt: string;
  validationStatus: 'VALID' | 'PENDING' | 'INVALID';
  submissionData: Record<string, unknown>;
  photosCount: number;
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
  workDate: string;
  casesAssigned: number;
  casesCompleted: number;
  residenceForms: number;
  officeForms: number;
  attachmentsUploaded: number;
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
  formType: string;
  totalForms: number;
  validatedForms: number;
  pendingForms: number;
  avgValidationTimeHours: number;
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

// Analytics Service Class
export class AnalyticsService {
  // 1.1 Form Submission Data APIs
  async getFormSubmissions(
    query: FormSubmissionQuery = {}
  ): Promise<ApiResponse<FormSubmissionsResponse>> {
    const response = await apiService.get<FormSubmissionsResponse>(
      '/reports/form-submissions',
      query
    );
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'analytics',
        endpoint: 'GET /reports/form-submissions',
      });
    }
    return response;
  }

  async getFormSubmissionsByType(
    formType: string,
    query: Omit<FormSubmissionQuery, 'formType'> = {}
  ): Promise<ApiResponse<FormSubmissionsResponse>> {
    const response = await apiService.get<FormSubmissionsResponse>(
      `/reports/form-submissions/${formType}`,
      query
    );
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'analytics',
        endpoint: 'GET /reports/form-submissions/:type',
      });
    }
    return response;
  }

  async getFormValidationStatus(
    query: { dateFrom?: string; dateTo?: string } = {}
  ): Promise<ApiResponse<FormValidationResponse>> {
    const response = await apiService.get<FormValidationResponse>(
      '/reports/form-validation-status',
      query
    );
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'analytics',
        endpoint: 'GET /reports/form-validation-status',
      });
    }
    return response;
  }

  // 1.2 Case Analytics APIs
  async getCaseAnalytics(
    query: CaseAnalyticsQuery = {}
  ): Promise<ApiResponse<CaseAnalyticsResponse>> {
    const response = await apiService.get<CaseAnalyticsResponse>('/reports/case-analytics', query);
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'analytics',
        endpoint: 'GET /reports/case-analytics',
      });
    }
    return response;
  }

  // 1.3 Agent Performance APIs
  async getAgentPerformance(
    query: AgentPerformanceQuery = {}
  ): Promise<ApiResponse<AgentPerformanceResponse>> {
    const response = await apiService.get<AgentPerformanceResponse>(
      '/reports/agent-performance',
      query
    );
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'analytics',
        endpoint: 'GET /reports/agent-performance',
      });
    }
    return response;
  }

  async getAgentProductivity(
    agentId: string,
    query: AgentProductivityQuery = {}
  ): Promise<ApiResponse<AgentProductivityResponse>> {
    const response = await apiService.get<AgentProductivityResponse>(
      `/reports/agent-productivity/${agentId}`,
      query
    );
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'analytics',
        endpoint: 'GET /reports/agent-productivity/:agentId',
      });
    }
    return response;
  }
}

export const analyticsService = new AnalyticsService();
