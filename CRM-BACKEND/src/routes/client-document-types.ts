import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { handleValidationErrors } from '../middleware/validation';
import { EnterpriseCache, CacheInvalidationPatterns } from '../middleware/enterpriseCache';
import {
  getDocumentTypesByClient,
  assignDocumentTypesToClient,
  removeDocumentTypeFromClient,
  updateClientDocumentTypeMapping,
} from '../controllers/clientDocumentTypesController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);
router.use(authorize('settings.manage'));

// Validation schemas
const assignDocumentTypesValidation = [
  param('id').isInt({ min: 1 }).withMessage('Client ID must be a positive integer'),
  body('documentTypeIds').isArray({ min: 1 }).withMessage('Document type IDs array is required'),
  body('documentTypeIds.*')
    .isInt({ min: 1 })
    .withMessage('Each document type ID must be a positive integer'),
  body('isRequired').optional().isBoolean().withMessage('isRequired must be a boolean'),
];

const updateMappingValidation = [
  param('clientId').isInt({ min: 1 }).withMessage('Client ID must be a positive integer'),
  param('documentTypeId')
    .isInt({ min: 1 })
    .withMessage('Document type ID must be a positive integer'),
  body('isRequired').optional().isBoolean().withMessage('isRequired must be a boolean'),
  body('priority')
    .optional()
    .isInt({ min: 0 })
    .withMessage('priority must be a non-negative integer'),
  body('clientSpecificRules')
    .optional()
    .isObject()
    .withMessage('clientSpecificRules must be an object'),
];

const getDocumentTypesValidation = [
  param('id').isInt({ min: 1 }).withMessage('Client ID must be a positive integer'),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const removeDocumentTypeValidation = [
  param('clientId').isInt({ min: 1 }).withMessage('Client ID must be a positive integer'),
  param('documentTypeId')
    .isInt({ min: 1 })
    .withMessage('Document type ID must be a positive integer'),
];

// Routes for client-document type mappings
// GET /api/clients/:id/document-types - Get document types for a client
router.get(
  '/:id/document-types',
  getDocumentTypesValidation,
  handleValidationErrors,
  getDocumentTypesByClient
);

// POST /api/clients/:id/document-types - Assign document types to a client
router.post(
  '/:id/document-types',
  EnterpriseCache.invalidate(CacheInvalidationPatterns.clientDocumentTypeUpdate),
  assignDocumentTypesValidation,
  handleValidationErrors,
  assignDocumentTypesToClient
);

// PUT /api/clients/:clientId/document-types/:documentTypeId - Update client document type mapping
router.put(
  '/:clientId/document-types/:documentTypeId',
  EnterpriseCache.invalidate(CacheInvalidationPatterns.clientDocumentTypeUpdate),
  updateMappingValidation,
  handleValidationErrors,
  updateClientDocumentTypeMapping
);

// DELETE /api/clients/:clientId/document-types/:documentTypeId - Remove document type from client
router.delete(
  '/:clientId/document-types/:documentTypeId',
  EnterpriseCache.invalidate(CacheInvalidationPatterns.clientDocumentTypeUpdate),
  removeDocumentTypeValidation,
  handleValidationErrors,
  removeDocumentTypeFromClient
);

export default router;
