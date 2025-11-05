import Bull from 'bull';
import { logger } from '@/utils/logger';
import type { NotificationData } from '@/services/NotificationService';
import { NotificationService } from '@/services/NotificationService';
import { config } from '@/config';

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

// Create notification queue
export const notificationQueue = new Bull<NotificationJobData>('notification-processing', {
  redis: config.redisUrl,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
    attempts: 3, // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 second delay
    },
  },
});

// Process notification jobs
notificationQueue.process('single-notification', 5, async job => {
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
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
});

notificationQueue.process('bulk-notification', 3, async job => {
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
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
});

notificationQueue.process('case-assignment', 10, async job => {
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
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
});

notificationQueue.process('case-completion', 5, async job => {
  const data = job.data as CaseCompletionNotificationJobData;

  logger.info('Processing case completion notification job', {
    jobId: job.id,
    caseId: data.caseId,
    fieldUserId: data.fieldUserId,
    backendUserCount: data.backendUserIds.length,
  });

  try {
    const notificationTemplate: Omit<NotificationData, 'userId'> = {
      title: 'Case Completed',
      message: `Case ${data.caseNumber} has been completed by ${data.fieldUserName}`,
      type: 'CASE_COMPLETED',
      caseId: data.caseId,
      caseNumber: data.caseNumber,
      data: {
        customerName: data.customerName,
        fieldUserId: data.fieldUserId,
        fieldUserName: data.fieldUserName,
        completionStatus: data.completionStatus,
        outcome: data.outcome,
      },
      actionUrl: `/cases/${data.caseId}`,
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
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
});

notificationQueue.process('case-revocation', 5, async job => {
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
      actionUrl: `/cases/${data.caseId}`,
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
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
});

// Task Revocation Notification Processor
notificationQueue.process('task-revocation', 5, async job => {
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
      actionUrl: `/cases/${data.caseId}`,
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
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
});

// Queue event handlers
notificationQueue.on('completed', (job, result) => {
  logger.info('Notification job completed', {
    jobId: job.id,
    jobType: job.name,
    result,
  });
});

notificationQueue.on('failed', (job, err) => {
  logger.error('Notification job failed', {
    jobId: job.id,
    jobType: job.name,
    error: err.message,
    attempts: job.attemptsMade,
  });
});

notificationQueue.on('stalled', job => {
  logger.warn('Notification job stalled', {
    jobId: job.id,
    jobType: job.name,
  });
});

// Helper functions to add jobs to the queue
export const queueSingleNotification = async (notification: NotificationData): Promise<string> => {
  const job = await notificationQueue.add(
    'single-notification',
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
    'bulk-notification',
    {
      type: 'bulk',
      userIds,
      notificationTemplate,
      batchId,
    },
    {
      priority: getPriorityValue(notificationTemplate.priority || 'MEDIUM'),
    }
  );

  return job.id?.toString() || '';
};

export const queueCaseAssignmentNotification = async (
  data: Omit<CaseAssignmentNotificationJobData, 'type'>
): Promise<string> => {
  const job = await notificationQueue.add(
    'case-assignment',
    {
      type: 'case-assignment',
      ...data,
    },
    {
      priority: 8, // High priority for case assignments
    }
  );

  return job.id?.toString() || '';
};

export const queueCaseCompletionNotification = async (
  data: Omit<CaseCompletionNotificationJobData, 'type'>
): Promise<string> => {
  const job = await notificationQueue.add(
    'case-completion',
    {
      type: 'case-completion',
      ...data,
    },
    {
      priority: 5, // Medium priority for completions
    }
  );

  return job.id?.toString() || '';
};

export const queueCaseRevocationNotification = async (
  data: Omit<CaseRevocationNotificationJobData, 'type'>
): Promise<string> => {
  const job = await notificationQueue.add(
    'case-revocation',
    {
      type: 'case-revocation',
      ...data,
    },
    {
      priority: 8, // High priority for revocations
    }
  );

  return job.id?.toString() || '';
};

export const queueTaskRevocationNotification = async (
  data: Omit<TaskRevocationNotificationJobData, 'type'>
): Promise<string> => {
  const job = await notificationQueue.add(
    'task-revocation',
    {
      type: 'task-revocation',
      ...data,
    },
    {
      priority: getPriorityValue('HIGH'),
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

// Export queue for monitoring and management
export { notificationQueue as queue };
