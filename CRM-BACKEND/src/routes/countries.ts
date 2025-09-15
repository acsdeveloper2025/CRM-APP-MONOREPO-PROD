import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { handleValidationErrors } from '@/middleware/validation';
import {
  getCountries,
  getCountryById,
  createCountry,
  updateCountry,
  deleteCountry,
  getCountriesStats,
  bulkImportCountries
} from '@/controllers/countriesController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);

// Validation schemas
const listCountriesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('continent')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Continent must be between 1 and 50 characters'),
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
    .isIn(['name', 'code', 'continent', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
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
    .withMessage('Invalid continent. Must be one of: Africa, Antarctica, Asia, Europe, North America, Oceania, South America'),
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
    .withMessage('Invalid continent. Must be one of: Africa, Antarctica, Asia, Europe, North America, Oceania, South America'),
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
  listCountriesValidation, 
  handleValidationErrors, 
  getCountries
);

router.get('/stats', getCountriesStats);

router.post('/', 
  createCountryValidation, 
  handleValidationErrors, 
  createCountry
);

router.post('/bulk-import', 
  bulkImportValidation, 
  handleValidationErrors, 
  bulkImportCountries
);

router.get('/:id', 
  [param('id').trim().notEmpty().withMessage('Country ID is required')], 
  handleValidationErrors, 
  getCountryById
);

router.put('/:id', 
  [param('id').trim().notEmpty().withMessage('Country ID is required')], 
  updateCountryValidation, 
  handleValidationErrors, 
  updateCountry
);

router.delete('/:id', 
  [param('id').trim().notEmpty().withMessage('Country ID is required')], 
  handleValidationErrors, 
  deleteCountry
);

export default router;
