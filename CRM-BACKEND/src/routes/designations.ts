import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { auth } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import {
  EnterpriseCache,
  EnterpriseCacheConfigs,
  CacheInvalidationPatterns,
} from '@/middleware/enterpriseCache';
import {
  getDesignations,
  getDesignationById,
  getDesignationStats,
  exportDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation,
  getActiveDesignations,
} from '@/controllers/designationsController';

const router = Router();
router.use(auth);

// Validation schemas
const createDesignationValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('departmentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Department ID must be a valid integer'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const updateDesignationValidation = [
  param('id').isInt({ min: 1 }).withMessage('Designation ID must be a valid integer'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('departmentId')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Department ID must be a valid integer'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

// Canonical list-query validator (§9). Allowed sortBy values must match
// the DESIGNATION_SORT_MAP keys in the controller.
const listQueryValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  query('search').optional().trim().isLength({ max: 100 }),
  query('isActive').optional().isIn(['true', 'false', 'all']),
  query('departmentId').optional().isInt({ min: 1 }),
  query('sortBy').optional().isIn(['name', 'createdAt', 'updatedAt']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  query('createdFrom').optional().isISO8601(),
  query('createdTo').optional().isISO8601(),
];

const designationIdValidation = [
  param('id').isInt({ min: 1 }).withMessage('Designation ID must be a valid integer'),
];

// GET /api/designations/stats — canonical 5-card aggregate.
// MUST be declared BEFORE /:id (Express matches in declaration order).
router.get(
  '/stats',
  authorize('user.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.designations),
  getDesignationStats
);

// GET /api/designations/export — xlsx mirroring list filters + sort.
// MUST be declared BEFORE /:id.
router.get('/export', authorize('user.view'), listQueryValidation, validate, exportDesignations);

// GET /api/designations/active — dropdown helper used by user create/edit
// dialogs. Already gated by router-wide `auth`; no additional permission
// because every authenticated user may need to render a designation label.
router.get(
  '/active',
  query('departmentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Department ID must be a valid integer'),
  validate,
  getActiveDesignations
);

// GET /api/designations - List
router.get(
  '/',
  authorize('user.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.designations),
  listQueryValidation,
  validate,
  getDesignations
);

// GET /api/designations/:id - Get designation by ID
router.get(
  '/:id',
  authorize('user.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.designations),
  designationIdValidation,
  validate,
  getDesignationById
);

// POST /api/designations - Create new designation
router.post(
  '/',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.designationUpdate),
  createDesignationValidation,
  validate,
  createDesignation
);

// PUT /api/designations/:id - Update designation
router.put(
  '/:id',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.designationUpdate),
  updateDesignationValidation,
  validate,
  updateDesignation
);

// DELETE /api/designations/:id - Delete designation
router.delete(
  '/:id',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.designationUpdate),
  designationIdValidation,
  validate,
  deleteDesignation
);

export default router;
