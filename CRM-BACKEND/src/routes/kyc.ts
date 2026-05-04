import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authenticateToken } from '@/middleware/auth';
import { authorize, authorizeAny } from '@/middleware/authorize';
import {
  listDocumentTypes,
  listKYCTasks,
  getKYCTaskDetail,
  verifyKYCDocument,
  assignKYCTask,
  uploadKYCDocument,
  getKYCTasksForCase,
  exportKYCToExcel,
} from '@/controllers/kycVerificationController';

const router = express.Router();

// Multer config for KYC document uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'kyc');
    fs.mkdir(uploadDir, { recursive: true })
      .then(() => cb(null, uploadDir))
      .catch(() => cb(null, uploadDir));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `kyc_${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, JPEG, PNG, DOC, DOCX'));
    }
  },
});

router.use(authenticateToken);

// Document types (public for dropdowns)
router.get('/document-types', listDocumentTypes);

// KYC task listing (dashboard)
router.get('/tasks', authorize('kyc.view'), listKYCTasks);

// KYC tasks for a specific case
router.get('/cases/:caseId/tasks', authorize('kyc.view'), getKYCTasksForCase);

// Single KYC task detail
router.get('/tasks/:taskId', authorize('kyc.view'), getKYCTaskDetail);

// Verify document (Pass/Fail/Refer)
router.put('/tasks/:taskId/verify', authorize('kyc.verify'), verifyKYCDocument);

// Assign KYC task to verifier
router.put('/tasks/:taskId/assign', authorize('kyc.assign'), assignKYCTask);

// Upload document
// Phase 1.5 (2026-05-04): allow `case.create` users to upload during the
// case-creation fan-out (immediately after case is created). Without
// this, files attached in the case-creation form 403 because pradnya-
// like users have case.create but not kyc.verify. The upload handler
// itself validates the task exists + the user is the assigned uploader
// or has equivalent rights.
router.post(
  '/tasks/:taskId/upload',
  authorizeAny(['kyc.verify', 'case.create']),
  upload.single('document'),
  uploadKYCDocument
);

// Excel export
router.get('/export', authorize('kyc.export'), exportKYCToExcel);

export default router;
