import { query, pool } from '../config/database';
import { logger } from '../config/logger';
import { notificationQueue } from '../config/queue';

export interface MobileSyncRequest {
  userId: string;
  lastSyncTimestamp?: string;
  deviceId: string;
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
    newAssignments: any[];
    updatedCases: any[];
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
      const client = await pool.connect();
      
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
        const notifications = await this.getPendingNotifications(
          client,
          request.userId
        );

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
    client: any,
    userId: string,
    lastSyncTimestamp?: string
  ): Promise<any[]> {
    const syncCondition = lastSyncTimestamp 
      ? `AND cah."assignedAt" > $2`
      : '';

    const params = lastSyncTimestamp ? [userId, lastSyncTimestamp] : [userId];

    const assignmentsQuery = `
      SELECT DISTINCT
        c.id,
        c."caseId",
        c."customerName",
        c."customerPhone",
        c."customerEmail",
        c.address,
        c.city,
        c.state,
        c.pincode,
        c.client,
        c.product,
        c."verificationType",
        c."applicantType",
        c.priority,
        c.status,
        c."createdAt",
        c."updatedAt",
        cah."assignedAt",
        cah.reason as "assignmentReason",
        assigned_by.name as "assignedByName",
        -- Get attachment count
        (SELECT COUNT(*) FROM attachments a WHERE a."caseId" = c.id) as "attachmentCount",
        -- Get form submission count  
        (SELECT COUNT(*) FROM form_submissions fs WHERE fs."caseId" = c.id) as "formSubmissionCount"
      FROM cases c
      INNER JOIN case_assignment_history cah ON c.id = cah."caseUUID"
      LEFT JOIN users assigned_by ON cah."assignedById" = assigned_by.id
      WHERE cah."toUserId" = $1
        ${syncCondition}
      ORDER BY cah."assignedAt" DESC
      LIMIT 100
    `;

    const result = await client.query(assignmentsQuery, params);
    return result.rows;
  }

  /**
   * Get updated cases for field agent since last sync
   */
  private static async getUpdatedCases(
    client: any,
    userId: string,
    lastSyncTimestamp?: string
  ): Promise<any[]> {
    if (!lastSyncTimestamp) {
      return []; // No updates on first sync
    }

    const updatesQuery = `
      SELECT 
        c.id,
        c."caseId",
        c."customerName",
        c.status,
        c."updatedAt",
        c.priority,
        -- Get latest form submission
        (SELECT COUNT(*) FROM form_submissions fs 
         WHERE fs."caseId" = c.id AND fs."createdAt" > $2) as "newFormSubmissions",
        -- Get latest attachments
        (SELECT COUNT(*) FROM attachments a 
         WHERE a."caseId" = c.id AND a."uploadedAt" > $2) as "newAttachments"
      FROM cases c
      WHERE c."assignedTo" = $1
        AND c."updatedAt" > $2
        AND c.status != 'COMPLETED'
      ORDER BY c."updatedAt" DESC
      LIMIT 50
    `;

    const result = await client.query(updatesQuery, [userId, lastSyncTimestamp]);
    return result.rows;
  }

  /**
   * Get pending notifications for field agent
   */
  private static async getPendingNotifications(
    client: any,
    userId: string
  ): Promise<CaseAssignmentNotification[]> {
    const notificationsQuery = `
      SELECT 
        "notificationType" as type,
        data,
        title,
        message,
        "createdAt"
      FROM mobile_notification_queue
      WHERE "userId" = $1 
        AND status = 'PENDING'
      ORDER BY "createdAt" DESC
      LIMIT 20
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
    client: any,
    request: MobileSyncRequest,
    syncTimestamp: string
  ): Promise<void> {
    const upsertQuery = `
      INSERT INTO mobile_device_sync (
        "userId", "deviceId", "lastSyncAt", "appVersion", 
        platform, "syncCount", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW())
      ON CONFLICT ("userId", "deviceId") 
      DO UPDATE SET
        "lastSyncAt" = $3,
        "appVersion" = $4,
        platform = $5,
        "syncCount" = mobile_device_sync."syncCount" + 1,
        "updatedAt" = NOW()
    `;

    await client.query(upsertQuery, [
      request.userId,
      request.deviceId,
      syncTimestamp,
      request.appVersion,
      request.platform,
    ]);
  }

  /**
   * Mark notifications as delivered
   */
  private static async markNotificationsDelivered(
    client: any,
    userId: string,
    notifications: CaseAssignmentNotification[]
  ): Promise<void> {
    if (notifications.length === 0) return;

    const updateQuery = `
      UPDATE mobile_notification_queue 
      SET status = 'SENT', "sentAt" = NOW(), "updatedAt" = NOW()
      WHERE "userId" = $1 AND status = 'PENDING'
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
    data: any = {}
  ): Promise<void> {
    try {
      const insertQuery = `
        INSERT INTO mobile_notification_queue (
          "userId", "notificationType", title, message, data, 
          status, "scheduledAt", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW(), NOW(), NOW())
      `;

      await query(insertQuery, [
        userId,
        type,
        title,
        message,
        JSON.stringify(data),
      ]);

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
  static async getSyncStatistics(): Promise<any> {
    try {
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT "userId") as "activeUsers",
          COUNT(DISTINCT "deviceId") as "activeDevices",
          AVG("syncCount") as "avgSyncCount",
          MAX("lastSyncAt") as "lastSyncTime",
          COUNT(CASE WHEN "lastSyncAt" > NOW() - INTERVAL '1 hour' THEN 1 END) as "recentSyncs"
        FROM mobile_device_sync
        WHERE "lastSyncAt" > NOW() - INTERVAL '24 hours'
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
