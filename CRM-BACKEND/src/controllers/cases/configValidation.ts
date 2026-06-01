import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { query as dbQuery } from '../../config/database';
import {
  financialConfigurationValidator,
  FinancialConfigErrorCode,
} from '@/services/financialConfigurationValidator';
import { requireControllerPermission } from '@/security/controllerAuthorization';

/**
 * POST /api/cases/config-validation — pre-create financial config check.
 * Resolves pincode/area, then asks financialConfigurationValidator whether a
 * billable rate rule + amount exist for (client, product, vt, pincode, area,
 * rateType). Extracted verbatim from casesController as part of the §7
 * decomposition; behaviour pinned by casesWritePath.integration.test.ts.
 */
export const validateCaseConfiguration = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!requireControllerPermission(req, res, 'case.create')) {
      return;
    }

    const clientId = Number(req.body.clientId);
    const productId = Number(req.body.productId);
    const verificationTypeId = Number(req.body.verificationTypeId);
    const areaId = Number(req.body.areaId);
    const preferredRateTypeId = req.body.rateTypeId ? Number(req.body.rateTypeId) : null;

    let resolvedPincodeId = req.body.pincodeId ? Number(req.body.pincodeId) : null;
    let resolvedPincodeCode =
      typeof req.body.pincode === 'string' && req.body.pincode.trim().length > 0
        ? req.body.pincode.trim()
        : null;

    if (!resolvedPincodeId && !resolvedPincodeCode) {
      return res.status(400).json({
        success: false,
        message: 'Pincode is required',
        error: { code: 'PINCODE_REQUIRED' },
      });
    }

    if (!resolvedPincodeId && resolvedPincodeCode) {
      const pincodeLookup = await dbQuery(`SELECT id, code FROM pincodes WHERE code = $1 LIMIT 1`, [
        resolvedPincodeCode,
      ]);

      if (!pincodeLookup.rows[0]) {
        return res.status(400).json({
          success: false,
          message: 'Selected pincode not found',
          error: { code: 'PINCODE_NOT_FOUND' },
        });
      }

      resolvedPincodeId = Number(pincodeLookup.rows[0].id);
      resolvedPincodeCode = pincodeLookup.rows[0].code;
    } else if (resolvedPincodeId && !resolvedPincodeCode) {
      const pincodeLookup = await dbQuery(`SELECT id, code FROM pincodes WHERE id = $1 LIMIT 1`, [
        resolvedPincodeId,
      ]);

      if (!pincodeLookup.rows[0]) {
        return res.status(400).json({
          success: false,
          message: 'Selected pincode not found',
          error: { code: 'PINCODE_NOT_FOUND' },
        });
      }

      resolvedPincodeCode = pincodeLookup.rows[0].code;
    }

    const areaValidation = await dbQuery(
      `SELECT 1
       FROM pincode_areas
       WHERE area_id = $1 AND pincode_id = $2
       LIMIT 1`,
      [areaId, resolvedPincodeId]
    );

    if (!areaValidation.rows[0]) {
      return res.status(400).json({
        success: false,
        message: 'Selected area is not mapped to the selected pincode',
        error: { code: 'AREA_PINCODE_MISMATCH' },
      });
    }

    // Bug B-3 (audit 2026-05-10): the redundant VT-blind `mappedRateTypeId`
    // SQL was DELETED. With Phase 2's 9 SZR rows per (c,p,pin,area) — one per
    // VT — that VT-blind LIMIT 1 returned a non-deterministic row, often from
    // a different VT than the one being previewed. The validator below is the
    // VT-aware source of truth (Phase 3 made `validateRateTypeRule` use VT in
    // its WHERE clause). Use validator's result for both `rateTypeId` and
    // `rateTypeRuleFound` (derived from errorCode).

    // resolvedPincodeId is guaranteed non-null by the validation block above:
    // either pincodeId/pincode supplied (else early 400), or one of the
    // dbQuery branches assigned a number, or we returned early. The control
    // flow analysis can't see all branches, so narrow with a runtime check
    // (defensive — should not be reachable).
    if (resolvedPincodeId == null) {
      return res.status(400).json({
        success: false,
        message: 'Pincode could not be resolved',
        error: { code: 'PINCODE_REQUIRED' },
      });
    }
    const validationResult = await financialConfigurationValidator.validateTaskConfiguration(
      clientId,
      productId,
      verificationTypeId,
      resolvedPincodeId,
      areaId,
      preferredRateTypeId
    );

    const effectiveRateTypeId = validationResult.rateTypeId ?? preferredRateTypeId;

    // SZR rule found = validator did NOT bail with CONFIG_RATE_TYPE_MISSING.
    // Either the rule was matched, or we never tried (preferredRateTypeId branch).
    const rateTypeRuleFound =
      validationResult.errorCode !== FinancialConfigErrorCode.CONFIG_RATE_TYPE_MISSING;

    res.json({
      success: true,
      message: validationResult.isValid
        ? 'Configuration validation succeeded'
        : 'Configuration validation failed',
      data: {
        isValid: validationResult.isValid,
        rateTypeRuleFound,
        rateAmountFound:
          validationResult.isValid ||
          validationResult.errorCode === FinancialConfigErrorCode.CONFIG_RATE_AMOUNT_MISSING
            ? validationResult.amount !== undefined && validationResult.amount !== null
            : false,
        errorCode: validationResult.errorCode,
        errorMessage: validationResult.errorMessage,
        resolved: {
          pincodeId: resolvedPincodeId,
          pincode: resolvedPincodeCode,
          areaId,
          rateTypeId: effectiveRateTypeId,
          amount: validationResult.amount ?? null,
        },
      },
    });
  } catch (error) {
    logger.error('Error validating case configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate case configuration',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
