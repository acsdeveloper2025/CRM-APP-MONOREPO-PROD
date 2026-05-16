// G-HIGH-3 (AUDIT 2026-05-17): admin routes for reverse-geocode DLQ.
//
// Mounted at /api/reverse-geocode-dlq via app.ts. Requires
// `settings.manage` permission (same gate as audit-logs + departments).

import express from 'express';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import {
  listReverseGeocodeDlq,
  replayReverseGeocodeDlqEntry,
} from '@/controllers/reverseGeocodeDlqController';

const router = express.Router();

router.use(authenticateToken);
router.use(authorize('settings.manage'));

router.get('/', listReverseGeocodeDlq);
router.post('/:id/replay', replayReverseGeocodeDlqEntry);

export default router;
