import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { config } from '@/config';
import { logger } from '@/config/logger';
import { connectDatabase, disconnectDatabase } from '@/config/database';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { initializeQueues, closeQueues } from '@/config/queue';
import { initializeWebSocket } from '@/websocket/server';
import { EnterpriseCacheService } from './services/enterpriseCacheService';
import { runMigrations } from '@/migrations/migrate';

const server = createServer(app);

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

    // Connect to Redis
    await connectRedis();

    // Initialize enterprise cache service
    await EnterpriseCacheService.initialize();

    // Initialize job queues
    await initializeQueues();
    
    // Start the server with strict port enforcement - bind to all interfaces for mobile access
    server.listen(config.port, '0.0.0.0', () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Server accessible on all network interfaces (0.0.0.0:${config.port})`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`WebSocket server running on port ${config.port}`);
    });

    // Handle port already in use error
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.port} is already in use. Please free the port or stop the conflicting service.`);
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
    io.close(() => {
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
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();
