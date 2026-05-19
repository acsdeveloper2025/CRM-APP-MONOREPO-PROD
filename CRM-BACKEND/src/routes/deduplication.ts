import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import {
  searchDuplicates,
  recordDeduplicationDecision,
  getDeduplicationHistory,
  getDuplicateClusters,
} from '@/controllers/deduplicationController';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(authorize('case.view'));

// T1-5 (audit 2026-05-17): validator chains. searchDuplicates +
// recordDeduplicationDecision reach into req.body without prior
// shape checks; clusters + history use page/limit query coercion
// that previously accepted negative / NaN. Reject at the edge.

// POST /api/cases/deduplication/search - Search for potential duplicates
router.post(
  '/search',
  authorize('case.create'),
  validate([
    body('mobile').optional({ values: 'falsy' }).isString().isLength({ max: 20 }),
    body('pan').optional({ values: 'falsy' }).isString().isLength({ max: 20 }),
    body('name').optional({ values: 'falsy' }).isString().isLength({ max: 200 }),
    body('address').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be 1..500'),
  ]),
  searchDuplicates
);

// POST /api/cases/deduplication/decision - Record deduplication decision
router.post(
  '/decision',
  authorize('case.update'),
  validate([
    body('decision').isString().notEmpty().withMessage('decision is required'),
    body('duplicatesFound').optional().isArray(),
    body('searchCriteria').optional().isObject(),
  ]),
  recordDeduplicationDecision
);

// GET /api/cases/:caseId/deduplication/history - Get deduplication history for a case
router.get(
  '/:caseId/history',
  validate([param('caseId').isUUID().withMessage('caseId must be a UUID')]),
  getDeduplicationHistory
);

// GET /api/cases/deduplication/clusters - Get duplicate case clusters for admin review
router.get(
  '/clusters',
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be 1..500'),
  ]),
  getDuplicateClusters
);

export default router;
