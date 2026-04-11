import { apiService } from './api';
import type { ApiResponse, PaginationQuery } from '@/types/api';
import type { UserActivity, UserSession } from '@/types/user';
import { validateResponse } from './schemas/runtime';
import { GenericEntityListSchema } from './schemas/generic.schema';

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
    const response = await apiService.get<UserActivity[]>('/users/activities', params);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'userAuditService',
        endpoint: 'GET /users/activities',
      });
    }
    return response;
  }

  async getUserSessions(params: SessionQuery = {}): Promise<ApiResponse<UserSession[]>> {
    const response = await apiService.get<UserSession[]>('/users/sessions', params);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'userAuditService',
        endpoint: 'GET /users/sessions',
      });
    }
    return response;
  }
}

export const userAuditService = new UserAuditService();
