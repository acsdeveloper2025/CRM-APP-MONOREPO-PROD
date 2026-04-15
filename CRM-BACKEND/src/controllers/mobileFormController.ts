import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { MobileFormSubmissionRequest, FormSubmissionData, FormSection } from '../types/mobile';
import type {
  QueryParams,
  WhereClause,
  DynamicFormData,
  VerificationTaskRow,
  ResidenceVerificationRow,
  OfficeVerificationRow,
  BusinessVerificationRow,
} from '../types/database';
import { isFieldExecutionActor, userHasPermission } from '../security/rbacAccess';
import { buildInsert } from '../utils/rowTransform';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role?: string;
    permissionCodes?: string[];
    email?: string;
    name?: string;
  };
}

type VerificationImageRecord = {
  id: string;
  filename: string;
  url: string;
  thumbnailUrl: string;
  uploadedAt: string;
  photoType: string;
  geoLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp?: string;
  };
};

import { createAuditLog } from '../utils/auditLogger';
import {
  detectResidenceFormType,
  detectOfficeFormType,
  detectBusinessFormType,
  detectPropertyIndividualFormType,
  detectResidenceCumOfficeFormType,
} from '../utils/formTypeDetection';
// import {
//   mapFormDataToDatabase,
//   validateRequiredFields,
//   getAvailableDbColumns,
// } from '../utils/residenceFormFieldMapping';
import {
  validateAndPrepareResidenceForm,
  generateFieldCoverageReport,
} from '../utils/residenceFormValidator';
import {
  validateAndPrepareOfficeForm,
  generateOfficeFieldCoverageReport,
} from '../utils/officeFormValidator';
import {
  validateAndPrepareBusinessForm,
  generateBusinessFieldCoverageReport,
} from '../utils/businessFormValidator';
import { validateAndPrepareResidenceCumOfficeForm } from '../utils/residenceCumOfficeFormValidator';
import {
  validateAndPrepareBuilderForm,
  generateBuilderFieldCoverageReport,
} from '../utils/builderFormValidator';
import {
  validateAndPrepareNocForm,
  generateNocFieldCoverageReport,
} from '../utils/nocFormValidator';
import {
  validateAndPreparePropertyApfForm,
  generatePropertyApfFieldCoverageReport,
} from '../utils/propertyApfFormValidator';
import { validateAndPreparePropertyIndividualForm } from '../utils/propertyIndividualFormValidator';
import {
  validateAndPrepareDsaConnectorForm,
  generateDsaConnectorFieldCoverageReport,
} from '../utils/dsaConnectorFormValidator';
import {
  mapOfficeFormDataToDatabase as _mapOfficeFormDataToDatabase,
  validateOfficeRequiredFields,
  getOfficeAvailableDbColumns as _getOfficeAvailableDbColumns,
} from '../utils/officeFormFieldMapping';
import {
  mapBusinessFormDataToDatabase as _mapBusinessFormDataToDatabase,
  validateBusinessRequiredFields,
  getBusinessAvailableDbColumns as _getBusinessAvailableDbColumns,
} from '../utils/businessFormFieldMapping';
import {
  createComprehensiveFormSections,
  getFormFieldDefinitions,
  // getFormTypeLabel,
  // getVerificationTableName,
} from '../utils/comprehensiveFormFieldMapping';
import {
  mapBuilderFormDataToDatabase as _mapBuilderFormDataToDatabase,
  validateBuilderRequiredFields as _validateBuilderRequiredFields,
  getBuilderAvailableDbColumns as _getBuilderAvailableDbColumns,
} from '../utils/builderFormFieldMapping';
import {
  mapResidenceCumOfficeFormDataToDatabase as _mapResidenceCumOfficeFormDataToDatabase,
  validateResidenceCumOfficeRequiredFields as _validateResidenceCumOfficeRequiredFields,
  getResidenceCumOfficeAvailableDbColumns as _getResidenceCumOfficeAvailableDbColumns,
} from '../utils/residenceCumOfficeFormFieldMapping';
import {
  mapNocFormDataToDatabase as _mapNocFormDataToDatabase,
  validateNocRequiredFields as _validateNocRequiredFields,
  getNocAvailableDbColumns as _getNocAvailableDbColumns,
} from '../utils/nocFormFieldMapping';
import {
  mapPropertyApfFormDataToDatabase as _mapPropertyApfFormDataToDatabase,
  validatePropertyApfRequiredFields as _validatePropertyApfRequiredFields,
  getPropertyApfAvailableDbColumns as _getPropertyApfAvailableDbColumns,
} from '../utils/propertyApfFormFieldMapping';
import {
  mapPropertyIndividualFormDataToDatabase as _mapPropertyIndividualFormDataToDatabase,
  validatePropertyIndividualRequiredFields as _validatePropertyIndividualRequiredFields,
  getPropertyIndividualAvailableDbColumns as _getPropertyIndividualAvailableDbColumns,
} from '../utils/propertyIndividualFormFieldMapping';
import {
  mapDsaConnectorFormDataToDatabase as _mapDsaConnectorFormDataToDatabase,
  validateDsaConnectorRequiredFields as _validateDsaConnectorRequiredFields,
  getDsaConnectorAvailableDbColumns as _getDsaConnectorAvailableDbColumns,
} from '../utils/dsaConnectorFormFieldMapping';
import { query, withTransaction } from '@/config/database';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { queueCaseCompletionNotification } from '../queues/notificationQueue';
import { logger } from '../utils/logger';
import { CaseStatusSyncService } from '../services/caseStatusSyncService';
import { MobileOperationService } from '@/services/mobileOperationService';
// Enhanced services temporarily disabled for debugging

export class MobileFormController {
  /**
   * Combines composite Value+Unit field pairs into single fields.
   * Mobile sends: stayingPeriodValue: "5", stayingPeriodUnit: "Years"
   * Backend needs: stayingPeriod: "5 Years"
   */
  private static preprocessCompositeFields(
    formData: Record<string, unknown>
  ): Record<string, unknown> {
    const compositeFieldPairs = [
      { value: 'stayingPeriodValue', unit: 'stayingPeriodUnit', target: 'stayingPeriod' },
      { value: 'businessPeriodValue', unit: 'businessPeriodUnit', target: 'businessPeriod' },
      {
        value: 'establishmentPeriodValue',
        unit: 'establishmentPeriodUnit',
        target: 'establishmentPeriod',
      },
      {
        value: 'currentCompanyPeriodValue',
        unit: 'currentCompanyPeriodUnit',
        target: 'currentCompanyPeriod',
      },
      {
        value: 'oldOfficeShiftedPeriodValue',
        unit: 'oldOfficeShiftedPeriodUnit',
        target: 'oldOfficeShiftedPeriod',
      },
      {
        value: 'oldBusinessShiftedPeriodValue',
        unit: 'oldBusinessShiftedPeriodUnit',
        target: 'oldBusinessShiftedPeriod',
      },
      { value: 'shiftedPeriodValue', unit: 'shiftedPeriodUnit', target: 'shiftedPeriod' },
      { value: 'workingPeriodValue', unit: 'workingPeriodUnit', target: 'workingPeriod' },
    ];

    const processed = { ...formData };

    for (const pair of compositeFieldPairs) {
      const val = processed[pair.value];
      const unit = processed[pair.unit];

      if (val !== undefined && val !== null && val !== '') {
        // Combine value + unit into target field (e.g., "5 Years")
        processed[pair.target] = unit
          ? `${String(val as string | number)} ${String(unit as string | number)}`
          : String(val as string | number);
        // Remove the separate fields so they don't get mapped individually
        delete processed[pair.value];
        delete processed[pair.unit];
      }
    }

    // Also handle totalEarning → totalEarningMember alias
    if (processed.totalEarning !== undefined && processed.totalEarningMember === undefined) {
      processed.totalEarningMember = processed.totalEarning;
    }
    delete processed.totalEarning;

    return processed;
  }

  private static getOperationId(req: Request): string | null {
    const headerValue = req.header('Idempotency-Key');
    if (!headerValue) {
      return null;
    }
    const trimmed = headerValue.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private static async recordFormOperation(
    req: Request,
    taskId: string,
    formType: string,
    payload: unknown
  ): Promise<void> {
    const operationId = MobileFormController.getOperationId(req);
    if (!operationId) {
      return;
    }

    await MobileOperationService.recordOperation({
      operationId,
      type: 'FORM_SUBMITTED',
      entityType: 'FORM',
      entityId: taskId,
      payload: {
        formType,
        data: payload,
      },
      retryCount: Number((req.body as { retryCount?: number })?.retryCount || 0),
    });
  }

  /**
   * Enforce assignment ownership for execution actors only.
   * Supervisory users keep existing behavior.
   */
  private static assertAssignedExecutionActor(
    assignedTo: string | null | undefined,
    userId: string,
    user?: AuthenticatedRequest['user']
  ): { status: number; message: string; code: string } | null {
    if (!isFieldExecutionActor(user as never)) {
      return null;
    }

    if (assignedTo !== userId) {
      return {
        status: 403,
        message: 'Task not assigned to user',
        code: 'TASK_NOT_ASSIGNED_TO_USER',
      };
    }

    return null;
  }

  /**
   * Helper method to validate task submission rules (Stage-2C Strict Logic)
   */
  private static async validateTaskSubmission(
    taskId: string,
    userId: string,
    user?: AuthenticatedRequest['user']
  ): Promise<{
    success: boolean;
    data?: {
      taskId: string;
      caseId: string;
      caseNumber: number | null;
      taskNumber: string;
      verificationTypeName: string | null;
    };
    error?: { status: number; message: string; code: string };
  }> {
    try {
      if (!userHasPermission(user as never, 'visit.submit')) {
        return {
          success: false,
          error: {
            status: 403,
            message: 'Missing required permission: visit.submit',
            code: 'PERMISSION_DENIED',
          },
        };
      }

      // 1. Fetch Task & Case Info
      const taskQuery = await query(
        `SELECT 
                vt.id, 
                vt.case_id, 
                vt.task_number,
                vt.status,
                c.case_id as case_number, 
                vt.assigned_to,
                vtype.name as verification_type_name
             FROM verification_tasks vt
             JOIN cases c ON vt.case_id = c.id
             LEFT JOIN verification_types vtype ON vt.verification_type_id = vtype.id
             WHERE vt.id = $1`,
        [taskId]
      );

      if (taskQuery.rows.length === 0) {
        return {
          success: false,
          error: { status: 400, message: 'Invalid Task ID', code: 'INVALID_TASK_ID' },
        };
      }

      const task = taskQuery.rows[0];

      if (task.status === 'REVOKED') {
        return {
          success: false,
          error: {
            status: 403,
            message: 'Task has been revoked',
            code: 'TASK_REVOKED',
          },
        };
      }

      // Block submission only if task is REVOKED (not COMPLETED — allow resubmission)
      if (task.status === 'REVOKED') {
        return {
          success: false,
          error: {
            status: 409,
            message: 'Task is revoked. Submission is not allowed.',
            code: 'TASK_SUPERSEDED_OR_REVOKED',
          },
        };
      }

      const childTaskQuery = await query(
        `SELECT 1 FROM verification_tasks WHERE parent_task_id = $1 LIMIT 1`,
        [taskId]
      );
      if (childTaskQuery.rows.length > 0) {
        return {
          success: false,
          error: {
            status: 409,
            message: 'Task is superseded or revoked. Submission is not allowed.',
            code: 'TASK_SUPERSEDED_OR_REVOKED',
          },
        };
      }

      // 2. Assignment Validation (field-agent ownership)
      const assignmentError = MobileFormController.assertAssignedExecutionActor(
        task.assignedTo,
        userId,
        user
      );
      if (assignmentError) {
        return {
          success: false,
          error: assignmentError,
        };
      }

      // 3. Location validation removed — GPS is captured in photo watermarks (source of truth)

      // 4. Duplicate Submission Check — allow resubmission (previous data will be updated)
      const subQuery = await query(
        `SELECT id FROM task_form_submissions WHERE verification_task_id = $1`,
        [taskId]
      );
      // Flag for handlers to know if this is a resubmission
      const _isResubmission = subQuery.rows.length > 0;

      return {
        success: true,
        data: {
          taskId: task.id,
          caseId: task.caseId,
          caseNumber: task.caseNumber || null,
          taskNumber: task.taskNumber,
          verificationTypeName: task.verificationTypeName,
        },
      };
    } catch (error) {
      logger.error('Task submission validation error:', error);
      return {
        success: false,
        error: { status: 500, message: 'Internal validation error', code: 'VALIDATION_ERROR' },
      };
    }
  }

  /**
   * Helper method to resolve caseId from verificationTaskId
   * This supports the new verificationTaskId-based flow
   */
  private static async resolveCaseIdFromTaskId(
    taskId: string,
    userId: string,
    user?: AuthenticatedRequest['user']
  ): Promise<{
    success: boolean;
    caseId?: string;
    task?: VerificationTaskRow;
    error?: { status: number; message: string; code: string };
  }> {
    // Legacy resolver kept for backward compatibility if needed,
    // but validateTaskSubmission is preferred for strict flow.
    try {
      // Step 1: Query verificationTasks table to get caseId
      const taskQuery = await query(
        `SELECT 
          vt.id,
          vt.case_id as case_id,
          vt.task_number as "task_number",
          vt.status,
          vt.assigned_to as assigned_to,
          vtype.name as verification_type_name,
          vtype.id as verification_type_id
         FROM verification_tasks vt
         LEFT JOIN verification_types vtype ON vt.verification_type_id = vtype.id
         WHERE vt.id = $1`,
        [taskId]
      );

      if (taskQuery.rows.length === 0) {
        return {
          success: false,
          error: {
            status: 404,
            message: 'Verification task not found',
            code: 'TASK_NOT_FOUND',
          },
        };
      }

      const task = taskQuery.rows[0];

      if (task.status === 'REVOKED') {
        return {
          success: false,
          error: {
            status: 403,
            message: 'Task has been revoked',
            code: 'TASK_REVOKED',
          },
        };
      }

      // Step 2: Block superseded/completed tasks
      if (task.status === 'COMPLETED') {
        return {
          success: false,
          error: {
            status: 409,
            message: 'Task is superseded or revoked. Submission is not allowed.',
            code: 'TASK_SUPERSEDED_OR_REVOKED',
          },
        };
      }

      const childTaskQuery = await query(
        `SELECT 1 FROM verification_tasks WHERE parent_task_id = $1 LIMIT 1`,
        [taskId]
      );
      if (childTaskQuery.rows.length > 0) {
        return {
          success: false,
          error: {
            status: 409,
            message: 'Task is superseded or revoked. Submission is not allowed.',
            code: 'TASK_SUPERSEDED_OR_REVOKED',
          },
        };
      }

      // Step 3: Verify field-agent ownership (non-field roles unchanged)
      const assignmentError = MobileFormController.assertAssignedExecutionActor(
        task.assignedTo,
        userId,
        user
      );
      if (assignmentError) {
        return {
          success: false,
          error: assignmentError,
        };
      }

      // Step 4: Return resolved caseId and task info
      return {
        success: true,
        caseId: task.caseId,
        task,
      };
    } catch (error) {
      logger.error('Error resolving case_id from task_id:', error);
      return {
        success: false,
        error: {
          status: 500,
          message: 'Failed to resolve case from verification task',
          code: 'TASK_RESOLUTION_FAILED',
        },
      };
    }
  }
  /**
   * Helper function to send case completion notifications to backend users
   */
  private static async sendCaseCompletionNotification(
    caseId: string,
    caseNumber: string,
    customerName: string,
    fieldUserId: string,
    completionStatus: string,
    outcome: string
  ): Promise<void> {
    try {
      // Get field user information
      const fieldUserQuery = `
        SELECT name, employee_id FROM users WHERE id = $1
      `;
      const fieldUserResult = await query(fieldUserQuery, [fieldUserId]);
      const fieldUserName = fieldUserResult.rows[0]?.name || 'Unknown User';

      // Get users who should receive case completion notifications by RBAC permissions
      const notificationUsersQuery = `
        SELECT DISTINCT u.id
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN role_permissions rp ON rp.role_id = ur.role_id AND rp.allowed = true
        JOIN permissions p ON p.id = rp.permission_id
        WHERE u.is_active = true
          AND p.code IN ('report.generate', 'report.download', 'review.view')
      `;
      const notificationUsersResult = await query(notificationUsersQuery);
      const notificationUserIds = notificationUsersResult.rows.map(row => row.id);

      if (notificationUserIds.length > 0) {
        // Queue case completion notification
        await queueCaseCompletionNotification({
          caseId,
          caseNumber,
          customerName,
          fieldUserId,
          fieldUserName,
          completionStatus,
          outcome,
          backendUserIds: notificationUserIds, // Keep the same parameter name for compatibility
        });

        logger.info('Case completion notification queued', {
          caseId,
          caseNumber,
          fieldUserId,
          fieldUserName,
          backendUserCount: notificationUserIds.length,
        });
      }
    } catch (error) {
      logger.error('Failed to send case completion notification:', error);
      // Don't throw error to avoid breaking the main form submission flow
    }
  }

  /**
   * Process and store verification images separately from case attachments
   */
  private static countSubmissionPhotos(
    photos: Array<{ geoLocation?: { latitude?: number; longitude?: number } }> = [],
    images: Array<{ dataUrl: string }> = [],
    attachmentIds: string[] = []
  ): number {
    if (images.length > 0) {
      return images.length;
    }

    if (attachmentIds.length > 0) {
      return attachmentIds.length;
    }

    return photos.length;
  }

  private static async getReferencedVerificationImages(
    attachmentIds: string[] = []
  ): Promise<VerificationImageRecord[]> {
    if (!attachmentIds.length) {
      return [];
    }

    // attachment IDs from mobile are UUIDs but may also be stored as submissionId or filename references.
    // Query by submissionId (UUID) which is what the mobile sends, falling back to string match.
    const attachmentResult = await query(
      `SELECT id, filename, file_path, thumbnail_path, created_at, photo_type, geo_location
       FROM verification_attachments
       WHERE submission_id = ANY($1::text[])
          OR filename = ANY($1::text[])
       ORDER BY created_at ASC`,
      [attachmentIds]
    );

    return attachmentResult.rows.map(row => {
      let geoLocation = row.geoLocation;
      if (typeof geoLocation === 'string') {
        try {
          geoLocation = JSON.parse(geoLocation);
        } catch {
          geoLocation = undefined;
        }
      }

      return {
        id: row.id,
        filename: row.filename,
        url: row.filePath,
        thumbnailUrl: row.thumbnailPath,
        uploadedAt: row.createdAt.toISOString(),
        photoType: row.photoType,
        geoLocation,
      };
    });
  }

  private static async countTaskAttachments(
    taskId: string
  ): Promise<{ totalImages: number; totalSelfies: number }> {
    const result = await query(
      `SELECT
        COUNT(*) FILTER (WHERE photo_type = 'verification') as total_images,
        COUNT(*) FILTER (WHERE photo_type = 'selfie') as total_selfies
       FROM verification_attachments WHERE verification_task_id = $1`,
      [taskId]
    );
    return {
      totalImages: parseInt(result.rows[0]?.totalImages || '0', 10),
      totalSelfies: parseInt(result.rows[0]?.totalSelfies || '0', 10),
    };
  }

  private static async processVerificationImages(
    images: Array<{
      dataUrl: string;
      type: string;
      geoLocation?: {
        latitude: number;
        longitude: number;
        accuracy?: number;
        timestamp?: string;
      };
    }>,
    caseId: string,
    verificationType: string,
    submissionId: string,
    userId: string,
    verificationTaskId?: string, // ✅ Optional for backward compatibility
    attachmentIds: string[] = []
  ): Promise<VerificationImageRecord[]> {
    const uploadedImages: VerificationImageRecord[] = [];

    if (!images || images.length === 0) {
      return MobileFormController.getReferencedVerificationImages(attachmentIds);
    }

    // Create upload directory for verification images
    const uploadDir = path.join(
      process.cwd(),
      'uploads',
      'verification',
      verificationType.toLowerCase(),
      caseId
    );

    await fs.mkdir(uploadDir, { recursive: true });

    // Create thumbnails directory
    const thumbnailDir = path.join(uploadDir, 'thumbnails');
    await fs.mkdir(thumbnailDir, { recursive: true });

    for (let i = 0; i < images.length; i++) {
      const image = images[i];

      try {
        // Generate unique filename
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1e9);
        const photoType = image.type || 'verification';
        const extension = '.jpg'; // Convert all to JPEG for consistency
        const filename = `${photoType}_${timestamp}_${randomSuffix}${extension}`;
        const filePath = path.join(uploadDir, filename);
        const thumbnailPath = path.join(thumbnailDir, `thumb_${filename}`);

        // Convert base64 to buffer and save
        const base64Data = image.dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Save original image
        await fs.writeFile(filePath, imageBuffer);

        // Generate thumbnail
        await sharp(imageBuffer)
          .resize(200, 200, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath);

        // Save to verification_attachments table.
        //
        // CRITICAL FIX: the prior INSERT listed `case_id` twice in
        // the column list and passed 14 values for 13 distinct
        // columns. Postgres rejects this at parse time with
        // `column "case_id" specified more than once`, so the
        // entire mobile form image-upload path was broken. Removed
        // the duplicate column and the stale "will be set later"
        // null placeholder.
        const attachmentResult = await query(
          `INSERT INTO verification_attachments (
            case_id, verification_type, verification_task_id, filename, original_name,
            mime_type, file_size, file_path, thumbnail_path, uploaded_by,
            geo_location, photo_type, submission_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id, filename, file_path, thumbnail_path, created_at`,
          [
            caseId,
            verificationType,
            verificationTaskId || null, // ✅ Link to verification task
            filename,
            `${photoType}_image_${i + 1}.jpg`,
            'image/jpeg',
            imageBuffer.length,
            `/uploads/verification/${verificationType.toLowerCase()}/${caseId}/${filename}`,
            `/uploads/verification/${verificationType.toLowerCase()}/${caseId}/thumbnails/thumb_${filename}`,
            userId,
            image.geoLocation ? JSON.stringify(image.geoLocation) : null,
            photoType,
            submissionId,
          ]
        );

        const attachment = attachmentResult.rows[0];
        uploadedImages.push({
          id: attachment.id,
          filename: attachment.filename,
          url: attachment.filePath,
          thumbnailUrl: attachment.thumbnailPath,
          uploadedAt: attachment.createdAt.toISOString(),
          photoType,
          geoLocation: image.geoLocation,
        });
      } catch (error) {
        logger.error(`Error processing verification image ${i + 1}:`, error);
        // Continue with other images even if one fails
      }
    }

    return uploadedImages;
  }

  // Helper method to organize form data into sections for display
  private static organizeFormDataIntoSections(
    formData: DynamicFormData,
    verificationType: string,
    formType?: string
  ): FormSection[] {
    // CRITICAL FIX: Normalize verification type to match VERIFICATION_TYPE_FIELDS keys
    const normalizedType = MobileFormController.normalizeVerificationType(verificationType);

    // If we have form type, use comprehensive mapping
    if (formType) {
      try {
        const sections = createComprehensiveFormSections(formData, normalizedType, formType);
        return sections;
      } catch (error) {
        logger.error('Error creating comprehensive form sections:', error);
        // Fall through to basic sections
      }
    }

    // Fallback to basic form sections
    return MobileFormController.createBasicFormSections(formData, normalizedType);
  }

  // Fallback method for basic form sections
  private static createBasicFormSections(
    formData: DynamicFormData,
    verificationType: string
  ): FormSection[] {
    const sections: FormSection[] = [];

    // Normalize verification type for consistent comparison
    const normalizedType = MobileFormController.normalizeVerificationType(verificationType);

    // Customer Information Section
    if (formData.customerName || formData.bankName || formData.product) {
      sections.push({
        id: 'customerInfo',
        title: 'Customer Information',
        order: 1,
        isRequired: true,
        defaultExpanded: true,
        fields: [
          {
            id: 'customerName',
            name: 'customerName',
            label: 'Customer Name',
            type: 'text' as const,
            value: formData.customerName,
            isRequired: true,
            displayValue: formData.customerName,
          },
          {
            id: 'bankName',
            name: 'bankName',
            label: 'Bank Name',
            type: 'text' as const,
            value: formData.bankName,
            isRequired: false,
            displayValue: formData.bankName,
          },
          {
            id: 'product',
            name: 'product',
            label: 'Product',
            type: 'text' as const,
            value: formData.product,
            isRequired: false,
            displayValue: formData.product,
          },
        ].filter(field => field.value !== undefined && field.value !== null && field.value !== ''),
      });
    }

    // Address Verification Section
    if (formData.addressLocatable || formData.addressRating || formData.houseStatus) {
      sections.push({
        id: 'addressVerification',
        title: 'Address Verification',
        order: 2,
        isRequired: true,
        defaultExpanded: true,
        fields: [
          {
            id: 'addressLocatable',
            name: 'addressLocatable',
            label: 'Address Locatable',
            type: 'select' as const,
            value: formData.addressLocatable,
            isRequired: true,
            displayValue: formData.addressLocatable,
          },
          {
            id: 'addressRating',
            name: 'addressRating',
            label: 'Address Rating',
            type: 'select' as const,
            value: formData.addressRating,
            isRequired: true,
            displayValue: formData.addressRating,
          },
          {
            id: 'houseStatus',
            name: 'houseStatus',
            label: 'House Status',
            type: 'select' as const,
            value: formData.houseStatus,
            isRequired: true,
            displayValue: formData.houseStatus,
          },
        ].filter(field => field.value !== undefined && field.value !== null && field.value !== ''),
      });
    }

    // Personal Details Section (for residence verification)
    if (
      normalizedType === 'RESIDENCE' &&
      (formData.metPersonName || formData.relation || formData.totalFamilyMembers)
    ) {
      sections.push({
        id: 'personalDetails',
        title: 'Personal Details',
        order: 3,
        isRequired: true,
        defaultExpanded: true,
        fields: [
          {
            id: 'metPersonName',
            name: 'metPersonName',
            label: 'Met Person Name',
            type: 'text' as const,
            value: formData.metPersonName,
            isRequired: true,
            displayValue: formData.metPersonName,
          },
          {
            id: 'relation',
            name: 'relation',
            label: 'Relation',
            type: 'select' as const,
            value: formData.relation,
            isRequired: true,
            displayValue: formData.relation,
          },
          {
            id: 'totalFamilyMembers',
            name: 'totalFamilyMembers',
            label: 'Total Family Members',
            type: 'number' as const,
            value: formData.totalFamilyMembers,
            isRequired: true,
            displayValue:
              typeof formData.totalFamilyMembers === 'number' ||
              typeof formData.totalFamilyMembers === 'string'
                ? String(formData.totalFamilyMembers)
                : undefined,
          },
          {
            id: 'totalEarningMember',
            name: 'totalEarningMember',
            label: 'Total Earning Members',
            type: 'number' as const,
            value: formData.totalEarningMember,
            isRequired: false,
          },
          {
            id: 'workingStatus',
            name: 'workingStatus',
            label: 'Working Status',
            type: 'select' as const,
            value: formData.workingStatus,
            isRequired: false,
            displayValue: formData.workingStatus,
          },
          {
            id: 'companyName',
            name: 'companyName',
            label: 'Company Name',
            type: 'text' as const,
            value: formData.companyName,
            isRequired: false,
            displayValue: formData.companyName,
          },
        ].filter(field => field.value !== undefined && field.value !== null && field.value !== ''),
      });
    }

    // Property Details Section
    if (formData.locality || formData.addressStructure || formData.doorColor) {
      sections.push({
        id: 'propertyDetails',
        title: 'Property Details',
        order: 4,
        isRequired: false,
        defaultExpanded: false,
        fields: [
          {
            id: 'locality',
            name: 'locality',
            label: 'Locality',
            type: 'select' as const,
            value: formData.locality,
            isRequired: false,
            displayValue: formData.locality,
          },
          {
            id: 'addressStructure',
            name: 'addressStructure',
            label: 'Address Structure',
            type: 'select' as const,
            value: formData.addressStructure,
            isRequired: false,
            displayValue: formData.addressStructure,
          },
          {
            id: 'doorColor',
            name: 'doorColor',
            label: 'Door Color',
            type: 'text' as const,
            value: formData.doorColor,
            isRequired: false,
            displayValue: formData.doorColor,
          },
          {
            id: 'doorNamePlate',
            name: 'doorNamePlate',
            label: 'Door Name Plate',
            type: 'select' as const,
            value: formData.doorNamePlate,
            isRequired: false,
            displayValue: formData.doorNamePlate,
          },
          {
            id: 'nameOnDoorPlate',
            name: 'nameOnDoorPlate',
            label: 'Name on Door Plate',
            type: 'text' as const,
            value: formData.nameOnDoorPlate,
            isRequired: false,
            displayValue: formData.nameOnDoorPlate,
          },
        ].filter(field => field.value !== undefined && field.value !== null && field.value !== ''),
      });
    }

    // Final Status Section
    if (formData.finalStatus || formData.outcome) {
      sections.push({
        id: 'finalStatus',
        title: 'Final Status',
        order: 10,
        isRequired: true,
        defaultExpanded: true,
        fields: [
          {
            id: 'finalStatus',
            name: 'finalStatus',
            label: 'Final Status',
            type: 'select' as const,
            value: formData.finalStatus,
            isRequired: true,
            displayValue: formData.finalStatus,
          },
          {
            id: 'outcome',
            name: 'outcome',
            label: 'Outcome',
            type: 'select' as const,
            value: formData.outcome,
            isRequired: false,
            displayValue: formData.outcome,
          },
          {
            id: 'otherObservation',
            name: 'otherObservation',
            label: 'Other Observation',
            type: 'textarea' as const,
            value: formData.otherObservation,
            isRequired: false,
            displayValue: formData.otherObservation,
          },
        ].filter(field => field.value !== undefined && field.value !== null && field.value !== ''),
      });
    }

    return sections.filter(section => section.fields.length > 0);
  }

  // Create comprehensive form sections from database report data
  private static createComprehensiveFormSectionsFromReport(
    report: ResidenceVerificationRow | OfficeVerificationRow | BusinessVerificationRow,
    verificationType: string,
    formType: string
  ): FormSection[] {
    logger.info(
      `Creating comprehensive sections from report for ${verificationType} - ${formType}`
    );

    try {
      // CRITICAL FIX: Normalize verification type to match VERIFICATION_TYPE_FIELDS keys
      // Database stores "Business Verification", but VERIFICATION_TYPE_FIELDS uses "BUSINESS"
      const normalizedType = MobileFormController.normalizeVerificationType(verificationType);
      logger.info(`Normalized verification type: ${verificationType} -> ${normalizedType}`);

      // Convert database report to form data format
      const formData = MobileFormController.convertReportToFormData(report, verificationType);

      // Use comprehensive form field mapping with NORMALIZED type
      const sections = createComprehensiveFormSections(formData, normalizedType, formType);
      logger.info(`Generated ${sections.length} comprehensive sections from report`);
      return sections;
    } catch (error) {
      logger.error('Error creating comprehensive sections from report:', error);

      // Fallback to basic sections
      return MobileFormController.createBasicFormSectionsFromReport(report, verificationType);
    }
  }

  // Helper function to normalize verification type names for comparison
  private static normalizeVerificationType(verificationType: string): string {
    const typeUpper = verificationType.toUpperCase();

    // Check for combined types first
    if (typeUpper.includes('RESIDENCE') && typeUpper.includes('OFFICE')) {
      return 'RESIDENCE_CUM_OFFICE';
    }

    // Check for individual types
    if (typeUpper.includes('RESIDENCE')) {
      return 'RESIDENCE';
    }
    if (typeUpper.includes('OFFICE')) {
      return 'OFFICE';
    }
    if (typeUpper.includes('BUSINESS')) {
      return 'BUSINESS';
    }
    if (typeUpper.includes('BUILDER')) {
      return 'BUILDER';
    }
    if (typeUpper.includes('NOC')) {
      return 'NOC';
    }
    if (typeUpper.includes('DSA') || typeUpper.includes('CONNECTOR')) {
      return 'DSA_CONNECTOR';
    }
    if (typeUpper.includes('PROPERTY') && typeUpper.includes('APF')) {
      return 'PROPERTY_APF';
    }
    if (typeUpper.includes('PROPERTY') && typeUpper.includes('INDIVIDUAL')) {
      return 'PROPERTY_INDIVIDUAL';
    }

    // Default fallback
    return 'RESIDENCE';
  }

  // Convert database report to form data format
  private static convertReportToFormData(
    report: ResidenceVerificationRow | OfficeVerificationRow | BusinessVerificationRow,
    verificationType: string
  ): DynamicFormData {
    logger.info(`Converting report to form data for ${verificationType}:`, Object.keys(report));
    const formData: DynamicFormData = {};

    // Normalize verification type for consistent comparison
    const normalizedType = MobileFormController.normalizeVerificationType(verificationType);

    // Map common fields
    formData.customerName = report.customerName;
    formData.outcome = report.verificationOutcome;
    formData.finalStatus = report.finalStatus;
    formData.metPersonName = report.metPersonName;
    formData.callRemark = report.callRemark;

    // Map location fields
    formData.addressLocatable = report.addressLocatable;
    formData.addressRating = report.addressRating;
    formData.locality = report.locality;
    formData.addressStructure = report.addressStructure;
    formData.landmark1 = report.landmark1;
    formData.landmark2 = report.landmark2;
    formData.landmark3 = report.landmark3;
    formData.landmark4 = report.landmark4;

    // Map area assessment fields
    formData.politicalConnection = report.politicalConnection;
    formData.dominatedArea = report.dominatedArea;
    formData.feedbackFromNeighbour = report.feedbackFromNeighbour;
    formData.otherObservation = report.otherObservation;

    // Map verification type specific fields
    if (normalizedType === 'RESIDENCE') {
      formData.houseStatus = report.houseStatus;
      formData.metPersonRelation = report.metPersonRelation;
      formData.metPersonStatus = report.metPersonStatus;
      formData.totalFamilyMembers = report.totalFamilyMembers;
      formData.totalEarningMember = report.totalEarningMember;
      formData.workingStatus = report.workingStatus;
      formData.companyName = report.companyName;
      formData.stayingPeriod = report.stayingPeriod;
      formData.stayingStatus = report.stayingStatus;
      formData.documentShownStatus = report.documentShownStatus;
      formData.documentType = report.documentType;
      formData.doorColor = report.doorColor;
      formData.doorNamePlateStatus = report.doorNameplateStatus;
      formData.nameOnDoorPlate = report.nameOnDoorPlate;
      formData.societyNamePlateStatus = report.societyNameplateStatus;
      formData.nameOnSocietyBoard = report.nameOnSocietyBoard;
      formData.addressStructureColor = report.addressStructureColor;
      formData.applicantStayingFloor = report.applicantStayingFloor;
      formData.addressFloor = report.addressFloor;

      // Nameplate fields
      formData.companyNamePlateStatus = report.companyNameplateStatus;
      formData.nameOnCompanyBoard = report.nameOnCompanyBoard;

      // Area and accommodation
      formData.approxArea = report.approxArea;

      // TPC (Third Party Confirmation) fields
      formData.tpcMetPerson1 = report.tpcMetPerson1;
      formData.nameOfTpc1 = report.tpcName1;
      formData.tpcConfirmation1 = report.tpcConfirmation1;
      formData.tpcMetPerson2 = report.tpcMetPerson2;
      formData.nameOfTpc2 = report.tpcName2;
      formData.tpcConfirmation2 = report.tpcConfirmation2;

      // Form type specific fields
      formData.shiftedPeriod = report.shiftedPeriod;
      formData.currentLocation = report.currentLocation;
      formData.premisesStatus = report.premisesStatus;
      formData.roomStatus = report.roomStatus;
      formData.stayingPersonName = report.stayingPersonName;
      formData.entryRestrictionReason = report.entryRestrictionReason;
      formData.securityPersonName = report.securityPersonName;
      formData.metPersonConfirmation = report.metPersonConfirmation;
      formData.accessDenied = report.accessDenied;
      formData.nameOfMetPerson = report.nameOfMetPerson;
      formData.metPersonType = report.metPersonType;
      formData.applicantStayingStatus = report.applicantStayingStatus;
      formData.contactPerson = report.contactPerson;
      formData.alternateContact = report.alternateContact;

      // Assessment
      formData.holdReason = report.holdReason;
      formData.recommendationStatus = report.recommendationStatus;
    } else if (normalizedType === 'OFFICE') {
      formData.designation = report.designation;
      formData.applicantDesignation = report.applicantDesignation;
      formData.officeStatus = report.officeStatus;
      formData.officeExistence = report.officeExistence;
      formData.officeType = report.officeType;
      formData.companyNatureOfBusiness = report.companyNatureOfBusiness;
      formData.businessPeriod = report.businessPeriod;
      formData.establishmentPeriod = report.establishmentPeriod;
      formData.staffStrength = report.staffStrength;
      formData.staffSeen = report.staffSeen;
      formData.workingPeriod = report.workingPeriod;
      formData.workingStatus = report.workingStatus;
      formData.officeApproxArea = report.officeApproxArea;
      formData.documentShown = report.documentShown;
      formData.documentType = report.documentType;
      formData.addressFloor = report.addressFloor;
      formData.companyNamePlateStatus = report.companyNameplateStatus;
      formData.nameOnBoard = report.nameOnCompanyBoard;
      formData.tpcMetPerson1 = report.tpcMetPerson1;
      formData.nameOfTpc1 = report.tpcName1;
      formData.tpcConfirmation1 = report.tpcConfirmation1;
      formData.tpcMetPerson2 = report.tpcMetPerson2;
      formData.nameOfTpc2 = report.tpcName2;
      formData.tpcConfirmation2 = report.tpcConfirmation2;

      // Visual details
      formData.addressStructureColor = report.addressStructureColor;
      formData.doorColor = report.doorColor;
      formData.applicantWorkingPremises = report.applicantWorkingPremises;
      formData.sittingLocation = report.sittingLocation;
      formData.currentCompanyName = report.currentCompanyName;

      // Shifted fields
      formData.shiftedPeriod = report.shiftedPeriod;
      formData.oldOfficeShiftedPeriod = report.oldOfficeShiftedPeriod;
      formData.currentCompanyPeriod = report.currentCompanyPeriod;
      formData.premisesStatus = report.premisesStatus;

      // Entry restricted fields
      formData.nameOfMetPerson = report.nameOfMetPerson;
      formData.metPersonType = report.metPersonType;
      formData.metPersonConfirmation = report.metPersonConfirmation;
      formData.applicantWorkingStatus = report.applicantWorkingStatus;

      // Untraceable fields
      formData.contactPerson = report.contactPerson;

      // Assessment
      formData.otherExtraRemark = report.otherExtraRemark;
      formData.holdReason = report.holdReason;
      formData.recommendationStatus = report.recommendationStatus;
      formData.remarks = report.remarks;
    } else if (normalizedType === 'BUSINESS') {
      // Basic Information
      formData.designation = report.designation;
      formData.applicantDesignation = report.applicantDesignation;

      // Business Details
      formData.businessStatus = report.businessStatus;
      formData.businessType = report.businessType;
      formData.companyNatureOfBusiness = report.companyNatureOfBusiness;
      formData.businessPeriod = report.businessPeriod;
      formData.establishmentPeriod = report.establishmentPeriod;
      formData.businessExistence = report.businessExistence;
      formData.businessActivity = report.businessActivity;
      formData.businessSetup = report.businessSetup;
      formData.businessApproxArea = report.businessApproxArea;
      formData.staffStrength = report.staffStrength;
      formData.staffSeen = report.staffSeen;
      formData.ownershipType = report.ownershipType;
      formData.ownerName = report.ownerName;
      formData.businessOwnerName = report.businessOwnerName;
      formData.nameOfCompanyOwners = report.nameOfCompanyOwners;

      // Working Details
      formData.workingPeriod = report.workingPeriod;
      formData.workingStatus = report.workingStatus;
      formData.applicantWorkingPremises = report.applicantWorkingPremises;
      formData.applicantWorkingStatus = report.applicantWorkingStatus;

      // Document Verification
      formData.documentShown = report.documentShown;
      formData.documentType = report.documentType;

      // Location Details
      formData.addressFloor = report.addressFloor;
      formData.addressStatus = report.addressStatus;
      formData.premisesStatus = report.premisesStatus;
      formData.companyNamePlateStatus = report.companyNameplateStatus;
      formData.nameOnBoard = report.nameOnCompanyBoard;
      formData.addressStructureColor = report.addressStructureColor;
      formData.doorColor = report.doorColor;

      // TPC Details
      formData.tpcMetPerson1 = report.tpcMetPerson1;
      formData.nameOfTpc1 = report.tpcName1;
      formData.tpcConfirmation1 = report.tpcConfirmation1;
      formData.tpcMetPerson2 = report.tpcMetPerson2;
      formData.nameOfTpc2 = report.tpcName2;
      formData.tpcConfirmation2 = report.tpcConfirmation2;

      // Shifting Details
      formData.shiftedPeriod = report.shiftedPeriod;
      formData.oldBusinessShiftedPeriod = report.oldBusinessShiftedPeriod;
      formData.currentCompanyName = report.currentCompanyName;
      formData.currentCompanyPeriod = report.currentCompanyPeriod;

      // Contact & Communication
      formData.contactPerson = report.contactPerson;
      formData.callRemark = report.callRemark;
      formData.nameOfMetPerson = report.nameOfMetPerson;
      formData.metPersonType = report.metPersonType;
      formData.metPersonConfirmation = report.metPersonConfirmation;

      // Area Assessment
      formData.otherExtraRemark = report.otherExtraRemark;
      formData.holdReason = report.holdReason;
      formData.recommendationStatus = report.recommendationStatus;
    } else if (normalizedType === 'PROPERTY_APF') {
      // Basic Information
      formData.customerName = report.customerName;
      formData.metPersonName = report.metPersonName;
      formData.metPersonDesignation = report.metPersonDesignation;
      formData.metPersonRelation = report.metPersonRelation;
      formData.metPersonContact = report.metPersonContact;

      // Address Information
      formData.locality = report.locality;
      formData.addressLocatable = report.addressLocatable;
      formData.addressRating = report.addressRating;
      formData.addressStructure = report.addressStructure;
      formData.addressStructureColor = report.addressStructureColor;
      formData.addressFloor = report.addressFloor;
      formData.doorColor = report.doorColor;
      formData.landmark1 = report.landmark1;
      formData.landmark2 = report.landmark2;
      formData.landmark3 = report.landmark3;
      formData.landmark4 = report.landmark4;

      // Property Details
      formData.propertyType = report.propertyType;
      formData.propertyStatus = report.propertyStatus;
      formData.propertyOwnership = report.propertyOwnership;
      formData.propertyAge = report.propertyAge;
      formData.propertyCondition = report.propertyCondition;
      formData.propertyArea = report.propertyArea;
      formData.propertyValue = report.propertyValue;
      formData.marketValue = report.marketValue;
      formData.buildingStatus = report.buildingStatus;
      formData.constructionActivity = report.constructionActivity;
      formData.activityStopReason = report.activityStopReason;

      // APF Details
      formData.apfStatus = report.apfStatus;
      formData.apfNumber = report.apfNumber;
      formData.apfIssueDate = report.apfIssueDate;
      formData.apfExpiryDate = report.apfExpiryDate;
      formData.apfIssuingAuthority = report.apfIssuingAuthority;
      formData.apfValidityStatus = report.apfValidityStatus;
      formData.apfAmount = report.apfAmount;
      formData.apfUtilizedAmount = report.apfUtilizedAmount;
      formData.apfBalanceAmount = report.apfBalanceAmount;

      // Project Information
      formData.projectName = report.projectName;
      formData.projectStatus = report.projectStatus;
      formData.projectApprovalStatus = report.projectApprovalStatus;
      formData.projectCompletionPercentage = report.projectCompletionPercentage;
      formData.projectStartDate = report.projectStartedDate;
      formData.projectEndDate = report.projectCompletionDate;
      formData.projectStartedDate = report.projectStartedDate;
      formData.projectCompletionDate = report.projectCompletionDate;
      formData.totalUnits = report.totalUnits;
      formData.completedUnits = report.completedUnits;
      formData.soldUnits = report.soldUnits;
      formData.availableUnits = report.availableUnits;
      formData.possessionStatus = report.possessionStatus;
      formData.totalBuildingsInProject = report.totalBuildingsInProject;
      formData.totalFlats = report.totalFlats;
      formData.totalFlatsInBuilding = report.totalFlatsInBuilding;
      formData.totalWing = report.totalWing;

      // Staff Information
      formData.staffSeen = report.staffSeen;
      formData.staffStrength = report.staffStrength;

      // Name Plates & Boards
      formData.companyNameBoard = report.companyNameBoard;
      formData.nameOnBoard = report.nameOnBoard;

      // Document Verification
      formData.documentShownStatus = report.documentShownStatus;
      formData.documentType = report.documentType;
      formData.documentVerificationStatus = report.documentVerificationStatus;

      // Third Party Confirmation
      formData.tpcMetPerson1 = report.tpcMetPerson1;
      formData.nameOfTpc1 = report.tpcName1;
      formData.tpcConfirmation1 = report.tpcConfirmation1;
      formData.tpcMetPerson2 = report.tpcMetPerson2;
      formData.nameOfTpc2 = report.tpcName2;
      formData.tpcConfirmation2 = report.tpcConfirmation2;

      // Builder Information
      formData.builderName = report.builderName;
      formData.builderContact = report.builderContact;
      formData.developerName = report.developerName;
      formData.developerContact = report.developerContact;
      formData.builderRegistrationNumber = report.builderRegistrationNumber;
      formData.reraRegistrationNumber = report.reraRegistrationNumber;

      // Loan Information
      formData.loanAmount = report.loanAmount;
      formData.loanPurpose = report.loanPurpose;
      formData.loanStatus = report.loanStatus;
      formData.bankName = report.bankName;
      formData.loanAccountNumber = report.loanAccountNumber;
      formData.emiAmount = report.emiAmount;

      // Legal & Clearance
      formData.legalClearance = report.legalClearance;
      formData.titleClearance = report.titleClearance;
      formData.encumbranceStatus = report.encumbranceStatus;
      formData.litigationStatus = report.litigationStatus;

      // Shifting & Contact Details
      formData.shiftedPeriod = report.shiftedPeriod;
      formData.currentLocation = report.currentLocation;
      formData.premisesStatus = report.premisesStatus;
      formData.entryRestrictionReason = report.entryRestrictionReason;
      formData.securityPersonName = report.securityPersonName;
      formData.securityConfirmation = report.securityConfirmation;
      formData.contactPerson = report.contactPerson;
      formData.callRemark = report.callRemark;

      // Infrastructure & Area Assessment
      formData.infrastructureStatus = report.infrastructureStatus;
      formData.roadConnectivity = report.roadConnectivity;
      formData.politicalConnection = report.politicalConnection;
      formData.dominatedArea = report.dominatedArea;
      formData.feedbackFromNeighbour = report.feedbackFromNeighbour;
      formData.otherObservation = report.otherObservation;
      formData.propertyConcerns = report.propertyConcerns;
      formData.financialConcerns = report.financialConcerns;
      formData.finalStatus = report.finalStatus;
      formData.holdReason = report.holdReason;
      formData.recommendationStatus = report.recommendationStatus;
      formData.remarks = report.remarks;

      // Entry restricted fields (additional)
      formData.nameOfMetPerson = report.nameOfMetPerson;
      formData.metPersonConfirmation = report.metPersonConfirmation;
      formData.designation = report.designation;
    } else if (normalizedType === 'PROPERTY_INDIVIDUAL') {
      // Basic Information
      formData.customerName = report.customerName;
      formData.metPersonName = report.metPersonName;
      formData.metPersonDesignation = report.metPersonDesignation;
      formData.metPersonRelation = report.metPersonRelation;
      formData.metPersonContact = report.metPersonContact;

      // Address Information
      formData.locality = report.locality;
      formData.addressLocatable = report.addressLocatable;
      formData.addressRating = report.addressRating;
      formData.addressStructure = report.addressStructure;
      formData.addressStructureColor = report.addressStructureColor;
      formData.addressFloor = report.addressFloor;
      formData.doorColor = report.doorColor;
      formData.landmark1 = report.landmark1;
      formData.landmark2 = report.landmark2;
      formData.landmark3 = report.landmark3;
      formData.landmark4 = report.landmark4;

      // Property Details
      formData.propertyType = report.propertyType;
      formData.propertyStatus = report.propertyStatus;
      formData.propertyOwnership = report.propertyOwnership;
      formData.propertyAge = report.propertyAge;
      formData.propertyCondition = report.propertyCondition;
      formData.propertyArea = report.propertyArea;
      formData.propertyValue = report.propertyValue;
      formData.marketValue = report.marketValue;
      formData.propertyLocation = report.propertyLocation;
      formData.propertyDescription = report.propertyDescription;
      formData.propertyAmenities = report.propertyAmenities;
      formData.constructionType = report.constructionType;
      formData.constructionYear = report.constructionYear;
      formData.renovationYear = report.renovationYear;

      // Owner Information
      formData.ownerName = report.ownerName;
      formData.ownerAge = report.ownerAge;
      formData.ownerOccupation = report.ownerOccupation;
      formData.ownerIncome = report.ownerIncome;
      formData.ownerRelation = report.ownerRelation;
      formData.previousOwnerName = report.previousOwnerName;

      // Individual Information
      formData.individualName = report.individualName;
      formData.individualAge = report.individualAge;
      formData.individualOccupation = report.individualOccupation;
      formData.individualEducation = report.individualEducation;
      formData.individualMaritalStatus = report.individualMaritalStatus;
      formData.individualExperience = report.individualExperience;
      formData.individualIncome = report.individualIncome;
      formData.yearsOfResidence = report.yearsOfResidence;

      // Family & Employment
      formData.familyMembers = report.familyMembers;
      formData.earningMembers = report.earningMembers;
      formData.employmentType = report.employmentType;
      formData.employerName = report.employerName;
      formData.employmentDuration = report.employmentDuration;
      formData.incomeSource = report.incomeSource;
      formData.monthlyIncome = report.monthlyIncome;
      formData.annualIncome = report.annualIncome;

      // Business Information
      formData.businessName = report.businessName;
      formData.businessType = report.businessType;
      formData.businessIncome = report.businessIncome;
      formData.businessExperience = report.businessExperience;

      // Financial Information
      formData.loanAmount = report.loanAmount;
      formData.emiAmount = report.emiAmount;
      formData.bankName = report.bankName;
      formData.loanAgainstProperty = report.loanAgainstProperty;

      // Legal & Documentation
      formData.propertyDocuments = report.propertyDocuments;
      formData.documentVerificationStatus = report.documentVerificationStatus;
      formData.titleClearStatus = report.titleClearStatus;
      formData.mutationStatus = report.mutationStatus;
      formData.taxPaymentStatus = report.taxPaymentStatus;
      formData.legalIssues = report.legalIssues;

      // Utilities & Amenities
      formData.electricityConnection = report.electricityConnection;
      formData.waterConnection = report.waterConnection;
      formData.gasConnection = report.gasConnection;
      formData.internetConnection = report.internetConnection;
      formData.publicTransport = report.publicTransport;
      formData.roadConnectivity = report.roadConnectivity;
      formData.safetySecurity = report.safetySecurity;

      // Third Party Confirmation
      formData.tpcMetPerson1 = report.tpcMetPerson1;
      formData.nameOfTpc1 = report.tpcName1;
      formData.tpcConfirmation1 = report.tpcConfirmation1;
      formData.tpcMetPerson2 = report.tpcMetPerson2;
      formData.nameOfTpc2 = report.tpcName2;
      formData.tpcConfirmation2 = report.tpcConfirmation2;
      formData.neighbor1Name = report.neighbor1Name;
      formData.neighbor1Confirmation = report.neighbor1Confirmation;
      formData.neighbor2Name = report.neighbor2Name;
      formData.neighbor2Confirmation = report.neighbor2Confirmation;

      // Shifting & Contact Details
      formData.shiftedPeriod = report.shiftedPeriod;
      formData.currentLocation = report.currentLocation;
      formData.premisesStatus = report.premisesStatus;
      formData.entryRestrictionReason = report.entryRestrictionReason;
      formData.securityPersonName = report.securityPersonName;
      formData.securityConfirmation = report.securityConfirmation;
      formData.contactPerson = report.contactPerson;
      formData.callRemark = report.callRemark;

      // Area Assessment & Reputation
      formData.localityReputation = report.localityReputation;
      formData.infrastructureStatus = report.infrastructureStatus;
      formData.politicalConnection = report.politicalConnection;
      formData.dominatedArea = report.dominatedArea;
      formData.feedbackFromNeighbour = report.feedbackFromNeighbour;
      formData.otherObservation = report.otherObservation;
      formData.propertyConcerns = report.propertyConcerns;
      formData.verificationChallenges = report.verificationChallenges;
      formData.finalStatus = report.finalStatus;
      formData.holdReason = report.holdReason;
      formData.recommendationStatus = report.recommendationStatus;
      formData.remarks = report.remarks;
    } else if (normalizedType === 'NOC') {
      // Basic Information
      formData.customerName = report.customerName;
      formData.metPersonName = report.metPersonName;
      formData.metPersonDesignation = report.metPersonDesignation;
      formData.metPersonRelation = report.metPersonRelation;
      formData.metPersonContact = report.metPersonContact;

      // Address Information
      formData.locality = report.locality;
      formData.addressLocatable = report.addressLocatable;
      formData.addressRating = report.addressRating;
      formData.addressStructure = report.addressStructure;
      formData.addressStructureColor = report.addressStructureColor;
      formData.addressFloor = report.addressFloor;
      formData.doorColor = report.doorColor;
      formData.landmark1 = report.landmark1;
      formData.landmark2 = report.landmark2;
      formData.landmark3 = report.landmark3;
      formData.landmark4 = report.landmark4;

      // NOC Information
      formData.nocType = report.nocType;
      formData.nocStatus = report.nocStatus;
      formData.nocNumber = report.nocNumber;
      formData.nocIssueDate = report.nocIssueDate;
      formData.nocExpiryDate = report.nocExpiryDate;
      formData.nocIssuingAuthority = report.nocIssuingAuthority;
      formData.nocValidityStatus = report.nocValidityStatus;

      // Property & Project Information
      formData.propertyType = report.propertyType;
      formData.projectName = report.projectName;
      formData.projectStatus = report.projectStatus;
      formData.constructionStatus = report.constructionStatus;
      formData.projectApprovalStatus = report.projectApprovalStatus;
      formData.totalUnits = report.totalUnits;
      formData.completedUnits = report.completedUnits;
      formData.soldUnits = report.soldUnits;
      formData.possessionStatus = report.possessionStatus;

      // Builder & Developer Information
      formData.builderName = report.builderName;
      formData.builderContact = report.builderContact;
      formData.developerName = report.developerName;
      formData.developerContact = report.developerContact;
      formData.builderRegistrationNumber = report.builderRegistrationNumber;

      // Document Verification
      formData.documentShownStatus = report.documentShownStatus;
      formData.documentType = report.documentType;
      formData.documentVerificationStatus = report.documentVerificationStatus;

      // Third Party Confirmation
      formData.tpcMetPerson1 = report.tpcMetPerson1;
      formData.nameOfTpc1 = report.tpcName1;
      formData.tpcConfirmation1 = report.tpcConfirmation1;
      formData.tpcMetPerson2 = report.tpcMetPerson2;
      formData.nameOfTpc2 = report.tpcName2;
      formData.tpcConfirmation2 = report.tpcConfirmation2;

      // Shifting & Contact Details
      formData.shiftedPeriod = report.shiftedPeriod;
      formData.currentLocation = report.currentLocation;
      formData.premisesStatus = report.premisesStatus;
      formData.entryRestrictionReason = report.entryRestrictionReason;
      formData.securityPersonName = report.securityPersonName;
      formData.securityConfirmation = report.securityConfirmation;
      formData.contactPerson = report.contactPerson;
      formData.callRemark = report.callRemark;

      // Clearances & Compliance
      formData.environmentalClearance = report.environmentalClearance;
      formData.fireSafetyClearance = report.fireSafetyClearance;
      formData.pollutionClearance = report.pollutionClearance;
      formData.waterConnectionStatus = report.waterConnectionStatus;
      formData.electricityConnectionStatus = report.electricityConnectionStatus;
      formData.complianceIssues = report.complianceIssues;
      formData.regulatoryConcerns = report.regulatoryConcerns;

      // Infrastructure & Assessment
      formData.infrastructureStatus = report.infrastructureStatus;
      formData.roadConnectivity = report.roadConnectivity;
      formData.politicalConnection = report.politicalConnection;
      formData.dominatedArea = report.dominatedArea;
      formData.feedbackFromNeighbour = report.feedbackFromNeighbour;
      formData.otherObservation = report.otherObservation;

      // Final Status & Recommendations
      formData.finalStatus = report.finalStatus;
      formData.holdReason = report.holdReason;
      formData.recommendationStatus = report.recommendationStatus;
      formData.remarks = report.remarks;
    } else if (normalizedType === 'BUILDER') {
      // Basic Information
      formData.customerName = report.customerName;
      formData.metPersonName = report.metPersonName;
      formData.designation = report.designation;
      formData.applicantDesignation = report.applicantDesignation;

      // Address Information
      formData.locality = report.locality;
      formData.addressLocatable = report.addressLocatable;
      formData.addressRating = report.addressRating;
      formData.addressStructure = report.addressStructure;
      formData.addressStructureColor = report.addressStructureColor;
      formData.addressFloor = report.addressFloor;
      formData.doorColor = report.doorColor;
      formData.landmark1 = report.landmark1;
      formData.landmark2 = report.landmark2;
      formData.landmark3 = report.landmark3;
      formData.landmark4 = report.landmark4;

      // Builder Information
      formData.builderName = report.builderName;
      formData.builderOwnerName = report.builderOwnerName;
      formData.builderType = report.builderType;
      formData.companyNatureOfBusiness = report.companyNatureOfBusiness;
      formData.businessPeriod = report.businessPeriod;
      formData.establishmentPeriod = report.establishmentPeriod;
      formData.workingPeriod = report.workingPeriod;
      formData.workingStatus = report.workingStatus;
      formData.applicantWorkingStatus = report.applicantWorkingStatus;

      // Office Information
      formData.officeStatus = report.officeStatus;
      formData.officeExistence = report.officeExistence;
      formData.officeApproxArea = report.officeApproxArea;
      formData.companyNamePlateStatus = report.companyNameplateStatus;
      formData.nameOnBoard = report.nameOnCompanyBoard;
      formData.addressStructureColor = report.addressStructureColor;
      formData.doorColor = report.doorColor;

      // Staff Information
      formData.staffStrength = report.staffStrength;
      formData.staffSeen = report.staffSeen;

      // Document Verification
      formData.documentShown = report.documentShown;

      // Third Party Confirmation
      formData.tpcMetPerson1 = report.tpcMetPerson1;
      formData.nameOfTpc1 = report.tpcName1;
      formData.tpcConfirmation1 = report.tpcConfirmation1;
      formData.tpcMetPerson2 = report.tpcMetPerson2;
      formData.nameOfTpc2 = report.tpcName2;
      formData.tpcConfirmation2 = report.tpcConfirmation2;

      // Entry restricted fields
      formData.nameOfMetPerson = report.nameOfMetPerson;
      formData.metPersonType = report.metPersonType;
      formData.metPersonConfirmation = report.metPersonConfirmation;

      // Shifting & Contact Details
      formData.shiftedPeriod = report.shiftedPeriod;
      formData.oldOfficeShiftedPeriod = report.oldOfficeShiftedPeriod;
      formData.currentCompanyName = report.currentCompanyName;
      formData.currentCompanyPeriod = report.currentCompanyPeriod;
      formData.premisesStatus = report.premisesStatus;
      formData.contactPerson = report.contactPerson;
      formData.callRemark = report.callRemark;

      // Assessment & Feedback
      formData.politicalConnection = report.politicalConnection;
      formData.dominatedArea = report.dominatedArea;
      formData.feedbackFromNeighbour = report.feedbackFromNeighbour;
      formData.otherObservation = report.otherObservation;
      formData.otherExtraRemark = report.otherExtraRemark;

      // Final Status & Recommendations
      formData.finalStatus = report.finalStatus;
      formData.holdReason = report.holdReason;
      formData.recommendationStatus = report.recommendationStatus;
      formData.remarks = report.remarks;
    } else if (normalizedType === 'DSA_CONNECTOR') {
      // Basic Information
      formData.customerName = report.customerName;
      formData.metPersonName = report.metPersonName;
      formData.metPersonDesignation = report.metPersonDesignation;
      formData.metPersonRelation = report.metPersonRelation;
      formData.metPersonContact = report.metPersonContact;

      // Address Information
      formData.locality = report.locality;
      formData.addressLocatable = report.addressLocatable;
      formData.addressRating = report.addressRating;
      formData.addressStructure = report.addressStructure;
      formData.addressStructureColor = report.addressStructureColor;
      formData.addressFloor = report.addressFloor;
      formData.doorColor = report.doorColor;
      formData.landmark1 = report.landmark1;
      formData.landmark2 = report.landmark2;
      formData.landmark3 = report.landmark3;
      formData.landmark4 = report.landmark4;

      // Connector Information
      formData.connectorType = report.connectorType;
      formData.connectorCode = report.connectorCode;
      formData.connectorName = report.connectorName;
      formData.connectorDesignation = report.connectorDesignation;
      formData.connectorExperience = report.connectorExperience;
      formData.connectorStatus = report.connectorStatus;

      // Business Information
      formData.businessName = report.businessName;
      formData.businessType = report.businessType;
      formData.businessRegistrationNumber = report.businessRegistrationNumber;
      formData.businessEstablishmentYear = report.businessEstablishmentYear;
      formData.businessOperational = report.businessOperational;
      formData.businessHours = report.businessHours;
      formData.weekendOperations = report.weekendOperations;
      formData.customerFootfall = report.customerFootfall;
      formData.previousBusinessName = report.previousBusinessName;

      // Office Information
      formData.officeType = report.officeType;
      formData.officeArea = report.officeArea;
      formData.officeRent = report.officeRent;

      // Staff Information
      formData.totalStaff = report.totalStaff;
      formData.salesStaff = report.salesStaff;
      formData.supportStaff = report.supportStaff;
      formData.teamSize = report.teamSize;

      // Financial Information
      formData.monthlyBusinessVolume = report.monthlyBusinessVolume;
      formData.averageMonthlySales = report.averageMonthlySales;
      formData.annualTurnover = report.annualTurnover;
      formData.monthlyIncome = report.monthlyIncome;
      formData.commissionStructure = report.commissionStructure;
      formData.paymentTerms = report.paymentTerms;
      formData.bankAccountDetails = report.bankAccountDetails;

      // Technology & Infrastructure
      formData.computerSystems = report.computerSystems;
      formData.internetConnection = report.internetConnection;
      formData.softwareSystems = report.softwareSystems;
      formData.posTerminals = report.posTerminals;
      formData.printerScanner = report.printerScanner;
      formData.infrastructureStatus = report.infrastructureStatus;

      // Compliance & Licensing
      formData.licenseStatus = report.licenseStatus;
      formData.licenseNumber = report.licenseNumber;
      formData.licenseExpiryDate = report.licenseExpiryDate;
      formData.complianceStatus = report.complianceStatus;
      formData.auditStatus = report.auditStatus;
      formData.trainingStatus = report.trainingStatus;

      // Third Party Confirmation
      formData.tpcMetPerson1 = report.tpcMetPerson1;
      formData.nameOfTpc1 = report.tpcName1;
      formData.tpcConfirmation1 = report.tpcConfirmation1;
      formData.tpcMetPerson2 = report.tpcMetPerson2;
      formData.nameOfTpc2 = report.tpcName2;
      formData.tpcConfirmation2 = report.tpcConfirmation2;

      // Shifting & Contact Details
      formData.shiftedPeriod = report.shiftedPeriod;
      formData.currentLocation = report.currentLocation;
      formData.premisesStatus = report.premisesStatus;
      formData.entryRestrictionReason = report.entryRestrictionReason;
      formData.securityPersonName = report.securityPersonName;
      formData.securityConfirmation = report.securityConfirmation;
      formData.contactPerson = report.contactPerson;
      formData.callRemark = report.callRemark;

      // Market Analysis & Assessment
      formData.marketPresence = report.marketPresence;
      formData.competitorAnalysis = report.competitorAnalysis;
      formData.marketReputation = report.marketReputation;
      formData.customerFeedback = report.customerFeedback;
      formData.commercialViability = report.commercialViability;
      formData.growthPotential = report.growthPotential;

      // Risk Assessment & Final Status
      formData.politicalConnection = report.politicalConnection;
      formData.dominatedArea = report.dominatedArea;
      formData.feedbackFromNeighbour = report.feedbackFromNeighbour;
      formData.otherObservation = report.otherObservation;
      formData.businessConcerns = report.businessConcerns;
      formData.operationalChallenges = report.operationalChallenges;
      formData.riskAssessment = report.riskAssessment;
      formData.finalStatus = report.finalStatus;
      formData.holdReason = report.holdReason;
      formData.recommendationStatus = report.recommendationStatus;
      formData.remarks = report.remarks;
    } else if (normalizedType === 'RESIDENCE_CUM_OFFICE') {
      // Basic Information
      formData.customerName = report.customerName;
      formData.metPersonName = report.metPersonName;
      formData.metPersonRelation = report.metPersonRelation;
      formData.designation = report.designation;
      formData.applicantDesignation = report.applicantDesignation;

      // Address Information
      formData.locality = report.locality;
      formData.addressLocatable = report.addressLocatable;
      formData.addressRating = report.addressRating;
      formData.addressStructure = report.addressStructure;
      formData.addressStructureColor = report.addressStructureColor;
      formData.addressFloor = report.addressFloor;
      formData.doorColor = report.doorColor;
      formData.landmark1 = report.landmark1;
      formData.landmark2 = report.landmark2;
      formData.landmark3 = report.landmark3;
      formData.landmark4 = report.landmark4;

      // Residence Information
      formData.houseStatus = report.houseStatus;
      formData.totalFamilyMembers = report.totalFamilyMembers;
      formData.totalEarningMember = report.totalEarningMember;
      formData.stayingPeriod = report.stayingPeriod;
      formData.stayingStatus = report.stayingStatus;
      formData.stayingPersonName = report.stayingPersonName;
      formData.doorNamePlateStatus = report.doorNameplateStatus;
      formData.nameOnDoorPlate = report.nameOnDoorPlate;
      formData.societyNamePlateStatus = report.societyNameplateStatus;
      formData.nameOnSocietyBoard = report.nameOnSocietyBoard;

      // Applicant Information
      formData.applicantStayingStatus = report.applicantStayingStatus;
      formData.applicantWorkingStatus = report.applicantWorkingStatus;
      formData.applicantWorkingPremises = report.applicantWorkingPremises;

      // Office Information
      formData.officeStatus = report.officeStatus;
      formData.officeExistence = report.officeExistence;
      formData.officeType = report.officeType;
      formData.companyNatureOfBusiness = report.companyNatureOfBusiness;
      formData.businessPeriod = report.businessPeriod;
      formData.establishmentPeriod = report.establishmentPeriod;
      formData.workingPeriod = report.workingPeriod;
      formData.workingStatus = report.workingStatus;
      formData.approxArea = report.approxArea;
      formData.sittingLocation = report.sittingLocation;
      formData.currentCompanyName = report.currentCompanyName;
      formData.companyNamePlateStatus = report.companyNameplateStatus;
      formData.nameOnBoard = report.nameOnCompanyBoard;

      // Staff Information
      formData.staffStrength = report.staffStrength;
      formData.staffSeen = report.staffSeen;

      // Document Verification
      formData.documentShownStatus = report.documentShownStatus;
      formData.documentType = report.documentType;

      // Third Party Confirmation
      formData.tpcMetPerson1 = report.tpcMetPerson1;
      formData.nameOfTpc1 = report.tpcName1;
      formData.tpcConfirmation1 = report.tpcConfirmation1;
      formData.tpcMetPerson2 = report.tpcMetPerson2;
      formData.nameOfTpc2 = report.tpcName2;
      formData.tpcConfirmation2 = report.tpcConfirmation2;

      // Entry restricted fields
      formData.nameOfMetPerson = report.nameOfMetPerson;
      formData.metPersonType = report.metPersonType;
      formData.metPersonConfirmation = report.metPersonConfirmation;

      // Shifting & Contact Details
      formData.shiftedPeriod = report.shiftedPeriod;
      formData.oldOfficeShiftedPeriod = report.oldOfficeShiftedPeriod;
      formData.currentCompanyName = report.currentCompanyName;
      formData.currentCompanyPeriod = report.currentCompanyPeriod;
      formData.premisesStatus = report.premisesStatus;
      formData.contactPerson = report.contactPerson;
      formData.callRemark = report.callRemark;

      // Area Assessment & Final Status
      formData.politicalConnection = report.politicalConnection;
      formData.dominatedArea = report.dominatedArea;
      formData.feedbackFromNeighbour = report.feedbackFromNeighbour;
      formData.otherObservation = report.otherObservation;
      formData.otherExtraRemark = report.otherExtraRemark;
      formData.finalStatus = report.finalStatus;
      formData.holdReason = report.holdReason;
      formData.recommendationStatus = report.recommendationStatus;
      formData.remarks = report.remarks;
      formData.entryRestrictionReason = report.entryRestrictionReason;
      formData.securityPersonName = report.securityPersonName;
      formData.accessDenied = report.accessDenied;
      formData.nameOfMetPerson = report.nameOfMetPerson;
      formData.metPersonType = report.metPersonType;
      formData.applicantStayingStatus = report.applicantStayingStatus;
      formData.contactPerson = report.contactPerson;
      formData.alternateContact = report.alternateContact;
      formData.holdReason = report.holdReason;
    }

    return formData;
  }

  // Fallback method for basic form sections from report
  private static createBasicFormSectionsFromReport(
    report: ResidenceVerificationRow | OfficeVerificationRow | BusinessVerificationRow,
    _verificationType: string
  ): FormSection[] {
    return [
      {
        id: 'basicInformation',
        title: 'Basic Information',
        description: 'Customer and verification details',
        order: 1,
        fields: [
          {
            id: 'customerName',
            name: 'customerName',
            label: 'Customer Name',
            type: 'text',
            value: report.customerName,
            displayValue: report.customerName || 'Not provided',
            isRequired: true,
            validation: { isValid: true, errors: [] },
          },
          {
            id: 'verificationOutcome',
            name: 'verificationOutcome',
            label: 'Verification Outcome',
            type: 'select',
            value: report.verificationOutcome,
            displayValue: report.verificationOutcome || 'Not provided',
            isRequired: true,
            validation: { isValid: true, errors: [] },
          },
          {
            id: 'metPersonName',
            name: 'metPersonName',
            label: 'Met Person Name',
            type: 'text',
            value: report.metPersonName,
            displayValue: report.metPersonName || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] },
          },
          {
            id: 'callRemark',
            name: 'callRemark',
            label: 'Call Remark',
            type: 'select',
            value: report.callRemark,
            displayValue: report.callRemark || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] },
          },
        ],
        isRequired: true,
        defaultExpanded: true,
      },
      {
        id: 'locationDetails',
        title: 'Location Details',
        description: 'Address and location information',
        order: 2,
        fields: [
          {
            id: 'locality',
            name: 'locality',
            label: 'Locality Type',
            type: 'select',
            value: report.locality,
            displayValue: report.locality || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] },
          },
          {
            id: 'landmark1',
            name: 'landmark1',
            label: 'Landmark 1',
            type: 'text',
            value: report.landmark1,
            displayValue: report.landmark1 || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] },
          },
          {
            id: 'landmark2',
            name: 'landmark2',
            label: 'Landmark 2',
            type: 'text',
            value: report.landmark2,
            displayValue: report.landmark2 || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] },
          },
          {
            id: 'landmark3',
            name: 'landmark3',
            label: 'Landmark 3',
            type: 'text',
            value: report.landmark3,
            displayValue: report.landmark3 || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] },
          },
          {
            id: 'landmark4',
            name: 'landmark4',
            label: 'Landmark 4',
            type: 'text',
            value: report.landmark4,
            displayValue: report.landmark4 || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] },
          },
        ],
        isRequired: false,
        defaultExpanded: true,
      },
      {
        id: 'areaAssessment',
        title: 'Area Assessment',
        description: 'Area and final assessment details',
        order: 3,
        fields: [
          {
            id: 'dominatedArea',
            name: 'dominatedArea',
            label: 'Dominated Area',
            type: 'select',
            value: report.dominatedArea,
            displayValue: report.dominatedArea || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] },
          },
          {
            id: 'otherObservation',
            name: 'otherObservation',
            label: 'Other Observations',
            type: 'textarea',
            value: report.otherObservation,
            displayValue: report.otherObservation || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] },
          },
          {
            id: 'finalStatus',
            name: 'finalStatus',
            label: 'Final Status',
            type: 'select',
            value: report.finalStatus,
            displayValue: report.finalStatus || 'Not provided',
            isRequired: true,
            validation: { isValid: true, errors: [] },
          },
        ],
        isRequired: false,
        defaultExpanded: true,
      },
    ];
  }

  // REMOVED: Generic verification function - using specific implementations instead
  private static async submitGenericVerification_DISABLED(
    req: AuthenticatedRequest,
    res: Response,
    verificationType: string,
    _reportTableName?: string
  ) {
    try {
      const caseId = String(req.params.caseId || '');
      const {
        formData,
        attachmentIds,
        geoLocation,
        photos,
        metadata,
      }: MobileFormSubmissionRequest = req.body;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user as never);

      // Verify case access
      const where: WhereClause = { id: caseId };
      if (isExecutionActor) {
        where.assignedTo = userId;
      }

      const vals: QueryParams = [caseId];
      let caseSql = `SELECT id FROM cases WHERE id = $1`;
      if (isExecutionActor) {
        caseSql += ` AND assigned_to = $2`;
        vals.push(userId);
      }
      const caseRes = await query(caseSql, vals);
      const existingCase = caseRes.rows[0];

      if (!existingCase) {
        return res.status(404).json({
          success: false,
          message: 'Case not found or access denied',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      if (!photos || photos.length < 5) {
        return res.status(400).json({
          success: false,
          message: `Minimum 5 geo-tagged photos required for ${verificationType.toLowerCase()} verification`,
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photos?.length || 0,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location
      const photosWithoutGeo = photos.filter(
        photo => !photo.geoLocation?.latitude || !photo.geoLocation.longitude
      );

      if (photosWithoutGeo.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'All photos must have geo-location data',
          error: {
            code: 'MISSING_GEO_LOCATION',
            details: {
              photosWithoutGeo: photosWithoutGeo.length,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Skip attachment validation for now - attachments are handled separately

      // Get user details for comprehensive data
      const userRes = await query(`SELECT name, username FROM users WHERE id = $1`, [userId]);
      const user = userRes.rows[0];

      // Basic data processing pipeline
      logger.info(
        `🔄 Using basic data processing for case ${caseId}, verification type: ${verificationType}`
      );

      // Prepare comprehensive verification data
      const verificationData = {
        id: `form_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        caseId,
        formType: verificationType,
        verificationType: formData.outcome || 'VERIFIED',
        outcome: formData.finalStatus || formData.outcome || 'POSITIVE',
        status: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        submittedByName: user?.name || 'Unknown',

        // Organize form data into sections (this will be enhanced based on form type)
        sections: MobileFormController.organizeFormDataIntoSections(formData, verificationType),

        // Enhanced attachments and photos
        attachments: attachmentIds.map(id => ({
          id,
          category: 'DOCUMENT' as const,
        })),
        photos: photos.map(photo => ({
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          attachmentId: photo.attachmentId,
          type: photo.type,
          geoLocation: {
            ...photo.geoLocation,
            address: photo.geoLocation.address || 'Address not available',
          },
          metadata: photo.metadata || {
            fileSize: 0,
            dimensions: { width: 0, height: 0 },
            capturedAt: new Date().toISOString(),
          },
        })),

        // Enhanced geo-location
        geoLocation: {
          ...geoLocation,
          address: geoLocation.address || 'Address not available',
        },

        // Enhanced metadata
        metadata: metadata || {
          submissionTimestamp: new Date().toISOString(),
          deviceInfo: {
            platform: 'UNKNOWN' as const,
            model: 'Unknown',
            osVersion: 'Unknown',
            appVersion: 'Unknown',
          },
          networkInfo: {
            type: 'UNKNOWN' as const,
          },
          formVersion: '1.0',
          submissionAttempts: 1,
          isOfflineSubmission: false,
        },

        // Validation status
        validationStatus: 'VALID',
        validationErrors: [] as unknown[],

        // Legacy verification object for backward compatibility
        verification: {
          ...formData,
          photoCount: photos.length,
          geoTaggedPhotos: photos.length,
          submissionLocation: geoLocation,
        },
      };

      // Update case with verification data
      await query(
        `UPDATE cases SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, verification_data = $1, verification_type = $2, verification_outcome = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
        [JSON.stringify(verificationData), verificationType, formData.outcome || 'VERIFIED', caseId]
      );
      const caseUpd = await query(`SELECT id, status, completed_at FROM cases WHERE id = $1`, [
        caseId,
      ]);
      const updatedCase = caseUpd.rows[0];

      // Commission is now handled at the verification task level.
      // Legacy Case-level commission trigger removed to avoid duplication.

      // Update attachment geo-locations
      for (const photo of photos) {
        await query(`UPDATE attachments SET geo_location = $1 WHERE id = $2`, [
          JSON.stringify(photo.geoLocation),
          photo.attachmentId,
        ]);
      }

      await createAuditLog({
        action: `${verificationType}_VERIFICATION_SUBMITTED`,
        entityType: 'CASE',
        entityId: caseId,
        userId,
        details: {
          formType: verificationType,
          photoCount: photos.length,
          attachmentCount: attachmentIds.length,
          outcome: formData.outcome,
          hasGeoLocation: !!geoLocation,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        message: `${verificationType.charAt(0).toUpperCase() + verificationType.slice(1).toLowerCase()} verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          verificationId: verificationData,
        },
      });
    } catch (error) {
      logger.error(`Submit ${verificationType.toLowerCase()} verification error:`, error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Get form submissions for a case
  static async getCaseFormSubmissions(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const caseId = String(req.params.caseId || '');
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user as never);

      logger.info(
        'Getting form submissions for case:',
        caseId,
        'User:',
        userId,
        'ExecutionActor:',
        isExecutionActor
      );

      // Validate caseId parameter
      if (!caseId || caseId.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Case ID is required',
          error: {
            code: 'INVALID_CASE_ID',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Verify case access - handle both UUID and business caseId
      const vals: QueryParams = [];
      let caseSql = `SELECT id, customer_name, verification_data, verification_type, verification_outcome, status FROM cases WHERE `;

      // Check if caseId is a number (business caseId) or UUID
      const isNumeric = /^\d+$/.test(caseId);
      if (isNumeric) {
        caseSql += `case_id = $1`;
        vals.push(parseInt(caseId));
      } else {
        caseSql += `id = $1`;
        vals.push(caseId);
      }

      // FIXED: For FIELD_AGENT, check if they have ANY tasks assigned for this case
      // (removed invalid cases.assignedTo reference)
      if (isExecutionActor) {
        caseSql += ` AND EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = cases.id AND vt.assigned_to = $2
        )`;
        vals.push(userId);
      }

      logger.info('Executing query:', caseSql, 'with values:', vals);
      const caseRes = await query(caseSql, vals);
      const caseData = caseRes.rows[0];
      logger.info('Case data found:', caseData);

      if (!caseData) {
        logger.info('Case not found for ID:', caseId, 'ExecutionActor:', isExecutionActor);
        return res.status(404).json({
          success: false,
          message: 'Case not found or access denied',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // MULTI-TASK ARCHITECTURE: Get ALL form submissions for ALL verification tasks in this case
      const formSubmissions: FormSubmissionData[] = [];

      // Get all verification tasks for this case
      const tasksSql = `
        SELECT
          vt.id as task_id,
          vt.task_number,
          vt.verification_type_id,
          vt.assigned_to,
          vt.status as task_status,
          vtype.name as verification_type_name,
          u.name as assigned_to_name,
          u.employee_id as assigned_to_employee_id
        FROM verification_tasks vt
        LEFT JOIN verification_types vtype ON vt.verification_type_id = vtype.id
        LEFT JOIN users u ON vt.assigned_to = u.id
        WHERE vt.case_id = $1
        ORDER BY vt.created_at ASC
      `;

      const tasksRes = await query(tasksSql, [caseData.id]);
      const tasks = tasksRes.rows;

      logger.info(`Found ${tasks.length} verification tasks for case ${caseId}`);

      // For each task, fetch its form submission (if exists)
      for (const task of tasks) {
        const verificationType = task.verificationTypeName || 'RESIDENCE';
        logger.info(`Processing task ${task.taskNumber} - Type: ${verificationType}`);

        // Determine which report table to query based on verification type
        let reportTableName = '';
        let reportSql = '';

        // Match verification type names (handle both short and full names)
        // IMPORTANT: Check combined types BEFORE individual types
        const typeUpper = verificationType.toUpperCase();

        // Post-migration 010: all report tables are snake_case.
        // The prior code used camelCase double-quoted names
        // ("residenceVerificationReports") which PostgreSQL treats as
        // case-sensitive identifiers → "relation does not exist" 500
        // on every case detail page.
        if (typeUpper.includes('RESIDENCE') && typeUpper.includes('OFFICE')) {
          reportTableName = 'residence_cum_office_verification_reports';
        } else if (typeUpper.includes('RESIDENCE')) {
          reportTableName = 'residence_verification_reports';
        } else if (typeUpper.includes('OFFICE')) {
          reportTableName = 'office_verification_reports';
        } else if (typeUpper.includes('BUSINESS')) {
          reportTableName = 'business_verification_reports';
        } else if (typeUpper.includes('BUILDER')) {
          reportTableName = 'builder_verification_reports';
        } else if (typeUpper.includes('NOC')) {
          reportTableName = 'noc_verification_reports';
        } else if (typeUpper.includes('DSA') || typeUpper.includes('CONNECTOR')) {
          reportTableName = 'dsa_connector_verification_reports';
        } else if (typeUpper.includes('PROPERTY') && typeUpper.includes('APF')) {
          reportTableName = 'property_apf_verification_reports';
        } else if (typeUpper.includes('PROPERTY') && typeUpper.includes('INDIVIDUAL')) {
          reportTableName = 'property_individual_verification_reports';
        } else {
          logger.warn(
            `Unknown verification type: ${verificationType}, falling back to residence_verification_reports`
          );
          reportTableName = 'residence_verification_reports';
        }

        // Query for reports — no double quotes needed since snake_case
        // identifiers are case-insensitive in PostgreSQL.
        reportSql = `SELECT * FROM ${reportTableName} WHERE verification_task_id = $1 LIMIT 1`;
        const reportRes = await query(reportSql, [task.taskId]);

        logger.info(
          `Found ${reportRes.rows.length} reports in ${reportTableName} for task ${task.taskNumber}`
        );

        // Process each report (there should be only one per task, but handle multiple just in case)
        for (const reportData of reportRes.rows) {
          const report = reportData;

          // FIXED: Get verification images for THIS SPECIFIC TASK only
          const imagesSql = `
            SELECT id, verification_task_id, filename, file_path, file_size, mime_type, photo_type, thumbnail_path, geo_location, submission_id, created_at FROM verification_attachments
            WHERE case_id = $1 AND verification_task_id = $2
            ORDER BY created_at
          `;
          const imagesRes = await query(imagesSql, [caseData.id, task.taskId]);

          // Get user info
          const userSql = `SELECT name, username FROM users WHERE id = $1`;
          const userRes = await query(userSql, [report.verifiedBy]);
          const userName = userRes.rows[0]?.name || userRes.rows[0]?.username || 'Unknown User';

          // Get the actual submission ID from taskFormSubmissions first, then fall back to images
          const tfsRes = await query(
            `SELECT form_submission_id FROM task_form_submissions WHERE verification_task_id = $1 LIMIT 1`,
            [task.taskId]
          );
          // Phase B3: `task.task_id` is undefined after the
          // camelizeRow flip; use the camelCase form consistent
          // with the rest of this function.
          const actualSubmissionId =
            tfsRes.rows[0]?.formSubmissionId ||
            (imagesRes.rows.length > 0 ? imagesRes.rows[0].submissionId : null) ||
            `${verificationType.toLowerCase()}_${task.taskId}_${Date.now()}`;

          // Create comprehensive form submission WITH TASK INFORMATION
          const submission: FormSubmissionData = {
            id: actualSubmissionId,
            caseId,
            formType: report.formType || 'POSITIVE', // Use the actual form type from database
            verificationType,
            outcome: report.verificationOutcome || 'Unknown',
            status: 'SUBMITTED',
            submittedAt: report.verificationDate
              ? `${report.verification_date}T00:00:00.000Z`
              : new Date().toISOString(),
            submittedBy: report.verifiedBy,
            submittedByName: userName,

            // NEW: Add task information to submission
            verificationTaskId: task.taskId,
            verificationTaskNumber: task.taskNumber || '',
            verificationTypeName: task.verificationTypeName || '',
            assignedTo: task.assignedTo,
            assignedToName: task.assignedToName,
            taskStatus: task.taskStatus,

            // Create comprehensive form sections using all available data
            sections: MobileFormController.createComprehensiveFormSectionsFromReport(
              report,
              verificationType,
              report.formType || 'POSITIVE'
            ),

            // Convert verification images to photos format
            photos: imagesRes.rows.map((img, _index) => ({
              id: img.id,
              attachmentId: img.id,
              type: img.photoType === 'selfie' ? 'selfie' : 'verification',
              url: `/api/verification-attachments/${img.id}/download`,
              thumbnailUrl: `/api/verification-attachments/${img.id}/thumbnail`,
              filename: img.filename,
              size: img.fileSize,
              capturedAt: img.createdAt,
              geoLocation: {
                latitude: img.latitude || 0,
                longitude: 0,
                accuracy: 0,
                timestamp: img.createdAt,
                address: 'Location captured during verification',
              },
              metadata: {
                fileSize: img.fileSize,
                mimeType: 'image/jpeg',
                dimensions: { width: 0, height: 0 },
                capturedAt: img.createdAt,
              },
            })),

            attachments: [], // No separate attachments for this form type

            geoLocation: {
              latitude: 0,
              longitude: 0,
              accuracy: 0,
              timestamp: report.verificationDate
                ? `${report.verification_date}T00:00:00.000Z`
                : new Date().toISOString(),
              address: 'Verification location',
            },

            metadata: {
              submissionTimestamp: report.verificationDate
                ? `${report.verification_date}T00:00:00.000Z`
                : new Date().toISOString(),
              deviceInfo: {
                platform: 'ANDROID' as const, // Default for mobile submissions
                model: 'Mobile Device',
                osVersion: 'Unknown',
                appVersion: '1.0.0',
              },
              networkInfo: {
                type: 'WIFI' as const,
              },
              formVersion: '1.0',
              submissionAttempts: 1,
              isOfflineSubmission: false,
            },

            validationStatus: 'VALID',
            validationErrors: [],
          };

          formSubmissions.push(submission);
        }
      }

      res.json({
        success: true,
        message: 'Form submissions retrieved successfully',
        data: {
          caseId,
          submissions: formSubmissions,
          totalCount: formSubmissions.length,
        },
      });
    } catch (error) {
      logger.error('Get case form submissions error:', error);
      logger.error('Error details:', {
        message: error.message,
        stack: error.stack,
        taskId: String(req.params.taskId || ''),
        userId: req.user?.id,
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'FORM_RETRIEVAL_FAILED',
          timestamp: new Date().toISOString(),
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
      });
    }
  }

  // Helper method to determine form type and verification outcome from form data
  private static determineResidenceFormTypeAndOutcome(formData: DynamicFormData): {
    formType: string;
    verificationOutcome: string;
  } {
    return detectResidenceFormType(formData);
  }

  static async submitVerificationForm(this: void, req: AuthenticatedRequest, res: Response) {
    const taskId = String(req.params.taskId || '');
    const formType = String(req.body?.formType || '')
      .trim()
      .toUpperCase();
    const data = req.body?.data;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Task ID is required for form submission',
        error: { code: 'TASK_ID_REQUIRED' },
      });
    }

    if (!formType) {
      return res.status(400).json({
        success: false,
        message: 'formType is required',
        error: { code: 'FORM_TYPE_REQUIRED' },
      });
    }

    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'data payload is required',
        error: { code: 'FORM_DATA_REQUIRED' },
      });
    }

    req.body = {
      ...req.body,
      ...(data as Record<string, unknown>),
      formData:
        (data as { formData?: unknown }).formData &&
        typeof (data as { formData?: unknown }).formData === 'object'
          ? (data as { formData: unknown }).formData
          : data,
    };

    await MobileFormController.recordFormOperation(req, taskId, formType, data);

    switch (formType) {
      case 'RESIDENCE':
        return MobileFormController.submitResidenceVerification(req, res);
      case 'OFFICE':
        return MobileFormController.submitOfficeVerification(req, res);
      case 'BUSINESS':
        return MobileFormController.submitBusinessVerification(req, res);
      case 'BUILDER':
        return MobileFormController.submitBuilderVerification(req, res);
      case 'RESIDENCE_CUM_OFFICE':
        return MobileFormController.submitResidenceCumOfficeVerification(req, res);
      case 'DSA_CONNECTOR':
        return MobileFormController.submitDsaConnectorVerification(req, res);
      case 'PROPERTY_INDIVIDUAL':
        return MobileFormController.submitPropertyIndividualVerification(req, res);
      case 'PROPERTY_APF':
        return MobileFormController.submitPropertyApfVerification(req, res);
      case 'NOC':
        return MobileFormController.submitNocVerification(req, res);
      default:
        return res.status(400).json({
          success: false,
          message: `Unsupported form type: ${formType}`,
          error: { code: 'UNSUPPORTED_FORM_TYPE' },
        });
    }
  }

  // Submit residence verification form
  static async submitResidenceVerification(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      // UPDATED: Accept taskId from URL params (this is verificationTaskId)
      const taskId = String(req.params.taskId || '');
      // Preprocess composite Value+Unit fields from mobile into single fields
      req.body.formData = MobileFormController.preprocessCompositeFields(req.body.formData || {});
      const {
        verificationTaskId,
        formData,
        attachmentIds,
        geoLocation,
        photos,
        images,
      }: MobileFormSubmissionRequest = req.body;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user as never);

      logger.info(`📱 Residence verification submission for task: ${taskId}`);
      logger.info(`   - User: ${userId} (executionActor=${isExecutionActor})`);
      logger.info(`   - Verification Task ID from body: ${verificationTaskId}`);
      logger.info(`   - Images: ${images?.length || 0}`);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!taskId) {
        return res.status(400).json({
          success: false,
          message: 'Task ID is required for form submission',
          error: { code: 'TASK_ID_REQUIRED' },
        });
      }

      // STAGE-2C: STRICT VALIDATION
      const taskValidation = await MobileFormController.validateTaskSubmission(
        taskId,
        userId,
        req.user
      );
      if (!taskValidation.success || !taskValidation.data) {
        return res.status(taskValidation.error.status).json({
          success: false,
          message: taskValidation.error.message,
          error: { code: taskValidation.error.code },
        });
      }

      const {
        caseId,
        caseNumber: _caseNumber,
        taskId: targetTaskId,
        taskNumber,
        verificationTypeName,
      } = taskValidation.data;
      logger.info(`✅ Task Validated: ${targetTaskId} (${taskNumber}) -> Case: ${caseId}`);
      logger.info(`✅ Verification Type: ${verificationTypeName}`);

      // Verify case exists (additional validation)
      const caseRes = await query(`SELECT id, case_id, status FROM cases WHERE id = $1`, [caseId]);
      const existingCase = caseRes.rows[0];

      if (!existingCase) {
        logger.info(`❌ Case not found: ${caseId}`);
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
            caseId,
          },
        });
      }

      logger.info(`✅ Case found: ${caseId} (Case #${existingCase.caseId})`);

      // Determine form type and verification outcome based on form data
      const { formType, verificationOutcome } =
        MobileFormController.determineResidenceFormTypeAndOutcome(formData);

      logger.info(
        `🔍 Detected form type: ${formType}, verification outcome: ${verificationOutcome}`
      );

      // Use comprehensive validation and preparation for residence form data
      const { validationResult, preparedData } = validateAndPrepareResidenceForm(
        formData,
        formType
      );

      // Log comprehensive validation results
      logger.info(`📊 Comprehensive validation for ${formType} residence verification:`, {
        isValid: validationResult.isValid,
        missingFields: validationResult.missingFields,
        warnings: validationResult.warnings,
        fieldCoverage: validationResult.fieldCoverage,
      });

      // Generate and log field coverage report
      const coverageReport = generateFieldCoverageReport(formData, preparedData, formType);
      logger.info(coverageReport);

      // Use the prepared data (which includes all fields with proper defaults)
      const mappedFormData = preparedData;

      // Log warnings if any
      if (!validationResult.isValid) {
        logger.warn(
          `⚠️ Missing required fields for ${formType} form:`,
          validationResult.missingFields
        );
      }
      if (validationResult.warnings.length > 0) {
        logger.warn(
          `⚠️ Validation warnings for ${formType} residence form:`,
          validationResult.warnings
        );
      }

      logger.info(
        `📊 Mapped ${Object.keys(mappedFormData).length} form fields to database columns`
      );

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      // Use images array for new submission format
      const photoCount = MobileFormController.countSubmissionPhotos(
        photos || [],
        images || [],
        attachmentIds || []
      );
      if (photoCount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum 5 geo-tagged photos required for residence verification',
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photoCount,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location (only if photos array exists)
      if (photos && photos.length > 0) {
        const photosWithoutGeo = photos.filter(
          photo => !photo.geoLocation?.latitude || !photo.geoLocation.longitude
        );

        if (photosWithoutGeo.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'All photos must have geo-location data',
            error: {
              code: 'MISSING_GEO_LOCATION',
              details: {
                photosWithoutGeo: photosWithoutGeo.length,
              },
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Generate unique submission ID
      const submissionId = `residence_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Process verification images separately from case attachments
      const uploadedImages = await MobileFormController.processVerificationImages(
        images || [],
        caseId,
        'RESIDENCE',
        submissionId,
        userId,
        taskId,
        attachmentIds || []
      );

      logger.info(
        `✅ Processed ${uploadedImages.length} verification images for residence verification (Task: ${taskNumber})`
      );

      // Prepare verification data (excluding old attachment references)
      const verificationData = {
        formType: 'RESIDENCE',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation,
        formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: geoLocation,
        },
      };

      // Finding #3: wrap all write operations + the consistent re-read in a
      // single transaction so the task-completed state cannot exist without
      // the corresponding verification report + form-submission link.
      const updatedCase = await withTransaction(async client => {
        // a. Update verification task status to COMPLETED
        await client.query(
          `
        UPDATE verification_tasks
        SET status = 'COMPLETED',
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
          [taskId || verificationTaskId]
        );

        // b. Update case status based on ALL tasks (pass the tx client!)
        await CaseStatusSyncService.recalculateCaseStatus(caseId, client);

        // c. Update case with verification data (without changing status)
        await client.query(
          `UPDATE cases SET verification_data = $1, verification_type = 'RESIDENCE', verification_outcome = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [JSON.stringify(verificationData), verificationOutcome, caseId]
        );

        // d. Re-read the case inside the transaction
        const caseUpd = await client.query(
          `SELECT id, case_id, status, completed_at, customer_name, backend_contact_number FROM cases WHERE id = $1`,
          [caseId]
        );
        const updated = caseUpd.rows[0];

        // Create comprehensive residence verification report using all available fields
        const dbInsertData: Record<string, unknown> = {
          // Core case information
          caseId,
          verificationTaskId: taskId,
          formType,
          verificationOutcome,
          customerName: updated.customerName || 'Unknown',
          customerPhone: updated.backendContactNumber || null,
          customerEmail: null, // Not available from case data

          // Verification metadata
          verificationDate: new Date().toISOString().split('T')[0],
          verificationTime: new Date().toTimeString().split(' ')[0],
          verifiedBy: userId,
          totalImages:
            (await MobileFormController.countTaskAttachments(taskId)).totalImages ||
            uploadedImages.length ||
            0,
          totalSelfies:
            (await MobileFormController.countTaskAttachments(taskId)).totalSelfies ||
            uploadedImages.filter(img => img.photoType === 'selfie').length ||
            0,
          remarks: formData.remarks || `${formType} residence verification completed`,

          // Merge all mapped form data (already includes defaults for missing fields)
          ...mappedFormData,
        };

        // Log comprehensive database insert data for debugging
        const nullFields = Object.entries(dbInsertData).filter(([_, value]) => value === null);
        const populatedFields = Object.entries(dbInsertData).filter(
          ([_, value]) => value !== null && value !== undefined && value !== ''
        );

        logger.info(`📝 Final database insert data for ${formType} residence verification:`, {
          totalFields: Object.keys(dbInsertData).length,
          populatedFields: populatedFields.length,
          fieldsWithNullValues: nullFields.length,
          fieldCoveragePercentage: Math.round(
            (populatedFields.length / Object.keys(dbInsertData).length) * 100
          ),
          nullFieldNames: nullFields.map(([key]) => key).slice(0, 10), // Show first 10 null fields
          samplePopulatedData: Object.fromEntries(populatedFields.slice(0, 10)), // Show first 10 populated fields
        });

        // Build dynamic INSERT query based on available data
        const { columns, placeholders, values } = buildInsert(dbInsertData);

        const insertQuery = `
        INSERT INTO residence_verification_reports (${columns})
        VALUES (${placeholders})
      `;

        logger.info(`📝 Inserting residence verification with ${columns.length} fields:`, columns);

        // e. Insert the verification report
        await client.query(insertQuery, values);

        // f. STAGE-2D: Strict Task Completion - Populate taskFormSubmissions.
        //    Any failure here now rolls back the whole submission (Finding #3).
        await client.query(
          `INSERT INTO task_form_submissions (
            id, verification_task_id, case_id, form_submission_id, form_type,
            submitted_by, submitted_at, validation_status
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'PENDING')`,
          [
            uuidv4(), // taskFormSubmission record ID
            targetTaskId,
            caseId,
            uuidv4(), // NEW: formSubmissionId (mandatory)
            'RESIDENCE_VERIFICATION',
            userId,
          ]
        );
        logger.info(`✅ Linked residence form submission to task ${targetTaskId}`);

        // g. Remove auto-save data (autoSaves table doesn't have formType column)
        await client.query(`DELETE FROM auto_saves WHERE case_id = $1::uuid`, [caseId]);

        return updated;
      });

      await createAuditLog({
        action: 'RESIDENCE_VERIFICATION_SUBMITTED',
        entityType: 'CASE',
        entityId: caseId,
        userId,
        details: {
          formType: 'RESIDENCE',
          submissionId,
          verificationImageCount: uploadedImages.length,
          geoTaggedImageCount: uploadedImages.filter(img => img.geoLocation).length,
          outcome: formData.outcome,
          hasGeoLocation: !!geoLocation,
          caseNumber: existingCase.caseId,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      logger.info(`✅ Residence verification completed successfully:`, {
        caseId,
        formType,
        verificationOutcome,
        imageCount: uploadedImages.length,
      });

      // Send case completion notification to backend users
      await MobileFormController.sendCaseCompletionNotification(
        caseId,
        updatedCase.caseId,
        updatedCase.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: `${formType} residence verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          caseNumber: updatedCase.caseId,
          taskId: verificationTaskId, // ✅ ADDED: Explicit Task ID for mobile app
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          submissionId,
          formType,
          verificationOutcome,
          verificationImageCount: uploadedImages.length,
          verificationData,
        },
      });
    } catch (error) {
      logger.error('Submit residence verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Submit office verification form
  static async submitOfficeVerification(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      // UPDATED: Accept taskId from URL params (this is verificationTaskId)
      const taskId = String(req.params.taskId || '');
      // Preprocess composite Value+Unit fields from mobile into single fields
      req.body.formData = MobileFormController.preprocessCompositeFields(req.body.formData || {});
      const {
        verificationTaskId,
        formData,
        attachmentIds,
        geoLocation,
        photos,
        images,
      }: MobileFormSubmissionRequest = req.body;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user as never);

      logger.info(`📱 Office verification submission for task: ${taskId}`);
      logger.info(`   - User: ${userId} (executionActor=${isExecutionActor})`);
      logger.info(`   - Verification Task ID from body: ${verificationTaskId}`);
      logger.info(`   - Images: ${images?.length || 0}`);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!taskId) {
        return res.status(400).json({
          success: false,
          message: 'Task ID is required for form submission',
          error: { code: 'TASK_ID_REQUIRED' },
        });
      }

      // STAGE-2C: STRICT VALIDATION
      const taskValidation = await MobileFormController.validateTaskSubmission(
        taskId,
        userId,
        req.user
      );
      if (!taskValidation.success || !taskValidation.data) {
        return res.status(taskValidation.error.status).json({
          success: false,
          message: taskValidation.error.message,
          error: { code: taskValidation.error.code },
        });
      }

      const {
        caseId,
        caseNumber: _caseNumber,
        taskId: targetTaskId,
        taskNumber,
        verificationTypeName,
      } = taskValidation.data;
      logger.info(`✅ Task Validated: ${targetTaskId} (${taskNumber}) -> Case: ${caseId}`);
      logger.info(`✅ Verification Type: ${verificationTypeName}`);

      // Verify case exists (additional validation)
      const caseQuery = await query(
        `SELECT id, case_id, customer_name, backend_contact_number as "system_contact" FROM cases WHERE id = $1`,
        [caseId]
      );
      if (caseQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const existingCase = caseQuery.rows[0];

      logger.info(`✅ Case found: ${caseId} (Case #${existingCase.caseId})`);

      // Determine form type and verification outcome based on form data
      const { formType, verificationOutcome } = detectOfficeFormType(formData);

      logger.info(
        `🔍 Detected form type: ${formType}, verification outcome: ${verificationOutcome}`
      );

      // Use comprehensive validation and preparation for office form data
      const { validationResult, preparedData } = validateAndPrepareOfficeForm(formData, formType);

      // Log comprehensive validation results
      logger.info(`📊 Comprehensive validation for ${formType} office verification:`, {
        isValid: validationResult.isValid,
        missingFields: validationResult.missingFields,
        warnings: validationResult.warnings,
        fieldCoverage: validationResult.fieldCoverage,
      });

      // Generate and log field coverage report
      const coverageReport = generateOfficeFieldCoverageReport(formData, preparedData, formType);
      logger.info(coverageReport);

      // Use the prepared data (which includes all fields with proper defaults)
      const mappedFormData = preparedData;

      // Log warnings if any
      if (!validationResult.isValid) {
        logger.warn(
          `⚠️ Missing required fields for ${formType} office form:`,
          validationResult.missingFields
        );
      }
      if (validationResult.warnings.length > 0) {
        logger.warn(
          `⚠️ Validation warnings for ${formType} office form:`,
          validationResult.warnings
        );
      }

      // Validate required fields for the detected form type
      const validation = validateOfficeRequiredFields(formData, formType);
      if (!validation.isValid) {
        logger.warn(
          `⚠️ Missing required fields for ${formType} office form:`,
          validation.missingFields
        );
      }
      if (validation.warnings.length > 0) {
        logger.warn(`⚠️ Office form validation warnings:`, validation.warnings);
      }

      logger.info(
        `📊 Mapped ${Object.keys(mappedFormData).length} office form fields to database columns`
      );

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      // Use images array for new submission format
      const photoCount = MobileFormController.countSubmissionPhotos(
        photos || [],
        images || [],
        attachmentIds || []
      );
      if (photoCount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum 5 geo-tagged photos required for office verification',
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photoCount,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location (only if photos array exists)
      if (photos && photos.length > 0) {
        const photosWithoutGeo = photos.filter(
          photo => !photo.geoLocation?.latitude || !photo.geoLocation.longitude
        );

        if (photosWithoutGeo.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'All photos must have geo-location data',
            error: {
              code: 'MISSING_GEO_LOCATION',
              details: {
                photosWithoutGeo: photosWithoutGeo.length,
              },
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Generate unique submission ID
      const submissionId = `office_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Process verification images separately from case attachments
      const uploadedImages = await MobileFormController.processVerificationImages(
        images || [],
        caseId,
        'OFFICE',
        submissionId,
        userId,
        taskId,
        attachmentIds || []
      );

      logger.info(
        `✅ Processed ${uploadedImages.length} verification images for office verification (Task: ${taskNumber})`
      );

      // Prepare verification data (excluding old attachment references)
      const verificationData = {
        formType: 'OFFICE',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation,
        formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: geoLocation,
        },
      };

      // Finding #3: wrap writes + consistent re-read in a single transaction.
      const updatedCase = await withTransaction(async client => {
        // a. Update verification task status to COMPLETED
        await client.query(
          `
        UPDATE verification_tasks
        SET status = 'COMPLETED',
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
          [taskId || verificationTaskId]
        );

        // b. Recalculate case status (pass tx client)
        await CaseStatusSyncService.recalculateCaseStatus(caseId, client);

        // c. Update case with verification data (without changing status)
        await client.query(
          `UPDATE cases SET verification_data = $1, verification_type = 'OFFICE', verification_outcome = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [JSON.stringify(verificationData), verificationOutcome, caseId]
        );

        // d. Re-read case inside transaction
        const caseUpd = await client.query(
          `SELECT id, case_id, status, completed_at, customer_name, backend_contact_number FROM cases WHERE id = $1`,
          [caseId]
        );
        const updated = caseUpd.rows[0];

        // Commission is now handled at the verification task level.
        // Legacy Case-level commission trigger removed to avoid duplication.

        // Create comprehensive office verification report using all available fields
        const dbInsertData: Record<string, unknown> = {
          // Core case information
          caseId,
          verificationTaskId: taskId,
          formType,
          verificationOutcome,
          customerName: updated.customerName || 'Unknown',
          customerPhone: updated.backendContactNumber || null,
          customerEmail: null, // Not available from case data

          // Verification metadata
          verificationDate: new Date().toISOString().split('T')[0],
          verificationTime: new Date().toTimeString().split(' ')[0],
          verifiedBy: userId,
          totalImages:
            (await MobileFormController.countTaskAttachments(taskId)).totalImages ||
            uploadedImages.length ||
            0,
          totalSelfies:
            (await MobileFormController.countTaskAttachments(taskId)).totalSelfies ||
            uploadedImages.filter(img => img.photoType === 'selfie').length ||
            0,
          remarks: formData.remarks || `${formType} office verification completed`,

          // Merge all mapped form data
          ...mappedFormData,
        };

        // Build dynamic INSERT query based on available data
        const { columns, placeholders, values } = buildInsert(dbInsertData);

        const insertQuery = `
        INSERT INTO office_verification_reports (${columns})
        VALUES (${placeholders})
      `;

        // Log comprehensive database insert data for debugging
        const nullFields = Object.entries(dbInsertData).filter(([_, value]) => value === null);
        const populatedFields = Object.entries(dbInsertData).filter(
          ([_, value]) => value !== null && value !== undefined && value !== ''
        );

        logger.info(`📝 Final database insert data for ${formType} office verification:`, {
          totalFields: Object.keys(dbInsertData).length,
          populatedFields: populatedFields.length,
          fieldsWithNullValues: nullFields.length,
          fieldCoveragePercentage: Math.round(
            (populatedFields.length / Object.keys(dbInsertData).length) * 100
          ),
          nullFieldNames: nullFields.map(([key]) => key).slice(0, 10),
          samplePopulatedData: Object.fromEntries(populatedFields.slice(0, 10)),
        });

        logger.info(`📝 Inserting office verification with ${columns.length} fields:`, columns);

        // e. Insert the verification report
        await client.query(insertQuery, values);

        // f. Populate taskFormSubmissions (no swallow — Finding #3).
        await client.query(
          `INSERT INTO task_form_submissions (
            id, verification_task_id, case_id, form_submission_id, form_type,
            submitted_by, submitted_at, validation_status
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'PENDING')`,
          [uuidv4(), targetTaskId, caseId, uuidv4(), 'OFFICE_VERIFICATION', userId]
        );
        logger.info(`✅ Linked office form submission to task ${targetTaskId}`);

        // g. Remove auto-save data
        await client.query(`DELETE FROM auto_saves WHERE case_id = $1::uuid`, [caseId]);

        return updated;
      });

      await createAuditLog({
        action: 'OFFICE_VERIFICATION_SUBMITTED',
        entityType: 'CASE',
        entityId: caseId,
        userId,
        details: {
          formType,
          verificationOutcome,
          imageCount: uploadedImages.length,
          submissionId,
          hasGeoLocation: !!geoLocation,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      logger.info(`✅ Office verification completed successfully:`, {
        caseId,
        formType,
        verificationOutcome,
        imageCount: uploadedImages.length,
      });

      // Send case completion notification to backend users
      await MobileFormController.sendCaseCompletionNotification(
        caseId,
        updatedCase.caseId,
        updatedCase.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: `${formType} office verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          caseNumber: updatedCase.caseId,
          taskId: verificationTaskId, // ✅ ADDED: Explicit Task ID for mobile app
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          submissionId,
          formType,
          verificationOutcome,
          verificationImageCount: uploadedImages.length,
          verificationData,
        },
      });
    } catch (error) {
      logger.error('Submit office verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Submit business verification form
  static async submitBusinessVerification(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      // UPDATED: Accept taskId from URL params (this is verificationTaskId)
      const taskId = String(req.params.taskId || '');
      // Preprocess composite Value+Unit fields from mobile into single fields
      req.body.formData = MobileFormController.preprocessCompositeFields(req.body.formData || {});
      const {
        verificationTaskId,
        formData,
        attachmentIds,
        geoLocation,
        photos,
        images,
      }: MobileFormSubmissionRequest = req.body;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user as never);

      logger.info(`📱 Business verification submission for task: ${taskId}`);
      logger.info(`   - User: ${userId} (executionActor=${isExecutionActor})`);
      logger.info(`   - Verification Task ID from body: ${verificationTaskId}`);
      logger.info(`   - Images: ${images?.length || 0}`);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!taskId) {
        return res.status(400).json({
          success: false,
          message: 'Task ID is required for form submission',
          error: { code: 'TASK_ID_REQUIRED' },
        });
      }

      // STAGE-2C: STRICT VALIDATION
      const taskValidation = await MobileFormController.validateTaskSubmission(
        taskId,
        userId,
        req.user
      );
      if (!taskValidation.success || !taskValidation.data) {
        return res.status(taskValidation.error.status).json({
          success: false,
          message: taskValidation.error.message,
          error: { code: taskValidation.error.code },
        });
      }

      const {
        caseId,
        caseNumber: _caseNumber,
        taskId: targetTaskId,
        taskNumber,
        verificationTypeName,
      } = taskValidation.data;
      logger.info(`✅ Task Validated: ${targetTaskId} (${taskNumber}) -> Case: ${caseId}`);
      logger.info(`✅ Verification Type: ${verificationTypeName}`);

      if (!formData) {
        return res.status(400).json({
          success: false,
          message: 'Form data is required',
          error: {
            code: 'FORM_DATA_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate case exists
      const caseQuery = await query(
        `SELECT id, case_id, customer_name, backend_contact_number as "system_contact" FROM cases WHERE id = $1`,
        [caseId]
      );
      if (caseQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const existingCase = caseQuery.rows[0];

      logger.info(`✅ Case found: ${caseId} (Case #${existingCase.caseId})`);

      // Determine form type and verification outcome based on form data
      const { formType, verificationOutcome } = detectBusinessFormType(formData);

      logger.info(
        `🔍 Detected form type: ${formType}, verification outcome: ${verificationOutcome}`
      );

      // Use comprehensive validation and preparation for business form data
      const { validationResult, preparedData } = validateAndPrepareBusinessForm(formData, formType);

      // Log comprehensive validation results
      logger.info(`📊 Comprehensive validation for ${formType} business verification:`, {
        isValid: validationResult.isValid,
        missingFields: validationResult.missingFields,
        warnings: validationResult.warnings,
        fieldCoverage: validationResult.fieldCoverage,
      });

      // Generate and log field coverage report
      const coverageReport = generateBusinessFieldCoverageReport(formData, preparedData, formType);
      logger.info(coverageReport);

      // Use the prepared data (which includes all fields with proper defaults)
      const mappedFormData = preparedData;

      // Log warnings if any
      if (!validationResult.isValid) {
        logger.warn(
          `⚠️ Missing required fields for ${formType} business form:`,
          validationResult.missingFields
        );
      }
      if (validationResult.warnings.length > 0) {
        logger.warn(
          `⚠️ Validation warnings for ${formType} business form:`,
          validationResult.warnings
        );
      }

      // Validate required fields for the detected form type
      const validation = validateBusinessRequiredFields(formData, formType);
      if (!validation.isValid) {
        logger.warn(
          `⚠️ Missing required fields for ${formType} business form:`,
          validation.missingFields
        );
      }
      if (validation.warnings.length > 0) {
        logger.warn(`⚠️ Business form validation warnings:`, validation.warnings);
      }

      logger.info(
        `📊 Mapped ${Object.keys(mappedFormData).length} business form fields to database columns`
      );

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      // Use images array for new submission format
      const photoCount = MobileFormController.countSubmissionPhotos(
        photos || [],
        images || [],
        attachmentIds || []
      );
      if (photoCount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum 5 geo-tagged photos required for business verification',
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photoCount,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location (only if photos array exists)
      if (photos && photos.length > 0) {
        const photosWithoutGeo = photos.filter(
          photo => !photo.geoLocation?.latitude || !photo.geoLocation.longitude
        );

        if (photosWithoutGeo.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'All photos must have geo-location data',
            error: {
              code: 'MISSING_GEO_LOCATION',
              details: {
                photosWithoutGeo: photosWithoutGeo.length,
              },
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Generate unique submission ID
      const submissionId = `business_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Process verification images separately from case attachments
      const uploadedImages = await MobileFormController.processVerificationImages(
        images || [],
        caseId,
        'BUSINESS',
        submissionId,
        userId,
        taskId,
        attachmentIds || []
      );

      logger.info(
        `✅ Processed ${uploadedImages.length} verification images for business verification (Task: ${taskNumber})`
      );

      // Prepare verification data (excluding old attachment references)
      const verificationData = {
        formType: 'BUSINESS',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation,
        formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: geoLocation,
        },
      };

      // Finding #3: wrap writes + consistent re-read in a single transaction.
      const updatedCase = await withTransaction(async client => {
        // a. Update verification task status to COMPLETED
        await client.query(
          `
        UPDATE verification_tasks
        SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
          [taskId || verificationTaskId]
        );

        // b. Recalculate case status (pass tx client)
        await CaseStatusSyncService.recalculateCaseStatus(caseId, client);

        // c. Update case with verification data (without changing status)
        await client.query(
          `UPDATE cases SET verification_data = $1, verification_type = 'BUSINESS', verification_outcome = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [JSON.stringify(verificationData), verificationOutcome, caseId]
        );

        // d. Re-read case inside transaction
        const caseUpd = await client.query(
          `SELECT id, case_id, status, completed_at, customer_name, backend_contact_number FROM cases WHERE id = $1`,
          [caseId]
        );
        const updated = caseUpd.rows[0];

        // Commission is now handled at the verification task level.
        // Legacy Case-level commission trigger removed to avoid duplication.

        // Create comprehensive business verification report using all available fields
        const dbInsertData: Record<string, unknown> = {
          // Core case information
          caseId,
          verificationTaskId: taskId,
          formType,
          verificationOutcome,
          customerName: updated.customerName || 'Unknown',
          customerPhone: updated.backendContactNumber || null,
          customerEmail: null, // Not available from case data

          // Verification metadata
          verificationDate: new Date().toISOString().split('T')[0],
          verificationTime: new Date().toTimeString().split(' ')[0],
          verifiedBy: userId,
          totalImages:
            (await MobileFormController.countTaskAttachments(taskId)).totalImages ||
            uploadedImages.length ||
            0,
          totalSelfies:
            (await MobileFormController.countTaskAttachments(taskId)).totalSelfies ||
            uploadedImages.filter(img => img.photoType === 'selfie').length ||
            0,
          remarks: formData.remarks || `${formType} business verification completed`,

          // Merge all mapped form data
          ...mappedFormData,
        };

        // Ensure finalStatus is always provided (required field)
        if (!dbInsertData['finalStatus']) {
          // Map outcome to finalStatus if not provided
          const outcomeToFinalStatusMap: Record<string, string> = {
            VERIFIED: 'Positive',
            NOT_VERIFIED: 'Negative',
            FRAUD: 'Fraud',
            REFER: 'Refer',
            HOLD: 'Hold',
            PARTIAL: 'Refer',
          };

          const outcome = formData.outcome || 'VERIFIED';
          const resolvedFinalStatus = outcomeToFinalStatusMap[outcome] || 'Positive';
          dbInsertData.finalStatus = resolvedFinalStatus;
          logger.info(
            `🔧 Auto-mapped outcome '${String(outcome)}' to finalStatus '${resolvedFinalStatus}'`
          );
        }

        const { columns, placeholders, values } = buildInsert(dbInsertData);
        logger.info(`🔍 Columns for SQL insert:`, columns);

        const insertQuery = `
        INSERT INTO business_verification_reports (${columns})
        VALUES (${placeholders})
      `;

        // Log comprehensive database insert data for debugging
        const nullFields = Object.entries(dbInsertData).filter(([_, value]) => value === null);
        const populatedFields = Object.entries(dbInsertData).filter(
          ([_, value]) => value !== null && value !== undefined && value !== ''
        );

        logger.info(`📝 Final database insert data for ${formType} business verification:`, {
          totalFields: Object.keys(dbInsertData).length,
          populatedFields: populatedFields.length,
          fieldsWithNullValues: nullFields.length,
          fieldCoveragePercentage: Math.round(
            (populatedFields.length / Object.keys(dbInsertData).length) * 100
          ),
          nullFieldNames: nullFields.map(([key]) => key).slice(0, 10),
          samplePopulatedData: Object.fromEntries(populatedFields.slice(0, 10)),
        });

        logger.info(`📝 Inserting business verification with ${columns.length} fields:`, columns);

        // e. Insert the verification report
        await client.query(insertQuery, values);

        // f. Populate taskFormSubmissions (no swallow — Finding #3).
        await client.query(
          `INSERT INTO task_form_submissions (
            id, verification_task_id, case_id, form_submission_id, form_type,
            submitted_by, submitted_at, validation_status
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'PENDING')`,
          [uuidv4(), targetTaskId, caseId, uuidv4(), 'BUSINESS_VERIFICATION', userId]
        );
        logger.info(`✅ Linked business form submission to task ${targetTaskId}`);

        // g. Remove auto-save data
        await client.query(`DELETE FROM auto_saves WHERE case_id = $1::uuid`, [caseId]);

        return updated;
      });

      await createAuditLog({
        action: 'BUSINESS_VERIFICATION_SUBMITTED',
        entityType: 'CASE',
        entityId: caseId,
        userId,
        details: {
          formType,
          verificationOutcome,
          imageCount: uploadedImages.length,
          submissionId,
          hasGeoLocation: !!geoLocation,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      logger.info(`✅ Business verification completed successfully:`, {
        caseId,
        formType,
        verificationOutcome,
        imageCount: uploadedImages.length,
      });

      // Send case completion notification to backend users
      await MobileFormController.sendCaseCompletionNotification(
        caseId,
        updatedCase.caseId,
        updatedCase.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: `${formType} business verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          caseNumber: updatedCase.caseId,
          taskId: verificationTaskId, // ✅ ADDED: Explicit Task ID for mobile app
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          submissionId,
          formType,
          verificationOutcome,
          verificationImageCount: uploadedImages.length,
          verificationData,
        },
      });
    } catch (error) {
      logger.error('Submit business verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Submit builder verification form
  static async submitBuilderVerification(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      // UPDATED: Accept taskId from URL params (this is verificationTaskId)
      const taskId = String(req.params.taskId || '');
      // Preprocess composite Value+Unit fields from mobile into single fields
      req.body.formData = MobileFormController.preprocessCompositeFields(req.body.formData || {});
      const {
        verificationTaskId,
        formData,
        attachmentIds,
        geoLocation,
        photos,
        images,
      }: MobileFormSubmissionRequest = req.body;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user as never);

      logger.info(`📱 Builder verification submission for task: ${taskId}`);
      logger.info(`   - User: ${userId} (executionActor=${isExecutionActor})`);
      logger.info(`   - Verification Task ID from body: ${verificationTaskId}`);
      logger.info(`   - Images: ${images?.length || 0}`);
      logger.info(`   - Form data keys: ${Object.keys(formData || {}).join(', ')}`);
      logger.info(
        `   - Form data outcome: ${formData?.outcome || formData?.finalStatus || 'Not specified'}`
      );

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!verificationTaskId && !taskId) {
        return res.status(400).json({
          success: false,
          message: 'Verification task ID is required',
          error: {
            code: 'MISSING_TASK_ID',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // UPDATED: Auto-resolve caseId from verificationTaskId
      const resolution = await MobileFormController.resolveCaseIdFromTaskId(
        taskId,
        userId,
        req.user
      );

      if (!resolution.success) {
        logger.info(`❌ Failed to resolve case from task: ${taskId}`);
        return res.status(resolution.error.status).json({
          success: false,
          message: resolution.error.message,
          error: {
            code: resolution.error.code,
            timestamp: new Date().toISOString(),
            taskId,
          },
        });
      }

      const caseId = resolution.caseId;
      const task = resolution.task;

      logger.info(`✅ Resolved caseId: ${caseId} from taskId: ${taskId}`);
      logger.info(
        `✅ Verification task validated: ${task.taskNumber} (Type: ${task.verificationTypeName})`
      );

      // Determine form type and verification outcome based on form data
      const { formType, verificationOutcome } = detectBusinessFormType(formData); // Use business detection for builder (similar structure)

      logger.info(
        `🔍 Detected form type: ${formType}, verification outcome: ${verificationOutcome}`
      );

      // Use comprehensive validation and preparation for builder form data
      const { validationResult, preparedData } = validateAndPrepareBuilderForm(formData, formType);

      // Log comprehensive validation results
      logger.info(`📊 Comprehensive validation for ${formType} builder verification:`, {
        isValid: validationResult.isValid,
        missingFields: validationResult.missingFields,
        warnings: validationResult.warnings,
        fieldCoverage: validationResult.fieldCoverage,
      });

      // Generate and log field coverage report
      const coverageReport = generateBuilderFieldCoverageReport(formData, preparedData, formType);
      logger.info(coverageReport);

      // Use the prepared data (which includes all fields with proper defaults)
      const mappedFormData = preparedData;

      // Log warnings if any
      if (!validationResult.isValid) {
        logger.warn(
          `⚠️ Missing required fields for ${formType} builder form:`,
          validationResult.missingFields
        );
      }
      if (validationResult.warnings.length > 0) {
        logger.warn(
          `⚠️ Validation warnings for ${formType} builder form:`,
          validationResult.warnings
        );
      }

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      // Use images array for new submission format
      const photoCount = MobileFormController.countSubmissionPhotos(
        photos || [],
        images || [],
        attachmentIds || []
      );
      if (photoCount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum 5 geo-tagged photos required for builder verification',
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photoCount,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location (only if photos array exists)
      if (photos && photos.length > 0) {
        const photosWithoutGeo = photos.filter(
          photo => !photo.geoLocation?.latitude || !photo.geoLocation.longitude
        );

        if (photosWithoutGeo.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'All photos must have geo-location data',
            error: {
              code: 'MISSING_GEO_LOCATION',
              details: {
                photosWithoutGeo: photosWithoutGeo.length,
              },
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Generate unique submission ID
      const submissionId = `builder_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Process verification images separately from case attachments
      const uploadedImages = await MobileFormController.processVerificationImages(
        images || [],
        caseId,
        'BUILDER',
        submissionId,
        userId,
        taskId,
        attachmentIds || []
      );

      logger.info(
        `✅ Processed ${uploadedImages.length} verification images for builder verification (Task: ${task.taskNumber})`
      );

      // Prepare verification data (excluding old attachment references)
      const verificationData = {
        formType: 'BUILDER',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation,
        formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: geoLocation,
        },
      };

      // Finding #3: wrap writes + consistent re-read in a single transaction.
      const updatedCase = await withTransaction(async client => {
        // a. Update verification task status to COMPLETED
        await client.query(
          `
        UPDATE verification_tasks
        SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
          [taskId || verificationTaskId]
        );

        // b. Recalculate case status (pass tx client)
        await CaseStatusSyncService.recalculateCaseStatus(caseId, client);

        // c. Update case with verification data (without changing status)
        await client.query(
          `UPDATE cases SET verification_data = $1, verification_type = 'BUILDER', verification_outcome = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [JSON.stringify(verificationData), verificationOutcome, caseId]
        );

        // d. Re-read case inside transaction
        const caseUpd = await client.query(
          `SELECT id, case_id, status, completed_at, customer_name, backend_contact_number FROM cases WHERE id = $1`,
          [caseId]
        );
        const updated = caseUpd.rows[0];

        // Commission is now handled at the verification task level.
        // Legacy Case-level commission trigger removed to avoid duplication.

        // Create comprehensive builder verification report using all available fields
        const dbInsertData: Record<string, unknown> = {
          // Core case information
          caseId,
          verificationTaskId: taskId,
          formType,
          verificationOutcome,
          customerName: updated.customerName || 'Unknown',
          customerPhone: updated.backendContactNumber || null,
          customerEmail: null, // Not available from case data

          // Verification metadata
          verificationDate: new Date().toISOString().split('T')[0],
          verificationTime: new Date().toTimeString().split(' ')[0],
          verifiedBy: userId,
          totalImages:
            (await MobileFormController.countTaskAttachments(taskId)).totalImages ||
            uploadedImages.length ||
            0,
          totalSelfies:
            (await MobileFormController.countTaskAttachments(taskId)).totalSelfies ||
            uploadedImages.filter(img => img.photoType === 'selfie').length ||
            0,
          remarks: formData.remarks || `${formType} builder verification completed`,

          // Merge all mapped form data
          ...mappedFormData,
        };

        const { columns, placeholders, values } = buildInsert(dbInsertData);
        logger.info('🔍 Columns for SQL insert:', columns);

        const insertQuery = `
        INSERT INTO builder_verification_reports (${columns})
        VALUES (${placeholders})
      `;

        // Log comprehensive database insert data for debugging
        const nullFields = Object.entries(dbInsertData).filter(([_, value]) => value === null);
        const populatedFields = Object.entries(dbInsertData).filter(
          ([_, value]) => value !== null && value !== undefined && value !== ''
        );

        logger.info(`📝 Final database insert data for ${formType} builder verification:`, {
          totalFields: Object.keys(dbInsertData).length,
          populatedFields: populatedFields.length,
          fieldsWithNullValues: nullFields.length,
          fieldCoveragePercentage: Math.round(
            (populatedFields.length / Object.keys(dbInsertData).length) * 100
          ),
          nullFieldNames: nullFields.map(([key]) => key).slice(0, 10),
          samplePopulatedData: Object.fromEntries(populatedFields.slice(0, 10)),
        });

        logger.info(`📝 Inserting builder verification with ${columns.length} fields:`, columns);

        // e. Insert the verification report
        await client.query(insertQuery, values);

        // f. Populate taskFormSubmissions (no swallow — Finding #3).
        await client.query(
          `INSERT INTO task_form_submissions (
            id, verification_task_id, case_id, form_submission_id, form_type,
            submitted_by, submitted_at, validation_status
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'PENDING')`,
          [uuidv4(), taskId || verificationTaskId, caseId, uuidv4(), 'BUILDER_VERIFICATION', userId]
        );
        logger.info(`✅ Linked builder form submission to task ${verificationTaskId}`);

        // g. Remove auto-save data
        await client.query(`DELETE FROM auto_saves WHERE case_id = $1::uuid`, [caseId]);

        return updated;
      });

      await createAuditLog({
        action: 'BUILDER_VERIFICATION_SUBMITTED',
        entityType: 'CASE',
        entityId: caseId,
        userId,
        details: {
          formType,
          verificationOutcome,
          imageCount: uploadedImages.length,
          submissionId,
          hasGeoLocation: !!geoLocation,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      logger.info(`✅ Builder verification completed successfully:`, {
        caseId,
        formType,
        verificationOutcome,
        imageCount: uploadedImages.length,
      });

      // Send case completion notification to backend users
      await MobileFormController.sendCaseCompletionNotification(
        caseId,
        updatedCase.caseId,
        updatedCase.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: `${formType} builder verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          caseNumber: updatedCase.caseId,
          taskId: verificationTaskId, // ✅ ADDED: Explicit Task ID for mobile app
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          submissionId,
          formType,
          verificationOutcome,
          verificationImageCount: uploadedImages.length,
          verificationData,
        },
      });
    } catch (error) {
      logger.error('Submit builder verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Submit residence-cum-office verification form
  static async submitResidenceCumOfficeVerification(
    this: void,
    req: AuthenticatedRequest,
    res: Response
  ) {
    try {
      const taskId = String(req.params.taskId || '');
      // Preprocess composite Value+Unit fields from mobile into single fields
      req.body.formData = MobileFormController.preprocessCompositeFields(req.body.formData || {});
      const submissionData: MobileFormSubmissionRequest = req.body;
      const userId = req.user?.id;

      // UPDATED: Auto-resolve caseId from verificationTaskId
      const resolution = await MobileFormController.resolveCaseIdFromTaskId(
        taskId,
        userId,
        req.user
      );

      if (!resolution.success) {
        logger.info(`❌ Failed to resolve case from task: ${taskId}`);
        return res.status(resolution.error.status).json({
          success: false,
          message: resolution.error.message,
          error: {
            code: resolution.error.code,
            timestamp: new Date().toISOString(),
            taskId,
          },
        });
      }

      const caseId = resolution.caseId;

      logger.info(
        `📱 Residence-cum-office verification submission for task ${taskId} (case ${caseId})`
      );

      const { formType, verificationOutcome } = detectResidenceCumOfficeFormType(
        submissionData.formData
      );

      const { validationResult, preparedData } = validateAndPrepareResidenceCumOfficeForm(
        submissionData.formData,
        formType
      );

      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Form validation failed',
          error: {
            code: 'VALIDATION_FAILED',
            details: validationResult.missingFields,
          },
        });
      }

      const submissionId = `residence_cum_office_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      const uploadedImages = await MobileFormController.processVerificationImages(
        submissionData.images || [],
        caseId,
        'RESIDENCE_CUM_OFFICE',
        submissionId,
        userId,
        taskId,
        submissionData.attachmentIds || []
      );

      // Prepare verification data for cases table (pure JS — safe above the tx)
      const verificationData = {
        formType: 'RESIDENCE_CUM_OFFICE',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation: submissionData.geoLocation,
        formData: submissionData.formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...submissionData.formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: submissionData.geoLocation,
        },
      };

      // Finding #3: wrap writes + consistent re-read in a single transaction.
      const updatedCase = await withTransaction(async client => {
        // a. Update verification task status to COMPLETED
        await client.query(
          `UPDATE verification_tasks
         SET status = 'COMPLETED',
             completed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
          [taskId]
        );

        // b. Recalculate case status (pass tx client)
        await CaseStatusSyncService.recalculateCaseStatus(caseId, client);

        // c. Update case with verification data
        await client.query(
          `UPDATE cases SET verification_data = $1, verification_type = 'RESIDENCE_CUM_OFFICE', verification_outcome = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [JSON.stringify(verificationData), verificationOutcome, caseId]
        );

        // d. Re-read case inside transaction
        const caseUpd = await client.query(
          `SELECT id, case_id, status, completed_at, customer_name, backend_contact_number FROM cases WHERE id = $1`,
          [caseId]
        );
        const updated = caseUpd.rows[0];

        // Build the report data using mapped fields
        const mappedFormData = preparedData;
        const dbInsertData: Record<string, unknown> = {
          caseId,
          verificationTaskId: taskId,
          formType,
          verificationOutcome,
          customerName: updated.customerName || 'Unknown',
          customerPhone: updated.backendContactNumber || null,
          customerEmail: null,
          verificationDate: new Date().toISOString().split('T')[0],
          verificationTime: new Date().toTimeString().split(' ')[0],
          verifiedBy: userId,
          totalImages:
            (await MobileFormController.countTaskAttachments(taskId)).totalImages ||
            uploadedImages.length ||
            0,
          totalSelfies:
            (await MobileFormController.countTaskAttachments(taskId)).totalSelfies ||
            uploadedImages.filter(img => img.photoType === 'selfie').length ||
            0,
          remarks:
            submissionData.formData.remarks ||
            `${formType} residence-cum-office verification completed`,
          ...mappedFormData,
        };

        // Build dynamic INSERT query
        const { columns, placeholders, values } = buildInsert(dbInsertData);

        const insertQuery = `
        INSERT INTO residence_cum_office_verification_reports (${columns})
        VALUES (${placeholders})
      `;

        logger.info(
          `📝 Inserting residence-cum-office verification with ${columns.length} fields:`,
          columns
        );

        // e. Insert the verification report
        await client.query(insertQuery, values);

        // f. Populate taskFormSubmissions (no swallow — Finding #3).
        await client.query(
          `INSERT INTO task_form_submissions (
            id, verification_task_id, case_id, form_submission_id, form_type,
            submitted_by, submitted_at, validation_status
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'PENDING')`,
          [uuidv4(), taskId, caseId, uuidv4(), 'RESIDENCE_CUM_OFFICE_VERIFICATION', userId]
        );
        logger.info(`✅ Linked residence-cum-office form submission to task ${taskId}`);

        // g. Remove auto-save data
        await client.query(`DELETE FROM auto_saves WHERE case_id = $1::uuid`, [caseId]);

        return updated;
      });

      await createAuditLog({
        action: 'RESIDENCE_CUM_OFFICE_VERIFICATION_SUBMITTED',
        entityType: 'VERIFICATION_TASK',
        entityId: taskId,
        userId,
        details: {
          caseId,
          formType: 'RESIDENCE_CUM_OFFICE',
          photoCount: uploadedImages.length,
          outcome: verificationOutcome,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Send case completion notification
      await MobileFormController.sendCaseCompletionNotification(
        caseId,
        updatedCase?.caseId,
        updatedCase?.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: 'Residence-cum-office verification submitted successfully',
        data: {
          submissionId,
          taskId,
          caseId,
          caseNumber: updatedCase?.caseId,
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Submit residence-cum-office verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Submit DSA/DST connector verification form
  static async submitDsaConnectorVerification(
    this: void,
    req: AuthenticatedRequest,
    res: Response
  ) {
    try {
      // UPDATED: Accept taskId from URL params (this is verificationTaskId)
      const taskId = String(req.params.taskId || '');
      // Preprocess composite Value+Unit fields from mobile into single fields
      req.body.formData = MobileFormController.preprocessCompositeFields(req.body.formData || {});
      const {
        verificationTaskId,
        formData,
        attachmentIds,
        geoLocation,
        photos,
        images,
      }: MobileFormSubmissionRequest = req.body;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user as never);

      logger.info(`📱 DSA/DST Connector verification submission for task: ${taskId}`);
      logger.info(`   - User: ${userId} (executionActor=${isExecutionActor})`);
      logger.info(`   - Verification Task ID from body: ${verificationTaskId}`);
      logger.info(`   - Images: ${images?.length || 0}`);
      logger.info(`   - Form data keys: ${Object.keys(formData || {}).join(', ')}`);
      logger.info(
        `   - Form data outcome: ${formData?.outcome || formData?.finalStatus || 'Not specified'}`
      );

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!verificationTaskId && !taskId) {
        return res.status(400).json({
          success: false,
          message: 'Verification task ID is required',
          error: {
            code: 'MISSING_TASK_ID',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // UPDATED: Auto-resolve caseId from verificationTaskId
      const resolution = await MobileFormController.resolveCaseIdFromTaskId(
        taskId,
        userId,
        req.user
      );

      if (!resolution.success) {
        logger.info(`❌ Failed to resolve case from task: ${taskId}`);
        return res.status(resolution.error.status).json({
          success: false,
          message: resolution.error.message,
          error: {
            code: resolution.error.code,
            timestamp: new Date().toISOString(),
            taskId,
          },
        });
      }

      const caseId = resolution.caseId;
      const task = resolution.task;

      logger.info(`✅ Resolved caseId: ${caseId} from taskId: ${taskId}`);
      logger.info(
        `✅ Verification task validated: ${task.taskNumber} (Type: ${task.verificationTypeName})`
      );

      if (!formData) {
        return res.status(400).json({
          success: false,
          message: 'Form data is required',
          error: {
            code: 'FORM_DATA_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Determine form type and verification outcome based on form data
      const { formType, verificationOutcome } = detectBusinessFormType(formData); // Use business detection for DSA/DST Connector (similar structure)

      logger.info(
        `🔍 Detected form type: ${formType}, verification outcome: ${verificationOutcome}`
      );

      // Use comprehensive validation and preparation for DSA Connector form data
      const { validationResult, preparedData } = validateAndPrepareDsaConnectorForm(
        formData,
        formType
      );

      // Log comprehensive validation results
      logger.info(`📊 Comprehensive validation for ${formType} DSA Connector verification:`, {
        isValid: validationResult.isValid,
        missingFields: validationResult.missingFields,
        warnings: validationResult.warnings,
        fieldCoverage: validationResult.fieldCoverage,
      });

      // Generate and log field coverage report
      const coverageReport = generateDsaConnectorFieldCoverageReport(
        formData,
        preparedData,
        formType
      );
      logger.info(coverageReport);

      // Use the prepared data (which includes all fields with proper defaults)
      const mappedFormData = preparedData;

      // Log warnings if any
      if (!validationResult.isValid) {
        logger.warn(
          `⚠️ Missing required fields for ${formType} DSA Connector form:`,
          validationResult.missingFields
        );
      }
      if (validationResult.warnings.length > 0) {
        logger.warn(
          `⚠️ Validation warnings for ${formType} DSA Connector form:`,
          validationResult.warnings
        );
      }

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      // Use images array for new submission format
      const photoCount = MobileFormController.countSubmissionPhotos(
        photos || [],
        images || [],
        attachmentIds || []
      );
      if (photoCount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum 5 geo-tagged photos required for DSA/DST Connector verification',
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photoCount,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location (only if photos array exists)
      if (photos && photos.length > 0) {
        const photosWithoutGeo = photos.filter(
          photo => !photo.geoLocation?.latitude || !photo.geoLocation.longitude
        );

        if (photosWithoutGeo.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'All photos must have geo-location data',
            error: {
              code: 'MISSING_GEO_LOCATION',
              details: {
                photosWithoutGeo: photosWithoutGeo.length,
              },
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Generate unique submission ID
      const submissionId = `dsa_connector_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Process verification images separately from case attachments
      const uploadedImages = await MobileFormController.processVerificationImages(
        images || [],
        caseId,
        'DSA_CONNECTOR',
        submissionId,
        userId,
        taskId,
        attachmentIds || []
      );

      logger.info(
        `✅ Processed ${uploadedImages.length} verification images for DSA/DST Connector verification (Task: ${task.taskNumber})`
      );

      // Prepare verification data (excluding old attachment references)
      const verificationData = {
        formType: 'DSA_CONNECTOR',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation,
        formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: geoLocation,
        },
      };

      // Finding #3: wrap writes + consistent re-read in a single transaction.
      const updatedCase = await withTransaction(async client => {
        // a. Update verification task status to COMPLETED
        await client.query(
          `
        UPDATE verification_tasks
        SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
          [taskId || verificationTaskId]
        );

        // b. Recalculate case status (pass tx client)
        await CaseStatusSyncService.recalculateCaseStatus(caseId, client);

        // c. Update case with verification data (without changing status)
        await client.query(
          `UPDATE cases SET verification_data = $1, verification_type = 'DSA_CONNECTOR', verification_outcome = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [JSON.stringify(verificationData), verificationOutcome, caseId]
        );

        // d. Re-read case inside transaction
        const caseUpd = await client.query(
          `SELECT id, case_id, status, completed_at, customer_name, backend_contact_number FROM cases WHERE id = $1`,
          [caseId]
        );
        const updated = caseUpd.rows[0];

        // Commission is now handled at the verification task level.
        // Legacy Case-level commission trigger removed to avoid duplication.

        // Create comprehensive DSA/DST Connector verification report using all available fields
        const dbInsertData: Record<string, unknown> = {
          // Core case information
          caseId,
          verificationTaskId: taskId,
          formType,
          verificationOutcome,
          customerName: updated.customerName || 'Unknown',
          customerPhone: updated.backendContactNumber || null,
          customerEmail: null, // Not available from case data

          // Verification metadata
          verificationDate: new Date().toISOString().split('T')[0],
          verificationTime: new Date().toTimeString().split(' ')[0],
          verifiedBy: userId,
          totalImages:
            (await MobileFormController.countTaskAttachments(taskId)).totalImages ||
            uploadedImages.length ||
            0,
          totalSelfies:
            (await MobileFormController.countTaskAttachments(taskId)).totalSelfies ||
            uploadedImages.filter(img => img.photoType === 'selfie').length ||
            0,
          remarks: formData.remarks || `${formType} DSA/DST Connector verification completed`,

          // Merge all mapped form data
          ...mappedFormData,
        };

        const { columns, placeholders, values } = buildInsert(dbInsertData);
        logger.info('🔍 Columns for SQL insert:', columns);

        const insertQuery = `
        INSERT INTO dsa_connector_verification_reports (${columns})
        VALUES (${placeholders})
      `;

        // Log comprehensive database insert data for debugging
        const nullFields = Object.entries(dbInsertData).filter(([_, value]) => value === null);
        const populatedFields = Object.entries(dbInsertData).filter(
          ([_, value]) => value !== null && value !== undefined && value !== ''
        );

        logger.info(`📝 Final database insert data for ${formType} DSA Connector verification:`, {
          totalFields: Object.keys(dbInsertData).length,
          populatedFields: populatedFields.length,
          fieldsWithNullValues: nullFields.length,
          fieldCoveragePercentage: Math.round(
            (populatedFields.length / Object.keys(dbInsertData).length) * 100
          ),
          nullFieldNames: nullFields.map(([key]) => key).slice(0, 10),
          samplePopulatedData: Object.fromEntries(populatedFields.slice(0, 10)),
        });

        logger.info(
          `📝 Inserting DSA/DST Connector verification with ${columns.length} fields:`,
          columns
        );

        // e. Insert the verification report
        await client.query(insertQuery, values);

        // f. Populate taskFormSubmissions (no swallow — Finding #3).
        await client.query(
          `INSERT INTO task_form_submissions (
            id, verification_task_id, case_id, form_submission_id, form_type,
            submitted_by, submitted_at, validation_status
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'PENDING')`,
          [
            uuidv4(),
            taskId || verificationTaskId,
            caseId,
            uuidv4(),
            'DSA_CONNECTOR_VERIFICATION',
            userId,
          ]
        );
        logger.info(`✅ Linked DSA Connector form submission to task ${verificationTaskId}`);

        // g. Remove auto-save data
        await client.query(`DELETE FROM auto_saves WHERE case_id = $1::uuid`, [caseId]);

        return updated;
      });

      await createAuditLog({
        action: 'DSA_CONNECTOR_VERIFICATION_SUBMITTED',
        entityType: 'CASE',
        entityId: caseId,
        userId,
        details: {
          formType,
          verificationOutcome,
          imageCount: uploadedImages.length,
          submissionId,
          hasGeoLocation: !!geoLocation,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      logger.info(`✅ DSA/DST Connector verification completed successfully:`, {
        caseId,
        formType,
        verificationOutcome,
        imageCount: uploadedImages.length,
      });

      // Send case completion notification to backend users
      await MobileFormController.sendCaseCompletionNotification(
        caseId,
        updatedCase.caseId,
        updatedCase.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: `${formType} DSA/DST Connector verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          caseNumber: updatedCase.caseId,
          taskId: verificationTaskId, // ✅ ADDED: Explicit Task ID for mobile app
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          submissionId,
          formType,
          verificationOutcome,
          verificationImageCount: uploadedImages.length,
          verificationData,
        },
      });
    } catch (error) {
      logger.error('Submit DSA/DST Connector verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Submit property individual verification form
  static async submitPropertyIndividualVerification(
    this: void,
    req: AuthenticatedRequest,
    res: Response
  ) {
    try {
      const taskId = String(req.params.taskId || '');
      // Preprocess composite Value+Unit fields from mobile into single fields
      req.body.formData = MobileFormController.preprocessCompositeFields(req.body.formData || {});
      const submissionData: MobileFormSubmissionRequest = req.body;
      const userId = req.user?.id;

      // UPDATED: Auto-resolve caseId from verificationTaskId
      const resolution = await MobileFormController.resolveCaseIdFromTaskId(
        taskId,
        userId,
        req.user
      );

      if (!resolution.success) {
        logger.info(`❌ Failed to resolve case from task: ${taskId}`);
        return res.status(resolution.error.status).json({
          success: false,
          message: resolution.error.message,
          error: {
            code: resolution.error.code,
            timestamp: new Date().toISOString(),
            taskId,
          },
        });
      }

      const caseId = resolution.caseId;

      logger.info(
        `📱 Property Individual verification submission for task ${taskId} (case ${caseId})`
      );

      const { formType, verificationOutcome } = detectPropertyIndividualFormType(
        submissionData.formData
      );

      const { validationResult, preparedData } = validateAndPreparePropertyIndividualForm(
        submissionData.formData,
        formType
      );

      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Form validation failed',
          error: {
            code: 'VALIDATION_FAILED',
            details: validationResult.missingFields,
          },
        });
      }

      const submissionId = `property_individual_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      const uploadedImages = await MobileFormController.processVerificationImages(
        submissionData.images || [],
        caseId,
        'PROPERTY_INDIVIDUAL',
        submissionId,
        userId,
        taskId,
        submissionData.attachmentIds || []
      );

      // Prepare verification data for cases table (pure JS — safe above the tx)
      const verificationData = {
        formType: 'PROPERTY_INDIVIDUAL',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation: submissionData.geoLocation,
        formData: submissionData.formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...submissionData.formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: submissionData.geoLocation,
        },
      };

      // Finding #3: wrap writes + consistent re-read in a single transaction.
      const updatedCase = await withTransaction(async client => {
        // a. Update verification task status to COMPLETED
        await client.query(
          `UPDATE verification_tasks
         SET status = 'COMPLETED',
             completed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
          [taskId]
        );

        // b. Recalculate case status (pass tx client)
        await CaseStatusSyncService.recalculateCaseStatus(caseId, client);

        // c. Update case with verification data
        await client.query(
          `UPDATE cases SET verification_data = $1, verification_type = 'PROPERTY_INDIVIDUAL', verification_outcome = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [JSON.stringify(verificationData), verificationOutcome, caseId]
        );

        // d. Re-read case inside transaction
        const caseUpd = await client.query(
          `SELECT id, case_id, status, completed_at, customer_name, backend_contact_number FROM cases WHERE id = $1`,
          [caseId]
        );
        const updated = caseUpd.rows[0];

        // Build the report data using mapped fields
        const mappedFormData = preparedData;
        const dbInsertData: Record<string, unknown> = {
          caseId,
          verificationTaskId: taskId,
          formType,
          verificationOutcome,
          customerName: updated.customerName || 'Unknown',
          customerPhone: updated.backendContactNumber || null,
          customerEmail: null,
          verificationDate: new Date().toISOString().split('T')[0],
          verificationTime: new Date().toTimeString().split(' ')[0],
          verifiedBy: userId,
          totalImages:
            (await MobileFormController.countTaskAttachments(taskId)).totalImages ||
            uploadedImages.length ||
            0,
          totalSelfies:
            (await MobileFormController.countTaskAttachments(taskId)).totalSelfies ||
            uploadedImages.filter(img => img.photoType === 'selfie').length ||
            0,
          remarks:
            submissionData.formData.remarks ||
            `${formType} property individual verification completed`,
          ...mappedFormData,
        };

        // Build dynamic INSERT query
        const { columns, placeholders, values } = buildInsert(dbInsertData);

        const insertQuery = `
        INSERT INTO property_individual_verification_reports (${columns})
        VALUES (${placeholders})
      `;

        logger.info(
          `📝 Inserting property individual verification with ${columns.length} fields:`,
          columns
        );

        // e. Insert the verification report
        await client.query(insertQuery, values);

        // f. Populate taskFormSubmissions (no swallow — Finding #3).
        await client.query(
          `INSERT INTO task_form_submissions (
            id, verification_task_id, case_id, form_submission_id, form_type,
            submitted_by, submitted_at, validation_status
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'PENDING')`,
          [uuidv4(), taskId, caseId, uuidv4(), 'PROPERTY_INDIVIDUAL_VERIFICATION', userId]
        );
        logger.info(`✅ Linked Property Individual form submission to task ${taskId}`);

        // g. Remove auto-save data
        await client.query(`DELETE FROM auto_saves WHERE case_id = $1::uuid`, [caseId]);

        return updated;
      });

      await createAuditLog({
        action: 'PROPERTY_INDIVIDUAL_VERIFICATION_SUBMITTED',
        entityType: 'VERIFICATION_TASK',
        entityId: taskId,
        userId,
        details: {
          caseId,
          formType: 'PROPERTY_INDIVIDUAL',
          photoCount: uploadedImages.length,
          outcome: verificationOutcome,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Send case completion notification
      await MobileFormController.sendCaseCompletionNotification(
        caseId,
        updatedCase?.caseId,
        updatedCase?.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: 'Property Individual verification submitted successfully',
        data: {
          submissionId,
          taskId,
          caseId,
          caseNumber: updatedCase?.caseId,
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Submit property individual verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Submit property APF verification form
  static async submitPropertyApfVerification(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      // UPDATED: Accept taskId from URL params (this is verificationTaskId)
      const taskId = String(req.params.taskId || '');
      // Preprocess composite Value+Unit fields from mobile into single fields
      req.body.formData = MobileFormController.preprocessCompositeFields(req.body.formData || {});
      const {
        verificationTaskId,
        formData,
        attachmentIds,
        geoLocation,
        photos,
        images,
      }: MobileFormSubmissionRequest = req.body;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user as never);

      logger.info(`📱 Property APF verification submission for task: ${taskId}`);
      logger.info(`   - User: ${userId} (executionActor=${isExecutionActor})`);
      logger.info(`   - Verification Task ID from body: ${verificationTaskId}`);
      logger.info(`   - Images: ${images?.length || 0}`);
      logger.info(`   - Form data keys: ${Object.keys(formData || {}).join(', ')}`);
      logger.info(
        `   - Form data outcome: ${formData?.outcome || formData?.finalStatus || 'Not specified'}`
      );

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!verificationTaskId && !taskId) {
        return res.status(400).json({
          success: false,
          message: 'Verification task ID is required',
          error: {
            code: 'MISSING_TASK_ID',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // UPDATED: Auto-resolve caseId from verificationTaskId
      const resolution = await MobileFormController.resolveCaseIdFromTaskId(
        taskId,
        userId,
        req.user
      );

      if (!resolution.success) {
        logger.info(`❌ Failed to resolve case from task: ${taskId}`);
        return res.status(resolution.error.status).json({
          success: false,
          message: resolution.error.message,
          error: {
            code: resolution.error.code,
            timestamp: new Date().toISOString(),
            taskId,
          },
        });
      }

      const caseId = resolution.caseId;
      const task = resolution.task;

      logger.info(`✅ Resolved caseId: ${caseId} from taskId: ${taskId}`);
      logger.info(
        `✅ Verification task validated: ${task.taskNumber} (Type: ${task.verificationTypeName})`
      );

      if (!formData) {
        return res.status(400).json({
          success: false,
          message: 'Form data is required',
          error: {
            code: 'FORM_DATA_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Determine form type and verification outcome based on form data
      const { formType, verificationOutcome } = detectBusinessFormType(formData); // Use business detection for Property APF (similar structure)

      logger.info(
        `🔍 Detected form type: ${formType}, verification outcome: ${verificationOutcome}`
      );

      // Use comprehensive validation and preparation for Property APF form data
      const { validationResult, preparedData } = validateAndPreparePropertyApfForm(
        formData,
        formType
      );

      // Log comprehensive validation results
      logger.info(`📊 Comprehensive validation for ${formType} Property APF verification:`, {
        isValid: validationResult.isValid,
        missingFields: validationResult.missingFields,
        warnings: validationResult.warnings,
        fieldCoverage: validationResult.fieldCoverage,
      });

      // Generate and log field coverage report
      const coverageReport = generatePropertyApfFieldCoverageReport(
        formData,
        preparedData,
        formType
      );
      logger.info(coverageReport);

      // Use the prepared data (which includes all fields with proper defaults)
      const mappedFormData = preparedData;

      // Log warnings if any
      if (!validationResult.isValid) {
        logger.warn(
          `⚠️ Missing required fields for ${formType} Property APF form:`,
          validationResult.missingFields
        );
      }
      if (validationResult.warnings.length > 0) {
        logger.warn(
          `⚠️ Validation warnings for ${formType} Property APF form:`,
          validationResult.warnings
        );
      }

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      // Use images array for new submission format
      const photoCount = MobileFormController.countSubmissionPhotos(
        photos || [],
        images || [],
        attachmentIds || []
      );
      if (photoCount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum 5 geo-tagged photos required for Property APF verification',
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photoCount,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location (only if photos array exists)
      if (photos && photos.length > 0) {
        const photosWithoutGeo = photos.filter(
          photo => !photo.geoLocation?.latitude || !photo.geoLocation.longitude
        );

        if (photosWithoutGeo.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'All photos must have geo-location data',
            error: {
              code: 'MISSING_GEO_LOCATION',
              details: {
                photosWithoutGeo: photosWithoutGeo.length,
              },
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Generate unique submission ID
      const submissionId = `property_apf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Process verification images separately from case attachments
      const uploadedImages = await MobileFormController.processVerificationImages(
        images || [],
        caseId,
        'PROPERTY_APF',
        submissionId,
        userId,
        taskId,
        attachmentIds || []
      );

      logger.info(
        `✅ Processed ${uploadedImages.length} verification images for Property APF verification (Task: ${task.taskNumber})`
      );

      // Prepare verification data (excluding old attachment references)
      const verificationData = {
        formType: 'PROPERTY_APF',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation,
        formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: geoLocation,
        },
      };

      // Finding #3: wrap writes + consistent re-read in a single transaction.
      const updatedCase = await withTransaction(async client => {
        // a. Update verification task status to COMPLETED
        await client.query(
          `
        UPDATE verification_tasks
        SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
          [taskId || verificationTaskId]
        );

        // b. Recalculate case status (pass tx client)
        await CaseStatusSyncService.recalculateCaseStatus(caseId, client);

        // c. Update case with verification data (without changing status)
        await client.query(
          `UPDATE cases SET verification_data = $1, verification_type = 'PROPERTY_APF', verification_outcome = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [JSON.stringify(verificationData), verificationOutcome, caseId]
        );

        // d. Re-read case inside transaction
        const caseUpd = await client.query(
          `SELECT id, case_id, status, completed_at, customer_name, backend_contact_number FROM cases WHERE id = $1`,
          [caseId]
        );
        const updated = caseUpd.rows[0];

        // Create comprehensive Property APF verification report using all available fields
        const dbInsertData: Record<string, unknown> = {
          // Core case information
          caseId,
          verificationTaskId: taskId,
          formType,
          verificationOutcome,
          customerName: updated.customerName || 'Unknown',
          customerPhone: updated.backendContactNumber || null,
          customerEmail: null, // Not available from case data

          // Verification metadata
          verificationDate: new Date().toISOString().split('T')[0],
          verificationTime: new Date().toTimeString().split(' ')[0],
          verifiedBy: userId,
          totalImages:
            (await MobileFormController.countTaskAttachments(taskId)).totalImages ||
            uploadedImages.length ||
            0,
          totalSelfies:
            (await MobileFormController.countTaskAttachments(taskId)).totalSelfies ||
            uploadedImages.filter(img => img.photoType === 'selfie').length ||
            0,
          remarks: formData.remarks || `${formType} Property APF verification completed`,

          // Merge all mapped form data
          ...mappedFormData,
        };

        const { columns, placeholders, values } = buildInsert(dbInsertData);
        logger.info('🔍 Columns for SQL insert:', columns);

        const insertQuery = `
        INSERT INTO property_apf_verification_reports (${columns})
        VALUES (${placeholders})
      `;

        // Log comprehensive database insert data for debugging
        const nullFields = Object.entries(dbInsertData).filter(([_, value]) => value === null);
        const populatedFields = Object.entries(dbInsertData).filter(
          ([_, value]) => value !== null && value !== undefined && value !== ''
        );

        logger.info(`📝 Final database insert data for ${formType} Property APF verification:`, {
          totalFields: Object.keys(dbInsertData).length,
          populatedFields: populatedFields.length,
          fieldsWithNullValues: nullFields.length,
          fieldCoveragePercentage: Math.round(
            (populatedFields.length / Object.keys(dbInsertData).length) * 100
          ),
          nullFieldNames: nullFields.map(([key]) => key).slice(0, 10),
          samplePopulatedData: Object.fromEntries(populatedFields.slice(0, 10)),
        });

        logger.info(
          `📝 Inserting Property APF verification with ${columns.length} fields:`,
          columns
        );

        // e. Insert the verification report
        await client.query(insertQuery, values);

        // f. Populate taskFormSubmissions (no swallow — Finding #3).
        await client.query(
          `INSERT INTO task_form_submissions (
            id, verification_task_id, case_id, form_submission_id, form_type,
            submitted_by, submitted_at, validation_status
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'PENDING')`,
          [
            uuidv4(),
            taskId || verificationTaskId,
            caseId,
            uuidv4(),
            'PROPERTY_APF_VERIFICATION',
            userId,
          ]
        );
        logger.info(`✅ Linked Property APF form submission to task ${verificationTaskId}`);

        // g. Remove auto-save data
        await client.query(`DELETE FROM auto_saves WHERE case_id = $1::uuid`, [caseId]);

        return updated;
      });

      await createAuditLog({
        action: 'PROPERTY_APF_VERIFICATION_SUBMITTED',
        entityType: 'CASE',
        entityId: caseId,
        userId,
        details: {
          formType,
          verificationOutcome,
          imageCount: uploadedImages.length,
          submissionId,
          hasGeoLocation: !!geoLocation,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      logger.info(`✅ Property APF verification completed successfully:`, {
        caseId,
        formType,
        verificationOutcome,
        imageCount: uploadedImages.length,
      });

      // Send case completion notification to backend users
      await MobileFormController.sendCaseCompletionNotification(
        caseId,
        updatedCase.caseId,
        updatedCase.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: `${formType} Property APF verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          caseNumber: updatedCase.caseId,
          taskId: verificationTaskId, // ✅ ADDED: Explicit Task ID for mobile app
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          submissionId,
          formType,
          verificationOutcome,
          verificationImageCount: uploadedImages.length,
          verificationData,
        },
      });
    } catch (error) {
      logger.error('Submit Property APF verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Submit NOC verification form
  static async submitNocVerification(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      // UPDATED: Accept taskId from URL params (this is verificationTaskId)
      const taskId = String(req.params.taskId || '');
      // Preprocess composite Value+Unit fields from mobile into single fields
      req.body.formData = MobileFormController.preprocessCompositeFields(req.body.formData || {});
      const {
        verificationTaskId,
        formData,
        attachmentIds,
        geoLocation,
        photos,
        images,
      }: MobileFormSubmissionRequest = req.body;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user as never);

      logger.info(`📱 NOC verification submission for task: ${taskId}`);
      logger.info(`   - User: ${userId} (executionActor=${isExecutionActor})`);
      logger.info(`   - Verification Task ID from body: ${verificationTaskId}`);
      logger.info(`   - Images: ${images?.length || 0}`);
      logger.info(`   - Form data keys: ${Object.keys(formData || {}).join(', ')}`);
      logger.info(
        `   - Form data outcome: ${formData?.outcome || formData?.finalStatus || 'Not specified'}`
      );

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!verificationTaskId && !taskId) {
        return res.status(400).json({
          success: false,
          message: 'Verification task ID is required',
          error: {
            code: 'MISSING_TASK_ID',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // UPDATED: Auto-resolve caseId from verificationTaskId
      const resolution = await MobileFormController.resolveCaseIdFromTaskId(
        taskId,
        userId,
        req.user
      );

      if (!resolution.success) {
        logger.info(`❌ Failed to resolve case from task: ${taskId}`);
        return res.status(resolution.error.status).json({
          success: false,
          message: resolution.error.message,
          error: {
            code: resolution.error.code,
            timestamp: new Date().toISOString(),
            taskId,
          },
        });
      }

      const caseId = resolution.caseId;
      const task = resolution.task;

      logger.info(`✅ Resolved caseId: ${caseId} from taskId: ${taskId}`);
      logger.info(
        `✅ Verification task validated: ${task.taskNumber} (Type: ${task.verificationTypeName})`
      );

      if (!formData) {
        return res.status(400).json({
          success: false,
          message: 'Form data is required',
          error: {
            code: 'FORM_DATA_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Determine form type and verification outcome based on form data
      const { formType, verificationOutcome } = detectBusinessFormType(formData); // Use business detection for NOC (similar structure)

      logger.info(
        `🔍 Detected form type: ${formType}, verification outcome: ${verificationOutcome}`
      );

      // Use comprehensive validation and preparation for NOC form data
      const { validationResult, preparedData } = validateAndPrepareNocForm(formData, formType);

      // Log comprehensive validation results
      logger.info(`📊 Comprehensive validation for ${formType} NOC verification:`, {
        isValid: validationResult.isValid,
        missingFields: validationResult.missingFields,
        warnings: validationResult.warnings,
        fieldCoverage: validationResult.fieldCoverage,
      });

      // Generate and log field coverage report
      const coverageReport = generateNocFieldCoverageReport(formData, preparedData, formType);
      logger.info(coverageReport);

      // Use the prepared data (which includes all fields with proper defaults)
      const mappedFormData = preparedData;

      // Log warnings if any
      if (!validationResult.isValid) {
        logger.warn(
          `⚠️ Missing required fields for ${formType} NOC form:`,
          validationResult.missingFields
        );
      }
      if (validationResult.warnings.length > 0) {
        logger.warn(`⚠️ Validation warnings for ${formType} NOC form:`, validationResult.warnings);
      }

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      // Use images array for new submission format
      const photoCount = MobileFormController.countSubmissionPhotos(
        photos || [],
        images || [],
        attachmentIds || []
      );
      if (photoCount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum 5 geo-tagged photos required for NOC verification',
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photoCount,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location (only if photos array exists)
      if (photos && photos.length > 0) {
        const photosWithoutGeo = photos.filter(
          photo => !photo.geoLocation?.latitude || !photo.geoLocation.longitude
        );

        if (photosWithoutGeo.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'All photos must have geo-location data',
            error: {
              code: 'MISSING_GEO_LOCATION',
              details: {
                photosWithoutGeo: photosWithoutGeo.length,
              },
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Generate unique submission ID
      const submissionId = `noc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Process verification images separately from case attachments
      const uploadedImages = await MobileFormController.processVerificationImages(
        images || [],
        caseId,
        'NOC',
        submissionId,
        userId,
        taskId,
        attachmentIds || []
      );

      logger.info(
        `✅ Processed ${uploadedImages.length} verification images for NOC verification (Task: ${task.taskNumber})`
      );

      // Prepare verification data (excluding old attachment references)
      const verificationData = {
        formType: 'NOC',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation,
        formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: geoLocation,
        },
      };

      // Finding #3: wrap writes + consistent re-read in a single transaction.
      const updatedCase = await withTransaction(async client => {
        // a. Update verification task status to COMPLETED
        await client.query(
          `
        UPDATE verification_tasks
        SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
          [taskId || verificationTaskId]
        );

        // b. Recalculate case status (pass tx client)
        await CaseStatusSyncService.recalculateCaseStatus(caseId, client);

        // c. Update case with verification data (without changing status)
        await client.query(
          `UPDATE cases SET verification_data = $1, verification_type = 'NOC', verification_outcome = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [JSON.stringify(verificationData), verificationOutcome, caseId]
        );

        // d. Re-read case inside transaction
        const caseUpd = await client.query(
          `SELECT id, case_id, status, completed_at, customer_name, backend_contact_number FROM cases WHERE id = $1`,
          [caseId]
        );
        const updated = caseUpd.rows[0];

        // Create comprehensive NOC verification report using all available fields
        const dbInsertData: Record<string, unknown> = {
          // Core case information
          caseId,
          verificationTaskId: taskId,
          formType,
          verificationOutcome,
          customerName: updated.customerName || 'Unknown',
          customerPhone: updated.backendContactNumber || null,
          customerEmail: null, // Not available from case data

          // Verification metadata
          verificationDate: new Date().toISOString().split('T')[0],
          verificationTime: new Date().toTimeString().split(' ')[0],
          verifiedBy: userId,
          totalImages:
            (await MobileFormController.countTaskAttachments(taskId)).totalImages ||
            uploadedImages.length ||
            0,
          totalSelfies:
            (await MobileFormController.countTaskAttachments(taskId)).totalSelfies ||
            uploadedImages.filter(img => img.photoType === 'selfie').length ||
            0,
          remarks: formData.remarks || `${formType} NOC verification completed`,

          // Merge all mapped form data
          ...mappedFormData,
        };

        const { columns, placeholders, values } = buildInsert(dbInsertData);
        logger.info('🔍 Columns for SQL insert:', columns);

        const insertQuery = `
        INSERT INTO noc_verification_reports (${columns})
        VALUES (${placeholders})
      `;

        // Log comprehensive database insert data for debugging
        const nullFields = Object.entries(dbInsertData).filter(([_, value]) => value === null);
        const populatedFields = Object.entries(dbInsertData).filter(
          ([_, value]) => value !== null && value !== undefined && value !== ''
        );

        logger.info(`📝 Final database insert data for ${formType} NOC verification:`, {
          totalFields: Object.keys(dbInsertData).length,
          populatedFields: populatedFields.length,
          fieldsWithNullValues: nullFields.length,
          fieldCoveragePercentage: Math.round(
            (populatedFields.length / Object.keys(dbInsertData).length) * 100
          ),
          nullFieldNames: nullFields.map(([key]) => key).slice(0, 10),
          samplePopulatedData: Object.fromEntries(populatedFields.slice(0, 10)),
        });

        logger.info(`📝 Inserting NOC verification with ${columns.length} fields:`, columns);

        // e. Insert the verification report
        await client.query(insertQuery, values);

        // f. Populate taskFormSubmissions (no swallow — Finding #3).
        await client.query(
          `INSERT INTO task_form_submissions (
            id, verification_task_id, case_id, form_submission_id, form_type,
            submitted_by, submitted_at, validation_status
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'PENDING')`,
          [uuidv4(), taskId || verificationTaskId, caseId, uuidv4(), 'NOC_VERIFICATION', userId]
        );
        logger.info(`✅ Linked NOC form submission to task ${verificationTaskId}`);

        // g. Remove auto-save data
        await client.query(`DELETE FROM auto_saves WHERE case_id = $1::uuid`, [caseId]);

        return updated;
      });

      await createAuditLog({
        action: 'NOC_VERIFICATION_SUBMITTED',
        entityType: 'CASE',
        entityId: caseId,
        userId,
        details: {
          formType,
          verificationOutcome,
          imageCount: uploadedImages.length,
          submissionId,
          hasGeoLocation: !!geoLocation,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      logger.info(`✅ NOC verification completed successfully:`, {
        caseId,
        formType,
        verificationOutcome,
        imageCount: uploadedImages.length,
      });

      // Send case completion notification to backend users
      await MobileFormController.sendCaseCompletionNotification(
        caseId,
        updatedCase.caseId,
        updatedCase.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: `${formType} NOC verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          caseNumber: updatedCase.caseId,
          taskId: verificationTaskId, // ✅ ADDED: Explicit Task ID for mobile app
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          submissionId,
          formType,
          verificationOutcome,
          verificationImageCount: uploadedImages.length,
          verificationData,
        },
      });
    } catch (error) {
      logger.error('Submit NOC verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Get verification form template
  static getFormTemplate(this: void, req: Request, res: Response) {
    try {
      const formType = String(req.params.formType || '');
      const outcomeQuery = req.query.outcome;
      const outcomeParam = typeof outcomeQuery === 'string' ? outcomeQuery : 'POSITIVE';
      const normalizedFormType = formType.toUpperCase();
      const allowedFormTypes = new Set([
        'RESIDENCE',
        'OFFICE',
        'BUSINESS',
        'BUILDER',
        'RESIDENCE_CUM_OFFICE',
        'DSA_CONNECTOR',
        'PROPERTY_INDIVIDUAL',
        'PROPERTY_APF',
        'NOC',
      ]);

      const normalizeOutcome = (rawOutcome: string): string => {
        const value = rawOutcome.trim().toUpperCase();
        if (value.includes('SHIFTED')) {
          return 'SHIFTED';
        }
        if (value.includes('NSP') || value.includes('PERSON NOT MET')) {
          return 'NSP';
        }
        if (value.includes('ENTRY') || value.includes('RESTRICT')) {
          return 'ENTRY_RESTRICTED';
        }
        if (value.includes('UNTRACEABLE') || value.includes('NOT FOUND')) {
          return 'UNTRACEABLE';
        }
        if (value.includes('NEGATIVE') || value.includes('NOT VERIFIED')) {
          return 'NEGATIVE';
        }
        return 'POSITIVE';
      };

      const normalizedOutcome = normalizeOutcome(outcomeParam);

      if (!allowedFormTypes.has(normalizedFormType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid form type',
          error: {
            code: 'INVALID_FORM_TYPE',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const photoTypesByVerificationType: Record<string, string[]> = {
        RESIDENCE: [
          'BUILDING_EXTERIOR',
          'BUILDING_INTERIOR',
          'NAMEPLATE',
          'SURROUNDINGS',
          'APPLICANT',
        ],
        OFFICE: ['OFFICE_EXTERIOR', 'OFFICE_INTERIOR', 'RECEPTION', 'EMPLOYEE_DESK', 'ID_CARD'],
        BUSINESS: [
          'BUSINESS_EXTERIOR',
          'BUSINESS_INTERIOR',
          'SIGNBOARD',
          'OWNER_PHOTO',
          'BUSINESS_ACTIVITY',
        ],
        BUILDER: [
          'PROJECT_EXTERIOR',
          'CONSTRUCTION_SITE',
          'APPROVAL_BOARD',
          'BUILDER_OFFICE',
          'PROGRESS_PHOTO',
        ],
        RESIDENCE_CUM_OFFICE: [
          'BUILDING_EXTERIOR',
          'RESIDENCE_AREA',
          'OFFICE_AREA',
          'NAMEPLATE',
          'APPLICANT',
        ],
        DSA_CONNECTOR: [
          'OFFICE_EXTERIOR',
          'OFFICE_INTERIOR',
          'SIGNBOARD',
          'CONTACT_PERSON',
          'DOCUMENTS',
        ],
        PROPERTY_INDIVIDUAL: [
          'PROPERTY_EXTERIOR',
          'PROPERTY_INTERIOR',
          'OWNERSHIP_DOCS',
          'OWNER_PHOTO',
          'SURROUNDINGS',
        ],
        PROPERTY_APF: [
          'PROJECT_EXTERIOR',
          'CONSTRUCTION_SITE',
          'APPROVAL_BOARD',
          'DEVELOPER_OFFICE',
          'PROGRESS_PHOTO',
        ],
        NOC: [
          'PROPERTY_EXTERIOR',
          'NOC_DOCUMENT',
          'APPLICANT_PHOTO',
          'AUTHORITY_OFFICE',
          'SUPPORTING_DOCS',
        ],
      };

      const selectOptionsByField: Record<string, string[]> = {
        addressLocatable: ['LOCATABLE', 'NOT_LOCATABLE'],
        addressRating: ['EXCELLENT', 'GOOD', 'AVERAGE', 'POOR'],
        houseStatus: ['OPENED', 'LOCKED', 'CLOSED'],
        roomStatus: ['OPENED', 'LOCKED', 'CLOSED'],
        metPersonRelation: ['SELF', 'FATHER', 'MOTHER', 'SPOUSE', 'BROTHER', 'SISTER', 'OTHER'],
        metPersonStatus: ['CONFIRMED', 'DENIED', 'UNKNOWN'],
        workingStatus: ['EMPLOYED', 'SELF_EMPLOYED', 'HOUSE_WIFE', 'STUDENT', 'UNEMPLOYED'],
        stayingStatus: ['STAYING', 'SHIFTED', 'TEMPORARY'],
        documentShownStatus: ['SHOWN', 'NOT_SHOWN'],
        documentType: [
          'AADHAAR',
          'PAN',
          'VOTER_ID',
          'DRIVING_LICENSE',
          'PASSPORT',
          'UTILITY_BILL',
          'OTHER',
        ],
        doorNamePlateStatus: ['SIGHTED', 'NOT_SIGHTED'],
        societyNamePlateStatus: ['SIGHTED', 'NOT_SIGHTED'],
        premisesStatus: ['OCCUPIED', 'LOCKED', 'VACANT', 'CLOSED'],
        officeStatus: ['ACTIVE', 'INACTIVE', 'CLOSED'],
        businessStatus: ['ACTIVE', 'INACTIVE', 'CLOSED'],
        propertyType: ['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL'],
        ownershipStatus: ['OWNED', 'LEASED', 'RENTED'],
        constructionStatus: ['UNDER_CONSTRUCTION', 'COMPLETED', 'PLANNED'],
        projectStatus: ['UNDER_CONSTRUCTION', 'COMPLETED', 'PLANNED'],
        connectorType: ['DSA', 'DST'],
        nocStatus: ['VERIFIED', 'NOT_VERIFIED', 'PENDING'],
      };

      const fallbackFields = [
        { name: 'remarks', type: 'textarea', required: true, label: 'Remarks' },
        { name: 'callRemark', type: 'text', required: false, label: 'Call Remark' },
      ];

      const mappedFieldsFromSchema = getFormFieldDefinitions(normalizedFormType, normalizedOutcome)
        .filter(field => field.name !== 'outcome')
        .map((field, index) => {
          const options = selectOptionsByField[field.name];
          const isSelect = field.type === 'select' || field.type === 'multiselect';
          const fieldType =
            field.type === 'boolean'
              ? 'boolean'
              : field.type === 'number'
                ? 'number'
                : field.type === 'textarea'
                  ? 'textarea'
                  : isSelect && options?.length
                    ? 'select'
                    : 'text';

          return {
            name: field.name,
            type: fieldType,
            required: Boolean(field.isRequired),
            label: field.label || field.name,
            options: options || undefined,
            order: index + 1,
          };
        });

      const fields = mappedFieldsFromSchema.length > 0 ? mappedFieldsFromSchema : fallbackFields;

      res.json({
        success: true,
        message: 'Form template retrieved successfully',
        data: {
          verificationType: normalizedFormType,
          outcome: normalizedOutcome,
          fields,
          requiredPhotos: 5,
          photoTypes:
            photoTypesByVerificationType[normalizedFormType] ||
            photoTypesByVerificationType.RESIDENCE,
        },
      });
    } catch (error) {
      logger.error('Get form template error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'TEMPLATE_FETCH_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}
