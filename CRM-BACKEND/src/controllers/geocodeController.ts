import type { Response } from 'express';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { config } from '@/config';
import { redisClient, isRedisHealthy } from '@/config/redis';
import type { AuthenticatedRequest } from '../middleware/auth';
import { MobileLocationController } from './mobileLocationController';

// Server-side cache for the Static Maps proxy. Without this every fresh
// browser session re-fetches the PNG from Google for each photo card
// — at 20 photos/case × ~30 cases/day × $0.002 = ~$1.20/day at our
// current scale, scaling linearly with case volume. Key is the
// (lat, lng, size, zoom) tuple; same key always renders the same map.
// TTL 7d so an updated map (rare) gets picked up; can be tuned via env.
const STATIC_MAP_TTL_SECONDS = parseInt(process.env.STATIC_MAP_CACHE_TTL_SECONDS || '604800', 10);
const staticMapCacheKey = (lat: number, lng: number, size: string, zoom: number): string =>
  `gmap:${lat.toFixed(6)}:${lng.toFixed(6)}:${size}:${zoom}`;

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

  /**
   * Attachment-anchored reverse geocode. Integrity-critical for
   * verification evidence (user directive 2026-04-21):
   *
   *   GET /api/attachments/:attachmentId/address
   *
   * Returns the SAME address forever, regardless of future changes
   * in Google's data. First successful resolve is stored in
   * verification_attachments.reverse_geocoded_address via a
   * write-through; all subsequent calls serve the stored value
   * without touching Google. Once stored, the address is frozen for
   * that attachment.
   *
   * 404 if the attachment doesn't exist or has no GPS.
   * 502 if the first-time Google call fails (caller retries later).
   */
  static async attachmentAddress(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const attachmentId = parseInt(String(req.params.attachmentId || ''), 10);
      if (!Number.isFinite(attachmentId) || attachmentId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid attachment id',
          error: { code: 'INVALID_ATTACHMENT_ID', timestamp: new Date().toISOString() },
        });
      }

      // F5.4.2: source coords from `geo_location` jsonb (canonical mobile-supplied
      // payload). The legacy `gps_latitude`/`gps_longitude` columns were planned
      // for an EXIF-extracted-coords anti-fraud feature that was never shipped —
      // they were always NULL, which made first-time address resolution return
      // 404 NO_COORDINATES even though the lat/lng was sitting in `geo_location`.
      const lookup = await query(
        `SELECT id,
                NULLIF(geo_location->>'latitude','')::double precision  AS latitude,
                NULLIF(geo_location->>'longitude','')::double precision AS longitude,
                reverse_geocoded_address
           FROM verification_attachments
          WHERE id = $1
            AND deleted_at IS NULL
          LIMIT 1`,
        [attachmentId]
      );

      if (lookup.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Attachment not found',
          error: { code: 'ATTACHMENT_NOT_FOUND', timestamp: new Date().toISOString() },
        });
      }

      const row = lookup.rows[0] as {
        id: number;
        latitude: number | null;
        longitude: number | null;
        reverse_geocoded_address: string | null;
      };

      // Fast path — already stored. This is the case for every view
      // after the first. Addresses never change once frozen.
      if (row.reverse_geocoded_address) {
        return res.json({
          success: true,
          data: { address: row.reverse_geocoded_address, cached: true },
        });
      }

      const latitude = row.latitude;
      const longitude = row.longitude;
      if (
        latitude == null ||
        longitude == null ||
        Number.isNaN(latitude) ||
        Number.isNaN(longitude)
      ) {
        return res.status(404).json({
          success: false,
          message: 'Attachment has no GPS coordinates; address cannot be resolved',
          error: { code: 'NO_COORDINATES', timestamp: new Date().toISOString() },
        });
      }

      // First-view resolve. Hit Google, persist, return.
      const address = await MobileLocationController.reverseGeocodeHelper(latitude, longitude);
      if (!address) {
        return res.status(502).json({
          success: false,
          message: 'Reverse geocoding upstream unavailable; try again shortly',
          error: { code: 'UPSTREAM_UNAVAILABLE', timestamp: new Date().toISOString() },
        });
      }

      // Write-through so every subsequent view returns the exact same
      // string we're returning now.
      await query(
        `UPDATE verification_attachments
            SET reverse_geocoded_address = $1
          WHERE id = $2
            AND reverse_geocoded_address IS NULL`,
        [address, attachmentId]
      );

      return res.json({
        success: true,
        data: { address, cached: false },
      });
    } catch (error) {
      logger.error('Attachment address lookup error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'ATTACHMENT_ADDRESS_FAILED', timestamp: new Date().toISOString() },
      });
    }
  }

  /**
   * Static Maps proxy. The FE photo-card composite (web admin download)
   * embeds a small location thumbnail next to the address strip; we
   * proxy through the backend so the Google Maps API key stays
   * server-side. Returns the PNG bytes directly with a one-day cache
   * header — same coordinates always render the same map, so a long
   * Cache-Control reduces Google quota burn.
   */
  static async staticMap(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const latRaw = (req.query.latitude as string) || '';
      const lonRaw = (req.query.longitude as string) || '';
      const sizeRaw = (req.query.size as string) || '200x200';
      const zoomRaw = parseInt((req.query.zoom as string) || '16', 10);
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
          message: 'Latitude and longitude required',
          error: { code: 'INVALID_COORDINATES' },
        });
      }
      // Defensive: clamp size to 100..600 px per dimension; clamp zoom
      // to 1..20 (Google's valid range). Static-Maps will 400 outside.
      const sizeMatch = /^(\d{2,3})x(\d{2,3})$/.exec(sizeRaw);
      const w = sizeMatch ? Math.min(600, Math.max(100, parseInt(sizeMatch[1], 10))) : 200;
      const h = sizeMatch ? Math.min(600, Math.max(100, parseInt(sizeMatch[2], 10))) : 200;
      const zoom = Number.isFinite(zoomRaw) ? Math.min(20, Math.max(1, zoomRaw)) : 16;

      const apiKey = config.googleMapsApiKey;
      if (!apiKey) {
        return res.status(503).json({
          success: false,
          message: 'Static maps unavailable (no API key)',
          error: { code: 'MAPS_KEY_MISSING' },
        });
      }

      // Redis cache lookup — same (lat, lng, size, zoom) always returns
      // the same PNG, so cross-session traffic for the same photo card
      // never re-hits Google. Stored as base64 because node-redis client
      // returns strings by default.
      const cacheKey = staticMapCacheKey(latitude, longitude, `${w}x${h}`, zoom);
      if (isRedisHealthy()) {
        try {
          const cached = await redisClient.get(cacheKey);
          if (cached) {
            const buf = Buffer.from(cached, 'base64');
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
            res.setHeader('X-Cache', 'HIT');
            return res.send(buf);
          }
        } catch (cacheErr) {
          // Cache miss / Redis blip → fall through to Google. Don't
          // fail the request just because cache lookup tripped.
          logger.warn('Static map cache lookup failed', {
            error: cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
          });
        }
      }

      const url =
        `https://maps.googleapis.com/maps/api/staticmap` +
        `?center=${latitude},${longitude}` +
        `&zoom=${zoom}` +
        `&size=${w}x${h}` +
        `&scale=2` +
        `&markers=color:red%7C${latitude},${longitude}` +
        `&key=${encodeURIComponent(apiKey)}`;

      const upstream = await fetch(url);
      if (!upstream.ok) {
        // Capture Google's error body so the failure cause is visible
        // in pm2 logs without a tcpdump. Google encodes "API key not
        // authorized for this API" / "Daily quota exceeded" / "Billing
        // not enabled" / etc. as plain-text or JSON in the body.
        let bodyText = '';
        try {
          bodyText = await upstream.text();
        } catch {
          /* ignore body read failure */
        }
        logger.warn('Static map upstream non-200', {
          status: upstream.status,
          latitude,
          longitude,
          body: bodyText.slice(0, 500),
        });
        return res.status(502).json({
          success: false,
          message: 'Static map upstream unavailable',
          error: { code: 'MAPS_UPSTREAM_FAILED', upstreamStatus: upstream.status },
        });
      }
      const arrayBuffer = await upstream.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Populate cache for the next visitor (best-effort; cache write
      // failures should never break the response).
      if (isRedisHealthy()) {
        try {
          await redisClient.set(cacheKey, buffer.toString('base64'), {
            EX: STATIC_MAP_TTL_SECONDS,
          });
        } catch (cacheErr) {
          logger.warn('Static map cache write failed', {
            error: cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
          });
        }
      }

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      res.setHeader('X-Cache', 'MISS');
      return res.send(buffer);
    } catch (error) {
      logger.error('Static map proxy error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'STATIC_MAP_FAILED' },
      });
    }
  }
}
