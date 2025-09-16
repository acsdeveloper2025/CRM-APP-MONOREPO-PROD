import { apiService } from './api';
import type { DashboardData, DashboardStats, RecentActivity } from '@/types/dashboard';
import type { ApiResponse } from '@/types/api';

// Smart API URL selection
const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isLocalNetwork = hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.');
  const isStaticIP = hostname === '103.14.234.36';
  const isDomain = hostname === 'crm.allcheckservices.com' || hostname === 'www.crm.allcheckservices.com';

  // Priority order for API URL selection:
  // 1. Check if we're on localhost (development)
  if (isLocalhost) {
    return 'http://localhost:3000/api';
  }

  // 2. Check if we're on the local network IP (hairpin NAT workaround)
  if (isLocalNetwork) {
    return 'http://103.14.234.36:3000/api';
  }

  // 3. Check if we're on the domain name (production access)
  if (isDomain) {
    return 'https://crm.allcheckservices.com/api';
  }

  // 4. Check if we're on the static IP (external access)
  if (isStaticIP) {
    return 'http://103.14.234.36:3000/api';
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
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/dashboard/export`, {
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
