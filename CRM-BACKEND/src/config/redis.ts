import { createClient } from 'redis';
import { logger } from './logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

/** Tracks whether Redis is currently healthy and available */
let redisHealthy = false;

export const redisClient = createClient({
  url: redisUrl,
  password: process.env.REDIS_PASSWORD || undefined,
  socket: {
    // Enhanced reconnection strategy for high-load scenarios
    reconnectStrategy: (retries: number) => {
      if (retries > 20) {
        // Increased retry limit for enterprise
        logger.error('Redis connection failed after 20 retries');
        return new Error('Redis connection failed');
      }
      return Math.min(retries * 100, 2000); // Faster reconnection
    },
    // High-performance socket settings for 2000+ users
    connectTimeout: 5000, // 5 seconds connection timeout
    keepAlive: true, // Enable keep-alive
  },
  // Enhanced performance settings for high concurrency
  commandsQueueMaxLength: 10000, // Increased queue size
  disableOfflineQueue: false, // Keep offline queue for reliability
});

redisClient.on('error', err => {
  redisHealthy = false;
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('ready', () => {
  redisHealthy = true;
  logger.info('Redis client ready');
});

redisClient.on('end', () => {
  redisHealthy = false;
  logger.info('Redis client disconnected');
});

/**
 * Check if Redis is currently healthy and available.
 * Use this to gracefully degrade (skip caching, use fallbacks) when Redis is down.
 */
export const isRedisHealthy = (): boolean => redisHealthy;

export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
    logger.info('Redis connected successfully');

    // Configure memory limits and eviction policy for enterprise workloads
    const maxMemory = process.env.REDIS_MAX_MEMORY || '256mb';
    try {
      await redisClient.configSet('maxmemory', maxMemory);
      // Use 'noeviction' policy — required by BullMQ job queues.
      // Cache eviction is handled application-side via TTLs.
      await redisClient.configSet('maxmemory-policy', 'noeviction');
      logger.info(`Redis maxmemory set to ${maxMemory} with noeviction policy`);
    } catch (configError) {
      // Non-fatal: managed Redis instances (ElastiCache, etc.) may block CONFIG SET
      logger.warn('Could not set Redis maxmemory policy (managed instance?)', {
        error: configError,
      });
    }
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

export const disconnectRedis = async (): Promise<void> => {
  try {
    await redisClient.quit();
    logger.info('Redis disconnected successfully');
  } catch (error) {
    logger.error('Redis disconnection failed:', error);
  }
};
