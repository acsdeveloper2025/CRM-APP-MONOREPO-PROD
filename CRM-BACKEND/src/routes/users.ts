import express, { Request, Response, NextFunction } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize, authorizeAny } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import { CANONICAL_RBAC_ROLE_NAMES } from '@/constants/rbacRoles';
import {
  EnterpriseCache,
  EnterpriseCacheConfigs,
  CacheInvalidationPatterns,
} from '../middleware/enterpriseCache';
import { ProfilePhotoController } from '@/controllers/profilePhotoController';
import { profilePhotoUpload } from '@/middleware/profilePhotoUpload';
import { acceptConsent, getUserConsents } from '@/controllers/userConsentsController';
import { getUserAuditLog } from '@/controllers/userAuditLogController';
import { exportUserData } from '@/controllers/userDataExportController';
import { eraseUserData } from '@/controllers/userErasureController';
import { listUserSessions, revokeUserSession } from '@/controllers/userSessionsController';
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
  getAssignableUsersByRole,
  exportUsers,
  downloadUserTemplate,
  bulkImportUsers,
} from '@/controllers/usersController';

const router = express.Router();

// Bulk-import accepts CSV or XLSX (template is XLSX). The shared upload
// middleware is CSV-only, so users gets its own instance.
const userImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb: FileFilterCallback) => {
    const name = file.originalname.toLowerCase();
    const ok =
      name.endsWith('.csv') ||
      name.endsWith('.xlsx') ||
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (ok) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV or XLSX files are allowed'));
    }
  },
});
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
  // Support RBAC roleId UUID or canonical role name
  body('roleId')
    .optional()
    .custom(value => {
      if (value && value.toString().trim() !== '') {
        const stringValue = String(value).trim();
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            stringValue
          );
        if (!isUuid) {
          throw new Error('Role ID must be a valid RBAC role UUID');
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
  body('employeeId')
    .trim()
    .notEmpty()
    .withMessage('Employee ID is required')
    .isLength({ max: 50 })
    .withMessage('Employee ID must be less than 50 characters'),
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
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            stringValue
          );
        if (!isUuid) {
          throw new Error('Role ID must be a valid RBAC role UUID');
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
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
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
    .isIn(['name', 'username', 'email', 'role', 'createdAt', 'lastLoginAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
];

const bulkOperationValidation = [
  body('userIds').isArray({ min: 1 }).withMessage('User IDs array is required'),
  body('userIds.*').isString().withMessage('Each user ID must be a string'),
  body('operation')
    .isIn(['activate', 'deactivate', 'delete', 'changeRole'])
    .withMessage('Operation must be one of: activate, deactivate, delete, change_role'),
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

// C-HIGH-3 (AUDIT 2026-05-17): DPDP §9(4) self-service audit-log access.
// Authorization handled inside the controller (self OR settings.manage admin).
router.get('/:id/audit-log', authenticateToken, getUserAuditLog);

// C-HIGH-1 (AUDIT 2026-05-17): DPDP §11 data export — data subject's
// right to access a copy of all personal data the system holds about
// them. Auth handled inside controller (self OR settings.manage admin).
router.get('/:id/data-export', authenticateToken, exportUserData);

// C-HIGH-1 (AUDIT 2026-05-17): DPDP §15 erasure right. Redacts the user
// row + hard-deletes session/device/notification records. Statutory
// retention (RBI 7yr commission, audit logs, KYC business records)
// honors the §15 carve-out. Auth: self OR settings.manage admin.
router.delete('/:id/data', authenticateToken, eraseUserData);

// A-CRIT-1 chunk 3 (AUDIT 2026-05-17): per-device session management.
// List active sessions / revoke ONE without nuking other devices.
// Auth handled inside controllers (self OR settings.manage admin).
router.get('/:id/sessions', authenticateToken, listUserSessions);
router.delete('/:id/sessions/:sessionId', authenticateToken, revokeUserSession);

// POST /api/users/import - CSV or XLSX bulk insert
router.post(
  '/import',
  authenticateToken,
  authorize('user.create'),
  EnterpriseCache.invalidate(CacheInvalidationPatterns.userUpdate),
  userImportUpload.single('file'),
  bulkImportUsers
);

router.get('/import-template', authenticateToken, authorize('user.view'), downloadUserTemplate);

// Get available field agents filtered by territory (must come before /stats)
router.get(
  '/field-agents/available',
  authenticateToken,
  authorizeAny(['user.view', 'case.create', 'case.assign', 'case.reassign']),
  getAvailableFieldAgents
);

// Phase 1.4 (2026-05-04): lite endpoint for case-creation forms — list
// active users by role, returning only id/name/email/employeeId. Required
// because BACKEND_USER role has `case.create` but not `user.view`, so
// the full /api/users endpoint 403s when picking KYC verifiers.
router.get(
  '/assignable-by-role',
  authenticateToken,
  authorizeAny(['user.view', 'case.create', 'case.assign', 'case.reassign']),
  getAssignableUsersByRole
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

// 2026-05-13: per-user consent history (Field Executive
// Acknowledgement audit trail). Returned on user-detail page for
// compliance/dispute review. UNIQUE (user_id, policy_version) means
// rows ≤ number of policy versions ever bumped.
//
// Phase D Option B (2026-05-17): dropped authorize('user.view') so
// regular users can read their OWN consent history (needed by the
// PolicyAcceptanceGuard on every protected route). Cross-user reads
// are now restricted by the in-controller self-or-admin check inside
// getUserConsents (mirrors userDataExportController pattern).
router.get(
  '/:id/consents',
  authenticateToken,
  [param('id').trim().notEmpty().withMessage('User ID is required')],
  validate,
  getUserConsents
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

// Phase D-3 (audit 2026-05-17): drop authorize('user.update') so regular
// users CAN change their own password from the profile page. Cross-user
// changes are still blocked by the in-controller self-check at
// usersController.changePassword:2400 (id !== callerId && !hasSystemScopeBypass).
router.post(
  '/:id/change-password',
  authenticateToken,
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

// Profile photo — admin upload / delete (CRM-FRONTEND already calls these
// paths in `services/users.ts:uploadProfilePhoto` / `deleteProfilePhoto`).
// Decisions 2026-04-21: Q1=A admin gated by `user.update`; Q5=B backend
// re-encodes every upload via `sharp` to 512×512 JPEG.
router.post(
  '/:userId/profile-photo',
  authenticateToken,
  authorize('user.update'),
  profilePhotoUpload.single('photo'),
  ProfilePhotoController.uploadForUser
);
router.delete(
  '/:userId/profile-photo',
  authenticateToken,
  authorize('user.update'),
  ProfilePhotoController.deleteForUser
);

// Phase D-7 (2026-05-17): web-side self-service consent acceptance.
// Mirrors the mobile mount at /api/mobile/consents/accept — same
// controller, same idempotent UPSERT on (user_id, policy_version).
// Source is supplied by caller body (defaults 'MOBILE' in controller;
// FE web sends 'WEB').
router.post(
  '/me/consents/accept',
  authenticateToken,
  [
    body('policyVersion').isInt({ gt: 0 }).withMessage('policyVersion must be a positive integer'),
    body('source').optional().isIn(['MOBILE', 'WEB']).withMessage('source must be MOBILE or WEB'),
  ],
  validate,
  acceptConsent
);

export default router;
