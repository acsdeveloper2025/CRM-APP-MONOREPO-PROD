import { Pool, type PoolClient, type QueryResult } from 'pg';
import type { QueryParams } from '@/types/database';
import { logger } from './logger';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// Enterprise-scale database pool configuration for 2000+ concurrent users
const getPoolConfig = () => {
  const totalUsers = parseInt(process.env.TOTAL_CONCURRENT_USERS || '2000');

  // Enhanced scaling for high-concurrency systems
  // Rule: 1 connection per 6 concurrent users for optimal performance, min 50, max 500
  const maxConnections = Math.min(Math.max(Math.floor(totalUsers / 6), 50), 500);
  const minConnections = Math.max(Math.floor(maxConnections / 3), 30); // 33% of max, min 30

  return {
    connectionString,
    // High-performance enterprise connection pool settings
    max: maxConnections, // Maximum number of connections (up to 500)
    min: minConnections, // Minimum number of connections (33% of max)
    idleTimeoutMillis: 45000, // 45 seconds idle timeout (optimized for high load)
    connectionTimeoutMillis: 3000, // 3 seconds connection timeout (faster response)
    acquireTimeoutMillis: 8000, // 8 seconds acquire timeout
    // Enhanced performance settings for 2000+ users
    statement_timeout: 25000, // 25 seconds statement timeout (faster)
    query_timeout: 20000, // 20 seconds query timeout (optimized)
    application_name: 'CRM-Enterprise-Backend-2K+',
    // Additional high-concurrency optimizations
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000,
  };
};

export const pool = new Pool(getPoolConfig());

// Log pool configuration for monitoring
logger.info('Database pool configured for enterprise scale', {
  maxConnections: pool.options.max,
  minConnections: pool.options.min,
  totalConcurrentUsers: process.env.TOTAL_CONCURRENT_USERS || '2000',
  scalingRatio: '1 connection per 6 users',
  maxCapacity: '500 connections',
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const query = async <T = any>(
  text: string,
  params: QueryParams = []
): Promise<QueryResult<T>> => {
  return pool.query<T>(text, params);
};

export const withTransaction = async <T>(
  fn: (client: PoolClient) => Promise<T>,
  maxRetries = 3
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');

      // Retry on PostgreSQL deadlock (40P01) or serialization failure (40001)
      const pgCode = (err as { code?: string }).code;
      if ((pgCode === '40P01' || pgCode === '40001') && attempt < maxRetries) {
        logger.warn(`Transaction deadlock/serialization failure, retrying (attempt ${attempt}/${maxRetries})`, {
          code: pgCode,
        });
        // Exponential backoff: 100ms, 200ms, 400ms...
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
        continue;
      }

      throw err;
    } finally {
      client.release();
    }
  }

  // TypeScript: unreachable but satisfies return type
  throw new Error('Transaction retry exhausted');
};

export const connectDatabase = async (maxRetries = 5, delayMs = 3000): Promise<void> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.query('SELECT 1');
      logger.info('Database connected successfully');
      return;
    } catch (error) {
      logger.error(`Database connection attempt ${attempt}/${maxRetries} failed:`, error);
      if (attempt === maxRetries) {
        logger.error('All database connection attempts exhausted, exiting');
        process.exit(1);
      }
      logger.info(`Retrying in ${delayMs / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await pool.end();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Database disconnection failed:', error);
  }
};
