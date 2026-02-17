import { Router } from 'express';
import { MobileAuthController } from '../controllers/mobileAuthController';
import { MobileCaseController } from '../controllers/mobileCaseController';
import {
  MobileAttachmentController,
  mobileUpload,
} from '../controllers/mobileAttachmentController';
import {
  VerificationAttachmentController,
  verificationUpload,
} from '../controllers/verificationAttachmentController';
import { MobileFormController } from '../controllers/mobileFormController';
import { MobileLocationController } from '../controllers/mobileLocationController';
import { MobileSyncController } from '../controllers/mobileSyncController';
import { authenticateToken } from '../middleware/auth';
import { validateMobileVersion, mobileRateLimit } from '../middleware/mobileValidation';
import { geoRateLimit, uploadRateLimit } from '../middleware/rateLimiter';
import { createMobileAuditLogs } from '../controllers/auditLogsController';
import { body } from 'express-validator';
import { EnterpriseCache, EnterpriseCacheConfigs } from '../middleware/enterpriseCache';

const router = Router();

// Apply mobile-specific rate limiting - GENEROUS limits for field agents
router.use(mobileRateLimit(10000, 15 * 60 * 1000)); // 10,000 requests per 15 minutes for high-volume field operations

// Mobile Health Check Route
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'mobile-api',
    timestamp: new Date().toISOString(),
    version: '4.0.1',
    environment: process.env.NODE_ENV || 'development',
  });
});

// Mobile Authentication Routes
router.post('/auth/login', MobileAuthController.mobileLogin);
router.post('/auth/refresh', MobileAuthController.refreshToken);
router.post('/auth/logout', authenticateToken, MobileAuthController.mobileLogout);
router.post('/auth/version-check', MobileAuthController.checkVersion);
router.get('/auth/config', MobileAuthController.getAppConfig);
router.post(
  '/auth/notifications/register',
  authenticateToken,
  MobileAuthController.registerNotifications
);

// Mobile Case Management Routes (CACHED)
router.get(
  '/cases',
  authenticateToken,
  validateMobileVersion,
  EnterpriseCache.create(EnterpriseCacheConfigs.mobileSync),
  MobileCaseController.getMobileCases
);

// Alias for /cases to support mobile app calling /tasks
router.get(
  '/tasks',
  authenticateToken,
  validateMobileVersion,
  EnterpriseCache.create(EnterpriseCacheConfigs.mobileSync),
  MobileCaseController.getMobileCases
);

// STRICT MIGRATION: Removed legacy /cases/:caseId routes
// All individual case/task operations must use /verification-tasks/:taskId

// Mobile Verification Task Routes
router.get(
  '/verification-tasks/:taskId',
  authenticateToken,
  validateMobileVersion,
  EnterpriseCache.create(EnterpriseCacheConfigs.caseDetails),
  MobileCaseController.getMobileCase // Updated to accept taskId
);

router.get(
  '/verification-tasks/:taskId/status',
  authenticateToken,
  validateMobileVersion,
  MobileCaseController.getTaskStatus
);
router.put(
  '/verification-tasks/:taskId/status',
  authenticateToken,
  validateMobileVersion,
  MobileCaseController.updateTaskStatus
);
router.post(
  '/verification-tasks/:taskId/start',
  authenticateToken,
  validateMobileVersion,
  MobileCaseController.startTask
);
router.post(
  '/verification-tasks/:taskId/complete',
  authenticateToken,
  validateMobileVersion,
  MobileCaseController.completeTask
);
router.post(
  '/verification-tasks/:taskId/revoke',
  authenticateToken,
  validateMobileVersion,
  MobileCaseController.revokeTask
);

// Mobile Auto-save Routes (CACHED)
router.post(
  '/verification-tasks/:taskId/auto-save',
  authenticateToken,
  validateMobileVersion,
  MobileCaseController.autoSaveForm
);
router.get(
  '/verification-tasks/:taskId/auto-save/:formType',
  authenticateToken,
  validateMobileVersion,
  EnterpriseCache.create(EnterpriseCacheConfigs.caseDetails),
  MobileCaseController.getAutoSavedForm
);

// Mobile Attachment Routes
// Note: More specific routes must come before parameterized routes
router.post(
  '/cases/batch/attachments',
  authenticateToken,
  validateMobileVersion,
  MobileAttachmentController.getBatchAttachments
);

router.post(
  '/verification-tasks/:taskId/attachments',
  authenticateToken,
  validateMobileVersion,
  uploadRateLimit,
  verificationUpload.array('files', 15),
  VerificationAttachmentController.uploadVerificationImages
);
router.get(
  '/verification-tasks/:taskId/attachments',
  authenticateToken,
  validateMobileVersion,
  MobileAttachmentController.getCaseAttachments
);
router.get(
  '/verification-tasks/:taskId/attachments/:attachmentId',
  authenticateToken,
  validateMobileVersion,
  MobileAttachmentController.getAttachmentContent
);
router.get(
  '/attachments/:attachmentId/content',
  authenticateToken,
  validateMobileVersion,
  MobileAttachmentController.getAttachmentContent
);
router.delete(
  '/attachments/:attachmentId',
  authenticateToken,
  validateMobileVersion,
  MobileAttachmentController.deleteAttachment
);

// Verification Attachment Routes (separate from regular case attachments)
router.get(
  '/verification-tasks/:taskId/verification-images',
  authenticateToken,
  validateMobileVersion,
  VerificationAttachmentController.getVerificationImages
);

// Mobile Form Submission Routes - STRICT TASK ID ONLY
router.post(
  '/verification-tasks/:taskId/verification/residence',
  authenticateToken,
  validateMobileVersion,
  MobileFormController.submitResidenceVerification
);
router.post(
  '/verification-tasks/:taskId/verification/office',
  authenticateToken,
  validateMobileVersion,
  MobileFormController.submitOfficeVerification
);
router.post(
  '/verification-tasks/:taskId/verification/business',
  authenticateToken,
  validateMobileVersion,
  MobileFormController.submitBusinessVerification
);
router.post(
  '/verification-tasks/:taskId/verification/builder',
  authenticateToken,
  validateMobileVersion,
  MobileFormController.submitBuilderVerification
);
router.post(
  '/verification-tasks/:taskId/verification/residence-cum-office',
  authenticateToken,
  validateMobileVersion,
  MobileFormController.submitResidenceCumOfficeVerification
);
router.post(
  '/verification-tasks/:taskId/verification/dsa-connector',
  authenticateToken,
  validateMobileVersion,
  MobileFormController.submitDsaConnectorVerification
);
router.post(
  '/verification-tasks/:taskId/verification/property-individual',
  authenticateToken,
  validateMobileVersion,
  MobileFormController.submitPropertyIndividualVerification
);
router.post(
  '/verification-tasks/:taskId/verification/property-apf',
  authenticateToken,
  validateMobileVersion,
  MobileFormController.submitPropertyApfVerification
);
router.post(
  '/verification-tasks/:taskId/verification/noc',
  authenticateToken,
  validateMobileVersion,
  MobileFormController.submitNocVerification
);

router.get(
  '/verification-tasks/:taskId/forms',
  authenticateToken,
  validateMobileVersion,
  MobileFormController.getCaseFormSubmissions
);

// Additional verification-tasks routes for status, etc.
router.put(
  '/verification-tasks/:taskId/priority',
  authenticateToken,
  validateMobileVersion,
  MobileCaseController.updateCasePriority
);

router.get(
  '/forms/:formType/template',
  authenticateToken,
  validateMobileVersion,
  MobileFormController.getFormTemplate
);

// Mobile Location Services Routes
router.post(
  '/location/capture',
  authenticateToken,
  validateMobileVersion,
  geoRateLimit,
  MobileLocationController.captureLocation
);
router.post(
  '/location/validate',
  authenticateToken,
  validateMobileVersion,
  MobileLocationController.validateLocation
);
router.get(
  '/location/reverse-geocode',
  authenticateToken,
  validateMobileVersion,
  MobileLocationController.reverseGeocode
);
router.get(
  '/verification-tasks/:taskId/location-history',
  authenticateToken,
  validateMobileVersion,
  MobileLocationController.getCaseLocationHistory
);
router.get(
  '/location/trail',
  authenticateToken,
  validateMobileVersion,
  MobileLocationController.getUserLocationTrail
);

// Mobile Sync Routes
// Enterprise sync for 500+ field agents (optimized)
router.post(
  '/sync/enterprise',
  authenticateToken,
  validateMobileVersion,
  MobileSyncController.enterpriseSync
);
router.post(
  '/sync/upload',
  authenticateToken,
  validateMobileVersion,
  MobileSyncController.uploadSync
);
router.get(
  '/sync/download',
  authenticateToken,
  validateMobileVersion,
  MobileSyncController.downloadSync
);
router.get(
  '/sync/status',
  authenticateToken,
  validateMobileVersion,
  MobileSyncController.getSyncStatus
);

// Mobile Audit Routes
const _createAuditLogValidation = [
  body('action')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Action is required and must be less than 100 characters'),
  body('resource')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Resource is required and must be less than 100 characters'),
  body('resourceId')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Resource ID must be less than 100 characters'),
  body('details').optional(),
  body('severity')
    .optional()
    .isIn(['INFO', 'WARN', 'ERROR', 'CRITICAL'])
    .withMessage('Invalid severity'),
  body('category')
    .optional()
    .isIn([
      'AUTHENTICATION',
      'USER_MANAGEMENT',
      'CASE_MANAGEMENT',
      'CLIENT_MANAGEMENT',
      'FILE_MANAGEMENT',
      'FINANCIAL',
      'SYSTEM',
      'SECURITY',
      'DATA_MANAGEMENT',
      'REPORTING',
    ])
    .withMessage('Invalid category'),
];

router.post('/audit/logs', authenticateToken, validateMobileVersion, createMobileAuditLogs);

// Mobile Version Management Routes
router.post('/version/check', authenticateToken, MobileAuthController.checkVersion);
router.get('/version/config', authenticateToken, MobileAuthController.getAppConfig);

export default router;
