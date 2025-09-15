import express from 'express';
import { auth, requirePermission } from '../middleware/auth';
import {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment
} from '../controllers/departmentsController';

const router = express.Router();

// All department routes require authentication
router.use(auth);

// GET /api/departments - Get all departments
router.get('/', requirePermission('departments', 'read'), getDepartments);

// GET /api/departments/:id - Get department by ID
router.get('/:id', requirePermission('departments', 'read'), getDepartmentById);

// POST /api/departments - Create new department
router.post('/', requirePermission('departments', 'create'), createDepartment);

// PUT /api/departments/:id - Update department
router.put('/:id', requirePermission('departments', 'update'), updateDepartment);

// DELETE /api/departments/:id - Delete department
router.delete('/:id', requirePermission('departments', 'delete'), deleteDepartment);

export default router;
