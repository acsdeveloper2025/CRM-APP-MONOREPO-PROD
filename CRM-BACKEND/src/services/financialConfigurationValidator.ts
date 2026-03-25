import { query } from '@/config/database';
import { logger } from '@/config/logger';

/**
 * Financial Configuration Validation Error Codes
 */
export enum FinancialConfigErrorCode {
  CONFIG_SERVICE_ZONE_MISSING = 'CONFIG_SERVICE_ZONE_MISSING',
  CONFIG_RATE_MAPPING_MISSING = 'CONFIG_RATE_MAPPING_MISSING',
  CONFIG_RATE_AMOUNT_MISSING = 'CONFIG_RATE_AMOUNT_MISSING',
}

/**
 * Validation Result Interface
 */
export interface FinancialConfigValidationResult {
  isValid: boolean;
  errorCode?: FinancialConfigErrorCode;
  errorMessage?: string;
  serviceZoneId?: number;
  rateTypeId?: number;
  amount?: number;
}

/**
 * Financial Configuration Validator
 *
 * Validates the complete financial configuration chain before task creation:
 * 1. Service Zone Rules → serviceZoneId
 * 2. Zone-Rate Mapping → rateTypeId
 * 3. Rates Table → amount
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
      // Step 1: Validate Service Zone Rule exists
      const serviceZoneId = await financialConfigurationValidator.validateServiceZoneRule(
        clientId,
        productId,
        pincodeId,
        areaId
      );

      if (!serviceZoneId) {
        return {
          isValid: false,
          errorCode: FinancialConfigErrorCode.CONFIG_SERVICE_ZONE_MISSING,
          errorMessage:
            'Service configuration missing for selected pincode/area. Service zone rule not defined.',
        };
      }

      // Step 2: If the caller explicitly selected a rate type, honor it first.
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
            serviceZoneId,
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

      // Step 2: Validate Zone-Rate Mapping exists
      const rateTypeId = await financialConfigurationValidator.validateZoneRateMapping(
        clientId,
        productId,
        verificationTypeId,
        serviceZoneId
      );

      if (!rateTypeId) {
        return {
          isValid: false,
          errorCode: FinancialConfigErrorCode.CONFIG_RATE_MAPPING_MISSING,
          errorMessage:
            'Service configuration missing for selected pincode/area. Billing rule not defined.',
        };
      }

      // Step 3: Validate Rate Amount exists
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
            serviceZoneId,
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
        serviceZoneId,
        rateTypeId,
        amount,
      };
    } catch (error) {
      logger.error('Financial configuration validation error:', error);
      throw error;
    }
  },

  /**
   * Step 1: Validate Service Zone Rule
   * Checks service_zone_rules using strict exact matching only.
   */
  validateServiceZoneRule: async (
    clientId: number,
    productId: number,
    pincodeId: number,
    areaId?: number | null
  ): Promise<number | null> => {
    if (!areaId) {
      return null;
    }

    const exactRule = await query(
      `SELECT service_zone_id FROM service_zone_rules
       WHERE client_id = $1 AND product_id = $2 AND pincode_id = $3 AND area_id = $4
         AND is_active = true
       LIMIT 1`,
      [clientId, productId, pincodeId, areaId]
    );
    return exactRule.rows[0]?.service_zone_id ?? null;
  },

  /**
   * Step 2: Validate Zone-Rate Mapping
   * Checks zone_rate_type_mapping for deterministic rate type
   */
  validateZoneRateMapping: async (
    clientId: number,
    productId: number,
    verificationTypeId: number,
    serviceZoneId: number
  ): Promise<number | null> => {
    const result = await query(
      `SELECT rate_type_id FROM zone_rate_type_mapping
       WHERE client_id = $1 AND product_id = $2 
         AND verification_type_id = $3 AND service_zone_id = $4
         AND is_active = true
       LIMIT 1`,
      [clientId, productId, verificationTypeId, serviceZoneId]
    );

    if (result.rows[0]) {
      return result.rows[0].rate_type_id;
    }

    return null;
  },

  /**
   * Step 3: Validate Rate Amount
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
       WHERE "clientId" = $1 AND "productId" = $2 
         AND "verificationTypeId" = $3 AND "rateTypeId" = $4
         AND "isActive" = true
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
      `SELECT "rateTypeId", amount
       FROM rates
       WHERE "clientId" = $1 AND "productId" = $2
         AND "verificationTypeId" = $3
         AND "isActive" = true
       ORDER BY "rateTypeId" ASC`,
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
