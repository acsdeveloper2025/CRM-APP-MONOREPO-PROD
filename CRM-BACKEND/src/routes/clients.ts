import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import { addClientFiltering } from '@/middleware/clientAccess';
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientProducts,
  getClientVerificationTypes
} from '@/controllers/clientsController';
import { getProductsByClient } from '@/controllers/productsController';

const router = express.Router();

// Validation rules
const createClientValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Client name must be between 1 and 100 characters'),
  body('code')
    .trim()
    .isLength({ min: 2, max: 10 })
    .withMessage('Client code must be between 2 and 10 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Client code must contain only uppercase letters, numbers, and underscores'),
  body('productIds')
    .optional()
    .isArray()
    .withMessage('productIds must be an array of IDs'),
  body('productIds.*')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Each productId must be a non-empty string'),
  body('verificationTypeIds')
    .optional()
    .isArray()
    .withMessage('verificationTypeIds must be an array of IDs'),
  body('verificationTypeIds.*')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Each verificationTypeId must be a non-empty string'),
];

const updateClientValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Client name must be between 1 and 100 characters'),
  body('code')
    .optional()
    .trim()
    .isLength({ min: 2, max: 10 })
    .withMessage('Client code must be between 2 and 10 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Client code must contain only uppercase letters, numbers, and underscores'),
  body('productIds')
    .optional()
    .isArray()
    .withMessage('productIds must be an array of IDs'),
  body('productIds.*')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Each productId must be a non-empty string'),
  body('verificationTypeIds')
    .optional()
    .isArray()
    .withMessage('verificationTypeIds must be an array of IDs'),
  body('verificationTypeIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each verificationTypeId must be a positive integer'),
];

// GET /api/clients - Get all clients
router.get('/',
  authenticateToken,
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().trim().isLength({ max: 100 }).withMessage('Search term too long'),
  ]),
  addClientFiltering,
  getClients
);

// GET /api/clients/:id - Get client by ID
router.get('/:id',
  authenticateToken,
  validate([
    param('id').isInt({ min: 1 }).withMessage('Client ID must be a positive integer'),
  ]),
  getClientById
);

// GET /api/clients/:id/verification-types - Get verification types by client
router.get('/:id/verification-types',
  authenticateToken,
  validate([
    param('id').isInt({ min: 1 }).withMessage('Client ID must be a positive integer'),
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
  ]),
  getClientVerificationTypes
);

// POST /api/clients - Create new client
router.post('/',
  authenticateToken,
  validate(createClientValidation),
  createClient
);

// PUT /api/clients/:id - Update client
router.put('/:id',
  authenticateToken,
  validate([
    param('id').trim().notEmpty().withMessage('Client ID is required'),
    ...updateClientValidation,
  ]),
  updateClient
);

// DELETE /api/clients/:id - Delete client
router.delete('/:id',
  authenticateToken,
  validate([
    param('id').trim().notEmpty().withMessage('Client ID is required'),
  ]),
  deleteClient
);

// GET /api/clients/:id/products - Get products by client
router.get('/:id/products',
  authenticateToken,
  validate([
    param('id').trim().notEmpty().withMessage('Client ID is required'),
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
  ]),
  getClientProducts
);

export default router;
