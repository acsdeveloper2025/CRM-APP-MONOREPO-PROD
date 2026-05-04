import type { Request, Response } from 'express';
import { query } from '@/config/database';
import { logger } from '@/utils/logger';
import { createAuditLog } from '@/utils/auditLogger';
import type { QueryParams } from '@/types/database';
import { filterNotificationsByCurrentScope } from '@/security/notificationScope';
import { getSocketIO } from '@/websocket/server';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    permissionCodes?: string[];
    assignedClientIds?: number[];
    assignedProductIds?: number[];
  };
}

export class NotificationController {
  private static getSingleParam(value: string | string[] | undefined): string | null {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return null;
  }

  // Phase 1.2a (2026-05-04): per-case feed support — frontend CaseDetailPage
  // and mobile NotificationCenter pass `?caseId=<uuid>` to scope the feed
  // to a single case. Both endpoints (GET /api/notifications and GET
  // /api/mobile/notifications) flow through this method, so one filter
  // covers all callers. UUID validation upstream in `getNotifications`
  // before this is called.
  private static async getScopedNotificationRows(
    user: NonNullable<AuthenticatedRequest['user']>,
    caseId?: string | null
  ) {
    const sqlCaseId = caseId && caseId.length > 0 ? caseId : null;
    const result = await query<{
      id: string;
      title: string;
      message: string;
      type: string;
      caseId: string | null;
      caseNumber: string | null;
      taskId: string | null;
      taskNumber: string | null;
      data: Record<string, unknown> | null;
      actionUrl: string | null;
      actionType: string | null;
      isRead: boolean;
      readAt: string | null;
      deliveryStatus: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | null;
      priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
      expiresAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>(
      `
        SELECT
          id,
          title,
          message,
          type,
          case_id as "case_id",
          case_number as "case_number",
          task_id as "task_id",
          task_number as "task_number",
          data,
          action_url as "action_url",
          action_type as "action_type",
          is_read as "is_read",
          read_at as "read_at",
          delivery_status as "delivery_status",
          priority,
          expires_at as "expires_at",
          created_at as "created_at",
          updated_at as "updated_at"
        FROM notifications
        WHERE user_id = $1
          AND is_deleted = false
          AND ($2::uuid IS NULL OR case_id = $2::uuid)
          -- Phase 3.2 (2026-05-04): exclude muted cases. A mute is
          -- active if expires_at IS NULL or in the future. When the
          -- caller is *already* asking for a specific case feed
          -- (?caseId=...) we still hide muted ones (consistent with
          -- WhatsApp behavior — muted = silent on the bell, but the
          -- timeline tab on CaseDetailPage uses a different endpoint).
          AND NOT EXISTS (
            SELECT 1
            FROM notification_mutes nm
            WHERE nm.user_id = $1
              AND nm.case_id IS NOT NULL
              AND nm.case_id = notifications.case_id
              AND (nm.expires_at IS NULL OR nm.expires_at > NOW())
          )
          AND NOT EXISTS (
            SELECT 1
            FROM notification_mutes nm
            WHERE nm.user_id = $1
              AND nm.task_id IS NOT NULL
              AND nm.task_id = notifications.task_id
              AND (nm.expires_at IS NULL OR nm.expires_at > NOW())
          )
        ORDER BY created_at DESC
      `,
      [user.id, sqlCaseId]
    );

    const { visibleIds, actionTargets } = await filterNotificationsByCurrentScope(
      {
        id: user.id,
        permissionCodes: user.permissionCodes,
        assignedClientIds: user.assignedClientIds,
        assignedProductIds: user.assignedProductIds,
      },
      result.rows.map(row => ({
        id: row.id,
        userId: user.id,
        caseId: row.caseId,
        taskId: row.taskId,
      }))
    );

    return result.rows
      .filter(row => visibleIds.has(row.id))
      .map(row => ({
        ...row,
        actionUrl: actionTargets.get(row.id) || '/dashboard',
      }));
  }

  private static async getScopedNotificationRow(
    user: NonNullable<AuthenticatedRequest['user']>,
    notificationId: string
  ) {
    const rows = await this.getScopedNotificationRows(user);
    return rows.find(row => row.id === notificationId);
  }

  /**
   * Phase 3.1 (2026-05-04): case-scoped notification timeline with
   * cross-recipient visibility. Used by CaseDetailPage's Notifications
   * tab to show "Read by [admin, manager]" badges. Auth gate is
   * `case.view` (route-level); the response contains every
   * `notifications` row for the case_id, joined with users.name +
   * users.role to render recipient + read-receipt info.
   *
   * Distinct from `getNotifications` (which is per-user-scoped). This
   * endpoint deliberately bypasses the per-user RBAC scope filter
   * because case-detail viewers (managers, admins, case creator) need
   * cross-recipient awareness for that case. The route-level auth
   * still enforces "you can only call this if you can view the case."
   */
  static async getCaseNotificationTimeline(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }
      const caseId = this.getSingleParam(req.params.caseId);
      if (
        !caseId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Valid case UUID required',
          error: { code: 'INVALID_REQUEST' },
        });
      }
      const result = await query<{
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
      }>(
        `
          SELECT
            n.id,
            n.type,
            n.title,
            n.message,
            n.priority,
            n.case_id     as "case_id",
            n.case_number as "case_number",
            n.task_id     as "task_id",
            n.task_number as "task_number",
            n.action_url  as "action_url",
            n.user_id     as "recipient_id",
            u.name        as "recipient_name",
            u.email       as "recipient_email",
            (
              SELECT r.name
              FROM user_roles ur
              JOIN roles_v2 r ON r.id = ur.role_id
              WHERE ur.user_id = u.id
              ORDER BY r.name
              LIMIT 1
            ) as "recipient_role",
            n.is_read     as "is_read",
            n.read_at     as "read_at",
            n.created_at  as "created_at"
          FROM notifications n
          JOIN users u ON u.id = n.user_id
          WHERE n.case_id = $1
            AND n.is_deleted = false
          ORDER BY n.created_at DESC
        `,
        [caseId]
      );
      return res.json({
        success: true,
        data: result.rows,
        message: 'Case notification timeline retrieved',
      });
    } catch (error) {
      logger.error('Get case notification timeline error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Get user's notifications
   */
  static async getNotifications(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { limit = 50, offset = 0, unreadOnly = false } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      // Phase 1.2a: optional ?caseId=<uuid> for per-case feed.
      // Validated as UUID before passing through; invalid input falls
      // through as null (full feed) rather than 400 to keep this
      // backwards compatible.
      const rawCaseIdQuery = req.query.caseId;
      const rawCaseId =
        typeof rawCaseIdQuery === 'string'
          ? rawCaseIdQuery
          : Array.isArray(rawCaseIdQuery) && typeof rawCaseIdQuery[0] === 'string'
            ? rawCaseIdQuery[0]
            : null;
      const caseIdFilter =
        rawCaseId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawCaseId)
          ? rawCaseId
          : null;

      const rows = await this.getScopedNotificationRows(req.user!, caseIdFilter);
      const visibleRows = unreadOnly === 'true' ? rows.filter(row => !row.isRead) : rows;
      const total = visibleRows.length;
      const unreadCount = rows.filter(row => !row.isRead).length;
      const normalizedLimit = Number(limit);
      const normalizedOffset = Number(offset);
      const pagedRows = visibleRows.slice(normalizedOffset, normalizedOffset + normalizedLimit);

      res.json({
        success: true,
        data: pagedRows,
        pagination: {
          total,
          limit: normalizedLimit,
          offset: normalizedOffset,
          hasMore: total > normalizedOffset + normalizedLimit,
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
      const userId = req.user!.id;
      const notificationId = this.getSingleParam(req.params.notificationId);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      if (!notificationId) {
        return res.status(400).json({
          success: false,
          message: 'Notification ID is required',
          error: { code: 'INVALID_REQUEST' },
        });
      }

      const scopedNotification = await this.getScopedNotificationRow(req.user!, notificationId);
      if (!scopedNotification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
          error: { code: 'NOT_FOUND' },
        });
      }

      await query(
        `
          UPDATE notifications
          SET is_read = true, read_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND user_id = $2
        `,
        [notificationId, userId]
      );

      // Phase 3.1 (2026-05-04): broadcast read-receipt to anyone viewing
      // the case's notification timeline. Subscribers (CaseDetailPage
      // Notifications tab) refetch on this event so the "Read by X"
      // badges update in real time. Best-effort — if no socket server
      // initialized, skip.
      if (scopedNotification.caseId) {
        try {
          const io = getSocketIO();
          if (io) {
            io.to(`case:${scopedNotification.caseId}`).emit('notification:read', {
              notificationId,
              caseId: scopedNotification.caseId,
              userId,
              readAt: new Date().toISOString(),
            });
          }
        } catch (wsError) {
          logger.warn('Failed to broadcast notification:read', { wsError });
        }
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
   * Mark notification as unread
   */
  static async markNotificationAsUnread(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const notificationId = this.getSingleParam(req.params.notificationId);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      if (!notificationId) {
        return res.status(400).json({
          success: false,
          message: 'Notification ID is required',
          error: { code: 'INVALID_REQUEST' },
        });
      }

      const scopedNotification = await this.getScopedNotificationRow(req.user!, notificationId);
      if (!scopedNotification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
          error: { code: 'NOT_FOUND' },
        });
      }

      await query(
        `
          UPDATE notifications
          SET is_read = false, read_at = NULL, updated_at = NOW()
          WHERE id = $1 AND user_id = $2
        `,
        [notificationId, userId]
      );

      return res.json({
        success: true,
        message: 'Notification marked as unread',
      });
    } catch (error) {
      logger.error('Mark notification as unread error:', error);
      return res.status(500).json({
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
      const userId = req.user!.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      const scopedRows = await this.getScopedNotificationRows(req.user!);
      const idsToUpdate = scopedRows.filter(row => !row.isRead).map(row => row.id);

      if (idsToUpdate.length > 0) {
        await query(
          `
            UPDATE notifications
            SET is_read = true, read_at = NOW(), updated_at = NOW()
            WHERE user_id = $1 AND id = ANY($2::uuid[])
          `,
          [userId, idsToUpdate]
        );
      }

      res.json({
        success: true,
        data: { updatedCount: idsToUpdate.length },
        message: `${idsToUpdate.length} notifications marked as read`,
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
      const userId = req.user!.id;
      const notificationId = this.getSingleParam(req.params.notificationId);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      if (!notificationId) {
        return res.status(400).json({
          success: false,
          message: 'Notification ID is required',
          error: { code: 'INVALID_REQUEST' },
        });
      }

      const scopedNotification = await this.getScopedNotificationRow(req.user!, notificationId);
      if (!scopedNotification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
          error: { code: 'NOT_FOUND' },
        });
      }

      // Phase 2.2 (2026-05-04): soft-delete. Setting `is_deleted=true`
      // excludes the row from GET /notifications via the partial-index
      // filter (added in DB migration). The row stays for 30 days for
      // undo/audit; a future cron purges `is_deleted=true AND deleted_at
      // < now() - 30 days`. Also returns `restoredAt` so the frontend
      // can offer an Undo toast — the client passes the id back to
      // restore.
      await query(
        `
          UPDATE notifications
          SET is_deleted = true, deleted_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND user_id = $2 AND is_deleted = false
        `,
        [notificationId, userId]
      );

      res.json({
        success: true,
        data: { id: notificationId, deletedAt: new Date().toISOString() },
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
   * Phase 2.2 (2026-05-04): restore soft-deleted notification(s).
   * Used by the frontend "Undo" toast that appears after delete /
   * clear-all. Accepts either a single id (PUT
   * /notifications/:id/restore) or a batch (PUT
   * /notifications/restore with body { ids: string[] }).
   *
   * Only the original recipient (user_id match) can restore. Rows
   * older than the 30-day soft-delete TTL may have been hard-purged
   * by the cleanup cron — those rows return 404.
   */
  static async restoreNotification(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }
      const singleId = this.getSingleParam(req.params.notificationId);
      const bodyIds = Array.isArray((req.body as { ids?: unknown[] })?.ids)
        ? (req.body as { ids: unknown[] }).ids.filter((v): v is string => typeof v === 'string')
        : [];
      const ids = singleId ? [singleId] : bodyIds;
      if (ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No notification ids supplied',
          error: { code: 'INVALID_REQUEST' },
        });
      }
      const result = await query(
        `UPDATE notifications
           SET is_deleted = false, deleted_at = NULL, updated_at = NOW()
         WHERE user_id = $1 AND id = ANY($2::uuid[]) AND is_deleted = true`,
        [userId, ids]
      );
      return res.json({
        success: true,
        data: { restoredCount: result.rowCount ?? 0, restoredIds: ids },
        message: `${result.rowCount ?? 0} notifications restored`,
      });
    } catch (error) {
      logger.error('Restore notification error:', error);
      return res.status(500).json({
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
      const userId = req.user!.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      const scopedRows = await this.getScopedNotificationRows(req.user!);
      const idsToDelete = scopedRows.map(row => row.id);

      // Phase 2.2 (2026-05-04): soft-delete clear-all. Same shape as
      // single-id delete — sets is_deleted=true. Returns the list so
      // a frontend "Undo" can restore the batch.
      if (idsToDelete.length > 0) {
        await query(
          `
            UPDATE notifications
            SET is_deleted = true, deleted_at = NOW(), updated_at = NOW()
            WHERE user_id = $1 AND id = ANY($2::uuid[]) AND is_deleted = false
          `,
          [userId, idsToDelete]
        );
      }

      res.json({
        success: true,
        data: {
          deletedCount: idsToDelete.length,
          deletedIds: idsToDelete,
          deletedAt: new Date().toISOString(),
        },
        message: `${idsToDelete.length} notifications cleared`,
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
      const userId = req.user!.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      const selectQuery = `
        SELECT 
          user_id as user_id,
          case_assignment_enabled as "case_assignment_enabled",
          case_assignment_push as "case_assignment_push",
          case_assignment_websocket as "case_assignment_websocket",
          case_reassignment_enabled as "case_reassignment_enabled",
          case_reassignment_push as "case_reassignment_push",
          case_reassignment_websocket as "case_reassignment_websocket",
          case_completion_enabled as "case_completion_enabled",
          case_completion_push as "case_completion_push",
          case_completion_websocket as "case_completion_websocket",
          case_revocation_enabled as "case_revocation_enabled",
          case_revocation_push as "case_revocation_push",
          case_revocation_websocket as "case_revocation_websocket",
          system_notifications_enabled as "system_notifications_enabled",
          system_notifications_push as "system_notifications_push",
          system_notifications_websocket as "system_notifications_websocket",
          quiet_hours_enabled as "quiet_hours_enabled",
          quiet_hours_start as "quiet_hours_start",
          quiet_hours_end as "quiet_hours_end",
          created_at as created_at,
          updated_at as updated_at
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
            user_id as user_id,
            case_assignment_enabled as "case_assignment_enabled",
            case_assignment_push as "case_assignment_push",
            case_assignment_websocket as "case_assignment_websocket",
            case_reassignment_enabled as "case_reassignment_enabled",
            case_reassignment_push as "case_reassignment_push",
            case_reassignment_websocket as "case_reassignment_websocket",
            case_completion_enabled as "case_completion_enabled",
            case_completion_push as "case_completion_push",
            case_completion_websocket as "case_completion_websocket",
            case_revocation_enabled as "case_revocation_enabled",
            case_revocation_push as "case_revocation_push",
            case_revocation_websocket as "case_revocation_websocket",
            system_notifications_enabled as "system_notifications_enabled",
            system_notifications_push as "system_notifications_push",
            system_notifications_websocket as "system_notifications_websocket",
            quiet_hours_enabled as "quiet_hours_enabled",
            quiet_hours_start as "quiet_hours_start",
            quiet_hours_end as "quiet_hours_end",
            created_at as created_at,
            updated_at as updated_at
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
      const userId = req.user!.id;
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
          user_id as user_id,
          case_assignment_enabled as "case_assignment_enabled",
          case_assignment_push as "case_assignment_push",
          case_assignment_websocket as "case_assignment_websocket",
          case_reassignment_enabled as "case_reassignment_enabled",
          case_reassignment_push as "case_reassignment_push",
          case_reassignment_websocket as "case_reassignment_websocket",
          case_completion_enabled as "case_completion_enabled",
          case_completion_push as "case_completion_push",
          case_completion_websocket as "case_completion_websocket",
          case_revocation_enabled as "case_revocation_enabled",
          case_revocation_push as "case_revocation_push",
          case_revocation_websocket as "case_revocation_websocket",
          system_notifications_enabled as "system_notifications_enabled",
          system_notifications_push as "system_notifications_push",
          system_notifications_websocket as "system_notifications_websocket",
          quiet_hours_enabled as "quiet_hours_enabled",
          quiet_hours_start as "quiet_hours_start",
          quiet_hours_end as "quiet_hours_end",
          updated_at as updated_at
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
        userId,
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
      const userId = req.user!.id;

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
          platform,
          is_active as is_active,
          created_at as created_at,
          last_used_at as "last_used_at"
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
      const userId = req.user!.id;
      const { deviceId, platform, pushToken } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      if (!platform || !pushToken) {
        return res.status(400).json({
          success: false,
          message: 'Platform and push token are required',
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
          device_id = EXCLUDED.device_id,
          platform = EXCLUDED.platform,
          push_token = EXCLUDED.push_token,
          is_active = true,
          last_used_at = NOW(),
          updated_at = NOW()
        RETURNING 
          id,
          platform,
          is_active as is_active,
          created_at as created_at,
          updated_at as updated_at
      `;

      const result = await query(upsertQuery, [userId, deviceId || 'default', platform, pushToken]);

      logger.info('Notification token registered', {
        userId,
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
      logger.error(
        '❌ REGISTER TOKEN FULL ERROR:',
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      );
      logger.error(
        '❌ FULL ERROR DETAILS:',
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      );
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
      const userId = req.user!.id;
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
        RETURNING id, device_id, platform
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
        deviceId: result.rows[0].device_id,
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
      const userId = req.user!.id;
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
      logger.error(
        '❌ SEND TEST NOTIFICATION FULL ERROR:',
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      );
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
      const userId = req.user!.id;
      const { startDate, endDate, type } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      const whereConditions = ['1=1'];
      const queryParams: QueryParams = [];

      if (startDate) {
        whereConditions.push(`created_at >= $${queryParams.length + 1}`);
        queryParams.push(startDate as string);
      }

      if (endDate) {
        whereConditions.push(`created_at <= $${queryParams.length + 1}`);
        queryParams.push(endDate as string);
      }

      if (type) {
        whereConditions.push(`type = $${queryParams.length + 1}`);
        queryParams.push(type as string);
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
          totalNotifications: analyticsResult.rows.reduce(
            (sum, row) => sum + parseInt(row.totalSent),
            0
          ),
          totalRead: analyticsResult.rows.reduce((sum, row) => sum + parseInt(row.totalRead), 0),
          totalUnread: analyticsResult.rows.reduce(
            (sum, row) => sum + parseInt(row.totalUnread),
            0
          ),
          overallReadRate:
            analyticsResult.rows.length > 0
              ? (
                  analyticsResult.rows.reduce((sum, row) => sum + parseFloat(row.readRate), 0) /
                  analyticsResult.rows.length
                ).toFixed(2)
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
      const userId = req.user!.id;
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
          ndl.delivery_method as "delivery_method",
          ndl.delivery_status as delivery_status,
          ndl.attempted_at as "attempted_at",
          ndl.delivered_at as "delivered_at",
          ndl.error_message as "error_message",
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
   * Phase 3.2 (2026-05-04): mute notifications for a case (or task).
   * WhatsApp-parity. Caller passes `{caseId}` or `{taskId}` (XOR via
   * DB CHECK). Optional `expiresAt` (ISO 8601 string) for time-boxed
   * mutes — null = mute forever until unmuted.
   *
   * Idempotent: re-muting an already-muted case is a no-op (unique
   * partial index on (user_id, case_id) where expires_at IS NULL OR
   * expires_at > NOW()).
   */
  static async muteCase(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }
      const body = req.body as { caseId?: string; taskId?: string; expiresAt?: string };
      const caseId = body.caseId ?? null;
      const taskId = body.taskId ?? null;
      const expiresAt = body.expiresAt ?? null;
      if ((caseId && taskId) || (!caseId && !taskId)) {
        return res.status(400).json({
          success: false,
          message: 'Provide exactly one of caseId or taskId',
          error: { code: 'INVALID_REQUEST' },
        });
      }
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (caseId && !uuidRe.test(caseId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid caseId',
          error: { code: 'INVALID_REQUEST' },
        });
      }
      if (taskId && !uuidRe.test(taskId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid taskId',
          error: { code: 'INVALID_REQUEST' },
        });
      }
      // Idempotent re-mute: unique partial indexes are time-agnostic
      // (matches live DB), so on conflict we refresh expires_at instead
      // of leaving a stale expired row in place.
      const conflictTarget = caseId
        ? '(user_id, case_id) WHERE case_id IS NOT NULL'
        : '(user_id, task_id) WHERE task_id IS NOT NULL';
      const result = await query<{ id: string; expiresAt: string | null }>(
        `INSERT INTO notification_mutes (user_id, case_id, task_id, expires_at)
         VALUES ($1, $2::uuid, $3::uuid, $4::timestamptz)
         ON CONFLICT ${conflictTarget}
         DO UPDATE SET expires_at = EXCLUDED.expires_at, created_at = now()
         RETURNING id, expires_at as "expiresAt"`,
        [userId, caseId, taskId, expiresAt]
      );
      return res.json({
        success: true,
        data: { muted: true, caseId, taskId, expiresAt, id: result.rows[0]?.id },
        message: 'Notifications muted',
      });
    } catch (error) {
      logger.error('Mute case error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Phase 3.2 (2026-05-04): unmute. Hard-deletes the mute row(s) for
   * (user, case) or (user, task). Idempotent.
   */
  static async unmuteCase(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }
      const caseId = this.getSingleParam(req.params.caseId);
      const taskId = this.getSingleParam(req.params.taskId);
      if ((caseId && taskId) || (!caseId && !taskId)) {
        return res.status(400).json({
          success: false,
          message: 'Provide exactly one of caseId or taskId',
          error: { code: 'INVALID_REQUEST' },
        });
      }
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (caseId && !uuidRe.test(caseId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid caseId',
          error: { code: 'INVALID_REQUEST' },
        });
      }
      if (taskId && !uuidRe.test(taskId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid taskId',
          error: { code: 'INVALID_REQUEST' },
        });
      }
      const result = await query(
        `DELETE FROM notification_mutes
         WHERE user_id = $1
           AND ($2::uuid IS NOT NULL AND case_id = $2::uuid
                OR $3::uuid IS NOT NULL AND task_id = $3::uuid)`,
        [userId, caseId, taskId]
      );
      return res.json({
        success: true,
        data: { unmuted: true, caseId, taskId, deletedCount: result.rowCount ?? 0 },
        message: 'Notifications unmuted',
      });
    } catch (error) {
      logger.error('Unmute case error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Phase 3.2 (2026-05-04): list active mutes for the current user.
   * Used by the frontend to show "Muted" state on a case toggle.
   */
  static async listMutes(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: { code: 'UNAUTHORIZED' },
        });
      }
      const result = await query(
        `SELECT id,
                case_id   as "caseId",
                task_id   as "taskId",
                created_at as "createdAt",
                expires_at as "expiresAt"
           FROM notification_mutes
          WHERE user_id = $1
            AND (expires_at IS NULL OR expires_at > NOW())
          ORDER BY created_at DESC`,
        [userId]
      );
      return res.json({
        success: true,
        data: result.rows,
        message: 'Active mutes retrieved',
      });
    } catch (error) {
      logger.error('List mutes error:', error);
      return res.status(500).json({
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
      const userId = req.user!.id;

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
