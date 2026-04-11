import { apiService } from './api';
import type { DashboardData, DashboardStats, RecentActivity } from '@/types/dashboard';
import type { ApiResponse } from '@/types/api';
import type {
  CaseStatusDistribution,
  ClientStats,
  MonthlyTrend,
  TopPerformer,
  UpcomingDeadline,
  Alert,
  TATStats,
  OverdueTasksResponse
} from '@/types/dto/dashboard.dto';
import { validateResponse } from './schemas/runtime';
import { DashboardSummarySchema } from './schemas/client.schema';

export interface DashboardQuery {
  period?: 'week' | 'month' | 'quarter' | 'year';
  clientId?: string;
  userId?: string;
}

export class DashboardService {
  async getDashboardData(query: DashboardQuery = {}): Promise<ApiResponse<DashboardData>> {
    return apiService.get('/dashboard', query);
  }

  async getDashboardStats(query: DashboardQuery = {}): Promise<ApiResponse<DashboardStats>> {
    const response = await apiService.get<DashboardStats>('/dashboard/stats', query);
    if (response.success && response.data) {
      validateResponse(DashboardSummarySchema, response.data, {
        service: 'dashboard',
        endpoint: 'GET /dashboard/stats',
      });
    }
    return response;
  }

  async getCaseStatusDistribution(query: DashboardQuery = {}): Promise<ApiResponse<CaseStatusDistribution[]>> {
    return apiService.get('/dashboard/case-status-distribution', query);
  }

  async getClientStats(query: DashboardQuery = {}): Promise<ApiResponse<ClientStats[]>> {
    return apiService.get('/dashboard/client-stats', query);
  }

  async getMonthlyTrends(query: DashboardQuery = {}): Promise<ApiResponse<MonthlyTrend[]>> {
    return apiService.get('/dashboard/monthly-trends', query);
  }

  async getRecentActivities(limit: number = 10): Promise<ApiResponse<RecentActivity[]>> {
    return apiService.get('/dashboard/recent-activities', { limit });
  }

  async getPerformanceMetrics(query: DashboardQuery = {}): Promise<ApiResponse<unknown>> {
    return apiService.get('/dashboard/performance-metrics', query);
  }

  async getTurnaroundTimes(query: DashboardQuery = {}): Promise<ApiResponse<unknown>> {
    return apiService.get('/dashboard/turnaround-times', query);
  }

  async getTopPerformers(query: DashboardQuery = {}): Promise<ApiResponse<TopPerformer[]>> {
    return apiService.get('/dashboard/top-performers', query);
  }

  async getUpcomingDeadlines(): Promise<ApiResponse<UpcomingDeadline[]>> {
    return apiService.get('/dashboard/upcoming-deadlines');
  }

  async getAlerts(): Promise<ApiResponse<Alert[]>> {
    return apiService.get('/dashboard/alerts');
  }

  // TAT Monitoring
  async getOverdueTasks(params: {
    threshold?: number;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
    priority?: string;
    status?: string;
  } = {}): Promise<ApiResponse<OverdueTasksResponse>> {
    return apiService.get('/dashboard/overdue-tasks', params);
  }

  async getTATStats(): Promise<ApiResponse<TATStats>> {
    return apiService.get('/dashboard/tat-stats');
  }

  // Export dashboard data
  async exportDashboardReport(query: DashboardQuery = {}): Promise<Blob> {
    const response = await apiService.postRaw<Blob>('/dashboard/export', query, {
      responseType: 'blob',
    });
    return response.data;
  }
}

export const dashboardService = new DashboardService();
