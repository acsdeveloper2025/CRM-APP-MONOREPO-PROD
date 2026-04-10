import type { Request, Response, NextFunction } from 'express';
import type { TaskStatus, TaskPriority } from '../types/verificationTask';

/**
 * Validation middleware for verification task operations
 */

export const validateTaskCreation = (req: Request, res: Response, next: NextFunction) => {
  const { tasks } = req.body;

  // Check if tasks array exists and is not empty
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Tasks array is required and must not be empty',
      error: { code: 'INVALID_INPUT' },
    });
  }

  // Validate each task
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const taskIndex = i + 1;

    // Required fields validation (accept both camelCase and snake_case)
    const verificationTypeId = task.verificationTypeId ?? task.verification_type_id;
    const taskTitle = task.taskTitle ?? task.task_title;
    const taskDescription = task.taskDescription ?? task.task_description;
    const estimatedAmount = task.estimatedAmount ?? task.estimated_amount;
    const rateTypeId = task.rateTypeId ?? task.rate_type_id;
    const estimatedCompletionDate = task.estimatedCompletionDate ?? task.estimated_completion_date;
    const documentDetails = task.documentDetails ?? task.document_details;

    if (!verificationTypeId) {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: verificationTypeId is required`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    if (!taskTitle || taskTitle.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: taskTitle is required`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    // Type validation
    if (typeof verificationTypeId !== 'number') {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: verificationTypeId must be a number`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    if (typeof taskTitle !== 'string') {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: taskTitle must be a string`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    // Optional field validation
    if (task.priority && !isValidPriority(task.priority)) {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: priority must be one of: LOW, MEDIUM, HIGH, URGENT`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    if (estimatedAmount && (typeof estimatedAmount !== 'number' || estimatedAmount < 0)) {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: estimatedAmount must be a positive number`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    if (rateTypeId && typeof rateTypeId !== 'number') {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: rateTypeId must be a number`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    // String length validation
    if (taskTitle.length > 255) {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: taskTitle must be 255 characters or less`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    if (taskDescription && taskDescription.length > 1000) {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: taskDescription must be 1000 characters or less`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    // Date validation
    if (estimatedCompletionDate && !isValidDate(estimatedCompletionDate)) {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: estimatedCompletionDate must be a valid date`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    // Document details validation
    if (documentDetails && typeof documentDetails !== 'object') {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: documentDetails must be an object`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }
  }

  next();
};

export const validateTaskUpdate = (req: Request, res: Response, next: NextFunction) => {
  const updateData = req.body;

  // Check if at least one field is provided (accept both camelCase and snake_case)
  const allowedFields = [
    'taskTitle',
    'task_title',
    'taskDescription',
    'task_description',
    'priority',
    'status',
    'verificationOutcome',
    'verification_outcome',
    'actualAmount',
    'actual_amount',
    'address',
    'pincode',
    'documentType',
    'document_type',
    'documentNumber',
    'document_number',
    'documentDetails',
    'document_details',
    'estimatedCompletionDate',
    'estimated_completion_date',
  ];

  const providedFields = Object.keys(updateData).filter(key => allowedFields.includes(key));

  if (providedFields.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one valid field must be provided for update',
      error: { code: 'INVALID_INPUT' },
    });
  }

  // Validate individual fields (accept both camelCase and snake_case)
  const taskTitle = updateData.taskTitle ?? updateData.task_title;
  if (taskTitle !== undefined) {
    if (typeof taskTitle !== 'string' || taskTitle.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'taskTitle must be a non-empty string',
        error: { code: 'INVALID_INPUT' },
      });
    }

    if (taskTitle.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'taskTitle must be 255 characters or less',
        error: { code: 'INVALID_INPUT' },
      });
    }
  }

  const taskDescription = updateData.taskDescription ?? updateData.task_description;
  if (taskDescription !== undefined) {
    if (typeof taskDescription !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'taskDescription must be a string',
        error: { code: 'INVALID_INPUT' },
      });
    }

    if (taskDescription.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'taskDescription must be 1000 characters or less',
        error: { code: 'INVALID_INPUT' },
      });
    }
  }

  if (updateData.priority !== undefined && !isValidPriority(updateData.priority)) {
    return res.status(400).json({
      success: false,
      message: 'priority must be one of: LOW, MEDIUM, HIGH, URGENT',
      error: { code: 'INVALID_INPUT' },
    });
  }

  if (updateData.status !== undefined && !isValidStatus(updateData.status)) {
    return res.status(400).json({
      success: false,
      message: 'status must be one of: PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, REVOKED, ON_HOLD',
      error: { code: 'INVALID_INPUT' },
    });
  }

  const actualAmount = updateData.actualAmount ?? updateData.actual_amount;
  if (actualAmount !== undefined) {
    if (typeof actualAmount !== 'number' || actualAmount < 0) {
      return res.status(400).json({
        success: false,
        message: 'actualAmount must be a positive number',
        error: { code: 'INVALID_INPUT' },
      });
    }
  }

  const estimatedCompletionDate =
    updateData.estimatedCompletionDate ?? updateData.estimated_completion_date;
  if (estimatedCompletionDate !== undefined && !isValidDate(estimatedCompletionDate)) {
    return res.status(400).json({
      success: false,
      message: 'estimatedCompletionDate must be a valid date',
      error: { code: 'INVALID_INPUT' },
    });
  }

  const documentDetails = updateData.documentDetails ?? updateData.document_details;
  if (documentDetails !== undefined && typeof documentDetails !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'documentDetails must be an object',
      error: { code: 'INVALID_INPUT' },
    });
  }

  next();
};

export const validateTaskAssignment = (req: Request, res: Response, next: NextFunction) => {
  const assignedTo = req.body.assignedTo ?? req.body.assigned_to;
  const assignmentReason = req.body.assignmentReason ?? req.body.assignment_reason;
  const { priority } = req.body;

  // Required field validation
  if (!assignedTo) {
    return res.status(400).json({
      success: false,
      message: 'assignedTo is required',
      error: { code: 'INVALID_INPUT' },
    });
  }

  if (typeof assignedTo !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'assignedTo must be a string (user ID)',
      error: { code: 'INVALID_INPUT' },
    });
  }

  // Optional field validation
  if (assignmentReason !== undefined) {
    if (typeof assignmentReason !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'assignmentReason must be a string',
        error: { code: 'INVALID_INPUT' },
      });
    }

    if (assignmentReason.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'assignmentReason must be 500 characters or less',
        error: { code: 'INVALID_INPUT' },
      });
    }
  }

  if (priority !== undefined && !isValidPriority(priority)) {
    return res.status(400).json({
      success: false,
      message: 'priority must be one of: LOW, MEDIUM, HIGH, URGENT',
      error: { code: 'INVALID_INPUT' },
    });
  }

  next();
};

export const validateTaskCompletion = (req: Request, res: Response, next: NextFunction) => {
  const verificationOutcome = req.body.verificationOutcome ?? req.body.verification_outcome;
  const actualAmount = req.body.actualAmount ?? req.body.actual_amount;
  const completionNotes = req.body.completionNotes ?? req.body.completion_notes;
  const formSubmissionId = req.body.formSubmissionId ?? req.body.form_submission_id;

  // Required field validation
  if (!verificationOutcome) {
    return res.status(400).json({
      success: false,
      message: 'verificationOutcome is required',
      error: { code: 'INVALID_INPUT' },
    });
  }

  if (typeof verificationOutcome !== 'string' || verificationOutcome.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'verificationOutcome must be a non-empty string',
      error: { code: 'INVALID_INPUT' },
    });
  }

  // Optional field validation
  if (actualAmount !== undefined) {
    if (typeof actualAmount !== 'number' || actualAmount < 0) {
      return res.status(400).json({
        success: false,
        message: 'actualAmount must be a positive number',
        error: { code: 'INVALID_INPUT' },
      });
    }
  }

  if (completionNotes !== undefined) {
    if (typeof completionNotes !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'completionNotes must be a string',
        error: { code: 'INVALID_INPUT' },
      });
    }

    if (completionNotes.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'completionNotes must be 1000 characters or less',
        error: { code: 'INVALID_INPUT' },
      });
    }
  }

  if (formSubmissionId !== undefined && typeof formSubmissionId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'formSubmissionId must be a string',
      error: { code: 'INVALID_INPUT' },
    });
  }

  next();
};

// Helper functions
function isValidPriority(priority: string): priority is TaskPriority {
  return ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority);
}

function isValidStatus(status: string): status is TaskStatus {
  return ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REVOKED', 'ON_HOLD'].includes(status);
}

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}
