import { Router } from 'express';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';

const router = Router();

// Apply authentication
router.use(authenticateToken);
router.use(authorize('user.view'));

// Placeholder routes - will be implemented
router.get('/profile', (req, res) => {
  res.json({
    success: true,
    message: 'Get user profile - to be implemented',
  });
});

// Profile photo endpoints live on:
//   POST   /api/users/:userId/profile-photo (admin, `user.update` — see routes/users.ts)
//   DELETE /api/users/:userId/profile-photo (admin, `user.update`)
//   POST   /api/mobile/users/me/photo       (field agent, self)
// The earlier stub at PUT /user/profile/photo was deprecated in favour
// of multipart upload + sharp normalization (2026-04-21).

router.get('/id-card', (req, res) => {
  res.json({
    success: true,
    message: 'Generate digital ID card - to be implemented',
  });
});

export default router;
