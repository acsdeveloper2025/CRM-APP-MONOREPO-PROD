import express from 'express';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { GeocodeController } from '@/controllers/geocodeController';

const router = express.Router();

/**
 * GET /api/geocode/reverse?latitude=19.07&longitude=72.88
 *
 * Reverse-geocode endpoint for the CRM web frontend. Returns the
 * same shape the mobile endpoint does so client code can be shared:
 *   { success: true, data: { address, coordinates: { latitude, longitude } } }
 *
 * Access: any authenticated user with `case.view`.
 */
router.get('/reverse', authenticateToken, authorize('case.view'), GeocodeController.reverseGeocode);

/**
 * GET /api/geocode/static-map?latitude=19.07&longitude=72.88&size=200x200&zoom=16
 *
 * Server-proxied Google Static Maps. The Maps API key is held server-side
 * (never shipped to the FE bundle); the endpoint streams the PNG bytes back.
 * Used by the FE photo-card composite to embed a mini-map alongside the
 * GPS-tagged photo when admin downloads the image.
 *
 * Access: any authenticated user with `case.view`.
 */
router.get('/static-map', authenticateToken, authorize('case.view'), GeocodeController.staticMap);

export default router;
