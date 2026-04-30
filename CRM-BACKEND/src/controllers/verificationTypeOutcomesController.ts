/**
 * F2.7.1 — exposes the verification_type_outcomes lookup table to clients
 * (web frontend, mobile sync). Read-only by design; admin edits go through
 * a separate admin endpoint (TBD when the management UI lands).
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getAllOutcomes } from '../services/verificationTypeOutcomesService';

/**
 * GET /api/verification-type-outcomes
 *
 * Response:
 *   { success: true, data: [{ id, verificationTypeId, verificationTypeCode,
 *                              outcomeCode, displayLabel, sortOrder, isActive }] }
 */
export async function listVerificationTypeOutcomes(
  _req: AuthenticatedRequest,
  res: Response
) {
  try {
    const outcomes = await getAllOutcomes();
    return res.json({
      success: true,
      data: outcomes,
    });
  } catch (error) {
    logger.error('Failed to list verification type outcomes', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch verification type outcomes',
      error: { code: 'INTERNAL_ERROR', timestamp: new Date().toISOString() },
    });
  }
}
