import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { handleValidationErrors } from '../middleware/validation';
import {
  getDocumentTypes,
  getDocumentTypeById,
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
  getDocumentTypeStats,
  getDocumentTypeCategories,
} from '../controllers/documentTypesController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);
// Validation schemas
const createDocumentTypeValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),
  body('code')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Code must be between 2 and 50 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Code must contain only uppercase letters, numbers, and underscores'),
];

const updateDocumentTypeValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),
  body('code')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Code must be between 2 and 50 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Code must contain only uppercase letters, numbers, and underscores'),
];

const listDocumentTypesValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['name', 'code', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
];

// Core CRUD routes
router.get('/', listDocumentTypesValidation, handleValidationErrors, getDocumentTypes);

router.get('/stats', getDocumentTypeStats);
router.get('/categories', getDocumentTypeCategories);

router.post(
  '/',
  authorize('settings.manage'),
  createDocumentTypeValidation,
  handleValidationErrors,
  createDocumentType
);

router.get(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('Document type ID must be a positive integer')],
  handleValidationErrors,
  getDocumentTypeById
);

router.put(
  '/:id',
  authorize('settings.manage'),
  [param('id').isInt({ min: 1 }).withMessage('Document type ID must be a positive integer')],
  updateDocumentTypeValidation,
  handleValidationErrors,
  updateDocumentType
);

router.delete(
  '/:id',
  authorize('settings.manage'),
  [param('id').isInt({ min: 1 }).withMessage('Document type ID must be a positive integer')],
  handleValidationErrors,
  deleteDocumentType
);

export default router;
