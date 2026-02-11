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

// Smart API URL selection
const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
    const staticIP = import.meta.env.VITE_STATIC_IP || 'PUBLIC_STATIC_IP';
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isLocalNetwork = hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.');
  const isStaticIP = hostname === staticIP;
  const isDomain = hostname === 'example.com' || hostname === 'www.example.com';

  // Priority order for API URL selection:
  // 1. Check if we're on localhost (development)
  if (isLocalhost) {
    return 'http://localhost:3000/api';
  }

  // 2. Check if we're on the local network IP (hairpin NAT workaround)
  if (isLocalNetwork) {
    return `http://${staticIP}:3000/api`;
  }

  // 3. Check if we're on the domain name (production access)
  if (isDomain) {
    return 'https://example.com/api';
  }

  // 4. Check if we're on the static IP (external access)
  if (isStaticIP) {
    return `http://${staticIP}:3000/api`;
  }

  // 5. Fallback to environment variable or localhost
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
};

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
  } = {}): Promise<ApiResponse<OverdueTasksResponse>> {
    return apiService.get('/dashboard/overdue-tasks', params);
  }

  async getTATStats(): Promise<ApiResponse<TATStats>> {
    return apiService.get('/dashboard/tat-stats');
  }

  // Export dashboard data
  async exportDashboardReport(query: DashboardQuery = {}): Promise<Blob> {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/dashboard/export`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });
    return response.blob();
  }
}

export const dashboardService = new DashboardService();
