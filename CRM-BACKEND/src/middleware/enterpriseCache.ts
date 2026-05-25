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

/**
 * P11.C — append an active-scope suffix to any cache key so demo-mode
 * scope switches yield cache misses + fresh narrowed data, instead of
 * the previous scope's stale response. Empty string when no scope is
 * set (key unchanged → 100% backward compatible with existing cache
 * entries). Sits at the END of the key, so wildcard invalidation
 * patterns like `users:list:*` still match scope-suffixed keys.
 *
 * See project_scope_control_audit_2026_05_14.md leak C-1.
 */
export const getActiveScopeKeySegment = (req: AuthenticatedRequest): string => {
  const c = req.activeScope?.clientId;
  const p = req.activeScope?.productId;
  if (c == null && p == null) {
    return '';
  }
  return `:as:c${c ?? '-'}:p${p ?? '-'}`;
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

        // Generate cache key. P11.C appends an active-scope suffix
        // so two requests from the same user under different
        // X-Active-Client-Id / X-Active-Product-Id headers land on
        // distinct cache entries — without this, P5's FE cache wipe
        // would be neutralised by a stale BE cache hit.
        const baseCacheKey = config.keyGenerator
          ? config.keyGenerator(req)
          : this.defaultKeyGenerator(req, config.varyBy);
        const cacheKey = baseCacheKey + getActiveScopeKeySegment(req as AuthenticatedRequest);

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

      // res.end has multiple overloads; we just forward whatever the caller
      // passed via Function.prototype.apply. The arg-tuple cast bridges
      // the unknown[] rest parameter to the overload set.
      type EndArgs = Parameters<typeof originalEnd>;
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
              originalEnd.apply(res, args as EndArgs);
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
        return originalEnd.apply(res, args as EndArgs);
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
    keyGenerator: (req: Request) =>
      CacheKeys.user((req as AuthenticatedRequest).user?.id ?? 'anon'),
    condition: (req: Request) => req.method === 'GET',
  },

  // Case list caching - INCREASED TTL
  caseList: {
    ttl: 300, // 5 minutes (was 1 minute - too aggressive)
    keyGenerator: (req: Request) => {
      const userId = (req as AuthenticatedRequest).user?.id ?? 'anon';
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
      // Bug fix 2026-05-22: req.path inside a sub-router is router-relative
      // (e.g. "/stats" for both /api/products/stats and /api/clients/stats),
      // so the key collided across resources. req.baseUrl + req.path is the
      // full app-rooted path (e.g. "/api/products/stats").
      const path = `${req.baseUrl}${req.path}`.replace('/api/', '');
      const query = JSON.stringify(req.query);
      return `analytics:${userId}:${path}:${crypto.createHash('md5').update(query).digest('hex')}`;
    },
  },

  // Field agent workload caching - INCREASED TTL
  workload: {
    ttl: 600, // 10 minutes (was 3 minutes)
    keyGenerator: () => CacheKeys.fieldAgentWorkload(),
  },

  // Mobile sync data caching - balanced TTL
  mobileSync: {
    ttl: 60, // 1 min (was 2 min). Halves the stale window for offline-first
    // mobile clients. Mutation routes invalidate via assignmentUpdate
    // pattern which includes `mobile:sync:*`.
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
    ttl: 300, // 5 min (was 1 hour). Lowered to bound permission-bypass risk
    // if a client is disabled mid-session. Short enough that a
    // disabled client stops appearing within 5 minutes.
    keyGenerator: (req: Request) => {
      const userId = (req as AuthenticatedRequest).user?.id || 'anon';
      const query = JSON.stringify(req.query);
      // Include req.baseUrl+req.path so /clients/list, /clients/:id,
      // /clients/:id/product-mappings etc. don't collide on the same key.
      // Same fix shape as the analytics keyGen fix (commit 74e24d06).
      return `clients:list:${userId}:${req.baseUrl}${req.path}:${crypto.createHash('md5').update(query).digest('hex')}`;
    },
    condition: (req: Request) => req.method === 'GET',
  },

  // Verification types caching - NEW
  verificationTypes: {
    ttl: 3600, // 1 hour (verification types rarely change)
    keyGenerator: (req: Request) => {
      const userId = (req as AuthenticatedRequest).user?.id || 'anon';
      const query = JSON.stringify(req.query);
      // Include req.baseUrl+req.path so /verification-types/list,
      // /verification-types/:id, etc. don't collide. Same shape as
      // clientList + products fixes.
      return `verification-types:list:${userId}:${req.baseUrl}${req.path}:${crypto.createHash('md5').update(query).digest('hex')}`;
    },
    condition: (req: Request) => req.method === 'GET',
  },

  // Departments caching — keyGen is path-aware from day 1 (B5 fix shape
  // applied pre-emptively to avoid the cache collision class).
  departments: {
    ttl: 3600, // 1 hour — master data, rarely changes
    keyGenerator: (req: Request) => {
      const userId = (req as AuthenticatedRequest).user?.id || 'anon';
      const query = JSON.stringify(req.query);
      return `departments:list:${userId}:${req.baseUrl}${req.path}:${crypto.createHash('md5').update(query).digest('hex')}`;
    },
    condition: (req: Request) => req.method === 'GET',
  },

  // Designations caching — same shape as departments (path-aware keyGen).
  designations: {
    ttl: 3600, // 1 hour — master data, rarely changes
    keyGenerator: (req: Request) => {
      const userId = (req as AuthenticatedRequest).user?.id || 'anon';
      const query = JSON.stringify(req.query);
      return `designations:list:${userId}:${req.baseUrl}${req.path}:${crypto.createHash('md5').update(query).digest('hex')}`;
    },
    condition: (req: Request) => req.method === 'GET',
  },

  // Products caching - NEW
  products: {
    ttl: 3600, // 1 hour (products rarely change)
    keyGenerator: (req: Request) => {
      const userId = (req as AuthenticatedRequest).user?.id || 'anon';
      const query = JSON.stringify(req.query);
      // Include req.baseUrl+req.path so /products/list, /products/:id, etc.
      // don't collide on the same key. Same shape as clientList fix.
      return `products:list:${userId}:${req.baseUrl}${req.path}:${crypto.createHash('md5').update(query).digest('hex')}`;
    },
    condition: (req: Request) => req.method === 'GET',
  },

  // Rate types caching - NEW
  // B5 hardening: keyGen includes req.baseUrl+req.path so any future consumer
  // wrapping multiple paths under /api/rate-types (e.g. /, /:id, /stats,
  // /export, /available-for-case) doesn't collide on the same cache key.
  // Matches the pattern applied to clientList/products/verificationTypes/usersList.
  rateTypes: {
    ttl: 3600, // 1 hour (rate types rarely change)
    keyGenerator: (req: Request) => {
      const userId = (req as AuthenticatedRequest).user?.id || 'anon';
      const query = JSON.stringify(req.query);
      return `rate-types:list:${userId}:${req.baseUrl}${req.path}:${crypto
        .createHash('md5')
        .update(query)
        .digest('hex')}`;
    },
    condition: (req: Request) => req.method === 'GET',
  },

  // Users list caching - FIXED (now includes all query params)
  usersList: {
    ttl: 300, // 5 minutes
    keyGenerator: (req: Request) => {
      const query = JSON.stringify(req.query);
      const userId = (req as AuthenticatedRequest).user?.id || 'anon';
      // Include req.baseUrl+req.path — this config wraps BOTH /users and
      // /users/search; without the path component, /users?q=foo and
      // /users/search?q=foo collide on the same key. Same shape as
      // clientList / products / verificationTypes fixes.
      return `users:list:${userId}:${req.baseUrl}${req.path}:${crypto.createHash('md5').update(query).digest('hex')}`;
    },
    condition: (req: Request) => req.method === 'GET',
    varyBy: ['X-User-Role'],
  },

  // User dashboard/stats cards caching - balanced TTL with explicit invalidation
  userStats: {
    ttl: 300, // 5 min (was 30s). Stats cards thrash at 30s; counters don't
    // change that fast. Mutation routes invalidate explicitly via
    // userUpdate / assignmentUpdate / notificationUpdate patterns.
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
    // NM-8 (2026-05-16): explicit `cases:*` pattern. Was originally added
    // to invalidate cache-warming pre-fills (`cases:recent:pending` etc.)
    // on revoke/revisit/assign. T0-4 (2026-05-18) deleted CacheWarmingService
    // entirely — these warmer keys no longer exist. Pattern kept for two
    // reasons: (a) defense-in-depth if any future code writes to the
    // `cases:*` namespace, (b) Redis SCAN MATCH on `case:*` does NOT match
    // `cases:*` due to the missing terminal `s` — the broader pattern is
    // cheap to keep.
    'cases:*',
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
    // 2026-05-25: a user mutation can flip department_id / designation_id
    // which changes the userCount subquery returned by /api/departments
    // + /api/designations (and their /stats endpoints). Without these,
    // those pages show stale per-master user counts until the 1h TTL
    // expires OR someone CRUDs a department/designation. Stats endpoints
    // use the `analytics:` cache prefix.
    'departments:*',
    'api_cache:*:*departments*',
    'analytics:*departments*',
    'designations:*',
    'api_cache:*:*designations*',
    'analytics:*designations*',
  ],

  assignmentUpdate: [
    'api_cache:*:*cases*',
    'analytics:*',
    CacheKeys.fieldAgentWorkload(),
    'mobile:sync:*',
    'user:*:cases:page:*',
    'case:*',
    // NM-8: separate pattern for `cases:*` keys (recent-pending /
    // recent-in-progress cache-warming). `case:*` doesn't match
    // `cases:*` under Redis SCAN.
    'cases:*',
    'dashboard:*',
    'users:*', // Invalidate user lists to update assignment counts
    'field-monitoring:*',
  ],

  // 2026-05-25: client mutation can alter client_product_documents +
  // client_product_verifications junctions (PUT /clients/:id rewrites
  // productMappings), which drives clientCount on /document-types and
  // hasRates / clientCount on /verification-types. Stats endpoints use
  // the `analytics:` cache prefix so flush those too. kyc_rates_view
  // JOINs clients for client_name so rename propagates there.
  clientUpdate: [
    'clients:*',
    'api_cache:*:*clients*',
    'analytics:*clients*',
    'document-types:*',
    'api_cache:*:*document-types*',
    'analytics:*document-types*',
    'verification-types:*',
    'api_cache:*:*verification-types*',
    'analytics:*verification-types*',
    'kyc-rates:*',
    'api_cache:*:*kyc-rates*',
    'analytics:*kyc-rates*',
    // 2026-05-25: caseList + verification-tasks list JOIN clients for
    // client_name. Rename a client → cached lists show old name.
    // caseList cache key shape is `user:<id>:cases:page:<n>:<md5>`.
    'cases:*',
    'case:*',
    'api_cache:*:*cases*',
    'user:*:cases:*',
    'verification-tasks:*',
    'api_cache:*:*verification-tasks*',
  ],

  // 2026-05-25: verification-type mutation propagates to caseList /
  // verification-task list (both show vt name via JOIN) + products list
  // (productCount via junction). Stats endpoints under `analytics:`.
  // caseList cache key shape `user:<id>:cases:page:*` covered too.
  verificationTypeUpdate: [
    'verification-types:*',
    'api_cache:*:*verification-types*',
    'analytics:*verification-types*',
    'cases:*',
    'case:*',
    'api_cache:*:*cases*',
    'user:*:cases:*',
    'verification-tasks:*',
    'api_cache:*:*verification-tasks*',
  ],

  // 2026-05-25: product mutation alters client_product_documents /
  // client_product_verifications counts on /document-types +
  // /verification-types lists. Stats endpoints under `analytics:`.
  // kyc_rates_view JOINs products for product_name.
  productUpdate: [
    'products:*',
    'api_cache:*:*products*',
    'analytics:*products*',
    'document-types:*',
    'api_cache:*:*document-types*',
    'analytics:*document-types*',
    'verification-types:*',
    'api_cache:*:*verification-types*',
    'analytics:*verification-types*',
    'kyc-rates:*',
    'api_cache:*:*kyc-rates*',
    'analytics:*kyc-rates*',
    // 2026-05-25: caseList + verification-tasks JOIN products for name.
    'cases:*',
    'case:*',
    'api_cache:*:*cases*',
    'verification-tasks:*',
    'api_cache:*:*verification-tasks*',
  ],

  // 2026-05-25: rate_type mutation propagates to case/task lists
  // (rate_type_id JOIN shows the type name) + rates page (uses rate_types
  // master). caseList cache key shape `user:<id>:cases:page:*` covered.
  rateTypeUpdate: [
    'rate-types:*',
    'api_cache:*:*rate-types*',
    'analytics:*rate-types*',
    'rates:*',
    'api_cache:*:*rates*',
    'cases:*',
    'case:*',
    'user:*:cases:*',
    'verification-tasks:*',
    'api_cache:*:*verification-tasks*',
  ],

  // 2026-05-25: rate mutation drives `hasRates` + `withRatesCount`
  // subqueries on /products and /verification-types list responses.
  rateUpdate: [
    'rates:*',
    'api_cache:*:*rates*',
    'rate-management-stats:*',
    'products:*',
    'api_cache:*:*products*',
    'analytics:*products*',
    'verification-types:*',
    'api_cache:*:*verification-types*',
    'analytics:*verification-types*',
  ],

  rateTypeAssignmentUpdate: [
    'rate-type-assignments:*',
    'api_cache:*:*rate-type-assignments*',
    'rate-management-stats:*',
  ],

  // 2026-05-25: document-type mutation propagates to clients list (via
  // junction usage counts) + kyc_rates (FK references doctype) + KYC
  // verification tasks (kyc_document_verifications joins doctype name).
  // Stats endpoints under `analytics:`.
  documentTypeUpdate: [
    'document-types:*',
    'api_cache:*:*document-types*',
    'analytics:*document-types*',
    'clients:*',
    'api_cache:*:*clients*',
    'analytics:*clients*',
    'kyc-rates:*',
    'api_cache:*:*kyc-rates*',
    'analytics:*kyc-rates*',
    'cases:*',
    'case:*',
    'user:*:cases:*',
    'verification-tasks:*',
    'api_cache:*:*verification-tasks*',
  ],

  // 2026-05-25: department mutation also affects the users-list cache
  // (JOIN departments populates `departmentName`) + users/stats
  // (usersByDepartment aggregate). Symmetric to the
  // userUpdate → departments/designations invalidation. Stats endpoints
  // use the `analytics:` cache prefix.
  departmentUpdate: [
    'departments:*',
    'api_cache:*:*departments*',
    'analytics:*departments*',
    'users:*',
    'users:stats:*',
    'api_cache:*:*users*',
    'analytics:*users*',
  ],

  designationUpdate: [
    'designations:*',
    'api_cache:*:*designations*',
    'analytics:*designations*',
    'users:*',
    'users:stats:*',
    'api_cache:*:*users*',
    'analytics:*users*',
  ],

  // 2026-05-25: kyc-rates analytics-stats key also needs flushing.
  kycRateUpdate: [
    'kyc-rates:*',
    'api_cache:*:*kyc-rates*',
    'analytics:*kyc-rates*',
    'rate-management-stats:*',
  ],

  // 2026-05-25: NEW — service_zone_rules mutations previously fired no
  // invalidation. SZR list/stats JOINs rate_types + verification_types
  // (rate/vt rename should reflect on the SZR page).
  serviceZoneRuleUpdate: [
    'service-zone-rules:*',
    'api_cache:*:*service-zone-rules*',
    'analytics:*service-zone-rules*',
    'rate-management-stats:*',
  ],

  // 2026-05-25: NEW — invoice mutations previously fired no invalidation.
  // /invoices list JOINs clients + products. Defense-in-depth pattern.
  invoiceUpdate: [
    'invoices:*',
    'api_cache:*:*invoices*',
    'analytics:*invoices*',
  ],

  // 2026-05-25: NEW — commission mutations previously fired no
  // invalidation. /commissions list JOINs clients + users + rate_types.
  commissionUpdate: [
    'commissions:*',
    'api_cache:*:*commissions*',
    'analytics:*commissions*',
    'commission-management:*',
    'api_cache:*:*commission-management*',
  ],

  clientDocumentTypeUpdate: [
    'client-document-types:*',
    'client-product-documents:*',
    'api_cache:*:*client-document-types*',
    'clients:*',
    // 2026-05-25: mapping changes affect clientCount + productCount on
    // /document-types list/stats (analytics cache prefix).
    'document-types:*',
    'api_cache:*:*document-types*',
    'analytics:*document-types*',
  ],

  fieldMonitoringUpdate: ['field-monitoring:*'],

  notificationUpdate: ['notifications:*', 'api_cache:*:*notifications*', 'users:stats:*'],
};
