import express from 'express';
import { body, param } from 'express-validator';
import { auth } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { handleValidationErrors } from '../middleware/validation';
import {
  getDepartments,
  getDepartmentById,
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

// GET /api/departments - Get all departments
router.get('/', getDepartments);

// GET /api/departments/:id - Get department by ID
router.get('/:id', idParamValidation, handleValidationErrors, getDepartmentById);

// POST /api/departments - Create new department
router.post(
  '/',
  authorize('settings.manage'),
  createDepartmentValidation,
  handleValidationErrors,
  createDepartment
);

// PUT /api/departments/:id - Update department
router.put(
  '/:id',
  authorize('settings.manage'),
  updateDepartmentValidation,
  handleValidationErrors,
  updateDepartment
);

// DELETE /api/departments/:id - Delete department
router.delete(
  '/:id',
  authorize('settings.manage'),
  idParamValidation,
  handleValidationErrors,
  deleteDepartment
);

export default router;
