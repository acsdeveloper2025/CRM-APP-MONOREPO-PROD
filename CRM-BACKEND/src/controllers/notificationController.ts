import { Request, Response } from 'express';
import { query } from '@/config/database';
import { logger } from '@/utils/logger';
import { createAuditLog } from '@/utils/auditLogger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export class NotificationController {
  /**
   * Get user's notifications
   */
  static async getNotifications(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { limit = 50, offset = 0, unreadOnly = false } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      let whereClause = 'WHERE user_id = $1';
      const queryParams: any[] = [userId];

      if (unreadOnly === 'true') {
        whereClause += ' AND is_read = false';
      }

      const notificationsQuery = `
        SELECT
          id,
          title,
          message,
          type,
          case_id as "caseId",
          case_number as "caseNumber",
          data,
          action_url as "actionUrl",
          action_type as "actionType",
          is_read as "read",
          read_at as "readAt",
          priority,
          expires_at as "expiresAt",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM notifications
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `;

      queryParams.push(limit, offset);

      const result = await query(notificationsQuery, queryParams);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM notifications
        ${whereClause}
      `;

      const countResult = await query(countQuery, [userId]);
      const total = parseInt(countResult.rows[0].total);

      // Get unread count
      const unreadCountQuery = `
        SELECT COUNT(*) as unread_count
        FROM notifications
        WHERE user_id = $1 AND is_read = false
      `;

      const unreadResult = await query(unreadCountQuery, [userId]);
      const unreadCount = parseInt(unreadResult.rows[0].unread_count);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: total > parseInt(offset as string) + parseInt(limit as string)
        },
        unreadCount,
        message: 'Notifications retrieved successfully',
      });
    } catch (error) {
      logger.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Mark notification as read
   */
  static async markNotificationAsRead(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { notificationId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      const updateQuery = `
        UPDATE notifications
        SET is_read = true, read_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `;

      const result = await query(updateQuery, [notificationId, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
          error: { code: 'NOT_FOUND' },
        });
      }

      res.json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      logger.error('Mark notification as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllNotificationsAsRead(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      const updateQuery = `
        UPDATE notifications
        SET is_read = true, read_at = NOW(), updated_at = NOW()
        WHERE user_id = $1 AND is_read = false
        RETURNING id
      `;

      const result = await query(updateQuery, [userId]);

      res.json({
        success: true,
        data: { updatedCount: result.rows.length },
        message: `${result.rows.length} notifications marked as read`,
      });
    } catch (error) {
      logger.error('Mark all notifications as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { notificationId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      const deleteQuery = `
        DELETE FROM notifications
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `;

      const result = await query(deleteQuery, [notificationId, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
          error: { code: 'NOT_FOUND' },
        });
      }

      res.json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      logger.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Clear all notifications
   */
  static async clearAllNotifications(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      const deleteQuery = `
        DELETE FROM notifications
        WHERE user_id = $1
        RETURNING id
      `;

      const result = await query(deleteQuery, [userId]);

      res.json({
        success: true,
        data: { deletedCount: result.rows.length },
        message: `${result.rows.length} notifications cleared`,
      });
    } catch (error) {
      logger.error('Clear all notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Get user's notification preferences
   */
  static async getNotificationPreferences(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

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
          quiet_hours_end as "quietHoursEnd",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM notification_preferences 
        WHERE user_id = $1
      `;

      const result = await query(selectQuery, [userId]);

      if (result.rows.length === 0) {
        // Create default preferences if none exist
        const insertQuery = `
          INSERT INTO notification_preferences (user_id)
          VALUES ($1)
          RETURNING 
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
            quiet_hours_end as "quietHoursEnd",
            created_at as "createdAt",
            updated_at as "updatedAt"
        `;

        const insertResult = await query(insertQuery, [userId]);
        
        res.json({
          success: true,
          data: insertResult.rows[0],
          message: 'Default notification preferences created',
        });
      } else {
        res.json({
          success: true,
          data: result.rows[0],
          message: 'Notification preferences retrieved successfully',
        });
      }
    } catch (error) {
      logger.error('Get notification preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Update user's notification preferences
   */
  static async updateNotificationPreferences(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const {
        caseAssignmentEnabled,
        caseAssignmentPush,
        caseAssignmentWebsocket,
        caseReassignmentEnabled,
        caseReassignmentPush,
        caseReassignmentWebsocket,
        caseCompletionEnabled,
        caseCompletionPush,
        caseCompletionWebsocket,
        caseRevocationEnabled,
        caseRevocationPush,
        caseRevocationWebsocket,
        systemNotificationsEnabled,
        systemNotificationsPush,
        systemNotificationsWebsocket,
        quietHoursEnabled,
        quietHoursStart,
        quietHoursEnd,
      } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      const updateQuery = `
        UPDATE notification_preferences 
        SET 
          case_assignment_enabled = COALESCE($2, case_assignment_enabled),
          case_assignment_push = COALESCE($3, case_assignment_push),
          case_assignment_websocket = COALESCE($4, case_assignment_websocket),
          case_reassignment_enabled = COALESCE($5, case_reassignment_enabled),
          case_reassignment_push = COALESCE($6, case_reassignment_push),
          case_reassignment_websocket = COALESCE($7, case_reassignment_websocket),
          case_completion_enabled = COALESCE($8, case_completion_enabled),
          case_completion_push = COALESCE($9, case_completion_push),
          case_completion_websocket = COALESCE($10, case_completion_websocket),
          case_revocation_enabled = COALESCE($11, case_revocation_enabled),
          case_revocation_push = COALESCE($12, case_revocation_push),
          case_revocation_websocket = COALESCE($13, case_revocation_websocket),
          system_notifications_enabled = COALESCE($14, system_notifications_enabled),
          system_notifications_push = COALESCE($15, system_notifications_push),
          system_notifications_websocket = COALESCE($16, system_notifications_websocket),
          quiet_hours_enabled = COALESCE($17, quiet_hours_enabled),
          quiet_hours_start = COALESCE($18, quiet_hours_start),
          quiet_hours_end = COALESCE($19, quiet_hours_end),
          updated_at = NOW()
        WHERE user_id = $1
        RETURNING 
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
          quiet_hours_end as "quietHoursEnd",
          updated_at as "updatedAt"
      `;

      const values = [
        userId,
        caseAssignmentEnabled,
        caseAssignmentPush,
        caseAssignmentWebsocket,
        caseReassignmentEnabled,
        caseReassignmentPush,
        caseReassignmentWebsocket,
        caseCompletionEnabled,
        caseCompletionPush,
        caseCompletionWebsocket,
        caseRevocationEnabled,
        caseRevocationPush,
        caseRevocationWebsocket,
        systemNotificationsEnabled,
        systemNotificationsPush,
        systemNotificationsWebsocket,
        quietHoursEnabled,
        quietHoursStart,
        quietHoursEnd,
      ];

      const result = await query(updateQuery, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Notification preferences not found',
          error: { code: 'NOT_FOUND' },
        });
      }

      // Create audit log
      await createAuditLog({
        userId: userId,
        action: 'NOTIFICATION_PREFERENCES_UPDATED',
        entityType: 'NOTIFICATION_PREFERENCES',
        entityId: userId,
        details: {
          updatedFields: Object.keys(req.body),
          newValues: req.body,
        },
      });

      logger.info('Notification preferences updated', {
        userId,
        updatedFields: Object.keys(req.body),
      });

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Notification preferences updated successfully',
      });
    } catch (error) {
      logger.error('Update notification preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Get user's notification tokens (for push notifications)
   */
  static async getNotificationTokens(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      const selectQuery = `
        SELECT 
          id,
          device_id as "deviceId",
          platform,
          is_active as "isActive",
          created_at as "createdAt",
          last_used_at as "lastUsedAt"
        FROM notification_tokens 
        WHERE user_id = $1
        ORDER BY last_used_at DESC
      `;

      const result = await query(selectQuery, [userId]);

      res.json({
        success: true,
        data: result.rows,
        message: 'Notification tokens retrieved successfully',
      });
    } catch (error) {
      logger.error('Get notification tokens error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Register or update a notification token
   */
  static async registerNotificationToken(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { deviceId, platform, pushToken } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      if (!deviceId || !platform || !pushToken) {
        return res.status(400).json({
          success: false,
          message: 'Device ID, platform, and push token are required',
          error: { code: 'MISSING_REQUIRED_FIELDS' },
        });
      }

      // Upsert notification token
      const upsertQuery = `
        INSERT INTO notification_tokens (user_id, device_id, platform, push_token, last_used_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (device_id, platform)
        DO UPDATE SET 
          user_id = EXCLUDED.user_id,
          push_token = EXCLUDED.push_token,
          is_active = true,
          last_used_at = NOW(),
          updated_at = NOW()
        RETURNING 
          id,
          device_id as "deviceId",
          platform,
          is_active as "isActive",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;

      const result = await query(upsertQuery, [userId, deviceId, platform, pushToken]);

      logger.info('Notification token registered', {
        userId,
        deviceId,
        platform,
        tokenId: result.rows[0].id,
      });

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Notification token registered successfully',
      });
    } catch (error) {
      logger.error('Register notification token error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Deactivate a notification token
   */
  static async deactivateNotificationToken(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { tokenId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      const updateQuery = `
        UPDATE notification_tokens
        SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING id, device_id as "deviceId", platform
      `;

      const result = await query(updateQuery, [tokenId, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Notification token not found',
          error: { code: 'NOT_FOUND' },
        });
      }

      logger.info('Notification token deactivated', {
        userId,
        tokenId,
        deviceId: result.rows[0].deviceId,
        platform: result.rows[0].platform,
      });

      res.json({
        success: true,
        message: 'Notification token deactivated successfully',
      });
    } catch (error) {
      logger.error('Deactivate notification token error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Send test notification
   */
  static async sendTestNotification(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { title, message, type = 'TEST', priority = 'MEDIUM', targetUserId } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      if (!title || !message) {
        return res.status(400).json({
          success: false,
          message: 'Title and message are required',
          error: { code: 'MISSING_REQUIRED_FIELDS' },
        });
      }

      const targetUser = targetUserId || userId;

      // Import notification service
      const { NotificationService } = await import('../services/NotificationService');

      const notificationId = await NotificationService.sendNotification({
        userId: targetUser,
        type,
        title,
        message,
        priority,
        data: {
          isTest: true,
          sentBy: userId,
          sentAt: new Date().toISOString(),
        },
      });

      logger.info('Test notification sent', {
        notificationId,
        sentBy: userId,
        targetUser,
        type,
        priority,
      });

      res.json({
        success: true,
        message: 'Test notification sent successfully',
        data: { notificationId },
      });
    } catch (error) {
      logger.error('Send test notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Get notification analytics
   */
  static async getNotificationAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { startDate, endDate, type } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      const whereConditions = ['1=1'];
      const queryParams: any[] = [];

      if (startDate) {
        whereConditions.push(`created_at >= $${queryParams.length + 1}`);
        queryParams.push(startDate);
      }

      if (endDate) {
        whereConditions.push(`created_at <= $${queryParams.length + 1}`);
        queryParams.push(endDate);
      }

      if (type) {
        whereConditions.push(`type = $${queryParams.length + 1}`);
        queryParams.push(type);
      }

      const analyticsQuery = `
        SELECT
          type,
          priority,
          COUNT(*) as total_sent,
          COUNT(CASE WHEN is_read = true THEN 1 END) as total_read,
          COUNT(CASE WHEN is_read = false THEN 1 END) as total_unread,
          ROUND(
            COUNT(CASE WHEN is_read = true THEN 1 END) * 100.0 / COUNT(*), 2
          ) as read_rate,
          AVG(
            CASE WHEN read_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (read_at - created_at))
            END
          ) as avg_read_time_seconds
        FROM notifications
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY type, priority
        ORDER BY total_sent DESC
      `;

      const deliveryQuery = `
        SELECT
          ndl.delivery_method,
          ndl.delivery_status,
          COUNT(*) as count
        FROM notification_delivery_log ndl
        JOIN notifications n ON ndl.notification_id = n.id
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY ndl.delivery_method, ndl.delivery_status
        ORDER BY count DESC
      `;

      const [analyticsResult, deliveryResult] = await Promise.all([
        query(analyticsQuery, queryParams),
        query(deliveryQuery, queryParams),
      ]);

      const analytics = {
        byType: analyticsResult.rows,
        byDeliveryMethod: deliveryResult.rows,
        summary: {
          totalNotifications: analyticsResult.rows.reduce((sum, row) => sum + parseInt(row.total_sent), 0),
          totalRead: analyticsResult.rows.reduce((sum, row) => sum + parseInt(row.total_read), 0),
          totalUnread: analyticsResult.rows.reduce((sum, row) => sum + parseInt(row.total_unread), 0),
          overallReadRate: analyticsResult.rows.length > 0
            ? (analyticsResult.rows.reduce((sum, row) => sum + parseFloat(row.read_rate), 0) / analyticsResult.rows.length).toFixed(2)
            : '0.00',
        },
      };

      res.json({
        success: true,
        data: analytics,
        message: 'Notification analytics retrieved successfully',
      });
    } catch (error) {
      logger.error('Get notification analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Get notification delivery status
   */
  static async getDeliveryStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { notificationId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      const deliveryQuery = `
        SELECT
          ndl.id,
          ndl.delivery_method as "deliveryMethod",
          ndl.delivery_status as "deliveryStatus",
          ndl.attempted_at as "attemptedAt",
          ndl.delivered_at as "deliveredAt",
          ndl.error_message as "errorMessage",
          ndl.metadata
        FROM notification_delivery_log ndl
        JOIN notifications n ON ndl.notification_id = n.id
        WHERE ndl.notification_id = $1 AND n.user_id = $2
        ORDER BY ndl.attempted_at DESC
      `;

      const result = await query(deliveryQuery, [notificationId, userId]);

      res.json({
        success: true,
        data: result.rows,
        message: 'Delivery status retrieved successfully',
      });
    } catch (error) {
      logger.error('Get delivery status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Test push notification connectivity
   */
  static async testPushConnectivity(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      // Import push notification service
      const { PushNotificationService } = await import('../services/PushNotificationService');
      const pushService = PushNotificationService.getInstance();

      const connectivity = await pushService.testConnectivity();

      res.json({
        success: true,
        data: {
          fcm: connectivity.fcm,
          apns: connectivity.apns,
          timestamp: new Date().toISOString(),
        },
        message: 'Push notification connectivity tested',
      });
    } catch (error) {
      logger.error('Test push connectivity error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }
}
