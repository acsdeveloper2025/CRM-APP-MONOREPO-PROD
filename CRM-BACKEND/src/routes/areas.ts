import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import {
  getAreas,
  getAreaById,
  createArea,
  updateArea,
  deleteArea,
  getStandaloneAreas
} from '@/controllers/areasController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);

// Validation schemas
const createAreaValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Area name must be between 2 and 100 characters'),
];

const updateAreaValidation = [
  param('id').trim().notEmpty().withMessage('Area ID is required'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Area name must be between 2 and 100 characters'),
  body('displayOrder')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Display order must be between 1 and 50'),
];

const listAreasValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('cityId')
    .optional()
    .trim(),
  query('state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State must be less than 100 characters'),
  query('country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country must be less than 100 characters'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['name', 'usageCount', 'createdAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

// Standalone areas route (must come before /:id route)
router.get('/standalone',
  getStandaloneAreas
);

// Core CRUD routes
router.get('/',
  listAreasValidation,
  validate,
  getAreas
);

router.post('/',
  createAreaValidation,
  validate,
  createArea
);

router.get('/:id',
  [param('id').trim().notEmpty().withMessage('Area ID is required')],
  validate,
  getAreaById
);

router.put('/:id', 
  updateAreaValidation, 
  validate, 
  updateArea
);

router.delete('/:id', 
  [param('id').trim().notEmpty().withMessage('Area ID is required')], 
  validate, 
  deleteArea
);

export default router;
