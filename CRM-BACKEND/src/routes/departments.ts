import express from 'express';
import { body, param, query } from 'express-validator';
import { auth } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { handleValidationErrors } from '../middleware/validation';
import {
  EnterpriseCache,
  EnterpriseCacheConfigs,
  CacheInvalidationPatterns,
} from '../middleware/enterpriseCache';
import {
  getDepartments,
  getDepartmentById,
  getDepartmentStats,
  exportDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../controllers/departmentsController';

const router = express.Router();

// All department routes require authentication
router.use(auth);

const idParamValidation = [
  param('id').isInt({ min: 1 }).withMessage('Department ID must be a positive integer'),
];

// Canonical list-query validator (§9). Allowed sortBy values must match the
// DEPARTMENT_SORT_MAP keys in the controller.
const listQueryValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  query('search').optional().isString().trim(),
  query('isActive').optional().isIn(['true', 'false', 'all']),
  query('sortBy').optional().isIn(['name', 'createdAt', 'updatedAt']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  query('createdFrom').optional().isISO8601(),
  query('createdTo').optional().isISO8601(),
];

const createDepartmentValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1 and 200 characters'),
  body('description')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('departmentHeadId')
    .optional({ checkFalsy: true })
    .isUUID()
    .withMessage('Department head ID must be a valid UUID'),
];

const updateDepartmentValidation = [
  ...idParamValidation,
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1 and 200 characters'),
  body('description')
    .optional({ nullable: true, checkFalsy: false })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('departmentHeadId')
    .optional({ nullable: true, checkFalsy: false })
    .custom(value => value === null || /^[0-9a-fA-F-]{36}$/.test(String(value)))
    .withMessage('Department head ID must be a valid UUID or null'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

// GET /api/departments/stats — canonical 5-card aggregate.
// MUST be declared BEFORE /:id (Express matches in declaration order).
router.get(
  '/stats',
  authorize('user.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.departments),
  getDepartmentStats
);

// GET /api/departments/export — xlsx; mirrors list filters + sort.
// MUST be declared BEFORE /:id.
router.get(
  '/export',
  authorize('user.view'),
  listQueryValidation,
  handleValidationErrors,
  exportDepartments
);

// GET /api/departments - List
router.get(
  '/',
  authorize('user.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.departments),
  listQueryValidation,
  handleValidationErrors,
  getDepartments
);

// GET /api/departments/:id - Get department by ID
router.get(
  '/:id',
  authorize('user.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.departments),
  idParamValidation,
  handleValidationErrors,
  getDepartmentById
);

// POST /api/departments - Create new department
router.post(
  '/',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.departmentUpdate),
  createDepartmentValidation,
  handleValidationErrors,
  createDepartment
);

// PUT /api/departments/:id - Update department
router.put(
  '/:id',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.departmentUpdate),
  updateDepartmentValidation,
  handleValidationErrors,
  updateDepartment
);

// DELETE /api/departments/:id - Delete department
router.delete(
  '/:id',
  authorize('settings.manage'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.departmentUpdate),
  idParamValidation,
  handleValidationErrors,
  deleteDepartment
);

export default router;
