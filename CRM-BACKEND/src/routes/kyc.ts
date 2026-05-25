import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authenticateToken } from '@/middleware/auth';
import { authorize, authorizeAny } from '@/middleware/authorize';
import { validateClientAccess } from '@/middleware/clientAccess';
import { validateProductAccess } from '@/middleware/productAccess';
import {
  listDocumentTypes,
  listKYCTasks,
  getKYCTaskStats,
  getKYCTaskDetail,
  verifyKYCDocument,
  assignKYCTask,
  uploadKYCDocument,
  getKYCTasksForCase,
  exportKYCToExcel,
} from '@/controllers/kycVerificationController';
import {
  EnterpriseCache,
  EnterpriseCacheConfigs,
  CacheInvalidationPatterns,
} from '@/middleware/enterpriseCache';

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

// Document types (public for dropdowns).
// When clientId+productId query params are present, scoped-ops users must
// have those entities in their assignments — closes the R-1 query-param
// bypass (project_scope_control_audit_2026_05_14.md). When the params are
// absent, validators are no-ops and the original "all active doc types"
// dropdown response is preserved.
router.get(
  '/document-types',
  validateClientAccess('query'),
  validateProductAccess('query'),
  listDocumentTypes
);

// KYC task listing (dashboard)
router.get('/tasks', authorize('kyc.view'), listKYCTasks);

// 5-card stats for /kyc-verification/* pages.
// MUST come before /tasks/:taskId (Express matches in declaration order
// — /tasks/:taskId would also match /tasks/stats otherwise). Cached via
// EnterpriseCacheConfigs.analytics (baseUrl+path keyGen, collision-safe).
router.get(
  '/tasks/stats',
  authorize('kyc.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.analytics),
  getKYCTaskStats
);

// KYC tasks for a specific case
// 2026-05-05 (bug 48): widen to include case.view so case creators
// (BACKEND_USER role with case.create + case.view but no kyc.view) can
// see the KYC tasks they attached during case creation. Without this,
// the case-detail KYC tab silently shows "No KYC tasks" even though
// the rows exist server-side. Verifying KYC docs still requires
// kyc.verify (handled per-action by the verify endpoint).
router.get('/cases/:caseId/tasks', authorizeAny(['kyc.view', 'case.view']), getKYCTasksForCase);

// Single KYC task detail
router.get('/tasks/:taskId', authorize('kyc.view'), getKYCTaskDetail);

// Verify document (Pass/Fail/Refer)
router.put(
  '/tasks/:taskId/verify',
  authorize('kyc.verify'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.caseUpdate, { synchronous: true }),
  verifyKYCDocument
);

// Assign KYC task to verifier
// 2026-05-05 (bug 49): widen to include case.create / case.assign /
// case.reassign so the case creator (BACKEND_USER) can pick / change
// the KYC verifier from the case-detail KYC tab without needing the
// dedicated kyc.assign permission. The verifier UI itself still uses
// kyc.verify for the verify action.
router.put(
  '/tasks/:taskId/assign',
  authorizeAny(['kyc.assign', 'case.create', 'case.assign', 'case.reassign']),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.assignmentUpdate, { synchronous: true }),
  assignKYCTask
);

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
  EnterpriseCache.invalidate(CacheInvalidationPatterns.caseUpdate, { synchronous: true }),
  upload.single('document'),
  uploadKYCDocument
);

// Excel export
router.get('/export', authorize('kyc.export'), exportKYCToExcel);

export default router;
