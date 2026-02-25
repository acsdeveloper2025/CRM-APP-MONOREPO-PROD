import express from 'express';
import { body, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import {
  createRbacRole,
  deleteRbacRole,
  getPermissionCatalog,
  getRbacRoleById,
  getRbacRoles,
  getRolePermissions,
  getRoleRoutes,
  updateRbacRole,
  updateRolePermissions,
  updateRoleRoutes,
} from '@/controllers/rbacController';

const router = express.Router();

router.use(authenticateToken);
router.use(authorize('permission.manage'));

router.get('/', getPermissionCatalog);
router.get('/permissions', getPermissionCatalog);

router.get('/roles', getRbacRoles);
router.get(
  '/roles/:id',
  [param('id').isUUID().withMessage('Role ID must be UUID')],
  validate,
  getRbacRoleById
);
router.post(
  '/roles',
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
router.put(
  '/roles/:id',
  [
    param('id').isUUID().withMessage('Role ID must be UUID'),
    body('name').optional().trim().notEmpty(),
    body('description').optional().isString(),
    body('parentRoleId').optional({ nullable: true }).isUUID(),
  ],
  validate,
  updateRbacRole
);
router.delete(
  '/roles/:id',
  [param('id').isUUID().withMessage('Role ID must be UUID')],
  validate,
  deleteRbacRole
);

router.get(
  '/roles/:id/permissions',
  [param('id').isUUID().withMessage('Role ID must be UUID')],
  validate,
  getRolePermissions
);
router.put(
  '/roles/:id/permissions',
  [
    param('id').isUUID().withMessage('Role ID must be UUID'),
    body('permissionCodes').isArray().withMessage('permissionCodes must be an array'),
    body('permissionCodes.*').isString().withMessage('permissionCodes values must be strings'),
  ],
  validate,
  updateRolePermissions
);

router.get(
  '/roles/:id/routes',
  [param('id').isUUID().withMessage('Role ID must be UUID')],
  validate,
  getRoleRoutes
);
router.put(
  '/roles/:id/routes',
  [
    param('id').isUUID().withMessage('Role ID must be UUID'),
    body('routes').isArray().withMessage('routes must be an array'),
    body('routes.*.routeKey').isString().withMessage('routeKey is required'),
    body('routes.*.allowed').isBoolean().withMessage('allowed must be boolean'),
  ],
  validate,
  updateRoleRoutes
);

export default router;
