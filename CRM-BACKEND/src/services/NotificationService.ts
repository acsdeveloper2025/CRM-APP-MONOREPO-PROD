import { query } from '@/config/database';
import type { QueryParams } from '@/types/database';
import { logger } from '@/config/logger';
import { getSocketIO } from '@/websocket/server';
import { PushNotificationService } from './PushNotificationService';
import { canTargetUserAccessNotificationObject } from '@/security/notificationScope';

export interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  caseId?: string;
  caseNumber?: string;
  taskId?: string;
  taskNumber?: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
  actionType?: string;
  priority?: NotificationPriority;
  expiresAt?: Date;
}

export type NotificationType =
  | 'CASE_ASSIGNED'
  | 'CASE_REASSIGNED'
  | 'CASE_REMOVED'
  | 'CASE_COMPLETED'
  | 'CASE_REVOKED'
  | 'TASK_REVOKED'
  | 'TASK_COMPLETED'
  | 'SYSTEM_MAINTENANCE'
  | 'APP_UPDATE'
  | 'EMERGENCY_ALERT';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type DeliveryMethod = 'PUSH' | 'WEBSOCKET' | 'EMAIL';

export interface NotificationPreferences {
  userId: string;
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
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface NotificationToken {
  id: string;
  userId: string;
  deviceId?: string;
  platform: 'IOS' | 'ANDROID' | 'WEB' | 'ios' | 'android' | 'web';
  pushToken: string;
  isActive: boolean;
}

export class NotificationService {
  private static pushService = PushNotificationService.getInstance();

  /**
   * Send a notification to a user with multiple delivery methods
   */
  static async sendNotification(notificationData: NotificationData): Promise<string> {
    try {
      const scopedTarget = await canTargetUserAccessNotificationObject(notificationData.userId, {
        caseId: notificationData.caseId,
        taskId: notificationData.taskId,
      });

      if (!scopedTarget.allowed) {
        logger.warn('Skipping notification because target user no longer has object access', {
          userId: notificationData.userId,
          caseId: notificationData.caseId,
          taskId: notificationData.taskId,
          type: notificationData.type,
        });
        return '';
      }

      // Get user preferences
      const preferences = await this.getUserPreferences(notificationData.userId);

      // Check if notification type is enabled
      if (!this.isNotificationTypeEnabled(notificationData.type, preferences)) {
        logger.info(
          `Notification type ${notificationData.type} is disabled for user ${notificationData.userId}`
        );
        return '';
      }

      // Check quiet hours
      if (this.isInQuietHours(preferences)) {
        logger.info(`User ${notificationData.userId} is in quiet hours, skipping notification`);
        return '';
      }

      const normalizedNotification = {
        ...notificationData,
        actionUrl: scopedTarget.actionUrl || notificationData.actionUrl || '/dashboard',
      };

      // Create notification record
      const notificationId = await this.createNotificationRecord(normalizedNotification);

      const deliveryResults = await Promise.allSettled([
        this.shouldSendViaWebSocket(notificationData.type, preferences)
          ? this.sendWebSocketNotification(notificationId, normalizedNotification)
          : Promise.resolve(false),
        this.shouldSendViaPush(notificationData.type, preferences)
          ? this.sendPushNotification(notificationId, normalizedNotification)
          : Promise.resolve(false),
      ]);

      const wasDelivered = deliveryResults.some(
        result => result.status === 'fulfilled' && result.value === true
      );
      const hadError = deliveryResults.some(result => result.status === 'rejected');

      if (wasDelivered) {
        await this.updateNotificationDeliveryStatus(
          notificationId,
          'DELIVERED',
          notificationData.type === 'CASE_ASSIGNED' ? 'delivered via user channel' : undefined
        );
      } else if (hadError) {
        await this.updateNotificationDeliveryStatus(
          notificationId,
          'FAILED',
          'notification delivery failed'
        );
      }

      logger.info(`Notification sent successfully`, {
        notificationId,
        userId: notificationData.userId,
        type: notificationData.type,
        title: notificationData.title,
      });

      return notificationId;
    } catch (error) {
      logger.error('Failed to send notification:', error);
      throw error;
    }
  }

  /**
   * Send bulk notifications to multiple users
   */
  static async sendBulkNotification(
    userIds: string[],
    notificationTemplate: Omit<NotificationData, 'userId'>
  ): Promise<string[]> {
    try {
      const notificationPromises = userIds.map(userId =>
        this.sendNotification({ ...notificationTemplate, userId })
      );

      const results = await Promise.allSettled(notificationPromises);

      const successfulNotifications = results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
        .map(result => result.value)
        .filter(id => id !== '');

      const failedCount = results.length - successfulNotifications.length;

      logger.info(`Bulk notification completed`, {
        totalUsers: userIds.length,
        successful: successfulNotifications.length,
        failed: failedCount,
        type: notificationTemplate.type,
      });

      return successfulNotifications;
    } catch (error) {
      logger.error('Failed to send bulk notification:', error);
      throw error;
    }
  }

  /**
   * Create notification record in database
   */
  private static async createNotificationRecord(data: NotificationData): Promise<string> {
    const insertQuery = `
      INSERT INTO notifications (
        user_id, title, message, type, case_id, case_number, task_id, task_number,
        data, action_url, action_type, priority, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `;

    const values = [
      data.userId,
      data.title,
      data.message,
      data.type,
      data.caseId || null,
      data.caseNumber || null,
      data.taskId || null,
      data.taskNumber || null,
      JSON.stringify(data.data || {}),
      data.actionUrl || null,
      data.actionType || 'NAVIGATE',
      data.priority || 'MEDIUM',
      data.expiresAt || null,
    ];

    const result = await query(insertQuery, values);
    return result.rows[0].id;
  }

  /**
   * Send WebSocket notification
   */
  private static async sendWebSocketNotification(
    notificationId: string,
    data: NotificationData
  ): Promise<boolean> {
    try {
      const io = getSocketIO();
      if (!io) {
        throw new Error('WebSocket server not available');
      }

      const wsPayload = {
        id: notificationId,
        title: data.title,
        message: data.message,
        type: data.type,
        caseId: data.caseId,
        caseNumber: data.caseNumber,
        data: data.data,
        actionUrl: data.actionUrl,
        actionType: data.actionType,
        priority: data.priority,
        timestamp: new Date().toISOString(),
      };

      // Send to user's room
      io.to(`user:${data.userId}`).emit('notification', wsPayload);

      // Log delivery attempt
      await this.logDeliveryAttempt(notificationId, 'WEBSOCKET', 'SENT');
      await this.updateNotificationDeliveryStatus(notificationId, 'SENT');

      logger.info(`WebSocket notification sent`, {
        notificationId,
        userId: data.userId,
        type: data.type,
      });
      return true;
    } catch (error) {
      await this.logDeliveryAttempt(notificationId, 'WEBSOCKET', 'FAILED', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Send push notification
   */
  private static async sendPushNotification(
    notificationId: string,
    data: NotificationData
  ): Promise<boolean> {
    try {
      // Get user's active push tokens
      const tokens = await this.getUserPushTokens(data.userId);

      if (tokens.length === 0) {
        logger.info(`No push tokens found for user ${data.userId}`);
        return false;
      }

      // Send to each device
      const pushPromises = tokens.map(token => this.sendPushToDevice(notificationId, data, token));
      const pushResults = await Promise.allSettled(pushPromises);
      return pushResults.some(result => result.status === 'fulfilled' && result.value === true);
    } catch (error) {
      logger.error('Failed to send push notification:', error);
      return false;
    }
  }

  /**
   * Send push notification to specific device
   */
  private static async sendPushToDevice(
    notificationId: string,
    data: NotificationData,
    token: NotificationToken
  ): Promise<boolean> {
    try {
      const pushPayload = {
        title: data.title,
        body: data.message,
        data: {
          notificationId,
          type: data.type,
          caseId: data.caseId,
          caseNumber: data.caseNumber,
          taskId: data.taskId,
          taskNumber: data.taskNumber,
          actionUrl: data.actionUrl,
          actionType: data.actionType,
          ...data.data,
        },
        priority: data.priority === 'URGENT' ? ('high' as const) : ('normal' as const),
        badge: 1,
        sound: 'default',
      };

      // Send actual push notification
      const result = await this.pushService.sendPushToTokens(
        [
          {
            id: token.id,
            userId: token.userId,
            deviceId: token.deviceId,
            platform: token.platform.toLowerCase() as 'ios' | 'android' | 'web',
            pushToken: token.pushToken,
            isActive: token.isActive,
          },
        ],
        pushPayload
      );

      if (result.success > 0) {
        logger.info(`Push notification sent successfully to ${token.platform} device`, {
          notificationId,
          deviceId: token.deviceId,
          platform: token.platform,
          userId: token.userId,
        });

        // Log successful delivery attempt
        await this.logDeliveryAttempt(notificationId, 'PUSH', 'SENT', {
          deviceId: token.deviceId,
          platform: token.platform,
          pushTokenUsed: token.pushToken,
        });
        await this.updateNotificationDeliveryStatus(notificationId, 'SENT');
        return true;
      } else {
        // Log failed delivery attempt
        await this.logDeliveryAttempt(notificationId, 'PUSH', 'FAILED', {
          deviceId: token.deviceId,
          platform: token.platform,
          errors: result.errors,
          pushTokenUsed: token.pushToken,
        });

        logger.warn(`Push notification failed for ${token.platform} device`, {
          notificationId,
          deviceId: token.deviceId,
          platform: token.platform,
          userId: token.userId,
          errors: result.errors,
        });
        return false;
      }
    } catch (error) {
      await this.logDeliveryAttempt(notificationId, 'PUSH', 'FAILED', {
        deviceId: token.deviceId,
        platform: token.platform,
        pushTokenUsed: token.pushToken,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get user's notification preferences
   */
  static async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const selectQuery = `
      SELECT 
        user_id as "userId",
        case_assignment_enabled as "caseAssignmentEnabled",
        case_assignment_push as "caseAssignmentPush",
        case_assignment_websocket as "caseAssignmentWebsocket",
        case_reassignment_enabled as "caseReassignmentEnabled",
        case_reassignment_push as "caseReassignmentPush",
        case_reassignment_websocket as "caseReassignmentWebsocket",
        case_completion_enabled as "caseCompletionEnabled",
        case_completion_push as "caseCompletionPush",
        case_completion_websocket as "caseCompletionWebsocket",
        case_revocation_enabled as "caseRevocationEnabled",
        case_revocation_push as "caseRevocationPush",
        case_revocation_websocket as "caseRevocationWebsocket",
        system_notifications_enabled as "systemNotificationsEnabled",
        system_notifications_push as "systemNotificationsPush",
        system_notifications_websocket as "systemNotificationsWebsocket",
        quiet_hours_enabled as "quietHoursEnabled",
        quiet_hours_start as "quietHoursStart",
        quiet_hours_end as "quietHoursEnd"
      FROM notification_preferences 
      WHERE user_id = $1
    `;

    const result = await query(selectQuery, [userId]);

    if (result.rows.length === 0) {
      // Create default preferences if none exist
      await this.createDefaultPreferences(userId);
      return this.getUserPreferences(userId);
    }

    return result.rows[0];
  }

  /**
   * Create default notification preferences for a user
   */
  private static async createDefaultPreferences(userId: string): Promise<void> {
    const insertQuery = `
      INSERT INTO notification_preferences (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `;

    await query(insertQuery, [userId]);
  }

  /**
   * Get user's active push tokens
   */
  private static async getUserPushTokens(userId: string): Promise<NotificationToken[]> {
    const selectQuery = `
      SELECT 
        id, user_id as "userId",
        device_id as "deviceId",
        platform, push_token as "pushToken", is_active as "isActive"
      FROM notification_tokens 
      WHERE user_id = $1 AND is_active = true
    `;

    const result = await query(selectQuery, [userId]);
    return result.rows;
  }

  /**
   * Log delivery attempt
   */
  private static async logDeliveryAttempt(
    notificationId: string,
    deliveryMethod: DeliveryMethod,
    deliveryStatus: string,
    additionalData?: Record<string, unknown>
  ): Promise<void> {
    try {
      const insertQuery = `
        INSERT INTO notification_delivery_log (
          notification_id, delivery_method, delivery_status,
          device_id, platform, push_token_used, error_code, error_message, response_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      const values = [
        notificationId,
        deliveryMethod,
        deliveryStatus,
        additionalData?.deviceId || null,
        additionalData?.platform || null,
        additionalData?.pushTokenUsed || null,
        additionalData?.errorCode || null,
        additionalData?.errorMessage || null,
        JSON.stringify(additionalData || {}),
      ];

      await query(insertQuery, values as QueryParams);
    } catch (error) {
      logger.error('Failed to log delivery attempt:', error);
    }
  }

  private static async updateNotificationDeliveryStatus(
    notificationId: string,
    status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED',
    failureReason?: string
  ): Promise<void> {
    const setDeliveredAt = status === 'DELIVERED' ? 'NOW()' : 'delivered_at';
    const setSentAt =
      status === 'SENT' || status === 'DELIVERED' ? 'COALESCE(sent_at, NOW())' : 'sent_at';

    await query(
      `UPDATE notifications
       SET delivery_status = $2,
           sent_at = ${setSentAt},
           delivered_at = ${setDeliveredAt},
           acknowledged_at = acknowledged_at,
           updated_at = NOW(),
           data = CASE
             WHEN $3::text IS NULL THEN data
             ELSE COALESCE(data, '{}'::jsonb) || jsonb_build_object('deliveryNote', $3::text)
           END
       WHERE id = $1`,
      [notificationId, status, failureReason]
    );
  }

  /**
   * Check if notification type is enabled for user
   */
  private static isNotificationTypeEnabled(
    type: NotificationType,
    preferences: NotificationPreferences
  ): boolean {
    switch (type) {
      case 'CASE_ASSIGNED':
        return preferences.caseAssignmentEnabled;
      case 'CASE_REASSIGNED':
      case 'CASE_REMOVED':
        return preferences.caseReassignmentEnabled;
      case 'CASE_COMPLETED':
      case 'TASK_COMPLETED':
        return preferences.caseCompletionEnabled;
      case 'CASE_REVOKED':
        return preferences.caseRevocationEnabled;
      case 'SYSTEM_MAINTENANCE':
      case 'APP_UPDATE':
      case 'EMERGENCY_ALERT':
        return preferences.systemNotificationsEnabled;
      default:
        return true;
    }
  }

  /**
   * Check if should send via WebSocket
   */
  private static shouldSendViaWebSocket(
    type: NotificationType,
    preferences: NotificationPreferences
  ): boolean {
    switch (type) {
      case 'CASE_ASSIGNED':
        return preferences.caseAssignmentWebsocket;
      case 'CASE_REASSIGNED':
      case 'CASE_REMOVED':
        return preferences.caseReassignmentWebsocket;
      case 'CASE_COMPLETED':
      case 'TASK_COMPLETED':
        return preferences.caseCompletionWebsocket;
      case 'CASE_REVOKED':
        return preferences.caseRevocationWebsocket;
      case 'SYSTEM_MAINTENANCE':
      case 'APP_UPDATE':
      case 'EMERGENCY_ALERT':
        return preferences.systemNotificationsWebsocket;
      default:
        return true;
    }
  }

  /**
   * Check if should send via push notification
   */
  private static shouldSendViaPush(
    type: NotificationType,
    preferences: NotificationPreferences
  ): boolean {
    switch (type) {
      case 'CASE_ASSIGNED':
        return preferences.caseAssignmentPush;
      case 'CASE_REASSIGNED':
      case 'CASE_REMOVED':
        return preferences.caseReassignmentPush;
      case 'CASE_COMPLETED':
      case 'TASK_COMPLETED':
        return preferences.caseCompletionPush;
      case 'CASE_REVOKED':
        return preferences.caseRevocationPush;
      case 'SYSTEM_MAINTENANCE':
      case 'APP_UPDATE':
      case 'EMERGENCY_ALERT':
        return preferences.systemNotificationsPush;
      default:
        return false;
    }
  }

  /**
   * Check if user is in quiet hours
   */
  private static isInQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHoursEnabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 8); // HH:MM:SS format

    const startTime = preferences.quietHoursStart;
    const endTime = preferences.quietHoursEnd;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }
}
