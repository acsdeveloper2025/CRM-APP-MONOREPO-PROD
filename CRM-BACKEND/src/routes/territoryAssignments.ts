import express from 'express';
import { body, query, param } from 'express-validator';
import { authenticateToken, requirePermission } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import {
  getFieldAgentTerritories,
  getFieldAgentTerritoryById,
  assignPincodesToFieldAgent,
  assignAreasToFieldAgent,
  removePincodeAssignment,
  removeAreaAssignment,
  removeAllTerritoryAssignments,
  addSinglePincodeAssignment
} from '@/controllers/territoryAssignmentsController';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation schemas
const listFieldAgentsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  query('pincodeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Pincode ID must be a positive integer'),
  query('cityId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('City ID must be a positive integer'),
  query('isActive')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isActive must be true or false'),
  query('sortBy')
    .optional()
    .isIn(['userName', 'username', 'employeeId'])
    .withMessage('sortBy must be one of: userName, username, employeeId'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

const assignPincodesValidation = [
  param('userId')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  body('pincodeIds')
    .isArray({ max: 50 })
    .withMessage('pincodeIds must be an array with maximum 50 pincode IDs'),
  body('pincodeIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each pincode ID must be a positive integer'),
];

const assignAreasValidation = [
  param('userId')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  body('assignments')
    .isArray({ max: 20 })
    .withMessage('assignments must be an array with maximum 20 assignments'),
  body('assignments.*.pincodeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each assignment must have a valid pincode ID'),
  body('assignments.*.areaIds')
    .optional()
    .isArray({ max: 50 })
    .withMessage('Each assignment must have maximum 50 area IDs'),
  body('assignments.*.areaIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each area ID must be a positive integer'),
];

const removeAssignmentValidation = [
  param('userId')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  param('pincodeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Pincode ID must be a positive integer'),
  param('areaId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Area ID must be a positive integer'),
];

// Routes

// GET /api/territory-assignments/field-agents - List all field agents with their territory assignments
router.get('/field-agents',
  requirePermission('users', 'read'), // Use existing permission
  listFieldAgentsValidation,
  validate,
  getFieldAgentTerritories
);

// GET /api/territory-assignments/field-agents/:userId - Get specific field agent's territory assignments
router.get('/field-agents/:userId',
  requirePermission('users', 'read'),
  [param('userId').isUUID().withMessage('User ID must be a valid UUID')],
  validate,
  getFieldAgentTerritoryById
);

// POST /api/territory-assignments/field-agents/:userId/pincodes - Assign pincodes to field agent
router.post('/field-agents/:userId/pincodes',
  requirePermission('users', 'update'),
  assignPincodesValidation,
  validate,
  assignPincodesToFieldAgent
);

// POST /api/territory-assignments/field-agents/:userId/areas - Assign areas within pincodes to field agent
router.post('/field-agents/:userId/areas',
  requirePermission('users', 'update'),
  assignAreasValidation,
  validate,
  assignAreasToFieldAgent
);

// POST /api/territory-assignments/field-agents/:userId/add-pincode - Add single pincode with areas (incremental)
router.post('/field-agents/:userId/add-pincode',
  requirePermission('users', 'update'),
  [
    param('userId').isUUID().withMessage('User ID must be a valid UUID'),
    body('pincodeId').isInt({ min: 1 }).withMessage('Pincode ID must be a positive integer'),
    body('areaIds').optional().isArray().withMessage('Area IDs must be an array'),
    body('areaIds.*').optional().isInt({ min: 1 }).withMessage('Each area ID must be a positive integer')
  ],
  validate,
  addSinglePincodeAssignment
);

// DELETE /api/territory-assignments/field-agents/:userId/pincodes/:pincodeId - Remove pincode assignment
router.delete('/field-agents/:userId/pincodes/:pincodeId',
  requirePermission('users', 'delete'),
  [
    param('userId').isUUID().withMessage('User ID must be a valid UUID'),
    param('pincodeId').isInt({ min: 1 }).withMessage('Pincode ID must be a positive integer')
  ],
  validate,
  removePincodeAssignment
);

// DELETE /api/territory-assignments/field-agents/:userId/areas/:areaId - Remove area assignment
router.delete('/field-agents/:userId/areas/:areaId',
  requirePermission('users', 'delete'),
  [
    param('userId').isUUID().withMessage('User ID must be a valid UUID'),
    param('areaId').isInt({ min: 1 }).withMessage('Area ID must be a positive integer'),
    query('pincodeId').isInt({ min: 1 }).withMessage('Pincode ID query parameter is required')
  ],
  validate,
  removeAreaAssignment
);

// DELETE /api/territory-assignments/field-agents/:userId/all - Remove all territory assignments
router.delete('/field-agents/:userId/all',
  requirePermission('users', 'delete'),
  [param('userId').isUUID().withMessage('User ID must be a valid UUID')],
  validate,
  removeAllTerritoryAssignments
);

export default router;
