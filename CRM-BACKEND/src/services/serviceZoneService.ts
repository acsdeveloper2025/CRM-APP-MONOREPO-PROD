import { query } from '@/config/database';
import { logger } from '@/config/logger';

interface ServiceZoneResult {
  serviceZoneId: number;
  serviceZoneName: string;
  slaHours: number;
  source: 'Specific Rule' | 'Client Default' | 'Global Default' | 'Fallback';
}

export const serviceZoneService = {
  /**
   * Determine the Service Zone for a given context.
   * Priority:
   * 1. Specific Rule (Client + Product + Pincode + Area)
   * 2. Pincode Rule (Client + Product + Pincode)
   * 3. Client Default (Client + Pincode)
   * 4. Global Default (Pincode)
   * 5. Fallback (Outstation)
   */
  determineServiceZone: async (
    clientId: number,
    productId: number,
    pincodeId: number,
    areaId?: number | null
  ): Promise<ServiceZoneResult> => {
    try {
      // 1. Specific Rule (Client + Product + Pincode + Area)
      if (areaId) {
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
      }

      // 2. Pincode Rule (Client + Product + Pincode) - Ignore Area
      const pincodeRule = await query(
        `SELECT sz.id, sz.name, sz.sla_hours
         FROM service_zone_rules szr
         JOIN service_zones sz ON szr.service_zone_id = sz.id
         WHERE szr.client_id = $1 
           AND szr.product_id = $2 
           AND szr.pincode_id = $3 
           AND szr.area_id IS NULL
           AND szr.is_active = true`,
        [clientId, productId, pincodeId]
      );

      if (pincodeRule.rows[0]) {
        return {
          serviceZoneId: pincodeRule.rows[0].id,
          serviceZoneName: pincodeRule.rows[0].name,
          slaHours: pincodeRule.rows[0].sla_hours,
          source: 'Specific Rule',
        };
      }

      // 3. Client Default (Client + Pincode) - Ignore Product
      const clientRule = await query(
        `SELECT sz.id, sz.name, sz.sla_hours
         FROM service_zone_rules szr
         JOIN service_zones sz ON szr.service_zone_id = sz.id
         WHERE szr.client_id = $1 
           AND szr.product_id IS NULL 
           AND szr.pincode_id = $2 
           AND szr.area_id IS NULL
           AND szr.is_active = true`,
        [clientId, pincodeId]
      );

      if (clientRule.rows[0]) {
        return {
          serviceZoneId: clientRule.rows[0].id,
          serviceZoneName: clientRule.rows[0].name,
          slaHours: clientRule.rows[0].sla_hours,
          source: 'Client Default',
        };
      }

      // 4. Global Default (Pincode only) - Ignore Client & Product
      const globalRule = await query(
        `SELECT sz.id, sz.name, sz.sla_hours
         FROM service_zone_rules szr
         JOIN service_zones sz ON szr.service_zone_id = sz.id
         WHERE szr.client_id IS NULL 
           AND szr.product_id IS NULL 
           AND szr.pincode_id = $1 
           AND szr.area_id IS NULL
           AND szr.is_active = true`,
        [pincodeId]
      );

      if (globalRule.rows[0]) {
        return {
          serviceZoneId: globalRule.rows[0].id,
          serviceZoneName: globalRule.rows[0].name,
          slaHours: globalRule.rows[0].sla_hours,
          source: 'Global Default',
        };
      }

      // 5. Fallback: Outstation
      // Ideally we should log a warning here that no rule was found
      logger.warn(
        `No Service Zone Rule found for Client:${clientId}, Product:${productId}, Pincode:${pincodeId}. Defaulting to Outstation.`
      );

      const outstationZone = await query(
        `SELECT id, name, sla_hours FROM service_zones WHERE name = 'Outstation'`
      );

      if (outstationZone.rows[0]) {
        return {
          serviceZoneId: outstationZone.rows[0].id,
          serviceZoneName: outstationZone.rows[0].name,
          slaHours: outstationZone.rows[0].sla_hours,
          source: 'Fallback',
        };
      }

      throw new Error('Service Zone setup is incomplete. "Outstation" zone not found.');
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
