import { query } from '@/config/database';
import { logger } from '@/config/logger';

interface ServiceZoneResult {
  serviceZoneId: number;
  serviceZoneName: string;
  slaHours: number;
  source: 'Specific Rule';
}

export const serviceZoneService = {
  /**
   * Determine the Service Zone for a given context.
   * Strict exact matching only.
   */
  determineServiceZone: async (
    clientId: number,
    productId: number,
    pincodeId: number,
    areaId?: number | null
  ): Promise<ServiceZoneResult> => {
    try {
      if (!areaId) {
        throw new Error('Area is required to determine service zone.');
      }

      const specificRule = await query(
        `SELECT sz.id, sz.name, sz.sla_hours
         FROM service_zone_rules szr
         JOIN service_zones sz ON szr.service_zone_id = sz.id
         WHERE szr.client_id = $1 
           AND szr.product_id = $2 
           AND szr.pincode_id = $3 
           AND szr.area_id = $4
           AND szr.is_active = true`,
        [clientId, productId, pincodeId, areaId]
      );

      if (specificRule.rows[0]) {
        return {
          serviceZoneId: specificRule.rows[0].id,
          serviceZoneName: specificRule.rows[0].name,
          slaHours: specificRule.rows[0].sla_hours,
          source: 'Specific Rule',
        };
      }

      logger.warn(
        `No Service Zone Rule found for Client:${clientId}, Product:${productId}, Pincode:${pincodeId}, Area:${areaId}.`
      );
      throw new Error('Service Zone rule not found for the selected territory.');
    } catch (error) {
      logger.error('Error determining service zone:', error);
      throw error;
    }
  },

  /**
   * Find the matching Rate Type ID using the deterministic zone_rate_type_mapping table.
   * This replaces unsafe name matching with explicit client configuration.
   */
  determineRateTypeId: async (
    clientId: number,
    productId: number,
    verificationTypeId: number,
    serviceZoneId: number
  ): Promise<number | null> => {
    // Query the deterministic mapping table
    const result = await query(
      `SELECT rate_type_id
       FROM zone_rate_type_mapping
       WHERE client_id = $1
         AND product_id = $2
         AND verification_type_id = $3
         AND service_zone_id = $4
         AND is_active = true
       LIMIT 1`,
      [clientId, productId, verificationTypeId, serviceZoneId]
    );

    if (result.rows[0]) {
      return result.rows[0].rate_type_id;
    }

    // Log warning if no mapping exists - this indicates missing configuration
    logger.warn(
      `No rate type mapping found for Client:${clientId}, Product:${productId}, VerificationType:${verificationTypeId}, Zone:${serviceZoneId}`
    );

    return null;
  },
};
