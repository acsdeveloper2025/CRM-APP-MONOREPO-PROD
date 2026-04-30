import { createCluster, type RedisClientType, type RedisClusterType } from 'redis';
import { config } from '../config';
import { logger } from '../config/logger';
import { redisClient } from '../config/redis';

// 2026-04-28 Medium Fix 8: single-instance mode now reuses the singleton
// `redisClient` from config/redis.ts. Cluster mode (REDIS_CLUSTER_ENABLED)
// continues to build its own client because RedisClusterType is a
// structurally different shape (rootNodes, defaults). The boot order
// guarantees connectRedis() runs before EnterpriseCacheService.initialize()
// in src/index.ts.

// Enterprise Redis configuration for high-performance caching
const redisUrl = new URL(config.redisUrl);

export interface CacheStats {
  memory?: Record<string, unknown>;
  keyspace?: Record<string, unknown>;
  cpuUsage?: number;
  resourceUsage?: Record<string, number>;
  cluster?: boolean;
  connected?: boolean;
  error?: string;
}

export class EnterpriseCacheService {
  private static redis: RedisClientType;
  private static clusterRedis: RedisClusterType | null = null;
  private static available = false;

  /**
   * Initialize enterprise Redis cache with clustering support
   */
  static async initialize(): Promise<void> {
    try {
      // Check if Redis clustering is enabled
      const useCluster = process.env.REDIS_CLUSTER_ENABLED === 'true';

      if (useCluster) {
        // Redis Cluster configuration for enterprise scale
        const clusterNodes = process.env.REDIS_CLUSTER_NODES?.split(',') || [
          `${redisUrl.hostname}:${redisUrl.port}`,
        ];

        this.clusterRedis = createCluster({
          rootNodes: clusterNodes.map(node => {
            const [host, port] = node.split(':');
            return {
              url: `redis://${config.redisPassword ? `:${config.redisPassword}@` : ''}${host}:${parseInt(port) || 6379}`,
            };
          }),
          defaults: {
            password: config.redisPassword,
            socket: {
              connectTimeout: 10000,
              family: 4,
              keepAlive: true,
            },
          },
        });

        await this.clusterRedis.connect();
        this.redis = this.clusterRedis as unknown as RedisClientType;
        logger.info('Redis Cluster initialized for enterprise scale');
      } else {
        // 2026-04-28 Medium Fix 8: reuse the singleton redis client
        // from config/redis.ts instead of creating a duplicate. The
        // singleton is already connected by the time this runs (boot
        // order in src/index.ts: connectRedis() before
        // EnterpriseCacheService.initialize()), and uses the same
        // connect timeout / IPv4 family / keep-alive settings.
        this.redis = redisClient as unknown as RedisClientType;
        logger.info('Redis single instance initialized for enterprise scale (reusing singleton)');
      }

      // Test connection. For the cluster path this is the first ping
      // on the cluster client; for the singleton path it's a re-ping
      // confirming the shared client is still live.
      await this.redis.ping();
      this.available = true;
      logger.info('Enterprise cache service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize enterprise cache service:', error);
      this.available = false;
    }
  }

  static isAvailable(): boolean {
    return this.available;
  }

  /**
   * Get cached data with enterprise-level error handling
   */
  static async get<T>(key: string): Promise<T | null> {
    if (!this.available || !this.redis) {
      return null;
    }

    try {
      const data = await this.redis.get(key);
      if (!data || typeof data !== 'string') {
        return null;
      }

      const parsed = JSON.parse(data) as T;
      return parsed;
    } catch (error) {
      logger.error('Cache get error:', { key, error });
      return null; // Graceful degradation
    }
  }

  /**
   * Set cached data with TTL and enterprise optimizations
   */
  static async set(key: string, value: unknown, ttlSeconds = 300): Promise<boolean> {
    if (!this.available || !this.redis) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.redis.setEx(key, ttlSeconds, serialized);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Cache set error:', { key, errorMessage, error });
      return false; // Graceful degradation
    }
  }

  /**
   * Delete cached data
   */
  static async delete(key: string): Promise<boolean> {
    if (!this.available || !this.redis) {
      return false;
    }

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', { key, error });
      return false;
    }
  }

  /**
   * Batch get multiple keys for performance
   */
  static async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.available || !this.redis) {
      return keys.map((): T | null => null);
    }

    try {
      if (keys.length === 0) {
        return [];
      }

      const values = await this.redis.mGet(keys);
      return values.map(value => {
        if (!value || typeof value !== 'string') {
          return null;
        }
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      logger.error('Cache mget error:', { keys, error });
      return keys.map((): T | null => null); // Graceful degradation
    }
  }

  /**
   * Batch set multiple key-value pairs
   */
  static async mset(
    keyValuePairs: Array<{ key: string; value: unknown; ttl?: number }>
  ): Promise<boolean> {
    if (!this.available || !this.redis) {
      return false;
    }

    try {
      const multi = this.redis.multi();

      keyValuePairs.forEach(({ key, value, ttl = 300 }) => {
        const serialized = JSON.stringify(value);
        multi.setEx(key, ttl, serialized);
      });

      await multi.exec();
      return true;
    } catch (error) {
      logger.error('Cache mset error:', { keyValuePairs, error });
      return false;
    }
  }

  /**
   * F-B9.4: cache-stampede protection via single-flight lock.
   *
   * When a hot key expires, naive `get-or-compute` lets every
   * concurrent request hit the upstream simultaneously. This wrapper
   * acquires a Redis NX-EX lock so exactly ONE request runs `compute`;
   * the rest poll the cache briefly and serve the freshly populated
   * value.
   *
   * Fallback semantics:
   *  - If Redis is unavailable, the lock acquisition is skipped and
   *    every caller computes (degrades to today's behavior — no worse
   *    than not having the cache at all).
   *  - The lock auto-expires after 5s, so a crashed compute() doesn't
   *    deadlock peers.
   *  - Pollers wait up to ~5s (50 × 100ms) before giving up and
   *    computing themselves; the 5s ceiling matches the lock TTL.
   */
  static async getOrCompute<T>(
    key: string,
    ttlSeconds: number,
    compute: () => Promise<T>
  ): Promise<T> {
    const lockKey = `lock:${key}`;
    const MAX_POLL_ATTEMPTS = 50;
    const POLL_INTERVAL_MS = 100;

    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    if (!this.available || !this.redis) {
      // Redis unavailable — no lock, no cache. Just compute.
      return compute();
    }

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      try {
        const lockAcquired = await this.redis.set(lockKey, '1', {
          NX: true,
          EX: 5,
        });
        if (lockAcquired) {
          try {
            const value = await compute();
            await this.set(key, value, ttlSeconds);
            return value;
          } finally {
            await this.redis.del(lockKey).catch(() => {
              // Lock will TTL-out; cleanup failure is non-fatal.
            });
          }
        }
      } catch (error) {
        logger.warn('Cache stampede lock attempt failed; computing without lock', {
          key,
          error,
        });
        return compute();
      }

      // Lock held by another request — poll the cache, then retry the
      // lock acquisition if still missing.
      await new Promise<void>(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      const refreshed = await this.get<T>(key);
      if (refreshed !== null) {
        return refreshed;
      }
    }

    // Poll budget exhausted — compute ourselves rather than spinning.
    logger.warn('Cache stampede poll budget exhausted; computing without lock', { key });
    return compute();
  }

  /**
   * Increment counter with expiration (for rate limiting)
   */
  static async increment(key: string, ttlSeconds = 300): Promise<number> {
    if (!this.available || !this.redis) {
      return 0;
    }

    try {
      const multi = this.redis.multi();
      multi.incr(key);
      multi.expire(key, ttlSeconds);

      const results = await multi.exec();
      return (results?.[0] as unknown as number) || 0;
    } catch (error) {
      logger.error('Cache increment error:', { key, error });
      return 0;
    }
  }

  /**
   * Get keys matching pattern (use carefully in production)
   */
  static async getKeysByPattern(pattern: string, limit = 1000): Promise<string[]> {
    if (!this.available || !this.redis) {
      return [];
    }

    try {
      return await this.scanKeys(this.redis, pattern, limit);
    } catch (error) {
      logger.error('Cache getKeysByPattern error:', { pattern, error });
      return [];
    }
  }

  /**
   * Scan keys using SCAN command (memory efficient)
   */
  private static async scanKeys(
    redis: RedisClientType,
    pattern: string,
    limit: number
  ): Promise<string[]> {
    const keys: string[] = [];

    for await (const key of redis.scanIterator({
      MATCH: pattern,
      COUNT: 100,
    })) {
      if (typeof key === 'string') {
        keys.push(key);
      } else if (Array.isArray(key)) {
        keys.push(...key);
      }
      if (keys.length >= limit) {
        break;
      }
    }

    return keys.slice(0, limit);
  }

  /**
   * Clear cache by pattern (use with caution)
   */
  static async clearByPattern(pattern: string): Promise<number> {
    if (!this.available || !this.redis) {
      return 0;
    }

    try {
      const keys = await this.getKeysByPattern(pattern, 10000);
      if (keys.length === 0) {
        return 0;
      }

      // Delete in batches to avoid blocking
      const batchSize = 100;
      let deletedCount = 0;

      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        await this.redis.del(batch);
        deletedCount += batch.length;
      }

      logger.info('Cache cleared by pattern:', { pattern, deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Cache clearByPattern error:', { pattern, error });
      return 0;
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  static async getStats(): Promise<CacheStats> {
    if (!this.available || !this.redis) {
      return {
        connected: false,
      };
    }

    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');

      return {
        memory: this.parseRedisInfo(info),
        keyspace: this.parseRedisInfo(keyspace),
        cpuUsage: (process.cpuUsage() as unknown as Record<string, number>).user / 1000000,
        resourceUsage: process.resourceUsage() as unknown as Record<string, number>,
        cluster: !!this.clusterRedis,
        connected: this.available,
      };
    } catch (error) {
      logger.error('Cache getStats error:', error);
      return { error: 'Failed to get cache stats' };
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private static parseRedisInfo(info: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    info.split('\r\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = isNaN(Number(value)) ? value : Number(value);
      }
    });

    return result;
  }

  /**
   * Health check for cache service
   */
  static async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    if (!this.available || !this.redis) {
      return {
        healthy: false,
        error: 'Cache unavailable',
      };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      return { healthy: true, latency };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Close Redis connections.
   *
   * 2026-04-28 Medium Fix 8: in single-instance mode, `this.redis` is
   * the shared singleton from config/redis.ts whose lifecycle is owned
   * by `disconnectRedis()` in src/index.ts graceful shutdown — we MUST
   * NOT disconnect it here or the rate limiter / health probes / mobile
   * telemetry would lose their client. Cluster mode still owns its
   * dedicated client and gets disconnected here.
   */
  static async close(): Promise<void> {
    try {
      if (this.clusterRedis) {
        await this.clusterRedis.disconnect();
        logger.info('Enterprise cache cluster service closed');
      } else {
        logger.info('Enterprise cache service closed (singleton client owned by disconnectRedis)');
      }
      this.available = false;
    } catch (error) {
      logger.error('Error closing cache service:', error);
    }
  }
}

// Cache key generators for consistent naming
export class CacheKeys {
  static user(userId: string): string {
    return `user:${userId}`;
  }

  static userStats(userId: string): string {
    return `users:stats:${userId}`;
  }

  static userCases(userId: string, page = 1): string {
    return `user:${userId}:cases:page:${page}`;
  }

  static case(caseId: string): string {
    return `case:${caseId}`;
  }

  static scopedCase(userId: string, caseId: string): string {
    return `case:${userId}:${caseId}`;
  }

  static caseAttachments(caseId: string): string {
    return `case:${caseId}:attachments`;
  }

  static fieldAgentWorkload(): string {
    return 'analytics:field-agent-workload';
  }

  static caseStats(): string {
    return 'analytics:case-stats';
  }

  static userSession(sessionId: string): string {
    return `session:${sessionId}`;
  }

  static rateLimit(identifier: string, action: string): string {
    return `rate_limit:${action}:${identifier}`;
  }

  static mobileSync(userId: string): string {
    return `mobile:sync:${userId}`;
  }

  static scopedMobileSync(userId: string, queryHash: string): string {
    return `mobile:sync:${userId}:${queryHash}`;
  }

  static fieldMonitoringStats(userId: string, scopeHash: string): string {
    return `field-monitoring:stats:${userId}:${scopeHash}`;
  }

  static fieldMonitoringRoster(
    userId: string,
    page: number,
    scopeHash: string,
    queryHash: string
  ): string {
    return `field-monitoring:users:${userId}:page:${page}:${scopeHash}:${queryHash}`;
  }

  static fieldMonitoringUserDetail(
    viewerUserId: string,
    targetUserId: string,
    scopeHash: string
  ): string {
    return `field-monitoring:user:${viewerUserId}:${targetUserId}:${scopeHash}`;
  }

  static notifications(userId: string): string {
    return `notifications:${userId}`;
  }

  // ── Invalidation pattern helpers ──────────────────────────
  // Returns glob patterns for clearByPattern() to wipe stale data on writes

  /** Invalidate all cache entries related to a specific case */
  static invalidateCase(caseId: string): string[] {
    return [`case:${caseId}*`, 'analytics:case-stats'];
  }

  /** Invalidate all cache entries related to a specific user */
  static invalidateUser(userId: string): string[] {
    return [`user:${userId}*`, `users:stats:${userId}`];
  }

  /** Invalidate field monitoring caches (after location update or assignment change) */
  static invalidateFieldMonitoring(): string[] {
    return ['field-monitoring:*', 'analytics:field-agent-workload'];
  }

  /** Invalidate notification caches for a user */
  static invalidateNotifications(userId: string): string[] {
    return [`notifications:${userId}*`];
  }
}

/**
 * Convenience: invalidate multiple cache patterns in one call.
 * Fire-and-forget safe — logs errors but never throws.
 */
export async function invalidateCachePatterns(patterns: string[]): Promise<void> {
  for (const pattern of patterns) {
    try {
      await EnterpriseCacheService.clearByPattern(pattern);
    } catch (error) {
      logger.warn('Cache invalidation failed for pattern', { pattern, error });
    }
  }
}
