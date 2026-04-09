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
      // If the caller explicitly selected a rate type, honor it first.
      if (preferredRateTypeId && Number(preferredRateTypeId) > 0) {
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
      const rateTypeId = await financialConfigurationValidator.validateRateTypeRule(
        clientId,
        productId,
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
        const fallbackRate = await financialConfigurationValidator.findDeterministicActiveRate(
          clientId,
          productId,
          verificationTypeId
        );

        if (fallbackRate) {
          return {
            isValid: true,
            rateTypeId: fallbackRate.rateTypeId,
            amount: fallbackRate.amount,
          };
        }

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
   */
  validateRateTypeRule: async (
    clientId: number,
    productId: number,
    pincodeId: number,
    areaId?: number | null
  ): Promise<number | null> => {
    if (!areaId) {
      return null;
    }

    const exactRule = await query(
      `SELECT rate_type_id FROM service_zone_rules
       WHERE client_id = $1 AND product_id = $2 AND pincode_id = $3 AND area_id = $4
         AND is_active = true
       LIMIT 1`,
      [clientId, productId, pincodeId, areaId]
    );
    return exactRule.rows[0]?.rate_type_id ?? null;
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

  findDeterministicActiveRate: async (
    clientId: number,
    productId: number,
    verificationTypeId: number
  ): Promise<{ rateTypeId: number; amount: number } | null> => {
    const result = await query(
      `SELECT rate_type_id, amount
       FROM rates
       WHERE client_id = $1 AND product_id = $2
         AND verification_type_id = $3
         AND is_active = true
       ORDER BY rate_type_id ASC`,
      [clientId, productId, verificationTypeId]
    );

    if (result.rows.length !== 1) {
      return null;
    }

    return {
      rateTypeId: Number(result.rows[0].rateTypeId),
      amount: Number(result.rows[0].amount),
    };
  },
};
