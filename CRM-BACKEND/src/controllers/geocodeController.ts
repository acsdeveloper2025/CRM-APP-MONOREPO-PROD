import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '../middleware/auth';
import { MobileLocationController } from './mobileLocationController';

/**
 * Admin-side reverse geocoding. Used by the CRM web frontend when
 * rendering attachment photos — it passes the stored GPS coords
 * (gps_latitude, gps_longitude) and receives an assembled address
 * string for display. Mobile has its own parallel route under
 * /mobile/location/reverse-geocode; both delegate to the same helper
 * so there is a single upstream Google key per server.
 *
 * C8 follow-up, 2026-04-21.
 */
export class GeocodeController {
  static async reverseGeocode(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const latRaw = (req.query.latitude as unknown as string) || '';
      const lonRaw = (req.query.longitude as unknown as string) || '';

      if (!latRaw || !lonRaw) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required',
          error: {
            code: 'MISSING_COORDINATES',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const latitude = parseFloat(latRaw);
      const longitude = parseFloat(lonRaw);

      if (
        Number.isNaN(latitude) ||
        Number.isNaN(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180
      ) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude must be valid numeric ranges',
          error: {
            code: 'INVALID_COORDINATES',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const address = await MobileLocationController.reverseGeocodeHelper(latitude, longitude);

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
          coordinates: { latitude, longitude },
        },
      });
    } catch (error) {
      logger.error('Admin reverse geocode error:', error);
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
}
