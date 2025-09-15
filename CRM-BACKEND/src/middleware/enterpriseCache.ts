import { Request, Response, NextFunction } from 'express';
import { EnterpriseCacheService, CacheKeys } from '../services/enterpriseCacheService';
import { logger } from '../config/logger';
import crypto from 'crypto';

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
          data: any;
          headers: Record<string, string>;
          statusCode: number;
          timestamp: number;
        }>(cacheKey);

        if (cached) {
          // Serve from cache
          logger.debug('Cache hit', { key: cacheKey, age: Date.now() - cached.timestamp });
          
          // Set cached headers
          Object.entries(cached.headers).forEach(([key, value]) => {
            res.set(key, value);
          });
          
          // Add cache headers
          res.set({
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey,
            'X-Cache-Age': Math.floor((Date.now() - cached.timestamp) / 1000).toString(),
          });

          return res.status(cached.statusCode).json(cached.data);
        }

        // Cache miss - intercept response
        const originalSend = res.json;
        const originalStatus = res.status;
        let statusCode = 200;
        let responseData: any;

        // Override status method
        res.status = function(code: number) {
          statusCode = code;
          return originalStatus.call(this, code);
        };

        // Override json method to cache response
        res.json = function(data: any) {
          responseData = data;

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

            EnterpriseCacheService.set(cacheKey, cacheData, config.ttl)
              .catch(error => logger.error('Cache set error:', error));

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
    const userId = (req as any).user?.id || 'anonymous';
    const method = req.method;
    const path = req.path;
    const query = JSON.stringify(req.query);
    
    let keyParts = [method, path, query];
    
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
   */
  static invalidate(patterns: string[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Store original end method
      const originalEnd = res.end;
      
      res.end = function(chunk?: any, encoding?: any) {
        // Call original end method
        const result = originalEnd.call(this, chunk, encoding);
        
        // Invalidate cache patterns after response is sent
        if (res.statusCode >= 200 && res.statusCode < 300) {
          setImmediate(async () => {
            try {
              for (const pattern of patterns) {
                const resolvedPattern = EnterpriseCache.resolvePattern(pattern, req);
                await EnterpriseCacheService.clearByPattern(resolvedPattern);
                logger.debug('Cache invalidated', { pattern: resolvedPattern });
              }
            } catch (error) {
              logger.error('Cache invalidation error:', error);
            }
          });
        }
        
        return result;
      };
      
      next();
    };
  }

  /**
   * Resolve cache invalidation patterns with request data
   */
  private static resolvePattern(pattern: string, req: Request): string {
    return pattern
      .replace('{userId}', (req as any).user?.id || '*')
      .replace('{caseId}', req.params.id || req.params.caseId || '*')
      .replace('{method}', req.method);
  }

  /**
   * Conditional caching based on request/response characteristics
   */
  static conditional(configs: Array<{ condition: (req: Request) => boolean; config: CacheConfig }>) {
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
  static async warmCache(warmingTasks: Array<{
    key: string;
    fetcher: () => Promise<any>;
    ttl: number;
  }>): Promise<void> {
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
      const keyspaceHits = stats.keyspace?.keyspace_hits || 0;
      const keyspaceMisses = stats.keyspace?.keyspace_misses || 0;
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

// Enterprise cache configurations
export const EnterpriseCacheConfigs = {
  // User data caching
  userData: {
    ttl: 300, // 5 minutes
    keyGenerator: (req: Request) => CacheKeys.user((req as any).user?.id),
    condition: (req: Request) => req.method === 'GET',
  },

  // Case list caching
  caseList: {
    ttl: 60, // 1 minute
    keyGenerator: (req: Request) => {
      const userId = (req as any).user?.id;
      const page = req.query.page || 1;
      const filters = JSON.stringify(req.query);
      return `${CacheKeys.userCases(userId, Number(page))}:${crypto.createHash('md5').update(filters).digest('hex')}`;
    },
    varyBy: ['X-User-Role'],
  },

  // Case details caching
  caseDetails: {
    ttl: 300, // 5 minutes
    keyGenerator: (req: Request) => CacheKeys.case(req.params.id),
    condition: (req: Request) => req.method === 'GET',
  },

  // Analytics caching
  analytics: {
    ttl: 900, // 15 minutes
    keyGenerator: (req: Request) => {
      const path = req.path.replace('/api/', '');
      const query = JSON.stringify(req.query);
      return `analytics:${path}:${crypto.createHash('md5').update(query).digest('hex')}`;
    },
  },

  // Field agent workload caching
  workload: {
    ttl: 180, // 3 minutes
    keyGenerator: () => CacheKeys.fieldAgentWorkload(),
  },

  // Mobile sync data caching
  mobileSync: {
    ttl: 30, // 30 seconds
    keyGenerator: (req: Request) => CacheKeys.mobileSync((req as any).user?.id),
    condition: (req: Request) => req.method === 'GET',
  },
};

// Cache invalidation patterns
export const CacheInvalidationPatterns = {
  caseUpdate: [
    'api_cache:*:*cases*',
    'analytics:*',
    CacheKeys.fieldAgentWorkload(),
  ],
  
  userUpdate: [
    'api_cache:{userId}:*',
    CacheKeys.user('{userId}'),
  ],
  
  assignmentUpdate: [
    'api_cache:*:*cases*',
    'analytics:*',
    CacheKeys.fieldAgentWorkload(),
    CacheKeys.mobileSync('{userId}'),
  ],
};
