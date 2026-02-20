/* eslint-disable camelcase */
// Disabled camelcase rule for this file as it uses snake_case for request body properties
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

    // Required fields validation
    if (!task.verification_type_id) {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: verification_type_id is required`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    if (!task.task_title || task.task_title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: task_title is required`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    // Type validation
    if (typeof task.verification_type_id !== 'number') {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: verification_type_id must be a number`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    if (typeof task.task_title !== 'string') {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: task_title must be a string`,
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

    if (
      task.estimated_amount &&
      (typeof task.estimated_amount !== 'number' || task.estimated_amount < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: estimated_amount must be a positive number`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    if (task.rate_type_id && typeof task.rate_type_id !== 'number') {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: rate_type_id must be a number`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    // String length validation
    if (task.task_title.length > 255) {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: task_title must be 255 characters or less`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    if (task.task_description && task.task_description.length > 1000) {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: task_description must be 1000 characters or less`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    // Date validation
    if (task.estimated_completion_date && !isValidDate(task.estimated_completion_date)) {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: estimated_completion_date must be a valid date`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }

    // Document details validation
    if (task.document_details && typeof task.document_details !== 'object') {
      return res.status(400).json({
        success: false,
        message: `Task ${taskIndex}: document_details must be an object`,
        error: { code: 'INVALID_TASK_DATA' },
      });
    }
  }

  next();
};

export const validateTaskUpdate = (req: Request, res: Response, next: NextFunction) => {
  const updateData = req.body;

  // Check if at least one field is provided
  const allowedFields = [
    'task_title',
    'task_description',
    'priority',
    'status',
    'verification_outcome',
    'actual_amount',
    'address',
    'pincode',
    'document_type',
    'document_number',
    'document_details',
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

  // Validate individual fields
  if (updateData.task_title !== undefined) {
    if (typeof updateData.task_title !== 'string' || updateData.task_title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'task_title must be a non-empty string',
        error: { code: 'INVALID_INPUT' },
      });
    }

    if (updateData.task_title.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'task_title must be 255 characters or less',
        error: { code: 'INVALID_INPUT' },
      });
    }
  }

  if (updateData.task_description !== undefined) {
    if (typeof updateData.task_description !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'task_description must be a string',
        error: { code: 'INVALID_INPUT' },
      });
    }

    if (updateData.task_description.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'task_description must be 1000 characters or less',
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

  if (updateData.actual_amount !== undefined) {
    if (typeof updateData.actual_amount !== 'number' || updateData.actual_amount < 0) {
      return res.status(400).json({
        success: false,
        message: 'actual_amount must be a positive number',
        error: { code: 'INVALID_INPUT' },
      });
    }
  }

  if (
    updateData.estimated_completion_date !== undefined &&
    !isValidDate(updateData.estimated_completion_date)
  ) {
    return res.status(400).json({
      success: false,
      message: 'estimated_completion_date must be a valid date',
      error: { code: 'INVALID_INPUT' },
    });
  }

  if (
    updateData.document_details !== undefined &&
    typeof updateData.document_details !== 'object'
  ) {
    return res.status(400).json({
      success: false,
      message: 'document_details must be an object',
      error: { code: 'INVALID_INPUT' },
    });
  }

  next();
};

export const validateTaskAssignment = (req: Request, res: Response, next: NextFunction) => {
  const { assigned_to, assignment_reason, priority } = req.body;

  // Required field validation
  if (!assigned_to) {
    return res.status(400).json({
      success: false,
      message: 'assigned_to is required',
      error: { code: 'INVALID_INPUT' },
    });
  }

  if (typeof assigned_to !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'assigned_to must be a string (user ID)',
      error: { code: 'INVALID_INPUT' },
    });
  }

  // Optional field validation
  if (assignment_reason !== undefined) {
    if (typeof assignment_reason !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'assignment_reason must be a string',
        error: { code: 'INVALID_INPUT' },
      });
    }

    if (assignment_reason.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'assignment_reason must be 500 characters or less',
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
  const { verification_outcome, actual_amount, completion_notes, form_submission_id } = req.body;

  // Required field validation
  if (!verification_outcome) {
    return res.status(400).json({
      success: false,
      message: 'verification_outcome is required',
      error: { code: 'INVALID_INPUT' },
    });
  }

  if (typeof verification_outcome !== 'string' || verification_outcome.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'verification_outcome must be a non-empty string',
      error: { code: 'INVALID_INPUT' },
    });
  }

  // Optional field validation
  if (actual_amount !== undefined) {
    if (typeof actual_amount !== 'number' || actual_amount < 0) {
      return res.status(400).json({
        success: false,
        message: 'actual_amount must be a positive number',
        error: { code: 'INVALID_INPUT' },
      });
    }
  }

  if (completion_notes !== undefined) {
    if (typeof completion_notes !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'completion_notes must be a string',
        error: { code: 'INVALID_INPUT' },
      });
    }

    if (completion_notes.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'completion_notes must be 1000 characters or less',
        error: { code: 'INVALID_INPUT' },
      });
    }
  }

  if (form_submission_id !== undefined && typeof form_submission_id !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'form_submission_id must be a string',
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
