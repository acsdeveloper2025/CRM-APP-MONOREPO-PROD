import { Router } from 'express';
import { authenticateToken, requireFieldOrHigher } from '@/middleware/auth';
import { geoRateLimit } from '@/middleware/rateLimiter';

const router = Router();

// Apply authentication and rate limiting
router.use(authenticateToken);
router.use(requireFieldOrHigher);
router.use(geoRateLimit);

// Placeholder routes - will be implemented
router.post('/capture/:caseId', (req, res) => {
  res.json({
    success: true,
    message: 'Capture location for case - to be implemented',
  });
});

router.post('/validate', (req, res) => {
  res.json({
    success: true,
    message: 'Validate location - to be implemented',
  });
});

router.post('/reverse-geocode', (req, res) => {
  res.json({
    success: true,
    message: 'Reverse geocoding - to be implemented',
  });
});

export default router;
