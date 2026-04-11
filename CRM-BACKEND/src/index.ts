// Phase F1: OpenTelemetry bootstrap MUST be the first import so the
// SDK's auto-instrumentations can patch express / pg / ioredis
// before those modules are required by the rest of the app. The
// module has side effects at load time (starts the SDK if
// OTEL_ENABLED=true) AND exports shutdownTracing for the graceful
// shutdown path.
import { shutdownTracing } from './tracing';

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import app from './app';
import { config } from '@/config';
import { logger } from '@/config/logger';
import { connectDatabase, disconnectDatabase } from '@/config/database';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { initializeQueues, closeQueues } from '@/config/queue';
import { initializeWebSocket } from '@/websocket/server';
import { EnterpriseCacheService } from './services/enterpriseCacheService';
import { CacheWarmingService } from './services/cacheWarmingService';
import {
  startMetricsCleanup,
  startMetricsBatchFlush,
  stopMonitoringIntervals,
} from '@/middleware/performanceMonitoring';
import { startAuditLogProcessor, stopAuditLogProcessor } from '@/queues/auditLogQueue';
// Migrations removed for production - use database import instead

const server = createServer(app);

// Socket.IO Redis adapter clients — stored at module scope for cleanup on shutdown
let socketPubClient: ReturnType<typeof createClient> | null = null;
let socketSubClient: ReturnType<typeof createClient> | null = null;

// Cache refresh interval — stored for cleanup on shutdown
let cacheRefreshInterval: ReturnType<typeof setInterval> | null = null;

logger.info('🚀 [LOADED] src/index.ts IS RUNNING!');

// Initialize Socket.IO with security limits
const io = new SocketIOServer(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e6, // 1MB max payload — prevents memory spikes from large binary data
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Initialize WebSocket handlers
initializeWebSocket(io);

const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDatabase();

    // Run database migrations (temporarily disabled)
    // await runMigrations();

    // Connect to Redis/cache in fail-open mode
    try {
      await connectRedis();
    } catch (error) {
      logger.warn('Redis connection unavailable, continuing without Redis client', { error });
    }

    // Socket.IO Redis adapter for PM2 cluster mode broadcasting
    // Creates dedicated pub/sub clients so Socket.IO events propagate across all instances
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const redisPassword = process.env.REDIS_PASSWORD || undefined;
      socketPubClient = createClient({ url: redisUrl, password: redisPassword });
      socketSubClient = socketPubClient.duplicate();

      await Promise.all([socketPubClient.connect(), socketSubClient.connect()]);
      io.adapter(createAdapter(socketPubClient, socketSubClient));
      logger.info('Socket.IO Redis adapter attached (PM2 cluster broadcasting enabled)');
    } catch (error) {
      logger.warn(
        'Socket.IO Redis adapter unavailable, falling back to in-memory (single-instance only)',
        { error }
      );
    }

    await EnterpriseCacheService.initialize();

    if (EnterpriseCacheService.isAvailable()) {
      await CacheWarmingService.warmAllCaches();
    } else {
      logger.warn('Enterprise cache unavailable, skipping cache warming');
    }

    // Initialize job queues
    await initializeQueues();

    // Start the server with strict port enforcement - bind to all interfaces for mobile access
    server.listen(config.port, '0.0.0.0', () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Server accessible on all network interfaces (0.0.0.0:${config.port})`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`WebSocket server running on port ${config.port}`);

      // Start periodic cleanup of performance_metrics and system_health_metrics (every 6h, 7-day retention)
      startMetricsCleanup();

      // Phase C3: drain the performance_metrics in-memory buffer into
      // the DB on a 2-second cadence. Replaces the prior one-INSERT-
      // per-request hot path.
      startMetricsBatchFlush();

      // Phase D3: attach the bull worker that drains the audit log
      // queue onto the audit_logs table. Writers enqueue via
      // createAuditLog()/enqueueAuditLog(); this worker persists.
      startAuditLogProcessor();

      // Schedule periodic cache refresh (every 10 minutes)
      cacheRefreshInterval = setInterval(
        () => {
          if (!EnterpriseCacheService.isAvailable()) {
            return;
          }
          void (async () => {
            try {
              await CacheWarmingService.refreshCaches();
            } catch (error) {
              logger.error('Periodic cache refresh failed:', error);
            }
          })();
        },
        10 * 60 * 1000
      ); // 10 minutes
    });

    // Handle port already in use error
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(
          `Port ${config.port} is already in use. Please free the port or stop the conflicting service.`
        );
        process.exit(1);
      } else {
        logger.error('Server error:', error);
        process.exit(1);
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Hard timeout — force exit if graceful shutdown hangs
  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded (30s), force exiting');
    process.exit(1);
  }, 30000);

  try {
    // Stop all monitoring intervals before closing connections
    stopMonitoringIntervals();
    if (cacheRefreshInterval) {
      clearInterval(cacheRefreshInterval);
      cacheRefreshInterval = null;
    }

    // Notify WebSocket clients before closing
    io.emit('server:shutdown', { message: 'Server is restarting, please reconnect shortly' });

    // Close HTTP server (stop accepting new connections)
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Close WebSocket connections
    void io.close(() => {
      logger.info('WebSocket server closed');
    });

    // Close the audit log bull queue — drains in-flight jobs before
    // shutting the worker down (Phase D3).
    await stopAuditLogProcessor();

    // Close job queues (allow in-flight jobs to finish)
    await closeQueues();

    // Close enterprise cache service
    await EnterpriseCacheService.close();

    // Close Socket.IO Redis adapter pub/sub clients
    if (socketPubClient) {
      try {
        await socketPubClient.quit();
      } catch {
        /* already closed */
      }
    }
    if (socketSubClient) {
      try {
        await socketSubClient.quit();
      } catch {
        /* already closed */
      }
    }

    // Disconnect from Redis
    await disconnectRedis();

    // Disconnect from database
    await disconnectDatabase();

    // Phase F1: flush any buffered OTel spans before the process
    // exits so the last few seconds of traces reach the collector.
    await shutdownTracing();

    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimeout);
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception', {
    message: error.message,
    stack: error.stack,
    name: error.name,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  // Log the reason properly so we can actually debug. Winston's logger.error
  // only serializes the second argument, so pack everything into a single
  // metadata object.
  const err = reason as Error | undefined;
  const fallbackMessage =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : JSON.stringify(reason);
  logger.error('Unhandled Rejection', {
    message: err?.message ?? fallbackMessage,
    stack: err?.stack,
    name: err?.name,
    reason: err ? undefined : reason,
  });
  // Do NOT exit — an unhandled rejection in a background job (socket emit,
  // cache invalidation, notification queue, etc.) should not bring down the
  // whole HTTP server. Log it and keep serving.
});

// Start the server
// eslint-disable-next-line @typescript-eslint/no-floating-promises
startServer();
