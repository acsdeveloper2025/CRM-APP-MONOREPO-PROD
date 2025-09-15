import { Router } from 'express';
import { body } from 'express-validator';
import { login, logout, getCurrentUser, preloginInfo } from '@/controllers/authController';
import { authenticateToken } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import { EnterpriseRateLimit } from '@/middleware/enterpriseRateLimit';
import { Request, Response } from 'express';


const router = Router();

// Removed auth rate limiting for better user experience

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





// Rate limit reset endpoint
const resetRateLimit = async (req: Request, res: Response) => {
  try {
    const { ip } = req;
    const loginKey = `POST:/api/auth/login:${ip}`;

    // Reset rate limit for login endpoint
    const resetSuccess = await EnterpriseRateLimit.reset(loginKey);

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
    console.error('Rate limit reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Rate limit reset for specific user endpoint
const resetUserRateLimit = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { ip } = req.body; // IP address to reset rate limit for

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // If IP is provided, reset for specific IP, otherwise reset for all common patterns
    const keysToReset = [];

    if (ip) {
      keysToReset.push(`POST:/api/auth/login:${ip}`);
    } else {
      // Reset common rate limit patterns for this user
      keysToReset.push(
        `POST:/api/auth/login:${userId}`,
        `user:${userId}:login`,
        `user:${userId}:auth`
      );
    }

    let resetCount = 0;
    for (const key of keysToReset) {
      const resetSuccess = await EnterpriseRateLimit.reset(key);
      if (resetSuccess) resetCount++;
    }

    res.json({
      success: true,
      message: `Rate limit reset successfully for user (${resetCount} keys cleared)`,
      data: { resetCount, userId }
    });
  } catch (error) {
    console.error('User rate limit reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Routes
router.post('/prelogin', [body('username').notEmpty().withMessage('Username is required')], validate, preloginInfo);
router.post('/login', validate(loginValidation), login);
router.post('/logout', authenticateToken, logout);
router.get('/me', authenticateToken, getCurrentUser);
router.post('/reset-rate-limit', resetRateLimit);
router.post('/reset-user-rate-limit/:userId', authenticateToken, resetUserRateLimit);

export default router;
