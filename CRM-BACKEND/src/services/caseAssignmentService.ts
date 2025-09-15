import { v4 as uuidv4 } from 'uuid';
import { caseAssignmentQueue } from '../config/queue';
import { query } from '../config/database';
import { logger } from '../config/logger';
import {
  SingleAssignmentJobData,
  BulkAssignmentJobData,
  ReassignmentJobData,
  BulkAssignmentResult,
  AssignmentResult,
} from '../jobs/caseAssignmentProcessor';

export interface AssignCaseRequest {
  caseId: string;
  assignedToId: string;
  assignedById: string;
  reason?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface BulkAssignCasesRequest {
  caseIds: string[];
  assignedToId: string;
  assignedById: string;
  reason?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface ReassignCaseRequest {
  caseId: string;
  fromUserId: string;
  toUserId: string;
  assignedById: string;
  reason: string;
}

export interface QueueStatusResponse {
  batchId: string;
  jobId: string;
  status: string;
  totalCases: number;
  processedCases: number;
  successfulAssignments: number;
  failedAssignments: number;
  startedAt?: Date;
  completedAt?: Date;
  errors: string[];
  progress?: number;
}

export class CaseAssignmentService {
  /**
   * Assign a single case to a field agent
   */
  static async assignCase(request: AssignCaseRequest): Promise<{ jobId: string }> {
    try {
      // Validate case exists and is assignable
      await this.validateCaseAssignment(request.caseId, request.assignedToId);

      const jobData: SingleAssignmentJobData = {
        type: 'single',
        caseId: request.caseId,
        assignedToId: request.assignedToId,
        assignedById: request.assignedById,
        reason: request.reason,
        priority: request.priority,
      };

      const job = await caseAssignmentQueue.add('single-assignment', jobData, {
        priority: this.getPriorityValue(request.priority),
        delay: 0, // Process immediately
      });

      logger.info('Single case assignment job queued', {
        jobId: job.id,
        caseId: request.caseId,
        assignedToId: request.assignedToId,
        assignedById: request.assignedById,
      });

      return { jobId: job.id! };
    } catch (error) {
      logger.error('Failed to queue single case assignment', {
        request,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Assign multiple cases to a field agent in bulk
   */
  static async bulkAssignCases(request: BulkAssignCasesRequest): Promise<{ batchId: string; jobId: string }> {
    try {
      // Validate all cases exist and are assignable
      await this.validateBulkCaseAssignment(request.caseIds, request.assignedToId);

      const batchId = uuidv4();

      const jobData: BulkAssignmentJobData = {
        type: 'bulk',
        caseIds: request.caseIds,
        assignedToId: request.assignedToId,
        assignedById: request.assignedById,
        reason: request.reason,
        batchId,
        priority: request.priority,
      };

      // Create queue status record
      await this.createQueueStatusRecord(batchId, request);

      const job = await caseAssignmentQueue.add('bulk-assignment', jobData, {
        priority: this.getPriorityValue(request.priority),
        delay: 0, // Process immediately
      });

      // Update queue status with job ID
      await this.updateQueueStatus(batchId, { jobId: job.id!, status: 'PROCESSING', startedAt: new Date() });

      logger.info('Bulk case assignment job queued', {
        jobId: job.id,
        batchId,
        totalCases: request.caseIds.length,
        assignedToId: request.assignedToId,
        assignedById: request.assignedById,
      });

      return { batchId, jobId: job.id! };
    } catch (error) {
      logger.error('Failed to queue bulk case assignment', {
        request,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Reassign a case from one field agent to another
   */
  static async reassignCase(request: ReassignCaseRequest): Promise<{ jobId: string }> {
    try {
      // Validate case exists and reassignment is valid
      await this.validateCaseReassignment(request.caseId, request.fromUserId, request.toUserId);

      const jobData: ReassignmentJobData = {
        type: 'reassign',
        caseId: request.caseId,
        fromUserId: request.fromUserId,
        toUserId: request.toUserId,
        assignedById: request.assignedById,
        reason: request.reason,
      };

      const job = await caseAssignmentQueue.add('case-reassignment', jobData, {
        priority: this.getPriorityValue('HIGH'), // Reassignments are high priority
        delay: 0, // Process immediately
      });

      logger.info('Case reassignment job queued', {
        jobId: job.id,
        caseId: request.caseId,
        fromUserId: request.fromUserId,
        toUserId: request.toUserId,
        assignedById: request.assignedById,
      });

      return { jobId: job.id! };
    } catch (error) {
      logger.error('Failed to queue case reassignment', {
        request,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get the status of a bulk assignment operation
   */
  static async getBulkAssignmentStatus(batchId: string): Promise<QueueStatusResponse | null> {
    try {
      const statusQuery = `
        SELECT 
          "batchId",
          "jobId",
          status,
          "totalCases",
          "processedCases",
          "successfulAssignments",
          "failedAssignments",
          "startedAt",
          "completedAt",
          errors
        FROM case_assignment_queue_status
        WHERE "batchId" = $1
      `;

      const result = await query(statusQuery, [batchId]);

      if (result.rows.length === 0) {
        return null;
      }

      const statusData = result.rows[0];
      const progress = statusData.totalCases > 0 
        ? Math.round((statusData.processedCases / statusData.totalCases) * 100)
        : 0;

      return {
        batchId: statusData.batchId,
        jobId: statusData.jobId,
        status: statusData.status,
        totalCases: statusData.totalCases,
        processedCases: statusData.processedCases,
        successfulAssignments: statusData.successfulAssignments,
        failedAssignments: statusData.failedAssignments,
        startedAt: statusData.startedAt,
        completedAt: statusData.completedAt,
        errors: statusData.errors || [],
        progress,
      };
    } catch (error) {
      logger.error('Failed to get bulk assignment status', {
        batchId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get assignment history for a case
   */
  static async getCaseAssignmentHistory(caseId: string): Promise<any[]> {
    try {
      const historyQuery = `
        SELECT 
          cah.id,
          cah."assignedAt",
          cah.reason,
          cah."batchId",
          from_user.name as "fromUserName",
          from_user.email as "fromUserEmail",
          to_user.name as "toUserName",
          to_user.email as "toUserEmail",
          assigned_by.name as "assignedByName",
          assigned_by.email as "assignedByEmail"
        FROM case_assignment_history cah
        LEFT JOIN users from_user ON cah."fromUserId" = from_user.id
        LEFT JOIN users to_user ON cah."toUserId" = to_user.id
        LEFT JOIN users assigned_by ON cah."assignedById" = assigned_by.id
        WHERE cah."caseId" = $1
        ORDER BY cah."assignedAt" DESC
      `;

      const result = await query(historyQuery, [caseId]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get case assignment history', {
        caseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get field agent workload statistics
   */
  static async getFieldAgentWorkload(): Promise<any[]> {
    try {
      const workloadQuery = `
        SELECT * FROM field_agent_workload
        ORDER BY total_assigned_cases DESC
      `;

      const result = await query(workloadQuery);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get field agent workload', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Cancel a pending bulk assignment
   */
  static async cancelBulkAssignment(batchId: string, cancelledById: string): Promise<boolean> {
    try {
      // Get job ID
      const statusQuery = `
        SELECT "jobId", status FROM case_assignment_queue_status
        WHERE "batchId" = $1
      `;

      const result = await query(statusQuery, [batchId]);

      if (result.rows.length === 0) {
        throw new Error(`Batch ${batchId} not found`);
      }

      const { jobId, status } = result.rows[0];

      if (status !== 'PENDING' && status !== 'PROCESSING') {
        throw new Error(`Cannot cancel batch in status: ${status}`);
      }

      // Try to remove the job from the queue
      const job = await caseAssignmentQueue.getJob(jobId);
      if (job) {
        await job.remove();
      }

      // Update status
      await this.updateQueueStatus(batchId, {
        status: 'CANCELLED',
        completedAt: new Date(),
      });

      logger.info('Bulk assignment cancelled', {
        batchId,
        jobId,
        cancelledById,
      });

      return true;
    } catch (error) {
      logger.error('Failed to cancel bulk assignment', {
        batchId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Private helper methods

  private static async validateCaseAssignment(caseId: string, assignedToId: string): Promise<void> {
    // Check if case exists
    const caseQuery = `SELECT id, status FROM cases WHERE id = $1`;
    const caseResult = await query(caseQuery, [caseId]);

    if (caseResult.rows.length === 0) {
      throw new Error(`Case ${caseId} not found`);
    }

    // Check if user exists and is a field agent
    const userQuery = `
      SELECT id, role, "isActive" 
      FROM users 
      WHERE id = $1 AND role = 'FIELD_AGENT'
    `;
    const userResult = await query(userQuery, [assignedToId]);

    if (userResult.rows.length === 0) {
      throw new Error(`Field agent ${assignedToId} not found`);
    }

    if (!userResult.rows[0].isActive) {
      throw new Error(`Field agent ${assignedToId} is not active`);
    }
  }

  private static async validateBulkCaseAssignment(caseIds: string[], assignedToId: string): Promise<void> {
    if (caseIds.length === 0) {
      throw new Error('No cases provided for assignment');
    }

    // Enterprise scale: Allow larger batches for 500+ users
    const maxBatchSize = parseInt(process.env.MAX_BATCH_SIZE || '500');
    if (caseIds.length > maxBatchSize) {
      throw new Error(`Cannot assign more than ${maxBatchSize} cases in a single batch`);
    }

    // Check if all cases exist
    const placeholders = caseIds.map((_, index) => `$${index + 1}`).join(', ');
    const casesQuery = `SELECT id FROM cases WHERE id IN (${placeholders})`;
    const casesResult = await query(casesQuery, caseIds);

    if (casesResult.rows.length !== caseIds.length) {
      throw new Error('Some cases not found');
    }

    // Validate assignee
    await this.validateCaseAssignment(caseIds[0], assignedToId);
  }

  private static async validateCaseReassignment(
    caseId: string,
    fromUserId: string,
    toUserId: string
  ): Promise<void> {
    // Check if case is currently assigned to fromUserId
    const caseQuery = `
      SELECT id, "assignedTo" 
      FROM cases 
      WHERE id = $1 AND "assignedTo" = $2
    `;
    const caseResult = await query(caseQuery, [caseId, fromUserId]);

    if (caseResult.rows.length === 0) {
      throw new Error(`Case ${caseId} is not assigned to user ${fromUserId}`);
    }

    // Validate new assignee
    await this.validateCaseAssignment(caseId, toUserId);
  }

  private static getPriorityValue(priority?: string): number {
    switch (priority) {
      case 'URGENT': return 1;
      case 'HIGH': return 2;
      case 'MEDIUM': return 3;
      case 'LOW': return 4;
      default: return 3;
    }
  }

  private static async createQueueStatusRecord(
    batchId: string,
    request: BulkAssignCasesRequest
  ): Promise<void> {
    const insertQuery = `
      INSERT INTO case_assignment_queue_status (
        "batchId", "jobId", "createdById", "assignedToId", 
        "totalCases", status, "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    `;

    await query(insertQuery, [
      batchId,
      '', // Will be updated with actual job ID
      request.assignedById,
      request.assignedToId,
      request.caseIds.length,
      'PENDING',
    ]);
  }

  private static async updateQueueStatus(
    batchId: string,
    updates: Partial<{
      jobId: string;
      status: string;
      processedCases: number;
      successfulAssignments: number;
      failedAssignments: number;
      startedAt: Date;
      completedAt: Date;
      errors: string[];
    }>
  ): Promise<void> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`"${key}" = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) return;

    updateFields.push(`"updatedAt" = NOW()`);

    const updateQuery = `
      UPDATE case_assignment_queue_status 
      SET ${updateFields.join(', ')}
      WHERE "batchId" = $${paramIndex}
    `;

    values.push(batchId);

    await query(updateQuery, values);
  }
}
