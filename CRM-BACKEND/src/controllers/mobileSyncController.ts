import type { Response } from 'express';
import type {
  MobileSyncUploadRequest,
  MobileSyncDownloadResponse,
  MobileCaseResponse,
} from '../types/mobile';
import type { QueryParams, WhereClause } from '../types/database';

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

// Type guards and interfaces for WhereClause usage
interface DateRangeFilter {
  gte?: Date;
  lte?: Date;
  gt?: Date;
  lt?: Date;
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

export class MobileSyncController {
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
    try {
      const {
        localChanges,
        actions,
        deviceInfo,
        lastSyncTimestamp,
      }: MobileSyncUploadRequest & { actions?: MobileQueuedAction[] } = req.body;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

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
          `UPDATE devices SET "lastUsed" = CURRENT_TIMESTAMP WHERE "userId" = $1 AND "deviceId" = $2`,
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
    } catch (error) {
      logger.error('Sync upload error:', error);
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
    try {
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);
      const lastSyncTimestamp = (req.query.lastSyncTimestamp as unknown as string) || '';
      const limit = Number(req.query.limit) || config.mobile.syncBatchSize;

      const syncTimestamp = lastSyncTimestamp
        ? new Date(lastSyncTimestamp)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      // Get updated cases
      const where: WhereClause = {
        updatedAt: { gt: syncTimestamp },
      };

      // Role-based filtering
      if (isExecutionActor) {
        where.hasAssignedTask = userId;
      }

      const vals: QueryParams = [];
      const wh: string[] = [];
      if (where.hasAssignedTask) {
        vals.push(where.hasAssignedTask as string);
        wh.push(`EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = c.id
          AND vt.assigned_to = $${vals.length}
        )`);
      }
      if (where.updatedAt && typeof where.updatedAt === 'object') {
        const updatedAtFilter = where.updatedAt as DateRangeFilter;
        if (updatedAtFilter.gt) {
          vals.push(updatedAtFilter.gt);
          wh.push(`c."updatedAt" > $${vals.length}`);
        }
      }
      const whereSql = wh.length ? `WHERE ${wh.join(' AND ')}` : '';
      vals.push(Number(limit));

      const casesRes = await query(
        `SELECT c.*,
                cl.id as "clientId", cl.name as "clientName", cl.code as "clientCode",
                p.id as "productId", p.name as "productName", p.code as "productCode",
                vt.id as "verificationTypeId", vt.name as "verificationTypeName", vt.code as "verificationTypeCode", c."verificationData"
         FROM cases c
         LEFT JOIN clients cl ON cl.id = c."clientId"
         LEFT JOIN products p ON p.id = c."productId"
         LEFT JOIN "verificationTypes" vt ON vt.id = c."verificationTypeId"
         ${whereSql}
         ORDER BY c."updatedAt" ASC
         LIMIT $${vals.length}`,
        vals
      );
      const updatedCases = casesRes.rows;
      const deletedCases: string[] = [];

      // Transform cases for mobile response with all required assignment fields
      const mobileCases: MobileCaseResponse[] = updatedCases.map(caseItem => ({
        id: caseItem.id,
        caseId: caseItem.caseId, // User-friendly auto-incrementing case ID
        title: caseItem.customerName || 'Verification Case',
        description: `${caseItem.verificationTypeName || 'Verification'} for ${caseItem.customerName}`,
        customerName: caseItem.customerName || caseItem.applicantName, // Customer Name
        customerCallingCode: caseItem.customerCallingCode, // Customer Calling Code
        customerPhone: caseItem.customerPhone,
        customerEmail: caseItem.customerEmail,
        // Fix address mapping - use single address field from database
        addressStreet: caseItem.address || '',
        addressCity: '',
        addressState: '',
        addressPincode: caseItem.pincode || '',
        latitude: caseItem.latitude,
        longitude: caseItem.longitude,
        status: caseItem.status ? caseItem.status.toUpperCase().replace(/\s+/g, '_') : 'ASSIGNED',
        priority: caseItem.priority || 2, // Priority
        assignedAt: new Date(caseItem.createdAt).toISOString(),
        updatedAt: new Date(caseItem.updatedAt).toISOString(),
        completedAt: caseItem.completedAt
          ? new Date(caseItem.completedAt).toISOString()
          : undefined,
        notes: caseItem.trigger, // TRIGGER field
        verificationType: caseItem.verificationTypeName || caseItem.verificationType,
        verificationOutcome: caseItem.verificationOutcome,
        applicantType: caseItem.applicantType, // Applicant Type
        backendContactNumber: caseItem.backendContactNumber, // Backend Contact Number
        createdByBackendUser: caseItem.createdByUserName, // Created By Backend User
        assignedToFieldUser: '', // Task-level assignment - would need LATERAL JOIN to get this
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
        attachments: [], // Will be populated separately if needed
        formData: caseItem.verificationData,
        syncStatus: 'SYNCED',
      }));

      const deletedCaseIds = deletedCases;
      const revokedAssignmentIds =
        await TaskRevocationService.getRevokedAssignmentIdsForUser(userId);
      const hasMore = updatedCases.length === Number(limit);
      const newSyncTimestamp = new Date().toISOString();

      const response: MobileSyncDownloadResponse = {
        cases: mobileCases,
        deletedCaseIds,
        revokedAssignmentIds,
        conflicts: [], // Would be populated if conflicts are detected
        syncTimestamp: newSyncTimestamp,
        hasMore,
      };

      await createAuditLog({
        action: 'MOBILE_SYNC_DOWNLOAD',
        entityType: 'SYNC',
        entityId: userId,
        userId,
        details: {
          lastSyncTimestamp,
          casesCount: mobileCases.length,
          deletedCasesCount: deletedCaseIds.length,
          hasMore,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        message: 'Sync download completed',
        data: response,
      });
    } catch (error) {
      logger.error('❌ Sync download error:', error);
      logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      logger.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        executionActor: isFieldExecutionActor(req.user),
      });

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

  // Get sync status for device
  static async getSyncStatus(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const deviceId = String(req.headers['x-device-id'] || 'default');

      const devRes = await query(
        `SELECT * FROM devices WHERE "userId" = $1 AND "deviceId" = $2 LIMIT 1`,
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
        let exSql7 = `SELECT id, "updatedAt" FROM cases WHERE id = $1`;
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
        sets.push(`"updatedAt" = CURRENT_TIMESTAMP`);
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
        activityType?: string;
      };
      timestamp: string;
    },
    userId: string,
    syncResults: SyncResults
  ) {
    const { id, data, timestamp } = locationChange;

    await query(
      `INSERT INTO locations (id, "caseId", latitude, longitude, accuracy, timestamp, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        data.caseId,
        data.latitude,
        data.longitude,
        data.accuracy,
        new Date(timestamp),
        data.source || 'GPS',
      ]
    );

    syncResults.processedLocations++;
  }
}
