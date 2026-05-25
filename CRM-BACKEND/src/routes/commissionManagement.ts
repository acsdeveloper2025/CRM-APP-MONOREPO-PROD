import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import { EnterpriseCache, CacheInvalidationPatterns } from '@/middleware/enterpriseCache';
import {
  // Commission Rate Types
  getCommissionRateTypes,
  createCommissionRateType,
  updateCommissionRateType,
  deleteCommissionRateType,
  // Field User Commission Assignments
  getFieldUserCommissionAssignments,
  createFieldUserCommissionAssignment,
  updateFieldUserCommissionAssignment,
  deleteFieldUserCommissionAssignment,
  // Commission Calculations
  getCommissionCalculations,
  // Commission Statistics
  getCommissionStats,
  // Export
  exportCommissionsToExcel,
} from '@/controllers/commissionManagementController';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// =====================================================
// COMMISSION RATE TYPES ROUTES
// =====================================================

// Validation schemas
const createCommissionRateTypeValidation = [
  body('rateTypeId').isInt({ min: 1 }).withMessage('Rate type ID must be a positive integer'),
  body('commissionAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Commission amount must be a non-negative number'),
  body('commissionPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Commission percentage must be between 0 and 100'),
  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-character code'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const updateCommissionRateTypeValidation = [
  param('id').isInt({ min: 1 }).withMessage('Commission rate type ID must be a positive integer'),
  body('commissionAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Commission amount must be a non-negative number'),
  body('commissionPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Commission percentage must be between 0 and 100'),
  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-character code'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const commissionRateTypeIdValidation = [
  param('id').isInt({ min: 1 }).withMessage('Commission rate type ID must be a positive integer'),
];

// Commission Rate Types Routes
router.get(
  '/rate-types',
  authorize('billing.download'),
  getCommissionRateTypes as express.RequestHandler
);

router.post(
  '/rate-types',
  authorize('billing.approve'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.commissionUpdate),
  createCommissionRateTypeValidation,
  validate,
  createCommissionRateType as express.RequestHandler
);

router.put(
  '/rate-types/:id',
  authorize('billing.approve'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.commissionUpdate),
  updateCommissionRateTypeValidation,
  validate,
  updateCommissionRateType as express.RequestHandler
);

router.delete(
  '/rate-types/:id',
  authorize('billing.approve'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.commissionUpdate),
  commissionRateTypeIdValidation,
  validate,
  deleteCommissionRateType as express.RequestHandler
);

// =====================================================
// FIELD USER COMMISSION ASSIGNMENTS ROUTES
// =====================================================

const createFieldUserCommissionAssignmentValidation = [
  body('userId').isUUID().withMessage('User ID must be a valid UUID'),
  body('rateTypeId').isInt({ min: 1 }).withMessage('Rate type ID must be a positive integer'),
  body('commissionAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Commission amount must be a non-negative number'),
  body('commissionPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Commission percentage must be between 0 and 100'),
  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-character code'),
  body('clientId').optional().isInt({ min: 1 }).withMessage('Client ID must be a positive integer'),
  body('effectiveFrom').optional().isISO8601().withMessage('Effective from must be a valid date'),
  body('effectiveTo').optional().isISO8601().withMessage('Effective to must be a valid date'),
];

// Field User Commission Assignments Routes
router.get(
  '/field-user-assignments',
  authorize('billing.download'),
  getFieldUserCommissionAssignments as express.RequestHandler
);

router.post(
  '/field-user-assignments',
  authorize('billing.approve'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.commissionUpdate),
  createFieldUserCommissionAssignmentValidation,
  validate,
  createFieldUserCommissionAssignment as express.RequestHandler
);

router.put(
  '/field-user-assignments/:id',
  authorize('billing.approve'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.commissionUpdate),
  [
    param('id').isInt({ min: 1 }).withMessage('Assignment ID must be a positive integer'),
    ...createFieldUserCommissionAssignmentValidation,
  ],
  validate,
  updateFieldUserCommissionAssignment as express.RequestHandler
);

router.delete(
  '/field-user-assignments/:id',
  authorize('billing.approve'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.commissionUpdate),
  param('id').isInt({ min: 1 }).withMessage('Assignment ID must be a positive integer'),
  validate,
  deleteFieldUserCommissionAssignment as express.RequestHandler
);

// =====================================================
// COMMISSION CALCULATIONS ROUTES
// =====================================================

const commissionCalculationsQueryValidation = [
  query('userId').optional().isUUID().withMessage('User ID must be a valid UUID'),
  query('clientId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Client ID must be a positive integer'),
  query('rateTypeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Rate type ID must be a positive integer'),
  query('status')
    .optional()
    .isIn(['PENDING', 'APPROVED', 'PAID', 'REJECTED'])
    .withMessage('Status must be one of: PENDING, APPROVED, PAID, REJECTED'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
  query('sortBy')
    .optional()
    // Enum mirrors COMMISSION_SORT_MAP keys (controller); add new keys here
    // when extending the SORT_MAP. Filter-sweep §6: FE Select enums + BE
    // validator + SORT_MAP must stay in lockstep.
    .isIn(['createdAt', 'amount', 'baseAmount', 'status'])
    .withMessage('Sort by must be one of: createdAt, amount, baseAmount, status'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
];

// Commission Calculations Routes
router.get(
  '/calculations',
  authorize('billing.download'),
  commissionCalculationsQueryValidation,
  validate,
  getCommissionCalculations as express.RequestHandler
);

// =====================================================
// COMMISSION STATISTICS ROUTES
// =====================================================

// Commission Statistics Route
router.get('/stats', authorize('billing.download'), getCommissionStats as express.RequestHandler);

// Export Route
router.get(
  '/export',
  authorize('billing.download'),
  exportCommissionsToExcel as express.RequestHandler
);

export default router;
