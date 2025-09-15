import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { handleValidationErrors } from '@/middleware/validation';
import {
  getStates,
  getStateById,
  createState,
  updateState,
  deleteState,
  getStatesStats,
  bulkImportStates
} from '@/controllers/statesController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);

// Validation schemas
const listStatesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('country')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Country must be between 1 and 100 characters'),
  query('search')
    .optional()
    .trim()
    .custom((value) => {
      if (value === '' || value === undefined || value === null) return true;
      return value.length >= 1 && value.length <= 100;
    })
    .withMessage('Search term must be between 1 and 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['name', 'code', 'country', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

const createStateValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('State name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('State name must be between 1 and 100 characters'),
  body('code')
    .trim()
    .notEmpty()
    .withMessage('State code is required')
    .isLength({ min: 2, max: 10 })
    .withMessage('State code must be between 2 and 10 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('State code must contain only uppercase letters and numbers'),
  body('country')
    .trim()
    .notEmpty()
    .withMessage('Country is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Country must be between 1 and 100 characters'),
];

const updateStateValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('State name must be between 1 and 100 characters'),
  body('code')
    .optional()
    .trim()
    .isLength({ min: 2, max: 10 })
    .withMessage('State code must be between 2 and 10 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('State code must contain only uppercase letters and numbers'),
  body('country')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Country must be between 1 and 100 characters'),
];

const bulkImportValidation = [
  // File validation would be handled by multer middleware
  body('overwrite')
    .optional()
    .isBoolean()
    .withMessage('Overwrite must be a boolean'),
];

// Core CRUD routes
router.get('/', 
  listStatesValidation, 
  handleValidationErrors, 
  getStates
);

router.get('/stats', getStatesStats);

router.post('/', 
  createStateValidation, 
  handleValidationErrors, 
  createState
);

router.post('/bulk-import', 
  bulkImportValidation, 
  handleValidationErrors, 
  bulkImportStates
);

router.get('/:id', 
  [param('id').trim().notEmpty().withMessage('State ID is required')], 
  handleValidationErrors, 
  getStateById
);

router.put('/:id', 
  [param('id').trim().notEmpty().withMessage('State ID is required')], 
  updateStateValidation, 
  handleValidationErrors, 
  updateState
);

router.delete('/:id', 
  [param('id').trim().notEmpty().withMessage('State ID is required')], 
  handleValidationErrors, 
  deleteState
);

export default router;
