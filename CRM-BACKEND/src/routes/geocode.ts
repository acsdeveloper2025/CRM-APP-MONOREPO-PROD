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

export default router;
