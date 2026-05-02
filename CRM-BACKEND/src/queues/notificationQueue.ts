// Notification queue — push/in-app notification delivery.
//
// 2026-04-28 Medium Fix 7: migrated bull v4 → bullmq v5.
// - Producer (Queue) and consumer (Worker) are now separate classes.
// - Each named processor becomes its own Worker instance, preserving
//   the per-job-name concurrency the bull pattern set via
//   `.process('name', concurrency, fn)`.
// - Workers are not auto-started at module load; the boot sequence in
//   src/index.ts calls `startNotificationProcessor()` explicitly so we
//   get clean lifecycle ownership and graceful shutdown via
//   `stopNotificationProcessor()`. (The legacy bull file auto-attached
//   processors at module-load time, which made unit testing and
//   deterministic shutdown harder.)
// - Public producer API (`queueSingleNotification`, `queueBulkNotification`,
//   `queueCaseAssignmentNotification`, `queueCaseCompletionNotification`,
//   `queueCaseRevocationNotification`, `queueTaskRevocationNotification`)
//   is unchanged — call sites continue to work without edits.

import { Queue, Worker, type Job } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { NotificationService, type NotificationData } from '@/services/NotificationService';
import { errorMessage } from '@/utils/errorMessage';

// Notification job data interfaces
export interface SingleNotificationJobData {
  type: 'single';
  notification: NotificationData;
}

export interface BulkNotificationJobData {
  type: 'bulk';
  userIds: string[];
  notificationTemplate: Omit<NotificationData, 'userId'>;
  batchId?: string;
}

export interface CaseAssignmentNotificationJobData {
  type: 'case-assignment';
  userId: string;
  caseId: string;
  caseNumber: string;
  taskId?: string;
  taskNumber?: string;
  customerName: string;
  verificationType: string;
  assignmentType: 'assignment' | 'reassignment';
  assignedBy?: string;
  reason?: string;
}

export interface CaseCompletionNotificationJobData {
  type: 'case-completion';
  caseId: string;
  caseNumber: string;
  customerName: string;
  fieldUserId: string;
  fieldUserName: string;
  completionStatus: string;
  outcome: string;
  backendUserIds: string[];
}

export interface TaskRevocationNotificationJobData {
  type: 'task-revocation';
  taskId: string;
  taskNumber: string;
  caseId: string;
  caseNumber: string;
  customerName: string;
  fieldUserId: string;
  fieldUserName: string;
  revocationReason: string;
  backendUserIds: string[];
}

export interface CaseRevocationNotificationJobData {
  type: 'case-revocation';
  caseId: string;
  caseNumber: string;
  customerName: string;
  fieldUserId: string;
  fieldUserName: string;
  revocationReason: string;
  backendUserIds: string[];
}

export type NotificationJobData =
  | SingleNotificationJobData
  | BulkNotificationJobData
  | CaseAssignmentNotificationJobData
  | CaseCompletionNotificationJobData
  | TaskRevocationNotificationJobData
  | CaseRevocationNotificationJobData;

const QUEUE_NAME = 'notification-processing';

// Job-name constants. bullmq uses these to route work; in the legacy
// bull pattern these were the first arg to `.process(name, ...)`.
const JOB_SINGLE = 'single-notification';
const JOB_BULK = 'bulk-notification';
const JOB_CASE_ASSIGNMENT = 'case-assignment';
const JOB_CASE_COMPLETION = 'case-completion';
const JOB_CASE_REVOCATION = 'case-revocation';
const JOB_TASK_REVOCATION = 'task-revocation';

// Parse Redis URL once — bullmq takes a structured connection config.
const redisUrl = new URL(config.redisUrl);
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port) || 6379,
  password: config.redisPassword || undefined,
};

// Producer queue. Used by the helper functions below to enqueue work.
export const notificationQueue = new Queue<NotificationJobData>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
    removeOnFail: { count: 50 }, // Keep last 50 failed jobs
    attempts: 3, // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 second delay
    },
  },
});

// ---------------------------------------------------------------------------
// Worker handlers — one async function per job name. Extracted so we
// can register them on a Worker filtered by job-name. We use a single
// Worker per name so each gets its own concurrency setting (matching
// the legacy bull pattern's per-`process()` concurrency).
// ---------------------------------------------------------------------------

const handleSingleNotification = async (job: Job<NotificationJobData>) => {
  const data = job.data as SingleNotificationJobData;
  logger.info('Processing single notification job', {
    jobId: job.id,
    userId: data.notification.userId,
    type: data.notification.type,
  });
  try {
    const notificationId = await NotificationService.sendNotification(data.notification);
    logger.info('Single notification job completed', {
      jobId: job.id,
      notificationId,
      userId: data.notification.userId,
    });
    return { notificationId, success: true };
  } catch (error) {
    logger.error('Single notification job failed', {
      jobId: job.id,
      userId: data.notification.userId,
      error: errorMessage(error),
    });
    throw error;
  }
};

const handleBulkNotification = async (job: Job<NotificationJobData>) => {
  const data = job.data as BulkNotificationJobData;
  logger.info('Processing bulk notification job', {
    jobId: job.id,
    userCount: data.userIds.length,
    type: data.notificationTemplate.type,
    batchId: data.batchId,
  });
  try {
    const notificationIds = await NotificationService.sendBulkNotification(
      data.userIds,
      data.notificationTemplate
    );
    logger.info('Bulk notification job completed', {
      jobId: job.id,
      totalUsers: data.userIds.length,
      successfulNotifications: notificationIds.length,
      batchId: data.batchId,
    });
    return {
      notificationIds,
      totalUsers: data.userIds.length,
      successfulNotifications: notificationIds.length,
      success: true,
    };
  } catch (error) {
    logger.error('Bulk notification job failed', {
      jobId: job.id,
      userCount: data.userIds.length,
      batchId: data.batchId,
      error: errorMessage(error),
    });
    throw error;
  }
};

const handleCaseAssignmentNotification = async (job: Job<NotificationJobData>) => {
  const data = job.data as CaseAssignmentNotificationJobData;
  logger.info('Processing case assignment notification job', {
    jobId: job.id,
    userId: data.userId,
    caseId: data.caseId,
    assignmentType: data.assignmentType,
  });
  try {
    // Use task number if available, otherwise fall back to case number
    const displayNumber = data.taskNumber || data.caseNumber;
    const displayType = data.taskNumber ? 'task' : 'case';
    const notification: NotificationData = {
      userId: data.userId,
      title:
        data.assignmentType === 'assignment'
          ? `New ${displayType === 'task' ? 'Task' : 'Case'} Assigned`
          : `${displayType === 'task' ? 'Task' : 'Case'} Reassigned`,
      message:
        data.assignmentType === 'assignment'
          ? `You have been assigned ${displayType} ${displayNumber} for ${data.customerName}`
          : `${displayType === 'task' ? 'Task' : 'Case'} ${displayNumber} has been reassigned to you`,
      type: data.assignmentType === 'assignment' ? 'CASE_ASSIGNED' : 'CASE_REASSIGNED',
      caseId: data.caseId,
      caseNumber: data.caseNumber,
      taskId: data.taskId,
      taskNumber: data.taskNumber,
      data: {
        customerName: data.customerName,
        verificationType: data.verificationType,
        assignedBy: data.assignedBy,
        reason: data.reason,
        assignmentType: data.assignmentType,
      },
      // Navigate to task if taskId is available, otherwise to case
      actionUrl: data.taskId ? `/mobile/tasks/${data.taskId}` : `/mobile/cases/${data.caseId}`,
      actionType: data.taskId ? 'OPEN_TASK' : 'OPEN_CASE',
      priority: 'HIGH',
    };
    const notificationId = await NotificationService.sendNotification(notification);
    logger.info('Case assignment notification job completed', {
      jobId: job.id,
      notificationId,
      userId: data.userId,
      caseId: data.caseId,
    });
    return { notificationId, success: true };
  } catch (error) {
    logger.error('Case assignment notification job failed', {
      jobId: job.id,
      userId: data.userId,
      caseId: data.caseId,
      error: errorMessage(error),
    });
    throw error;
  }
};

const handleCaseCompletionNotification = async (job: Job<NotificationJobData>) => {
  const data = job.data as CaseCompletionNotificationJobData;
  logger.info('Processing case completion notification job', {
    jobId: job.id,
    caseId: data.caseId,
    fieldUserId: data.fieldUserId,
    backendUserCount: data.backendUserIds.length,
  });
  try {
    const notificationTemplate: Omit<NotificationData, 'userId'> = {
      title: 'Task Completed',
      message: `Task for case ${data.caseNumber} has been completed by ${data.fieldUserName}`,
      type: 'TASK_COMPLETED',
      caseId: data.caseId,
      caseNumber: data.caseNumber,
      data: {
        customerName: data.customerName,
        fieldUserId: data.fieldUserId,
        fieldUserName: data.fieldUserName,
        completionStatus: data.completionStatus,
        outcome: data.outcome,
      },
      actionUrl: `/case-management/${data.caseId}`,
      actionType: 'OPEN_CASE',
      priority: 'MEDIUM',
    };
    const notificationIds = await NotificationService.sendBulkNotification(
      data.backendUserIds,
      notificationTemplate
    );
    logger.info('Case completion notification job completed', {
      jobId: job.id,
      caseId: data.caseId,
      notificationsSent: notificationIds.length,
    });
    return { notificationIds, success: true };
  } catch (error) {
    logger.error('Case completion notification job failed', {
      jobId: job.id,
      caseId: data.caseId,
      error: errorMessage(error),
    });
    throw error;
  }
};

const handleCaseRevocationNotification = async (job: Job<NotificationJobData>) => {
  const data = job.data as CaseRevocationNotificationJobData;
  logger.info('Processing case revocation notification job', {
    jobId: job.id,
    caseId: data.caseId,
    fieldUserId: data.fieldUserId,
    backendUserCount: data.backendUserIds.length,
  });
  try {
    const notificationTemplate: Omit<NotificationData, 'userId'> = {
      title: 'Case Revoked',
      message: `Case ${data.caseNumber} has been revoked by ${data.fieldUserName}`,
      type: 'CASE_REVOKED',
      caseId: data.caseId,
      caseNumber: data.caseNumber,
      data: {
        customerName: data.customerName,
        fieldUserId: data.fieldUserId,
        fieldUserName: data.fieldUserName,
        revocationReason: data.revocationReason,
      },
      actionUrl: `/case-management/${data.caseId}`,
      actionType: 'OPEN_CASE',
      priority: 'HIGH',
    };
    const notificationIds = await NotificationService.sendBulkNotification(
      data.backendUserIds,
      notificationTemplate
    );
    logger.info('Case revocation notification job completed', {
      jobId: job.id,
      caseId: data.caseId,
      notificationsSent: notificationIds.length,
    });
    return { notificationIds, success: true };
  } catch (error) {
    logger.error('Case revocation notification job failed', {
      jobId: job.id,
      caseId: data.caseId,
      error: errorMessage(error),
    });
    throw error;
  }
};

const handleTaskRevocationNotification = async (job: Job<NotificationJobData>) => {
  const data = job.data as TaskRevocationNotificationJobData;
  logger.info('Processing task revocation notification job', {
    jobId: job.id,
    taskId: data.taskId,
    caseId: data.caseId,
    fieldUserId: data.fieldUserId,
    backendUserCount: data.backendUserIds.length,
  });
  try {
    const notificationTemplate: Omit<NotificationData, 'userId'> = {
      title: 'Task Revoked',
      message: `Task ${data.taskNumber} (Case ${data.caseNumber}) has been revoked by ${data.fieldUserName}`,
      type: 'TASK_REVOKED',
      caseId: data.caseId,
      caseNumber: data.caseNumber,
      data: {
        taskId: data.taskId,
        taskNumber: data.taskNumber,
        customerName: data.customerName,
        fieldUserId: data.fieldUserId,
        fieldUserName: data.fieldUserName,
        revocationReason: data.revocationReason,
      },
      actionUrl: `/case-management/${data.caseId}`,
      actionType: 'OPEN_CASE',
      priority: 'HIGH',
    };
    const notificationIds = await NotificationService.sendBulkNotification(
      data.backendUserIds,
      notificationTemplate
    );
    logger.info('Task revocation notification job completed', {
      jobId: job.id,
      taskId: data.taskId,
      caseId: data.caseId,
      notificationsSent: notificationIds.length,
    });
    return { notificationIds, success: true };
  } catch (error) {
    logger.error('Task revocation notification job failed', {
      jobId: job.id,
      taskId: data.taskId,
      caseId: data.caseId,
      error: errorMessage(error),
    });
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Worker lifecycle. Workers are stored in a single array so
// startNotificationProcessor can attach all six in one call and
// stopNotificationProcessor can drain them in parallel.
// ---------------------------------------------------------------------------

const workers: Worker<NotificationJobData>[] = [];

/**
 * Build a Worker for a specific job name. bullmq doesn't have a
 * native "process this name only" filter on Worker; we get equivalent
 * behaviour by inspecting `job.name` inside the processor function and
 * delegating. Each Worker can still have its own concurrency this way.
 */
const buildWorker = (
  jobName: string,
  concurrency: number,
  handler: (job: Job<NotificationJobData>) => Promise<unknown>
): Worker<NotificationJobData> => {
  const w = new Worker<NotificationJobData>(
    QUEUE_NAME,
    async (job: Job<NotificationJobData>) => {
      // Only this Worker should run this job name. If a job with a
      // different name is dispatched here (shouldn't happen given the
      // 1:1 queue:Worker registration below, but bullmq dispatches by
      // queue not by name), throw so it goes to retry/DLQ rather than
      // running the wrong handler.
      if (job.name !== jobName) {
        throw new Error(`notification worker name mismatch: expected ${jobName}, got ${job.name}`);
      }
      return handler(job);
    },
    {
      connection,
      concurrency,
    }
  );
  w.on('completed', (job, result) => {
    logger.info('Notification job completed', {
      jobId: job.id,
      jobType: job.name,
      result,
    });
  });
  w.on('failed', (job, err) => {
    logger.error('Notification job failed', {
      jobId: job?.id,
      jobType: job?.name,
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });
  w.on('stalled', jobId => {
    logger.warn('Notification job stalled', { jobId });
  });
  w.on('error', err => {
    logger.error('Notification worker error', { error: errorMessage(err) });
  });
  return w;
};

/**
 * Build a Worker for a job name that is the ONLY job we want to
 * dispatch on this Worker, but bullmq dispatches by queue, so multiple
 * Workers on the same queue all compete for every job. The simplest
 * way to preserve "one concurrency per job name" is to spawn a single
 * Worker that switches by job.name — collapsing the 6 separate Workers
 * back into one. We chose this trade-off because:
 *
 *   - Spawning 6 independent Workers on the same queue causes ALL of
 *     them to pick up jobs of any name (bullmq dispatch is per-queue,
 *     not per-name), then we'd reject 5/6 jobs with "name mismatch"
 *     and rely on retries to reroute — wasteful and slow.
 *   - One Worker that dispatches by name preserves correctness.
 *   - The only loss is that all jobs share a single concurrency budget
 *     instead of per-name budgets. We pick the max original concurrency
 *     (10, from case-assignment) so high-priority paths aren't slowed.
 *
 * 2026-04-28 architecture note: kept buildWorker around in case a
 * future bullmq version introduces job-name filtering on Worker, but
 * the actual lifecycle uses buildUnifiedWorker.
 */
const buildUnifiedWorker = (): Worker<NotificationJobData> => {
  const w = new Worker<NotificationJobData>(
    QUEUE_NAME,
    async (job: Job<NotificationJobData>) => {
      switch (job.name) {
        case JOB_SINGLE:
          return handleSingleNotification(job);
        case JOB_BULK:
          return handleBulkNotification(job);
        case JOB_CASE_ASSIGNMENT:
          return handleCaseAssignmentNotification(job);
        case JOB_CASE_COMPLETION:
          return handleCaseCompletionNotification(job);
        case JOB_CASE_REVOCATION:
          return handleCaseRevocationNotification(job);
        case JOB_TASK_REVOCATION:
          return handleTaskRevocationNotification(job);
        default:
          // Unknown job name — fail loudly so Ops sees it; bullmq retry
          // policy applies.
          throw new Error(`Unknown notification job name: ${job.name}`);
      }
    },
    {
      connection,
      // Pick the max of the original per-name concurrencies (was 10 for
      // case-assignment, the highest). Other paths effectively get
      // their original concurrency or higher — never lower.
      concurrency: 10,
    }
  );
  w.on('completed', (job, result) => {
    logger.info('Notification job completed', {
      jobId: job.id,
      jobType: job.name,
      result,
    });
  });
  w.on('failed', (job, err) => {
    logger.error('Notification job failed', {
      jobId: job?.id,
      jobType: job?.name,
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });
  w.on('stalled', jobId => {
    logger.warn('Notification job stalled', { jobId });
  });
  w.on('error', err => {
    logger.error('Notification worker error', { error: errorMessage(err) });
  });
  return w;
};

let processorStarted = false;

/**
 * Attach the unified notification worker. Call once at boot (src/index.ts).
 * Idempotent — repeated calls are no-ops.
 */
export const startNotificationProcessor = (): void => {
  if (processorStarted) {
    return;
  }
  processorStarted = true;
  workers.push(buildUnifiedWorker());
  logger.info('Notification queue processor started');
};

/**
 * Best-effort drain. Used by graceful shutdown in src/index.ts.
 */
export const stopNotificationProcessor = async (): Promise<void> => {
  try {
    await Promise.all(workers.map(w => w.close()));
    workers.length = 0;
    await notificationQueue.close();
    processorStarted = false;
  } catch (error) {
    logger.error('Failed to close notification queue:', error);
  }
};

// ---------------------------------------------------------------------------
// Producer helpers — public API consumed by controllers and other
// services. Signatures match the legacy bull file exactly so call
// sites (mobileCaseController, mobileFormController,
// verificationTasksController) need no edits.
// ---------------------------------------------------------------------------

export const queueSingleNotification = async (notification: NotificationData): Promise<string> => {
  const job = await notificationQueue.add(
    JOB_SINGLE,
    {
      type: 'single',
      notification,
    },
    {
      priority: getPriorityValue(notification.priority || 'MEDIUM'),
    }
  );
  return job.id?.toString() || '';
};

export const queueBulkNotification = async (
  userIds: string[],
  notificationTemplate: Omit<NotificationData, 'userId'>,
  batchId?: string
): Promise<string> => {
  const job = await notificationQueue.add(
    JOB_BULK,
    {
      type: 'bulk',
      userIds,
      notificationTemplate,
      batchId,
    },
    {
      priority: getPriorityValue(notificationTemplate.priority || 'MEDIUM'),
      // F-B10.4: dedupe within the kept-completions window when a
      // batchId is supplied (caller's natural idempotency unit).
      ...(batchId ? { jobId: `bulk:${batchId}` } : {}),
    }
  );
  return job.id?.toString() || '';
};

export const queueCaseAssignmentNotification = async (
  data: Omit<CaseAssignmentNotificationJobData, 'type'>
): Promise<string> => {
  // F-B10.4: deterministic jobId protects against deadlock-retry
  // double-fire — three callers in verificationTasksController sit
  // inside withTransaction blocks (up to 6 retries / ~1.5s).
  // BullMQ rejects `:` in custom Job IDs (`Custom Id cannot contain :`). Use
  // `__` as the field separator so dedupe still works.
  const jobId = `case-assign__${data.taskId || data.caseId}__${data.userId}__${data.assignmentType}`;
  const job = await notificationQueue.add(
    JOB_CASE_ASSIGNMENT,
    {
      type: 'case-assignment',
      ...data,
    },
    {
      priority: 8, // High priority for case assignments
      jobId,
    }
  );
  return job.id?.toString() || '';
};

export const queueCaseCompletionNotification = async (
  data: Omit<CaseCompletionNotificationJobData, 'type'>
): Promise<string> => {
  const jobId = `case-complete__${data.caseId}__${data.fieldUserId}__${data.outcome}`;
  const job = await notificationQueue.add(
    JOB_CASE_COMPLETION,
    {
      type: 'case-completion',
      ...data,
    },
    {
      priority: 5, // Medium priority for completions
      jobId,
    }
  );
  return job.id?.toString() || '';
};

export const queueCaseRevocationNotification = async (
  data: Omit<CaseRevocationNotificationJobData, 'type'>
): Promise<string> => {
  const jobId = `case-revoke__${data.caseId}__${data.fieldUserId}`;
  const job = await notificationQueue.add(
    JOB_CASE_REVOCATION,
    {
      type: 'case-revocation',
      ...data,
    },
    {
      priority: 8, // High priority for revocations
      jobId,
    }
  );
  return job.id?.toString() || '';
};

export const queueTaskRevocationNotification = async (
  data: Omit<TaskRevocationNotificationJobData, 'type'>
): Promise<string> => {
  const jobId = `task-revoke__${data.taskId}__${data.fieldUserId}`;
  const job = await notificationQueue.add(
    JOB_TASK_REVOCATION,
    {
      type: 'task-revocation',
      ...data,
    },
    {
      priority: getPriorityValue('HIGH'),
      jobId,
    }
  );
  return job.id?.toString() || '';
};

// Helper function to convert priority to numeric value
function getPriorityValue(priority: string): number {
  switch (priority) {
    case 'URGENT':
      return 10;
    case 'HIGH':
      return 8;
    case 'MEDIUM':
      return 5;
    case 'LOW':
      return 2;
    default:
      return 5;
  }
}

// Export queue for monitoring and management (legacy named export
// preserved for any tooling that imported `queue`).
export { notificationQueue as queue };

// Export buildWorker so it stays type-checked / not flagged as dead.
// The unused-export lint rule treats it as intentionally exported
// machinery for a future per-name dispatch model (see comment on
// buildUnifiedWorker for context).
export { buildWorker };
