import { Request, Response } from 'express';
import axios from 'axios';
import { query } from '@/config/database';
import {
  MobileLocationCaptureRequest,
  MobileLocationValidationRequest,
  MobileLocationValidationResponse
} from '../types/mobile';
import { createAuditLog } from '../utils/auditLogger';
import { config } from '../config';

export class MobileLocationController {
  // Capture GPS location
  static async captureLocation(req: Request, res: Response) {
    try {
      const { 
        latitude, 
        longitude, 
        accuracy, 
        timestamp, 
        source, 
        caseId, 
        activityType 
      }: MobileLocationCaptureRequest = req.body;
      const userId = (req as any).user?.userId;

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

      // Validate case access if caseId provided
      if (caseId) {
        const userRole = (req as any).user?.role;
        const where: any = { id: caseId };
        
        if (userRole === 'FIELD_AGENT') {
          where.assignedTo = userId;
        }

        const caseSqlVals: any[] = [where.id];
        let caseSql = `SELECT id FROM cases WHERE id = $1`;
        if (where.assignedTo) { caseSql += ` AND "assignedTo" = $2`; caseSqlVals.push(where.assignedTo); }
        const caseRes = await query(caseSql, caseSqlVals);
        const existingCase = caseRes.rows[0];

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
      }

      // Save location data
      const locRes = await query(
        `INSERT INTO locations (id, "caseId", latitude, longitude, accuracy, timestamp, source)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)
         RETURNING id, timestamp`,
        [caseId || null, latitude, longitude, accuracy, new Date(timestamp), source]
      );
      const locationRecord = locRes.rows[0];

      await createAuditLog({
        action: 'MOBILE_LOCATION_CAPTURED',
        entityType: 'LOCATION',
        entityId: locationRecord.id,
        userId,
        details: {
          caseId,
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
      console.error('Capture location error:', error);
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
  static async validateLocation(req: Request, res: Response) {
    try {
      const { 
        latitude, 
        longitude, 
        expectedAddress, 
        radius = 100 
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
          const actualAddress = await this.reverseGeocodeHelper(latitude, longitude);
          
          if (actualAddress) {
            // Simple address matching (in production, use more sophisticated matching)
            const similarity = this.calculateAddressSimilarity(expectedAddress, actualAddress);
            validationResult = {
              isValid: similarity > 0.7,
              distance: 0, // Would calculate actual distance in production
              address: actualAddress,
              confidence: similarity,
              suggestions: similarity < 0.7 ? [actualAddress] : undefined,
            };
          }
        } catch (geocodeError) {
          console.error('Geocoding error:', geocodeError);
          // Continue with basic validation
        }
      }

      res.json({
        success: true,
        message: 'Location validation completed',
        data: validationResult,
      });
    } catch (error) {
      console.error('Validate location error:', error);
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
  static async reverseGeocode(req: Request, res: Response) {
    try {
      const { latitude, longitude } = req.query;

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

      const address = await this.reverseGeocodeHelper(
        parseFloat(latitude as string),
        parseFloat(longitude as string)
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
            latitude: parseFloat(latitude as string),
            longitude: parseFloat(longitude as string),
          },
        },
      });
    } catch (error) {
      console.error('Reverse geocode error:', error);
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
  static async getCaseLocationHistory(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const userId = (req as any).user?.userId;
      const userRole = (req as any).user?.role;

      // Verify case access
      const where: any = { id: caseId };
      if (userRole === 'FIELD') {
        where.assignedToId = userId;
      }

      const vals8: any[] = [caseId];
      let exSql6 = `SELECT id FROM cases WHERE id = $1`;
      if (userRole === 'FIELD') { exSql6 += ` AND "assignedToId" = $2`; vals8.push(userId); }
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
        `SELECT l.id, l.latitude, l.longitude, l.accuracy, l.timestamp, l.source, c.id as "caseId", c.title, c."customerName"
         FROM locations l JOIN cases c ON c.id = l."caseId"
         WHERE l."caseId" = $1 ORDER BY l.timestamp DESC`,
        [caseId]
      );

      const formattedHistory = locRes.rows.map((location: any) => ({
        id: location.id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: new Date(location.timestamp).toISOString(),
        source: location.source,
        case: { id: location.caseId, title: location.title, customerName: location.customerName },
      }));

      res.json({
        success: true,
        message: 'Location history retrieved successfully',
        data: formattedHistory,
      });
    } catch (error) {
      console.error('Get case location history error:', error);
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
  private static async reverseGeocodeHelper(latitude: number, longitude: number): Promise<string | null> {
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
      console.error('Reverse geocoding error:', error);
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
  static async getUserLocationTrail(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { startDate, endDate, limit = 100 } = req.query;

      const where: any = { userId };

      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) {
          where.timestamp.gte = new Date(startDate as string);
        }
        if (endDate) {
          where.timestamp.lte = new Date(endDate as string);
        }
      }

      const vals: any[] = [];
      let sql = `SELECT l.id, l.latitude, l.longitude, l.accuracy, l.timestamp, l.source, c.id as "caseId", c.title, c."customerName" FROM locations l JOIN cases c ON c.id = l."caseId"`;
      const wh: string[] = [];
      if (where.caseId) { vals.push(where.caseId); wh.push(`l."caseId" = $${vals.length}`); }
      if (where.timestamp?.gte) { vals.push(where.timestamp.gte); wh.push(`l.timestamp >= $${vals.length}`); }
      if (where.timestamp?.lte) { vals.push(where.timestamp.lte); wh.push(`l.timestamp <= $${vals.length}`); }
      if (wh.length) sql += ` WHERE ${wh.join(' AND ')}`;
      sql += ` ORDER BY l.timestamp DESC LIMIT $${vals.length + 1}`;
      vals.push(parseInt(limit as string));
      const locationTrailRes = await query(sql, vals);
      const locationTrail = locationTrailRes.rows;

      const formattedTrail = locationTrail.map(location => ({
        id: location.id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp.toISOString(),
        source: location.source,
        case: location.case,
      }));

      res.json({
        success: true,
        message: 'Location trail retrieved successfully',
        data: formattedTrail,
      });
    } catch (error) {
      console.error('Get user location trail error:', error);
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
