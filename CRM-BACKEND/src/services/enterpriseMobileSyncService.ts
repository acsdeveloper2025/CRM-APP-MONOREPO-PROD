import { query, pool, wrapClient } from '../config/database';
import { logger } from '../config/logger';
import { PoolClient } from 'pg';

export interface MobileSyncRequest {
  userId: string;
  lastSyncTimestamp?: string;
  deviceId?: string;
  appVersion: string;
  platform: 'iOS' | 'Android';
}

export interface CaseAssignmentNotification {
  type: 'CASE_ASSIGNED' | 'CASE_REASSIGNED' | 'CASE_UPDATED';
  caseId: string;
  caseNumber: string;
  customerName: string;
  priority: string;
  assignedAt: string;
  assignedBy: string;
  reason?: string;
}

export interface MobileSyncResponse {
  success: boolean;
  data: {
    newAssignments: Record<string, unknown>[];
    updatedCases: Record<string, unknown>[];
    notifications: CaseAssignmentNotification[];
    syncTimestamp: string;
    hasMoreData: boolean;
    nextPageToken?: string;
  };
  metadata: {
    totalNewAssignments: number;
    totalUpdatedCases: number;
    syncDuration: number;
    serverTimestamp: string;
  };
}

export class EnterpriseMobileSyncService {
  /**
   * Enterprise-scale mobile synchronization for field agents
   * Optimized for 500+ concurrent field executives
   */
  static async syncFieldAgentData(request: MobileSyncRequest): Promise<MobileSyncResponse> {
    const startTime = Date.now();
    const syncTimestamp = new Date().toISOString();

    logger.info('Starting enterprise mobile sync', {
      userId: request.userId,
      deviceId: request.deviceId,
      lastSync: request.lastSyncTimestamp,
      platform: request.platform,
    });

    try {
      // Use database transaction for consistency
      const client = wrapClient(await pool.connect());

      try {
        await client.query('BEGIN');

        // Get new case assignments since last sync
        const newAssignments = await this.getNewCaseAssignments(
          client,
          request.userId,
          request.lastSyncTimestamp
        );

        // Get updated cases since last sync
        const updatedCases = await this.getUpdatedCases(
          client,
          request.userId,
          request.lastSyncTimestamp
        );

        // Get pending notifications
        const notifications = await this.getPendingNotifications(client, request.userId);

        // Update device sync record
        await this.updateDeviceSyncRecord(client, request, syncTimestamp);

        // Mark notifications as delivered
        if (notifications.length > 0) {
          await this.markNotificationsDelivered(client, request.userId, notifications);
        }

        await client.query('COMMIT');

        const syncDuration = Date.now() - startTime;

        logger.info('Enterprise mobile sync completed', {
          userId: request.userId,
          newAssignments: newAssignments.length,
          updatedCases: updatedCases.length,
          notifications: notifications.length,
          syncDuration: `${syncDuration}ms`,
        });

        return {
          success: true,
          data: {
            newAssignments,
            updatedCases,
            notifications,
            syncTimestamp,
            hasMoreData: false, // Implement pagination if needed
          },
          metadata: {
            totalNewAssignments: newAssignments.length,
            totalUpdatedCases: updatedCases.length,
            syncDuration,
            serverTimestamp: syncTimestamp,
          },
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      const syncDuration = Date.now() - startTime;

      logger.error('Enterprise mobile sync failed', {
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        syncDuration: `${syncDuration}ms`,
      });

      throw error;
    }
  }

  /**
   * Get new case assignments for field agent since last sync
   */
  private static async getNewCaseAssignments(
    client: PoolClient,
    userId: string,
    lastSyncTimestamp?: string
  ): Promise<Record<string, unknown>[]> {
    const syncCondition = lastSyncTimestamp ? `AND cah.assigned_at > $2` : '';

    const params = lastSyncTimestamp ? [userId, lastSyncTimestamp] : [userId];

    const assignmentsQuery = `
      SELECT DISTINCT
        c.id,
        c.case_id,
        c.customer_name,
        c.customer_phone,
        c.address,
        c.city,
        c.state,
        c.pincode,
        c.client,
        c.product,
        c.verification_type,
        c.applicant_type,
        c.priority,
        c.status,
        c.created_at,
        c.updated_at,
        cah.assigned_at,
        cah.reason as "assignmentReason",
        assigned_by.name as "assignedByName",
        -- Get attachment count
        (SELECT COUNT(*) FROM attachments a WHERE a.case_id = c.id) as "attachmentCount",
        -- Get form submission count
        (SELECT COUNT(*) FROM form_submissions fs WHERE fs.case_id = c.id) as "formSubmissionCount"
      FROM cases c
      INNER JOIN case_assignment_history cah ON c.id = cah.case_uuid
      LEFT JOIN users assigned_by ON cah.assigned_by_id = assigned_by.id
      WHERE cah.to_user_id = $1
        ${syncCondition}
      ORDER BY cah.assigned_at DESC
      LIMIT 500
    `;

    const result = await client.query(assignmentsQuery, params);
    return result.rows;
  }

  /**
   * Get updated cases for field agent since last sync
   */
  private static async getUpdatedCases(
    client: PoolClient,
    userId: string,
    lastSyncTimestamp?: string
  ): Promise<Record<string, unknown>[]> {
    if (!lastSyncTimestamp) {
      return []; // No updates on first sync
    }

    const updatesQuery = `
      SELECT 
        c.id,
        c.case_id,
        c.customer_name,
        c.status,
        c.updated_at,
        c.priority,
        -- Get latest form submission
        (SELECT COUNT(*) FROM form_submissions fs 
         WHERE fs.case_id = c.id AND fs.created_at > $2) as "new_form_submissions",
        -- Get latest attachments
        (SELECT COUNT(*) FROM attachments a 
         WHERE a.case_id = c.id AND a.uploaded_at > $2) as "new_attachments"
      FROM cases c
      WHERE c.assigned_to = $1
        AND c.updated_at > $2
        AND c.status != 'COMPLETED'
      ORDER BY c.updated_at DESC
      LIMIT 200
    `;

    const result = await client.query(updatesQuery, [userId, lastSyncTimestamp]);
    return result.rows;
  }

  /**
   * Get pending notifications for field agent
   */
  private static async getPendingNotifications(
    client: PoolClient,
    userId: string
  ): Promise<CaseAssignmentNotification[]> {
    const notificationsQuery = `
      SELECT 
        notification_type as type,
        data,
        title,
        message,
        created_at
      FROM mobile_notification_queue
      WHERE user_id = $1 
        AND status = 'PENDING'
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const result = await client.query(notificationsQuery, [userId]);

    return result.rows.map(row => ({
      type: row.type,
      caseId: row.data?.caseId || '',
      caseNumber: row.data?.caseNumber || '',
      customerName: row.data?.customerName || '',
      priority: row.data?.priority || 'MEDIUM',
      assignedAt: row.createdAt,
      assignedBy: row.data?.assignedBy || '',
      reason: row.data?.reason,
    }));
  }

  /**
   * Update device sync record for tracking
   */
  private static async updateDeviceSyncRecord(
    client: PoolClient,
    request: MobileSyncRequest,
    syncTimestamp: string
  ): Promise<void> {
    const upsertQuery = `
      INSERT INTO mobile_device_sync (
        user_id, device_id, last_sync_at, app_version, 
        platform, sync_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW())
      ON CONFLICT (user_id, device_id) 
      DO UPDATE SET
        last_sync_at = $3,
        app_version = $4,
        platform = $5,
        sync_count = mobile_device_sync.sync_count + 1,
        updated_at = NOW()
    `;

    await client.query(upsertQuery, [
      request.userId,
      request.deviceId || 'default',
      syncTimestamp,
      request.appVersion,
      request.platform,
    ]);
  }

  /**
   * Mark notifications as delivered
   */
  private static async markNotificationsDelivered(
    client: PoolClient,
    userId: string,
    notifications: CaseAssignmentNotification[]
  ): Promise<void> {
    if (notifications.length === 0) {
      return;
    }

    const updateQuery = `
      UPDATE mobile_notification_queue 
      SET status = 'SENT', sent_at = NOW(), updated_at = NOW()
      WHERE user_id = $1 AND status = 'PENDING'
    `;

    await client.query(updateQuery, [userId]);
  }

  /**
   * Queue notification for field agent
   */
  static async queueNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    data: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      const insertQuery = `
        INSERT INTO mobile_notification_queue (
          user_id, notification_type, title, message, data, 
          status, scheduled_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW(), NOW(), NOW())
      `;

      await query(insertQuery, [userId, type, title, message, JSON.stringify(data)]);

      logger.info('Mobile notification queued', {
        userId,
        type,
        title,
      });
    } catch (error) {
      logger.error('Failed to queue mobile notification', {
        userId,
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get sync statistics for monitoring
   */
  static async getSyncStatistics(): Promise<Record<string, unknown> | null> {
    try {
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT user_id) as "active_users",
          COUNT(DISTINCT device_id) as "active_devices",
          AVG(sync_count) as "avg_sync_count",
          MAX(last_sync_at) as "last_sync_time",
          COUNT(CASE WHEN last_sync_at > NOW() - INTERVAL '1 hour' THEN 1 END) as "recent_syncs"
        FROM mobile_device_sync
        WHERE last_sync_at > NOW() - INTERVAL '24 hours'
      `;

      const result = await query(statsQuery);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get sync statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }
}
