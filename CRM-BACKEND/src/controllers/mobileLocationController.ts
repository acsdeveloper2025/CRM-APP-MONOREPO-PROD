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
import { getSocketIO } from '@/websocket/server';
import { circuitBreakers } from '@/utils/circuitBreaker';
import { redisClient, isRedisHealthy } from '@/config/redis';

// T1-14 (audit 2026-05-17): cache reverse-geocode results in Redis.
// At 10K field agents × ~50 lookups/day, uncached spend is projected
// $9-12K/month; clustering on common coordinates (an agent revisits
// the same building) typically yields a 60-80% hit rate at this TTL.
// Key shape mirrors the existing static-map cache (`gmap:{lat6}:{lng6}`)
// for operational symmetry.
const REVERSE_GEOCODE_TTL_SECONDS = parseInt(
  process.env.REVERSE_GEOCODE_CACHE_TTL_SECONDS || '2592000', // 30 days
  10
);

export class MobileLocationController {
  private static getOperationId(req: AuthenticatedRequest): string | null {
    // A3 (audit 2026-04-21 round 2): fixed mixed-case dead branch — see
    // `verificationAttachmentController.getOperationId` comment.
    const bodyOp =
      typeof req.body?.operationId === 'string'
        ? req.body.operationId
        : typeof req.body?.operation_id === 'string'
          ? req.body.operation_id
          : '';
    const bodyValue = bodyOp.trim();
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
      const userId = req.user!.id;

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

      // 2026-05-13: ADMIN_PING branch — admin-triggered on-demand location
      // ping (silent FCM → mobile FCM handler responds here with no task
      // context). Bypasses the strict task-walk validation; lands a row
      // with case_id=NULL, source='ADMIN_PING'; emits WebSocket to admins
      // subscribed to the field-monitoring room.
      if (source === 'ADMIN_PING') {
        const operationId = MobileLocationController.getOperationId(req);
        if (!operationId) {
          return res.status(400).json({
            success: false,
            message: 'Idempotency-Key header is required',
            error: { code: 'IDEMPOTENCY_KEY_REQUIRED' },
          });
        }

        // 2026-05-13: when mobile is responding to an admin-triggered
        // FCM ping, the FCM data payload carries `requestedBy` (the
        // admin's user-id). LocationPingHandler forwards it in the
        // capture POST. Persisting it on the row lets the admin UI
        // render "last ping triggered by Alice 5 min ago".
        const requestedBy =
          typeof req.body?.requestedBy === 'string' && req.body.requestedBy.trim()
            ? req.body.requestedBy.trim()
            : null;

        const adminPingRes = await query(
          `INSERT INTO locations (
             latitude, longitude, accuracy, recorded_at, recorded_by, operation_id, source, requested_by_user_id
           ) VALUES ($1, $2, $3, $4, $5, $6, 'ADMIN_PING', $7)
           ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL
           DO UPDATE SET operation_id = EXCLUDED.operation_id
           RETURNING id, recorded_at, latitude, longitude, accuracy`,
          [latitude, longitude, accuracy, new Date(timestamp), userId, operationId, requestedBy]
        );
        const row = adminPingRes.rows[0];

        const io = getSocketIO();
        if (io) {
          io.to('perm:field_monitoring').emit('field-monitoring:location-updated', {
            userId,
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            accuracy: row.accuracy != null ? Number(row.accuracy) : null,
            recordedAt: row.recorded_at.toISOString(),
            source: 'ADMIN_PING',
            requestedByUserId: requestedBy,
          });
        }

        await createAuditLog({
          action: 'MOBILE_LOCATION_CAPTURED',
          entityType: 'LOCATION',
          entityId: String(row.id),
          userId,
          details: {
            latitude,
            longitude,
            accuracy,
            source: 'ADMIN_PING',
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });

        return res.json({
          success: true,
          message: 'Location captured',
          data: {
            id: row.id,
            timestamp: row.recorded_at.toISOString(),
            accuracy,
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

      // 2026-05-13: fan-out to field-monitoring live map. Task-walk
      // captures count as "fresh location" for that agent and should
      // repaint the admin's map without polling.
      const taskIo = getSocketIO();
      if (taskIo) {
        taskIo.to('perm:field_monitoring').emit('field-monitoring:location-updated', {
          userId,
          latitude: Number(latitude),
          longitude: Number(longitude),
          accuracy: accuracy != null ? Number(accuracy) : null,
          recordedAt: locationRecord.timestamp.toISOString(),
          source: 'TASK',
        });
      }

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
      const userId = req.user!.id;
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

  // Reverse-geocoding helper.
  //
  // C8 (mobile audit 2026-04-20, revised 2026-04-21): hits Google
  // Geocoding API using a server-side-only key stored in
  // process.env.GOOGLE_GEOCODING_API_KEY. The Google Cloud key is
  // IP-restricted to this production server and API-restricted to
  // "Geocoding API" — it never ships in the mobile binary.
  //
  // Exposed publicly because the CRM web frontend also needs reverse-
  // geocoding when rendering attachment photos — it hits a separate
  // admin-auth route (see `geocodeAddressFromCoords` below) that
  // reuses this same helper. Both paths end up calling the same
  // Google key, so the quota and billing stay centralised.
  static async reverseGeocodeHelper(latitude: number, longitude: number): Promise<string | null> {
    const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
    if (!apiKey) {
      logger.warn('GOOGLE_GEOCODING_API_KEY not set — reverse geocoding disabled');
      return null;
    }

    // T1-14: Redis-backed cache. 6dp ≈ 11cm precision — finer than
    // Google's own response varies for the same building. Cache only
    // successful resolutions; failures / nulls retry next call.
    const cacheKey = `revgeo:${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
    if (isRedisHealthy()) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (cacheErr) {
        logger.warn('Reverse-geocode cache lookup failed', {
          error: cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
        });
      }
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(
      `${latitude},${longitude}`
    )}&key=${encodeURIComponent(apiKey)}&language=en`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      // T0-5 (audit 2026-05-17): circuit-breaker on Google geocoding.
      // Existing 10s AbortController stays for per-call timeout; breaker
      // adds aggregate protection — opens after 5 consecutive failures
      // and fast-fails subsequent calls until the half-open probe succeeds.
      const response = await circuitBreakers.geocoding.execute(() =>
        fetch(url, { signal: controller.signal })
      );
      if (!response.ok) {
        logger.warn(`Google Geocoding HTTP ${response.status}`);
        return null;
      }

      const body = (await response.json()) as {
        status?: string;
        results?: Array<{
          formatted_address?: string;
        }>;
      };

      if (body.status !== 'OK' || !body.results || body.results.length === 0) {
        logger.warn(`Google Geocoding status=${body.status}`);
        return null;
      }

      // 2026-05-13: return Google's canonical formatted_address as-is.
      // The prior hand-rolled assembly read sublocality_level_1 only
      // (dropping _2 and _3 segments like "Yashaswi Nagar" / "Dhokali")
      // and read admin_area_level_2 instead of _3 (so "Konkan Division"
      // replaced "Thane"). Google's formatted_address is locale-aware
      // and already chooses the right segments per region; FE-side
      // deriveCityStateCountry strips remaining admin-region noise via
      // SKIP_TOKENS for the 3-line header derivation.
      const address = body.results[0].formatted_address || null;

      // T1-14: populate cache. Best-effort — cache write failure must
      // not break the response. Only successful resolutions are cached
      // (null addresses are NOT cached so a transient Google return of
      // no-results doesn't poison the key for 30 days).
      if (address && isRedisHealthy()) {
        try {
          await redisClient.set(cacheKey, address, { EX: REVERSE_GEOCODE_TTL_SECONDS });
        } catch (cacheErr) {
          logger.warn('Reverse-geocode cache write failed', {
            error: cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
          });
        }
      }

      return address;
    } catch (error) {
      logger.error('Google reverse geocoding error:', error);
      return null;
    } finally {
      clearTimeout(timeoutId);
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
      const userId = req.user!.id;
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

      // Scope to the requesting user's own trail. Previously `where.userId`
      // was computed but never applied to the SQL WHERE, so this returned
      // EVERY user's locations (cross-user leak). recorded_by is indexed.
      const vals: QueryParams = [where.userId];
      let sql = `SELECT l.id, l.latitude, l.longitude, l.accuracy, l.recorded_at as timestamp, c.id as case_id, c.customer_name FROM locations l JOIN cases c ON c.id = l.case_id`;
      const wh: string[] = [`l.recorded_by = $1`];
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
        caseId: location.caseId ?? location.case_id,
        customerName: location.customerName ?? location.customer_name,
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
