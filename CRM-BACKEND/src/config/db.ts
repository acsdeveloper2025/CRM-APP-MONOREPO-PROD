import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import type { QueryParams } from '@/types/database';
import { camelizeRow } from '@/utils/rowTransform';
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

// ============================================================================
// camelCase row auto-conversion (the single conversion point for the backend)
// ----------------------------------------------------------------------------
// The `query()` export and the client handed to every `withTransaction()`
// callback both route through `transformResult()`, which mutates each row
// in place to add camelCase aliases alongside the existing snake_case keys.
//
// The transform is ADDITIVE (see rowTransform.ts): every snake_case column
// also gets a camelCase alias on the same row object. Legacy code reading
// `row.snake_case_field` keeps working, and new code reads `row.camelCaseField`.
// Once all legacy reads are migrated, the transform can be tightened to pure
// replacement. This is the same strategy the mobile app uses in its SQLite
// DatabaseService.normalizeRow.
//
// The transform is SHALLOW — it only touches the top-level keys of the row.
// JSONB column values are never inspected, so user-supplied payloads like
// `id_details: { user_id: 5 }` keep their original keys intact.
// ============================================================================

const transformResult = <T extends QueryResultRow>(result: QueryResult<T>): QueryResult<T> => {
  if (result && Array.isArray(result.rows)) {
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i];
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        camelizeRow(row as Record<string, unknown>);
      }
    }
  }
  return result;
};

/**
 * Wrap a PoolClient's `query` method so every result is camelized before it
 * reaches the caller. Used inside `withTransaction()` so that
 * `await client.query(...)` inside a callback returns rows with camelCase keys.
 * Mutates the client in place and returns it for chaining.
 *
 * Exported so that legacy call sites doing manual `pool.connect()` + BEGIN/COMMIT
 * can keep the wrapping contract until they are migrated to `withTransaction()`.
 * New code should use `withTransaction()` instead of manual transactions.
 */
export const wrapClient = (client: PoolClient): PoolClient => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalQuery: any = client.query.bind(client);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).query = async function wrappedClientQuery(
    ...args: unknown[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const result = await originalQuery(...args);
    return transformResult(result);
  };
  return client;
};

const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_MS || '500', 10);

// F-B4.1: pre-flight AbortSignal check. pg 8 doesn't expose an
// in-flight cancel hook on `pool.query()` (would need PG-level
// pg_cancel_backend by PID), but bailing BEFORE issuing the query
// when the request is already aborted still saves DB work for the
// (common) case where multiple sequential queries happen after the
// timeout fired. Handlers opt-in by passing `req.abortSignal`.
class AbortError extends Error {
  code = 'ABORT_ERR';
  constructor() {
    super('Operation aborted');
    this.name = 'AbortError';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const query = async <T extends QueryResultRow = any>(
  text: string,
  params: QueryParams = [],
  options?: { signal?: AbortSignal }
): Promise<QueryResult<T>> => {
  if (options?.signal?.aborted) {
    throw new AbortError();
  }
  const startedAt = Date.now();
  const result = await pool.query<T>(text, params);
  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs > SLOW_QUERY_MS) {
    logger.warn('Slow query detected', {
      elapsedMs,
      thresholdMs: SLOW_QUERY_MS,
      sql: text.length > 500 ? `${text.slice(0, 500)}...` : text,
      rowCount: result.rowCount,
    });
  }
  return transformResult(result);
};

/**
 * Maximum exponential backoff delay (ms) between retry attempts. Capping
 * the sleep prevents a long queue of retries from holding a connection
 * open for several seconds each while the database catches up.
 */
const MAX_TRANSACTION_RETRY_DELAY_MS = parseInt(
  process.env.TRANSACTION_RETRY_MAX_DELAY_MS || '400',
  10
);

/**
 * Number of retry attempts for deadlock/serialization failures. Bumped
 * from 3 → 6 for high-concurrency workloads: under 2000+ concurrent
 * users the old ceiling surfaced too many deadlocks as 5xx responses
 * even though a second or third attempt would have succeeded.
 */
const DEFAULT_TRANSACTION_MAX_RETRIES = parseInt(
  process.env.TRANSACTION_MAX_RETRIES || '6',
  10
);

export const withTransaction = async <T>(
  fn: (client: PoolClient) => Promise<T>,
  maxRetries = DEFAULT_TRANSACTION_MAX_RETRIES
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const client = wrapClient(await pool.connect());
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
        logger.warn(
          `Transaction deadlock/serialization failure, retrying (attempt ${attempt}/${maxRetries})`,
          {
            code: pgCode,
          }
        );
        // Exponential backoff capped at MAX_TRANSACTION_RETRY_DELAY_MS:
        // 100ms, 200ms, 400ms, 400ms, 400ms — total worst-case wait is
        // ~1.5s across 6 attempts, which is well below the request
        // timeout but enough to let transient contention clear.
        const backoffMs = Math.min(100 * Math.pow(2, attempt - 1), MAX_TRANSACTION_RETRY_DELAY_MS);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
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
