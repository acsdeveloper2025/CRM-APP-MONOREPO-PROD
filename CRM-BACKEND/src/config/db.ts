import { Pool, PoolClient, QueryResult } from 'pg';
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

export const query = async <T = any>(text: string, params: any[] = []): Promise<QueryResult<T>> => {
  return pool.query<T>(text, params);
};

export const withTransaction = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const connectDatabase = async (): Promise<void> => {
  try {
    await pool.query('SELECT 1');
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed:', error as any);
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await pool.end();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Database disconnection failed:', error as any);
  }
};

