import { query } from '../config/database';
import logger from '../utils/logger';

// Photo requirements by verification type
const PHOTO_REQUIREMENTS: Record<string, { min: number; required: string[] }> = {
  BUSINESS: { min: 6, required: ['storefront', 'interior', 'nameplate'] },
  RESIDENCE: { min: 4, required: ['building', 'door'] },
  OFFICE: { min: 6, required: ['building', 'office_interior', 'nameplate'] },
  RESIDENCE_CUM_OFFICE: { min: 6, required: ['building', 'door', 'office_area'] },
  BUILDER: { min: 6, required: ['site', 'construction'] },
  NOC: { min: 4, required: ['premises'] },
  DSA_CONNECTOR: { min: 4, required: ['meeting_photo'] },
  PROPERTY_APF: { min: 6, required: ['property_exterior', 'property_interior'] },
  PROPERTY_INDIVIDUAL: { min: 6, required: ['property_exterior', 'property_interior'] },
};

// Valid outcomes by verification type
const VALID_OUTCOMES: Record<string, string[]> = {
  BUSINESS: ['POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED', 'UNTRACEABLE'],
  RESIDENCE: ['POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED', 'UNTRACEABLE'],
  OFFICE: ['POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED', 'UNTRACEABLE'],
  RESIDENCE_CUM_OFFICE: ['POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED', 'UNTRACEABLE'],
  BUILDER: ['POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED', 'UNTRACEABLE'],
  NOC: ['POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED', 'UNTRACEABLE'],
  DSA_CONNECTOR: ['POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED', 'UNTRACEABLE'],
  PROPERTY_APF: ['POSITIVE', 'ENTRY_RESTRICTED', 'UNTRACEABLE'],
  PROPERTY_INDIVIDUAL: ['POSITIVE', 'NSP', 'ENTRY_RESTRICTED', 'UNTRACEABLE'],
};

// Valid status transitions
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ASSIGNED', 'REVOKED'],
  ASSIGNED: ['IN_PROGRESS', 'REVOKED'],
  IN_PROGRESS: ['COMPLETED', 'ON_HOLD', 'REVOKED'],
  ON_HOLD: ['IN_PROGRESS', 'REVOKED'],
  COMPLETED: [], // Terminal state
  REVOKED: [], // Terminal state
  SAVED: ['IN_PROGRESS', 'REVOKED'],
};

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

import { VerificationTaskRow } from '../types/database';

interface TaskDetails extends VerificationTaskRow {
  verificationTypeName: string;
}

export class TaskCompletionValidator {
  /**
   * Main validation method - checks all requirements for task completion
   */
  static async validateTaskCompletion(
    taskId: string,
    verificationType: string,
    verificationOutcome: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    logger.info('Validating task completion', { taskId, verificationType, verificationOutcome });

    try {
      // 1. Validate form submission exists
      const hasForm = await this.validateFormSubmissionExists(taskId);
      if (!hasForm) {
        errors.push(
          'Form submission not found. Please submit the verification form before completing the task.'
        );
      }

      // 2. Validate minimum photos
      const photoValidation = await this.validatePhotos(taskId, verificationType);
      if (!photoValidation.isValid) {
        errors.push(...photoValidation.errors);
      }
      if (photoValidation.warnings.length > 0) {
        warnings.push(...photoValidation.warnings);
      }

      // 3. Validate report data exists
      const hasReport = await this.validateReportExists(taskId, verificationType);
      if (!hasReport) {
        errors.push('Report data not saved. Please ensure all form data is properly submitted.');
      }

      // 4. Validate outcome is valid for verification type
      const outcomeValidation = this.validateOutcome(verificationType, verificationOutcome);
      if (!outcomeValidation.isValid) {
        errors.push(...outcomeValidation.errors);
      }

      // 5. Get task details for additional validation
      const task = await this.getTaskDetails(taskId);
      if (!task) {
        errors.push('Task not found');
        return { isValid: false, errors, warnings };
      }

      // 6. Validate task is started
      const startedValidation = this.validateTaskStarted(task);
      if (!startedValidation.isValid) {
        errors.push(...startedValidation.errors);
      }

      // 7. Validate status transition
      const transitionValidation = this.validateStatusTransition(task.status, 'COMPLETED');
      if (!transitionValidation.isValid) {
        errors.push(...transitionValidation.errors);
      }

      logger.info('Task completion validation result', {
        taskId,
        isValid: errors.length === 0,
        errorCount: errors.length,
        warningCount: warnings.length,
      });

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      logger.error('Error during task completion validation', { taskId, error });
      return {
        isValid: false,
        errors: ['Validation failed due to internal error. Please try again.'],
        warnings,
      };
    }
  }

  /**
   * Check if form submission exists for this task
   */
  private static async validateFormSubmissionExists(taskId: string): Promise<boolean> {
    try {
      const result = await query(
        `SELECT COUNT(*) as count FROM mobile_form_submissions WHERE verification_task_id = $1`,
        [taskId]
      );
      return parseInt(result.rows[0]?.count || '0') > 0;
    } catch (error) {
      logger.error('Error checking form submission', { taskId, error });
      return false;
    }
  }

  /**
   * Validate minimum photos are uploaded
   */
  private static async validatePhotos(
    taskId: string,
    verificationType: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const result = await query(
        `
        SELECT COUNT(*) as count, array_agg(DISTINCT attachment_type) as types
        FROM verification_attachments
        WHERE verification_task_id = $1
      `,
        [taskId]
      );

      const photoCount = parseInt(result.rows[0]?.count || '0');
      const photoTypes = result.rows[0]?.types || [];

      const requirement = PHOTO_REQUIREMENTS[verificationType];
      if (!requirement) {
        warnings.push(`No photo requirements defined for ${verificationType}`);
        return { isValid: true, errors, warnings };
      }

      // Check minimum count
      if (photoCount < requirement.min) {
        errors.push(
          `Minimum ${requirement.min} photos required for ${verificationType}. Currently uploaded: ${photoCount}`
        );
      }

      // Check required photo types (soft validation - warning only)
      const missingTypes = requirement.required.filter(type => !photoTypes.includes(type));
      if (missingTypes.length > 0) {
        warnings.push(`Recommended photo types missing: ${missingTypes.join(', ')}`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      logger.error('Error validating photos', { taskId, error });
      return {
        isValid: false,
        errors: ['Failed to validate photos'],
        warnings,
      };
    }
  }

  /**
   * Check if report data exists in the appropriate table
   */
  private static async validateReportExists(
    taskId: string,
    verificationType: string
  ): Promise<boolean> {
    try {
      const tableName = this.getReportTableName(verificationType);
      if (!tableName) {
        logger.warn('No report table defined for verification type', { verificationType });
        return true; // Don't fail if no table mapping exists
      }

      const result = await query(
        `SELECT COUNT(*) as count FROM "${tableName}" WHERE verification_task_id = $1`,
        [taskId]
      );

      return parseInt(result.rows[0]?.count || '0') > 0;
    } catch (error) {
      logger.error('Error checking report data', { taskId, verificationType, error });
      return false;
    }
  }

  /**
   * Get report table name for verification type
   */
  private static getReportTableName(verificationType: string): string | null {
    const typeUpper = verificationType.toUpperCase();

    if (typeUpper.includes('RESIDENCE') && typeUpper.includes('OFFICE')) {
      return 'residenceCumOfficeVerificationReports';
    }
    if (typeUpper.includes('RESIDENCE')) {
      return 'residenceVerificationReports';
    }
    if (typeUpper.includes('OFFICE')) {
      return 'officeVerificationReports';
    }
    if (typeUpper.includes('BUSINESS')) {
      return 'businessVerificationReports';
    }
    if (typeUpper.includes('BUILDER')) {
      return 'builderVerificationReports';
    }
    if (typeUpper.includes('NOC')) {
      return 'nocVerificationReports';
    }
    if (typeUpper.includes('DSA') || typeUpper.includes('CONNECTOR')) {
      return 'dsaConnectorVerificationReports';
    }
    if (typeUpper.includes('PROPERTY') && typeUpper.includes('APF')) {
      return 'propertyApfVerificationReports';
    }
    if (typeUpper.includes('PROPERTY') && typeUpper.includes('INDIVIDUAL')) {
      return 'propertyIndividualVerificationReports';
    }

    return null;
  }

  /**
   * Validate verification outcome is valid for the verification type
   */
  private static validateOutcome(verificationType: string, outcome: string): ValidationResult {
    const errors: string[] = [];

    const validOutcomes = VALID_OUTCOMES[verificationType];
    if (!validOutcomes) {
      errors.push(`Unknown verification type: ${verificationType}`);
      return { isValid: false, errors, warnings: [] };
    }

    if (!validOutcomes.includes(outcome)) {
      errors.push(
        `Invalid outcome '${outcome}' for ${verificationType}. Valid outcomes: ${validOutcomes.join(', ')}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  /**
   * Get task details
   */
  private static async getTaskDetails(taskId: string): Promise<TaskDetails | null> {
    try {
      const result = await query(
        `
        SELECT vt.*, vtype.name as verification_type_name
        FROM verification_tasks vt
        LEFT JOIN verification_types vtype ON vt.verification_type_id = vtype.id
        WHERE vt.id = $1
      `,
        [taskId]
      );

      return (result.rows[0] as unknown as TaskDetails) || null;
    } catch (error) {
      logger.error('Error getting task details', { taskId, error });
      return null;
    }
  }

  /**
   * Validate task is started before completion
   */
  private static validateTaskStarted(task: TaskDetails): ValidationResult {
    const errors: string[] = [];

    if (!task.startedAt) {
      errors.push('Task must be started before it can be completed');
    }

    if (task.status !== 'IN_PROGRESS') {
      errors.push(`Task must be IN_PROGRESS to complete. Current status: ${task.status}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  /**
   * Validate status transition is allowed
   */
  private static validateStatusTransition(
    currentStatus: string,
    newStatus: string
  ): ValidationResult {
    const errors: string[] = [];

    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
    if (!allowedTransitions) {
      errors.push(`Unknown current status: ${currentStatus}`);
      return { isValid: false, errors, warnings: [] };
    }

    if (!allowedTransitions.includes(newStatus)) {
      errors.push(
        `Invalid status transition: ${currentStatus} → ${newStatus}. ` +
          `Allowed transitions: ${allowedTransitions.join(', ') || 'none (terminal state)'}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  /**
   * Validate task can be updated to a new status
   */
  static async validateStatusUpdate(taskId: string, newStatus: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const task = await this.getTaskDetails(taskId);
      if (!task) {
        errors.push('Task not found');
        return { isValid: false, errors, warnings };
      }

      // Validate transition
      const transitionValidation = this.validateStatusTransition(task.status, newStatus);
      if (!transitionValidation.isValid) {
        errors.push(...transitionValidation.errors);
      }

      // If transitioning to COMPLETED, run full validation
      if (newStatus === 'COMPLETED') {
        const completionValidation = await this.validateTaskCompletion(
          taskId,
          task.verificationTypeName,
          task.verificationOutcome || 'POSITIVE'
        );
        errors.push(...completionValidation.errors);
        warnings.push(...completionValidation.warnings);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      logger.error('Error validating status update', { taskId, newStatus, error });
      return {
        isValid: false,
        errors: ['Status validation failed due to internal error'],
        warnings,
      };
    }
  }
}
