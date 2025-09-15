import { Router } from 'express';
import { authenticateToken } from '@/middleware/auth';

const router = Router();

// Apply authentication
router.use(authenticateToken);

// Placeholder routes - will be implemented
router.get('/profile', (req, res) => {
  res.json({
    success: true,
    message: 'Get user profile - to be implemented',
  });
});

router.put('/profile/photo', (req, res) => {
  res.json({
    success: true,
    message: 'Update profile photo - to be implemented',
  });
});

router.get('/id-card', (req, res) => {
  res.json({
    success: true,
    message: 'Generate digital ID card - to be implemented',
  });
});

export default router;
