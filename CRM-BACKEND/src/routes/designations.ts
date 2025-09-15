import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { auth, requireRole } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import { Role } from '@/types/auth';
import {
  getDesignations,
  getDesignationById,
  createDesignation,
  updateDesignation,
  deleteDesignation,
  getActiveDesignations,
} from '@/controllers/designationsController';

const router = Router();

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
    .isUUID()
    .withMessage('Department ID must be a valid UUID'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const updateDesignationValidation = [
  param('id')
    .isUUID()
    .withMessage('Designation ID must be a valid UUID'),
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
    .optional()
    .isUUID()
    .withMessage('Department ID must be a valid UUID'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const getDesignationsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  query('departmentId')
    .optional()
    .isUUID()
    .withMessage('Department ID must be a valid UUID'),
];

const designationIdValidation = [
  param('id')
    .isUUID()
    .withMessage('Designation ID must be a valid UUID'),
];

// Routes

// GET /api/designations - Get all designations (paginated)
router.get(
  '/',
  auth,
  requireRole([Role.ADMIN]),
  getDesignationsValidation,
  validate,
  getDesignations
);

// GET /api/designations/active - Get active designations for dropdowns
router.get(
  '/active',
  auth,
  query('departmentId')
    .optional()
    .isUUID()
    .withMessage('Department ID must be a valid UUID'),
  validate,
  getActiveDesignations
);

// GET /api/designations/:id - Get designation by ID
router.get(
  '/:id',
  auth,
  requireRole([Role.ADMIN]),
  designationIdValidation,
  validate,
  getDesignationById
);

// POST /api/designations - Create new designation
router.post(
  '/',
  auth,
  requireRole([Role.ADMIN]),
  createDesignationValidation,
  validate,
  createDesignation
);

// PUT /api/designations/:id - Update designation
router.put(
  '/:id',
  auth,
  requireRole([Role.ADMIN]),
  updateDesignationValidation,
  validate,
  updateDesignation
);

// DELETE /api/designations/:id - Delete designation
router.delete(
  '/:id',
  auth,
  requireRole([Role.ADMIN]),
  designationIdValidation,
  validate,
  deleteDesignation
);

export default router;
