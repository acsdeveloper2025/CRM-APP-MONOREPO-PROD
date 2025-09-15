import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard';
import type { DashboardQuery } from '@/services/dashboard';

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  data: (query: DashboardQuery) => [...dashboardKeys.all, 'data', query] as const,
  stats: (query: DashboardQuery) => [...dashboardKeys.all, 'stats', query] as const,
  caseDistribution: (query: DashboardQuery) => [...dashboardKeys.all, 'case-distribution', query] as const,
  clientStats: (query: DashboardQuery) => [...dashboardKeys.all, 'client-stats', query] as const,
  monthlyTrends: (query: DashboardQuery) => [...dashboardKeys.all, 'monthly-trends', query] as const,
  recentActivities: (limit: number) => [...dashboardKeys.all, 'recent-activities', limit] as const,
  performanceMetrics: (query: DashboardQuery) => [...dashboardKeys.all, 'performance-metrics', query] as const,
  turnaroundTimes: (query: DashboardQuery) => [...dashboardKeys.all, 'turnaround-times', query] as const,
  topPerformers: (query: DashboardQuery) => [...dashboardKeys.all, 'top-performers', query] as const,
  upcomingDeadlines: () => [...dashboardKeys.all, 'upcoming-deadlines'] as const,
  alerts: () => [...dashboardKeys.all, 'alerts'] as const,
};

// Queries
export const useDashboardData = (query: DashboardQuery = {}) => {
  return useQuery({
    queryKey: dashboardKeys.data(query),
    queryFn: () => dashboardService.getDashboardData(query),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useDashboardStats = (query: DashboardQuery = {}) => {
  return useQuery({
    queryKey: dashboardKeys.stats(query),
    queryFn: () => dashboardService.getDashboardStats(query),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCaseStatusDistribution = (query: DashboardQuery = {}) => {
  return useQuery({
    queryKey: dashboardKeys.caseDistribution(query),
    queryFn: () => dashboardService.getCaseStatusDistribution(query),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useClientStats = (query: DashboardQuery = {}) => {
  return useQuery({
    queryKey: dashboardKeys.clientStats(query),
    queryFn: () => dashboardService.getClientStats(query),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useMonthlyTrends = (query: DashboardQuery = {}) => {
  return useQuery({
    queryKey: dashboardKeys.monthlyTrends(query),
    queryFn: () => dashboardService.getMonthlyTrends(query),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

export const useRecentActivities = (limit: number = 10) => {
  return useQuery({
    queryKey: dashboardKeys.recentActivities(limit),
    queryFn: () => dashboardService.getRecentActivities(limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const usePerformanceMetrics = (query: DashboardQuery = {}) => {
  return useQuery({
    queryKey: dashboardKeys.performanceMetrics(query),
    queryFn: () => dashboardService.getPerformanceMetrics(query),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
};

export const useTurnaroundTimes = (query: DashboardQuery = {}) => {
  return useQuery({
    queryKey: dashboardKeys.turnaroundTimes(query),
    queryFn: () => dashboardService.getTurnaroundTimes(query),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
};

export const useTopPerformers = (query: DashboardQuery = {}) => {
  return useQuery({
    queryKey: dashboardKeys.topPerformers(query),
    queryFn: () => dashboardService.getTopPerformers(query),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

export const useUpcomingDeadlines = () => {
  return useQuery({
    queryKey: dashboardKeys.upcomingDeadlines(),
    queryFn: () => dashboardService.getUpcomingDeadlines(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useAlerts = () => {
  return useQuery({
    queryKey: dashboardKeys.alerts(),
    queryFn: () => dashboardService.getAlerts(),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};
