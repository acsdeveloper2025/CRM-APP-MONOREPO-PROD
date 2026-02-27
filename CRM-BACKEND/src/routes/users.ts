import express, { Request, Response, NextFunction } from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import { CANONICAL_RBAC_ROLE_NAMES } from '@/constants/rbacRoles';
import {
  EnterpriseCache,
  EnterpriseCacheConfigs,
  CacheInvalidationPatterns,
} from '../middleware/enterpriseCache';
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
  resetPassword,
  getAvailableFieldAgents,
  exportUsers,
  downloadUserTemplate,
} from '@/controllers/usersController';

const router = express.Router();
const SUPPORTED_USER_ROLES = [...CANONICAL_RBAC_ROLE_NAMES];
const SUPPORTED_USER_ROLES_MESSAGE = `Role must be one of: ${SUPPORTED_USER_ROLES.join(', ')}`;

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
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)
    .withMessage('Password must include uppercase, lowercase, number, and special character'),
  // Support both new roleId and legacy role fields
  body('roleId')
    .optional()
    .custom(value => {
      if (value && value.toString().trim() !== '') {
        const stringValue = String(value).trim();
        const intValue = parseInt(stringValue, 10);
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            stringValue
          );
        if (!isUuid && (isNaN(intValue) || intValue < 1)) {
          throw new Error('Role ID must be a valid positive integer or UUID');
        }
      }
      return true;
    }),
  body('role').optional().isIn(SUPPORTED_USER_ROLES).withMessage(SUPPORTED_USER_ROLES_MESSAGE),
  body('departmentId')
    .optional()
    .custom(value => {
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
    .custom(value => {
      if (value && value.toString().trim() !== '') {
        // If provided and not empty, must be a valid integer
        const intValue = parseInt(value, 10);
        if (isNaN(intValue) || intValue < 1) {
          throw new Error('Designation ID must be a valid positive integer');
        }
      }
      return true;
    }),
  body('teamLeaderId')
    .optional({ nullable: true })
    .custom(value => {
      if (value === null || value === '') {
        return true;
      }
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          String(value)
        )
      ) {
        throw new Error('Team Leader must be a valid user ID');
      }
      return true;
    }),
  body('managerId')
    .optional({ nullable: true })
    .custom(value => {
      if (value === null || value === '') {
        return true;
      }
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          String(value)
        )
      ) {
        throw new Error('Manager must be a valid user ID');
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
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  // Custom validation to ensure either roleId or role is provided
  body().custom((_value, { req }) => {
    const roleIdValue = req.body.roleId;
    const roleValue = req.body.role;
    const hasRoleId =
      roleIdValue !== undefined && roleIdValue !== null && String(roleIdValue).trim() !== '';
    const hasRole =
      roleValue !== undefined && roleValue !== null && String(roleValue).trim() !== '';

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
  body('email').optional().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('role').optional().isIn(SUPPORTED_USER_ROLES).withMessage(SUPPORTED_USER_ROLES_MESSAGE),
  body('roleId')
    .optional()
    .custom(value => {
      if (value && value.toString().trim() !== '') {
        const stringValue = String(value).trim();
        const intValue = parseInt(stringValue, 10);
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            stringValue
          );
        if (!isUuid && (isNaN(intValue) || intValue < 1)) {
          throw new Error('Role ID must be a valid positive integer or UUID');
        }
      }
      return true;
    }),
  body('departmentId')
    .optional()
    .custom(value => {
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
    .custom(value => {
      if (value && value.toString().trim() !== '') {
        // If provided and not empty, must be a valid integer
        const intValue = parseInt(value, 10);
        if (isNaN(intValue) || intValue < 1) {
          throw new Error('Designation ID must be a valid positive integer');
        }
      }
      return true;
    }),
  body('teamLeaderId')
    .optional({ nullable: true })
    .custom(value => {
      if (value === null || value === '') {
        return true;
      }
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          String(value)
        )
      ) {
        throw new Error('Team Leader must be a valid user ID');
      }
      return true;
    }),
  body('managerId')
    .optional({ nullable: true })
    .custom(value => {
      if (value === null || value === '') {
        return true;
      }
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          String(value)
        )
      ) {
        throw new Error('Manager must be a valid user ID');
      }
      return true;
    }),
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
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const listUsersValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('role').optional().isIn(SUPPORTED_USER_ROLES).withMessage(SUPPORTED_USER_ROLES_MESSAGE),
  query('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department must be less than 100 characters'),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['name', 'username', 'email', 'role', 'department', 'createdAt', 'lastLoginAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
];

const bulkOperationValidation = [
  body('userIds').isArray({ min: 1 }).withMessage('User IDs array is required'),
  body('userIds.*').isString().withMessage('Each user ID must be a string'),
  body('operation')
    .isIn(['activate', 'deactivate', 'delete', 'changeRole'])
    .withMessage('Operation must be one of: activate, deactivate, delete, changeRole'),
  body('data').optional().isObject().withMessage('Data must be an object'),
];

const searchValidation = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
];

const clientAssignmentValidation = [
  body('clientIds').isArray().withMessage('clientIds must be an array'),
  body('clientIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each client ID must be a positive integer'),
];

const userIdValidation = [param('userId').isUUID().withMessage('User ID must be a valid UUID')];

const clientIdValidation = [
  param('clientId').isInt({ min: 1 }).withMessage('Client ID must be a positive integer'),
];

const productAssignmentValidation = [
  body('productIds').isArray().withMessage('productIds must be an array'),
  body('productIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('All productIds must be positive integers'),
];

const productIdValidation = [
  param('productId').isInt({ min: 1 }).withMessage('Product ID must be a positive integer'),
];

// Middleware to disable browser caching and prevent 304 responses
const noBrowserCache = (req: Request, res: Response, next: NextFunction) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  // Set a unique ETag to prevent 304 responses
  res.set('ETag', `W/"${Date.now()}-${Math.random()}"`);
  next();
};

// Core CRUD routes
router.get(
  '/',
  authenticateToken,
  authorize('user.view'),
  noBrowserCache, // Prevent browser caching and 304 responses
  EnterpriseCache.create(EnterpriseCacheConfigs.usersList),
  listUsersValidation,
  validate,
  getUsers
);

router.get(
  '/search',
  authenticateToken,
  authorize('user.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.usersList),
  searchValidation,
  validate,
  searchUsers
);

// Export users route
router.post('/export', authenticateToken, authorize('user.view'), exportUsers);

router.get('/import-template', authenticateToken, authorize('user.view'), downloadUserTemplate);

// Get available field agents filtered by territory (must come before /stats)
router.get(
  '/field-agents/available',
  authenticateToken,
  authorize('user.view'),
  getAvailableFieldAgents
);

router.get(
  '/stats',
  authenticateToken,
  authorize('user.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.userStats),
  getUserStats
);

router.get(
  '/departments',
  authenticateToken,
  authorize('user.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.analytics),
  getDepartments
);

router.get(
  '/designations',
  authenticateToken,
  authorize('user.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.analytics),
  getDesignations
);

router.get(
  '/activities',
  authenticateToken,
  authorize('user.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.analytics),
  getUserActivities
);

router.get(
  '/sessions',
  authenticateToken,
  authorize('user.view'),
  EnterpriseCache.create(EnterpriseCacheConfigs.analytics),
  getUserSessions
);

router.get(
  '/roles/permissions',
  authenticateToken,
  authorize('role.manage'),
  EnterpriseCache.create(EnterpriseCacheConfigs.analytics),
  getRolePermissions
);

router.post(
  '/',
  authenticateToken,
  authorize('user.create'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.userUpdate),
  createUserValidation,
  validate,
  createUser
);

router.post(
  '/bulk-operation',
  authenticateToken,
  authorize('user.update'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.userUpdate),
  bulkOperationValidation,
  validate,
  bulkUserOperation
);

// Client assignment routes (must be before /:id route)
router.get(
  '/:userId/client-assignments',
  authenticateToken,
  authorize('territory.assign'),
  userIdValidation,
  validate,
  getUserClientAssignments
);

router.post(
  '/:userId/client-assignments',
  authenticateToken,
  authorize('territory.assign'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.assignmentUpdate, { synchronous: true }),
  userIdValidation,
  clientAssignmentValidation,
  validate,
  assignClientsToUser
);

router.delete(
  '/:userId/client-assignments/:clientId',
  authenticateToken,
  authorize('territory.assign'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.assignmentUpdate, { synchronous: true }),
  userIdValidation,
  clientIdValidation,
  validate,
  removeClientAssignment
);

// Product assignment routes
router.get(
  '/:userId/product-assignments',
  authenticateToken,
  authorize('territory.assign'),
  userIdValidation,
  validate,
  getUserProductAssignments
);

router.post(
  '/:userId/product-assignments',
  authenticateToken,
  authorize('territory.assign'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.assignmentUpdate, { synchronous: true }),
  userIdValidation,
  productAssignmentValidation,
  validate,
  assignProductsToUser
);

router.delete(
  '/:userId/product-assignments/:productId',
  authenticateToken,
  authorize('territory.assign'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.assignmentUpdate, { synchronous: true }),
  userIdValidation,
  productIdValidation,
  validate,
  removeProductAssignment
);

router.get(
  '/:id',
  authenticateToken,
  authorize('user.view'),
  [param('id').trim().notEmpty().withMessage('User ID is required')],
  validate,
  getUserById
);

router.put(
  '/:id',
  authenticateToken,
  authorize('user.update'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.userUpdate),
  [param('id').trim().notEmpty().withMessage('User ID is required')],
  updateUserValidation,
  validate,
  updateUser
);

router.delete(
  '/:id',
  authenticateToken,
  authorize('user.delete'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.userUpdate),
  [param('id').trim().notEmpty().withMessage('User ID is required')],
  validate,
  deleteUser
);

router.post(
  '/:id/activate',
  authenticateToken,
  authorize('user.update'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.userUpdate),
  [param('id').trim().notEmpty().withMessage('User ID is required')],
  validate,
  activateUser
);

router.post(
  '/:id/deactivate',
  authenticateToken,
  authorize('user.update'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.userUpdate),
  [
    param('id').trim().notEmpty().withMessage('User ID is required'),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason must be less than 500 characters'),
  ],
  validate,
  deactivateUser
);

// Password management routes
router.post(
  '/:id/generate-temp-password',
  authenticateToken,
  authorize('user.update'),
  [param('id').trim().notEmpty().withMessage('User ID is required')],
  validate,
  generateTemporaryPassword
);

router.post(
  '/:id/change-password',
  authenticateToken,
  authorize('user.update'),
  [
    param('id').trim().notEmpty().withMessage('User ID is required'),
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)
      .withMessage('New password must include uppercase, lowercase, number, and special character'),
  ],
  validate,
  changePassword
);

router.post(
  '/reset-password',
  authenticateToken,
  authorize('user.update'),
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)
      .withMessage('New password must include uppercase, lowercase, number, and special character'),
  ],
  validate,
  resetPassword
);

export default router;
