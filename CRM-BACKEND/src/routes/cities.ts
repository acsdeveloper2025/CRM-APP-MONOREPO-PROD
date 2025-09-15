import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import {
  getCities,
  getCityById,
  createCity,
  updateCity,
  deleteCity,
  getCitiesStats
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
];

const listCitiesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
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
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['name', 'state', 'country', 'code', 'population', 'area', 'createdAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

// Core CRUD routes
router.get('/', 
  listCitiesValidation, 
  validate, 
  getCities
);

router.get('/stats', getCitiesStats);

router.post('/',
  createCityValidation,
  validate,
  createCity
);

router.get('/:id', 
  [param('id').trim().notEmpty().withMessage('City ID is required')], 
  validate, 
  getCityById
);

router.put('/:id', 
  [param('id').trim().notEmpty().withMessage('City ID is required')], 
  updateCityValidation, 
  validate, 
  updateCity
);

router.delete('/:id', 
  [param('id').trim().notEmpty().withMessage('City ID is required')], 
  validate, 
  deleteCity
);

router.get('/:id/pincodes', 
  [
    param('id').trim().notEmpty().withMessage('City ID is required'),
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ], 
  validate, 
  PincodesController.getPincodesByCity
);

export default router;
