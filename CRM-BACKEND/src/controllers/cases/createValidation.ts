import { body } from 'express-validator';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../../utils/logger';

/**
 * Phase re-audit follow-up: the `/create` endpoint accepts two
 * request shapes:
 *
 *   1. JSON payload:
 *      req.body = { caseDetails, verificationTasks, applicants?, kycDocuments? }
 *
 *   2. Multipart FormData with file uploads:
 *      req.body.data = "<JSON string>"
 *      (plus multer-parsed files on req.files)
 *
 * Express-validator chains bind to `req.body.*` paths, so they can
 * only validate shape #1 natively. This middleware normalizes shape
 * #2 into shape #1 by JSON-parsing `req.body.data` over the top of
 * `req.body`, after which every downstream validator + the case-
 * creation scope check + the handler itself all see the same
 * unified structure.
 *
 * Idempotent: if `req.body.data` is missing or not a string the
 * middleware is a no-op, so JSON clients pay nothing.
 *
 * Returns 400 on parse failure so a malformed FormData payload is
 * rejected with a clear error instead of exploding inside the
 * handler's later JSON.parse call.
 */
export const normalizeCaseCreationBody = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const data = (req.body as Record<string, unknown> | undefined)?.data;
  if (typeof data !== 'string' || data.length === 0) {
    return next();
  }
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    // Preserve any non-data fields that multer populated on req.body
    // (none today, but forward-compat). Spread parsed last so it
    // wins on name collisions.
    req.body = { ...(req.body as Record<string, unknown>), ...parsed };
    // Drop the raw JSON string once we've hoisted its contents so
    // the rest of the stack doesn't see both representations.
    delete (req.body as Record<string, unknown>).data;
    return next();
  } catch (parseError) {
    logger.warn('createCase body normalization failed', {
      error: parseError instanceof Error ? parseError.message : String(parseError),
    });
    return res.status(400).json({
      success: false,
      message: 'Invalid multipart "data" field: expected JSON',
      error: { code: 'INVALID_JSON' },
    });
  }
};

/**
 * Express-validator chain for POST /api/cases/create.
 *
 * Historical note: a prior `createCaseValidation` chain existed on
 * this route before the Oct 2025 consolidation that unified three
 * creation endpoints into `/create`. That chain validated a flat
 * top-level shape (`body('customerName')`, `body('clientId')`, ...)
 * which the new unified endpoint no longer accepts — the body is now
 * nested under `caseDetails` / `verificationTasks` / `applicants`.
 * The old chain was deleted from the route but left in the file as
 * `_createCaseValidation` to silence the no-unused-vars lint, with
 * no comment explaining why.
 *
 * This replacement chain targets the ACTUAL shape. It runs after
 * `normalizeCaseCreationBody` so it sees the same body structure for
 * JSON and FormData requests.
 */
export const createCaseValidation = [
  body('caseDetails')
    .exists({ checkNull: true })
    .withMessage('caseDetails object is required')
    .bail()
    .isObject()
    .withMessage('caseDetails must be an object'),
  body('caseDetails.customerName')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('caseDetails.customerName must be between 1 and 200 characters'),
  body('caseDetails.clientId')
    .toInt()
    .isInt({ min: 1 })
    .withMessage('caseDetails.clientId must be a positive integer'),
  body('caseDetails.productId')
    .toInt()
    .isInt({ min: 1 })
    .withMessage('caseDetails.productId must be a positive integer'),
  body('caseDetails.priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('caseDetails.priority must be LOW, MEDIUM, HIGH, or URGENT'),
  body('caseDetails.customerPhone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 5, max: 20 })
    .withMessage('caseDetails.customerPhone must be 5–20 characters if provided'),
  body('caseDetails.pincode')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 3, max: 10 })
    .withMessage('caseDetails.pincode must be 3–10 characters if provided'),

  // #3 fix: verificationTasks was required min:1 which blocked
  // KYC-only cases (they send []). The "at least one task overall"
  // rule is enforced in the handler (fieldTaskCount +
  // kycDocumentCount >= 1), so the validator only needs to check
  // the array shape + per-element fields when elements exist.
  body('verificationTasks')
    .isArray({ max: 50 })
    .withMessage('verificationTasks must be an array with at most 50 entries'),
  body('verificationTasks.*.verificationTypeId')
    .toInt()
    .isInt({ min: 1 })
    .withMessage('verificationTasks[].verificationTypeId must be a positive integer'),
  body('verificationTasks.*.trigger')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('verificationTasks[].trigger is required (1–500 characters)'),
  body('verificationTasks.*.address')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('verificationTasks[].address is required (1–500 characters)'),
  body('verificationTasks.*.assignedTo')
    .isString()
    .isLength({ min: 1, max: 128 })
    .withMessage('verificationTasks[].assignedTo is required'),
  body('verificationTasks.*.priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('verificationTasks[].priority must be LOW, MEDIUM, HIGH, or URGENT'),
  body('verificationTasks.*.rateTypeId')
    .optional({ checkFalsy: true })
    .toInt()
    .isInt({ min: 1 })
    .withMessage('verificationTasks[].rateTypeId must be a positive integer if provided'),
  body('verificationTasks.*.areaId')
    .optional({ checkFalsy: true })
    .toInt()
    .isInt({ min: 1 })
    .withMessage('verificationTasks[].areaId must be a positive integer if provided'),
  body('verificationTasks.*.pincode')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 3, max: 10 })
    .withMessage('verificationTasks[].pincode must be 3–10 characters if provided'),

  body('applicants')
    .optional()
    .isArray({ max: 50 })
    .withMessage('applicants must be an array with at most 50 entries'),
  body('applicants.*.name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('applicants[].name must be 1–200 characters'),
  body('applicants.*.mobile')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 5, max: 20 })
    .withMessage('applicants[].mobile must be 5–20 characters if provided'),

  body('kycDocuments')
    .optional()
    .isArray({ max: 50 })
    .withMessage('kycDocuments must be an array with at most 50 entries'),
];
