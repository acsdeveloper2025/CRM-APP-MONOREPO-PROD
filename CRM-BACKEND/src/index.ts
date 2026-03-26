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
// Migrations removed for production - use database import instead

const server = createServer(app);

logger.info('🚀 [LOADED] src/index.ts IS RUNNING!');

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
  },
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
      const pubClient = createClient({ url: redisUrl, password: redisPassword });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
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

      // Schedule periodic cache refresh (every 10 minutes)
      setInterval(
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

  try {
    // Close server
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Close WebSocket connections
    void io.close(() => {
      logger.info('WebSocket server closed');
    });

    // Close job queues
    await closeQueues();

    // Close enterprise cache service
    await EnterpriseCacheService.close();

    // Disconnect from Redis
    await disconnectRedis();

    // Disconnect from database
    await disconnectDatabase();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
// eslint-disable-next-line @typescript-eslint/no-floating-promises
startServer();
