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

/**
 * Phase 3.1 (2026-05-04): one row per (notification, recipient). The
 * timeline endpoint returns every recipient's row — group/aggregate
 * client-side by `(type, taskId, createdAt-bucket)` for the
 * "Sent to N people, read by M" UI.
 */
export interface CaseNotificationTimelineRow {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  caseId: string | null;
  caseNumber: string | null;
  taskId: string | null;
  taskNumber: string | null;
  actionUrl: string | null;
  recipientId: string;
  recipientName: string;
  recipientEmail: string | null;
  recipientRole: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
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
  async list(params?: { limit?: number; offset?: number; unreadOnly?: boolean; caseId?: string }) {
    // Phase 1.2a (2026-05-04): caseId is an optional UUID query param the
    // backend uses to scope the feed to one case. Used by CaseDetailPage's
    // Notifications tab. Backend silently ignores invalid UUIDs.
    const queryParams: Record<string, unknown> = {
      limit: params?.limit ?? 20,
      offset: params?.offset ?? 0,
      unreadOnly: params?.unreadOnly ?? false,
    };
    if (params?.caseId) {
      queryParams.caseId = params.caseId;
    }
    const response = (await apiService.get<AppNotification[]>('/notifications', queryParams, {
      useCache: false,
    })) as unknown as NotificationListApiResponse;

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

  // Phase 2.2 (2026-05-04): restore soft-deleted notification(s) within
  // the 30-day window. Backend supports both single-id (PUT
  // /notifications/:id/restore) and batch (PUT /notifications/restore
  // with body.ids[]). Used by the frontend "Undo" toast that fires
  // after a delete or clear-all action.
  async restore(notificationId: string) {
    return apiService.put(`/notifications/${notificationId}/restore`, undefined, {
      useCache: false,
    });
  },

  async restoreBatch(ids: string[]) {
    return apiService.put('/notifications/restore', { ids }, { useCache: false });
  },

  // Phase 3.1 (2026-05-04): case-scoped timeline. Returns every
  // notifications row for the case across all recipients with read
  // status — used by CaseDetailPage's Notifications tab to render
  // "Read by [admin, manager]" badges. Backend route is
  // /api/cases/:id/notifications/timeline behind `case.view`.
  async getCaseTimeline(caseUuid: string) {
    return apiService.get<CaseNotificationTimelineRow[]>(
      `/cases/${caseUuid}/notifications/timeline`,
      undefined,
      { useCache: false }
    );
  },

  // Phase 3.2 (2026-05-04): WhatsApp-style mute. POST /notifications/mute
  // with `{caseId}` mutes the bell for that case until `unmuteCase` is
  // called. Backend `getScopedNotificationRows` filters muted rows out
  // of GET /notifications, so the bell + bell badge stay silent. The
  // case-detail timeline tab uses a different endpoint and is NOT
  // filtered (read-receipts continue to flow there).
  async muteCase(caseId: string, expiresAt?: string) {
    return apiService.post(
      '/notifications/mute',
      { caseId, expiresAt: expiresAt ?? null },
      { useCache: false }
    );
  },

  async unmuteCase(caseId: string) {
    return apiService.delete(`/notifications/mute/case/${caseId}`, { useCache: false });
  },

  async listMutes() {
    return apiService.get<
      Array<{
        id: string;
        caseId: string | null;
        taskId: string | null;
        createdAt: string;
        expiresAt: string | null;
      }>
    >('/notifications/mutes', undefined, { useCache: false });
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

  // Phase 1.3 (2026-05-04): notification preferences. Mirror of the
  // backend `notification_preferences` table — 5 event types × 3 channels
  // (enabled, push, websocket) + quiet hours. Backend auto-creates the
  // row with defaults on first GET, so it's safe to call from a fresh
  // user.
  async getPreferences() {
    return apiService.get<NotificationPreferences>('/notifications/preferences', undefined, {
      useCache: false,
    });
  },

  async updatePreferences(payload: Partial<NotificationPreferences>) {
    return apiService.put<NotificationPreferences>('/notifications/preferences', payload, {
      useCache: false,
    });
  },
};

// Mirror of `notification_preferences` table columns. Quiet hours use
// 'HH:MM' format (24-hour).
export interface NotificationPreferences {
  caseAssignmentEnabled: boolean;
  caseAssignmentPush: boolean;
  caseAssignmentWebsocket: boolean;
  caseReassignmentEnabled: boolean;
  caseReassignmentPush: boolean;
  caseReassignmentWebsocket: boolean;
  caseCompletionEnabled: boolean;
  caseCompletionPush: boolean;
  caseCompletionWebsocket: boolean;
  caseRevocationEnabled: boolean;
  caseRevocationPush: boolean;
  caseRevocationWebsocket: boolean;
  systemNotificationsEnabled: boolean;
  systemNotificationsPush: boolean;
  systemNotificationsWebsocket: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}
