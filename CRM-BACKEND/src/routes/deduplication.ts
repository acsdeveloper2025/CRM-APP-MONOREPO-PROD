import { Router } from 'express';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
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

// POST /api/cases/deduplication/search - Search for potential duplicates
router.post('/search', authorize('case.create'), searchDuplicates);

// POST /api/cases/deduplication/decision - Record deduplication decision
router.post('/decision', authorize('case.update'), recordDeduplicationDecision);

// GET /api/cases/:caseId/deduplication/history - Get deduplication history for a case
router.get('/:caseId/history', getDeduplicationHistory);

// GET /api/cases/deduplication/clusters - Get duplicate case clusters for admin review
router.get('/clusters', getDuplicateClusters);

export default router;
