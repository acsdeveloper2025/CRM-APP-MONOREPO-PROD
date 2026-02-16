import { apiService } from './api';
import type { ApiResponse, PaginationQuery } from '@/types/api';
import type { UserActivity, UserSession } from '@/types/user';

export interface ActivityQuery extends PaginationQuery {
  userId?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export interface SessionQuery extends PaginationQuery {
  userId?: string;
}

class UserAuditService {
  async getUserActivities(params: ActivityQuery = {}): Promise<ApiResponse<UserActivity[]>> {
    return apiService.get<UserActivity[]>('/users/activities', params);
  }

  async getUserSessions(params: SessionQuery = {}): Promise<ApiResponse<UserSession[]>> {
    return apiService.get<UserSession[]>('/users/sessions', params);
  }
}

export const userAuditService = new UserAuditService();
