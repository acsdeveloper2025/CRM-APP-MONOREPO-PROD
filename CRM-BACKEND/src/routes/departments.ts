import express from 'express';
import { auth } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
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
router.use(authorize('settings.manage'));

// GET /api/departments - Get all departments
router.get('/', getDepartments);

// GET /api/departments/:id - Get department by ID
router.get('/:id', getDepartmentById);

// POST /api/departments - Create new department
router.post('/', createDepartment);

// PUT /api/departments/:id - Update department
router.put('/:id', updateDepartment);

// DELETE /api/departments/:id - Delete department
router.delete('/:id', deleteDepartment);

export default router;
