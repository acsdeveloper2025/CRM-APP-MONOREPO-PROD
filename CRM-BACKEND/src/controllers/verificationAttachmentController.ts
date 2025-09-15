import { Request, Response } from 'express';
import { query } from '@/config/database';
import { createAuditLog } from '@/utils/auditLogger';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import sharp from 'sharp';
import { config } from '@/config';

// Configure storage for verification attachments
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const { caseId } = req.params;
    const verificationType = req.body.verificationType || 'verification';
    
    const uploadDir = path.join(
      process.cwd(), 
      'uploads', 
      'verification', 
      verificationType.toLowerCase(),
      caseId
    );
    
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const photoType = req.body.photoType || 'verification';
    
    cb(null, `${photoType}_${timestamp}_${randomSuffix}${extension}`);
  }
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
    files: 10, // Reasonable limit for verification photos
  },
});

export class VerificationAttachmentController {
  /**
   * Upload verification images during form submission
   */
  static async uploadVerificationImages(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const { 
        verificationType, 
        submissionId, 
        geoLocation,
        photoType = 'verification' 
      } = req.body;
      
      const userId = (req as any).user?.id;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded',
          error: { code: 'NO_FILES_UPLOADED' }
        });
      }

      // Verify case exists and user has access
      const caseResult = await query(
        `SELECT id, "caseId", status FROM cases WHERE id = $1`,
        [caseId]
      );

      if (caseResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: { code: 'CASE_NOT_FOUND' }
        });
      }

      const existingCase = caseResult.rows[0];
      const uploadedAttachments: any[] = [];

      // Process each uploaded file
      for (const file of files) {
        try {
          let thumbnailPath: string | null = null;

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
              case_id, "caseId", verification_type, filename, "originalName", 
              "mimeType", "fileSize", "filePath", "thumbnailPath", "uploadedBy", 
              "geoLocation", "photoType", "submissionId"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id, filename, "originalName", "mimeType", "fileSize", "filePath", 
                     "thumbnailPath", "createdAt", "photoType"`,
            [
              caseId,
              existingCase.caseId,
              verificationType,
              file.filename,
              file.originalname,
              file.mimetype,
              file.size,
              `/uploads/verification/${verificationType.toLowerCase()}/${caseId}/${file.filename}`,
              thumbnailPath ? `/uploads/verification/${verificationType.toLowerCase()}/${caseId}/thumbnails/thumb_${path.basename(file.path)}` : null,
              userId,
              geoLocation ? JSON.stringify(geoLocation) : null,
              photoType,
              submissionId
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
            geoLocation
          });

        } catch (fileError) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
          // Clean up file on error
          try {
            await fs.unlink(file.path);
          } catch (unlinkError) {
            console.error('Error cleaning up file:', unlinkError);
          }
        }
      }

      // Create audit log
      await createAuditLog({
        action: 'VERIFICATION_IMAGES_UPLOADED',
        entityType: 'CASE',
        entityId: caseId,
        userId,
        details: {
          verificationType,
          photoCount: uploadedAttachments.length,
          submissionId,
          photoType
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        message: `${uploadedAttachments.length} verification images uploaded successfully`,
        data: {
          attachments: uploadedAttachments,
          caseId,
          verificationType,
          submissionId
        }
      });

    } catch (error) {
      console.error('Upload verification images error:', error);
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
  static async getVerificationImages(req: Request, res: Response) {
    try {
      // Handle both route patterns: /:id/verification-images and /cases/:caseId/verification-images
      const caseId = req.params.caseId || req.params.id;
      const { verificationType, submissionId } = req.query;

      console.log('🔍 Getting verification images for case:', caseId, 'submissionId:', submissionId);

      // First get the case UUID from the case number
      const caseResult = await query(
        `SELECT id FROM cases WHERE "caseId" = $1`,
        [caseId]
      );

      if (caseResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: { code: 'CASE_NOT_FOUND' }
        });
      }

      const caseUuid = caseResult.rows[0].id;
      console.log('📋 Case UUID:', caseUuid);

      // First try to get images from verification_attachments table
      let whereClause = 'WHERE case_id = $1';
      const queryParams: any[] = [caseUuid];

      if (verificationType) {
        whereClause += ' AND verification_type = $2';
        queryParams.push(verificationType);
      }

      if (submissionId) {
        const paramIndex = queryParams.length + 1;
        whereClause += ` AND "submissionId" = $${paramIndex}`;
        queryParams.push(submissionId);
      }

      const result = await query(
        `SELECT
          id, filename, "originalName", "mimeType", "fileSize", "filePath",
          "thumbnailPath", "uploadedBy", "geoLocation", "photoType",
          "submissionId", verification_type, "createdAt"
        FROM verification_attachments
        ${whereClause}
        ORDER BY "createdAt" ASC`,
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
        geoLocation: row.geoLocation
      }));

      console.log('📊 Found', attachments.length, 'images in verification_attachments table');

      // If no images found in verification_attachments table, try to get from case verificationData
      if (attachments.length === 0) {
        console.log('🔄 No images in verification_attachments, checking case verificationData...');

        const caseDataResult = await query(
          `SELECT "verificationData" FROM cases WHERE "caseId" = $1`,
          [caseId]
        );

        if (caseDataResult.rows.length > 0) {
          const verificationData = caseDataResult.rows[0].verificationData;
          const verificationImages = verificationData?.verificationImages || [];

          console.log('📋 Case verificationData found:', {
            submissionId: verificationData?.submissionId,
            imageCount: verificationImages.length,
            requestedSubmissionId: submissionId
          });

          // Filter by submissionId if provided
          const filteredImages = submissionId
            ? verificationImages.filter((img: any) => verificationData?.submissionId === submissionId)
            : verificationImages;

          console.log('🎯 Filtered images count:', filteredImages.length);

          attachments = filteredImages.map((img: any, index: number) => ({
            id: `case_${caseId}_img_${index}`,
            filename: img.filename || `image_${index}.jpg`,
            originalName: img.originalName || img.filename || `image_${index}.jpg`,
            mimeType: img.mimeType || 'image/jpeg',
            size: img.size || 0,
            url: img.url || img.filePath || '',
            thumbnailUrl: img.thumbnailUrl || img.thumbnailPath || img.url || img.filePath || '',
            uploadedAt: img.uploadedAt || verificationData?.submittedAt || new Date().toISOString(),
            photoType: img.photoType || 'verification',
            verificationType: verificationData?.formType || 'RESIDENCE',
            submissionId: verificationData?.submissionId || submissionId,
            geoLocation: img.geoLocation || verificationData?.geoLocation
          }));
        }
      }

      res.json({
        success: true,
        data: attachments
      });

    } catch (error) {
      console.error('Get verification images error:', error);
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
  static async serveVerificationImage(req: Request, res: Response) {
    try {
      const { imageId } = req.params;

      // Get image details from database
      const imageResult = await query(
        `SELECT filename, "originalName", "mimeType", "fileSize", "filePath", case_id, verification_type
         FROM verification_attachments WHERE id = $1`,
        [imageId]
      );

      if (imageResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Verification image not found',
          error: { code: 'IMAGE_NOT_FOUND' }
        });
      }

      const image = imageResult.rows[0];

      // Construct file path
      const filePath = path.join(
        process.cwd(),
        'uploads',
        'verification',
        image.verification_type.toLowerCase(),
        image.case_id,
        image.filename
      );

      // Check if file exists
      if (!fsSync.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'Image file not found on server',
          error: { code: 'FILE_NOT_FOUND' }
        });
      }

      // Set appropriate headers
      res.setHeader('Content-Type', image.mimeType);
      res.setHeader('Content-Length', image.fileSize);
      res.setHeader('Content-Disposition', `inline; filename="${image.originalName}"`);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

      // Stream the file
      const fileStream = fsSync.createReadStream(filePath);
      fileStream.pipe(res);

    } catch (error) {
      console.error('Error serving verification image:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' }
      });
    }
  }

  /**
   * Serve verification image thumbnail
   */
  static async serveVerificationThumbnail(req: Request, res: Response) {
    try {
      const { imageId } = req.params;

      // Get image details from database
      const imageResult = await query(
        `SELECT filename, "originalName", "mimeType", "fileSize", "thumbnailPath", case_id, verification_type
         FROM verification_attachments WHERE id = $1`,
        [imageId]
      );

      if (imageResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Verification image not found',
          error: { code: 'IMAGE_NOT_FOUND' }
        });
      }

      const image = imageResult.rows[0];

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
      console.error('Error serving verification thumbnail:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR' }
      });
    }
  }
}
