import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import {
  getAreas,
  getAreaById,
  createArea,
  updateArea,
  deleteArea,
  getStandaloneAreas,
  getAreasByPincodes,
  getAreasStats,
  exportAreas,
} from '@/controllers/areasController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);

const createAreaValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Area name must be between 2 and 100 characters'),
];

const updateAreaValidation = [
  param('id').trim().notEmpty().withMessage('Area ID is required'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Area name must be between 2 and 100 characters'),
  body('displayOrder')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Display order must be between 1 and 50'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const listAreasValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Limit must be between 1 and 10000'),
  query('cityId').optional().trim(),
  query('pincodeId').optional(),
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
    .isIn(['name', 'usageCount', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('isActive')
    .optional()
    .isIn(['true', 'false', 'all'])
    .withMessage('isActive must be true, false, or all'),
  query('createdFrom').optional().isISO8601().withMessage('createdFrom must be ISO 8601 date'),
  query('createdTo').optional().isISO8601().withMessage('createdTo must be ISO 8601 date'),
];

// Standalone areas route (must come before /:id route)
router.get('/standalone', getStandaloneAreas);

// Batch fetch areas by pincodes (must come before /:id route)
router.get('/by-pincodes', getAreasByPincodes);

router.get('/stats', getAreasStats);

// /export MUST precede /:id (Express matches in declaration order).
router.get('/export', listAreasValidation, validate, exportAreas);

// Core CRUD routes
router.get('/', listAreasValidation, validate, getAreas);

router.post('/', authorize('settings.manage'), createAreaValidation, validate, createArea);

router.get(
  '/:id',
  [param('id').trim().notEmpty().withMessage('Area ID is required')],
  validate,
  getAreaById
);

router.put('/:id', authorize('settings.manage'), updateAreaValidation, validate, updateArea);

router.delete(
  '/:id',
  authorize('settings.manage'),
  [param('id').trim().notEmpty().withMessage('Area ID is required')],
  validate,
  deleteArea
);

export default router;
