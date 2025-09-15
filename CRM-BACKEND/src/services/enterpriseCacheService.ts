import { createClient, RedisClientType, RedisClusterType, createCluster } from 'redis';
import { config } from '../config';
import { logger } from '../config/logger';

// Enterprise Redis configuration for high-performance caching
const redisUrl = new URL(config.redisUrl);

export class EnterpriseCacheService {
  private static redis: RedisClientType;
  private static clusterRedis: RedisClusterType | null = null;

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
          `${redisUrl.hostname}:${redisUrl.port}`
        ];

        this.clusterRedis = createCluster({
          rootNodes: clusterNodes.map(node => {
            const [host, port] = node.split(':');
            return {
              url: `redis://${config.redisPassword ? `:${config.redisPassword}@` : ''}${host}:${parseInt(port) || 6379}`
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
        this.redis = this.clusterRedis as any;
        logger.info('Redis Cluster initialized for enterprise scale');
      } else {
        // Single Redis instance with enterprise optimizations
        this.redis = createClient({
          url: config.redisUrl,
          password: config.redisPassword,
          socket: {
            connectTimeout: 10000,
            family: 4,
            keepAlive: true,
          },
        });

        await this.redis.connect();
        logger.info('Redis single instance initialized for enterprise scale');
      }

      // Test connection
      await this.redis.ping();
      logger.info('Enterprise cache service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize enterprise cache service:', error);
      throw error;
    }
  }

  /**
   * Get cached data with enterprise-level error handling
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (!data || typeof data !== 'string') return null;

      return JSON.parse(data) as T;
    } catch (error) {
      logger.error('Cache get error:', { key, error });
      return null; // Graceful degradation
    }
  }

  /**
   * Set cached data with TTL and enterprise optimizations
   */
  static async set(key: string, value: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setEx(key, ttlSeconds, serialized);
      return true;
    } catch (error) {
      logger.error('Cache set error:', { key, error });
      return false; // Graceful degradation
    }
  }

  /**
   * Delete cached data
   */
  static async delete(key: string): Promise<boolean> {
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
    try {
      if (keys.length === 0) return [];

      const values = await this.redis.mGet(keys);
      return values.map(value => {
        if (!value || typeof value !== 'string') return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      logger.error('Cache mget error:', { keys, error });
      return keys.map(() => null); // Graceful degradation
    }
  }

  /**
   * Batch set multiple key-value pairs
   */
  static async mset(keyValuePairs: Array<{ key: string; value: any; ttl?: number }>): Promise<boolean> {
    try {
      const multi = this.redis.multi();

      keyValuePairs.forEach(({ key, value, ttl = 3600 }) => {
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
   * Increment counter with expiration (for rate limiting)
   */
  static async increment(key: string, ttlSeconds: number = 3600): Promise<number> {
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
  static async getKeysByPattern(pattern: string, limit: number = 1000): Promise<string[]> {
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
  private static async scanKeys(redis: RedisClientType, pattern: string, limit: number): Promise<string[]> {
    const keys: string[] = [];

    for await (const key of redis.scanIterator({
      MATCH: pattern,
      COUNT: 100
    })) {
      if (typeof key === 'string') {
        keys.push(key);
      } else if (Array.isArray(key)) {
        keys.push(...key);
      }
      if (keys.length >= limit) break;
    }

    return keys.slice(0, limit);
  }

  /**
   * Clear cache by pattern (use with caution)
   */
  static async clearByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.getKeysByPattern(pattern, 10000);
      if (keys.length === 0) return 0;
      
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
  static async getStats(): Promise<any> {
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      return {
        memory: this.parseRedisInfo(info),
        keyspace: this.parseRedisInfo(keyspace),
        connected: this.redis.isReady,
        cluster: !!this.clusterRedis,
      };
    } catch (error) {
      logger.error('Cache getStats error:', error);
      return { error: 'Failed to get cache stats' };
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private static parseRedisInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    
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
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      return { healthy: true, latency };
    } catch (error) {
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Close Redis connections
   */
  static async close(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.disconnect();
        logger.info('Enterprise cache service closed');
      }
      if (this.clusterRedis) {
        await this.clusterRedis.disconnect();
        logger.info('Enterprise cache cluster service closed');
      }
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

  static userCases(userId: string, page: number = 1): string {
    return `user:${userId}:cases:page:${page}`;
  }

  static case(caseId: string): string {
    return `case:${caseId}`;
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

  static notifications(userId: string): string {
    return `notifications:${userId}`;
  }
}
