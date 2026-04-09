import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import { createAuditLog } from '@/utils/auditLogger';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import sharp from 'sharp';
import { config } from '@/config';
import { logger } from '@/config/logger';
import type { QueryParams } from '@/types/database';
import { getAssignedClientIds } from '@/middleware/clientAccess';
import { getAssignedProductIds } from '@/middleware/productAccess';
import { isFieldExecutionActor, isScopedOperationsUser } from '@/security/rbacAccess';
import { getScopedOperationalUserIds } from '@/security/userScope';
import { MobileOperationService } from '@/services/mobileOperationService';
import { MobileTelemetryService } from '@/services/mobileTelemetryService';

// Configure storage for verification attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const taskId = String(req.params.taskId || '');
    let caseId = String(req.params.caseId || '');
    const verificationType = req.body.verificationType || 'verification';

    // Stage-2A: Resolve caseId from taskId if needed
    if (!caseId && taskId) {
      void (async () => {
        try {
          const taskResult = await query('SELECT case_id FROM verification_tasks WHERE id = $1', [
            taskId,
          ]);
          if (taskResult.rows.length > 0) {
            caseId = taskResult.rows[0].case_id;
          }
        } catch (error) {
          logger.error('Error resolving caseId from taskId in storage:', error);
        } finally {
          const uploadDir = path.join(
            process.cwd(),
            'uploads',
            verificationType,
            caseId || 'unassigned'
          );

          void fs
            .mkdir(uploadDir, { recursive: true })
            .then(() => {
              cb(null, uploadDir);
            })
            .catch(err => {
              cb(err as Error, '');
            });
        }
      })();
    } else {
      const uploadDir = path.join(
        process.cwd(),
        'uploads',
        verificationType,
        caseId || 'unassigned'
      );

      void fs
        .mkdir(uploadDir, { recursive: true })
        .then(() => {
          cb(null, uploadDir);
        })
        .catch(err => {
          cb(err as Error, '');
        });
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    const photoType = req.body.photoType || 'verification';

    cb(null, `${photoType}_${timestamp}_${randomSuffix}${extension}`);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = config.mobile.allowedImageTypes;

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed for verification images`));
  }
};

export const verificationUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.mobile.maxFileSize,
    files: config.mobile.maxAttachmentUploadCount,
  },
});

export class VerificationAttachmentController {
  private static getOperationId(req: Request): string | null {
    const bodyValue =
      typeof req.body?.operation_id === 'string' ? req.body.operation_id.trim() : '';
    if (bodyValue) {
      return bodyValue;
    }

    const headerValue = req.header('Idempotency-Key')?.trim();
    return headerValue || null;
  }

  private static async verifyCaseLevelAccess(
    req: Request,
    caseId: string
  ): Promise<{ ok: boolean; status?: number; body?: Record<string, unknown> }> {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    const user = authReq.user;

    if (!userId || !user) {
      return {
        ok: false,
        status: 401,
        body: {
          success: false,
          message: 'Authentication required',
          error: { code: 'UNAUTHORIZED' },
        },
      };
    }

    if (isFieldExecutionActor(user)) {
      const taskAccess = await query(
        `SELECT 1 FROM verification_tasks WHERE case_id = $1 AND assigned_to = $2 LIMIT 1`,
        [caseId, userId]
      );
      if (taskAccess.rows.length === 0) {
        return {
          ok: false,
          status: 403,
          body: {
            success: false,
            message: 'Access denied',
            error: { code: 'CASE_ACCESS_DENIED' },
          },
        };
      }
      return { ok: true };
    }

    if (isScopedOperationsUser(user)) {
      const caseRes = await query<{ clientId: number; productId: number }>(
        `SELECT client_id, product_id FROM cases WHERE id = $1`,
        [caseId]
      );
      if (caseRes.rows.length === 0) {
        return {
          ok: false,
          status: 404,
          body: {
            success: false,
            message: 'Case not found',
            error: { code: 'CASE_NOT_FOUND' },
          },
        };
      }

      const scopedUserIds = await getScopedOperationalUserIds(userId);
      if (scopedUserIds) {
        const scopeCheck = await query(
          `SELECT 1
           FROM cases c
           LEFT JOIN verification_tasks vt ON vt.case_id = c.id
           WHERE c.id = $1
             AND (
               c.created_by_backend_user = ANY($2::uuid[]) OR
               c."assignedTo" = ANY($2::uuid[]) OR
               vt.assigned_to = ANY($2::uuid[])
             )
           LIMIT 1`,
          [caseId, scopedUserIds]
        );
        if (scopeCheck.rows.length === 0) {
          return {
            ok: false,
            status: 403,
            body: {
              success: false,
              message: 'Access denied',
              error: { code: 'CASE_ACCESS_DENIED' },
            },
          };
        }
      } else {
        const [assignedClientIds, assignedProductIds] = await Promise.all([
          getAssignedClientIds(userId),
          getAssignedProductIds(userId),
        ]);
        const caseRow = caseRes.rows[0];

        if (
          !assignedClientIds ||
          !assignedProductIds ||
          assignedClientIds.length === 0 ||
          assignedProductIds.length === 0 ||
          !assignedClientIds.includes(Number(caseRow.clientId)) ||
          !assignedProductIds.includes(Number(caseRow.productId))
        ) {
          return {
            ok: false,
            status: 403,
            body: {
              success: false,
              message: 'Access denied',
              error: { code: 'CASE_ACCESS_DENIED' },
            },
          };
        }
      }
    }

    return { ok: true };
  }

  /**
   * Upload verification images during form submission
   */
  static async uploadVerificationImages(this: void, req: Request, res: Response) {
    const startedAt = Date.now();
    try {
      const taskId = String(req.params.taskId || '');
      const { verificationType, submissionId, geoLocation, photoType = 'verification' } = req.body;

      const userId = (req as AuthenticatedRequest).user?.id;
      const files = req.files as Express.Multer.File[];

      // Stage-2A: Validation - Task ID is strictly required
      if (!taskId) {
        return res.status(400).json({
          success: false,
          message: 'Task ID is required',
          error: { code: 'TASK_ID_REQUIRED' },
        });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded',
          error: { code: 'NO_FILES_UPLOADED' },
        });
      }

      // ----------------------------------------------------------------------
      // STAGE-2A: STRICT DUAL WRITE LOGIC
      // ----------------------------------------------------------------------
      logger.info(`📸 Processing strict dual-write upload for Task ID: ${taskId}`);

      const taskResult = await query(
        `SELECT vt.id, vt.case_id, vt.status, vt.assigned_to, vty.name as verification_type, c.case_id as case_number 
         FROM verification_tasks vt
         JOIN cases c ON vt.case_id = c.id
         LEFT JOIN verification_types vty ON vt.verification_type_id = vty.id
         WHERE vt.id = $1`,
        [taskId]
      );

      if (taskResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Task ID',
          error: { code: 'INVALID_TASK_ID' },
        });
      }

      const task = taskResult.rows[0];
      const operationId = VerificationAttachmentController.getOperationId(req);
      if (!operationId) {
        return res.status(400).json({
          success: false,
          message: 'Idempotency-Key header is required',
          error: {
            code: 'IDEMPOTENCY_KEY_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const existingByOperation = await query(
        `SELECT id, filename, original_name, mime_type, file_size, file_path, 
                thumbnail_path, created_at, photo_type
         FROM verification_attachments
         WHERE split_part(operation_id, ':', 1) = $1
         ORDER BY created_at ASC`,
        [operationId]
      );

      if (existingByOperation.rows.length > 0) {
        void MobileTelemetryService.increment('idempotent_replay_count', 1, {
          endpoint: 'attachments_upload',
          source: 'attachment_controller',
        });
        void MobileTelemetryService.increment(
          'attachment_upload_rate',
          existingByOperation.rows.length,
          {
            mode: 'replay',
          }
        );
        return res.json({
          success: true,
          message: `${existingByOperation.rows.length} verification images uploaded successfully`,
          data: {
            attachments: existingByOperation.rows.map(attachment => ({
              id: attachment.id,
              filename: attachment.filename,
              originalName: attachment.originalName,
              mimeType: attachment.mimeType,
              size: attachment.fileSize,
              url: attachment.filePath,
              thumbnailUrl: attachment.thumbnailPath,
              uploadedAt: attachment.createdAt.toISOString(),
              photoType: attachment.photoType,
              geoLocation,
            })),
            caseId: task.case_id,
            verificationType: verificationType || task.verification_type,
            submissionId,
            taskId,
          },
        });
      }

      if (task.status === 'REVOKED') {
        await Promise.all((files || []).map(file => fs.unlink(file.path).catch(() => {})));
        return res.status(403).json({
          success: false,
          message: 'Task has been revoked',
          error: { code: 'TASK_REVOKED' },
        });
      }

      const targetTaskId = task.id;
      const targetCaseId = task.case_id; // Auto-derived from task
      const targetCaseNumber = task.case_number; // Auto-derived from task
      const verificationTypeToUse = verificationType || task.verification_type; // Prefer payload but fallback to task

      logger.info(
        `🔗 Linked Attachment to Task: ${targetTaskId}, Case: ${targetCaseId}, File: ${files[0]?.originalname}`
      );
      await MobileOperationService.recordOperation({
        operationId,
        type: 'PHOTO_CAPTURED',
        entityType: 'ATTACHMENT',
        entityId: targetTaskId,
        payload: {
          taskId: targetTaskId,
          caseId: targetCaseId,
          type: req.body?.type || 'PHOTO',
          fileCount: files.length,
          submissionId,
          photoType,
        },
        retryCount: Number(req.body?.retry_count || 0),
      });

      const uploadedAttachments: Record<string, unknown>[] = [];

      // Process each uploaded file
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        try {
          let thumbnailPath: string | null = null;
          const fileOperationId = operationId ? `${operationId}:${fileIndex}` : null;

          // Generate thumbnail for images
          if (file.mimetype.startsWith('image/')) {
            const thumbnailDir = path.join(path.dirname(file.path), 'thumbnails');
            await fs.mkdir(thumbnailDir, { recursive: true });

            thumbnailPath = path.join(thumbnailDir, `thumb_${path.basename(file.path)}`);

            await sharp(file.path)
              .resize(200, 200, {
                fit: 'inside',
                withoutEnlargement: true,
              })
              .jpeg({ quality: 80 })
              .toFile(thumbnailPath);
          }

          // Save to verification_attachments table
          const attachmentResult = await query(
            `INSERT INTO verification_attachments (
              case_id, case_id, verification_type, filename, original_name, 
              mime_type, file_size, file_path, thumbnail_path, uploaded_by, 
              geo_location, photo_type, submission_id, verification_task_id, operation_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL
            DO UPDATE SET operation_id = EXCLUDED.operation_id
            RETURNING id, filename, original_name, mime_type, file_size, file_path,
                     thumbnail_path, created_at, photo_type, verification_task_id`,
            [
              targetCaseId,
              targetCaseNumber,
              verificationTypeToUse,
              file.filename,
              file.originalname,
              file.mimetype,
              file.size,
              `/uploads/${path.relative(path.join(process.cwd(), 'uploads'), file.path).replace(/\\/g, '/')}`,
              thumbnailPath
                ? `/uploads/${path.relative(path.join(process.cwd(), 'uploads'), thumbnailPath).replace(/\\/g, '/')}`
                : null,
              userId,
              geoLocation ? JSON.stringify(geoLocation) : null,
              photoType,
              submissionId,
              targetTaskId, // Dual-write: Task ID or NULL
              fileOperationId,
            ]
          );

          const attachment = attachmentResult.rows[0];
          uploadedAttachments.push({
            id: attachment.id,
            filename: attachment.filename,
            originalName: attachment.originalName,
            mimeType: attachment.mimeType,
            size: attachment.fileSize,
            url: attachment.filePath,
            thumbnailUrl: attachment.thumbnailPath,
            uploadedAt: attachment.createdAt.toISOString(),
            photoType: attachment.photoType,
            geoLocation,
          });
        } catch (fileError) {
          logger.error(`Error processing file ${file.originalname}:`, fileError);
          // Clean up file on error
          try {
            await fs.unlink(file.path);
          } catch (unlinkError) {
            logger.error('Error cleaning up file:', unlinkError);
          }
        }
      }

      // Create audit log
      await createAuditLog({
        action: 'VERIFICATION_IMAGES_UPLOADED',
        entityType: 'CASE',
        entityId: targetCaseId,
        userId,
        details: {
          verificationType: verificationTypeToUse,
          photoCount: uploadedAttachments.length,
          submissionId,
          photoType,
          taskId,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        message: `${uploadedAttachments.length} verification images uploaded successfully`,
        data: {
          attachments: uploadedAttachments,
          caseId: targetCaseId,
          verificationType: verificationTypeToUse,
          submissionId,
          taskId,
        },
      });
      const retryCount = Number(req.body?.retry_count || req.body?.retryCount || 0);
      if (retryCount > 0) {
        void MobileTelemetryService.increment('retry_count', retryCount, {
          endpoint: 'attachments_upload',
        });
      }
      void MobileTelemetryService.increment('attachment_upload_rate', uploadedAttachments.length, {
        mode: 'fresh',
      });
      void MobileTelemetryService.observeDuration(
        'attachment_upload_duration',
        Date.now() - startedAt,
        {
          status: 'success',
        }
      );
    } catch (error) {
      logger.error('Upload verification images error:', error);
      const retryCount = Number(req.body?.retry_count || req.body?.retryCount || 0);
      if (retryCount > 0) {
        void MobileTelemetryService.increment('retry_count', retryCount, {
          endpoint: 'attachments_upload',
          status: 'error',
        });
      }
      void MobileTelemetryService.increment('upload_failures', 1, {
        endpoint: 'attachments_upload',
      });
      void MobileTelemetryService.observeDuration(
        'attachment_upload_duration',
        Date.now() - startedAt,
        {
          status: 'error',
        }
      );
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_UPLOAD_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Get verification images for a case
   */
  static async getVerificationImages(this: void, req: Request, res: Response) {
    try {
      // Handle both route patterns: /:id/verification-images and /cases/:caseId/verification-images
      const caseId = String(req.params.caseId || req.params.id || '');
      const verificationType = (req.query.verificationType as unknown as string) || '';
      const submissionId = (req.query.submissionId as unknown as string) || '';

      logger.info(
        '🔍 Getting verification images for case:',
        caseId,
        'submissionId:',
        submissionId
      );

      // Resolve case UUID — caseId param may be a UUID or integer case number
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId);
      const caseResult = isUuid
        ? await query(`SELECT id FROM cases WHERE id = $1`, [caseId])
        : await query(`SELECT id FROM cases WHERE case_id = $1`, [parseInt(caseId, 10)]);

      if (caseResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: { code: 'CASE_NOT_FOUND' },
        });
      }

      const caseUuid = caseResult.rows[0].id;
      logger.info('📋 Case UUID:', caseUuid);

      // First try to get images from verification_attachments table
      let whereClause = 'WHERE case_id = $1';
      const queryParams: QueryParams = [caseUuid];

      if (verificationType) {
        whereClause += ' AND verification_type = $2';
        queryParams.push(verificationType);
      }

      if (submissionId) {
        const paramIndex = queryParams.length + 1;
        whereClause += ` AND submission_id = $${paramIndex}`;
        queryParams.push(submissionId);
      }

      const result = await query(
        `SELECT
          id, filename, original_name, mime_type, file_size, file_path,
          thumbnail_path, uploaded_by, geo_location, photo_type,
          submission_id, verification_type, created_at
        FROM verification_attachments
        ${whereClause}
        ORDER BY created_at ASC`,
        queryParams
      );

      let attachments = result.rows.map(row => ({
        id: row.id,
        filename: row.filename,
        originalName: row.originalName,
        mimeType: row.mimeType,
        size: row.fileSize,
        url: row.filePath,
        thumbnailUrl: row.thumbnailPath,
        uploadedAt: row.createdAt.toISOString(),
        photoType: row.photoType,
        verificationType: row.verification_type,
        submissionId: row.submissionId,
        geoLocation: row.geoLocation,
      }));

      logger.info('📊 Found', attachments.length, 'images in verification_attachments table');

      // If no images found in verification_attachments table, try to get from case verificationData
      if (attachments.length === 0) {
        logger.info('🔄 No images in verification_attachments, checking case verificationData...');

        const isUuid2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          caseId
        );
        const caseDataResult = isUuid2
          ? await query(`SELECT verification_data FROM cases WHERE id = $1`, [caseId])
          : await query(`SELECT verification_data FROM cases WHERE case_id = $1`, [
              parseInt(caseId, 10),
            ]);

        if (caseDataResult.rows.length > 0) {
          const verificationData = caseDataResult.rows[0].verificationData;
          const verificationImages = verificationData?.verificationImages || [];

          logger.info('📋 Case verificationData found:', {
            submissionId: verificationData?.submissionId,
            imageCount: verificationImages.length,
            requestedSubmissionId: submissionId,
          });

          // Filter by submissionId if provided
          const filteredImages = submissionId
            ? verificationImages.filter(
                (_img: Record<string, unknown>) => verificationData?.submissionId === submissionId
              )
            : verificationImages;

          logger.info('🎯 Filtered images count:', filteredImages.length);

          attachments = filteredImages.map((img: Record<string, unknown>, index: number) => ({
            id: `case_${caseId}_img_${index}`,
            filename: img.filename || `image_${index}.jpg`,
            originalName: img.originalName || img.filename || `image_${index}.jpg`,
            mimeType: (img.mimeType as string) || 'image/jpeg',
            size: img.size || 0,
            url: img.url || img.filePath || '',
            thumbnailUrl: img.thumbnailUrl || img.thumbnailPath || img.url || img.filePath || '',
            uploadedAt: img.uploadedAt || verificationData?.submittedAt || new Date().toISOString(),
            photoType: img.photoType || 'verification',
            verificationType: verificationData?.formType || 'RESIDENCE',
            submissionId: verificationData?.submissionId || submissionId,
            geoLocation: img.geoLocation || verificationData?.geoLocation,
          }));
        }
      }

      res.json({
        success: true,
        data: attachments,
      });
    } catch (error) {
      logger.error('Get verification images error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'GET_VERIFICATION_IMAGES_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Serve verification image file
   */
  static async serveVerificationImage(this: void, req: Request, res: Response) {
    try {
      const imageId = String(req.params.imageId || '');

      // Get image details from database
      const imageResult = await query(
        `SELECT filename, original_name, mime_type, file_size, file_path, case_id, verification_type
         FROM verification_attachments WHERE id = $1`,
        [imageId]
      );

      if (imageResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Verification image not found',
          error: { code: 'IMAGE_NOT_FOUND' },
        });
      }

      const image = imageResult.rows[0];

      const access = await VerificationAttachmentController.verifyCaseLevelAccess(
        req,
        image.case_id
      );
      if (!access.ok) {
        return res.status(access.status || 403).json(access.body || { success: false });
      }

      // Use DB filePath to resolve actual disk location
      const dbFilePath = image.filePath || '';
      const filePath = dbFilePath.startsWith('/')
        ? path.join(process.cwd(), dbFilePath)
        : path.join(process.cwd(), 'uploads', 'verification', image.case_id, image.filename);

      // Check if file exists
      if (!fsSync.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'Image file not found on server',
          error: { code: 'FILE_NOT_FOUND' },
        });
      }

      // Set appropriate headers
      res.setHeader('Content-Type', image.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${image.originalName}"`);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

      if (String(image.mimeType || '').startsWith('image/')) {
        try {
          const watermarkText = `ACS CRM | Case ${image.case_id} | Verification`;
          const escapedText = watermarkText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

          const svgOverlay = `
            <svg width="820" height="56" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="820" height="56" fill="rgba(0,0,0,0.45)" />
              <text x="14" y="35" fill="white" font-size="18" font-family="Arial, sans-serif">${escapedText}</text>
            </svg>
          `;

          const watermarkedBuffer = await sharp(filePath)
            .composite([{ input: Buffer.from(svgOverlay), gravity: 'southeast' }])
            .toBuffer();

          res.setHeader('Content-Length', watermarkedBuffer.length.toString());
          return res.end(watermarkedBuffer);
        } catch (watermarkError) {
          logger.error(
            'Watermark generation failed, serving original verification image:',
            watermarkError
          );
        }
      }

      res.setHeader('Content-Length', String(image.fileSize || 0));
      const fileStream = fsSync.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      logger.error('Error serving verification image:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }

  /**
   * Serve verification image thumbnail
   */
  static async serveVerificationThumbnail(this: void, req: Request, res: Response) {
    try {
      const imageId = String(req.params.imageId || '');

      // Get image details from database
      const imageResult = await query(
        `SELECT filename, original_name, mime_type, file_size, thumbnail_path, case_id, verification_type
         FROM verification_attachments WHERE id = $1`,
        [imageId]
      );

      if (imageResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Verification image not found',
          error: { code: 'IMAGE_NOT_FOUND' },
        });
      }

      const image = imageResult.rows[0];

      const access = await VerificationAttachmentController.verifyCaseLevelAccess(
        req,
        image.case_id
      );
      if (!access.ok) {
        return res.status(access.status || 403).json(access.body || { success: false });
      }

      // If no thumbnail, serve original image
      if (!image.thumbnailPath) {
        return VerificationAttachmentController.serveVerificationImage(req, res);
      }

      // Construct thumbnail file path
      const thumbnailPath = path.join(
        process.cwd(),
        'uploads',
        'verification',
        image.verification_type.toLowerCase(),
        image.case_id,
        'thumbnails',
        `thumb_${image.filename}`
      );

      // Check if thumbnail exists, fallback to original
      if (!fsSync.existsSync(thumbnailPath)) {
        return VerificationAttachmentController.serveVerificationImage(req, res);
      }

      // Set appropriate headers
      res.setHeader('Content-Type', image.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="thumb_${image.originalName}"`);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

      // Stream the thumbnail file
      const fileStream = fsSync.createReadStream(thumbnailPath);
      fileStream.pipe(res);
    } catch (error) {
      logger.error('Error serving verification thumbnail:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  }
}
