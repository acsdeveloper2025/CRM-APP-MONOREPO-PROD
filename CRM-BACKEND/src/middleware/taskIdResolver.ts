import { Request, Response, NextFunction } from 'express';
import { query } from '@/config/database';
import { logger } from '@/utils/logger';

interface RequestWithResolvedIds extends Request {
  resolvedCaseId?: string;
  verificationTaskId?: string;
}

/**
 * Middleware to resolve taskId to caseId
 * Checks if the :taskId or :caseId parameter is actually a verification task ID
 * and resolves it to the corresponding case ID
 *
 * This middleware enables backward compatibility by allowing:
 * 1. New mobile apps to call /verification-tasks/:taskId
 * 2. Old mobile apps to call /cases/:caseId
 * 3. Both to work seamlessly by resolving taskId → caseId when needed
 */
export async function resolveTaskIdToCaseId(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check both :taskId and :caseId parameters
    const rawTaskId = req.params.taskId || req.params.caseId;
    const taskId = Array.isArray(rawTaskId) ? String(rawTaskId[0] || '') : String(rawTaskId || '');

    if (!taskId) {
      return next();
    }

    // Check if it's a UUID (verification task ID)
    const isUUID =
      taskId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(taskId));

    if (isUUID) {
      // Try to find the case_id for this verification task
      const result = await query(
        'SELECT case_id, id as task_id FROM verification_tasks WHERE id = $1',
        [taskId]
      );

      if (result.rows.length > 0) {
        // Store both the case ID and task ID for controllers to use
        (req as RequestWithResolvedIds).resolvedCaseId = String(result.rows[0].caseId);
        (req as RequestWithResolvedIds).verificationTaskId = String(result.rows[0].taskId);

        // IMPORTANT: Override req.params.caseId so existing controllers work without changes
        req.params.caseId = String(result.rows[0].caseId);

        logger.info(`✅ Resolved taskId ${taskId} to caseId ${result.rows[0].caseId}`);
      } else {
        // Not a verification task ID, might be a case ID
        const finalTaskId = String(taskId);
        (req as RequestWithResolvedIds).resolvedCaseId = finalTaskId;
        req.params.caseId = finalTaskId;
      }
    } else {
      // Not a UUID, treat as case ID
      const finalTaskId = String(taskId);
      (req as RequestWithResolvedIds).resolvedCaseId = finalTaskId;
      if (!req.params.caseId) {
        req.params.caseId = finalTaskId;
      }
    }

    next();
  } catch (error) {
    logger.error('Error resolving taskId to caseId:', error);
    next(error);
  }
}

/**
 * Helper function to get case ID from request
 * Checks resolvedCaseId first, then falls back to params
 */
export function getCaseIdFromRequest(req: Request): string {
  const rawId =
    (req as RequestWithResolvedIds).resolvedCaseId || req.params.caseId || req.params.taskId;
  return Array.isArray(rawId) ? String(rawId[0] || '') : String(rawId || '');
}

/**
 * Helper function to get verification task ID from request
 */
export function getTaskIdFromRequest(req: Request): string | undefined {
  const rawTaskId = (req as RequestWithResolvedIds).verificationTaskId || req.params.taskId || '';
  const taskId = Array.isArray(rawTaskId) ? String(rawTaskId[0] || '') : String(rawTaskId || '');
  if (!taskId) {
    return undefined;
  }
  return taskId;
}
