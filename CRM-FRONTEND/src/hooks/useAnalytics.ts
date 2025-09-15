import { useQuery } from '@tanstack/react-query';
import { 
  analyticsService, 
  type FormSubmissionQuery, 
  type CaseAnalyticsQuery, 
  type AgentPerformanceQuery,
  type AgentProductivityQuery 
} from '@/services/analytics';

// ===== PHASE 1: NEW DATA VISUALIZATION & REPORTING HOOKS =====

// Query keys for React Query
export const analyticsKeys = {
  all: ['analytics'] as const,
  formSubmissions: () => [...analyticsKeys.all, 'form-submissions'] as const,
  formSubmissionsList: (query: FormSubmissionQuery) => [...analyticsKeys.formSubmissions(), query] as const,
  formSubmissionsByType: (formType: string, query: Omit<FormSubmissionQuery, 'formType'>) => 
    [...analyticsKeys.formSubmissions(), 'by-type', formType, query] as const,
  formValidationStatus: (query: { dateFrom?: string; dateTo?: string }) => 
    [...analyticsKeys.all, 'form-validation-status', query] as const,
  
  caseAnalytics: () => [...analyticsKeys.all, 'case-analytics'] as const,
  caseAnalyticsList: (query: CaseAnalyticsQuery) => [...analyticsKeys.caseAnalytics(), query] as const,
  caseTimeline: (caseId: string) => [...analyticsKeys.all, 'case-timeline', caseId] as const,
  
  agentPerformance: () => [...analyticsKeys.all, 'agent-performance'] as const,
  agentPerformanceList: (query: AgentPerformanceQuery) => [...analyticsKeys.agentPerformance(), query] as const,
  agentProductivity: (agentId: string, query: AgentProductivityQuery) => 
    [...analyticsKeys.all, 'agent-productivity', agentId, query] as const,
};

// 1.1 Form Submission Hooks
export const useFormSubmissions = (query: FormSubmissionQuery = {}) => {
  return useQuery({
    queryKey: analyticsKeys.formSubmissionsList(query),
    queryFn: () => analyticsService.getFormSubmissions(query),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useFormSubmissionsByType = (formType: string, query: Omit<FormSubmissionQuery, 'formType'> = {}) => {
  return useQuery({
    queryKey: analyticsKeys.formSubmissionsByType(formType, query),
    queryFn: () => analyticsService.getFormSubmissionsByType(formType, query),
    enabled: !!formType,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useFormValidationStatus = (query: { dateFrom?: string; dateTo?: string } = {}) => {
  return useQuery({
    queryKey: analyticsKeys.formValidationStatus(query),
    queryFn: () => analyticsService.getFormValidationStatus(query),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// 1.2 Case Analytics Hooks
export const useCaseAnalytics = (query: CaseAnalyticsQuery = {}) => {
  return useQuery({
    queryKey: analyticsKeys.caseAnalyticsList(query),
    queryFn: () => analyticsService.getCaseAnalytics(query),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCaseTimeline = (caseId: string) => {
  return useQuery({
    queryKey: analyticsKeys.caseTimeline(caseId),
    queryFn: () => analyticsService.getCaseTimeline(caseId),
    enabled: !!caseId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// 1.3 Agent Performance Hooks
export const useAgentPerformance = (query: AgentPerformanceQuery = {}) => {
  return useQuery({
    queryKey: analyticsKeys.agentPerformanceList(query),
    queryFn: () => analyticsService.getAgentPerformance(query),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useAgentProductivity = (agentId: string, query: AgentProductivityQuery = {}) => {
  return useQuery({
    queryKey: analyticsKeys.agentProductivity(agentId, query),
    queryFn: () => analyticsService.getAgentProductivity(agentId, query),
    enabled: !!agentId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Convenience hooks for common use cases
export const useFormSubmissionsOverview = (dateRange?: { from: string; to: string }) => {
  const query: FormSubmissionQuery = {
    limit: 100,
    ...(dateRange && { dateFrom: dateRange.from, dateTo: dateRange.to }),
  };
  
  return useFormSubmissions(query);
};

export const useCaseAnalyticsOverview = (dateRange?: { from: string; to: string }) => {
  const query: CaseAnalyticsQuery = {
    ...(dateRange && { dateFrom: dateRange.from, dateTo: dateRange.to }),
  };
  
  return useCaseAnalytics(query);
};

export const useAgentPerformanceOverview = (dateRange?: { from: string; to: string }) => {
  const query: AgentPerformanceQuery = {
    ...(dateRange && { dateFrom: dateRange.from, dateTo: dateRange.to }),
  };
  
  return useAgentPerformance(query);
};

// Hook for getting top performing agents
export const useTopPerformingAgents = (limit: number = 5, dateRange?: { from: string; to: string }) => {
  const { data, ...rest } = useAgentPerformance({
    ...(dateRange && { dateFrom: dateRange.from, dateTo: dateRange.to }),
  });
  
  const topPerformers = data?.data?.topPerformers?.slice(0, limit) || [];
  
  return {
    data: { data: topPerformers },
    ...rest,
  };
};

// Hook for getting form submission statistics
export const useFormSubmissionStats = (dateRange?: { from: string; to: string }) => {
  const { data, ...rest } = useFormSubmissions({
    limit: 1, // We only need the summary
    ...(dateRange && { dateFrom: dateRange.from, dateTo: dateRange.to }),
  });
  
  const stats = data?.data?.summary;
  
  return {
    data: { data: stats },
    ...rest,
  };
};

// Hook for getting case completion metrics
export const useCaseCompletionMetrics = (dateRange?: { from: string; to: string }) => {
  const { data, ...rest } = useCaseAnalytics({
    ...(dateRange && { dateFrom: dateRange.from, dateTo: dateRange.to }),
  });
  
  const metrics = data?.data?.summary;
  
  return {
    data: { data: metrics },
    ...rest,
  };
};
