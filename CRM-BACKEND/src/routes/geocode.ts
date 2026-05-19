import express from 'express';
import { query } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import { GeocodeController } from '@/controllers/geocodeController';

const router = express.Router();

// T1-5 (audit 2026-05-17): validator chains. Both endpoints read
// latitude/longitude from req.query and parse them server-side; reject
// non-numeric or out-of-range values at the edge so the handler can
// rely on numeric coercion. Coord ranges are the standard WGS84 bounds.
const coordsValidation = [
  query('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude must be a number in [-90, 90]'),
  query('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude must be a number in [-180, 180]'),
];

const staticMapValidation = [
  ...coordsValidation,
  query('size')
    .optional()
    .matches(/^\d{2,4}x\d{2,4}$/)
    .withMessage('size must be in WxH format (e.g. 200x200)'),
  query('zoom')
    .optional()
    .isInt({ min: 0, max: 21 })
    .withMessage('zoom must be an integer in [0, 21]'),
];

/**
 * GET /api/geocode/reverse?latitude=19.07&longitude=72.88
 */
router.get(
  '/reverse',
  authenticateToken,
  authorize('case.view'),
  validate(coordsValidation),
  GeocodeController.reverseGeocode
);

/**
 * GET /api/geocode/static-map?latitude=19.07&longitude=72.88&size=200x200&zoom=16
 */
router.get(
  '/static-map',
  authenticateToken,
  authorize('case.view'),
  validate(staticMapValidation),
  GeocodeController.staticMap
);

export default router;
