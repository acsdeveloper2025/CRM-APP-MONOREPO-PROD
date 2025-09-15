import { query } from '@/config/database';
import { logger } from '@/utils/logger';
import { getSocketIO } from '@/websocket/server';
import { PushNotificationService } from './PushNotificationService';
import { config } from '@/config';

export interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  caseId?: string;
  caseNumber?: string;
  data?: Record<string, any>;
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
  | 'CASE_APPROVED' 
  | 'CASE_REJECTED'
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
  deviceId: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
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
      // Get user preferences
      const preferences = await this.getUserPreferences(notificationData.userId);

      // Check if notification type is enabled
      if (!this.isNotificationTypeEnabled(notificationData.type, preferences)) {
        logger.info(`Notification type ${notificationData.type} is disabled for user ${notificationData.userId}`);
        return '';
      }

      // Check quiet hours
      if (this.isInQuietHours(preferences)) {
        logger.info(`User ${notificationData.userId} is in quiet hours, skipping notification`);
        return '';
      }

      // Create notification record
      const notificationId = await this.createNotificationRecord(notificationData);

      // Send via enabled delivery methods
      const deliveryPromises: Promise<void>[] = [];

      // WebSocket delivery
      if (this.shouldSendViaWebSocket(notificationData.type, preferences)) {
        deliveryPromises.push(this.sendWebSocketNotification(notificationId, notificationData));
      }

      // Push notification delivery
      if (this.shouldSendViaPush(notificationData.type, preferences)) {
        deliveryPromises.push(this.sendPushNotification(notificationId, notificationData));
      }

      // Execute all delivery methods
      await Promise.allSettled(deliveryPromises);

      logger.info(`Notification sent successfully`, {
        notificationId,
        userId: notificationData.userId,
        type: notificationData.type,
        title: notificationData.title
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
        type: notificationTemplate.type
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
        user_id, title, message, type, case_id, case_number,
        data, action_url, action_type, priority, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `;

    const values = [
      data.userId,
      data.title,
      data.message,
      data.type,
      data.caseId || null,
      data.caseNumber || null,
      JSON.stringify(data.data || {}),
      data.actionUrl || null,
      data.actionType || 'NAVIGATE',
      data.priority || 'MEDIUM',
      data.expiresAt || null
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
  ): Promise<void> {
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
        timestamp: new Date().toISOString()
      };

      // Send to user's room
      io.to(`user:${data.userId}`).emit('notification', wsPayload);

      // Log delivery attempt
      await this.logDeliveryAttempt(notificationId, 'WEBSOCKET', 'SENT');

      logger.info(`WebSocket notification sent`, {
        notificationId,
        userId: data.userId,
        type: data.type
      });
    } catch (error) {
      await this.logDeliveryAttempt(notificationId, 'WEBSOCKET', 'FAILED', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Send push notification
   */
  private static async sendPushNotification(
    notificationId: string,
    data: NotificationData
  ): Promise<void> {
    try {
      // Get user's active push tokens
      const tokens = await this.getUserPushTokens(data.userId);
      
      if (tokens.length === 0) {
        logger.info(`No push tokens found for user ${data.userId}`);
        return;
      }

      // Send to each device
      const pushPromises = tokens.map(token => 
        this.sendPushToDevice(notificationId, data, token)
      );

      await Promise.allSettled(pushPromises);
    } catch (error) {
      logger.error('Failed to send push notification:', error);
      throw error;
    }
  }

  /**
   * Send push notification to specific device
   */
  private static async sendPushToDevice(
    notificationId: string,
    data: NotificationData,
    token: NotificationToken
  ): Promise<void> {
    try {
      const pushPayload = {
        title: data.title,
        body: data.message,
        data: {
          notificationId,
          type: data.type,
          caseId: data.caseId,
          caseNumber: data.caseNumber,
          actionUrl: data.actionUrl,
          actionType: data.actionType,
          ...data.data
        },
        priority: data.priority === 'URGENT' ? 'high' as const : 'normal' as const,
        badge: 1,
        sound: 'default',
      };

      // Send actual push notification
      const result = await this.pushService.sendPushNotification([token.userId], pushPayload);

      if (result.success > 0) {
        logger.info(`Push notification sent successfully to ${token.platform} device`, {
          notificationId,
          deviceId: token.deviceId,
          platform: token.platform,
          userId: token.userId
        });

        // Log successful delivery attempt
        await this.logDeliveryAttempt(notificationId, 'PUSH', 'SENT', {
          deviceId: token.deviceId,
          platform: token.platform,
          pushTokenUsed: token.pushToken.substring(0, 20) + '...'
        });
      } else {
        // Log failed delivery attempt
        await this.logDeliveryAttempt(notificationId, 'PUSH', 'FAILED', {
          deviceId: token.deviceId,
          platform: token.platform,
          errors: result.errors,
          pushTokenUsed: token.pushToken.substring(0, 20) + '...'
        });

        logger.warn(`Push notification failed for ${token.platform} device`, {
          notificationId,
          deviceId: token.deviceId,
          platform: token.platform,
          userId: token.userId,
          errors: result.errors
        });
      }

    } catch (error) {
      await this.logDeliveryAttempt(notificationId, 'PUSH', 'FAILED', {
        deviceId: token.deviceId,
        platform: token.platform,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
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
        id, user_id as "userId", device_id as "deviceId",
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
    additionalData?: Record<string, any>
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
        JSON.stringify(additionalData || {})
      ];

      await query(insertQuery, values);
    } catch (error) {
      logger.error('Failed to log delivery attempt:', error);
    }
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
