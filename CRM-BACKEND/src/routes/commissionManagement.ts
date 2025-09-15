import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
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
  calculateCommissionForCompletedCase,
  // Commission Statistics
  getCommissionStats
} from '@/controllers/commissionManagementController';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// =====================================================
// COMMISSION RATE TYPES ROUTES
// =====================================================

// Validation schemas
const createCommissionRateTypeValidation = [
  body('rateTypeId')
    .isInt({ min: 1 })
    .withMessage('Rate type ID must be a positive integer'),
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
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const updateCommissionRateTypeValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Commission rate type ID must be a positive integer'),
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
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const commissionRateTypeIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Commission rate type ID must be a positive integer'),
];

// Commission Rate Types Routes
router.get('/rate-types', getCommissionRateTypes as any);

router.post('/rate-types',
  createCommissionRateTypeValidation,
  validate,
  createCommissionRateType as any
);

router.put('/rate-types/:id',
  updateCommissionRateTypeValidation,
  validate,
  updateCommissionRateType as any
);

router.delete('/rate-types/:id',
  commissionRateTypeIdValidation,
  validate,
  deleteCommissionRateType as any
);

// =====================================================
// FIELD USER COMMISSION ASSIGNMENTS ROUTES
// =====================================================

const createFieldUserCommissionAssignmentValidation = [
  body('userId')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  body('rateTypeId')
    .isInt({ min: 1 })
    .withMessage('Rate type ID must be a positive integer'),
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
  body('clientId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Client ID must be a positive integer'),
  body('effectiveFrom')
    .optional()
    .isISO8601()
    .withMessage('Effective from must be a valid date'),
  body('effectiveTo')
    .optional()
    .isISO8601()
    .withMessage('Effective to must be a valid date'),
];

// Field User Commission Assignments Routes
router.get('/field-user-assignments', getFieldUserCommissionAssignments as any);

router.post('/field-user-assignments',
  createFieldUserCommissionAssignmentValidation,
  validate,
  createFieldUserCommissionAssignment as any
);

router.put('/field-user-assignments/:id',
  createFieldUserCommissionAssignmentValidation,
  validate,
  updateFieldUserCommissionAssignment as any
);

router.delete('/field-user-assignments/:id',
  param('id').isUUID().withMessage('Assignment ID must be a valid UUID'),
  validate,
  deleteFieldUserCommissionAssignment as any
);

// =====================================================
// COMMISSION CALCULATIONS ROUTES
// =====================================================

const commissionCalculationsQueryValidation = [
  query('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
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
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid date'),
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid date'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'caseCompletedAt', 'calculatedCommission', 'status'])
    .withMessage('Sort by must be one of: createdAt, caseCompletedAt, calculatedCommission, status'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

// Commission Calculations Routes
router.get('/calculations',
  commissionCalculationsQueryValidation,
  validate,
  getCommissionCalculations as any
);

// =====================================================
// UTILITY ROUTES
// =====================================================

// Test commission calculation endpoint
router.post('/test-calculation',
  body('caseId').isUUID().withMessage('Case ID must be a valid UUID'),
  validate,
  calculateCommissionForCompletedCase as any
);

// =====================================================
// COMMISSION STATISTICS ROUTES
// =====================================================

// Commission Statistics Route
router.get('/stats', getCommissionStats as any);

export default router;
