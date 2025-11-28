import { Request, Response, NextFunction } from 'express';
import { query } from '@/config/database';

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
    const taskId = req.params.taskId || req.params.caseId;

    if (!taskId) {
      return next();
    }

    // Check if it's a UUID (verification task ID)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);

    if (isUUID) {
      // Try to find the case_id for this verification task
      const result = await query(
        'SELECT case_id, id as task_id FROM verification_tasks WHERE id = $1',
        [taskId]
      );

      if (result.rows.length > 0) {
        // Store both the case ID and task ID for controllers to use
        (req as any).resolvedCaseId = result.rows[0].case_id;
        (req as any).verificationTaskId = result.rows[0].task_id;

        // IMPORTANT: Override req.params.caseId so existing controllers work without changes
        req.params.caseId = result.rows[0].case_id;

        console.log(`✅ Resolved taskId ${taskId} to caseId ${result.rows[0].case_id}`);
      } else {
        // Not a verification task ID, might be a case ID
        (req as any).resolvedCaseId = taskId;
        req.params.caseId = taskId;
      }
    } else {
      // Not a UUID, treat as case ID
      (req as any).resolvedCaseId = taskId;
      if (!req.params.caseId) {
        req.params.caseId = taskId;
      }
    }

    next();
  } catch (error) {
    console.error('Error resolving taskId to caseId:', error);
    next(error);
  }
}

/**
 * Helper function to get case ID from request
 * Checks resolvedCaseId first, then falls back to params
 */
export function getCaseIdFromRequest(req: Request): string {
  return (req as any).resolvedCaseId || req.params.caseId || req.params.taskId;
}

/**
 * Helper function to get verification task ID from request
 */
export function getTaskIdFromRequest(req: Request): string | undefined {
  return (req as any).verificationTaskId || req.params.taskId;
}
