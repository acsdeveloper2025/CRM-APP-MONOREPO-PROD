import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { handleValidationErrors } from '@/middleware/validation';
import { upload } from '@/middleware/upload';
import {
  getCountries,
  getCountryById,
  createCountry,
  updateCountry,
  deleteCountry,
  getCountriesStats,
  bulkImportCountries,
  exportCountries,
} from '@/controllers/countriesController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);
// Validation schemas
const listCountriesValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
  query('continent')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Continent must be between 1 and 50 characters'),
  query('search')
    .optional()
    .trim()
    .custom(value => {
      if (value === '' || value === undefined || value === null) {
        return true;
      }
      return value.length >= 1 && value.length <= 100;
    })
    .withMessage('Search term must be between 1 and 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['name', 'code', 'continent', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('isActive')
    .optional()
    .isIn(['true', 'false', 'all'])
    .withMessage('isActive must be true, false, or all'),
  query('createdFrom').optional().isISO8601().withMessage('createdFrom must be ISO 8601 date'),
  query('createdTo').optional().isISO8601().withMessage('createdTo must be ISO 8601 date'),
];

const createCountryValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Country name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Country name must be between 1 and 100 characters'),
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Country code is required')
    .isLength({ min: 2, max: 3 })
    .withMessage('Country code must be 2-3 characters (ISO standard)')
    .matches(/^[A-Z]{2,3}$/)
    .withMessage('Country code must be uppercase letters only (ISO format)'),
  body('continent')
    .trim()
    .notEmpty()
    .withMessage('Continent is required')
    .isIn(['Africa', 'Antarctica', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'])
    .withMessage(
      'Invalid continent. Must be one of: Africa, Antarctica, Asia, Europe, North America, Oceania, South America'
    ),
];

const updateCountryValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Country name must be between 1 and 100 characters'),
  body('code')
    .optional()
    .trim()
    .isLength({ min: 2, max: 3 })
    .withMessage('Country code must be 2-3 characters (ISO standard)')
    .matches(/^[A-Z]{2,3}$/)
    .withMessage('Country code must be uppercase letters only (ISO format)'),
  body('continent')
    .optional()
    .trim()
    .isIn(['Africa', 'Antarctica', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'])
    .withMessage(
      'Invalid continent. Must be one of: Africa, Antarctica, Asia, Europe, North America, Oceania, South America'
    ),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const _bulkImportValidation = [
  // File validation would be handled by multer middleware
  body('overwrite').optional().isBoolean().withMessage('Overwrite must be a boolean'),
];

// Core CRUD routes
router.get('/', listCountriesValidation, handleValidationErrors, getCountries);

router.get('/stats', getCountriesStats);

// /export MUST precede /:id (Express matches in declaration order).
router.get('/export', listCountriesValidation, handleValidationErrors, exportCountries);

router.post(
  '/',
  authorize('settings.manage'),
  createCountryValidation,
  handleValidationErrors,
  createCountry
);

router.post(
  '/bulk-import',
  authorize('settings.manage'),
  upload.single('file'),
  bulkImportCountries
);

router.get(
  '/:id',
  [param('id').trim().notEmpty().withMessage('Country ID is required')],
  handleValidationErrors,
  getCountryById
);

router.put(
  '/:id',
  authorize('settings.manage'),
  [param('id').trim().notEmpty().withMessage('Country ID is required')],
  updateCountryValidation,
  handleValidationErrors,
  updateCountry
);

router.delete(
  '/:id',
  authorize('settings.manage'),
  [param('id').trim().notEmpty().withMessage('Country ID is required')],
  handleValidationErrors,
  deleteCountry
);

export default router;
