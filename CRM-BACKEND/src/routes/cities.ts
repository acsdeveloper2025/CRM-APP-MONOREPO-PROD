import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import { upload } from '@/middleware/upload';
import {
  getCities,
  getCityById,
  createCity,
  updateCity,
  deleteCity,
  getCitiesStats,
  bulkImportCities,
  exportCities,
} from '@/controllers/citiesController';
import * as PincodesController from '../controllers/pincodesController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);
// Validation schemas
const createCityValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('City name must be between 1 and 100 characters'),
  body('state')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('State is required and must be less than 100 characters'),
  body('country')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Country is required and must be less than 100 characters'),
];

const updateCityValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('City name must be between 1 and 100 characters'),
  body('state')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('State must be less than 100 characters'),
  body('country')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Country must be less than 100 characters'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const listCitiesValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
  query('state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State must be less than 100 characters'),
  query('stateId').optional(),
  query('country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country must be less than 100 characters'),
  query('isActive')
    .optional()
    .isIn(['true', 'false', 'all'])
    .withMessage('isActive must be true, false, or all'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['name', 'state', 'country', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('createdFrom').optional().isISO8601().withMessage('createdFrom must be ISO 8601 date'),
  query('createdTo').optional().isISO8601().withMessage('createdTo must be ISO 8601 date'),
];

// Core CRUD routes
router.get('/', listCitiesValidation, validate, getCities);

router.get('/stats', getCitiesStats);

// /export MUST precede /:id (Express matches in declaration order).
router.get('/export', listCitiesValidation, validate, exportCities);

router.post('/', authorize('settings.manage'), createCityValidation, validate, createCity);

router.post('/bulk-import', authorize('settings.manage'), upload.single('file'), bulkImportCities);

router.get(
  '/:id',
  [param('id').trim().notEmpty().withMessage('City ID is required')],
  validate,
  getCityById
);

router.put(
  '/:id',
  authorize('settings.manage'),
  [param('id').trim().notEmpty().withMessage('City ID is required')],
  updateCityValidation,
  validate,
  updateCity
);

router.delete(
  '/:id',
  authorize('settings.manage'),
  [param('id').trim().notEmpty().withMessage('City ID is required')],
  validate,
  deleteCity
);

router.get(
  '/:id/pincodes',
  [
    param('id').trim().notEmpty().withMessage('City ID is required'),
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage('Limit must be between 1 and 500'),
  ],
  validate,
  PincodesController.getPincodesByCity
);

export default router;
