import { Router, type Request, type Response } from 'express';
import { body } from 'express-validator';
import { login, logout, getCurrentUser, refreshToken } from '@/controllers/authController';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import {
  authRateLimit,
  resetAuthRateLimitForIp,
  resetRoleRateLimitForUser,
} from '@/middleware/rateLimiter';
import { logger } from '@/config/logger';

const router = Router();

// Auth rate limiting applied for security

// Login validation
const loginValidation = [
  body('username')
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

// Rate limit reset endpoint — clears the authRateLimit counter for the
// caller's IP. Used to unlock legitimate users who got rate-limited.
const resetRateLimit = (req: Request, res: Response) => {
  try {
    const ip = req.ip || 'unknown';
    const resetSuccess = resetAuthRateLimitForIp(ip);

    if (resetSuccess) {
      res.json({
        success: true,
        message: 'Rate limit reset successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to reset rate limit',
      });
    }
  } catch (error) {
    logger.error('Rate limit reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Rate limit reset for a specific user — clears the role-based limiter
// counter for the given userId. If an IP is also supplied, the auth
// limiter counter for that IP is cleared too.
const resetUserRateLimit = (req: Request, res: Response) => {
  try {
    const rawUserId = req.params.userId;
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : String(rawUserId || '');
    const { ip } = req.body as { ip?: string };

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    let resetCount = 0;
    if (resetRoleRateLimitForUser(userId)) {
      resetCount += 1;
    }
    if (ip && resetAuthRateLimitForIp(ip)) {
      resetCount += 1;
    }

    res.json({
      success: true,
      message: `Rate limit reset successfully for user (${resetCount} keys cleared)`,
      data: { resetCount, userId },
    });
  } catch (error) {
    logger.error('User rate limit reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Routes
// ... (skip lines) ...
router.post('/login', authRateLimit, validate(loginValidation), login);
router.post('/refresh-token', authRateLimit, refreshToken);
router.post('/logout', authenticateToken, logout);
router.get('/me', authenticateToken, getCurrentUser);
router.post('/reset-rate-limit', authenticateToken, authorize('settings.manage'), resetRateLimit);
router.post(
  '/reset-user-rate-limit/:userId',
  authenticateToken,
  authorize('settings.manage'),
  resetUserRateLimit
);

export default router;
