import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { auth } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import {
  getDesignations,
  getDesignationById,
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
    .optional()
    .isInt({ min: 1 })
    .withMessage('Department ID must be a valid integer'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const getDesignationsValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  query('departmentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Department ID must be a valid integer'),
];

const designationIdValidation = [
  param('id').isInt({ min: 1 }).withMessage('Designation ID must be a valid integer'),
];

// Routes

// GET /api/designations - Get all designations (paginated)
router.get('/', getDesignationsValidation, validate, getDesignations);

// GET /api/designations/active - Get active designations for dropdowns
router.get(
  '/active',
  query('departmentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Department ID must be a valid integer'),
  validate,
  getActiveDesignations
);

// GET /api/designations/:id - Get designation by ID
router.get('/:id', designationIdValidation, validate, getDesignationById);

// POST /api/designations - Create new designation
router.post(
  '/',
  authorize('settings.manage'),
  createDesignationValidation,
  validate,
  createDesignation
);

// PUT /api/designations/:id - Update designation
router.put(
  '/:id',
  authorize('settings.manage'),
  updateDesignationValidation,
  validate,
  updateDesignation
);

// DELETE /api/designations/:id - Delete designation
router.delete(
  '/:id',
  authorize('settings.manage'),
  designationIdValidation,
  validate,
  deleteDesignation
);

export default router;
