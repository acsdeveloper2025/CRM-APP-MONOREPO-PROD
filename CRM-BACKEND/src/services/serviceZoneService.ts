import { query } from '@/config/database';
import { logger } from '@/config/logger';

interface RateTypeResult {
  rateTypeId: number;
  rateTypeName: string;
  source: 'Direct Rule';
}

export const serviceZoneService = {
  /**
   * Determine the Rate Type for a given territory context.
   * Direct lookup from service_zone_rules — no service zone indirection.
   */
  determineRateType: async (
    clientId: number,
    productId: number,
    pincodeId: number,
    areaId?: number | null
  ): Promise<RateTypeResult> => {
    try {
      if (!areaId) {
        throw new Error('Area is required to determine rate type.');
      }

      const result = await query(
        `SELECT rt.id, rt.name
         FROM service_zone_rules szr
         JOIN rate_types rt ON szr.rate_type_id = rt.id
         WHERE szr.client_id = $1
           AND szr.product_id = $2
           AND szr.pincode_id = $3
           AND szr.area_id = $4
           AND szr.is_active = true`,
        [clientId, productId, pincodeId, areaId]
      );

      if (result.rows[0]) {
        return {
          rateTypeId: result.rows[0].id,
          rateTypeName: result.rows[0].name,
          source: 'Direct Rule',
        };
      }

      logger.warn(
        `No rate type rule found for Client:${clientId}, Product:${productId}, Pincode:${pincodeId}, Area:${areaId}.`
      );
      throw new Error('Rate type rule not found for the selected territory.');
    } catch (error) {
      logger.error('Error determining rate type:', error);
      throw error;
    }
  },
};
