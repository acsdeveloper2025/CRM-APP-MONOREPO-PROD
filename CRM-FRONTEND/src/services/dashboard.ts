import { apiService } from './api';
import type { DashboardData, DashboardStats, RecentActivity } from '@/types/dashboard';
import type { ApiResponse } from '@/types/api';

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
    return apiService.get('/dashboard/stats', query);
  }

  async getCaseStatusDistribution(query: DashboardQuery = {}): Promise<ApiResponse<any[]>> {
    return apiService.get('/dashboard/case-status-distribution', query);
  }

  async getClientStats(query: DashboardQuery = {}): Promise<ApiResponse<any[]>> {
    return apiService.get('/dashboard/client-stats', query);
  }

  async getMonthlyTrends(query: DashboardQuery = {}): Promise<ApiResponse<any[]>> {
    return apiService.get('/dashboard/monthly-trends', query);
  }

  async getRecentActivities(limit: number = 10): Promise<ApiResponse<RecentActivity[]>> {
    return apiService.get('/dashboard/recent-activities', { limit });
  }

  async getPerformanceMetrics(query: DashboardQuery = {}): Promise<ApiResponse<any>> {
    return apiService.get('/dashboard/performance-metrics', query);
  }

  async getTurnaroundTimes(query: DashboardQuery = {}): Promise<ApiResponse<any>> {
    return apiService.get('/dashboard/turnaround-times', query);
  }

  async getTopPerformers(query: DashboardQuery = {}): Promise<ApiResponse<any[]>> {
    return apiService.get('/dashboard/top-performers', query);
  }

  async getUpcomingDeadlines(): Promise<ApiResponse<any[]>> {
    return apiService.get('/dashboard/upcoming-deadlines');
  }

  async getAlerts(): Promise<ApiResponse<any[]>> {
    return apiService.get('/dashboard/alerts');
  }

  // Export dashboard data
  async exportDashboardReport(query: DashboardQuery = {}): Promise<Blob> {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/dashboard/export`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });
    return response.blob();
  }
}

export const dashboardService = new DashboardService();
