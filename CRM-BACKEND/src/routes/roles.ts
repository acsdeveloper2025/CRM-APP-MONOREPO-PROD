import express from 'express';
import { auth, requirePermission } from '../middleware/auth';
import {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole
} from '../controllers/rolesController';

const router = express.Router();

// All role routes require authentication
router.use(auth);

// GET /api/roles - Get all roles
router.get('/', requirePermission('roles', 'read'), getRoles);

// GET /api/roles/:id - Get role by ID
router.get('/:id', requirePermission('roles', 'read'), getRole);

// POST /api/roles - Create new role
router.post('/', requirePermission('roles', 'create'), createRole);

// PUT /api/roles/:id - Update role
router.put('/:id', requirePermission('roles', 'update'), updateRole);

// DELETE /api/roles/:id - Delete role
router.delete('/:id', requirePermission('roles', 'delete'), deleteRole);

export default router;
