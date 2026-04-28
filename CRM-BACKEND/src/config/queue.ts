import { Queue, QueueEvents } from 'bullmq';
import { config } from './index';
import { logger } from './logger';

// 2026-04-28 Medium Fix 7: removed dead scaffolding queues
// (backgroundSyncQueue, notificationQueue, fileProcessingQueue,
// geolocationQueue) + their QueueEvents. They were defined but had
// zero callers across src/. Verified by codebase-wide grep before
// deletion. Only caseAssignmentQueue is actively used (by
// services/caseAssignmentService.ts).
//
// Also removed `timeout: 30000` from defaultJobOptions — `timeout`
// is not a valid job option in bullmq v5 (it was a bull v4 option
// that bullmq drops; was being silently ignored).

// Parse Redis URL to get connection details
const redisUrl = new URL(config.redisUrl);

// Queue configuration shared by all bullmq queues in this file.
const queueConfig = {
  connection: {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port) || 6379,
    password: config.redisPassword || undefined,
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

// Enterprise-scale case assignment queue for 500+ users
export const caseAssignmentQueue = new Queue('case-assignment', {
  ...queueConfig,
  defaultJobOptions: {
    ...queueConfig.defaultJobOptions,
    attempts: 5, // More retries for critical assignment operations
    backoff: {
      type: 'exponential',
      delay: 2000, // Faster retry for enterprise scale
    },
    // Enterprise job settings
    removeOnComplete: 100, // Keep last 100 completed jobs for monitoring
    removeOnFail: 50, // Keep last 50 failed jobs for debugging
  },
});

// Queue events for monitoring
const caseAssignmentEvents = new QueueEvents('case-assignment', {
  connection: {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port) || 6379,
    password: config.redisPassword || undefined,
  },
});

caseAssignmentEvents.on('completed', ({ jobId }) => {
  logger.info(`Case assignment job ${jobId} completed`);
});

caseAssignmentEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Case assignment job ${jobId} failed: ${failedReason}`);
});

caseAssignmentEvents.on('progress', ({ jobId, data }) => {
  logger.info(`Case assignment job ${jobId} progress: ${JSON.stringify(data)}`);
});

export const initializeQueues = async (): Promise<void> => {
  try {
    logger.info('Initializing job queues...');

    // Initialize case assignment worker
    await import('../jobs/caseAssignmentProcessor');
    logger.info('Case assignment worker initialized');

    // Add any startup jobs here if needed

    logger.info('Job queues initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize job queues:', error);
    throw error;
  }
};

export const closeQueues = async (): Promise<void> => {
  try {
    // Close case assignment worker if it exists
    try {
      const { caseAssignmentWorker } = await import('../jobs/caseAssignmentProcessor');
      await caseAssignmentWorker.close();
      logger.info('Case assignment worker closed');
    } catch (error) {
      logger.warn('Failed to close case assignment worker:', error);
    }

    await Promise.all([caseAssignmentQueue.close(), caseAssignmentEvents.close()]);
    logger.info('All queues closed successfully');
  } catch (error) {
    logger.error('Failed to close queues:', error);
  }
};
