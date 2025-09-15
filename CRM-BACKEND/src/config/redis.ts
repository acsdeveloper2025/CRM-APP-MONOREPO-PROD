import { createClient } from 'redis';
import { logger } from './logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrl,
  password: process.env.REDIS_PASSWORD || undefined,
  socket: {
    // Enhanced reconnection strategy for high-load scenarios
    reconnectStrategy: (retries: number) => {
      if (retries > 20) { // Increased retry limit for enterprise
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

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('end', () => {
  logger.info('Redis client disconnected');
});

export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
    logger.info('Redis connected successfully');
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
