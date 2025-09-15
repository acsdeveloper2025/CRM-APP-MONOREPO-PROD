import { Router } from 'express';
import { MobileAuthController } from '../controllers/mobileAuthController';
import { MobileCaseController } from '../controllers/mobileCaseController';
import { MobileAttachmentController, mobileUpload } from '../controllers/mobileAttachmentController';
import { VerificationAttachmentController } from '../controllers/verificationAttachmentController';
import { MobileFormController } from '../controllers/mobileFormController';
import { MobileLocationController } from '../controllers/mobileLocationController';
import { MobileSyncController } from '../controllers/mobileSyncController';
import { authenticateToken } from '../middleware/auth';
import { validateMobileVersion, mobileRateLimit } from '../middleware/mobileValidation';
import { createAuditLog, createMobileAuditLogs } from '../controllers/auditLogsController';
import { body } from 'express-validator';
import { validate } from '../middleware/validation';

const router = Router();

// Apply mobile-specific rate limiting - GENEROUS limits for field agents
router.use(mobileRateLimit(10000, 15 * 60 * 1000)); // 10,000 requests per 15 minutes for high-volume field operations

// Mobile Authentication Routes
router.post('/auth/login', MobileAuthController.mobileLogin);
router.post('/auth/refresh', MobileAuthController.refreshToken);
router.post('/auth/logout', authenticateToken, MobileAuthController.mobileLogout);
router.post('/auth/version-check', MobileAuthController.checkVersion);
router.get('/auth/config', MobileAuthController.getAppConfig);
router.post('/auth/notifications/register', authenticateToken, MobileAuthController.registerNotifications);



// Mobile Case Management Routes
router.get('/cases', authenticateToken, validateMobileVersion, MobileCaseController.getMobileCases);
router.get('/cases/:caseId', authenticateToken, validateMobileVersion, MobileCaseController.getMobileCase);
router.put('/cases/:caseId/status', authenticateToken, validateMobileVersion, MobileCaseController.updateCaseStatus);
router.put('/cases/:caseId/priority', authenticateToken, validateMobileVersion, MobileCaseController.updateCasePriority);
router.post('/cases/:caseId/revoke', authenticateToken, validateMobileVersion, MobileCaseController.revokeCase);

// Mobile Auto-save Routes
router.post('/cases/:caseId/auto-save', authenticateToken, validateMobileVersion, MobileCaseController.autoSaveForm);
router.get('/cases/:caseId/auto-save/:formType', authenticateToken, validateMobileVersion, MobileCaseController.getAutoSavedForm);

// Mobile Attachment Routes
// Note: More specific routes must come before parameterized routes
router.post('/cases/batch/attachments', authenticateToken, validateMobileVersion, MobileAttachmentController.getBatchAttachments);
router.post('/cases/:caseId/attachments',
  authenticateToken,
  validateMobileVersion,
  mobileUpload.array('files', 15),
  MobileAttachmentController.uploadFiles
);
router.get('/cases/:caseId/attachments', authenticateToken, validateMobileVersion, MobileAttachmentController.getCaseAttachments);
router.get('/attachments/:attachmentId/content', authenticateToken, validateMobileVersion, MobileAttachmentController.getAttachmentContent);
router.delete('/attachments/:attachmentId', authenticateToken, validateMobileVersion, MobileAttachmentController.deleteAttachment);

// Verification Attachment Routes (separate from regular case attachments)
router.get('/cases/:caseId/verification-images', authenticateToken, validateMobileVersion, VerificationAttachmentController.getVerificationImages);

// Mobile Form Submission Routes
router.post('/cases/:caseId/verification/residence', authenticateToken, validateMobileVersion, MobileFormController.submitResidenceVerification);
router.post('/cases/:caseId/verification/office', authenticateToken, validateMobileVersion, MobileFormController.submitOfficeVerification);
router.post('/cases/:caseId/verification/business', authenticateToken, validateMobileVersion, MobileFormController.submitBusinessVerification);
router.post('/cases/:caseId/verification/builder', authenticateToken, validateMobileVersion, MobileFormController.submitBuilderVerification);
router.post('/cases/:caseId/verification/residence-cum-office', authenticateToken, validateMobileVersion, MobileFormController.submitResidenceCumOfficeVerification);
router.post('/cases/:caseId/verification/dsa-connector', authenticateToken, validateMobileVersion, MobileFormController.submitDsaConnectorVerification);
router.post('/cases/:caseId/verification/property-individual', authenticateToken, validateMobileVersion, MobileFormController.submitPropertyIndividualVerification);
router.post('/cases/:caseId/verification/property-apf', authenticateToken, validateMobileVersion, MobileFormController.submitPropertyApfVerification);
router.post('/cases/:caseId/verification/noc', authenticateToken, validateMobileVersion, MobileFormController.submitNocVerification);
router.get('/cases/:caseId/forms', authenticateToken, validateMobileVersion, MobileFormController.getCaseFormSubmissions);
router.get('/forms/:formType/template', authenticateToken, validateMobileVersion, MobileFormController.getFormTemplate);

// Mobile Location Services Routes
router.post('/location/capture', authenticateToken, validateMobileVersion, MobileLocationController.captureLocation);
router.post('/location/validate', authenticateToken, validateMobileVersion, MobileLocationController.validateLocation);
router.get('/location/reverse-geocode', authenticateToken, validateMobileVersion, MobileLocationController.reverseGeocode);
router.get('/cases/:caseId/location-history', authenticateToken, validateMobileVersion, MobileLocationController.getCaseLocationHistory);
router.get('/location/trail', authenticateToken, validateMobileVersion, MobileLocationController.getUserLocationTrail);

// Mobile Sync Routes
// Enterprise sync for 500+ field agents (optimized)
router.post('/sync/enterprise', authenticateToken, validateMobileVersion, MobileSyncController.enterpriseSync);
router.post('/sync/upload', authenticateToken, validateMobileVersion, MobileSyncController.uploadSync);
router.get('/sync/download', authenticateToken, validateMobileVersion, MobileSyncController.downloadSync);
router.get('/sync/status', authenticateToken, validateMobileVersion, MobileSyncController.getSyncStatus);

// Mobile Audit Routes
const createAuditLogValidation = [
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
  body('details')
    .optional(),
  body('severity')
    .optional()
    .isIn(['INFO', 'WARN', 'ERROR', 'CRITICAL'])
    .withMessage('Invalid severity'),
  body('category')
    .optional()
    .isIn(['AUTHENTICATION', 'USER_MANAGEMENT', 'CASE_MANAGEMENT', 'CLIENT_MANAGEMENT', 'FILE_MANAGEMENT', 'FINANCIAL', 'SYSTEM', 'SECURITY', 'DATA_MANAGEMENT', 'REPORTING'])
    .withMessage('Invalid category'),
];

router.post('/audit/logs', authenticateToken, validateMobileVersion, createMobileAuditLogs);

// Mobile Version Management Routes
router.post('/version/check', authenticateToken, MobileAuthController.checkVersion);
router.get('/version/config', authenticateToken, MobileAuthController.getAppConfig);

export default router;
