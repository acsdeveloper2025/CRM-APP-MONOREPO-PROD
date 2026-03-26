import type { Request, Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import type { QueryParams } from '@/types/database';
import { getAssignedClientIds } from '@/middleware/clientAccess';
import { getAssignedProductIds } from '@/middleware/productAccess';
import {
  hasSystemScopeBypass,
  isFieldExecutionActor,
  isScopedOperationsUser,
} from '@/security/rbacAccess';
import { getScopedOperationalUserIds } from '@/security/userScope';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

// In-memory attachment index for update/delete operations (upload uses database)
const attachments: Record<string, unknown>[] = [
  {
    id: 'attachment_1',
    filename: 'residence_photo_1.jpg',
    originalName: 'front_view.jpg',
    mimeType: 'image/jpeg',
    size: 1024000,
    caseId: 'case_3',
    uploadedBy: 'user_1',
    uploadedAt: '2024-01-05T00:00:00.000Z',
    filePath: '/uploads/attachments/attachment_1.jpg',
    description: 'Front view of residence',
    category: 'PHOTO',
    isPublic: false,
  },
  {
    id: 'attachment_2',
    filename: 'verification_report.pdf',
    originalName: 'verification_report.pdf',
    mimeType: 'application/pdf',
    size: 512000,
    caseId: 'case_3',
    uploadedBy: 'user_1',
    uploadedAt: '2024-01-05T00:30:00.000Z',
    filePath: '/uploads/attachments/attachment_2.pdf',
    description: 'Verification report document',
    category: 'DOCUMENT',
    isPublic: false,
  },
];

// Supported file types - ONLY images, PDF, and Word documents
const SUPPORTED_FILE_TYPES = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
  documents: ['.pdf', '.doc', '.docx'], // Removed .txt, .rtf
};

const ALL_SUPPORTED_EXTENSIONS = [
  ...SUPPORTED_FILE_TYPES.images,
  ...SUPPORTED_FILE_TYPES.documents,
];

const enforceBackendUserCaseScope = async (
  userId: string | undefined,
  user: AuthenticatedRequest['user'] | undefined,
  caseUuid: string | undefined
): Promise<boolean> => {
  if (!userId || !user || !caseUuid) {
    return false;
  }

  if (!isScopedOperationsUser(user)) {
    return true;
  }

  const { query } = await import('@/config/database');
  const caseResult = await query<{
    clientId: number;
    productId: number;
    createdByBackendUser: string | null;
    assignedTo: string | null;
  }>(
    `SELECT "clientId", "productId", "createdByBackendUser", "assignedTo" FROM cases WHERE id = $1`,
    [caseUuid]
  );

  if (caseResult.rows.length === 0) {
    return false;
  }

  const scopedUserIds = await getScopedOperationalUserIds(userId);
  if (scopedUserIds) {
    const scopeCheck = await query(
      `SELECT 1
       FROM cases c
       LEFT JOIN verification_tasks vt ON vt.case_id = c.id
       WHERE c.id = $1
         AND (
           c."createdByBackendUser" = ANY($2::uuid[]) OR
           c."assignedTo" = ANY($2::uuid[]) OR
           vt.assigned_to = ANY($2::uuid[])
         )
       LIMIT 1`,
      [caseUuid, scopedUserIds]
    );
    return scopeCheck.rows.length > 0;
  }

  const [assignedClientIds, assignedProductIds] = await Promise.all([
    getAssignedClientIds(userId),
    getAssignedProductIds(userId),
  ]);

  if (
    !assignedClientIds ||
    !assignedProductIds ||
    assignedClientIds.length === 0 ||
    assignedProductIds.length === 0
  ) {
    return false;
  }

  const row = caseResult.rows[0];
  return (
    assignedClientIds.includes(Number(row.clientId)) &&
    assignedProductIds.includes(Number(row.productId))
  );
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create a general uploads directory first, we'll organize by case later
    const uploadDir = path.join(process.cwd(), 'uploads', 'attachments', 'temp');
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extension = path.extname(file.originalname);
    cb(null, `attachment_${uniqueSuffix}${extension}`);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const extension = path.extname(file.originalname).toLowerCase();

  // Handle files without extensions
  if (!extension) {
    return cb(
      new Error(
        `File must have a valid extension. Supported types: ${ALL_SUPPORTED_EXTENSIONS.join(', ')}`
      )
    );
  }

  if (ALL_SUPPORTED_EXTENSIONS.includes(extension)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `File type ${extension} is not supported. Supported types: ${ALL_SUPPORTED_EXTENSIONS.join(', ')}`
      )
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit (increased for mobile app with multiple high-res images)
    files: 20, // Maximum 20 files per upload
  },
});

// POST /api/attachments/upload - Upload attachment
export const uploadAttachment = (req: AuthenticatedRequest, res: Response) => {
  try {
    // Use multer middleware
    upload.array('files', 10)(req, res, (err: unknown) => {
      void (async () => {
        if (err) {
          logger.error('File upload error:', err);
          return res.status(400).json({
            success: false,
            message: err instanceof Error ? err.message : 'File upload failed',
            error: { code: 'UPLOAD_ERROR' },
          });
        }

        const files = req.files as Express.Multer.File[];
        const {
          caseId,
          // description,
          // category = 'DOCUMENT',
          // isPublic = false,
          verification_task_id: verificationTaskId,
        } = req.body;

        if (!files || files.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No files uploaded',
            error: { code: 'NO_FILES' },
          });
        }

        if (!caseId) {
          return res.status(400).json({
            success: false,
            message: 'Case ID is required',
            error: { code: 'MISSING_CASE_ID' },
          });
        }

        // Import query function
        const { query } = await import('@/config/database');

        // Get case UUID and verify access for mobile compatibility
        let caseQuery: string;
        let caseParams: QueryParams;

        if (isFieldExecutionActor(req.user)) {
          // Field agents can only upload to cases assigned to them
          caseQuery = 'SELECT id FROM cases WHERE "caseId" = $1 AND "assignedTo" = $2';
          caseParams = [caseId, req.user.id];
        } else {
          // Admin/Manager can upload to any case
          caseQuery = 'SELECT id FROM cases WHERE "caseId" = $1';
          caseParams = [caseId];
        }

        const caseResult = await query(caseQuery, caseParams);

        if (caseResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: isFieldExecutionActor(req.user)
              ? 'Case not found or not assigned to you'
              : 'Case not found',
            error: { code: 'CASE_NOT_FOUND' },
          });
        }

        const caseUUID = caseResult.rows[0].id;
        const uploadedAttachments = [];

        // Sanitize caseId to prevent path traversal (strip anything except alphanumeric, dash, underscore)
        const safeCaseId = String(caseId).replace(/[^a-zA-Z0-9_-]/g, '');
        const caseUploadDir = path.join(
          process.cwd(),
          'uploads',
          'attachments',
          `case_${safeCaseId}`
        );
        if (!fs.existsSync(caseUploadDir)) {
          fs.mkdirSync(caseUploadDir, { recursive: true });
        }

        for (const file of files) {
          // Move file from temp directory to case-specific directory
          const tempPath = file.path;
          const finalPath = path.join(caseUploadDir, file.filename);

          try {
            fs.renameSync(tempPath, finalPath);
          } catch (error) {
            logger.error('Error moving file to case directory:', error);
            // If rename fails, try copy and delete
            fs.copyFileSync(tempPath, finalPath);
            fs.unlinkSync(tempPath);
          }

          // Insert attachment into database
          const insertResult = await query(
            `INSERT INTO attachments (
            filename,
            "originalName",
            "mimeType",
            "fileSize",
            "filePath",
            "uploadedBy",
            "caseId",
            case_id,
            verification_task_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, filename, "originalName", "mimeType", "fileSize" as size, "filePath", "uploadedBy", "createdAt" as "uploadedAt", "caseId"`,
            [
              file.filename,
              file.originalname,
              file.mimetype,
              file.size,
              `/uploads/attachments/case_${caseId}/${file.filename}`,
              req.user?.id,
              caseId,
              caseUUID, // Add the case UUID for mobile compatibility

              verificationTaskId || null, // Add verification_task_id if provided
            ]
          );

          const newAttachment = insertResult.rows[0];
          uploadedAttachments.push(newAttachment);
        }

        logger.info(`Uploaded ${uploadedAttachments.length} attachments`, {
          userId: req.user?.id,
          caseId,
          fileCount: uploadedAttachments.length,
          totalSize: uploadedAttachments.reduce((sum, att) => sum + att.size, 0),
        });

        // Send success response
        res.status(201).json({
          success: true,
          message: 'Files uploaded successfully',
          data: {
            uploaded: uploadedAttachments,
            count: uploadedAttachments.length,
          },
        });
      })();
    });
  } catch (error) {
    logger.error('Error uploading attachment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload attachment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/attachments/case/:caseId - Get attachments by case
export const getAttachmentsByCase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const { category, limit = 50 } = req.query;
    const userId = req.user?.id;
    const isExecutionActor = isFieldExecutionActor(req.user);

    // Import query function
    const { query } = await import('@/config/database');

    // Build query with proper access control and optional category filter
    let queryText: string;
    let queryParams: QueryParams;

    if (isExecutionActor) {
      // Field agents can only see attachments for cases assigned to them
      queryText = `
        SELECT
          a.id,
          a.filename,
          a."originalName",
          a."mimeType",
          a."fileSize" as size,
          a."filePath",
          a."uploadedBy",
          a."createdAt" as "uploadedAt",
          a."caseId",
          a.verification_task_id
        FROM attachments a
        JOIN cases c ON a.case_id = c.id
        WHERE a."caseId" = $1 AND c."assignedTo" = $2
      `;
      queryParams = [caseId, userId];
    } else {
      // Admin/Manager can see all attachments for the case
      queryText = `
        SELECT
          id,
          filename,
          "originalName",
          "mimeType",
          "fileSize" as size,
          "filePath",
          "uploadedBy",
          "createdAt" as "uploadedAt",
          "caseId",
          verification_task_id
        FROM attachments
        WHERE "caseId" = $1
      `;
      queryParams = [caseId];
    }

    queryText += ` ORDER BY "createdAt" DESC LIMIT $${queryParams.length + 1}`;
    queryParams.push(typeof limit === 'string' || typeof limit === 'number' ? String(limit) : '50');

    const result = await query(queryText, queryParams);
    const caseAttachments = result.rows;

    logger.info(`Retrieved ${caseAttachments.length} attachments for case ${caseId}`, {
      userId: req.user?.id,
      caseId,
      category,
    });

    res.json({
      success: true,
      data: caseAttachments,
    });
  } catch (error) {
    logger.error('Error getting attachments by case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get attachments',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/attachments/:id - Get attachment by ID
export const getAttachmentById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const isExecutionActor = isFieldExecutionActor(req.user);

    // Import query function
    const { query } = await import('@/config/database');

    // Get attachment with case assignment check for field agents
    let attachmentQuery: string;
    let queryParams: QueryParams;

    if (isExecutionActor) {
      // Field agents can only access attachments for cases assigned to them
      attachmentQuery = `
        SELECT a.id, a.filename, a."originalName", a."mimeType", a."fileSize",
               a."filePath", a."uploadedBy", a."createdAt", a."caseId", a.case_id
        FROM attachments a
        JOIN cases c ON a.case_id = c.id
        WHERE a.id = $1 AND c."assignedTo" = $2
      `;
      queryParams = [id, userId];
    } else {
      // Admin/Manager can access any attachment
      attachmentQuery = `
        SELECT id, filename, "originalName", "mimeType", "fileSize",
               "filePath", "uploadedBy", "createdAt", "caseId", case_id
        FROM attachments
        WHERE id = $1
      `;
      queryParams = [id];
    }

    const result = await query(attachmentQuery, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: isExecutionActor
          ? 'Attachment not found or access denied'
          : 'Attachment not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const attachment = result.rows[0];

    const backendScopeOk = await enforceBackendUserCaseScope(
      userId,
      req.user,
      attachment.case_id as string | undefined
    );
    if (!backendScopeOk) {
      return res.status(403).json({
        success: false,
        message: 'Attachment not found or access denied',
        error: { code: 'FORBIDDEN' },
      });
    }

    logger.info(`Retrieved attachment ${id}`, { userId: req.user?.id });

    res.json({
      success: true,
      data: {
        id: attachment.id,
        filename: attachment.filename,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        size: attachment.fileSize,
        filePath: attachment.filePath,
        uploadedBy: attachment.uploadedBy,
        uploadedAt: attachment.createdAt,
        caseId: attachment.caseId,
      },
    });
  } catch (error) {
    logger.error('Error getting attachment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get attachment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/attachments/:id - Delete attachment
export const deleteAttachment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const isExecutionActor = isFieldExecutionActor(req.user);

    // Import query function
    const { query } = await import('@/config/database');

    // Get attachment details with case assignment check
    let attachmentQuery: string;
    let queryParams: QueryParams;

    if (isExecutionActor) {
      // Field agents can only delete attachments for cases assigned to them
      attachmentQuery = `
        SELECT a.filename, a."filePath", a."uploadedBy", a."caseId"
             , a.case_id
        FROM attachments a
        JOIN cases c ON a.case_id = c.id
        WHERE a.id = $1 AND c."assignedTo" = $2
      `;
      queryParams = [id, userId];
    } else {
      // Admin/Manager can delete any attachment
      attachmentQuery =
        'SELECT filename, "filePath", "uploadedBy", "caseId", case_id FROM attachments WHERE id = $1';
      queryParams = [id];
    }

    const attachmentResult = await query(attachmentQuery, queryParams);

    if (attachmentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: isExecutionActor
          ? 'Attachment not found or access denied'
          : 'Attachment not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const attachment = attachmentResult.rows[0];

    const backendScopeOk = await enforceBackendUserCaseScope(
      userId,
      req.user,
      attachment.case_id as string | undefined
    );
    if (!backendScopeOk) {
      return res.status(403).json({
        success: false,
        message: 'Attachment not found or access denied',
        error: { code: 'FORBIDDEN' },
      });
    }

    // Additional permission check: owner or admin can delete
    if (!hasSystemScopeBypass(req.user) && attachment.uploadedBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this attachment',
        error: { code: 'FORBIDDEN' },
      });
    }

    // Delete file from filesystem
    const filePath = path.join(
      process.cwd(),
      'uploads',
      'attachments',
      `case_${attachment.caseId}`,
      attachment.filename
    );
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await query('DELETE FROM attachments WHERE id = $1', [id]);

    logger.info(`Deleted attachment: ${id}`, {
      userId: req.user?.id,
      filename: attachment.filename,
      caseId: attachment.caseId,
    });

    res.json({
      success: true,
      message: 'Attachment deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting attachment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete attachment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/attachments/:id - Update attachment metadata
export const updateAttachment = (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { description, category, isPublic } = req.body;

    const attachmentIndex = attachments.findIndex(att => att.id === id);
    if (attachmentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const attachment = attachments[attachmentIndex];

    // Check if user has permission to update (owner or admin)
    if (attachment.uploadedBy !== req.user?.id && !hasSystemScopeBypass(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this attachment',
        error: { code: 'FORBIDDEN' },
      });
    }

    // Update metadata
    if (description !== undefined) {
      attachment.description = description;
    }
    if (category !== undefined) {
      attachment.category = category;
    }
    if (isPublic !== undefined) {
      attachment.isPublic = isPublic;
    }

    logger.info(`Updated attachment metadata: ${id}`, {
      userId: req.user?.id,
      changes: { description, category, isPublic },
    });

    res.json({
      success: true,
      data: attachment,
      message: 'Attachment updated successfully',
    });
  } catch (error) {
    logger.error('Error updating attachment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update attachment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/attachments/:id/download - Download attachment
export const downloadAttachment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const isExecutionActor = isFieldExecutionActor(req.user);

    // Import query function
    const { query } = await import('@/config/database');

    // Get attachment details with case assignment check
    let attachmentQuery: string;
    let queryParams: QueryParams;

    if (isExecutionActor) {
      // Field agents can only download attachments for cases assigned to them
      attachmentQuery = `
        SELECT a.filename, a."originalName", a."mimeType", a."fileSize", a."caseId"
             , a.case_id
        FROM attachments a
        JOIN cases c ON a.case_id = c.id
        WHERE a.id = $1 AND c."assignedTo" = $2
      `;
      queryParams = [id, userId];
    } else {
      // Admin/Manager can download any attachment
      attachmentQuery =
        'SELECT filename, "originalName", "mimeType", "fileSize", "caseId", case_id FROM attachments WHERE id = $1';
      queryParams = [id];
    }

    const attachmentResult = await query(attachmentQuery, queryParams);

    if (attachmentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: isExecutionActor
          ? 'Attachment not found or access denied'
          : 'Attachment not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const attachment = attachmentResult.rows[0];

    const backendScopeOk = await enforceBackendUserCaseScope(
      userId,
      req.user,
      attachment.case_id as string | undefined
    );
    if (!backendScopeOk) {
      return res.status(403).json({
        success: false,
        message: 'Attachment not found or access denied',
        error: { code: 'FORBIDDEN' },
      });
    }

    // Check if file exists in case-specific folder
    const filePath = path.join(
      process.cwd(),
      'uploads',
      'attachments',
      `case_${attachment.caseId}`,
      attachment.filename
    );
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server',
        error: { code: 'FILE_NOT_FOUND' },
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Length', attachment.fileSize.toString());

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    logger.info(`Downloaded attachment: ${id}`, {
      userId: req.user?.id,
      filename: attachment.originalName,
      size: attachment.fileSize,
      caseId: attachment.caseId,
    });
  } catch (error) {
    logger.error('Error downloading attachment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download attachment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/attachments/:id/serve - Serve attachment for viewing (secure)
export const serveAttachment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const isExecutionActor = isFieldExecutionActor(req.user);

    // Import query function
    const { query } = await import('@/config/database');

    // Get attachment details with case assignment check
    let attachmentQuery: string;
    let queryParams: QueryParams;

    if (isExecutionActor) {
      // Field agents can only serve attachments for cases assigned to them
      attachmentQuery = `
        SELECT a.filename, a."originalName", a."mimeType", a."fileSize", a."caseId", a."filePath", a."createdAt"
             , a.case_id
        FROM attachments a
        JOIN cases c ON a.case_id = c.id
        WHERE a.id = $1 AND c."assignedTo" = $2
      `;
      queryParams = [id, userId];
    } else {
      // Admin/Manager can serve any attachment
      attachmentQuery =
        'SELECT filename, "originalName", "mimeType", "fileSize", "caseId", "filePath", "createdAt", case_id FROM attachments WHERE id = $1';
      queryParams = [id];
    }

    const attachmentResult = await query(attachmentQuery, queryParams);

    if (attachmentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: isExecutionActor
          ? 'Attachment not found or access denied'
          : 'Attachment not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const attachment = attachmentResult.rows[0];

    const backendScopeOk = await enforceBackendUserCaseScope(
      userId,
      req.user,
      attachment.case_id as string | undefined
    );
    if (!backendScopeOk) {
      return res.status(403).json({
        success: false,
        message: 'Attachment not found or access denied',
        error: { code: 'FORBIDDEN' },
      });
    }

    const fromDbPath = attachment.filePath
      ? path.join(process.cwd(), String(attachment.filePath).replace(/^\//, ''))
      : '';
    // Prefer stored file path (works for both web and mobile uploads), then fallback to legacy path
    const fallbackPath = path.join(
      process.cwd(),
      'uploads',
      'attachments',
      `case_${attachment.caseId}`,
      attachment.filename
    );
    const filePath = fromDbPath && fs.existsSync(fromDbPath) ? fromDbPath : fallbackPath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server',
        error: { code: 'FILE_NOT_FOUND' },
      });
    }

    // Set appropriate headers for viewing (not downloading)
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Length', attachment.fileSize.toString());
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
    // CORS headers are handled globally in app.ts (credentials-aware)

    if (String(attachment.mimeType || '').startsWith('image/')) {
      try {
        const createdAt = attachment.createdAt ? new Date(attachment.createdAt) : new Date();
        const dateLabel = Number.isNaN(createdAt.getTime())
          ? new Date().toLocaleString()
          : createdAt.toLocaleString();
        const watermarkText = `ACS CRM | Case #${attachment.caseId} | ${dateLabel}`;
        const escapedText = watermarkText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
        const svgOverlay = `
          <svg width="800" height="56" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="800" height="56" fill="rgba(0,0,0,0.45)" />
            <text x="14" y="35" fill="white" font-size="18" font-family="Arial, sans-serif">${escapedText}</text>
          </svg>
        `;
        const watermarkedBuffer = await sharp(filePath)
          .composite([{ input: Buffer.from(svgOverlay), gravity: 'southeast' }])
          .toBuffer();
        res.setHeader('Content-Length', watermarkedBuffer.length.toString());
        res.end(watermarkedBuffer);
      } catch (watermarkError) {
        logger.error('Watermark generation failed, serving original file:', watermarkError);
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
      }
    } else {
      // Stream non-image files as-is
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }

    logger.info(`Served attachment: ${id}`, {
      userId: req.user?.id,
      filename: attachment.originalName,
      size: attachment.fileSize,
      caseId: attachment.caseId,
    });
  } catch (error) {
    logger.error('Error serving attachment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to serve attachment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/attachments/types - Get supported file types
export const getSupportedFileTypes = (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileTypes = {
      images: {
        extensions: SUPPORTED_FILE_TYPES.images,
        description: 'Image files (JPEG, PNG, GIF, BMP, WebP)',
        maxSize: '10MB',
      },
      documents: {
        extensions: SUPPORTED_FILE_TYPES.documents,
        description: 'Document files (PDF, DOC, DOCX)',
        maxSize: '10MB',
      },
    };

    res.json({
      success: true,
      data: {
        supportedTypes: fileTypes,
        maxFileSize: '10MB',
        maxFilesPerUpload: 15,
        allSupportedExtensions: ALL_SUPPORTED_EXTENSIONS,
      },
    });
  } catch (error) {
    logger.error('Error getting supported file types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get supported file types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/attachments/bulk-upload - Bulk upload attachments
export const bulkUploadAttachments = (req: AuthenticatedRequest, res: Response) => {
  try {
    // Use multer middleware for multiple files
    upload.array('files', 50)(req, res, (err: unknown) => {
      // Removed async wrapper as no await is used here
      if (err) {
        logger.error('Bulk upload error:', err);
        return res.status(400).json({
          success: false,
          message: err instanceof Error ? err.message : 'Bulk upload failed',
          error: { code: 'UPLOAD_ERROR' },
        });
      }

      const files = req.files as Express.Multer.File[];
      const { caseIds, descriptions, categories, isPublic = false } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded',
          error: { code: 'NO_FILES' },
        });
      }

      // Parse arrays if they're strings
      const caseIdArray = Array.isArray(caseIds) ? caseIds : [caseIds];
      const descriptionArray = Array.isArray(descriptions) ? descriptions : [descriptions];
      const categoryArray = Array.isArray(categories) ? categories : [categories];

      const uploadedAttachments = [];
      const errors = [];

      for (let i = 0; i < files.length; i++) {
        try {
          const file = files[i];
          const caseId = caseIdArray[i] || caseIdArray[0];
          const description =
            descriptionArray[i] || descriptionArray[0] || `Uploaded file: ${file.originalname}`;
          const category = categoryArray[i] || categoryArray[0] || 'DOCUMENT';

          if (!caseId) {
            errors.push(`File ${file.originalname}: Case ID is required`);
            continue;
          }

          const newAttachment = {
            id: `attachment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            caseId,
            uploadedBy: req.user?.id,
            uploadedAt: new Date().toISOString(),
            filePath: `/uploads/attachments/${file.filename}`,
            description,
            category,
            isPublic: isPublic === 'true' || isPublic === true,
          };

          attachments.push(newAttachment);
          uploadedAttachments.push(newAttachment);
        } catch (error) {
          errors.push(`File ${files[i].originalname}: ${error}`);
        }
      }

      logger.info(`Bulk uploaded ${uploadedAttachments.length} attachments`, {
        userId: req.user?.id,
        successCount: uploadedAttachments.length,
        errorCount: errors.length,
        totalSize: uploadedAttachments.reduce((sum, att) => sum + att.size, 0),
      });

      res.status(201).json({
        success: true,
        data: {
          uploaded: uploadedAttachments,
          errors,
          summary: {
            total: files.length,
            successful: uploadedAttachments.length,
            failed: errors.length,
          },
        },
        message: `Bulk upload completed: ${uploadedAttachments.length} successful, ${errors.length} failed`,
      });
    });
  } catch (error) {
    logger.error('Error in bulk upload:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk upload attachments',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/attachments/bulk-delete - Bulk delete attachments
export const bulkDeleteAttachments = (req: AuthenticatedRequest, res: Response) => {
  try {
    const { attachmentIds } = req.body;

    if (!attachmentIds || !Array.isArray(attachmentIds) || attachmentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Attachment IDs array is required',
        error: { code: 'MISSING_ATTACHMENT_IDS' },
      });
    }

    const deletedAttachments = [];
    const errors = [];

    for (const id of attachmentIds) {
      try {
        const attachmentIndex = attachments.findIndex(att => att.id === id);
        if (attachmentIndex === -1) {
          errors.push(`Attachment ${id}: Not found`);
          continue;
        }

        const attachment = attachments[attachmentIndex];

        // Check permissions
        if (attachment.uploadedBy !== req.user?.id && !hasSystemScopeBypass(req.user)) {
          errors.push(`Attachment ${id}: Permission denied`);
          continue;
        }

        // Delete file from filesystem
        const filePath = path.join(
          process.cwd(),
          'uploads',
          'attachments',
          attachment.filename as string
        );
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        // Remove from array
        attachments.splice(attachmentIndex, 1);
        deletedAttachments.push(id);
      } catch (error) {
        errors.push(`Attachment ${id}: ${error}`);
      }
    }

    logger.info(`Bulk deleted ${deletedAttachments.length} attachments`, {
      userId: req.user?.id,
      successCount: deletedAttachments.length,
      errorCount: errors.length,
    });

    res.json({
      success: true,
      data: {
        deleted: deletedAttachments,
        errors,
        summary: {
          total: attachmentIds.length,
          successful: deletedAttachments.length,
          failed: errors.length,
        },
      },
      message: `Bulk delete completed: ${deletedAttachments.length} successful, ${errors.length} failed`,
    });
  } catch (error) {
    logger.error('Error in bulk delete:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk delete attachments',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
