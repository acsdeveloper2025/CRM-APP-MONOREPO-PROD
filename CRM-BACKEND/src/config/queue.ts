import { Queue, Worker, QueueEvents } from 'bullmq';
import { config } from './index';
import { logger } from './logger';

// Parse Redis URL to get connection details
const redisUrl = new URL(config.redisUrl);

// Queue configuration
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

// Background sync queue for offline changes
export const backgroundSyncQueue = new Queue('background-sync', queueConfig);

// Notification queue for push notifications
export const notificationQueue = new Queue('notifications', queueConfig);

// File processing queue for attachments
export const fileProcessingQueue = new Queue('file-processing', queueConfig);

// Geolocation queue for reverse geocoding
export const geolocationQueue = new Queue('geolocation', queueConfig);

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
const backgroundSyncEvents = new QueueEvents('background-sync', {
  connection: {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port) || 6379,
    password: config.redisPassword || undefined,
  },
});

const notificationEvents = new QueueEvents('notifications', {
  connection: {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port) || 6379,
    password: config.redisPassword || undefined,
  },
});

const fileProcessingEvents = new QueueEvents('file-processing', {
  connection: {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port) || 6379,
    password: config.redisPassword || undefined,
  },
});

const geolocationEvents = new QueueEvents('geolocation', {
  connection: {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port) || 6379,
    password: config.redisPassword || undefined,
  },
});

const caseAssignmentEvents = new QueueEvents('case-assignment', {
  connection: {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port) || 6379,
    password: config.redisPassword || undefined,
  },
});

// Event listeners
backgroundSyncEvents.on('completed', ({ jobId }) => {
  logger.info(`Background sync job ${jobId} completed`);
});

backgroundSyncEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Background sync job ${jobId} failed: ${failedReason}`);
});

notificationEvents.on('completed', ({ jobId }) => {
  logger.info(`Notification job ${jobId} completed`);
});

notificationEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Notification job ${jobId} failed: ${failedReason}`);
});

fileProcessingEvents.on('completed', ({ jobId }) => {
  logger.info(`File processing job ${jobId} completed`);
});

fileProcessingEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`File processing job ${jobId} failed: ${failedReason}`);
});

geolocationEvents.on('completed', ({ jobId }) => {
  logger.info(`Geolocation job ${jobId} completed`);
});

geolocationEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Geolocation job ${jobId} failed: ${failedReason}`);
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
    const { caseAssignmentWorker } = await import('../jobs/caseAssignmentProcessor');
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

    await Promise.all([
      backgroundSyncQueue.close(),
      notificationQueue.close(),
      fileProcessingQueue.close(),
      geolocationQueue.close(),
      caseAssignmentQueue.close(),
      backgroundSyncEvents.close(),
      notificationEvents.close(),
      fileProcessingEvents.close(),
      geolocationEvents.close(),
      caseAssignmentEvents.close(),
    ]);
    logger.info('All queues closed successfully');
  } catch (error) {
    logger.error('Failed to close queues:', error);
  }
};
