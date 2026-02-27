// Disabled unbound-method rule for this file as it uses method references in middleware
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';
import { EnterpriseCacheService, CacheKeys } from '../services/enterpriseCacheService';
import { logger } from '../config/logger';
import crypto from 'crypto';

export const getFieldMonitoringScopeHash = (req: AuthenticatedRequest): string => {
  const scopePayload = {
    assignedClientIds: req.user?.assignedClientIds || [],
    assignedProductIds: req.user?.assignedProductIds || [],
    teamLeaderId: req.user?.teamLeaderId || null,
    managerId: req.user?.managerId || null,
    primaryRole: req.user?.primaryRole || null,
    permissions: req.user?.permissionCodes || [],
  };

  return crypto.createHash('md5').update(JSON.stringify(scopePayload)).digest('hex');
};

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request, res: Response) => boolean;
  varyBy?: string[]; // Headers to vary cache by
  skipCache?: (req: Request) => boolean;
  invalidateOn?: string[]; // Events that should invalidate this cache
}

/**
 * Enterprise API response caching middleware
 */
export class EnterpriseCache {
  /**
   * Create caching middleware
   */
  static create(config: CacheConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!EnterpriseCacheService.isAvailable()) {
          res.set({
            'X-Cache': 'BYPASS',
            'X-Cache-Reason': 'redis_unavailable',
          });
          return next();
        }

        // Skip cache if condition not met
        if (config.skipCache && config.skipCache(req)) {
          return next();
        }

        // Generate cache key
        const cacheKey = config.keyGenerator
          ? config.keyGenerator(req)
          : this.defaultKeyGenerator(req, config.varyBy);

        // Try to get cached response
        const cached = await EnterpriseCacheService.get<{
          data: unknown;
          headers: Record<string, string>;
          statusCode: number;
          timestamp: number;
        }>(cacheKey);

        if (cached) {
          // Serve from cache
          logger.debug('Cache hit', { key: cacheKey, age: Date.now() - cached.timestamp });

          // Set cached headers (with null check)
          if (cached.headers && typeof cached.headers === 'object') {
            Object.entries(cached.headers).forEach(([key, value]) => {
              res.set(key, value);
            });
          }

          // Add cache headers
          res.set({
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey,
            'X-Cache-Age': Math.floor((Date.now() - cached.timestamp) / 1000).toString(),
          });

          // Force no browser caching for users endpoint
          if (cacheKey.startsWith('users:list:')) {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
          }

          return res.status(cached.statusCode || 200).json(cached.data);
        }

        // Cache miss - intercept response
        const originalSend = res.json.bind(res);
        const originalStatus = res.status.bind(res);
        let statusCode = 200;
        let _responseData: unknown;

        // Override status method
        res.status = function (code: number) {
          statusCode = code;
          return originalStatus.call(this, code);
        };

        // Override json method to cache response
        res.json = function (data: unknown) {
          _responseData = data;

          // Check if we should cache this response
          const shouldCache = !config.condition || config.condition(req, res);

          if (shouldCache && statusCode >= 200 && statusCode < 300) {
            // Cache successful responses
            const cacheData = {
              data,
              headers: this.getHeaders(),
              statusCode,
              timestamp: Date.now(),
            };

            EnterpriseCacheService.set(cacheKey, cacheData, config.ttl).catch(error =>
              logger.error('Cache set error:', error)
            );

            logger.debug('Response cached', { key: cacheKey, ttl: config.ttl });
          }

          // Add cache headers
          this.set({
            'X-Cache': 'MISS',
            'X-Cache-Key': cacheKey,
          });

          return originalSend.call(this, data);
        };

        next();
      } catch (error) {
        logger.error('Cache middleware error:', error);
        next(); // Continue without caching on error
      }
    };
  }

  /**
   * Default cache key generator
   */
  private static defaultKeyGenerator(req: Request, varyBy?: string[]): string {
    const userId = (req as AuthenticatedRequest).user?.id || 'anonymous';
    const method = req.method;
    const path = req.path;
    const query = JSON.stringify(req.query);

    const keyParts = [method, path, query];

    // Add vary headers to key
    if (varyBy) {
      const varyValues = varyBy.map(header => req.get(header) || '').join(':');
      keyParts.push(varyValues);
    }

    const baseKey = keyParts.join(':');
    const hash = crypto.createHash('md5').update(baseKey).digest('hex');

    return `api_cache:${userId}:${hash}`;
  }

  /**
   * Cache invalidation middleware
   * @param patterns - Array of cache key patterns to invalidate
   * @param options - Configuration options
   * @param options.synchronous - If true, wait for cache invalidation before sending response (prevents race conditions)
   */
  static invalidate(patterns: string[], options: { synchronous?: boolean } = {}) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Store original end method
      const originalEnd = res.end.bind(res);

      res.end = function (...args: unknown[]): Response {
        // Only invalidate on successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const invalidateCache = async () => {
            try {
              for (const pattern of patterns) {
                const resolvedPattern = EnterpriseCache.resolvePattern(pattern, req);
                await EnterpriseCacheService.clearByPattern(resolvedPattern);
                logger.debug('Cache invalidated', { pattern: resolvedPattern });
              }
            } catch (error) {
              logger.error('Cache invalidation error:', error);
            }
          };

          if (options.synchronous) {
            // Synchronous invalidation: wait for cache to clear before sending response
            // This prevents race conditions but adds ~10-50ms latency
            void invalidateCache().then(() => {
              originalEnd.apply(res, args);
            });
            return res;
          } else {
            // Asynchronous invalidation: clear cache after response is sent (default)
            // Better performance but may cause stale data on immediate refetch
            setImmediate(() => {
              void invalidateCache();
            });
          }
        }

        // Call original end method for async invalidation or non-success responses
        return originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * Resolve cache invalidation patterns with request data
   */
  private static resolvePattern(pattern: string, req: Request): string {
    const rawCaseId = req.params.id || req.params.caseId;
    const caseIdStr = Array.isArray(rawCaseId)
      ? String(rawCaseId[0] || '')
      : String(rawCaseId || '');
    const caseId = caseIdStr || '*';
    return pattern
      .replace('{userId}', (req as AuthenticatedRequest).user?.id || '*')
      .replace('{caseId}', caseId)
      .replace('{method}', req.method);
  }

  /**
   * Conditional caching based on request/response characteristics
   */
  static conditional(
    configs: Array<{ condition: (req: Request) => boolean; config: CacheConfig }>
  ) {
    return (req: Request, res: Response, next: NextFunction) => {
      const matchedConfig = configs.find(({ condition }) => condition(req));

      if (matchedConfig) {
        return this.create(matchedConfig.config)(req, res, next);
      }

      next();
    };
  }

  /**
   * Cache warming - preload frequently accessed data
   */
  static async warmCache(
    warmingTasks: Array<{
      key: string;
      fetcher: () => Promise<unknown>;
      ttl: number;
    }>
  ): Promise<void> {
    logger.info('Starting cache warming', { tasks: warmingTasks.length });

    const promises = warmingTasks.map(async ({ key, fetcher, ttl }) => {
      try {
        const data = await fetcher();
        await EnterpriseCacheService.set(key, data, ttl);
        logger.debug('Cache warmed', { key });
      } catch (error) {
        logger.error('Cache warming failed', { key, error });
      }
    });

    await Promise.allSettled(promises);
    logger.info('Cache warming completed');
  }

  /**
   * Cache statistics for monitoring
   */
  static async getStats(): Promise<{
    hitRate: number;
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
  }> {
    try {
      const stats = await EnterpriseCacheService.getStats();

      // Extract cache statistics (simplified)
      const keyspace = stats.keyspace as Record<string, number> | undefined;
      const keyspaceHits = keyspace?.keyspace_hits || 0;
      const keyspaceMisses = keyspace?.keyspace_misses || 0;
      const totalRequests = keyspaceHits + keyspaceMisses;
      const hitRate = totalRequests > 0 ? keyspaceHits / totalRequests : 0;

      return {
        hitRate,
        totalRequests,
        cacheHits: keyspaceHits,
        cacheMisses: keyspaceMisses,
      };
    } catch (error) {
      logger.error('Get cache stats error:', error);
      return {
        hitRate: 0,
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
      };
    }
  }
}

// Enterprise cache configurations - OPTIMIZED FOR HIGH HIT RATES
export const EnterpriseCacheConfigs = {
  // User data caching - INCREASED TTL
  userData: {
    ttl: 1800, // 30 minutes (users don't change frequently)
    keyGenerator: (req: Request) => CacheKeys.user((req as AuthenticatedRequest).user?.id),
    condition: (req: Request) => req.method === 'GET',
  },

  // Case list caching - INCREASED TTL
  caseList: {
    ttl: 300, // 5 minutes (was 1 minute - too aggressive)
    keyGenerator: (req: Request) => {
      const userId = (req as AuthenticatedRequest).user?.id;
      const page = Number(req.query.page) || 1;
      const filters = JSON.stringify(req.query);
      return `${CacheKeys.userCases(userId, Number(page))}:${crypto.createHash('md5').update(filters).digest('hex')}`;
    },
    skipCache: (req: Request) => {
      const rawUseCache = Array.isArray(req.query.useCache)
        ? req.query.useCache[0]
        : req.query.useCache;
      const normalizedUseCache =
        typeof rawUseCache === 'string' || typeof rawUseCache === 'number'
          ? String(rawUseCache)
          : 'true';
      return normalizedUseCache.toLowerCase() === 'false';
    },
    varyBy: ['X-User-Role'],
  },

  // Case details caching - INCREASED TTL
  caseDetails: {
    ttl: 900, // 15 minutes (was 5 minutes)
    keyGenerator: (req: Request) => {
      const userId = (req as AuthenticatedRequest).user?.id || 'anon';
      const rawId = req.params.id || req.params.caseId || req.params.taskId;
      const caseId = Array.isArray(rawId) ? String(rawId[0] || '') : String(rawId || '');
      const scopeMarker = `${req.path}:${JSON.stringify(req.query)}`;
      const scopeHash = crypto.createHash('md5').update(scopeMarker).digest('hex');
      return `${CacheKeys.scopedCase(userId, caseId)}:${scopeHash}`;
    },
    condition: (req: Request) => req.method === 'GET',
  },

  // Analytics caching - INCREASED TTL
  analytics: {
    ttl: 1800, // 30 minutes (was 15 minutes)
    keyGenerator: (req: Request) => {
      const userId = (req as AuthenticatedRequest).user?.id || 'anon';
      const path = req.path.replace('/api/', '');
      const query = JSON.stringify(req.query);
      return `analytics:${userId}:${path}:${crypto.createHash('md5').update(query).digest('hex')}`;
    },
  },

  // Field agent workload caching - INCREASED TTL
  workload: {
    ttl: 600, // 10 minutes (was 3 minutes)
    keyGenerator: () => CacheKeys.fieldAgentWorkload(),
  },

  // Mobile sync data caching - INCREASED TTL
  mobileSync: {
    ttl: 120, // 2 minutes (was 30 seconds - too aggressive)
    keyGenerator: (req: Request) => {
      const userId = (req as AuthenticatedRequest).user?.id || 'anon';
      const queryHash = crypto.createHash('md5').update(JSON.stringify(req.query)).digest('hex');
      return CacheKeys.scopedMobileSync(userId, queryHash);
    },
    condition: (req: Request) => req.method === 'GET',
  },

  dashboard: {
    ttl: 60,
    keyGenerator: (req: Request) => {
      const userId = (req as AuthenticatedRequest).user?.id || 'anon';
      const path = req.path;
      const query = JSON.stringify(req.query);
      return `dashboard:${userId}:${path}:${crypto.createHash('md5').update(query).digest('hex')}`;
    },
    condition: (req: Request) => req.method === 'GET',
  },

  // Client list caching - NEW
  clientList: {
    ttl: 3600, // 1 hour (clients rarely change)
    keyGenerator: (req: Request) => {
      const userId = (req as AuthenticatedRequest).user?.id || 'anon';
      const query = JSON.stringify(req.query);
      return `clients:list:${userId}:${crypto.createHash('md5').update(query).digest('hex')}`;
    },
    condition: (req: Request) => req.method === 'GET',
  },

  // Verification types caching - NEW
  verificationTypes: {
    ttl: 3600, // 1 hour (verification types rarely change)
    keyGenerator: (req: Request) => {
      const userId = (req as AuthenticatedRequest).user?.id || 'anon';
      const query = JSON.stringify(req.query);
      return `verification-types:list:${userId}:${crypto.createHash('md5').update(query).digest('hex')}`;
    },
    condition: (req: Request) => req.method === 'GET',
  },

  // Products caching - NEW
  products: {
    ttl: 3600, // 1 hour (products rarely change)
    keyGenerator: (req: Request) => {
      const userId = (req as AuthenticatedRequest).user?.id || 'anon';
      const query = JSON.stringify(req.query);
      return `products:list:${userId}:${crypto.createHash('md5').update(query).digest('hex')}`;
    },
    condition: (req: Request) => req.method === 'GET',
  },

  // Rate types caching - NEW
  rateTypes: {
    ttl: 3600, // 1 hour (rate types rarely change)
    keyGenerator: (req: Request) => {
      const userId = (req as AuthenticatedRequest).user?.id || 'anon';
      const query = JSON.stringify(req.query);
      return `rate-types:list:${userId}:${crypto.createHash('md5').update(query).digest('hex')}`;
    },
    condition: (req: Request) => req.method === 'GET',
  },

  // Users list caching - FIXED (now includes all query params)
  usersList: {
    ttl: 300, // 5 minutes
    keyGenerator: (req: Request) => {
      const query = JSON.stringify(req.query);
      const userId = (req as AuthenticatedRequest).user?.id || 'anon';
      return `users:list:${userId}:${crypto.createHash('md5').update(query).digest('hex')}`;
    },
    condition: (req: Request) => req.method === 'GET',
    varyBy: ['X-User-Role'],
  },

  // User dashboard/stats cards caching - short TTL with explicit invalidation
  userStats: {
    ttl: 30, // Keep fresh because cards are highly visible and include recent logins
    keyGenerator: (req: Request) => {
      const userId = (req as AuthenticatedRequest).user?.id || 'anon';
      const query = JSON.stringify(req.query);
      return `${CacheKeys.userStats(userId)}:${crypto.createHash('md5').update(query).digest('hex')}`;
    },
    condition: (req: Request) => req.method === 'GET',
  },

  fieldMonitoringStats: {
    ttl: 30,
    keyGenerator: (req: Request) => {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id || 'anon';
      const scopeHash = getFieldMonitoringScopeHash(authReq);
      return CacheKeys.fieldMonitoringStats(userId, scopeHash);
    },
    condition: (req: Request) => req.method === 'GET',
  },

  fieldMonitoringRoster: {
    ttl: 10,
    keyGenerator: (req: Request) => {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id || 'anon';
      const page = Number(req.query.page) || 1;
      const scopeHash = getFieldMonitoringScopeHash(authReq);
      const queryHash = crypto.createHash('md5').update(JSON.stringify(req.query)).digest('hex');
      return CacheKeys.fieldMonitoringRoster(userId, page, scopeHash, queryHash);
    },
    condition: (req: Request) => req.method === 'GET',
  },

  fieldMonitoringDetails: {
    ttl: 10,
    keyGenerator: (req: Request) => {
      const authReq = req as AuthenticatedRequest;
      const viewerUserId = authReq.user?.id || 'anon';
      const rawId = req.params.id;
      const targetUserId = Array.isArray(rawId) ? String(rawId[0] || '') : String(rawId || '');
      const scopeHash = getFieldMonitoringScopeHash(authReq);
      return CacheKeys.fieldMonitoringUserDetail(viewerUserId, targetUserId, scopeHash);
    },
    condition: (req: Request) => req.method === 'GET',
  },
};

// Cache invalidation patterns
export const CacheInvalidationPatterns = {
  caseUpdate: [
    'api_cache:*:*cases*',
    'analytics:*',
    CacheKeys.fieldAgentWorkload(),
    'user:*:cases:page:*',
    'case:*',
    'dashboard:*',
    'mobile:sync:*',
    'field-monitoring:*',
  ],

  userUpdate: [
    'api_cache:{userId}:*',
    CacheKeys.user('{userId}'),
    'users:*',
    'users:stats:*',
    'field-monitoring:*',
  ],

  assignmentUpdate: [
    'api_cache:*:*cases*',
    'analytics:*',
    CacheKeys.fieldAgentWorkload(),
    'mobile:sync:*',
    'user:*:cases:page:*',
    'case:*',
    'dashboard:*',
    'users:*', // Invalidate user lists to update assignment counts
    'field-monitoring:*',
  ],

  clientUpdate: ['clients:*', 'api_cache:*:*clients*'],

  verificationTypeUpdate: ['verification-types:*', 'api_cache:*:*verification-types*'],

  productUpdate: ['products:*', 'api_cache:*:*products*'],

  rateTypeUpdate: ['rate-types:*', 'api_cache:*:*rate-types*'],

  fieldMonitoringUpdate: ['field-monitoring:*'],
};
