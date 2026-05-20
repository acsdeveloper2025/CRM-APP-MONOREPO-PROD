// Phase F1: OpenTelemetry bootstrap MUST be the first import so the
// SDK's auto-instrumentations can patch express / pg / ioredis
// before those modules are required by the rest of the app. The
// module has side effects at load time (starts the SDK if
// OTEL_ENABLED=true) AND exports shutdownTracing for the graceful
// shutdown path.
import { shutdownTracing } from './tracing';

import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import app from './app';
import { config } from '@/config';
import { logger } from '@/config/logger';
import { connectDatabase, disconnectDatabase } from '@/config/database';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { initAuthCachePubSub } from '@/middleware/auth';
import { initializeWebSocket } from '@/websocket/server';
import { EnterpriseCacheService } from './services/enterpriseCacheService';
import {
  startMetricsCleanup,
  startMetricsBatchFlush,
  stopMonitoringIntervals,
} from '@/middleware/performanceMonitoring';
import { startAuditLogProcessor, stopAuditLogProcessor } from '@/queues/auditLogQueue';
import { startNotificationProcessor, stopNotificationProcessor } from '@/queues/notificationQueue';
import {
  startReverseGeocodeProcessor,
  stopReverseGeocodeProcessor,
} from '@/queues/reverseGeocodeQueue';
import { startDbMaintenance, stopDbMaintenance } from '@/services/dbMaintenanceService';
import { startWorkerHeartbeat, stopWorkerHeartbeat } from '@/health/workerHeartbeat';
// Migrations removed for production - use database import instead

// PR2 (Docker migration): role gating. Default 'all' preserves today's
// PM2 fork behaviour byte-for-byte. ROLE=api skips BullMQ workers +
// interval jobs; ROLE=worker skips HTTP + Socket.IO.
const { role } = config;
const isApi = role === 'api' || role === 'all';
const isWorker = role === 'worker' || role === 'all';

const server = createServer(app);

// Socket.IO Redis adapter clients — stored at module scope for cleanup on shutdown
let socketPubClient: ReturnType<typeof createClient> | null = null;
let socketSubClient: ReturnType<typeof createClient> | null = null;

// Worker-only HTTP health probe (only when ROLE=worker; ROLE=all keeps using :3000/health).
let workerHealthServer: HttpServer | null = null;

logger.info(`🚀 [LOADED] src/index.ts IS RUNNING! role=${role}`);

// Initialize Socket.IO with security limits — only on instances that serve HTTP.
let io: SocketIOServer | null = null;
if (isApi) {
  io = new SocketIOServer(server, {
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
}

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

    // Socket.IO Redis adapter for multi-instance broadcasting — only on
    // api-role instances (worker has no Socket.IO server to attach to).
    if (isApi && io) {
      try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        const redisPassword = process.env.REDIS_PASSWORD || undefined;
        socketPubClient = createClient({ url: redisUrl, password: redisPassword });
        socketSubClient = socketPubClient.duplicate();

        await Promise.all([socketPubClient.connect(), socketSubClient.connect()]);
        io.adapter(createAdapter(socketPubClient, socketSubClient));
        logger.info('Socket.IO Redis adapter attached (multi-instance broadcasting enabled)');
      } catch (error) {
        logger.warn(
          'Socket.IO Redis adapter unavailable, falling back to in-memory (single-instance only)',
          { error }
        );
      }
    }

    // Cache layer initializes regardless of role — worker code paths
    // transitively read through EnterpriseCacheService and depend on it
    // being ready before any job handler runs.
    await EnterpriseCacheService.initialize();

    // F-B9.1: subscribe to cross-worker auth-cache invalidation channel.
    // Api-side only — workers don't carry an auth cache to invalidate.
    if (isApi) {
      await initAuthCachePubSub();
    }

    // T0-4 (audit 2026-05-17): CacheWarmingService removed.
    // Every warmer key it wrote (clients:list, cases:recent:*,
    // users:list:*, analytics:*, verification-types:list, products:list,
    // rate-types:list) was UN-suffixed. Every reader keyGenerator in
    // enterpriseCache.ts emits `${prefix}:${userId}:${md5(query)}` —
    // a different shape that never matched a warmer write. The whole
    // service was dead code burning ~10 heavy joins on every PM2 worker
    // boot AND holding cross-tenant data in Redis (PII risk if any
    // future reader ever hit those keys). Deleted in commit deleting
    // services/cacheWarmingService.ts.

    // PR2: api-side starts (HTTP listener + request-path metrics flush).
    if (isApi) {
      // Start the server with strict port enforcement - bind to all interfaces for mobile access
      server.listen(config.port, '0.0.0.0', () => {
        logger.info(`Server running on port ${config.port}`);
        logger.info(`Server accessible on all network interfaces (0.0.0.0:${config.port})`);
        logger.info(`Environment: ${config.nodeEnv}`);
        logger.info(`WebSocket server running on port ${config.port}`);

        // Phase C3: drain the performance_metrics in-memory buffer into
        // the DB on a 2-second cadence. Request-path bound — runs on
        // api-role instances that actually serve requests.
        startMetricsBatchFlush();
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
    }

    // PR2: worker-side starts. Previously these lived inside the
    // server.listen() callback above; pulled out so ROLE=worker (no
    // HTTP) still drains queues and runs interval housekeeping.
    if (isWorker) {
      // Start periodic cleanup of performance_metrics (every 6h, 7-day retention).
      // Pure DB housekeeping — does not need request context.
      startMetricsCleanup();

      // Phase D3 (2026-04-28: migrated bull→bullmq, see Medium Fix 7).
      // Attach the bullmq worker that drains the audit log queue onto
      // the audit_logs table. Writers enqueue via
      // createAuditLog()/enqueueAuditLog(); this worker persists.
      startAuditLogProcessor();

      // 2026-04-28 Medium Fix 7: notification workers were previously
      // auto-attached at module-load time inside notificationQueue.ts.
      // Migrating to bullmq we made the worker lifecycle explicit so
      // graceful shutdown can drain in-flight jobs deterministically.
      startNotificationProcessor();

      // 2026-05-13: drain reverse-geocode backfill jobs. Producer is
      // verificationAttachmentController.uploadVerificationImages (fire
      // -and-forget enqueue post-INSERT) + scripts/backfillAddresses.ts
      // for legacy NULL rows. Consumer hits Google + persists into
      // verification_attachments.reverse_geocoded_address so the on-
      // view fast path always finds a cached value.
      startReverseGeocodeProcessor();

      // 2026-04-30 audit closure: schedule daily DB-side maintenance —
      // ensure_*_partitions (extend forward window) + purge_stale_*
      // (retention). Without this, partitioned tables eventually fall
      // into _default and stale notifications/auto_saves accumulate.
      startDbMaintenance();

      // Phase 1 health system: worker writes a Redis heartbeat key
      // (crm:worker:heartbeat, TTL 30s) every 10s. API reads it on
      // /api/health?level=ready to surface worker liveness.
      startWorkerHeartbeat();

      logger.info(`Worker started (role=${role}) — BullMQ + interval jobs attached`);
    }

    // PR2: dedicated health probe for ROLE=worker containers (orchestrator
    // can't probe :3000 since worker doesn't bind HTTP). ROLE=all keeps
    // using :3000/health via the Express app.
    if (role === 'worker') {
      const { createServer: createHealthServer } = await import('http');
      workerHealthServer = createHealthServer((req, res) => {
        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('ok');
          return;
        }
        res.writeHead(404);
        res.end();
      });
      workerHealthServer.listen(config.workerHealthPort, '0.0.0.0', () => {
        logger.info(`Worker health probe listening on :${config.workerHealthPort}/health`);
      });
    }

    // C-HIGH-1 (AUDIT 2026-05-16): periodic cache refresh removed.
    // Mutation-time invalidation (EnterpriseCache.invalidate patterns,
    // memory NM-8) keeps cached data correct; 5-min default TTL on every
    // key (EnterpriseCacheService.set) handles natural staleness. The
    // 10-min refresh was firing ~1,000 redundant DB queries/day/node.
    // Cold-read penalty (one user, ~200ms) accepted as trade-off.
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
    // PR2: only stop what this role started.
    if (isApi) {
      // Phase C3 batch flush is api-side; metrics cleanup is worker-side.
      // stopMonitoringIntervals() clears both; harmless to call on api
      // because the cleanup interval handle is null when not started.
      stopMonitoringIntervals();
    }
    if (isWorker) {
      stopMonitoringIntervals();
      stopDbMaintenance();
    }

    // T1-12 (audit 2026-05-17): drain HTTP + WS BEFORE shutting down
    // bullmq workers. The previous code fired server.close() and
    // io.close() without awaiting them, so the last in-flight HTTP
    // request could still be trying to enqueue an audit_log row AFTER
    // we'd already called stopAuditLogProcessor() — racing the worker
    // shutdown and either dropping the row or hitting "queue closed".
    //
    // Sequence: stop-accepting → drain in-flight → close workers →
    //           close data layer → flush traces.
    if (isApi) {
      // Notify WebSocket clients before closing
      io?.emit('server:shutdown', { message: 'Server is restarting, please reconnect shortly' });

      await new Promise<void>(resolve => {
        // closeIdleConnections nudges keep-alive sockets that are not
        // actively serving a request to close immediately. Without it,
        // server.close() hangs until each keep-alive socket's idle
        // timeout fires (default 5s; we don't want to wait).
        server.closeIdleConnections?.();
        server.close(err => {
          if (err) {
            logger.warn('HTTP server close emitted error', { error: err.message });
          } else {
            logger.info('HTTP server closed');
          }
          resolve();
        });
      });

      if (io) {
        const ioRef = io;
        await new Promise<void>(resolve => {
          void ioRef.close(() => {
            logger.info('WebSocket server closed');
            resolve();
          });
        });
      }
    }

    // Close the worker health probe (only started when ROLE=worker).
    if (workerHealthServer) {
      await new Promise<void>(resolve => {
        workerHealthServer!.close(() => {
          logger.info('Worker health probe closed');
          resolve();
        });
      });
    }

    if (isWorker) {
      // Close the audit log bullmq queue — drains in-flight jobs before
      // shutting the worker down (Phase D3 + Medium Fix 7). Now safe to
      // call: the HTTP layer has drained, no new createAuditLog can fire.
      await stopAuditLogProcessor();

      // Close the notification bullmq queue + worker.
      await stopNotificationProcessor();

      // Close reverse-geocode backfill queue + worker.
      await stopReverseGeocodeProcessor();

      // Stop worker heartbeat writer + drop the key (Redis TTL would
      // expire it anyway, but explicit del flips status faster).
      await stopWorkerHeartbeat();
    }

    // Close enterprise cache service (initialized on every role)
    await EnterpriseCacheService.close();

    // Close Socket.IO Redis adapter pub/sub clients (only created when api).
    if (isApi) {
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
