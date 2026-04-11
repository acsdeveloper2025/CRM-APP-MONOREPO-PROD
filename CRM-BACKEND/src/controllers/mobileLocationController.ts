import type { Response } from 'express';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import type {
  MobileLocationCaptureRequest,
  MobileLocationValidationRequest,
  MobileLocationValidationResponse,
} from '../types/mobile';
import { createAuditLog } from '../utils/auditLogger';
import { config } from '../config';
import type { AuthenticatedRequest } from '../middleware/auth';
import type { QueryParams } from '../types/database';
import { isFieldExecutionActor } from '@/security/rbacAccess';
import { MobileOperationService } from '@/services/mobileOperationService';

export class MobileLocationController {
  private static getOperationId(req: AuthenticatedRequest): string | null {
    const bodyValue = typeof req.body?.operation_id === 'string' ? req.body.operationId.trim() : '';
    if (bodyValue) {
      return bodyValue;
    }

    const headerValue = req.header('Idempotency-Key')?.trim();
    return headerValue || null;
  }

  // Capture GPS location
  static async captureLocation(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const {
        latitude,
        longitude,
        accuracy,
        timestamp,
        source,
        caseId: _caseId,
        taskId, // Stage-2: Dual Write
        activityType,
      }: MobileLocationCaptureRequest = req.body;
      const userId = req.user?.id;

      if (!latitude || !longitude || !accuracy || !timestamp || !source) {
        return res.status(400).json({
          success: false,
          message: 'Latitude, longitude, accuracy, timestamp, and source are required',
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Stage-2B Strict Validation: Task ID is required
      if (!taskId) {
        return res.status(400).json({
          success: false,
          message: 'Task ID is required for location capture',
          error: { code: 'TASK_ID_REQUIRED' },
        });
      }

      // Validate accuracy threshold
      if (accuracy > config.mobile.locationAccuracyThreshold) {
        return res.status(400).json({
          success: false,
          message: `Location accuracy must be better than ${config.mobile.locationAccuracyThreshold} meters`,
          error: {
            code: 'POOR_LOCATION_ACCURACY',
            details: {
              required: config.mobile.locationAccuracyThreshold,
              provided: accuracy,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // ----------------------------------------------------------------------
      // STAGE-2B STRICT DUAL WRITE LOGIC
      // ----------------------------------------------------------------------

      // 1. Validate Task and User Assignment
      const taskResult = await query(
        `SELECT vt.id, vt.case_id, c.case_id as case_number, vt.assigned_to
         FROM verification_tasks vt
         JOIN cases c ON vt.case_id = c.id
         WHERE vt.id = $1`,
        [taskId]
      );

      if (taskResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Task ID',
          error: { code: 'INVALID_TASK_ID' },
        });
      }

      const task = taskResult.rows[0];
      const targetTaskId = task.id;
      const targetCaseId = task.case_id;
      const targetCaseNumber = task.case_number;

      const operationId = MobileLocationController.getOperationId(req);
      if (!operationId) {
        return res.status(400).json({
          success: false,
          message: 'Idempotency-Key header is required',
          error: {
            code: 'IDEMPOTENCY_KEY_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const existingByOperation = await query(
        `SELECT id, recorded_at as timestamp, accuracy
         FROM locations
         WHERE operation_id = $1
         LIMIT 1`,
        [operationId]
      );

      if (existingByOperation.rows.length > 0) {
        const existing = existingByOperation.rows[0];
        return res.json({
          success: true,
          message: 'Location captured successfully',
          data: {
            id: existing.id,
            timestamp: new Date(existing.timestamp).toISOString(),
            accuracy: existing.accuracy,
          },
        });
      }

      if (operationId) {
        await MobileOperationService.recordOperation({
          operationId,
          type: 'LOCATION_CAPTURED',
          entityType: 'LOCATION',
          entityId: targetTaskId,
          payload: {
            taskId: targetTaskId,
            caseId: targetCaseId,
            latitude,
            longitude,
            accuracy,
            source,
            activityType,
          },
          retryCount: Number(req.body?.retry_count || 0),
        });
      }

      // Authorization Check
      if (userId && task.assigned_to !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Task not assigned to user',
          error: { code: 'TASK_NOT_ASSIGNED_TO_USER' },
        });
      }

      // 2. Prevent Duplicate Visits (One location per task)
      const duplicateCheck = await query(
        `SELECT id FROM locations WHERE verification_task_id = $1`,
        [targetTaskId]
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Location already captured for this task',
          error: { code: 'LOCATION_ALREADY_CAPTURED_FOR_TASK' },
        });
      }

      // 3. Insert into locations (Dual Write)
      const locRes = await query(
        `INSERT INTO locations (
           case_id, case_id, verification_task_id, 
           latitude, longitude, accuracy, recorded_at, recorded_by, operation_id
         )
         VALUES (
           $1, $2, $3, 
           $4, $5, $6, $7, $8, $9
         )
         ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL
         DO UPDATE SET operation_id = EXCLUDED.operation_id
         RETURNING id, recorded_at as timestamp`,
        [
          targetCaseNumber,
          targetCaseId,
          targetTaskId,
          latitude,
          longitude,
          accuracy,
          new Date(timestamp),
          userId, // recordedBy
          operationId,
        ]
      );
      const locationRecord = locRes.rows[0];

      // 4. Logging
      await createAuditLog({
        action: 'MOBILE_LOCATION_CAPTURED',
        entityType: 'LOCATION',
        entityId: locationRecord.id,
        userId,
        details: {
          taskId: targetTaskId,
          caseId: targetCaseId,
          latitude,
          longitude,
          accuracy,
          source,
          activityType,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        message: 'Location captured successfully',
        data: {
          id: locationRecord.id,
          timestamp: locationRecord.timestamp.toISOString(),
          accuracy,
        },
      });
    } catch (error) {
      logger.error('Capture location error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'LOCATION_CAPTURE_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Validate location against expected address
  static async validateLocation(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const {
        latitude,
        longitude,
        expectedAddress,
        radius: _radius = 100,
      }: MobileLocationValidationRequest = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required',
          error: {
            code: 'MISSING_COORDINATES',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!config.mobile.enableLocationValidation) {
        return res.json({
          success: true,
          message: 'Location validation is disabled',
          data: {
            isValid: true,
            confidence: 1.0,
          },
        });
      }

      let validationResult: MobileLocationValidationResponse = {
        isValid: true,
        confidence: 0.8,
      };

      // If expected address is provided, validate against it
      if (expectedAddress) {
        try {
          // Use reverse geocoding to get actual address
          const actualAddress = await MobileLocationController.reverseGeocodeHelper(
            latitude,
            longitude
          );

          if (actualAddress) {
            // Simple address matching (in production, use more sophisticated matching)
            const similarity = MobileLocationController.calculateAddressSimilarity(
              expectedAddress,
              actualAddress
            );
            validationResult = {
              isValid: similarity > 0.7,
              distance: 0, // Would calculate actual distance in production
              address: actualAddress,
              confidence: similarity,
              suggestions: similarity < 0.7 ? [actualAddress] : undefined,
            };
          }
        } catch (geocodeError) {
          logger.error('Geocoding error:', geocodeError);
          // Continue with basic validation
        }
      }

      res.json({
        success: true,
        message: 'Location validation completed',
        data: validationResult,
      });
    } catch (error) {
      logger.error('Validate location error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'LOCATION_VALIDATION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Reverse geocode coordinates to address
  static async reverseGeocode(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const latitude = (req.query.latitude as unknown as string) || '';
      const longitude = (req.query.longitude as unknown as string) || '';

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required',
          error: {
            code: 'MISSING_COORDINATES',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!config.mobile.reverseGeocodingEnabled) {
        return res.status(503).json({
          success: false,
          message: 'Reverse geocoding is disabled',
          error: {
            code: 'SERVICE_DISABLED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const address = await MobileLocationController.reverseGeocodeHelper(
        parseFloat(latitude),
        parseFloat(longitude)
      );

      if (!address) {
        return res.status(404).json({
          success: false,
          message: 'Address not found for the given coordinates',
          error: {
            code: 'ADDRESS_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      res.json({
        success: true,
        message: 'Address retrieved successfully',
        data: {
          address,
          coordinates: {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
          },
        },
      });
    } catch (error) {
      logger.error('Reverse geocode error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'REVERSE_GEOCODE_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Get location history for a case
  static async getCaseLocationHistory(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const paramCaseId = String(req.params.caseId || '');
      const paramTaskId = String(req.params.taskId || '');
      const caseId = paramCaseId || paramTaskId;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

      // Verify case access
      const where: Record<string, unknown> = { id: caseId };
      if (isExecutionActor) {
        where.assignedToId = userId;
      }

      const vals8: QueryParams = [caseId];
      let exSql6 = `SELECT id FROM cases WHERE id = $1`;
      if (isExecutionActor) {
        exSql6 += ` AND assigned_to_id = $2`;
        vals8.push(String(userId));
      }
      const exRes6 = await query(exSql6, vals8);
      const existingCase = exRes6.rows[0];

      if (!existingCase) {
        return res.status(404).json({
          success: false,
          message: 'Case not found or access denied',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const locRes = await query(
        `SELECT l.id, l.latitude, l.longitude, l.accuracy, l.recorded_at as timestamp, c.id as case_id, c.title, c.customer_name
         FROM locations l JOIN cases c ON c.id = l.case_id
         WHERE l.case_id = $1 ORDER BY l.recorded_at DESC`,
        [caseId]
      );

      const formattedHistory = locRes.rows.map((location: Record<string, unknown>) => ({
        id: location.id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: new Date(location.timestamp as string).toISOString(),
        case: { id: location.caseId, title: location.title, customerName: location.customerName },
      }));

      res.json({
        success: true,
        message: 'Location history retrieved successfully',
        data: formattedHistory,
      });
    } catch (error) {
      logger.error('Get case location history error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'LOCATION_HISTORY_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Helper method for reverse geocoding
  // eslint-disable-next-line @typescript-eslint/require-await
  private static async reverseGeocodeHelper(
    _latitude: number,
    _longitude: number
  ): Promise<string | null> {
    try {
      // In production, use Google Maps API or similar service
      // For now, return a mock address
      const mockAddresses = [
        '123 Main Street, Mumbai, Maharashtra 400001',
        '456 Park Avenue, Delhi, Delhi 110001',
        '789 Commercial Street, Bangalore, Karnataka 560001',
      ];

      return mockAddresses[Math.floor(Math.random() * mockAddresses.length)];
    } catch (error) {
      logger.error('Reverse geocoding error:', error);
      return null;
    }
  }

  // Helper method for address similarity calculation
  private static calculateAddressSimilarity(address1: string, address2: string): number {
    // Simple similarity calculation (in production, use more sophisticated algorithms)
    const words1 = address1.toLowerCase().split(/\s+/);
    const words2 = address2.toLowerCase().split(/\s+/);

    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;

    return commonWords.length / totalWords;
  }

  // Get user's current location trail
  static async getUserLocationTrail(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const startDate = (req.query.startDate as unknown as string) || '';
      const endDate = (req.query.endDate as unknown as string) || '';
      // M11: clamp so ?limit=999999999 cannot force a full-table scan
      // of user_locations and blow out memory.
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

      const where: {
        userId?: string;
        caseId?: string;
        timestamp?: { gte?: Date; lte?: Date };
      } = { userId };

      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) {
          where.timestamp.gte = new Date(startDate);
        }
        if (endDate) {
          where.timestamp.lte = new Date(endDate);
        }
      }

      const vals: QueryParams = [];
      let sql = `SELECT l.id, l.latitude, l.longitude, l.accuracy, l.recorded_at as timestamp, c.id as case_id, c.title, c.customer_name FROM locations l JOIN cases c ON c.id = l.case_id`;
      const wh: string[] = [];
      if (where.caseId) {
        vals.push(where.caseId);
        wh.push(`l.case_id = $${vals.length}`);
      }
      if (where.timestamp?.gte) {
        vals.push(where.timestamp.gte);
        wh.push(`l.recorded_at >= $${vals.length}`);
      }
      if (where.timestamp?.lte) {
        vals.push(where.timestamp.lte);
        wh.push(`l.recorded_at <= $${vals.length}`);
      }
      if (wh.length) {
        sql += ` WHERE ${wh.join(' AND ')}`;
      }
      sql += ` ORDER BY l.recorded_at DESC LIMIT $${vals.length + 1}`;
      vals.push(limit);
      const locationTrailRes = await query(sql, vals);
      const locationTrail = locationTrailRes.rows;

      const formattedTrail = locationTrail.map(location => ({
        id: location.id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: (location.timestamp as Date).toISOString(),
        case: location.case,
      }));

      res.json({
        success: true,
        message: 'Location trail retrieved successfully',
        data: formattedTrail,
      });
    } catch (error) {
      logger.error('Get user location trail error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'LOCATION_TRAIL_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}
