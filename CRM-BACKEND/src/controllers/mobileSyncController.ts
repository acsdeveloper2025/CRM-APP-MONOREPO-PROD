import type { Response } from 'express';
import type {
  MobileSyncUploadRequest,
  MobileSyncDownloadResponse,
  MobileCaseResponse,
  MobileAttachmentDeltaChange,
} from '../types/mobile';
import type { QueryParams } from '../types/database';

interface SyncConflict {
  caseId: string;
  localVersion: unknown;
  serverVersion: unknown;
  conflictType: string;
}

interface SyncError {
  type: string;
  id: string;
  error: string;
}

interface SyncResults {
  processedCases: number;
  processedAttachments: number;
  processedLocations: number;
  conflicts: SyncConflict[];
  errors: SyncError[];
}

interface MobileQueuedAction {
  id: string;
  actionType?: string;
  entityType?: string;
  entityId?: string;
  actionData?: string;
  data?: unknown;
}

interface SyncControllerError extends Error {
  status?: number;
  errorCode?: string;
}

import { AuthenticatedRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLogger';
import { config } from '../config';
import { query } from '@/config/database';
import { logger } from '../utils/logger';
import { EnterpriseMobileSyncService } from '../services/enterpriseMobileSyncService';
import { isFieldExecutionActor } from '@/security/rbacAccess';
import { CaseStatusSyncService } from '../services/caseStatusSyncService';
import { TaskRevocationService } from '../services/taskRevocationService';
import { MobileTelemetryService } from '@/services/mobileTelemetryService';

export class MobileSyncController {
  private static readonly MAX_SYNC_PAGE_SIZE = 500;

  static async downloadChanges(this: void, req: AuthenticatedRequest, res: Response) {
    const since = (req.query.since as string) || '';
    const cursor = (req.query.cursor as string) || '';
    const limit = req.query.limit;

    if (since && !req.query.lastSyncTimestamp) {
      req.query.lastSyncTimestamp = since;
    }

    if (typeof limit !== 'undefined' && !req.query.limit) {
      req.query.limit = limit;
    }

    if (cursor && !req.query.offset) {
      const parsedCursor = Number(cursor);
      req.query.offset = Number.isFinite(parsedCursor) ? String(parsedCursor) : '0';
    }

    return MobileSyncController.downloadSync(req, res);
  }

  static async getSyncHealth(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const health = await query('SELECT 1 as ok');
      return res.json({
        success: true,
        message: 'Sync health check successful',
        data: {
          status: health.rows[0]?.ok === 1 ? 'OK' : 'DEGRADED',
          service: 'mobile-sync',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      return res.status(503).json({
        success: false,
        message: 'Sync health check failed',
        error: {
          code: 'SYNC_HEALTH_FAILED',
          timestamp: new Date().toISOString(),
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Enterprise-scale mobile synchronization for 500+ field agents
   * Optimized for high-concurrency case assignment operations
   */
  static async enterpriseSync(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const { lastSyncTimestamp, deviceId, appVersion, platform } = req.body;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

      if (!isExecutionActor) {
        return res.status(403).json({
          success: false,
          message: 'Enterprise sync is only available for field agents',
          error: {
            code: 'UNAUTHORIZED_ROLE',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Use enterprise sync service
      const syncResponse = await EnterpriseMobileSyncService.syncFieldAgentData({
        userId,
        lastSyncTimestamp,
        deviceId,
        appVersion: appVersion || '1.0.0',
        platform: platform || 'Android',
      });

      res.json(syncResponse);
    } catch (error) {
      logger.error('Enterprise sync error:', error);
      res.status(500).json({
        success: false,
        message: 'Enterprise sync failed',
        error: {
          code: 'ENTERPRISE_SYNC_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Upload offline changes from mobile app
  static async uploadSync(this: void, req: AuthenticatedRequest, res: Response) {
    const startedAt = Date.now();
    try {
      const {
        localChanges,
        actions,
        deviceInfo,
        lastSyncTimestamp,
      }: MobileSyncUploadRequest & { actions?: MobileQueuedAction[] } = req.body;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);
      void MobileTelemetryService.increment('sync_request_rate', 1, { direction: 'upload' });

      const retryCount = MobileSyncController.extractRetryCount(req.body);
      if (retryCount > 0) {
        void MobileTelemetryService.increment('retry_count', retryCount, {
          endpoint: 'sync_upload',
        });
      }

      if (!localChanges && (!Array.isArray(actions) || actions.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'Local changes or sync actions are required',
          error: {
            code: 'MISSING_LOCAL_CHANGES',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const syncResults = {
        processedCases: 0,
        processedAttachments: 0,
        processedLocations: 0,
        conflicts: [] as SyncConflict[],
        errors: [] as SyncError[],
      };

      if (Array.isArray(actions) && actions.length > 0) {
        for (const syncAction of actions) {
          try {
            await MobileSyncController.processQueuedAction(
              syncAction,
              userId,
              isExecutionActor,
              syncResults
            );
          } catch (error) {
            logger.error(`Error processing sync action ${syncAction.id}:`, error);
            syncResults.errors.push({
              type: String(syncAction.entityType || 'ACTION'),
              id: syncAction.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      // Process case changes
      if (localChanges?.cases && localChanges.cases.length > 0) {
        for (const caseChange of localChanges.cases) {
          try {
            await MobileSyncController.processCaseChange(
              caseChange,
              userId,
              isExecutionActor,
              syncResults
            );
          } catch (error) {
            const syncError = error as SyncControllerError;
            if (
              caseChange.action === 'CREATE' &&
              syncError.status === 403 &&
              syncError.errorCode === 'CASE_CREATION_DISABLED'
            ) {
              return res.status(403).json({
                success: false,
                message: 'Case creation must be performed via CRM backend.',
                error: {
                  code: 'CASE_CREATION_DISABLED',
                  timestamp: new Date().toISOString(),
                },
              });
            }

            logger.error(`Error processing case change ${caseChange.id}:`, error);
            syncResults.errors.push({
              type: 'CASE',
              id: caseChange.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      // Process attachment changes
      if (localChanges?.attachments && localChanges.attachments.length > 0) {
        for (const attachmentChange of localChanges.attachments) {
          try {
            await MobileSyncController.processAttachmentChange(
              attachmentChange,
              userId,
              syncResults
            );
          } catch (error) {
            logger.error(`Error processing attachment change ${attachmentChange.id}:`, error);
            syncResults.errors.push({
              type: 'ATTACHMENT',
              id: attachmentChange.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      // Process location changes
      if (localChanges?.locations && localChanges.locations.length > 0) {
        for (const locationChange of localChanges.locations) {
          try {
            await MobileSyncController.processLocationChange(locationChange, userId, syncResults);
          } catch (error) {
            logger.error(`Error processing location change ${locationChange.id}:`, error);
            syncResults.errors.push({
              type: 'LOCATION',
              id: locationChange.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      // Update device sync timestamp
      if (deviceInfo?.deviceId) {
        await query(
          `UPDATE devices SET last_used = CURRENT_TIMESTAMP WHERE user_id = $1 AND device_id = $2`,
          [userId, deviceInfo.deviceId]
        );
      }

      await createAuditLog({
        action: 'MOBILE_SYNC_UPLOAD',
        entityType: 'SYNC',
        entityId: deviceInfo?.deviceId || userId,
        userId,
        details: {
          deviceId: deviceInfo?.deviceId || null,
          lastSyncTimestamp,
          results: syncResults,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        message: 'Sync upload completed',
        data: {
          syncTimestamp: new Date().toISOString(),
          results: syncResults,
        },
      });
      void MobileTelemetryService.observeDuration('sync_upload_duration', Date.now() - startedAt, {
        status: 'success',
      });
    } catch (error) {
      logger.error('Sync upload error:', error);
      void MobileTelemetryService.increment('sync_failures', 1, {
        endpoint: 'sync_upload',
      });
      void MobileTelemetryService.observeDuration('sync_upload_duration', Date.now() - startedAt, {
        status: 'error',
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'SYNC_UPLOAD_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  private static async processQueuedAction(
    action: MobileQueuedAction,
    userId: string,
    isExecutionActor: boolean,
    syncResults: SyncResults
  ) {
    const actionType = String(action.actionType || '').toUpperCase();
    const entityType = String(action.entityType || '').toLowerCase();
    const entityId = String(action.entityId || '');

    if (entityType !== 'task' || !entityId) {
      throw new Error('Unsupported sync action target');
    }

    const payload =
      typeof action.actionData === 'string'
        ? JSON.parse(action.actionData)
        : action.data && typeof action.data === 'object'
          ? action.data
          : {};

    if (actionType !== 'UPDATE_STATUS' && actionType !== 'UPDATE') {
      throw new Error(`Unsupported sync action: ${actionType || 'UNKNOWN'}`);
    }

    const requestedStatus = String(
      (payload as { backendStatus?: string; status?: string }).backendStatus ||
        (payload as { backendStatus?: string; status?: string }).status ||
        ''
    ).toUpperCase();

    const taskResult = await query(
      `
      SELECT id, status, assigned_to, case_id, started_at, completed_at
      FROM verification_tasks
      WHERE id = $1
      `,
      [entityId]
    );

    if (taskResult.rows.length === 0) {
      throw new Error('Verification task not found');
    }

    const task = taskResult.rows[0];

    if (isExecutionActor && task.assigned_to !== userId) {
      throw new Error('Access denied. Task is not assigned to user.');
    }

    if (task.status === 'REVOKED') {
      throw new Error('TASK_REVOKED');
    }

    if (requestedStatus === 'IN_PROGRESS') {
      await query(
        `
        UPDATE verification_tasks
        SET
          status = 'IN_PROGRESS',
          started_at = COALESCE(started_at, NOW()),
          updated_at = NOW()
        WHERE id = $1
        `,
        [entityId]
      );

      await CaseStatusSyncService.recalculateCaseStatus(task.case_id as string);
      syncResults.processedCases++;
      return;
    }

    if (requestedStatus === 'COMPLETED') {
      if (task.status === 'COMPLETED') {
        syncResults.processedCases++;
        return;
      }

      throw new Error('Task completion must be synced through verification submission endpoints');
    }

    throw new Error(`Unsupported status sync action: ${requestedStatus || 'UNKNOWN'}`);
  }

  // Download changes from server for mobile app
  static async downloadSync(this: void, req: AuthenticatedRequest, res: Response) {
    const startedAt = Date.now();
    try {
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);
      const lastSyncTimestamp = (req.query.lastSyncTimestamp as unknown as string) || '';
      const requestedLimit = Number(req.query.limit) || config.mobile.syncBatchSize;
      const limit = Math.min(Math.max(1, requestedLimit), MobileSyncController.MAX_SYNC_PAGE_SIZE);
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const queryLimit = limit + 1;
      void MobileTelemetryService.increment('sync_request_rate', 1, { direction: 'download' });

      const syncTimestamp = lastSyncTimestamp
        ? new Date(lastSyncTimestamp)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      const vals: QueryParams = [];
      const userIdParamIndex = vals.length + 1;
      vals.push(isExecutionActor ? userId : null);
      const syncTimestampParamIndex = vals.length + 1;
      vals.push(syncTimestamp);
      const limitParamIndex = vals.length + 1;
      vals.push(queryLimit);
      const offsetParamIndex = vals.length + 1;
      vals.push(offset);

      const casesRes = await query(
        `SELECT c.*,
                cl.id as client_id, cl.name as client_name, cl.code as "clientCode",
                p.id as product_id, p.name as product_name, p.code as "productCode",
                vtype.id as verification_type_id, vtype.name as verification_type_name, vtype.code as "verificationTypeCode",
                c.verification_data,
                COALESCE(cu.name, cu.username) as "createdByUserName",
                vtask.id as "verificationTaskId",
                vtask.task_number as "verificationTaskNumber",
                vtask.address as "taskAddress",
                vtask.trigger as "taskTrigger",
                vtask.priority as "taskPriority",
                vtask.applicant_type as "taskApplicantType",
                vtask.assigned_to as "taskAssignedTo",
                vtask.assigned_user_name,
                vtask.task_status,
                vtask.task_completed_at,
                vtask.assigned_at,
                vtask.task_created_at,
                vtask.started_at,
                vtask.saved_at,
                vtask.is_saved,
                vtask.revoked_at,
                vtask.revoked_by,
                vtask.revoked_by_name,
                vtask.revocation_reason,
                vtask.task_updated_at,
                COALESCE(att_count.attachment_count, 0) as "attachmentCount"
         FROM cases c
         LEFT JOIN clients cl ON cl.id = c.client_id
         LEFT JOIN products p ON p.id = c.product_id
         LEFT JOIN verification_types vtype ON vtype.id = c.verification_type_id
         LEFT JOIN users cu ON cu.id = c.created_by_backend_user
         LEFT JOIN LATERAL (
           SELECT vt.id, vt.task_number, vt.address, vt.trigger, vt.priority, vt.applicant_type,
                  vt.assigned_to, vt.assigned_at, vt.created_at as task_created_at, vt.updated_at as task_updated_at,
                  vt.status as task_status, vt.completed_at as task_completed_at,
                  vt.started_at, vt.saved_at, vt.is_saved,
                  vt.revoked_at, vt.revoked_by, vt.revocation_reason,
                  COALESCE(u.name, u.username) as assigned_user_name,
                  revoked_user.name as revoked_by_name
           FROM verification_tasks vt
           LEFT JOIN users u ON u.id = vt.assigned_to
           LEFT JOIN users revoked_user ON revoked_user.id = vt.revoked_by
           WHERE vt.case_id = c.id
             AND (vt.task_type IS NULL OR vt.task_type != 'KYC')
             AND (
               $${userIdParamIndex}::uuid IS NULL
               OR vt.assigned_to = $${userIdParamIndex}::uuid
             )
           ORDER BY
             CASE WHEN vt.assigned_to = $${userIdParamIndex}::uuid THEN 0 ELSE 1 END,
             CASE WHEN vt.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS') THEN 0 ELSE 1 END,
             vt.created_at DESC
           LIMIT 1
         ) vtask ON true
         LEFT JOIN (
           SELECT case_id, COUNT(*) as attachment_count
           FROM attachments
           GROUP BY case_id
         ) att_count ON att_count.case_id = c.case_id
         WHERE vtask.id IS NOT NULL
           AND (
             c.updated_at > $${syncTimestampParamIndex}
             OR COALESCE(vtask.task_updated_at, c.updated_at) > $${syncTimestampParamIndex}
           )
         ORDER BY COALESCE(vtask.task_updated_at, c.updated_at) ASC
         LIMIT $${limitParamIndex}
         OFFSET $${offsetParamIndex}`,
        vals
      );
      const hasMore = casesRes.rows.length > limit;
      const updatedCases = hasMore ? casesRes.rows.slice(0, limit) : casesRes.rows;
      const deletedCases: string[] = [];

      const attachmentRes = await query(
        `SELECT
           va.id as attachment_id,
           va.verification_task_id as task_id,
           COALESCE(va.photo_type, 'verification') as type,
           va.filename as file_name,
           COALESCE(va.file_size_bytes, va.file_size, 0) as file_size,
           va.mime_type as mime_type,
           COALESCE(va.capture_time, va.created_at) as captured_at,
           COALESCE(va.gps_latitude::double precision, NULLIF(va.geo_location->>'latitude', '')::double precision) as latitude,
           COALESCE(va.gps_longitude::double precision, NULLIF(va.geo_location->>'longitude', '')::double precision) as longitude,
           NULLIF(COALESCE(va.geo_location->>'address', va.geo_location->>'formattedAddress', ''), '') as address,
           (va.deleted_at IS NULL) as uploaded,
           va.created_at as created_at,
           COALESCE(va.updated_at, va.created_at) as updated_at
         FROM verification_attachments va
         INNER JOIN verification_tasks vt ON vt.id = va.verification_task_id
         WHERE (
           $${userIdParamIndex}::uuid IS NULL
           OR vt.assigned_to = $${userIdParamIndex}::uuid
         )
           AND COALESCE(va.updated_at, va.created_at) > $${syncTimestampParamIndex}
         ORDER BY COALESCE(va.updated_at, va.created_at) ASC, va.id ASC
         LIMIT $${limitParamIndex}
         OFFSET $${offsetParamIndex}`,
        vals
      );
      const attachmentHasMore = attachmentRes.rows.length > limit;
      const changedAttachments = attachmentHasMore
        ? attachmentRes.rows.slice(0, limit)
        : attachmentRes.rows;
      const attachmentChanges: MobileAttachmentDeltaChange[] = changedAttachments.map(
        attachment => ({
          entity: 'attachment',
          id: String(attachment.attachment_id),
          changes: {
            attachment_id: String(attachment.attachment_id),
            task_id: String(attachment.task_id),
            type: String(attachment.type || 'verification'),
            file_name: String(attachment.file_name || ''),
            file_size: Number(attachment.file_size || 0),
            mime_type: String(attachment.mime_type || ''),
            captured_at: new Date(attachment.captured_at).toISOString(),
            latitude:
              attachment.latitude === null || typeof attachment.latitude === 'undefined'
                ? null
                : Number(attachment.latitude),
            longitude:
              attachment.longitude === null || typeof attachment.longitude === 'undefined'
                ? null
                : Number(attachment.longitude),
            address:
              typeof attachment.address === 'string' && attachment.address.length > 0
                ? attachment.address
                : null,
            uploaded: Boolean(attachment.uploaded),
            created_at: new Date(attachment.created_at).toISOString(),
            updated_at: new Date(attachment.updated_at).toISOString(),
          },
        })
      );

      // Transform cases for mobile response with task-centric IDs and lifecycle fields
      const mobileCases: MobileCaseResponse[] = updatedCases.map(caseItem => ({
        id: caseItem.verificationTaskId || caseItem.id,
        caseId: caseItem.caseId, // User-friendly auto-incrementing case ID
        title: caseItem.verificationTaskNumber || caseItem.customerName || 'Verification Case',
        description: `${caseItem.verificationTypeName || 'Verification'} for ${caseItem.customerName}`,
        customerName: caseItem.customerName || caseItem.applicantName, // Customer Name
        customerCallingCode: caseItem.customerCallingCode, // Customer Calling Code
        customerPhone: caseItem.customerPhone,
        customerEmail: caseItem.customerEmail,
        addressStreet: caseItem.taskAddress || caseItem.address || '',
        addressCity: '',
        addressState: '',
        addressPincode: caseItem.pincode || '',
        latitude: caseItem.latitude,
        longitude: caseItem.longitude,
        status: caseItem.task_status
          ? caseItem.task_status.toUpperCase().replace(/\s+/g, '_')
          : 'ASSIGNED',
        priority: caseItem.taskPriority || caseItem.priority || 'MEDIUM',
        assignedAt: caseItem.assigned_at
          ? new Date(caseItem.assigned_at).toISOString()
          : new Date(caseItem.task_created_at || caseItem.createdAt).toISOString(),
        updatedAt: new Date(caseItem.task_updated_at || caseItem.updatedAt).toISOString(),
        completedAt: caseItem.task_completed_at
          ? new Date(caseItem.task_completed_at).toISOString()
          : undefined,
        notes: caseItem.taskTrigger || caseItem.trigger || '',
        verificationType: caseItem.verificationTypeName || caseItem.verificationType,
        verificationOutcome: caseItem.verificationOutcome,
        applicantType: caseItem.taskApplicantType || caseItem.applicantType,
        backendContactNumber: caseItem.backendContactNumber, // Backend Contact Number
        createdByBackendUser: caseItem.createdByUserName || caseItem.createdByBackendUser || '',
        assignedToFieldUser: caseItem.assigned_user_name || caseItem.taskAssignedTo || '',
        verificationTaskId: caseItem.verificationTaskId,
        verificationTaskNumber: caseItem.verificationTaskNumber,
        isRevoked: caseItem.task_status === 'REVOKED',
        revokedAt: caseItem.revoked_at ? new Date(caseItem.revoked_at).toISOString() : undefined,
        revokedBy: caseItem.revoked_by || undefined,
        revokedByName: caseItem.revoked_by_name || undefined,
        revokeReason: caseItem.revocation_reason || undefined,
        inProgressAt: caseItem.started_at ? new Date(caseItem.started_at).toISOString() : undefined,
        savedAt: caseItem.saved_at ? new Date(caseItem.saved_at).toISOString() : undefined,
        isSaved: Boolean(caseItem.is_saved || caseItem.task_status === 'SAVED'),
        client: {
          id: caseItem.clientId || 0, // Use number instead of string
          name: caseItem.clientName || '', // Client
          code: caseItem.clientCode || '',
        },
        product: caseItem.productId
          ? {
              id: caseItem.productId || 0, // Use number instead of string
              name: caseItem.productName || '', // Product
              code: caseItem.productCode || '',
            }
          : undefined,
        verificationTypeDetails: caseItem.verificationTypeId
          ? {
              id: caseItem.verificationTypeId || 0, // Use number instead of string
              name: caseItem.verificationTypeName || '', // Verification Type
              code: caseItem.verificationTypeCode || '',
            }
          : undefined,
        attachments: [],
        attachmentCount: Number(caseItem.attachmentCount) || 0,
        formData: caseItem.verificationData,
        syncStatus: 'SYNCED',
      }));

      const deletedCaseIds = deletedCases;
      const deletedTaskIds: string[] = [];
      const revokedAssignmentIds =
        await TaskRevocationService.getRevokedAssignmentIdsForUser(userId);
      const newSyncTimestamp = new Date().toISOString();

      const response: MobileSyncDownloadResponse = {
        cases: mobileCases,
        attachmentChanges,
        deletedCaseIds,
        deletedTaskIds,
        revokedAssignmentIds,
        conflicts: [], // Would be populated if conflicts are detected
        syncTimestamp: newSyncTimestamp,
        hasMore: hasMore || attachmentHasMore,
      };
      const nextCursor = hasMore || attachmentHasMore ? String(offset + limit) : null;

      await createAuditLog({
        action: 'MOBILE_SYNC_DOWNLOAD',
        entityType: 'SYNC',
        entityId: userId,
        userId,
        details: {
          lastSyncTimestamp,
          offset,
          requestedLimit,
          limit,
          casesCount: mobileCases.length,
          attachmentChangesCount: attachmentChanges.length,
          deletedCasesCount: deletedCaseIds.length,
          deletedTasksCount: deletedTaskIds.length,
          hasMore: response.hasMore,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        message: 'Sync download completed',
        data: {
          ...response,
          changes: mobileCases,
          attachmentChanges,
          nextCursor,
          hasMore: response.hasMore,
        },
      });
      void MobileTelemetryService.observeDuration(
        'sync_download_duration',
        Date.now() - startedAt,
        {
          status: 'success',
        }
      );
    } catch (error) {
      logger.error('❌ Sync download error:', error);
      logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      logger.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        executionActor: isFieldExecutionActor(req.user),
      });
      void MobileTelemetryService.increment('sync_failures', 1, {
        endpoint: 'sync_download',
      });
      void MobileTelemetryService.observeDuration(
        'sync_download_duration',
        Date.now() - startedAt,
        {
          status: 'error',
        }
      );

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'SYNC_DOWNLOAD_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  private static extractRetryCount(payload: unknown): number {
    if (!payload || typeof payload !== 'object') {
      return 0;
    }

    let totalRetryCount = 0;
    const stack: unknown[] = [payload];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || typeof current !== 'object') {
        continue;
      }

      if (Array.isArray(current)) {
        stack.push(...current);
        continue;
      }

      const record = current as Record<string, unknown>;
      const retryCandidate = record.retry_count ?? record.retryCount;
      if (
        typeof retryCandidate === 'number' &&
        Number.isFinite(retryCandidate) &&
        retryCandidate > 0
      ) {
        totalRetryCount += retryCandidate;
      }

      for (const value of Object.values(record)) {
        if (value && typeof value === 'object') {
          stack.push(value);
        }
      }
    }

    return totalRetryCount;
  }

  // Get sync status for device
  static async getSyncStatus(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const deviceId = String(req.headers['x-device-id'] || 'default');

      const devRes = await query(
        `SELECT id, user_id, device_id, device_name, "platform", app_version, last_active_at, created_at FROM devices WHERE user_id = $1 AND device_id = $2 LIMIT 1`,
        [userId, deviceId]
      );
      const device = devRes.rows[0];

      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Device not found',
          error: {
            code: 'DEVICE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const syncStatus = {
        lastSyncAt: device.lastUsed?.toISOString(),
        lastSyncData: null, // Field doesn't exist in schema
        isOnline: true,
        pendingChanges: 0, // Would calculate based on local changes
      };

      res.json({
        success: true,
        message: 'Sync status retrieved successfully',
        data: syncStatus,
      });
    } catch (error) {
      logger.error('Get sync status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'SYNC_STATUS_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Helper method to process case changes
  private static async processCaseChange(
    caseChange: {
      id: string;
      action: 'CREATE' | 'UPDATE' | 'DELETE';
      data: unknown;
      timestamp: string;
    },
    userId: string,
    isExecutionActor: boolean,
    syncResults: SyncResults
  ) {
    const { id, action, data, timestamp } = caseChange;

    switch (action) {
      case 'UPDATE': {
        // Check if case exists and user has access
        const vals9: QueryParams = [id];
        let exSql7 = `SELECT id, updated_at FROM cases WHERE id = $1`;
        if (isExecutionActor) {
          exSql7 += ` AND EXISTS (
            SELECT 1 FROM verification_tasks vt
            WHERE vt.case_id = cases.id
            AND vt.assigned_to = $2
          )`;
          vals9.push(userId);
        }
        const exRes7 = await query(exSql7, vals9);
        const existingCase = exRes7.rows[0];
        if (!existingCase) {
          throw new Error('Case not found or access denied');
        }

        // Check for conflicts (server version newer than local)
        if (existingCase.updatedAt > new Date(timestamp)) {
          syncResults.conflicts.push({
            caseId: id,
            localVersion: data,
            serverVersion: existingCase,
            conflictType: 'VERSION_CONFLICT',
          });
          return;
        }

        // Update case
        const sets: string[] = [];
        const vals10: QueryParams = [];
        let idx = 1;
        for (const [key, value] of Object.entries(data)) {
          sets.push(`"${key}" = $${idx++}`);
          vals10.push(value);
        }
        sets.push(`updated_at = CURRENT_TIMESTAMP`);
        vals10.push(id);
        await query(`UPDATE cases SET ${sets.join(', ')} WHERE id = $${idx}`, vals10);

        syncResults.processedCases++;
        break;
      }

      case 'CREATE': {
        const createDisabledError = new Error(
          'Case creation must be performed via CRM backend.'
        ) as SyncControllerError;
        createDisabledError.status = 403;
        createDisabledError.errorCode = 'CASE_CREATION_DISABLED';
        throw createDisabledError;
      }

      default:
        throw new Error(`Unsupported case action: ${action}`);
    }
  }

  // Helper method to process attachment changes
  private static async processAttachmentChange(
    attachmentChange: {
      id: string;
      action: 'CREATE' | 'DELETE';
      data: unknown;
      timestamp: string;
    },
    userId: string,
    syncResults: SyncResults
  ) {
    const { id, action, data, timestamp } = attachmentChange;

    switch (action) {
      case 'CREATE': {
        // Create attachment record (file should already be uploaded)
        const attCols: string[] = ['id', 'uploadedById', 'uploadedAt'];
        const attVals: QueryParams = [id, userId, new Date(timestamp)];
        let _attIdx = 4;
        for (const [key, value] of Object.entries(data)) {
          attCols.push(`"${key}"`);
          attVals.push(value);
          _attIdx++;
        }
        const attPlaceholders = attVals.map((_, i) => `$${i + 1}`).join(', ');
        await query(
          `INSERT INTO attachments (${attCols.join(', ')}) VALUES (${attPlaceholders})`,
          attVals
        );

        syncResults.processedAttachments++;
        break;
      }

      case 'DELETE':
        // Delete attachment
        await query(`DELETE FROM attachments WHERE id = $1`, [id]);

        syncResults.processedAttachments++;
        break;

      default:
        throw new Error(`Unsupported attachment action: ${String(action)}`);
    }
  }

  // Helper method to process location changes
  private static async processLocationChange(
    locationChange: {
      id: string;
      data: {
        latitude: number;
        longitude: number;
        accuracy?: number;
        timestamp: string;
        source?: string;
        caseId?: string;
        taskId?: string;
        activityType?: string;
      };
      timestamp: string;
    },
    userId: string,
    syncResults: SyncResults
  ) {
    const { id, data, timestamp } = locationChange;
    const normalizedTaskId = typeof data.taskId === 'string' ? data.taskId.trim() : '';
    const normalizedCaseToken = typeof data.caseId === 'string' ? data.caseId.trim() : '';

    let targetTaskId: string | null = null;
    let targetCaseId: string | null = null;
    let targetCaseNumber: string | null = null;
    let assignedTo: string | null = null;

    if (normalizedTaskId) {
      const taskRes = await query(
        `SELECT vt.id, vt.case_id, vt.assigned_to, c.case_id::text as case_number
         FROM verification_tasks vt
         JOIN cases c ON c.id = vt.case_id
         WHERE vt.id = $1
         LIMIT 1`,
        [normalizedTaskId]
      );

      if (taskRes.rows.length === 0) {
        throw new Error('Verification task not found for location sync');
      }

      targetTaskId = taskRes.rows[0].id as string;
      targetCaseId = taskRes.rows[0].case_id as string;
      targetCaseNumber = taskRes.rows[0].caseNumber as string;
      assignedTo = (taskRes.rows[0].assigned_to as string | null) || null;
    } else if (normalizedCaseToken) {
      const isNumericCaseNumber = /^\d+$/.test(normalizedCaseToken);
      const caseFilter = isNumericCaseNumber ? `c.case_id = $1::int` : `c.id = $1::uuid`;

      const taskRes = await query(
        `SELECT vt.id, vt.case_id, vt.assigned_to, c.case_id::text as case_number
         FROM verification_tasks vt
         JOIN cases c ON c.id = vt.case_id
         WHERE ${caseFilter}
         ORDER BY vt.updated_at DESC
         LIMIT 1`,
        [normalizedCaseToken]
      );

      if (taskRes.rows.length === 0) {
        throw new Error('No verification task found for location sync case');
      }

      targetTaskId = taskRes.rows[0].id as string;
      targetCaseId = taskRes.rows[0].case_id as string;
      targetCaseNumber = taskRes.rows[0].caseNumber as string;
      assignedTo = (taskRes.rows[0].assigned_to as string | null) || null;
    } else {
      throw new Error('taskId or caseId is required for location sync');
    }

    if (assignedTo && assignedTo !== userId) {
      throw new Error('Task not assigned to user for location sync');
    }

    const duplicateRes = await query(
      `SELECT id FROM locations WHERE verification_task_id = $1 LIMIT 1`,
      [targetTaskId]
    );
    if (duplicateRes.rows.length > 0) {
      syncResults.processedLocations++;
      return;
    }

    await query(
      `INSERT INTO locations
        (id, case_id, case_id, verification_task_id, latitude, longitude, accuracy, recorded_at, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        targetCaseNumber,
        targetCaseId,
        targetTaskId,
        data.latitude,
        data.longitude,
        data.accuracy ?? null,
        new Date(data.timestamp || timestamp),
        userId,
      ]
    );

    syncResults.processedLocations++;
  }
}
