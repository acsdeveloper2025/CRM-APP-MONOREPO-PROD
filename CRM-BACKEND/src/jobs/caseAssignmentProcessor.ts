import { Worker, type Job } from 'bullmq';
import { config } from '../config';
import { logger } from '../config/logger';
import { query, pool } from '../config/database';
import { createAuditLog } from '../utils/auditLogger';
import { queueCaseAssignmentNotification } from '../queues/notificationQueue';
import { loadExecutionEligibleUser } from '@/security/userCapabilities';

// Parse Redis URL to get connection details
const redisUrl = new URL(config.redisUrl);

// Job data interfaces
export interface SingleAssignmentJobData {
  type: 'single';
  caseId: string;
  assignedToId: string;
  assignedById: string;
  reason?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface BulkAssignmentJobData {
  type: 'bulk';
  caseIds: string[];
  assignedToId: string;
  assignedById: string;
  reason?: string;
  batchId: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface ReassignmentJobData {
  type: 'reassign';
  caseId: string;
  fromUserId: string;
  toUserId: string;
  assignedById: string;
  reason: string;
}

export type CaseAssignmentJobData =
  | SingleAssignmentJobData
  | BulkAssignmentJobData
  | ReassignmentJobData;

// Assignment result interfaces
export interface AssignmentResult {
  success: boolean;
  caseId: string;
  error?: string;
  previousAssignee?: string;
  newAssignee?: string;
}

export interface BulkAssignmentResult {
  batchId: string;
  totalCases: number;
  successfulAssignments: number;
  failedAssignments: number;
  results: AssignmentResult[];
  errors: string[];
}

/**
 * Process case reassignment (resets status to PENDING)
 */
async function processCaseReassignment(
  caseId: string,
  fromUserId: string,
  toUserId: string,
  assignedById: string,
  reason: string
): Promise<AssignmentResult> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get current case details
    const caseQuery = `
      SELECT
        id,
        case_id,
        customer_name,
        "assignedTo",
        status
      FROM cases
      WHERE id = $1 AND "assignedTo" = $2
      FOR UPDATE
    `;

    const caseResult = await client.query(caseQuery, [caseId, fromUserId]);

    if (caseResult.rows.length === 0) {
      throw new Error(`Case ${caseId} not found or not assigned to user ${fromUserId}`);
    }

    const caseData = caseResult.rows[0];

    // Get previous assignee details
    const prevUserQuery = `
      SELECT name, email
      FROM users
      WHERE id = $1
    `;
    const prevUserResult = await client.query(prevUserQuery, [fromUserId]);
    const previousAssigneeName = prevUserResult.rows[0]?.name || 'Unknown';

    // Get new assignee details
    if (!(await loadExecutionEligibleUser(toUserId, client))) {
      throw new Error(`Execution assignee ${toUserId} not found or not eligible`);
    }
    const userResult = await client.query<{ id: string; name: string; email: string }>(
      `
        SELECT id, name, email
        FROM users
        WHERE id = $1
      `,
      [toUserId]
    );
    if (userResult.rows.length === 0) {
      throw new Error(`Execution assignee ${toUserId} not found`);
    }
    const newAssignee = userResult.rows[0];

    // Update case assignment and RESET status to PENDING for reassignments
    const updateQuery = `
      UPDATE cases
      SET
        "assignedTo" = $1,
        status = 'PENDING',
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const _updateResult = await client.query(updateQuery, [toUserId, caseId]);

    // Create audit log
    await createAuditLog({
      userId: assignedById,
      action: 'CASE_REASSIGNED',
      entityType: 'CASE',
      entityId: caseId,
      details: {
        caseId: caseData.caseId,
        customerName: caseData.customerName,
        previousAssignee: previousAssigneeName,
        newAssignee: newAssignee.name,
        previousStatus: caseData.status,
        newStatus: 'PENDING',
        reason,
      },
    });

    // Insert assignment history record
    const historyQuery = `
      INSERT INTO case_assignment_history (
        case_uuid, "case_id", from_user_id, to_user_id, assigned_by_id, assigned_by,
        previous_assignee, new_assignee, reason, assigned_at, batch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
    `;

    await client.query(historyQuery, [
      caseId,
      caseId,
      fromUserId,
      toUserId,
      assignedById,
      assignedById,
      fromUserId,
      toUserId,
      reason,
      null, // No batch ID for reassignment
    ]);

    await client.query('COMMIT');

    // Get verification type for notification
    const verificationTypeQuery = `
      SELECT vt.name as verification_type_name
      FROM cases c
      LEFT JOIN verification_types vt ON c.verification_type_id = vt.id
      WHERE c.id = $1
    `;
    const verificationResult = await client.query(verificationTypeQuery, [caseId]);
    const verificationType = verificationResult.rows[0]?.verification_type_name || 'Unknown';

    // Queue notification for the new assigned user (reassignment)
    await queueCaseAssignmentNotification({
      userId: toUserId,
      caseId,
      caseNumber: caseData.caseId,
      customerName: caseData.customerName,
      verificationType,
      assignmentType: 'reassignment',
      assignedBy: assignedById,
      reason,
    });

    // Queue notification for the previous user (case removed)
    if (fromUserId && fromUserId !== toUserId) {
      await queueCaseAssignmentNotification({
        userId: fromUserId,
        caseId,
        caseNumber: caseData.caseId,
        customerName: caseData.customerName,
        verificationType,
        assignmentType: 'reassignment', // This will be handled as case removal in the notification
        assignedBy: assignedById,
        reason,
      });
    }

    logger.info('Case reassignment completed', {
      caseId,
      fromUserId,
      toUserId,
      previousStatus: caseData.status,
      newStatus: 'PENDING',
      assignedBy: assignedById,
    });

    return {
      success: true,
      caseId,
      previousAssignee: previousAssigneeName,
      newAssignee: newAssignee.name,
    };
  } catch (error) {
    await client.query('ROLLBACK');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Case reassignment failed', {
      caseId,
      fromUserId,
      toUserId,
      error: errorMessage,
    });

    return {
      success: false,
      caseId,
      error: errorMessage,
    };
  } finally {
    client.release();
  }
}

/**
 * Process single case assignment
 */
async function processSingleAssignment(
  caseId: string,
  assignedToId: string,
  assignedById: string,
  reason?: string
): Promise<AssignmentResult> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get current case details (separate queries to avoid FOR UPDATE with LEFT JOIN)
    const caseQuery = `
      SELECT
        id,
        case_id,
        customer_name,
        "assignedTo",
        status
      FROM cases
      WHERE id = $1
      FOR UPDATE
    `;

    const caseResult = await client.query(caseQuery, [caseId]);

    if (caseResult.rows.length === 0) {
      throw new Error(`Case ${caseId} not found`);
    }

    const caseData = caseResult.rows[0];
    const previousAssignee = caseData.assignedTo;

    // Get previous assignee details if exists
    let previousAssigneeName = null;
    let _previousAssigneeEmail = null;

    if (previousAssignee) {
      const prevUserQuery = `
        SELECT name, email
        FROM users
        WHERE id = $1
      `;
      const prevUserResult = await client.query(prevUserQuery, [previousAssignee]);
      if (prevUserResult.rows.length > 0) {
        previousAssigneeName = prevUserResult.rows[0].name;
        _previousAssigneeEmail = prevUserResult.rows[0].email;
      }
    }

    // Get new assignee details
    if (!(await loadExecutionEligibleUser(assignedToId, client))) {
      throw new Error(`Execution assignee ${assignedToId} not found or not eligible`);
    }
    const userResult = await client.query<{ id: string; name: string; email: string }>(
      `
        SELECT id, name, email
        FROM users
        WHERE id = $1
      `,
      [assignedToId]
    );

    if (userResult.rows.length === 0) {
      throw new Error(`Execution assignee ${assignedToId} not found`);
    }

    const newAssignee = userResult.rows[0];

    // Update case assignment
    const updateQuery = `
      UPDATE cases
      SET
        "assignedTo" = $1,
        status = CASE
          WHEN status IS NULL OR status = '' THEN 'PENDING'
          WHEN status = 'PENDING' THEN 'PENDING'
          ELSE status
        END,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const _updateResult = await client.query(updateQuery, [assignedToId, caseId]);

    // Create audit log
    await createAuditLog({
      userId: assignedById,
      action: previousAssignee ? 'CASE_REASSIGNED' : 'CASE_ASSIGNED',
      entityType: 'CASE',
      entityId: caseId,
      details: {
        caseId: caseData.caseId,
        customerName: caseData.customerName,
        previousAssignee: previousAssigneeName,
        newAssignee: newAssignee.name,
        reason: reason || 'No reason provided',
      },
    });

    // Insert assignment history record
    const historyQuery = `
      INSERT INTO case_assignment_history (
        case_uuid, "case_id", from_user_id, to_user_id, assigned_by_id, assigned_by,
        previous_assignee, new_assignee, reason, assigned_at, batch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
    `;

    await client.query(historyQuery, [
      caseId,
      caseId, // case_id column (NOT NULL) - same as caseUUID
      previousAssignee,
      assignedToId,
      assignedById,
      assignedById, // assignedBy column (NOT NULL)
      previousAssignee, // previousAssignee column
      assignedToId, // newAssignee column (NOT NULL)
      reason || 'Case assignment',
      null, // No batch ID for single assignment
    ]);

    await client.query('COMMIT');

    // Get verification type for notification
    const verificationTypeQuery = `
      SELECT vt.name as verification_type_name
      FROM cases c
      LEFT JOIN verification_types vt ON c.verification_type_id = vt.id
      WHERE c.id = $1
    `;
    const verificationResult = await client.query(verificationTypeQuery, [caseId]);
    const verificationType = verificationResult.rows[0]?.verification_type_name || 'Unknown';

    // Queue notification for the assigned user
    await queueCaseAssignmentNotification({
      userId: assignedToId,
      caseId,
      caseNumber: caseData.caseId,
      customerName: caseData.customerName,
      verificationType,
      assignmentType: previousAssignee ? 'reassignment' : 'assignment',
      assignedBy: assignedById,
      reason,
    });

    logger.info('Case assignment completed', {
      caseId,
      previousAssignee,
      newAssignee: assignedToId,
      assignedBy: assignedById,
    });

    return {
      success: true,
      caseId,
      previousAssignee: caseData.previousAssigneeName,
      newAssignee: newAssignee.name,
    };
  } catch (error) {
    await client.query('ROLLBACK');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Case assignment failed', {
      caseId,
      assignedToId,
      error: errorMessage,
    });

    return {
      success: false,
      caseId,
      error: errorMessage,
    };
  } finally {
    client.release();
  }
}

/**
 * Process bulk case assignment
 */
async function processBulkAssignment(
  caseIds: string[],
  assignedToId: string,
  assignedById: string,
  batchId: string,
  reason?: string,
  job?: Job
): Promise<BulkAssignmentResult> {
  const results: AssignmentResult[] = [];
  const errors: string[] = [];
  let successfulAssignments = 0;
  let failedAssignments = 0;

  // Validate assignee first
  if (!(await loadExecutionEligibleUser(assignedToId))) {
    throw new Error(`Execution assignee ${assignedToId} not found or not eligible`);
  }
  const userResult = await query(
    `
      SELECT id, name, email
      FROM users
      WHERE id = $1
    `,
    [assignedToId]
  );

  if (userResult.rows.length === 0) {
    throw new Error(`Execution assignee ${assignedToId} not found`);
  }

  const assignee = userResult.rows[0];

  // High-performance batch processing for 2000+ users: optimized batch sizes
  // Scale batch size based on total cases: 30-100 cases per batch for better throughput
  const batchSize = Math.min(Math.max(Math.floor(caseIds.length / 8), 30), 100);
  const totalBatches = Math.ceil(caseIds.length / batchSize);

  logger.info('Starting bulk assignment processing', {
    totalCases: caseIds.length,
    batchSize,
    totalBatches,
    assignedTo: assignedToId,
    batchId,
  });

  for (let i = 0; i < caseIds.length; i += batchSize) {
    const batch = caseIds.slice(i, i + batchSize);
    const currentBatch = Math.floor(i / batchSize) + 1;

    // Update job progress
    if (job) {
      await job.updateProgress({
        processed: i,
        total: caseIds.length,
        currentBatch,
        totalBatches,
        successfulAssignments,
        failedAssignments,
      });
    }

    // Process batch
    const batchPromises = batch.map(caseId =>
      processSingleAssignment(caseId, assignedToId, assignedById, reason)
    );

    const batchResults = await Promise.allSettled(batchPromises);

    // Collect results
    batchResults.forEach((result, index) => {
      const caseId = batch[index];

      if (result.status === 'fulfilled') {
        results.push(result.value);
        if (result.value.success) {
          successfulAssignments++;
        } else {
          failedAssignments++;
          errors.push(`Case ${caseId}: ${result.value.error}`);
        }
      } else {
        failedAssignments++;
        const errorMessage =
          result.reason instanceof Error ? result.reason.message : 'Unknown error';
        errors.push(`Case ${caseId}: ${errorMessage}`);
        results.push({
          success: false,
          caseId,
          error: errorMessage,
        });
      }
    });

    // Small delay between batches to prevent overwhelming the system
    if (i + batchSize < caseIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Create bulk assignment audit log
  await createAuditLog({
    userId: assignedById,
    action: 'BULK_CASE_ASSIGNMENT',
    entityType: 'CASE',
    entityId: batchId,
    details: {
      batchId,
      assignedTo: assignee.name,
      totalCases: caseIds.length,
      successfulAssignments,
      failedAssignments,
      reason: reason || 'Bulk assignment',
    },
  });

  // Final progress update
  if (job) {
    await job.updateProgress({
      processed: caseIds.length,
      total: caseIds.length,
      currentBatch: totalBatches,
      totalBatches,
      successfulAssignments,
      failedAssignments,
      completed: true,
    });
  }

  logger.info('Bulk assignment completed', {
    batchId,
    totalCases: caseIds.length,
    successfulAssignments,
    failedAssignments,
    assignedTo: assignedToId,
    assignedBy: assignedById,
  });

  return {
    batchId,
    totalCases: caseIds.length,
    successfulAssignments,
    failedAssignments,
    results,
    errors,
  };
}

/**
 * Case Assignment Worker
 */
// Enterprise-scale worker configuration for 2000+ users
const getWorkerConcurrency = (): number => {
  const totalUsers = parseInt(process.env.TOTAL_CONCURRENT_USERS || '2000');
  // Enhanced concurrency: 1 worker per 15 users for better throughput, min 20, max 200
  return Math.min(Math.max(Math.floor(totalUsers / 15), 20), 200);
};

export const caseAssignmentWorker = new Worker(
  'case-assignment',
  async (job: Job<CaseAssignmentJobData>) => {
    const { data } = job;
    const startTime = Date.now();

    logger.info('Processing case assignment job', {
      jobId: job.id,
      type: data.type,
      workerId: process.pid,
    });

    try {
      let result;

      switch (data.type) {
        case 'single':
          result = await processSingleAssignment(
            data.caseId,
            data.assignedToId,
            data.assignedById,
            data.reason
          );
          break;

        case 'bulk':
          result = await processBulkAssignment(
            data.caseIds,
            data.assignedToId,
            data.assignedById,
            data.batchId,
            data.reason,
            job
          );
          break;

        case 'reassign':
          result = await processCaseReassignment(
            data.caseId,
            data.fromUserId,
            data.toUserId,
            data.assignedById,
            data.reason
          );
          break;

        default:
          throw new Error(`Unknown assignment type: ${(data as { type: string }).type}`);
      }

      const processingTime = Date.now() - startTime;
      logger.info('Case assignment job completed', {
        jobId: job.id,
        type: data.type,
        processingTime: `${processingTime}ms`,
        workerId: process.pid,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Case assignment job failed', {
        jobId: job.id,
        type: data.type,
        processingTime: `${processingTime}ms`,
        workerId: process.pid,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  },
  {
    connection: {
      host: redisUrl.hostname,
      port: parseInt(redisUrl.port) || 6379,
      password: config.redisPassword || undefined,
      // Enterprise Redis connection settings
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
    },
    concurrency: getWorkerConcurrency(), // Dynamic concurrency based on scale
  }
);

// Worker event handlers
caseAssignmentWorker.on('completed', job => {
  logger.info(`Case assignment job ${job.id} completed successfully`);
});

caseAssignmentWorker.on('failed', (job, err) => {
  logger.error(`Case assignment job ${job?.id} failed:`, err);
});

caseAssignmentWorker.on('error', err => {
  logger.error('Case assignment worker error:', err);
});
