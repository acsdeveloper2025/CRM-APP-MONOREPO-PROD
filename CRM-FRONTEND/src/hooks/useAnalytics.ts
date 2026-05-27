import { useQuery } from '@tanstack/react-query';
import {
  analyticsService,
  type CaseAnalyticsQuery,
  type AgentPerformanceQuery,
} from '@/services/analytics';

// Analytics hooks — narrowed to the 2 live consumers (CasesAnalytics +
// AgentPerformanceCharts). Convenience hooks + form-submission chain +
// agent-productivity pruned during P1/P7 truthful-sweep cleanup 2026-05-27.

export const analyticsKeys = {
  all: ['analytics'] as const,
  caseAnalytics: () => [...analyticsKeys.all, 'case-analytics'] as const,
  caseAnalyticsList: (query: CaseAnalyticsQuery) =>
    [...analyticsKeys.caseAnalytics(), query] as const,
  agentPerformance: () => [...analyticsKeys.all, 'agent-performance'] as const,
  agentPerformanceList: (query: AgentPerformanceQuery) =>
    [...analyticsKeys.agentPerformance(), query] as const,
};

export const useCaseAnalytics = (query: CaseAnalyticsQuery = {}) => {
  return useQuery({
    queryKey: analyticsKeys.caseAnalyticsList(query),
    queryFn: () => analyticsService.getCaseAnalytics(query),
    staleTime: 5 * 60 * 1000,
  });
};

export const useAgentPerformance = (query: AgentPerformanceQuery = {}) => {
  return useQuery({
    queryKey: analyticsKeys.agentPerformanceList(query),
    queryFn: () => analyticsService.getAgentPerformance(query),
    staleTime: 10 * 60 * 1000,
  });
};
