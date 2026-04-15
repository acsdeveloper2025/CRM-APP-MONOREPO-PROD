import { query } from '../config/database';

export interface SubmissionProgress {
  id: string;
  caseId: string;
  verificationType: string;
  status: 'PREPARING' | 'UPLOADING' | 'SUBMITTING' | 'COMPLETED' | 'FAILED';
  overallProgress: number;
  currentStep: string;
  steps: Array<{
    id: string;
    name: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    progress: number;
    startTime?: string;
    endTime?: string;
    error?: string;
    metadata?: Record<string, unknown>;
  }>;
  startTime: string;
  endTime?: string;
  estimatedTimeRemaining?: number;
  bytesUploaded?: number;
  totalBytes?: number;
  uploadSpeed?: number;
  compressionStats?: {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  };
  retryInfo?: {
    requestId: string;
    attempts: number;
    maxAttempts: number;
    nextRetryIn?: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface SubmissionProgressRow {
  id: string;
  caseId: string;
  verificationType: string;
  status: 'PREPARING' | 'UPLOADING' | 'SUBMITTING' | 'COMPLETED' | 'FAILED';
  overallProgress: number;
  currentStep: string;
  steps: string;
  startTime: string;
  endTime?: string;
  estimatedTimeRemaining?: number;
  bytesUploaded?: number;
  totalBytes?: number;
  uploadSpeed?: number;
  compressionStats?: string;
  retryInfo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RetryQueueItem {
  id: string;
  caseId: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  attempts: number;
  maxAttempts: number;
  lastAttempt: string;
  nextRetry: string;
  error?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  type: 'VERIFICATION_SUBMISSION' | 'ATTACHMENT_UPLOAD' | 'CASE_UPDATE';
  status: 'PENDING' | 'RETRYING' | 'SUCCESS' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

class SubmissionProgressService {
  /**
   * Create a new submission progress record
   */
  async createSubmissionProgress(
    caseId: string,
    verificationType: string,
    totalBytes?: number
  ): Promise<SubmissionProgress> {
    const id = `submission_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const now = new Date().toISOString();

    const defaultSteps: Array<{
      id: string;
      name: string;
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
      progress: number;
      startTime?: string;
      endTime?: string;
      error?: string;
      metadata?: Record<string, unknown>;
    }> = [
      { id: 'validation', name: 'Validating Form Data', status: 'PENDING', progress: 0 },
      { id: 'compression', name: 'Optimizing Data', status: 'PENDING', progress: 0 },
      { id: 'uploadPhotos', name: 'Uploading Photos', status: 'PENDING', progress: 0 },
      { id: 'submitForm', name: 'Submitting Verification', status: 'PENDING', progress: 0 },
      { id: 'confirmation', name: 'Processing Confirmation', status: 'PENDING', progress: 0 },
    ];

    const submissionProgress: SubmissionProgress = {
      id,
      caseId,
      verificationType,
      status: 'PREPARING',
      overallProgress: 0,
      currentStep: 'validation',
      steps: defaultSteps,
      startTime: now,
      totalBytes,
      bytesUploaded: 0,
      uploadSpeed: 0,
      createdAt: now,
      updatedAt: now,
    };

    await query(
      `
      INSERT INTO submission_progress (
        id, case_id, verification_type, status, overall_progress, current_step,
        steps, start_time, total_bytes, bytes_uploaded, upload_speed,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `,
      [
        id,
        caseId,
        verificationType,
        submissionProgress.status,
        submissionProgress.overallProgress,
        submissionProgress.currentStep,
        JSON.stringify(submissionProgress.steps),
        submissionProgress.startTime,
        totalBytes,
        0,
        0,
        now,
        now,
      ]
    );

    return submissionProgress;
  }

  /**
   * Update submission progress
   */
  async updateSubmissionProgress(
    id: string,
    updates: Partial<SubmissionProgress>
  ): Promise<SubmissionProgress | null> {
    const now = new Date().toISOString();

    // Build dynamic update query
    const updateFields: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }

    if (updates.overallProgress !== undefined) {
      updateFields.push(`overall_progress = $${paramIndex++}`);
      values.push(updates.overallProgress);
    }

    if (updates.currentStep !== undefined) {
      updateFields.push(`current_step = $${paramIndex++}`);
      values.push(updates.currentStep);
    }

    if (updates.steps !== undefined) {
      updateFields.push(`steps = $${paramIndex++}`);
      values.push(JSON.stringify(updates.steps));
    }

    if (updates.endTime !== undefined) {
      updateFields.push(`end_time = $${paramIndex++}`);
      values.push(updates.endTime);
    }

    if (updates.estimatedTimeRemaining !== undefined) {
      updateFields.push(`estimated_time_remaining = $${paramIndex++}`);
      values.push(updates.estimatedTimeRemaining);
    }

    if (updates.bytesUploaded !== undefined) {
      updateFields.push(`bytes_uploaded = $${paramIndex++}`);
      values.push(updates.bytesUploaded);
    }

    if (updates.uploadSpeed !== undefined) {
      updateFields.push(`upload_speed = $${paramIndex++}`);
      values.push(updates.uploadSpeed);
    }

    if (updates.compressionStats !== undefined) {
      updateFields.push(`compression_stats = $${paramIndex++}`);
      values.push(JSON.stringify(updates.compressionStats));
    }

    if (updates.retryInfo !== undefined) {
      updateFields.push(`retry_info = $${paramIndex++}`);
      values.push(JSON.stringify(updates.retryInfo));
    }

    updateFields.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(id); // For WHERE clause

    if (updateFields.length === 1) {
      // Only updatedAt
      return this.getSubmissionProgress(id);
    }

    const updateQuery = `
      UPDATE submission_progress 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSubmissionProgress(result.rows[0]);
  }

  /**
   * Get submission progress by ID
   */
  async getSubmissionProgress(id: string): Promise<SubmissionProgress | null> {
    const result = await query(
      `SELECT id, case_id, verification_type, status, overall_progress, current_step,
              steps, start_time, end_time, estimated_time_remaining, bytes_uploaded,
              total_bytes, upload_speed, compression_stats, retry_info, created_at, updated_at
       FROM submission_progress WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSubmissionProgress(result.rows[0]);
  }

  /**
   * Get submission progress by case ID
   */
  async getSubmissionProgressByCase(caseId: string): Promise<SubmissionProgress[]> {
    const result = await query(
      `SELECT id, case_id, verification_type, status, overall_progress, current_step,
              steps, start_time, end_time, estimated_time_remaining, bytes_uploaded,
              total_bytes, upload_speed, compression_stats, retry_info, created_at, updated_at
       FROM submission_progress WHERE case_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [caseId]
    );

    return result.rows.map((row: unknown) =>
      this.mapRowToSubmissionProgress(row as SubmissionProgressRow)
    );
  }

  /**
   * Get active submission progress (not completed or failed)
   */
  async getActiveSubmissionProgress(): Promise<SubmissionProgress[]> {
    const result = await query(
      `SELECT id, case_id, verification_type, status, overall_progress, current_step,
              steps, start_time, end_time, estimated_time_remaining, bytes_uploaded,
              total_bytes, upload_speed, compression_stats, retry_info, created_at, updated_at
       FROM submission_progress WHERE status NOT IN ('COMPLETED', 'FAILED') ORDER BY created_at DESC LIMIT 500`
    );

    return result.rows.map((row: unknown) =>
      this.mapRowToSubmissionProgress(row as SubmissionProgressRow)
    );
  }

  /**
   * Add item to retry queue
   */
  async addToRetryQueue(
    caseId: string,
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string,
    type: RetryQueueItem['type'],
    priority: RetryQueueItem['priority'] = 'MEDIUM'
  ): Promise<string> {
    const id = `retry_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const now = new Date().toISOString();

    await query(
      `
      INSERT INTO retry_queue (
        id, case_id, url, method, headers, body, attempts, max_attempts,
        last_attempt, next_retry, priority, type, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `,
      [
        id,
        caseId,
        url,
        method,
        JSON.stringify(headers),
        body,
        0,
        5,
        now,
        now,
        priority,
        type,
        'PENDING',
        now,
        now,
      ]
    );

    return id;
  }

  /**
   * Get retry queue status
   */
  async getRetryQueueStatus(): Promise<{
    pending: number;
    retrying: number;
    failed: number;
    totalRequests: number;
  }> {
    const result = await query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM retry_queue 
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY status
    `);

    const statusCounts: Record<string, number> = {};
    for (const row of result.rows as Array<{ status: string; count: string }>) {
      statusCounts[row.status.toLowerCase()] = parseInt(row.count, 10);
    }

    let totalRequests = 0;
    for (const count of Object.values(statusCounts)) {
      totalRequests += count;
    }

    return {
      pending: statusCounts.pending || 0,
      retrying: statusCounts.retrying || 0,
      failed: statusCounts.failed || 0,
      totalRequests,
    };
  }

  /**
   * Clean up old submission progress records
   */
  async cleanupOldRecords(): Promise<void> {
    // Remove completed/failed records older than 7 days
    await query(`
      DELETE FROM submission_progress 
      WHERE status IN ('COMPLETED', 'FAILED') 
      AND created_at < NOW() - INTERVAL '7 days'
    `);

    // Remove retry queue items older than 24 hours
    await query(`
      DELETE FROM retry_queue 
      WHERE created_at < NOW() - INTERVAL '24 hours'
    `);
  }

  /**
   * Map database row to SubmissionProgress object
   */

  private mapRowToSubmissionProgress(row: SubmissionProgressRow): SubmissionProgress {
    return {
      id: row.id,
      caseId: row.caseId,
      verificationType: row.verificationType,
      status: row.status,
      overallProgress: row.overallProgress,
      currentStep: row.currentStep,
      steps: JSON.parse(row.steps || '[]'),
      startTime: row.startTime,
      endTime: row.endTime,
      estimatedTimeRemaining: row.estimatedTimeRemaining,
      bytesUploaded: row.bytesUploaded,
      totalBytes: row.totalBytes,
      uploadSpeed: row.uploadSpeed,
      compressionStats: row.compressionStats ? JSON.parse(row.compressionStats) : undefined,
      retryInfo: row.retryInfo ? JSON.parse(row.retryInfo) : undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export default new SubmissionProgressService();
