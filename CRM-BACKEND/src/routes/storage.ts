import express from 'express';
import { authenticateToken } from '@/middleware/auth';
import { streamStorageObject } from '@/controllers/storageController';

const router = express.Router();

router.use(authenticateToken);

// Wildcard match — captures everything after /api/storage/
// e.g. /api/storage/attachments/case_42/123.pdf  →  req.params[0] = 'attachments/case_42/123.pdf'
router.get(/^\/(.+)/, streamStorageObject);

export default router;
