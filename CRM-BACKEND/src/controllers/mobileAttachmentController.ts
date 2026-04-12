import type { Request, Response } from 'express';
import type { QueryParams, VerificationAttachmentRow } from '../types/database';
import type { AuthenticatedRequest } from '@/middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import type { MobileAttachmentResponse } from '../types/mobile';
import { createAuditLog } from '../utils/auditLogger';
import { logger } from '../utils/logger';
import { config } from '../config';
import { query } from '@/config/database';
import { isFieldExecutionActor } from '@/security/rbacAccess';
import { getApiBaseUrl } from '@/utils/publicUrl';

/**
 * Generate base64-encoded attachment data with checksum for offline sync
 * @param filePath - Absolute path to the attachment file
 * @returns Object containing base64 data and SHA-256 checksum
 */
async function generateBase64WithChecksum(
  filePath: string
): Promise<{ base64Data: string; checksum: string }> {
  try {
    // Read file as buffer
    const fileBuffer = await fs.readFile(filePath);

    // Generate base64 encoding
    const base64Data = fileBuffer.toString('base64');

    // Generate SHA-256 checksum from base64 data (not raw buffer)
    // This ensures the checksum matches what the mobile app will verify
    const checksum = crypto.createHash('sha256').update(base64Data).digest('hex');

    return { base64Data, checksum };
  } catch (error) {
    logger.error(`❌ Failed to generate base64 for file: ${filePath}`, error);
    throw new Error(`Failed to encode attachment: ${error.message}`);
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    void (async () => {
      const uploadDir = path.join(process.cwd(), 'uploads', 'mobile');
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (error) {
        cb(error as Error, uploadDir);
      }
    })();
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [...config.mobile.allowedImageTypes, ...config.mobile.allowedDocumentTypes];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`));
  }
};

export const mobileUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.mobile.maxFileSize,
    files: config.mobile.maxFilesPerCase,
  },
});

export class MobileAttachmentController {
  // Upload files for mobile app
  static async uploadFiles(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const paramCaseId = String(req.params.caseId || '');
      const paramTaskId = String(req.params.taskId || '');
      const caseId = paramCaseId || paramTaskId;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);
      const files = req.files as Express.Multer.File[];
      let geoLocation = null;
      if (req.body.geoLocation) {
        try {
          geoLocation = JSON.parse(req.body.geoLocation);
        } catch {
          return res.status(400).json({
            success: false,
            message: 'Invalid geoLocation JSON format',
            error: { code: 'INVALID_GEOLOCATION', timestamp: new Date().toISOString() },
          });
        }
      }

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files provided',
          error: {
            code: 'NO_FILES_PROVIDED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Check if caseId is a UUID (mobile sends UUID) or case number (web sends case number)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId);

      // Resolve Task ID to Case ID if needed
      let lookupCaseId = caseId;
      if (isUUID) {
        const taskRes = await query(`SELECT case_id FROM verification_tasks WHERE id = $1`, [
          caseId,
        ]);
        if (taskRes.rows.length > 0) {
          lookupCaseId = taskRes.rows[0].caseId;
        }
      }

      // Verify case access and get case details
      const where: QueryParams = [lookupCaseId];
      let caseSql: string;

      if (isUUID) {
        // Mobile app sends UUID
        caseSql = `SELECT id, case_id FROM cases WHERE id = $1`;
      } else {
        // Web app sends case number
        caseSql = `SELECT id, case_id FROM cases WHERE case_id = $1`;
      }

      // For FIELD_AGENT: Check task-level assignment and get their task ID
      let userTaskId: string | null = null;
      if (isExecutionActor) {
        caseSql += ` AND EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = cases.id
          AND vt.assigned_to = $2
        )`;
        where.push(userId);
      }

      const caseRes = await query(caseSql, where);
      const existingCase = caseRes.rows[0];

      // Get the field agent's assigned task ID for this case
      if (isExecutionActor && existingCase) {
        const taskRes = await query(
          `SELECT id FROM verification_tasks WHERE case_id = $1 AND assigned_to = $2 LIMIT 1`,
          [existingCase.id, userId]
        );
        userTaskId = taskRes.rows[0]?.id || null;
      }

      if (!existingCase) {
        // Clean up uploaded files
        await Promise.all(files.map(file => fs.unlink(file.path).catch(() => {})));

        logger.info(`❌ Attachment upload: Case not found: ${caseId} (isUUID: ${isUUID})`);
        return res.status(404).json({
          success: false,
          message: 'Case not found or access denied',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
            caseId,
            isUUID,
          },
        });
      }

      const actualCaseId = existingCase.id; // Use the actual UUID from the database

      if (paramTaskId) {
        const taskStatusResult = await query(
          `SELECT status FROM verification_tasks WHERE id = $1 LIMIT 1`,
          [paramTaskId]
        );

        if (taskStatusResult.rows[0]?.status === 'REVOKED') {
          await Promise.all(files.map(file => fs.unlink(file.path).catch(() => {})));
          return res.status(403).json({
            success: false,
            message: 'Task has been revoked',
            error: {
              code: 'TASK_REVOKED',
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Check file count limit
      const countRes = await query(
        `SELECT COUNT(*)::int as count FROM attachments WHERE case_id = $1`,
        [actualCaseId]
      );
      const existingAttachmentCount = Number(countRes.rows[0]?.count || 0);

      if (existingAttachmentCount + files.length > config.mobile.maxFilesPerCase) {
        // Clean up uploaded files
        await Promise.all(files.map(file => fs.unlink(file.path).catch(() => {})));

        return res.status(400).json({
          success: false,
          message: `Maximum ${config.mobile.maxFilesPerCase} files allowed per case`,
          error: {
            code: 'FILE_LIMIT_EXCEEDED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const uploadedAttachments: MobileAttachmentResponse[] = [];

      // Process each file
      for (const file of files) {
        try {
          // Generate thumbnail for images
          if (file.mimetype.startsWith('image/')) {
            const thumbnailPath = path.join(
              path.dirname(file.path),
              'thumbnails',
              `thumb_${path.basename(file.path)}`
            );

            await fs.mkdir(path.dirname(thumbnailPath), { recursive: true });

            await sharp(file.path)
              .resize(config.mobile.thumbnailSize, config.mobile.thumbnailSize, {
                fit: 'inside',
                withoutEnlargement: true,
              })
              .jpeg({ quality: 80 })
              .toFile(thumbnailPath);
          }

          // Save attachment to database with verification_task_id for field agents
          const attRes = await query(
            `INSERT INTO attachments (case_id, case_id, filename, original_name, mime_type, file_size, file_path, uploaded_by, verification_task_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             RETURNING id, filename, original_name, mime_type, file_size, file_path, created_at`,
            [
              actualCaseId, // case_id (UUID)
              existingCase.caseId, // caseId (integer)
              file.filename,
              file.originalname,
              file.mimetype,
              file.size,
              `/uploads/mobile/${file.filename}`,
              userId,
              userTaskId, // verification_task_id (null for non-field-agents)
            ]
          );
          const attachment = attRes.rows[0];

          uploadedAttachments.push({
            id: attachment.id,
            filename: attachment.filename,
            originalName: attachment.originalName,
            mimeType: attachment.mimeType,
            size: attachment.fileSize,
            url: attachment.filePath,
            thumbnailUrl: null, // No thumbnail generation for mobile uploads
            uploadedAt: new Date(attachment.createdAt).toISOString(),
            geoLocation,
          });

          await createAuditLog({
            action: 'MOBILE_FILE_UPLOADED',
            entityType: 'ATTACHMENT',
            entityId: attachment.id,
            userId,
            details: {
              caseId: actualCaseId,
              caseNumber: existingCase.caseId,
              filename: file.originalname,
              size: file.size,
              mimeType: file.mimetype,
              hasGeoLocation: !!geoLocation,
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
          });
        } catch (fileError) {
          logger.error(`Error processing file ${file.originalname}:`, fileError);
          // Clean up the file
          await fs.unlink(file.path).catch(() => {});
        }
      }

      res.json({
        success: true,
        message: `${uploadedAttachments.length} file(s) uploaded successfully`,
        data: uploadedAttachments,
      });
    } catch (error) {
      logger.error('Mobile file upload error:', error);

      // Clean up uploaded files on error
      if (req.files) {
        const files = req.files as Express.Multer.File[];
        await Promise.all(files.map(file => fs.unlink(file.path).catch(() => {})));
      }

      res.status(500).json({
        success: false,
        message: 'File upload failed',
        error: {
          code: 'FILE_UPLOAD_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Get attachments for a case
  static async getCaseAttachments(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const paramCaseId = String(req.params.caseId || '');
      const paramTaskId = String(req.params.taskId || '');
      const caseId = paramCaseId || paramTaskId;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

      // Check if caseId is a UUID (mobile sends UUID) or case number (web sends case number)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId);

      // Resolve Task ID to Case ID if needed
      let lookupCaseId = caseId;
      if (isUUID) {
        const taskRes = await query(`SELECT case_id FROM verification_tasks WHERE id = $1`, [
          caseId,
        ]);
        if (taskRes.rows.length > 0) {
          lookupCaseId = taskRes.rows[0].caseId;
        }
      }

      // Verify case access and get case details
      const caseVals: QueryParams = [lookupCaseId];
      let caseSql: string;

      if (isUUID) {
        // Mobile app sends UUID
        caseSql = `SELECT id, case_id FROM cases WHERE id = $1`;
      } else {
        // Web app sends case number
        caseSql = `SELECT id, case_id FROM cases WHERE case_id = $1`;
      }

      // For FIELD_AGENT: Check task-level assignment
      if (isExecutionActor) {
        caseSql += ` AND EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = cases.id
          AND vt.assigned_to = $2
        )`;
        caseVals.push(userId);
      }

      const caseCheck = await query(caseSql, caseVals);
      const existingCase = caseCheck.rows[0];

      if (!existingCase) {
        logger.info(`❌ Get attachments: Case not found: ${caseId} (isUUID: ${isUUID})`);
        return res.status(404).json({
          success: false,
          message: 'Case not found or access denied',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
            caseId,
            isUUID,
          },
        });
      }

      const actualCaseId = existingCase.id; // Use the actual UUID from the database

      // Get the field agent's assigned task ID for this case
      let userTaskId: string | null = null;
      if (isExecutionActor) {
        const taskRes = await query(
          `SELECT id FROM verification_tasks WHERE case_id = $1 AND assigned_to = $2 LIMIT 1`,
          [actualCaseId, userId]
        );
        userTaskId = taskRes.rows[0]?.id || null;
      }

      // For field agents, ensure they can only see attachments for their assigned task
      // For other roles (admin, manager), show all attachments for the case
      let attachmentQuery: string;
      let attachmentParams: QueryParams;

      if (isExecutionActor && userTaskId) {
        // Filter attachments by specific verification task OR show attachments with NULL task_id (admin-uploaded/legacy)
        attachmentQuery = `
          SELECT a.id, a.filename, a.original_name, a.mime_type, a.file_size, a.file_path, a.created_at
          FROM attachments a
          WHERE a.case_id = $1
          AND (a.verification_task_id = $2 OR a.verification_task_id IS NULL)
          ORDER BY a.created_at DESC
        `;
        attachmentParams = [actualCaseId, userTaskId];
      } else {
        // Admin/Manager can see all attachments for the case
        attachmentQuery = `
          SELECT id, filename, original_name, mime_type, file_size, file_path, created_at
          FROM attachments
          WHERE case_id = $1
          ORDER BY created_at DESC
        `;
        attachmentParams = [actualCaseId];
      }

      const attRes = await query(attachmentQuery, attachmentParams);

      logger.info(
        `📎 Mobile Get Attachments - Case: ${caseId}, User: ${userId}, ExecutionActor: ${isExecutionActor}, TaskId: ${userTaskId}, Found: ${attRes.rows.length} attachments`
      );
      logger.info(`📋 Query used:`, attachmentQuery);
      logger.info(`📋 Query params:`, attachmentParams);
      logger.info(`📋 Results:`, attRes.rows);

      // Check if client wants base64 data for offline sync
      const includeAttachmentData = req.query.includeAttachmentData === 'true';

      // Build attachment responses
      const mobileAttachments: MobileAttachmentResponse[] = [];

      for (const att of attRes.rows) {
        const attachmentResponse: MobileAttachmentResponse = {
          id: att.id,
          filename: att.filename,
          originalName: att.originalName,
          mimeType: att.mimeType,
          size: att.fileSize,
          url: `${getApiBaseUrl(req)}/mobile/attachments/${att.id}/content`, // Use mobile endpoint
          thumbnailUrl: null, // Not available in current schema
          uploadedAt: new Date(att.createdAt).toISOString(),
          geoLocation: undefined, // Not available in current schema
        };

        // Include base64 data if requested (for offline sync)
        if (includeAttachmentData) {
          try {
            // Construct file path
            const dbFilePath = att.filePath.startsWith('/')
              ? att.filePath.substring(1)
              : att.filePath;
            const filePath = path.join(process.cwd(), dbFilePath);

            // Generate base64 data with checksum
            const { base64Data, checksum } = await generateBase64WithChecksum(filePath);

            attachmentResponse.base64Data = base64Data;
            attachmentResponse.checksum = checksum;

            logger.info(
              `📦 Included base64 data for attachment ${att.id} (${att.originalName}), size: ${base64Data.length} chars`
            );
          } catch (error) {
            logger.error(`⚠️ Failed to generate base64 for attachment ${att.id}:`, error);
            // Continue without base64 data - client can fetch it later if needed
          }
        }

        mobileAttachments.push(attachmentResponse);
      }

      logger.info(
        `✅ Returning ${mobileAttachments.length} attachments to mobile app${includeAttachmentData ? ' (with base64 data)' : ''}`
      );

      res.json({
        success: true,
        message: 'Attachments retrieved successfully',
        data: mobileAttachments,
      });
    } catch (error) {
      logger.error('Get case attachments error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'ATTACHMENTS_FETCH_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Get attachment content
  static async getAttachmentContent(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const attachmentId = String(req.params.attachmentId || '');
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

      // Get attachment with case assignment check
      let attachmentQuery: string;
      let queryParams: QueryParams;

      if (isExecutionActor) {
        // Field agents can only access attachments for their assigned task OR attachments with NULL task_id
        attachmentQuery = `
          SELECT a.id, a.filename, a.original_name, a.mime_type, a.file_size, a.file_path,
                 a.uploaded_by, a.created_at, a.case_id, a.case_id
          FROM attachments a
          JOIN cases c ON a.case_id = c.id
          LEFT JOIN verification_tasks vt ON vt.id = a.verification_task_id
          WHERE a.id = $1
          AND (vt.assigned_to = $2 OR a.verification_task_id IS NULL)
          AND EXISTS (
            SELECT 1 FROM verification_tasks vt2
            WHERE vt2.case_id = c.id
            AND vt2.assigned_to = $2
          )
        `;
        queryParams = [attachmentId, userId];
      } else {
        // Admin/Manager can access any attachment
        attachmentQuery = `
          SELECT a.id, a.filename, a.original_name, a.mime_type, a.file_size, a.file_path,
                 a.uploaded_by, a.created_at, a.case_id, a.case_id
          FROM attachments a
          JOIN cases c ON a.case_id = c.id
          WHERE a.id = $1
        `;
        queryParams = [attachmentId];
      }

      const attRes = await query(attachmentQuery, queryParams);
      const attachment = attRes.rows[0] as unknown as VerificationAttachmentRow;

      logger.info('📎 Attachment object:', JSON.stringify(attachment, null, 2));

      if (!attachment) {
        return res.status(404).json({
          success: false,
          message: isExecutionActor
            ? 'Attachment not found or access denied'
            : 'Attachment not found',
          error: {
            code: 'ATTACHMENT_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Use the filePath from database, removing leading slash if present
      const dbFilePath = attachment.filePath.startsWith('/')
        ? attachment.filePath.substring(1)
        : attachment.filePath;
      const filePath = path.join(process.cwd(), dbFilePath);

      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({
          success: false,
          message: 'File not found on disk',
          error: {
            code: 'FILE_NOT_FOUND',
            timestamp: new Date().toISOString(),
            filePath: dbFilePath, // Include path for debugging
          },
        });
      }

      // Set appropriate headers
      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${attachment.originalName}"`);

      if (String(attachment.mimeType || '').startsWith('image/')) {
        try {
          const createdAt = attachment.createdAt ? new Date(attachment.createdAt) : new Date();
          const dateLabel = Number.isNaN(createdAt.getTime())
            ? new Date().toLocaleString()
            : createdAt.toLocaleString();
          const watermarkText = `ACS CRM | Case ${attachment.caseId} | ${dateLabel}`;
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
          res.end(watermarkedBuffer);
        } catch (watermarkError) {
          logger.error('Watermark generation failed, serving original mobile attachment', {
            attachmentId,
            watermarkError,
          });
          res.setHeader('Content-Length', (attachment.fileSize || 0).toString());
          const fileStream = createReadStream(filePath);
          fileStream.pipe(res);
        }
      } else {
        res.setHeader('Content-Length', (attachment.fileSize || 0).toString());
        const fileStream = createReadStream(filePath);
        fileStream.pipe(res);
      }

      await createAuditLog({
        action: 'MOBILE_ATTACHMENT_ACCESSED',
        entityType: 'ATTACHMENT',
        entityId: attachmentId,
        userId,
        details: {
          caseId: attachment.caseId,
          filename: attachment.originalName,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
    } catch (error) {
      logger.error('Get attachment content error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'ATTACHMENT_ACCESS_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Delete attachment
  static async deleteAttachment(this: void, req: AuthenticatedRequest, res: Response) {
    type AttachmentWithStatus = VerificationAttachmentRow & {
      status?: string;
      assignedTo?: string;
    };
    try {
      const attachmentId = String(req.params.attachmentId || '');
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

      // Get attachment with case assignment check
      let attachmentQuery: string;
      let queryParams: QueryParams;

      if (isExecutionActor) {
        // Field agents can only delete attachments for their assigned task OR attachments with NULL task_id
        attachmentQuery = `
          SELECT a.id, a.filename, a.original_name, a.mime_type, a.file_size, a.file_path,
                 a.uploaded_by, a.created_at, a.case_id, c.assigned_to, c.status
          FROM attachments a
          JOIN cases c ON a.case_id = c.id
          LEFT JOIN verification_tasks vt ON vt.id = a.verification_task_id
          WHERE a.id = $1
          AND (vt.assigned_to = $2 OR a.verification_task_id IS NULL)
          AND EXISTS (
            SELECT 1 FROM verification_tasks vt2
            WHERE vt2.case_id = c.id
            AND vt2.assigned_to = $2
          )
        `;
        queryParams = [attachmentId, userId];
      } else {
        // Admin/Manager can delete any attachment
        attachmentQuery = `
          SELECT a.id, a.filename, a.original_name, a.mime_type, a.file_size, a.file_path,
                 a.uploaded_by, a.created_at, a.case_id, c.assigned_to, c.status
          FROM attachments a
          JOIN cases c ON a.case_id = c.id
          WHERE a.id = $1
        `;
        queryParams = [attachmentId];
      }

      const attRes = await query(attachmentQuery, queryParams);
      const attachment = attRes.rows[0] as unknown as AttachmentWithStatus;

      if (!attachment) {
        return res.status(404).json({
          success: false,
          message: isExecutionActor
            ? 'Attachment not found or access denied'
            : 'Attachment not found',
          error: {
            code: 'ATTACHMENT_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Prevent deletion if case is completed
      if (attachment.status === 'COMPLETED') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete attachments from completed cases',
          error: {
            code: 'CASE_COMPLETED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Delete from database
      await query(`DELETE FROM attachments WHERE id = $1`, [attachmentId]);

      // Delete files from disk
      const filePath = path.join(process.cwd(), 'uploads', 'mobile', attachment.filename);
      await fs.unlink(filePath).catch(() => {});

      // Always try to delete thumbnail based on naming convention
      const thumbnailPath = path.join(
        process.cwd(),
        'uploads',
        'mobile',
        'thumbnails',
        `thumb_${attachment.filename}`
      );
      await fs.unlink(thumbnailPath).catch(() => {});

      await createAuditLog({
        action: 'MOBILE_ATTACHMENT_DELETED',
        entityType: 'ATTACHMENT',
        entityId: attachmentId,
        userId,
        details: {
          caseId: attachment.caseId,
          filename: attachment.originalName,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        message: 'Attachment deleted successfully',
      });
    } catch (error) {
      logger.error('Delete attachment error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'ATTACHMENT_DELETE_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Get attachments for multiple cases in batch
   * Reduces the number of API calls from frontend
   */
  static async getBatchAttachments(
    this: void,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { caseIds } = req.body;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

      if (!Array.isArray(caseIds) || caseIds.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Case IDs array is required',
          error: {
            code: 'INVALID_CASE_IDS',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Limit batch size to prevent abuse
      if (caseIds.length > 50) {
        res.status(400).json({
          success: false,
          message: 'Maximum 50 cases allowed per batch request',
          error: {
            code: 'BATCH_SIZE_EXCEEDED',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      logger.info('📦 Batch attachments request for cases:', caseIds.length);

      // Create placeholders for the IN clause
      const placeholders = caseIds.map((_, index) => `$${index + 1}`).join(', ');

      // Build query with proper access control
      let attachmentsSql: string;
      let queryParams: QueryParams;

      if (isExecutionActor) {
        // Field agents can only see attachments for cases with assigned tasks
        attachmentsSql = `
          SELECT
            a.id,
            a.case_id,
            a.filename,
            a.original_name,
            a.mime_type,
            a.file_size,
            a.uploaded_at,
            a.uploaded_by,
            a.metadata,
            a.is_processed,
            a.processing_status,
            a.thumbnail_path,
            a.compressed_path,
            u.name as "uploaderName"
          FROM attachments a
          LEFT JOIN users u ON u.id = a.uploaded_by
          JOIN cases c ON a.case_id = c.id
          WHERE a.case_id IN (${placeholders})
          AND EXISTS (
            SELECT 1 FROM verification_tasks vt
            WHERE vt.case_id = c.id
            AND vt.assigned_to = $${caseIds.length + 1}
          )
          ORDER BY a.case_id, a.uploaded_at DESC
        `;
        queryParams = [...caseIds, userId];
      } else {
        // Admin/Manager can see all attachments
        attachmentsSql = `
          SELECT
            a.id,
            a.case_id,
            a.filename,
            a.original_name,
            a.mime_type,
            a.file_size,
            a.uploaded_at,
            a.uploaded_by,
            a.metadata,
            a.is_processed,
            a.processing_status,
            a.thumbnail_path,
            a.compressed_path,
            u.name as "uploaderName"
          FROM attachments a
          LEFT JOIN users u ON u.id = a.uploaded_by
          WHERE a.case_id IN (${placeholders})
          ORDER BY a.case_id, a.uploaded_at DESC
        `;
        queryParams = caseIds;
      }

      const attachmentsResult = await query(attachmentsSql, queryParams);

      // Group attachments by case ID
      const attachmentsByCase: Record<string, { id: string; [key: string]: unknown }[]> = {};

      // Initialize all case IDs with empty arrays
      caseIds.forEach(caseId => {
        attachmentsByCase[caseId] = [];
      });

      // Group the results
      attachmentsResult.rows.forEach(attachment => {
        const caseId = attachment.caseId;
        if (!attachmentsByCase[caseId]) {
          attachmentsByCase[caseId] = [];
        }

        attachmentsByCase[caseId].push({
          id: attachment.id,
          filename: attachment.filename,
          originalName: attachment.originalName,
          mimeType: attachment.mimeType,
          fileSize: attachment.fileSize,
          uploadedAt: attachment.uploadedAt,
          uploadedBy: attachment.uploadedBy,
          uploaderName: attachment.uploaderName,
          metadata: attachment.metadata,
          isProcessed: attachment.isProcessed,
          processingStatus: attachment.processingStatus,
          thumbnailPath: attachment.thumbnailPath,
          compressedPath: attachment.compressedPath,
          downloadUrl: `${getApiBaseUrl(req)}/attachments/${attachment.id}/content`,
        });
      });

      logger.info('📦 Batch attachments results:', {
        requestedCases: caseIds.length,
        totalAttachments: attachmentsResult.rows.length,
        casesWithAttachments: Object.keys(attachmentsByCase).filter(
          caseId => attachmentsByCase[caseId].length > 0
        ).length,
      });

      res.json({
        success: true,
        message: 'Batch attachments retrieved successfully',
        data: {
          attachmentsByCase,
          summary: {
            totalCases: caseIds.length,
            totalAttachments: attachmentsResult.rows.length,
            casesWithAttachments: Object.keys(attachmentsByCase).filter(
              caseId => attachmentsByCase[caseId].length > 0
            ).length,
          },
        },
      });
    } catch (error) {
      logger.error('Batch attachments error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'BATCH_ATTACHMENTS_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}
