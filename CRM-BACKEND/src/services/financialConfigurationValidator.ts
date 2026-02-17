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
    areaId?: number | null
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
   * Checks service_zone_rules with cascading priority (no fallback to Outstation)
   */
  validateServiceZoneRule: async (
    clientId: number,
    productId: number,
    pincodeId: number,
    areaId?: number | null
  ): Promise<number | null> => {
    // Priority 1: Specific Rule (Client + Product + Pincode + Area)
    if (areaId) {
      const specificRule = await query(
        `SELECT service_zone_id FROM service_zone_rules
         WHERE client_id = $1 AND product_id = $2 AND pincode_id = $3 AND area_id = $4
           AND is_active = true
         LIMIT 1`,
        [clientId, productId, pincodeId, areaId]
      );
      if (specificRule.rows[0]) {
        return specificRule.rows[0].service_zone_id;
      }
    }

    // Priority 2: Pincode Rule (Client + Product + Pincode)
    const pincodeRule = await query(
      `SELECT service_zone_id FROM service_zone_rules
       WHERE client_id = $1 AND product_id = $2 AND pincode_id = $3 AND area_id IS NULL
         AND is_active = true
       LIMIT 1`,
      [clientId, productId, pincodeId]
    );
    if (pincodeRule.rows[0]) {
      return pincodeRule.rows[0].service_zone_id;
    }

    // Priority 3: Client Default (Client + Pincode)
    const clientRule = await query(
      `SELECT service_zone_id FROM service_zone_rules
       WHERE client_id = $1 AND product_id IS NULL AND pincode_id = $2 AND area_id IS NULL
         AND is_active = true
       LIMIT 1`,
      [clientId, pincodeId]
    );
    if (clientRule.rows[0]) {
      return clientRule.rows[0].service_zone_id;
    }

    // Priority 4: Global Default (Pincode only)
    const globalRule = await query(
      `SELECT service_zone_id FROM service_zone_rules
       WHERE client_id IS NULL AND product_id IS NULL AND pincode_id = $1 AND area_id IS NULL
         AND is_active = true
       LIMIT 1`,
      [pincodeId]
    );
    if (globalRule.rows[0]) {
      return globalRule.rows[0].service_zone_id;
    }

    // NO FALLBACK - Return null to indicate missing configuration
    return null;
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
};
