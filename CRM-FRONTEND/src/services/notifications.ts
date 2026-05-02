import { apiService } from '@/services/api';
import { validateResponse } from './schemas/runtime';
import { NotificationListSchema } from './schemas/notification.schema';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  caseId?: string;
  caseNumber?: string;
  taskId?: string;
  taskNumber?: string;
  actionUrl?: string;
  actionType?: string;
  isRead: boolean;
  readAt?: string;
  deliveryStatus?: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  data?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

interface NotificationsResponse {
  data: AppNotification[];
  unreadCount: number;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

type NotificationListApiResponse = {
  success: boolean;
  data?: AppNotification[];
  unreadCount?: number;
  pagination?: {
    total?: number;
    limit?: number;
    offset?: number;
    hasMore?: boolean;
  };
};

export const notificationService = {
  async list(params?: { limit?: number; offset?: number; unreadOnly?: boolean }) {
    const response = (await apiService.get<AppNotification[]>(
      '/notifications',
      {
        limit: params?.limit ?? 20,
        offset: params?.offset ?? 0,
        unreadOnly: params?.unreadOnly ?? false,
      },
      { useCache: false }
    )) as unknown as NotificationListApiResponse;

    if (Array.isArray(response.data)) {
      validateResponse(NotificationListSchema, response.data, {
        service: 'notifications',
        endpoint: 'GET /notifications',
      });
    }

    return {
      items: response.data || [],
      unreadCount: response.unreadCount || 0,
      pagination: response.pagination || {
        total: 0,
        limit: params?.limit ?? 20,
        offset: params?.offset ?? 0,
        hasMore: false,
      },
    } satisfies NotificationsResponse;
  },

  async markRead(notificationId: string) {
    return apiService.put(`/notifications/${notificationId}/read`, undefined, { useCache: false });
  },

  async markUnread(notificationId: string) {
    return apiService.put(`/notifications/${notificationId}/unread`, undefined, {
      useCache: false,
    });
  },

  async markAllRead() {
    return apiService.put('/notifications/mark-all-read', undefined, { useCache: false });
  },

  async remove(notificationId: string) {
    return apiService.delete(`/notifications/${notificationId}`, { useCache: false });
  },

  async clearAll() {
    return apiService.delete('/notifications', { useCache: false });
  },

  async validateNavigationTarget(notification: AppNotification): Promise<string | null> {
    try {
      if (notification.taskId) {
        const response = await apiService.get(
          `/verification-tasks/${notification.taskId}`,
          undefined,
          {
            useCache: false,
          }
        );
        return response.success
          ? `/task-management/${notification.taskNumber || notification.taskId}`
          : null;
      }

      if (notification.caseId) {
        const response = await apiService.get(`/cases/${notification.caseId}`, undefined, {
          useCache: false,
        });
        return response.success
          ? `/case-management/${notification.caseNumber || notification.caseId}`
          : null;
      }

      if (notification.actionUrl) {
        return notification.actionUrl;
      }

      return '/dashboard';
    } catch {
      return null;
    }
  },
};
