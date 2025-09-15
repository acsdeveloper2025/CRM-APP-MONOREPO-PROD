import { Request, Response } from 'express';
import {
  MobileSyncUploadRequest,
  MobileSyncDownloadResponse,
  MobileCaseResponse
} from '../types/mobile';
import { createAuditLog } from '../utils/auditLogger';
import { config } from '../config';
import { query } from '@/config/database';
import { EnterpriseMobileSyncService } from '../services/enterpriseMobileSyncService';

export class MobileSyncController {
  /**
   * Enterprise-scale mobile synchronization for 500+ field agents
   * Optimized for high-concurrency case assignment operations
   */
  static async enterpriseSync(req: Request, res: Response) {
    try {
      const { lastSyncTimestamp, deviceId, appVersion, platform } = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      if (userRole !== 'FIELD_AGENT') {
        return res.status(403).json({
          success: false,
          message: 'Enterprise sync is only available for field agents',
          error: {
            code: 'UNAUTHORIZED_ROLE',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!deviceId) {
        return res.status(400).json({
          success: false,
          message: 'Device ID is required for enterprise sync',
          error: {
            code: 'MISSING_DEVICE_ID',
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
      console.error('Enterprise sync error:', error);
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
  static async uploadSync(req: Request, res: Response) {
    try {
      const { localChanges, deviceInfo, lastSyncTimestamp }: MobileSyncUploadRequest = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      if (!localChanges) {
        return res.status(400).json({
          success: false,
          message: 'Local changes are required',
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
        conflicts: [] as any[],
        errors: [] as any[],
      };

      // Process case changes
      if (localChanges.cases && localChanges.cases.length > 0) {
        for (const caseChange of localChanges.cases) {
          try {
            await this.processCaseChange(caseChange, userId, userRole, syncResults);
          } catch (error) {
            console.error(`Error processing case change ${caseChange.id}:`, error);
            syncResults.errors.push({
              type: 'CASE',
              id: caseChange.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      // Process attachment changes
      if (localChanges.attachments && localChanges.attachments.length > 0) {
        for (const attachmentChange of localChanges.attachments) {
          try {
            await this.processAttachmentChange(attachmentChange, userId, syncResults);
          } catch (error) {
            console.error(`Error processing attachment change ${attachmentChange.id}:`, error);
            syncResults.errors.push({
              type: 'ATTACHMENT',
              id: attachmentChange.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      // Process location changes
      if (localChanges.locations && localChanges.locations.length > 0) {
        for (const locationChange of localChanges.locations) {
          try {
            await this.processLocationChange(locationChange, userId, syncResults);
          } catch (error) {
            console.error(`Error processing location change ${locationChange.id}:`, error);
            syncResults.errors.push({
              type: 'LOCATION',
              id: locationChange.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      // Update device sync timestamp
      await query(`UPDATE devices SET "lastUsed" = CURRENT_TIMESTAMP WHERE "userId" = $1 AND "deviceId" = $2`, [userId, deviceInfo.deviceId]);

      await createAuditLog({
        action: 'MOBILE_SYNC_UPLOAD',
        entityType: 'SYNC',
        entityId: deviceInfo.deviceId,
        userId,
        details: {
          deviceId: deviceInfo.deviceId,
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
      console.error('Sync upload error:', error);
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

  // Download changes from server for mobile app
  static async downloadSync(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;
      const { lastSyncTimestamp, limit = config.mobile.syncBatchSize } = req.query;

      const syncTimestamp = lastSyncTimestamp 
        ? new Date(lastSyncTimestamp as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      // Get updated cases
      const where: any = {
        updatedAt: { gt: syncTimestamp },
      };

      // Role-based filtering
      if (userRole === 'FIELD_AGENT') {
        where.assignedTo = userId;
      }

      const vals: any[] = [];
      const wh: string[] = [];
      if (where.assignedTo) { vals.push(where.assignedTo); wh.push(`c."assignedTo" = $${vals.length}`); }
      if (where.updatedAt?.gt) { vals.push(where.updatedAt.gt); wh.push(`c."updatedAt" > $${vals.length}`); }
      const whereSql = wh.length ? `WHERE ${wh.join(' AND ')}` : '';
      vals.push(Number(limit));

      const casesRes = await query(
        `SELECT c.*,
                cl.id as "clientId", cl.name as "clientName", cl.code as "clientCode",
                p.id as "productId", p.name as "productName", p.code as "productCode",
                vt.id as "verificationTypeId", vt.name as "verificationTypeName", vt.code as "verificationTypeCode",
                cu.name as "createdByUserName",
                au.name as "assignedToUserName"
         FROM cases c
         LEFT JOIN clients cl ON cl.id = c."clientId"
         LEFT JOIN products p ON p.id = c."productId"
         LEFT JOIN "verificationTypes" vt ON vt.id = c."verificationTypeId"
         LEFT JOIN users cu ON cu.id = c."createdBy"
         LEFT JOIN users au ON au.id = c."assignedTo"
         ${whereSql}
         ORDER BY c."updatedAt" ASC
         LIMIT $${vals.length}`,
        vals
      );
      const updatedCases = casesRes.rows;
      const deletedCases: any[] = [];

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
        completedAt: caseItem.completedAt ? new Date(caseItem.completedAt).toISOString() : undefined,
        notes: caseItem.trigger, // TRIGGER field
        verificationType: caseItem.verificationTypeName || caseItem.verificationType,
        verificationOutcome: caseItem.verificationOutcome,
        applicantType: caseItem.applicantType, // Applicant Type
        backendContactNumber: caseItem.backendContactNumber, // Backend Contact Number
        createdByBackendUser: caseItem.createdByUserName, // Created By Backend User
        assignedToFieldUser: caseItem.assignedToUserName, // Assign to Field User
        client: {
          id: caseItem.clientId || 0, // Use number instead of string
          name: caseItem.clientName || '', // Client
          code: caseItem.clientCode || '',
        },
        product: caseItem.productId ? {
          id: caseItem.productId || 0, // Use number instead of string
          name: caseItem.productName || '', // Product
          code: caseItem.productCode || '',
        } : undefined,
        verificationTypeDetails: caseItem.verificationTypeId ? {
          id: caseItem.verificationTypeId || 0, // Use number instead of string
          name: caseItem.verificationTypeName || '', // Verification Type
          code: caseItem.verificationTypeCode || '',
        } : undefined,
        attachments: [], // Will be populated separately if needed
        formData: caseItem.verificationData,
        syncStatus: 'SYNCED',
      }));

      const deletedCaseIds = deletedCases.map(dc => dc.caseId);
      const hasMore = updatedCases.length === Number(limit);
      const newSyncTimestamp = new Date().toISOString();

      const response: MobileSyncDownloadResponse = {
        cases: mobileCases,
        deletedCaseIds,
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
      console.error('Sync download error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'SYNC_DOWNLOAD_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Get sync status for device
  static async getSyncStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const deviceId = req.headers['x-device-id'] as string;

      const devRes = await query(`SELECT * FROM devices WHERE "userId" = $1 AND "deviceId" = $2 LIMIT 1`, [userId, deviceId]);
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
      console.error('Get sync status error:', error);
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
  private static async processCaseChange(caseChange: any, userId: string, userRole: string, syncResults: any) {
    const { id, action, data, timestamp } = caseChange;

    switch (action) {
      case 'UPDATE':
        // Check if case exists and user has access
        const where: any = { id };
        if (userRole === 'FIELD_AGENT') {
          where.assignedTo = userId;
        }

        const vals9: any[] = [id];
        let exSql7 = `SELECT id, "updatedAt" FROM cases WHERE id = $1`;
        if (userRole === 'FIELD_AGENT') { exSql7 += ` AND "assignedTo" = $2`; vals9.push(userId); }
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
        const vals10: any[] = [];
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

      case 'CREATE':
        // Create new case (if allowed)
        if (userRole === 'FIELD_AGENT') {
          throw new Error('Field users cannot create cases');
        }

        const cols: string[] = ['id', 'createdAt', 'updatedAt'];
        const vals11: any[] = [id, new Date(timestamp), new Date()];
        let idx2 = 4;
        for (const [key, value] of Object.entries(data)) {
          cols.push(`"${key}"`);
          vals11.push(value);
          idx2++;
        }
        const placeholders = vals11.map((_, i) => `$${i + 1}`).join(', ');
        await query(`INSERT INTO cases (${cols.join(', ')}) VALUES (${placeholders})`, vals11);

        syncResults.processedCases++;
        break;

      default:
        throw new Error(`Unsupported case action: ${action}`);
    }
  }

  // Helper method to process attachment changes
  private static async processAttachmentChange(attachmentChange: any, userId: string, syncResults: any) {
    const { id, action, data, timestamp } = attachmentChange;

    switch (action) {
      case 'CREATE':
        // Create attachment record (file should already be uploaded)
        const attCols: string[] = ['id', 'uploadedById', 'uploadedAt'];
        const attVals: any[] = [id, userId, new Date(timestamp)];
        let attIdx = 4;
        for (const [key, value] of Object.entries(data)) {
          attCols.push(`"${key}"`);
          attVals.push(value);
          attIdx++;
        }
        const attPlaceholders = attVals.map((_, i) => `$${i + 1}`).join(', ');
        await query(`INSERT INTO attachments (${attCols.join(', ')}) VALUES (${attPlaceholders})`, attVals);

        syncResults.processedAttachments++;
        break;

      case 'DELETE':
        // Delete attachment
        await query(`DELETE FROM attachments WHERE id = $1`, [id]);

        syncResults.processedAttachments++;
        break;

      default:
        throw new Error(`Unsupported attachment action: ${action}`);
    }
  }

  // Helper method to process location changes
  private static async processLocationChange(locationChange: any, userId: string, syncResults: any) {
    const { id, data, timestamp } = locationChange;

    await query(
      `INSERT INTO locations (id, "caseId", latitude, longitude, accuracy, timestamp, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, data.caseId, data.latitude, data.longitude, data.accuracy, new Date(timestamp), data.source || 'GPS']
    );

    syncResults.processedLocations++;
  }
}
