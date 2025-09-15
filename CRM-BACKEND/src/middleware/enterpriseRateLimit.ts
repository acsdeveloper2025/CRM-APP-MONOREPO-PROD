import { Request, Response, NextFunction } from 'express';
import { EnterpriseCacheService, CacheKeys } from '../services/enterpriseCacheService';
import { logger } from '../config/logger';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: number;
}

/**
 * Enterprise-grade rate limiting middleware
 * Supports different limits for different user roles and endpoints
 */
export class EnterpriseRateLimit {
  /**
   * Create rate limiting middleware with enterprise configurations
   */
  static create(config: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = config.keyGenerator ? config.keyGenerator(req) : this.defaultKeyGenerator(req);
        const windowMs = config.windowMs;
        const maxRequests = config.maxRequests;

        // Get current count
        const current = await EnterpriseCacheService.increment(
          key,
          Math.ceil(windowMs / 1000)
        );

        const remaining = Math.max(0, maxRequests - current);
        const resetTime = Date.now() + windowMs;

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': new Date(resetTime).toISOString(),
          'X-RateLimit-Window': windowMs.toString(),
        });

        if (current > maxRequests) {
          // Rate limit exceeded
          logger.warn('Rate limit exceeded', {
            key,
            current,
            limit: maxRequests,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            endpoint: `${req.method} ${req.path}`,
          });

          if (config.onLimitReached) {
            config.onLimitReached(req, res);
          }

          return res.status(429).json({
            success: false,
            message: 'Too many requests',
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              limit: maxRequests,
              current,
              remaining: 0,
              resetTime,
              retryAfter: Math.ceil(windowMs / 1000),
            },
          });
        }

        // Add rate limit info to request for monitoring
        (req as any).rateLimit = {
          limit: maxRequests,
          current,
          remaining,
          resetTime,
        } as RateLimitInfo;

        next();
      } catch (error) {
        logger.error('Rate limiting error:', error);
        // On error, allow request to proceed (graceful degradation)
        next();
      }
    };
  }

  /**
   * Default key generator based on IP and user ID
   */
  private static defaultKeyGenerator(req: Request): string {
    const userId = (req as any).user?.id;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const endpoint = `${req.method}:${req.route?.path || req.path}`;
    
    return CacheKeys.rateLimit(userId || ip, endpoint);
  }

  /**
   * Role-based rate limiting
   */
  static roleBasedLimiter(limits: Record<string, RateLimitConfig>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const userRole = (req as any).user?.role || 'GUEST';
      const config = limits[userRole] || limits['DEFAULT'];

      if (!config) {
        return next();
      }

      return this.create(config)(req, res, next);
    };
  }

  /**
   * Endpoint-specific rate limiting
   */
  static endpointLimiter(limits: Record<string, RateLimitConfig>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const endpoint = `${req.method}:${req.route?.path || req.path}`;
      const config = limits[endpoint] || limits['DEFAULT'];

      if (!config) {
        return next();
      }

      return this.create(config)(req, res, next);
    };
  }

  /**
   * Adaptive rate limiting based on system load
   */
  static adaptiveLimiter(baseConfig: RateLimitConfig, loadThresholds: number[] = [0.7, 0.9]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Get system load (simplified - in production, use proper metrics)
        const systemLoad = await this.getSystemLoad();
        
        let adjustedConfig = { ...baseConfig };
        
        if (systemLoad > loadThresholds[1]) {
          // High load: reduce limits by 50%
          adjustedConfig.maxRequests = Math.floor(baseConfig.maxRequests * 0.5);
        } else if (systemLoad > loadThresholds[0]) {
          // Medium load: reduce limits by 25%
          adjustedConfig.maxRequests = Math.floor(baseConfig.maxRequests * 0.75);
        }

        return this.create(adjustedConfig)(req, res, next);
      } catch (error) {
        logger.error('Adaptive rate limiting error:', error);
        return this.create(baseConfig)(req, res, next);
      }
    };
  }

  /**
   * Get current system load (simplified implementation)
   */
  private static async getSystemLoad(): Promise<number> {
    try {
      // In production, integrate with monitoring systems
      // For now, return a mock value based on cache stats
      const stats = await EnterpriseCacheService.getStats();
      const memoryUsage = stats.memory?.used_memory_rss || 0;
      const maxMemory = stats.memory?.maxmemory || 1000000000; // 1GB default
      
      return memoryUsage / maxMemory;
    } catch {
      return 0.5; // Default moderate load
    }
  }

  /**
   * Burst protection - allows short bursts but enforces longer-term limits
   */
  static burstProtection(shortConfig: RateLimitConfig, longConfig: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const baseKey = this.defaultKeyGenerator(req);
      const shortKey = `${baseKey}:short`;
      const longKey = `${baseKey}:long`;

      try {
        // Check short-term limit (burst)
        const shortCurrent = await EnterpriseCacheService.increment(
          shortKey,
          Math.ceil(shortConfig.windowMs / 1000)
        );

        // Check long-term limit
        const longCurrent = await EnterpriseCacheService.increment(
          longKey,
          Math.ceil(longConfig.windowMs / 1000)
        );

        const shortRemaining = Math.max(0, shortConfig.maxRequests - shortCurrent);
        const longRemaining = Math.max(0, longConfig.maxRequests - longCurrent);

        // Set headers for the more restrictive limit
        const isShortLimiting = shortRemaining < longRemaining;
        const activeConfig = isShortLimiting ? shortConfig : longConfig;
        const activeCurrent = isShortLimiting ? shortCurrent : longCurrent;
        const activeRemaining = isShortLimiting ? shortRemaining : longRemaining;

        res.set({
          'X-RateLimit-Limit': activeConfig.maxRequests.toString(),
          'X-RateLimit-Remaining': activeRemaining.toString(),
          'X-RateLimit-Reset': new Date(Date.now() + activeConfig.windowMs).toISOString(),
          'X-RateLimit-Type': isShortLimiting ? 'burst' : 'sustained',
        });

        if (shortCurrent > shortConfig.maxRequests || longCurrent > longConfig.maxRequests) {
          logger.warn('Burst protection triggered', {
            shortCurrent,
            shortLimit: shortConfig.maxRequests,
            longCurrent,
            longLimit: longConfig.maxRequests,
            ip: req.ip,
            endpoint: `${req.method} ${req.path}`,
          });

          return res.status(429).json({
            success: false,
            message: 'Rate limit exceeded',
            error: {
              code: 'BURST_PROTECTION_TRIGGERED',
              type: isShortLimiting ? 'burst' : 'sustained',
              limit: activeConfig.maxRequests,
              current: activeCurrent,
              remaining: 0,
              retryAfter: Math.ceil(activeConfig.windowMs / 1000),
            },
          });
        }

        next();
      } catch (error) {
        logger.error('Burst protection error:', error);
        next();
      }
    };
  }

  /**
   * Get rate limit status for a key
   */
  static async getStatus(key: string, windowMs: number, maxRequests: number): Promise<RateLimitInfo> {
    try {
      const current = await EnterpriseCacheService.get<number>(key) || 0;
      const remaining = Math.max(0, maxRequests - current);
      const resetTime = Date.now() + windowMs;

      return {
        limit: maxRequests,
        current,
        remaining,
        resetTime,
      };
    } catch (error) {
      logger.error('Get rate limit status error:', error);
      return {
        limit: maxRequests,
        current: 0,
        remaining: maxRequests,
        resetTime: Date.now() + windowMs,
      };
    }
  }

  /**
   * Reset rate limit for a key
   */
  static async reset(key: string): Promise<boolean> {
    try {
      return await EnterpriseCacheService.delete(key);
    } catch (error) {
      logger.error('Reset rate limit error:', error);
      return false;
    }
  }
}

// Enterprise rate limit configurations
export const EnterpriseRateLimits = {
  // General API limits by role
  byRole: {
    ADMIN: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5000, // High limit for admins
    },
    BACKEND_USER: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 2000, // Standard limit for backend users
    },
    FIELD_AGENT: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 10000, // Increased from 1500 to 10000 for high-volume case processing (100+ cases/day)
    },
    DEFAULT: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100, // Conservative limit for unauthenticated
    },
  },

  // Endpoint-specific limits
  byEndpoint: {
    'POST:/api/auth/login': {
      windowMs: 15 * 60 * 1000,
      maxRequests: 10, // Prevent brute force
    },
    'POST:/api/cases/bulk/assign': {
      windowMs: 5 * 60 * 1000,
      maxRequests: 20, // Limit bulk operations
    },
    'POST:/api/mobile/sync/enterprise': {
      windowMs: 1 * 60 * 1000,
      maxRequests: 60, // Allow frequent mobile sync
    },
    'GET:/api/cases': {
      windowMs: 1 * 60 * 1000,
      maxRequests: 200, // High read limit
    },
  },

  // Burst protection configurations
  burst: {
    short: {
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 100, // Allow bursts
    },
    long: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 1000, // Sustained limit
    },
  },
};
