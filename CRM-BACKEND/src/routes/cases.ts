import express from 'express';
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

// Validation schemas
const _createCaseValidation = [
  // Optional legacy fields for backward compatibility
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

  // Required fields
  body('clientId').trim().notEmpty().withMessage('Client ID is required'),
  body('assignedToId').trim().notEmpty().withMessage('Assigned user ID is required'),

  // Optional legacy fields
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
  body('verificationType')
    .optional()
    .isIn(['RESIDENCE', 'OFFICE', 'BUSINESS', 'OTHER'])
    .withMessage('Verification type must be one of: RESIDENCE, OFFICE, BUSINESS, OTHER'),
  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Priority must be one of: LOW, MEDIUM, HIGH, URGENT'),
  body('deadline').optional().isISO8601().withMessage('Deadline must be a valid date'),

  // New required fields for form integration
  body('applicantType')
    .trim()
    .isIn([
      'APPLICANT',
      'CO-APPLICANT',
      'CO-APPLICANT 1',
      'CO-APPLICANT 2',
      'CO-APPLICANT 3',
      'GUARANTOR',
      'SELLER',
      'PROPRIETOR',
      'PARTNER',
      'DIRECTOR',
      'REFERENCE PERSON',
    ])
    .withMessage(
      'Applicant type must be one of: APPLICANT, CO-APPLICANT, CO-APPLICANT 1, CO-APPLICANT 2, CO-APPLICANT 3, GUARANTOR, SELLER, PROPRIETOR, PARTNER, DIRECTOR, or REFERENCE PERSON'
    ),
  body('backendContactNumber')
    .trim()
    .matches(/^[+]?[\d\s\-()]{10,15}$/)
    .withMessage('Backend contact number must be valid'),
  body('trigger').trim().isLength({ min: 1 }).withMessage('TRIGGER field is required'),
  body('rateTypeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Rate type ID must be a positive integer'),

  // Customer information (at least one name required)
  body('applicantName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Applicant name must be between 1 and 100 characters'),
  body('customerName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Customer name must be between 1 and 100 characters'),
];

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

router.post(
  '/create',
  authorize('case.create'),
  roleBasedRateLimit,
  EnterpriseCache.invalidate(CacheInvalidationPatterns.caseUpdate),
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
