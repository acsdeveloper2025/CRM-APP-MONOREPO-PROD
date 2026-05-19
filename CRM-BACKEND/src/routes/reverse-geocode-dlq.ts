// G-HIGH-3 (AUDIT 2026-05-17): admin routes for reverse-geocode DLQ.
//
// Mounted at /api/reverse-geocode-dlq via app.ts. Requires
// `settings.manage` permission (same gate as audit-logs + departments).

import express from 'express';
import { param, query } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validation';
import {
  listReverseGeocodeDlq,
  replayReverseGeocodeDlqEntry,
} from '@/controllers/reverseGeocodeDlqController';

const router = express.Router();

router.use(authenticateToken);
router.use(authorize('settings.manage'));

// T1-5 (audit 2026-05-17): validator chains.
router.get(
  '/',
  validate([
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be 1..500'),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
    query('includeReplayed').optional().isIn(['true', 'false']),
  ]),
  listReverseGeocodeDlq
);

router.post(
  '/:id/replay',
  validate([param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')]),
  replayReverseGeocodeDlqEntry
);

export default router;
