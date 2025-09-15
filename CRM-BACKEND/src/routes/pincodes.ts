import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import {
  getPincodes,
  getPincodeById,
  createPincode,
  updatePincode,
  deletePincode,
  searchPincodes,
  bulkImportPincodes,
  getPincodesByCity,
  getPincodeAreas,
  addPincodeAreas,
  removePincodeArea
} from '@/controllers/pincodesController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);

// Validation schemas
const createPincodeValidation = [
  body('code')
    .trim()
    .isLength({ min: 4, max: 10 })
    .withMessage('Pincode must be between 4 and 10 characters')
    .matches(/^[0-9]+$/)
    .withMessage('Pincode must contain only numbers'),
  body('area')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Area name must be between 2 and 100 characters'),
  body('areas')
    .optional()
    .isArray({ min: 1, max: 15 })
    .withMessage('Areas must be an array with 1-15 area IDs'),
  body('areas.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each area must be a valid positive integer'),
  body('cityId')
    .notEmpty()
    .withMessage('City ID is required'),
  body('cityName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('City name must be less than 100 characters'),
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
  body('district')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('District must be less than 100 characters'),
  body('region')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Region must be less than 100 characters'),
  body('coordinates.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('coordinates.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('deliveryStatus')
    .optional()
    .isIn(['DELIVERY', 'NON_DELIVERY', 'SUB_OFFICE', 'HEAD_OFFICE'])
    .withMessage('Invalid delivery status'),
  body('officeType')
    .optional()
    .isIn(['Head Office', 'Sub Office', 'Branch Office'])
    .withMessage('Invalid office type'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const updatePincodeValidation = [
  body('code')
    .optional()
    .trim()
    .isLength({ min: 4, max: 10 })
    .withMessage('Pincode must be between 4 and 10 characters')
    .matches(/^[0-9]+$/)
    .withMessage('Pincode must contain only numbers'),
  body('area')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Area name must be between 1 and 200 characters'),
  body('cityId')
    .optional()
    .notEmpty()
    .withMessage('City ID must not be empty'),
  body('cityName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('City name must be less than 100 characters'),
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
  body('district')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('District must be less than 100 characters'),
  body('region')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Region must be less than 100 characters'),
  body('coordinates.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('coordinates.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('deliveryStatus')
    .optional()
    .isIn(['DELIVERY', 'NON_DELIVERY', 'SUB_OFFICE', 'HEAD_OFFICE'])
    .withMessage('Invalid delivery status'),
  body('officeType')
    .optional()
    .isIn(['Head Office', 'Sub Office', 'Branch Office'])
    .withMessage('Invalid office type'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const listPincodesValidation = [
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
    .trim()
    .notEmpty()
    .withMessage('City ID must not be empty'),
  query('state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State must be less than 100 characters'),
  query('district')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('District must be less than 100 characters'),
  query('region')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Region must be less than 100 characters'),
  query('deliveryStatus')
    .optional()
    .isIn(['DELIVERY', 'NON_DELIVERY', 'SUB_OFFICE', 'HEAD_OFFICE'])
    .withMessage('Invalid delivery status'),
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
    .isIn(['code', 'area', 'cityName', 'state', 'district', 'createdAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

const searchValidation = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
];

const bulkImportValidation = [
  body('pincodes')
    .isArray({ min: 1 })
    .withMessage('Pincodes array is required'),
  body('pincodes.*.code')
    .trim()
    .isLength({ min: 4, max: 10 })
    .withMessage('Pincode is required and must be between 4 and 10 characters'),
  body('pincodes.*.area')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Area name is required and must be less than 200 characters'),
  body('pincodes.*.cityName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('City name is required and must be less than 100 characters'),
  body('pincodes.*.state')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('State is required and must be less than 100 characters'),
];

// Core CRUD routes
router.get('/', 
  listPincodesValidation, 
  validate, 
  getPincodes
);

router.get('/search', 
  searchValidation, 
  validate, 
  searchPincodes
);

router.post('/', 
  createPincodeValidation, 
  validate, 
  createPincode
);

router.post('/bulk-import', 
  bulkImportValidation, 
  validate, 
  bulkImportPincodes
);

router.get('/:id', 
  [param('id').trim().notEmpty().withMessage('Pincode ID is required')], 
  validate, 
  getPincodeById
);

router.put('/:id', 
  [param('id').trim().notEmpty().withMessage('Pincode ID is required')], 
  updatePincodeValidation, 
  validate, 
  updatePincode
);

router.delete('/:id',
  [param('id').trim().notEmpty().withMessage('Pincode ID is required')],
  validate,
  deletePincode
);

// Area management validation schemas
const addAreasValidation = [
  param('id').trim().notEmpty().withMessage('Pincode ID is required'),
  body('areaIds')
    .isArray({ min: 1, max: 15 })
    .withMessage('Area IDs array is required (1-15 areas)'),
  body('areaIds.*')
    .isInt({ min: 1 })
    .withMessage('Each area ID must be a valid positive integer'),
];

// GET /api/pincodes/:id/areas - Get areas for a pincode
router.get('/:id/areas',
  [param('id').trim().notEmpty().withMessage('Pincode ID is required')],
  validate,
  getPincodeAreas
);

// POST /api/pincodes/:id/areas - Add areas to a pincode
router.post('/:id/areas',
  addAreasValidation,
  validate,
  addPincodeAreas
);

// DELETE /api/pincodes/:id/areas/:areaId - Remove area from pincode
router.delete('/:id/areas/:areaId',
  [
    param('id').trim().notEmpty().withMessage('Pincode ID is required'),
    param('areaId').isInt({ min: 1 }).withMessage('Area ID must be a valid positive integer')
  ],
  validate,
  removePincodeArea
);

export default router;
