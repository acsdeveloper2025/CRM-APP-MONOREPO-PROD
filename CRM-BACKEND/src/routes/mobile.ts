import { Router } from 'express';
import { MobileAuthController } from '../controllers/mobileAuthController';
import { MobileCaseController } from '../controllers/mobileCaseController';
import { MobileAttachmentController } from '../controllers/mobileAttachmentController';
import {
  VerificationAttachmentController,
  verificationUpload,
} from '../controllers/verificationAttachmentController';
import { MobileFormController } from '../controllers/mobileFormController';
import { MobileLocationController } from '../controllers/mobileLocationController';
import { MobileSyncController } from '../controllers/mobileSyncController';
import { MobileTelemetryController } from '../controllers/mobileTelemetryController';
import { NotificationController } from '../controllers/notificationController';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validateMobileVersion, mobileRateLimit } from '../middleware/mobileValidation';
import { geoRateLimit, uploadRateLimit } from '../middleware/rateLimiter';
import { createMobileAuditLogs } from '../controllers/auditLogsController';
import { idempotencyMiddleware } from '../middleware/idempotency';
import { body } from 'express-validator';
import { config } from '@/config';
import {
  EnterpriseCache,
  EnterpriseCacheConfigs,
  CacheInvalidationPatterns,
} from '../middleware/enterpriseCache';

const router = Router();
const MAX_ATTACHMENT_UPLOAD_COUNT = config.mobile.maxAttachmentUploadCount;
const invalidateFieldMonitoring = EnterpriseCache.invalidate(
  CacheInvalidationPatterns.fieldMonitoringUpdate,
  { synchronous: true }
);

// Apply mobile-specific rate limiting - GENEROUS limits for field agents
router.use(mobileRateLimit(10000, 15 * 60 * 1000)); // 10,000 requests per 15 minutes for high-volume field operations

// Mobile Health Check Route
router.get('/health', (req, res) => {
  const payload = {
    status: 'OK',
    service: 'mobile-api',
    timestamp: new Date().toISOString(),
    version: '4.0.1',
    environment: process.env.NODE_ENV || 'development',
  };

  res.json({
    success: true,
    status: payload.status,
    service: payload.service,
    timestamp: payload.timestamp,
    version: payload.version,
    environment: payload.environment,
    message: 'Mobile API health check successful',
    data: payload,
  });
});

// Mobile Authentication Routes
router.post('/auth/login', MobileAuthController.mobileLogin);
router.post('/auth/refresh', MobileAuthController.refreshToken);
router.post(
  '/auth/logout',
  authenticateToken,
  authorize('visit.start'),
  MobileAuthController.mobileLogout
);
router.post('/auth/version-check', MobileAuthController.checkVersion);
router.get('/auth/config', MobileAuthController.getAppConfig);
router.post(
  '/auth/notifications/register',
  authenticateToken,
  authorize('visit.start'),
  MobileAuthController.registerNotifications
);

// Mobile Notifications
router.get(
  '/notifications',
  authenticateToken,
  NotificationController.getNotifications.bind(NotificationController)
);

// Mobile Case Management Routes (CACHED)
router.get(
  '/cases',
  authenticateToken,
  authorize('visit.start'),
  validateMobileVersion,
  EnterpriseCache.create(EnterpriseCacheConfigs.mobileSync),
  MobileCaseController.getMobileCases
);

// Alias for /cases to support mobile app calling /tasks
router.get(
  '/tasks',
  authenticateToken,
  authorize('visit.start'),
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
  authorize('case.view', { ownership: 'task' }),
  validateMobileVersion,
  EnterpriseCache.create(EnterpriseCacheConfigs.caseDetails),
  MobileCaseController.getMobileCase // Updated to accept taskId
);

router.get(
  '/verification-tasks/:taskId/status',
  authenticateToken,
  authorize('visit.start', { ownership: 'task' }),
  validateMobileVersion,
  MobileCaseController.getTaskStatus
);
router.post(
  '/verification-tasks/:taskId/start',
  authenticateToken,
  authorize('visit.start', { ownership: 'task' }),
  validateMobileVersion,
  idempotencyMiddleware({ required: false, scope: 'mobile.task.start' }),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.assignmentUpdate, { synchronous: true }),
  MobileCaseController.startTask
);
router.post(
  '/verification-tasks/:taskId/complete',
  authenticateToken,
  authorize('visit.submit', { ownership: 'task' }),
  validateMobileVersion,
  idempotencyMiddleware({ required: false, scope: 'mobile.task.complete' }),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.assignmentUpdate, { synchronous: true }),
  MobileCaseController.completeTask
);
router.post(
  '/verification-tasks/:taskId/revoke',
  authenticateToken,
  authorize('visit.revoke', { ownership: 'task' }),
  validateMobileVersion,
  idempotencyMiddleware({ required: false, scope: 'mobile.task.revoke' }),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.assignmentUpdate, { synchronous: true }),
  MobileCaseController.revokeTask
);
router.post(
  '/verification-tasks/:taskId/operations',
  authenticateToken,
  authorize('visit.start', { ownership: 'task' }),
  validateMobileVersion,
  idempotencyMiddleware({ required: true, scope: 'mobile.task.operations' }),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.assignmentUpdate, { synchronous: true }),
  MobileCaseController.executeTaskOperation
);

// Mobile Auto-save Routes (CACHED)
router.post(
  '/verification-tasks/:taskId/auto-save',
  authenticateToken,
  authorize('visit.submit', { ownership: 'task' }),
  validateMobileVersion,
  MobileCaseController.autoSaveForm
);
router.get(
  '/verification-tasks/:taskId/auto-save/:formType',
  authenticateToken,
  authorize('visit.submit', { ownership: 'task' }),
  validateMobileVersion,
  EnterpriseCache.create(EnterpriseCacheConfigs.caseDetails),
  MobileCaseController.getAutoSavedForm
);

// Mobile Attachment Routes
// Note: More specific routes must come before parameterized routes
router.post(
  '/cases/batch/attachments',
  authenticateToken,
  authorize('visit.upload'),
  validateMobileVersion,
  MobileAttachmentController.getBatchAttachments
);

router.post(
  '/verification-tasks/:taskId/attachments',
  authenticateToken,
  authorize('visit.upload', { ownership: 'task' }),
  validateMobileVersion,
  idempotencyMiddleware({ required: true, scope: 'mobile.attachments.upload' }),
  uploadRateLimit,
  verificationUpload.array('files', MAX_ATTACHMENT_UPLOAD_COUNT),
  VerificationAttachmentController.uploadVerificationImages
);
router.get(
  '/verification-tasks/:taskId/attachments',
  authenticateToken,
  authorize('visit.upload', { ownership: 'task' }),
  validateMobileVersion,
  MobileAttachmentController.getCaseAttachments
);
router.get(
  '/verification-tasks/:taskId/attachments/:attachmentId',
  authenticateToken,
  authorize('visit.upload', { ownership: 'task' }),
  validateMobileVersion,
  MobileAttachmentController.getAttachmentContent
);
router.get(
  '/attachments/:attachmentId/content',
  authenticateToken,
  authorize('visit.upload'),
  validateMobileVersion,
  MobileAttachmentController.getAttachmentContent
);
router.delete(
  '/attachments/:attachmentId',
  authenticateToken,
  authorize('visit.upload'),
  validateMobileVersion,
  MobileAttachmentController.deleteAttachment
);

// Verification Attachment Routes (separate from regular case attachments)
router.get(
  '/verification-tasks/:taskId/verification-images',
  authenticateToken,
  authorize('visit.upload', { ownership: 'task' }),
  validateMobileVersion,
  VerificationAttachmentController.getVerificationImages
);

// Mobile Form Submission Routes - STRICT TASK ID ONLY
router.post(
  '/verification-tasks/:taskId/forms',
  authenticateToken,
  authorize('visit.submit', { ownership: 'task' }),
  validateMobileVersion,
  idempotencyMiddleware({ required: true, scope: 'mobile.forms.submit' }),
  invalidateFieldMonitoring,
  MobileFormController.submitVerificationForm
);

router.post(
  '/verification-tasks/:taskId/verification/residence',
  authenticateToken,
  authorize('visit.submit', { ownership: 'task' }),
  validateMobileVersion,
  idempotencyMiddleware({ required: false, scope: 'mobile.forms.residence' }),
  invalidateFieldMonitoring,
  MobileFormController.submitResidenceVerification
);
router.post(
  '/verification-tasks/:taskId/verification/office',
  authenticateToken,
  authorize('visit.submit', { ownership: 'task' }),
  validateMobileVersion,
  idempotencyMiddleware({ required: false, scope: 'mobile.forms.office' }),
  invalidateFieldMonitoring,
  MobileFormController.submitOfficeVerification
);
router.post(
  '/verification-tasks/:taskId/verification/business',
  authenticateToken,
  authorize('visit.submit', { ownership: 'task' }),
  validateMobileVersion,
  idempotencyMiddleware({ required: false, scope: 'mobile.forms.business' }),
  invalidateFieldMonitoring,
  MobileFormController.submitBusinessVerification
);
router.post(
  '/verification-tasks/:taskId/verification/builder',
  authenticateToken,
  authorize('visit.submit', { ownership: 'task' }),
  validateMobileVersion,
  idempotencyMiddleware({ required: false, scope: 'mobile.forms.builder' }),
  invalidateFieldMonitoring,
  MobileFormController.submitBuilderVerification
);
router.post(
  '/verification-tasks/:taskId/verification/residence-cum-office',
  authenticateToken,
  authorize('visit.submit', { ownership: 'task' }),
  validateMobileVersion,
  idempotencyMiddleware({ required: false, scope: 'mobile.forms.residence-cum-office' }),
  invalidateFieldMonitoring,
  MobileFormController.submitResidenceCumOfficeVerification
);
router.post(
  '/verification-tasks/:taskId/verification/dsa-connector',
  authenticateToken,
  authorize('visit.submit', { ownership: 'task' }),
  validateMobileVersion,
  idempotencyMiddleware({ required: false, scope: 'mobile.forms.dsa-connector' }),
  invalidateFieldMonitoring,
  MobileFormController.submitDsaConnectorVerification
);
router.post(
  '/verification-tasks/:taskId/verification/property-individual',
  authenticateToken,
  authorize('visit.submit', { ownership: 'task' }),
  validateMobileVersion,
  idempotencyMiddleware({ required: false, scope: 'mobile.forms.property-individual' }),
  invalidateFieldMonitoring,
  MobileFormController.submitPropertyIndividualVerification
);
router.post(
  '/verification-tasks/:taskId/verification/property-apf',
  authenticateToken,
  authorize('visit.submit', { ownership: 'task' }),
  validateMobileVersion,
  idempotencyMiddleware({ required: false, scope: 'mobile.forms.property-apf' }),
  invalidateFieldMonitoring,
  MobileFormController.submitPropertyApfVerification
);
router.post(
  '/verification-tasks/:taskId/verification/noc',
  authenticateToken,
  authorize('visit.submit', { ownership: 'task' }),
  validateMobileVersion,
  idempotencyMiddleware({ required: false, scope: 'mobile.forms.noc' }),
  invalidateFieldMonitoring,
  MobileFormController.submitNocVerification
);

router.get(
  '/verification-tasks/:taskId/forms',
  authenticateToken,
  authorize('visit.submit', { ownership: 'task' }),
  validateMobileVersion,
  MobileFormController.getCaseFormSubmissions
);

// Additional verification-tasks routes for status, etc.
router.put(
  '/verification-tasks/:taskId/priority',
  authenticateToken,
  authorize('visit.start', { ownership: 'task' }),
  validateMobileVersion,
  MobileCaseController.updateCasePriority
);

router.get(
  '/forms/:formType/template',
  authenticateToken,
  authorize('visit.submit'),
  validateMobileVersion,
  MobileFormController.getFormTemplate
);

// Mobile Location Services Routes
router.post(
  '/location/capture',
  authenticateToken,
  authorize('visit.start'),
  validateMobileVersion,
  idempotencyMiddleware({ required: true, scope: 'mobile.location.capture' }),
  geoRateLimit,
  invalidateFieldMonitoring,
  MobileLocationController.captureLocation
);
router.post(
  '/location/validate',
  authenticateToken,
  authorize('visit.start'),
  validateMobileVersion,
  MobileLocationController.validateLocation
);
router.get(
  '/location/reverse-geocode',
  authenticateToken,
  authorize('visit.start'),
  validateMobileVersion,
  MobileLocationController.reverseGeocode
);
router.get(
  '/verification-tasks/:taskId/location-history',
  authenticateToken,
  authorize('visit.start', { ownership: 'task' }),
  validateMobileVersion,
  MobileLocationController.getCaseLocationHistory
);
router.get(
  '/location/trail',
  authenticateToken,
  authorize('visit.start'),
  validateMobileVersion,
  MobileLocationController.getUserLocationTrail
);

// Mobile Sync Routes
// Enterprise sync for 500+ field agents (optimized)
router.post(
  '/sync/enterprise',
  authenticateToken,
  authorize('visit.start'),
  validateMobileVersion,
  invalidateFieldMonitoring,
  MobileSyncController.enterpriseSync
);
router.post(
  '/sync/upload',
  authenticateToken,
  authorize('visit.start'),
  validateMobileVersion,
  invalidateFieldMonitoring,
  MobileSyncController.uploadSync
);
router.get(
  '/sync/download',
  authenticateToken,
  authorize('visit.start'),
  validateMobileVersion,
  MobileSyncController.downloadSync
);
router.get(
  '/sync/changes',
  authenticateToken,
  authorize('visit.start'),
  validateMobileVersion,
  MobileSyncController.downloadChanges
);
router.get(
  '/sync/status',
  authenticateToken,
  authorize('visit.start'),
  validateMobileVersion,
  MobileSyncController.getSyncStatus
);
router.get(
  '/sync/health',
  authenticateToken,
  authorize('visit.start'),
  validateMobileVersion,
  MobileSyncController.getSyncHealth
);

// Mobile telemetry ingest endpoint (optional, non-blocking client pipeline)
router.post(
  '/telemetry/mobile/ingest',
  authenticateToken,
  authorize('visit.start'),
  validateMobileVersion,
  MobileTelemetryController.ingest
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

router.post(
  '/audit/logs',
  authenticateToken,
  authorize('visit.start'),
  validateMobileVersion,
  createMobileAuditLogs
);

// Mobile Version Management Routes
export default router;
