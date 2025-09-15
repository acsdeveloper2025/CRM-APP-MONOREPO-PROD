import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import { logger } from '@/config/logger';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  deactivateUser,
  searchUsers,
  getUserStats,
  getDepartments,
  getDesignations,
  getUserActivities,
  getUserSessions,
  getRolePermissions,
  getUserClientAssignments,
  assignClientsToUser,
  removeClientAssignment,
  getUserProductAssignments,
  assignProductsToUser,
  removeProductAssignment,
  bulkUserOperation,
  generateTemporaryPassword,
  changePassword,
  resetPassword
} from '@/controllers/usersController';

const router = express.Router();

// Validation schemas
const createUserValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('Username can only contain letters, numbers, dots, underscores, and hyphens'),
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  // Support both new roleId and legacy role fields
  body('roleId')
    .optional()
    .custom((value) => {
      if (value && value.toString().trim() !== '') {
        // If provided and not empty, must be a valid integer
        const intValue = parseInt(value, 10);
        if (isNaN(intValue) || intValue < 1) {
          throw new Error('Role ID must be a valid positive integer');
        }
      }
      return true;
    }),
  body('role')
    .optional()
    .isIn(['SUPER_ADMIN', 'ADMIN', 'BACKEND_USER', 'FIELD_AGENT', 'MANAGER', 'REPORT_PERSON'])
    .withMessage('Role must be one of: SUPER_ADMIN, ADMIN, BACKEND_USER, FIELD_AGENT, MANAGER, REPORT_PERSON'),
  body('departmentId')
    .optional()
    .custom((value) => {
      if (value && value.toString().trim() !== '') {
        // If provided and not empty, must be a valid integer
        const intValue = parseInt(value, 10);
        if (isNaN(intValue) || intValue < 1) {
          throw new Error('Department ID must be a valid positive integer');
        }
      }
      return true;
    }),
  body('designationId')
    .optional()
    .custom((value) => {
      if (value && value.toString().trim() !== '') {
        // If provided and not empty, must be a valid integer
        const intValue = parseInt(value, 10);
        if (isNaN(intValue) || intValue < 1) {
          throw new Error('Designation ID must be a valid positive integer');
        }
      }
      return true;
    }),
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department must be less than 100 characters'),
  body('employeeId')
    .trim()
    .notEmpty()
    .withMessage('Employee ID is required')
    .isLength({ max: 50 })
    .withMessage('Employee ID must be less than 50 characters'),
  body('designation')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Designation must be less than 100 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Phone number must be valid'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  // Custom validation to ensure either roleId or role is provided
  body().custom((value, { req }) => {
    const hasRoleId = req.body.roleId && req.body.roleId.trim() !== '';
    const hasRole = req.body.role && req.body.role.trim() !== '';

    if (!hasRoleId && !hasRole) {
      throw new Error('Either roleId or role must be provided');
    }
    return true;
  }),
];

const updateUserValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('Username can only contain letters, numbers, dots, underscores, and hyphens'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('role')
    .optional()
    .isIn(['SUPER_ADMIN', 'ADMIN', 'BACKEND_USER', 'FIELD_AGENT', 'MANAGER', 'REPORT_PERSON'])
    .withMessage('Role must be one of: SUPER_ADMIN, ADMIN, BACKEND_USER, FIELD_AGENT, MANAGER, REPORT_PERSON'),
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department must be less than 100 characters'),
  body('designation')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Designation must be less than 100 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Phone number must be valid'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const listUsersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('role')
    .optional()
    .isIn(['SUPER_ADMIN', 'ADMIN', 'BACKEND_USER', 'FIELD_AGENT', 'MANAGER'])
    .withMessage('Role must be one of: SUPER_ADMIN, ADMIN, BACKEND_USER, FIELD_AGENT, MANAGER'),
  query('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department must be less than 100 characters'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['name', 'username', 'email', 'role', 'department', 'createdAt', 'lastLoginAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

const bulkOperationValidation = [
  body('userIds')
    .isArray({ min: 1 })
    .withMessage('User IDs array is required'),
  body('userIds.*')
    .isString()
    .withMessage('Each user ID must be a string'),
  body('operation')
    .isIn(['activate', 'deactivate', 'delete', 'changeRole'])
    .withMessage('Operation must be one of: activate, deactivate, delete, changeRole'),
  body('data')
    .optional()
    .isObject()
    .withMessage('Data must be an object'),
];

const searchValidation = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
];

const clientAssignmentValidation = [
  body('clientIds')
    .isArray()
    .withMessage('clientIds must be an array'),
  body('clientIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each client ID must be a positive integer'),
];

const userIdValidation = [
  param('userId')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
];

const clientIdValidation = [
  param('clientId')
    .isInt({ min: 1 })
    .withMessage('Client ID must be a positive integer'),
];

const productAssignmentValidation = [
  body('productIds')
    .isArray()
    .withMessage('productIds must be an array'),
  body('productIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('All productIds must be positive integers'),
];

const productIdValidation = [
  param('productId')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer'),
];

// Core CRUD routes
router.get('/', 
  authenticateToken, 
  listUsersValidation, 
  validate, 
  getUsers
);

router.get('/search', 
  authenticateToken, 
  searchValidation, 
  validate, 
  searchUsers
);

router.get('/stats', 
  authenticateToken, 
  getUserStats
);

router.get('/departments', 
  authenticateToken, 
  getDepartments
);

router.get('/designations',
  authenticateToken,
  getDesignations
);

router.get('/activities',
  authenticateToken,
  getUserActivities
);

router.get('/sessions',
  authenticateToken,
  getUserSessions
);

router.get('/roles/permissions',
  authenticateToken,
  getRolePermissions
);

router.post('/',
  authenticateToken,
  createUserValidation,
  validate,
  createUser
);

router.post('/bulk-operation',
  authenticateToken,
  bulkOperationValidation,
  validate,
  bulkUserOperation
);

// Client assignment routes (must be before /:id route)
router.get('/:userId/client-assignments',
  authenticateToken,
  userIdValidation,
  validate,
  getUserClientAssignments
);

router.post('/:userId/client-assignments',
  authenticateToken,
  userIdValidation,
  clientAssignmentValidation,
  validate,
  assignClientsToUser
);

router.delete('/:userId/client-assignments/:clientId',
  authenticateToken,
  userIdValidation,
  clientIdValidation,
  validate,
  removeClientAssignment
);

// Product assignment routes
router.get('/:userId/product-assignments',
  authenticateToken,
  userIdValidation,
  validate,
  getUserProductAssignments
);

router.post('/:userId/product-assignments',
  authenticateToken,
  userIdValidation,
  productAssignmentValidation,
  validate,
  assignProductsToUser
);

router.delete('/:userId/product-assignments/:productId',
  authenticateToken,
  userIdValidation,
  productIdValidation,
  validate,
  removeProductAssignment
);

router.get('/:id',
  authenticateToken,
  [param('id').trim().notEmpty().withMessage('User ID is required')],
  validate,
  getUserById
);

router.put('/:id', 
  authenticateToken, 
  [param('id').trim().notEmpty().withMessage('User ID is required')], 
  updateUserValidation, 
  validate, 
  updateUser
);

router.delete('/:id', 
  authenticateToken, 
  [param('id').trim().notEmpty().withMessage('User ID is required')], 
  validate, 
  deleteUser
);

router.post('/:id/activate', 
  authenticateToken, 
  [param('id').trim().notEmpty().withMessage('User ID is required')], 
  validate, 
  activateUser
);

router.post('/:id/deactivate',
  authenticateToken,
  [
    param('id').trim().notEmpty().withMessage('User ID is required'),
    body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason must be less than 500 characters')
  ],
  validate,
  deactivateUser
);

// Password management routes
router.post('/:id/generate-temp-password',
  authenticateToken,
  [param('id').trim().notEmpty().withMessage('User ID is required')],
  validate,
  generateTemporaryPassword
);

router.post('/:id/change-password',
  authenticateToken,
  [
    param('id').trim().notEmpty().withMessage('User ID is required'),
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
  ],
  validate,
  changePassword
);

router.post('/reset-password',
  authenticateToken,
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
  ],
  validate,
  resetPassword
);

export default router;
