import type { ApiResponse } from '@/types/api';
import type { AuthenticatedRequest } from './auth';
import type { Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient, isRedisHealthy } from '@/config/redis';
import { logger } from '@/config/logger';
import {
  hasSystemScopeBypass,
  isFieldExecutionActor,
  isScopedOperationsUser,
} from '@/security/rbacAccess';

/**
 * Creates a Redis-backed store for distributed rate limiting.
 * Falls back to in-memory store if Redis is unavailable (fail-open).
 */
const getStore = (prefix: string) => {
  try {
    if (isRedisHealthy()) {
      return new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        prefix: `rl:${prefix}:`,
      });
    }
  } catch (err) {
    logger.warn('Redis rate limiter store unavailable, falling back to in-memory', {
      prefix,
      error: (err as Error).message,
    });
  }
  // Fall back to default in-memory store — still works, just not distributed
  return undefined;
};

const createRateLimiter = (
  windowMs: number,
  max: number,
  message: string,
  keyType: 'IP' | 'USER' | 'AUTO' = 'AUTO',
  storePrefix = 'default'
) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
      },
    } as ApiResponse,
    standardHeaders: true,
    legacyHeaders: false,
    store: getStore(storePrefix),
    keyGenerator: (req: AuthenticatedRequest, _res: Response) => {
      if (keyType === 'USER' && req.user?.id) {
        return req.user.id;
      }
      if (keyType === 'AUTO' && req.user?.id) {
        return req.user.id;
      }
      // Use standard behavior for IP-based limiting (handles IPv6 correctly)
      return ipKeyGenerator(req.ip || 'unknown');
    },
    // Phase E3: DEV_RATE_LIMIT_BYPASS_TOKEN has been removed. There is no
    // way to bypass these limiters at runtime — any such knob is a
    // production footgun waiting to happen.
  });
};

/**
 * Tier 1: Auth Endpoints - Very Strict
 * Prevents brute force on login/refresh
 */
export const authRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // 10 attempts
  'Too many authentication attempts, please try again later',
  'IP', // Always IP-based for auth since user ID isn't known yet
  'auth'
);

/**
 * Tier 2: General API Usage
 * Provides a generous ceiling for normal user activity
 */
export const generalRateLimit = createRateLimiter(
  60 * 1000, // 1 minute
  200, // 200 requests per minute
  'Too many requests, please slow down',
  'AUTO', // Uses userId if authenticated, IP otherwise
  'general'
);

/**
 * Tier 3: Sensitive/Heavy Operations
 * Stricter limits for resource-intensive tasks
 */

// File Uploads
export const uploadRateLimit = createRateLimiter(
  60 * 1000, // 1 minute
  30, // 30 uploads per minute
  'Too many file uploads, please wait before uploading more',
  'USER',
  'upload'
);

// Reports & Exports (Heavy DB/CPU)
export const exportRateLimit = createRateLimiter(
  5 * 60 * 1000, // 5 minutes
  5, // 5 exports per 5 minutes
  'Too many report/export requests, please wait for previous ones to complete',
  'USER',
  'export'
);

// High-volume List operations
export const listRateLimit = createRateLimiter(
  60 * 1000, // 1 minute
  60, // 1 request per second on average for lists
  'Too many list operations, please refine your filters',
  'USER',
  'list'
);

// Geolocation tracking (Mobile)
export const geoRateLimit = createRateLimiter(
  60 * 1000, // 1 minute
  120, // 2 updates per second allowed
  'Too many location updates',
  'USER',
  'geo'
);

// Mobile umbrella tier — applied once at the top of the mobile router so
// every mobile endpoint inherits the same generous quota. Distributed via
// the same Redis store used by the other tiers; replaces the former
// `mobileRateLimit` factory in mobileValidation.ts which had a non-
// distributed in-memory fallback that allowed limit amplification across
// cluster workers.
export const mobileGeneralRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10000, // 10,000 requests per 15 minutes — high-volume field agent quota
  'Too many requests, please slow down',
  'AUTO',
  'mobile'
);

/**
 * Role/capability-aware rate limiter.
 *
 * Picks one of four limits based on the caller's capability profile:
 *   - SYSTEM     (systemScopeBypass = true): 5000 req / 15 min
 *   - EXECUTION  (field agents):             10000 req / 15 min
 *   - OPERATIONS (scoped backend users):     2000 req / 15 min
 *   - DEFAULT    (everything else, incl. unauthenticated): 100 req / 15 min
 *
 * Implementation note: express-rate-limit's `limit` option accepts a
 * function `(req, res) => number`, so a single limiter instance services
 * all four buckets. The per-caller key is still unique (userId when
 * authenticated, else IP via the standard IPv6-safe keyGenerator), so two
 * users in the same bucket never share a counter.
 *
 * This was previously implemented in src/middleware/enterpriseRateLimit.ts
 * on a separate Redis store via EnterpriseCacheService.increment. That
 * file has been removed — everything now goes through the same
 * rate-limit-redis store as the other tiers.
 */
export const roleBasedRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: (req: AuthenticatedRequest, _res: Response) => {
    const user = req.user;
    if (!user) {
      return 100;
    }
    if (hasSystemScopeBypass(user)) {
      return 5000;
    }
    if (isFieldExecutionActor(user)) {
      return 10000;
    }
    if (isScopedOperationsUser(user)) {
      return 2000;
    }
    return 100;
  },
  message: {
    success: false,
    message: 'Too many requests',
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
    },
  } as ApiResponse,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore('role'),
  keyGenerator: (req: AuthenticatedRequest, _res: Response) => {
    return req.user?.id ?? ipKeyGenerator(req.ip || 'unknown');
  },
});

/**
 * Reset the auth (login) rate-limit counter for a given client IP. Used
 * by the admin POST /api/auth/reset-rate-limit endpoint when a legitimate
 * user has been locked out after too many failed attempts.
 *
 * The key format matches express-rate-limit's IP-based keyGenerator so
 * this only works for the authRateLimit limiter, which is the only one
 * the admin reset endpoint is concerned with.
 */
export function resetAuthRateLimitForIp(ip: string): boolean {
  try {
    const key = ipKeyGenerator(ip || 'unknown');
    // express-rate-limit's resetKey is synchronous for in-memory stores
    // and returns void | Promise<void> for async stores. Calling it
    // fire-and-forget is fine here — the admin UI only needs a best-
    // effort signal and any Redis error is logged below.
    authRateLimit.resetKey(key);
    return true;
  } catch (error) {
    logger.error('Failed to reset auth rate limit key:', error);
    return false;
  }
}

/**
 * Reset a role-based rate-limit counter for a given user id. Used by the
 * admin POST /api/auth/reset-user-rate-limit/:userId endpoint.
 */
export function resetRoleRateLimitForUser(userId: string): boolean {
  try {
    roleBasedRateLimit.resetKey(userId);
    return true;
  } catch (error) {
    logger.error('Failed to reset role rate limit key:', error);
    return false;
  }
}
