import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken, requireFieldOrHigher } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import { caseRateLimit } from '@/middleware/rateLimiter';
import { EnterpriseRateLimit, EnterpriseRateLimits } from '../middleware/enterpriseRateLimit';
import { EnterpriseCache, EnterpriseCacheConfigs, CacheInvalidationPatterns } from '../middleware/enterpriseCache';
import { validateCaseAccess, validateClientAccess, validateCaseCreationAccess } from '@/middleware/clientAccess';
import {
  getCases,
  getCaseById,
  createCase,
  createCaseWithAttachments,
  updateCase,
  assignCase,
  bulkAssignCases,
  getBulkAssignmentStatus,
  reassignCase,
  getCaseAssignmentHistory,
  getFieldAgentWorkload,
  exportCases
} from '@/controllers/casesController';
import { VerificationAttachmentController } from '@/controllers/verificationAttachmentController';

const router = express.Router();

// Apply authentication and rate limiting
router.use(authenticateToken);
router.use(requireFieldOrHigher);
router.use(caseRateLimit);

// Validation schemas
const createCaseValidation = [
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
  body('clientId')
    .trim()
    .notEmpty()
    .withMessage('Client ID is required'),
  body('assignedToId')
    .trim()
    .notEmpty()
    .withMessage('Assigned user ID is required'),

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
  body('deadline')
    .optional()
    .isISO8601()
    .withMessage('Deadline must be a valid date'),

  // New required fields for form integration
  body('applicantType')
    .trim()
    .isIn(['APPLICANT', 'CO-APPLICANT', 'CO-APPLICANT 1', 'CO-APPLICANT 2', 'CO-APPLICANT 3', 'GUARANTOR', 'SELLER', 'PROPRIETOR', 'PARTNER', 'DIRECTOR', 'REFERENCE PERSON'])
    .withMessage('Applicant type must be one of: APPLICANT, CO-APPLICANT, CO-APPLICANT 1, CO-APPLICANT 2, CO-APPLICANT 3, GUARANTOR, SELLER, PROPRIETOR, PARTNER, DIRECTOR, or REFERENCE PERSON'),
  body('backendContactNumber')
    .trim()
    .matches(/^[+]?[\d\s\-\(\)]{10,15}$/)
    .withMessage('Backend contact number must be valid'),
  body('trigger')
    .trim()
    .isLength({ min: 1 })
    .withMessage('TRIGGER field is required'),
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
  body('deadline')
    .optional()
    .isISO8601()
    .withMessage('Deadline must be a valid date'),
];

const listCasesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
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
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid date'),
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid date'),
];

const statusUpdateValidation = [
  body('status')
    .isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED', 'REWORK_REQUIRED'])
    .withMessage('Invalid status'),
];

const priorityUpdateValidation = [
  body('priority')
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Priority must be one of: LOW, MEDIUM, HIGH, URGENT'),
];

const assignValidation = [
  body('assignedToId')
    .trim()
    .notEmpty()
    .withMessage('Assigned user ID is required'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters'),
];

const bulkAssignValidation = [
  body('caseIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('Case IDs must be an array with 1-100 items'),
  body('caseIds.*')
    .isUUID()
    .withMessage('Each case ID must be a valid UUID'),
  body('assignedToId')
    .trim()
    .notEmpty()
    .withMessage('Assigned user ID is required'),
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

const reassignValidation = [
  body('fromUserId')
    .trim()
    .notEmpty()
    .withMessage('From user ID is required'),
  body('toUserId')
    .trim()
    .notEmpty()
    .withMessage('To user ID is required'),
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Reason is required for reassignment')
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters'),
];

const noteValidation = [
  body('note')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Note must be between 1 and 1000 characters'),
];

const completeValidation = [
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
];

const approveValidation = [
  body('feedback')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Feedback must be less than 1000 characters'),
];

const rejectValidation = [
  body('reason')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Rejection reason is required and must be less than 1000 characters'),
];

const reworkValidation = [
  body('feedback')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Rework feedback is required and must be less than 1000 characters'),
];

// Core CRUD routes
router.get('/',
  EnterpriseRateLimit.roleBasedLimiter(EnterpriseRateLimits.byRole),
  EnterpriseCache.create(EnterpriseCacheConfigs.caseList),
  listCasesValidation,
  validate,
  getCases
);

router.post('/',
  EnterpriseRateLimit.roleBasedLimiter(EnterpriseRateLimits.byRole),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.caseUpdate),
  createCaseValidation,
  validate,
  validateCaseCreationAccess,
  createCase
);

// Create case with attachments in single request
// Note: No validation middleware here as multer handles form data parsing
router.post('/with-attachments',
  createCaseWithAttachments
);

// Export cases to Excel - MUST be before /:id route
router.get('/export',
  EnterpriseRateLimit.roleBasedLimiter(EnterpriseRateLimits.byRole),
  [
    query('exportType').optional().isIn(['all', 'pending', 'in-progress', 'completed']).withMessage('Invalid export type'),
    query('status').optional().isString(),
    query('search').optional().isString(),
    query('assignedTo').optional().isUUID().withMessage('Invalid assigned to ID'),
    query('clientId').optional().isUUID().withMessage('Invalid client ID'),
    query('priority').optional().isString(),
    query('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
    query('dateTo').optional().isISO8601().withMessage('Invalid date format')
  ],
  validate,
  exportCases
);

router.get('/:id',
  EnterpriseRateLimit.roleBasedLimiter(EnterpriseRateLimits.byRole),
  EnterpriseCache.create(EnterpriseCacheConfigs.caseDetails),
  [param('id').trim().notEmpty().withMessage('Case ID is required')],
  validate,
  validateCaseAccess,
  getCaseById
);

router.put('/:id',
  [param('id').trim().notEmpty().withMessage('Case ID is required')],
  updateCaseValidation,
  validate,
  validateCaseAccess,
  updateCase
);

// TODO: Implement deleteCase function
// router.delete('/:id',
//   [param('id').trim().notEmpty().withMessage('Case ID is required')],
//   validate,
//   validateCaseAccess,
//   deleteCase
// );

// Case workflow routes - TODO: Implement these functions
// router.put('/:id/status',
//   [param('id').trim().notEmpty().withMessage('Case ID is required')],
//   statusUpdateValidation,
//   validate,
//   validateCaseAccess,
//   updateCaseStatus
// );

// router.put('/:id/priority',
//   [param('id').trim().notEmpty().withMessage('Case ID is required')],
//   priorityUpdateValidation,
//   validate,
//   validateCaseAccess,
//   updateCasePriority
// );

router.put('/:id/assign',
  [param('id').trim().notEmpty().withMessage('Case ID is required')],
  assignValidation,
  validate,
  validateCaseAccess,
  assignCase
);

// Bulk assignment routes
router.post('/bulk/assign',
  bulkAssignValidation,
  validate,
  bulkAssignCases
);

router.get('/bulk/assign/:batchId/status',
  [param('batchId').trim().notEmpty().withMessage('Batch ID is required')],
  validate,
  getBulkAssignmentStatus
);

// Reassignment route
router.post('/:id/reassign',
  [param('id').trim().notEmpty().withMessage('Case ID is required')],
  reassignValidation,
  validate,
  validateCaseAccess,
  reassignCase
);

// Assignment history route
router.get('/:id/assignment-history',
  [param('id').trim().notEmpty().withMessage('Case ID is required')],
  validate,
  validateCaseAccess,
  getCaseAssignmentHistory
);

// Analytics routes
router.get('/analytics/field-agent-workload',
  validate,
  getFieldAgentWorkload
);

// Verification Images route
router.get('/:id/verification-images',
  [param('id').trim().notEmpty().withMessage('Case ID is required')],
  validate,
  validateCaseAccess,
  VerificationAttachmentController.getVerificationImages
);

// Serve verification image file
router.get('/verification-images/:imageId/serve',
  [param('imageId').trim().notEmpty().withMessage('Image ID is required')],
  validate,
  VerificationAttachmentController.serveVerificationImage
);

// Serve verification image thumbnail
router.get('/verification-images/:imageId/thumbnail',
  [param('imageId').trim().notEmpty().withMessage('Image ID is required')],
  validate,
  VerificationAttachmentController.serveVerificationThumbnail
);

// TODO: Implement remaining case workflow functions
// router.post('/:id/notes',
//   [param('id').trim().notEmpty().withMessage('Case ID is required')],
//   noteValidation,
//   validate,
//   validateCaseAccess,
//   addCaseNote
// );

// router.get('/:id/history',
//   [param('id').trim().notEmpty().withMessage('Case ID is required')],
//   validate,
//   validateCaseAccess,
//   getCaseHistory
// );

// router.post('/:id/complete',
//   [param('id').trim().notEmpty().withMessage('Case ID is required')],
//   completeValidation,
//   validate,
//   validateCaseAccess,
//   completeCase
// );

// router.post('/:id/approve',
//   [param('id').trim().notEmpty().withMessage('Case ID is required')],
//   approveValidation,
//   validate,
//   validateCaseAccess,
//   approveCase
// );

// router.post('/:id/reject',
//   [param('id').trim().notEmpty().withMessage('Case ID is required')],
//   rejectValidation,
//   validate,
//   validateCaseAccess,
//   rejectCase
// );

// router.post('/:id/rework',
//   [param('id').trim().notEmpty().withMessage('Case ID is required')],
//   reworkValidation,
//   validate,
//   validateCaseAccess,
//   requestRework
// );

export default router;
