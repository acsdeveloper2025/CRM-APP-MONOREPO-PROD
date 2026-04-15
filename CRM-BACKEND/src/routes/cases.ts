import express, { type Request, type Response, type NextFunction } from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import { listRateLimit, roleBasedRateLimit } from '@/middleware/rateLimiter';
import {
  EnterpriseCache,
  EnterpriseCacheConfigs,
  CacheInvalidationPatterns,
} from '../middleware/enterpriseCache';
import { validateCaseAccess, validateCaseCreationAccess } from '@/middleware/clientAccess';
import { validateCaseProductAccess } from '@/middleware/productAccess';
import {
  getCases,
  getCaseById,
  createCase,
  createCaseValidation,
  normalizeCaseCreationBody,
  uploadForCaseCreation,
  updateCase,
  getFieldAgentWorkload,
  exportCases,
  getCaseSummaryWithTasks,
  validateCaseConfiguration,
} from '@/controllers/casesController';
import { searchGlobalDuplicates } from '@/controllers/deduplicationController';
import { VerificationAttachmentController } from '@/controllers/verificationAttachmentController';

const router = express.Router();

// Apply authentication and rate limiting
router.use(authenticateToken);
router.use(listRateLimit);

// Validation schemas.
//
// `_createCaseValidation` used to live here as a flat top-level
// body(...) chain from before the Oct 2025 `/create` endpoint
// consolidation. That chain assumed `req.body = { customerName,
// clientId, applicantType, ... }`, but the unified endpoint takes
// `req.body = { caseDetails, verificationTasks, applicants?, ... }`
// (or `req.body.data` as a JSON string for multipart uploads), so
// the old chain would reject every legitimate request if re-applied.
// An earlier ESLint cleanup underscore-prefixed it to silence the
// no-unused-vars warning with no comment explaining why.
//
// The replacement chain now lives next to the handler in
// src/controllers/casesController.ts as `createCaseValidation`,
// targeting the real nested shape. It's wired into the /create
// route below after `normalizeCaseCreationBody` hoists FormData
// payloads into the same body structure as JSON payloads.

const updateCaseValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Description must be between 1 and 1000 characters'),
  body('address')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Address must be between 1 and 500 characters'),
  body('contactPerson')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Contact person must be between 1 and 100 characters'),
  body('contactPhone')
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Contact phone must be valid'),
  body('deadline').optional().isISO8601().withMessage('Deadline must be a valid date'),
];

const listCasesValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
  query('status')
    .optional()
    .isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED', 'REWORK_REQUIRED'])
    .withMessage('Invalid status'),
  query('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Priority must be one of: LOW, MEDIUM, HIGH, URGENT'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('dateFrom').optional().isISO8601().withMessage('Date from must be a valid date'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be a valid date'),
];

const _statusUpdateValidation = [
  body('status')
    .isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED', 'REWORK_REQUIRED'])
    .withMessage('Invalid status'),
];

const _priorityUpdateValidation = [
  body('priority')
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Priority must be one of: LOW, MEDIUM, HIGH, URGENT'),
];

const _assignValidation = [
  body('assignedToId').trim().notEmpty().withMessage('Assigned user ID is required'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters'),
];

const _bulkAssignValidation = [
  body('caseIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('Case IDs must be an array with 1-100 items'),
  body('caseIds.*').isUUID().withMessage('Each case ID must be a valid UUID'),
  body('assignedToId').trim().notEmpty().withMessage('Assigned user ID is required'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters'),
  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Priority must be one of: LOW, MEDIUM, HIGH, URGENT'),
];

const _reassignValidation = [
  body('fromUserId').trim().notEmpty().withMessage('From user ID is required'),
  body('toUserId').trim().notEmpty().withMessage('To user ID is required'),
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Reason is required for reassignment')
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters'),
];

const _noteValidation = [
  body('note')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Note must be between 1 and 1000 characters'),
];

const _completeValidation = [
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
  body('attachments').optional().isArray().withMessage('Attachments must be an array'),
];

const _approveValidation = [
  body('feedback')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Feedback must be less than 1000 characters'),
];

const _rejectValidation = [
  body('reason')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Rejection reason is required and must be less than 1000 characters'),
];

const _reworkValidation = [
  body('feedback')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Rework feedback is required and must be less than 1000 characters'),
];

// Core CRUD routes
router.get(
  '/',
  authorize('case.view'),
  roleBasedRateLimit,
  EnterpriseCache.create(EnterpriseCacheConfigs.caseList),
  listCasesValidation,
  validate,
  getCases
);

// ============================================================================
// UNIFIED CASE CREATION ENDPOINT
// Replaces: POST /, POST /with-attachments, POST /with-multiple-tasks
// ============================================================================
router.post(
  '/config-validation',
  authorize('case.create'),
  roleBasedRateLimit,
  [
    body('clientId').isInt({ min: 1 }).withMessage('Client ID must be a positive integer'),
    body('productId').isInt({ min: 1 }).withMessage('Product ID must be a positive integer'),
    body('verificationTypeId')
      .isInt({ min: 1 })
      .withMessage('Verification type ID must be a positive integer'),
    body('areaId').isInt({ min: 1 }).withMessage('Area ID must be a positive integer'),
    body('pincodeId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Pincode ID must be a positive integer'),
    body('pincode').optional().trim().notEmpty().withMessage('Pincode must not be empty'),
    body('rateTypeId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Rate type ID must be a positive integer'),
  ],
  validate,
  validateCaseConfiguration
);

// Full middleware chain for POST /api/cases/create.
//
// Order matters — the critical ordering invariants are:
//
//   1. `uploadForCaseCreation.array(...)` MUST run before
//      `normalizeCaseCreationBody` so multer can parse the
//      multipart body and populate `req.body.data` (for FormData
//      uploads) and `req.files`.
//
//   2. `normalizeCaseCreationBody` MUST run before
//      `createCaseValidation` + `validateCaseCreationAccess`. It
//      takes multipart requests that arrive with `req.body.data`
//      as a JSON string and hoists the parsed object over
//      `req.body`, so every downstream validator sees the same
//      nested shape regardless of content-type. Before this
//      middleware existed, FormData creates silently bypassed
//      both the express-validator chain AND the scope-access
//      check (because `req.body.clientId` was undefined — the
//      real id was inside the JSON string).
//
//   3. `createCaseValidation` + `validate` run before
//      `validateCaseCreationAccess` so structural errors are
//      rejected before the scope check (which now sees the
//      normalized `req.body.caseDetails.clientId` /
//      `caseDetails.productId`... oh wait — the scope factory
//      reads `body.clientId` directly, not `body.caseDetails
//      .clientId`). The scope factory uses `req.body[key]` where
//      `key = 'clientId'`. The normalized body puts clientId
//      inside `caseDetails`, so the existing factory can't see
//      it. For this route specifically we keep the existing
//      scope check working by injecting a shim that copies the
//      nested ids up to the top level before the scope middleware
//      runs.
router.post(
  '/create',
  authorize('case.create'),
  roleBasedRateLimit,
  EnterpriseCache.invalidate(CacheInvalidationPatterns.caseUpdate),
  uploadForCaseCreation.array('attachments', 15),
  normalizeCaseCreationBody,
  createCaseValidation,
  validate,
  // Hoist nested ids so the existing body-based scope factory can
  // read them. Purely local to this route; doesn't affect the
  // normalized shape the handler sees because the handler reads
  // from `caseDetails.*`.
  (req: Request, _res: Response, next: NextFunction) => {
    const bodyAny = req.body as Record<string, unknown> | undefined;
    const caseDetails = bodyAny?.caseDetails as Record<string, unknown> | undefined;
    if (caseDetails) {
      if (bodyAny && caseDetails.clientId != null && bodyAny.clientId == null) {
        bodyAny.clientId = caseDetails.clientId;
      }
      if (bodyAny && caseDetails.productId != null && bodyAny.productId == null) {
        bodyAny.productId = caseDetails.productId;
      }
    }
    next();
  },
  validateCaseCreationAccess,
  createCase
);

// ============================================================================
// GLOBAL DEDUPE SEARCH ENDPOINT
// Search across all cases without client/product restrictions
// ============================================================================
router.post(
  '/dedupe/global-search',
  authorize('case.view'),
  roleBasedRateLimit,
  [
    body('mobile').optional().trim(),
    body('pan').optional().trim(),
    body('name').optional().trim(),
    body('address').optional().trim(),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage('Limit must be between 1 and 500'),
  ],
  validate,
  searchGlobalDuplicates
);

// Get case summary with tasks
router.get(
  '/:id/summary',
  authorize('case.view'),
  roleBasedRateLimit,
  [param('id').trim().notEmpty().withMessage('Case ID is required')],
  validate,
  validateCaseAccess,
  EnterpriseCache.create(EnterpriseCacheConfigs.caseDetails),
  getCaseSummaryWithTasks
);

// Export cases to Excel - MUST be before /:id route
router.get(
  '/export',
  authorize('case.view'),
  roleBasedRateLimit,
  [
    query('exportType')
      .optional()
      .isIn(['all', 'pending', 'in-progress', 'completed'])
      .withMessage('Invalid export type'),
    query('status').optional().isString(),
    query('search').optional().isString(),
    query('assignedTo').optional().isUUID().withMessage('Invalid assigned to ID'),
    query('clientId').optional().isUUID().withMessage('Invalid client ID'),
    query('priority').optional().isString(),
    query('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
    query('dateTo').optional().isISO8601().withMessage('Invalid date format'),
  ],
  validate,
  exportCases
);

router.get(
  '/:id',
  authorize('case.view'),
  roleBasedRateLimit,
  [param('id').trim().notEmpty().withMessage('Case ID is required')],
  validate,
  validateCaseAccess,
  EnterpriseCache.create(EnterpriseCacheConfigs.caseDetails),
  getCaseById
);

router.put(
  '/:id',
  authorize('case.update'),
  [param('id').trim().notEmpty().withMessage('Case ID is required')],
  updateCaseValidation,
  validate,
  validateCaseAccess,
  EnterpriseCache.invalidate(CacheInvalidationPatterns.assignmentUpdate),
  updateCase
);

// NOTE: Case-level assignment routes have been moved to verification task level.
// Use /api/verification-tasks/:taskId/assign instead.

// Analytics routes
router.get(
  '/analytics/field-agent-workload',
  authorize('dashboard.view'),
  validate,
  getFieldAgentWorkload
);

// Verification Images route
router.get(
  '/:id/verification-images',
  authorize('case.view'),
  [param('id').trim().notEmpty().withMessage('Case ID is required')],
  validate,
  validateCaseAccess,
  validateCaseProductAccess,
  VerificationAttachmentController.getVerificationImages
);

// Serve verification image file
router.get(
  '/verification-images/:imageId/serve',
  authorize('case.view'),
  [param('imageId').trim().notEmpty().withMessage('Image ID is required')],
  validate,
  VerificationAttachmentController.serveVerificationImage
);

// Serve verification image thumbnail
router.get(
  '/verification-images/:imageId/thumbnail',
  authorize('case.view'),
  [param('imageId').trim().notEmpty().withMessage('Image ID is required')],
  validate,
  VerificationAttachmentController.serveVerificationThumbnail
);

export default router;
