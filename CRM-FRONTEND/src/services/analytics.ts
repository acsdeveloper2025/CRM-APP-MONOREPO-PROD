import { apiService } from './api';
import type { ApiResponse } from '@/types/api';
import { validateResponse } from './schemas/runtime';
import { GenericObjectSchema } from './schemas/generic.schema';

// Analytics service — narrowed to live consumers (CasesAnalytics +
// AgentPerformanceCharts). Form-submission + agent-productivity APIs
// stripped during P1/P7 truthful-sweep cleanup 2026-05-27 — zero
// FE consumers; BE routes remain alive for future use.

// Case Analytics — mirrors GET /api/reports/case-analytics
// (P1 truthful-sweep rebuild 2026-05-27: aggregate-only; no per-case
// row dump). Distribution Maps come from BE GROUP BY queries.
export interface CaseAnalyticsSummary {
  totalCases: number;
  completedCases: number;
  completionRate: number;
  avgCompletionDays: number;
  avgFormCompletion: number;
  statusDistribution: Record<string, number>;
  clientDistribution: Record<string, number>;
  priorityDistribution: Record<string, number>;
}

export interface CaseAnalyticsResponse {
  summary: CaseAnalyticsSummary;
  generatedAt: string;
  generatedBy: string;
}

// Agent Performance — mirrors GET /api/reports/agent-performance
// (verified 2026-05-27 E5 truthful sweep).
export interface AgentPerformance {
  id: string;
  name: string;
  employeeId: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inTat: number;
  outTat: number;
  localTasks: number;
  oglTasks: number;
  totalAmount: number;
  clients: string[];
  products: string[];
  completionRate: number;
}

export interface AgentPerformanceSummary {
  totalAgents: number;
  totalTasks: number;
  completedTasks: number;
  inTat: number;
  outTat: number;
}

export interface AgentPerformanceResponse {
  summary: AgentPerformanceSummary;
  agents: AgentPerformance[];
  generatedAt: string;
  generatedBy: string;
}

// Query Types
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

// Analytics Service Class
export class AnalyticsService {
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
}

export const analyticsService = new AnalyticsService();
