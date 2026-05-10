import { query } from '@/config/database';
import { logger } from '@/config/logger';

/**
 * Financial Configuration Validation Error Codes
 */
export enum FinancialConfigErrorCode {
  CONFIG_RATE_TYPE_MISSING = 'CONFIG_RATE_TYPE_MISSING',
  CONFIG_RATE_AMOUNT_MISSING = 'CONFIG_RATE_AMOUNT_MISSING',
}

/**
 * Validation Result Interface
 */
export interface FinancialConfigValidationResult {
  isValid: boolean;
  errorCode?: FinancialConfigErrorCode;
  errorMessage?: string;
  rateTypeId?: number;
  amount?: number;
}

/**
 * Financial Configuration Validator
 *
 * Validates the complete financial configuration chain before task creation:
 * 1. Service Zone Rules → rateTypeId (direct mapping from client+product+pincode+area)
 * 2. Rates Table → amount
 *
 * NO FALLBACKS. NO DEFAULTS. Strict validation only.
 */
export const financialConfigurationValidator = {
  /**
   * Validate complete financial configuration for a task.
   *
   * @throws Never - Returns validation result with error details instead
   * @returns FinancialConfigValidationResult
   */
  validateTaskConfiguration: async (
    clientId: number,
    productId: number,
    verificationTypeId: number,
    pincodeId: number,
    areaId?: number | null,
    preferredRateTypeId?: number | null
  ): Promise<FinancialConfigValidationResult> => {
    try {
      // If the caller explicitly selected a rate type, honor it — but ONLY if
      // it is allowed in rate_type_assignments for this (c, p, vt). Phase 4
      // (refactor 2026-05-10) closes audit risk #4: previously any caller could
      // pass any rate_type and skip SZR entirely. Now the caller's choice must
      // live within the eligibility ladder.
      if (preferredRateTypeId && Number(preferredRateTypeId) > 0) {
        const rta = await query(
          `SELECT 1 FROM rate_type_assignments
           WHERE client_id = $1 AND product_id = $2
             AND verification_type_id = $3 AND rate_type_id = $4
             AND is_active = true
           LIMIT 1`,
          [clientId, productId, verificationTypeId, Number(preferredRateTypeId)]
        );
        if (rta.rows.length === 0) {
          return {
            isValid: false,
            errorCode: FinancialConfigErrorCode.CONFIG_RATE_TYPE_MISSING,
            errorMessage:
              'Selected rate type is not allowed for this client/product/verification type combination.',
          };
        }

        const preferredAmount = await financialConfigurationValidator.validateRateAmount(
          clientId,
          productId,
          verificationTypeId,
          Number(preferredRateTypeId)
        );

        if (preferredAmount !== null) {
          return {
            isValid: true,
            rateTypeId: Number(preferredRateTypeId),
            amount: preferredAmount,
          };
        }

        return {
          isValid: false,
          errorCode: FinancialConfigErrorCode.CONFIG_RATE_AMOUNT_MISSING,
          errorMessage:
            'Service configuration missing for selected pincode/area. Billing amount not defined for selected rate type.',
        };
      }

      // Step 1: Look up rate type directly from service_zone_rules
      // Phase 3 (refactor 2026-05-10): VT now part of resolver key.
      const rateTypeId = await financialConfigurationValidator.validateRateTypeRule(
        clientId,
        productId,
        verificationTypeId,
        pincodeId,
        areaId
      );

      if (!rateTypeId) {
        return {
          isValid: false,
          errorCode: FinancialConfigErrorCode.CONFIG_RATE_TYPE_MISSING,
          errorMessage:
            'Service configuration missing for selected pincode/area. Rate type rule not defined.',
        };
      }

      // Step 2: Validate Rate Amount exists
      const amount = await financialConfigurationValidator.validateRateAmount(
        clientId,
        productId,
        verificationTypeId,
        rateTypeId
      );

      if (amount === null) {
        // Phase 4 (refactor 2026-05-10): silent fallback removed.
        // Audit flagged findDeterministicActiveRate as the "single most
        // dangerous code path" — when no rates row matched, it silently
        // substituted whichever rate_type happened to have exactly one active
        // rate row, returning isValid:true. Operators saw a different price
        // than their territory map said, with no audit trail. Now fails loud.
        return {
          isValid: false,
          errorCode: FinancialConfigErrorCode.CONFIG_RATE_AMOUNT_MISSING,
          errorMessage:
            'Service configuration missing for selected pincode/area. Billing amount not defined.',
        };
      }

      // All validations passed
      return {
        isValid: true,
        rateTypeId,
        amount,
      };
    } catch (error) {
      logger.error('Financial configuration validation error:', error);
      throw error;
    }
  },

  /**
   * Step 1: Validate Rate Type Rule
   * Queries service_zone_rules for direct rate_type_id mapping.
   * Phase 3 (refactor 2026-05-10): VT is part of the key — different VTs in
   * same geography may map to different rate types (e.g. RV in Mumbai-Local
   * priced differently from KYC in same Mumbai-Local pincode/area).
   */
  validateRateTypeRule: async (
    clientId: number,
    productId: number,
    verificationTypeId: number,
    pincodeId: number,
    areaId?: number | null
  ): Promise<number | null> => {
    if (!areaId) {
      return null;
    }

    const exactRule = await query(
      `SELECT rate_type_id FROM service_zone_rules
       WHERE client_id = $1 AND product_id = $2 AND verification_type_id = $3
         AND pincode_id = $4 AND area_id = $5
         AND is_active = true
       LIMIT 1`,
      [clientId, productId, verificationTypeId, pincodeId, areaId]
    );
    return exactRule.rows[0]?.rateTypeId ?? null;
  },

  /**
   * Step 2: Validate Rate Amount
   * Checks rates table for active billing amount
   */
  validateRateAmount: async (
    clientId: number,
    productId: number,
    verificationTypeId: number,
    rateTypeId: number
  ): Promise<number | null> => {
    const result = await query(
      `SELECT amount FROM rates
       WHERE client_id = $1 AND product_id = $2
         AND verification_type_id = $3 AND rate_type_id = $4
         AND is_active = true
       LIMIT 1`,
      [clientId, productId, verificationTypeId, rateTypeId]
    );

    if (result.rows[0]) {
      return parseFloat(result.rows[0].amount);
    }

    return null;
  },

  // Phase 4 (refactor 2026-05-10): findDeterministicActiveRate REMOVED.
  // Was the silent-fallback path that flipped invalid configs into "isValid:true"
  // by picking the lone active rate for (c,p,vt) when configured rate_type
  // didn't have a matching rates row. Audit flagged as critical billing bug.
  // No callers remain.
};
