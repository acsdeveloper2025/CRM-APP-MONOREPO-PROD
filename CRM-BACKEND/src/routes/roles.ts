import express from 'express';
import { body, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import {
  createRbacRole,
  deleteRbacRole,
  getRbacRoleById,
  getRbacRoles,
  getRolePermissions as getRbacRolePermissions,
  getRoleRoutes as getRbacRoleRoutes,
  updateRbacRole,
  updateRolePermissions as updateRbacRolePermissions,
  updateRoleRoutes as updateRbacRoleRoutes,
} from '@/controllers/rbacController';

const router = express.Router();

// Retired legacy /api/roles endpoints now backed by RBAC roles_v2 APIs
router.use(authenticateToken);

// GET /api/roles - Get all roles
router.get('/', authorize('role.manage'), getRbacRoles);

// GET /api/roles/:id - Get role by ID
router.get(
  '/:id',
  authorize('role.manage'),
  [param('id').isUUID().withMessage('Role ID must be UUID')],
  validate,
  getRbacRoleById
);

// RBAC role permissions/routes aliases (UUID role ids from roles_v2)
router.get(
  '/:id/permissions',
  authorize('permission.manage'),
  [param('id').isUUID().withMessage('Role ID must be UUID')],
  validate,
  getRbacRolePermissions
);
router.put(
  '/:id/permissions',
  authorize('permission.manage'),
  [
    param('id').isUUID().withMessage('Role ID must be UUID'),
    body('permissionCodes').isArray().withMessage('permissionCodes must be an array'),
    body('permissionCodes.*').isString().withMessage('permissionCodes values must be strings'),
  ],
  validate,
  updateRbacRolePermissions
);
router.get(
  '/:id/routes',
  authorize('permission.manage'),
  [param('id').isUUID().withMessage('Role ID must be UUID')],
  validate,
  getRbacRoleRoutes
);
router.put(
  '/:id/routes',
  authorize('permission.manage'),
  [
    param('id').isUUID().withMessage('Role ID must be UUID'),
    body('routes').isArray().withMessage('routes must be an array'),
  ],
  validate,
  updateRbacRoleRoutes
);

// POST /api/roles - Create new role
router.post(
  '/',
  authorize('role.manage'),
  [
    body('name').trim().notEmpty().withMessage('Role name is required'),
    body('description').optional().isString(),
    body('parentRoleId')
      .optional({ nullable: true })
      .isUUID()
      .withMessage('parentRoleId must be UUID'),
  ],
  validate,
  createRbacRole
);

// PUT /api/roles/:id - Update role
router.put(
  '/:id',
  authorize('role.manage'),
  [
    param('id').isUUID().withMessage('Role ID must be UUID'),
    body('name').optional().trim().notEmpty(),
    body('description').optional().isString(),
    body('parentRoleId')
      .optional({ nullable: true })
      .isUUID()
      .withMessage('parentRoleId must be UUID'),
  ],
  validate,
  updateRbacRole
);

// DELETE /api/roles/:id - Delete role
router.delete(
  '/:id',
  authorize('role.manage'),
  [param('id').isUUID().withMessage('Role ID must be UUID')],
  validate,
  deleteRbacRole
);

export default router;
