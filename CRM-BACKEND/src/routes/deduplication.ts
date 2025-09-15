import { Router } from 'express';
import { authenticateToken } from '@/middleware/auth';
import {
  searchDuplicates,
  recordDeduplicationDecision,
  getDeduplicationHistory,
  getDuplicateClusters
} from '@/controllers/deduplicationController';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// POST /api/cases/deduplication/search - Search for potential duplicates
router.post('/search', searchDuplicates);

// POST /api/cases/deduplication/decision - Record deduplication decision
router.post('/decision', recordDeduplicationDecision);

// GET /api/cases/:caseId/deduplication/history - Get deduplication history for a case
router.get('/:caseId/history', getDeduplicationHistory);

// GET /api/cases/deduplication/clusters - Get duplicate case clusters for admin review
router.get('/clusters', getDuplicateClusters);

export default router;
