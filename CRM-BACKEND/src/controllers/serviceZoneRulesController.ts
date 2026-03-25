import type { Response } from 'express';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import type { QueryParams } from '@/types/database';

type ServiceZoneRulePayload = {
  clientId: number;
  productId: number;
  pincodeId: number;
  areaId: number;
  serviceZoneId: number;
};

const validateReferences = async (payload: ServiceZoneRulePayload) => {
  const { clientId, productId, pincodeId, areaId, serviceZoneId } = payload;

  const [clientRes, productRes, pincodeRes, areaRes, mappingRes, zoneRes] = await Promise.all([
    query('SELECT id FROM clients WHERE id = $1 LIMIT 1', [clientId]),
    query('SELECT id FROM products WHERE id = $1 LIMIT 1', [productId]),
    query('SELECT id FROM pincodes WHERE id = $1 LIMIT 1', [pincodeId]),
    query('SELECT id FROM areas WHERE id = $1 LIMIT 1', [areaId]),
    query('SELECT 1 FROM "pincodeAreas" WHERE "pincodeId" = $1 AND "areaId" = $2 LIMIT 1', [
      pincodeId,
      areaId,
    ]),
    query('SELECT id FROM service_zones WHERE id = $1 AND is_active = true LIMIT 1', [
      serviceZoneId,
    ]),
  ]);

  if (!clientRes.rows[0]) {
    return { ok: false, status: 400, message: 'Selected client does not exist' };
  }
  if (!productRes.rows[0]) {
    return { ok: false, status: 400, message: 'Selected product does not exist' };
  }
  if (!pincodeRes.rows[0]) {
    return { ok: false, status: 400, message: 'Selected pincode does not exist' };
  }
  if (!areaRes.rows[0]) {
    return { ok: false, status: 400, message: 'Selected area does not exist' };
  }
  if (!mappingRes.rows[0]) {
    return {
      ok: false,
      status: 400,
      message: 'Selected area is not mapped to the selected pincode',
    };
  }
  if (!zoneRes.rows[0]) {
    return { ok: false, status: 400, message: 'Selected service zone does not exist or is inactive' };
  }

  return { ok: true };
};

export const listServiceZoneRules = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      clientId,
      productId,
      pincodeId,
      areaId,
      serviceZoneId,
      isActive,
      search,
    } = req.query;

    const values: QueryParams = [];
    const whereSql: string[] = [];

    if (clientId) {
      values.push(Number(clientId));
      whereSql.push(`szr.client_id = $${values.length}`);
    }
    if (productId) {
      values.push(Number(productId));
      whereSql.push(`szr.product_id = $${values.length}`);
    }
    if (pincodeId) {
      values.push(Number(pincodeId));
      whereSql.push(`szr.pincode_id = $${values.length}`);
    }
    if (areaId) {
      values.push(Number(areaId));
      whereSql.push(`szr.area_id = $${values.length}`);
    }
    if (serviceZoneId) {
      values.push(Number(serviceZoneId));
      whereSql.push(`szr.service_zone_id = $${values.length}`);
    }
    if (typeof isActive !== 'undefined') {
      values.push(typeof isActive === 'string' ? isActive === 'true' : Boolean(isActive));
      whereSql.push(`szr.is_active = $${values.length}`);
    }
    if (search && typeof search === 'string') {
      values.push(`%${search}%`);
      values.push(`%${search}%`);
      values.push(`%${search}%`);
      values.push(`%${search}%`);
      values.push(`%${search}%`);
      whereSql.push(
        `(c.name ILIKE $${values.length - 4} OR p.name ILIKE $${values.length - 3} OR pin.code ILIKE $${values.length - 2} OR a.name ILIKE $${values.length - 1} OR sz.name ILIKE $${values.length})`
      );
    }

    const whereClause = whereSql.length ? `WHERE ${whereSql.join(' AND ')}` : '';
    const baseFrom = `
      FROM service_zone_rules szr
      JOIN clients c ON c.id = szr.client_id
      JOIN products p ON p.id = szr.product_id
      JOIN pincodes pin ON pin.id = szr.pincode_id
      JOIN areas a ON a.id = szr.area_id
      JOIN service_zones sz ON sz.id = szr.service_zone_id
    `;
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count ${baseFrom} ${whereClause}`,
      values
    );
    const total = Number(countRes.rows[0]?.count || 0);
    const offset = (Number(page) - 1) * Number(limit);

    const listRes = await query(
      `SELECT
        szr.id,
        szr.client_id as "clientId",
        szr.product_id as "productId",
        szr.pincode_id as "pincodeId",
        szr.area_id as "areaId",
        szr.service_zone_id as "serviceZoneId",
        szr.is_active as "isActive",
        szr.created_at as "createdAt",
        szr.updated_at as "updatedAt",
        c.name as "clientName",
        p.name as "productName",
        pin.code as "pincodeCode",
        a.name as "areaName",
        sz.name as "serviceZoneName",
        sz.sla_hours as "slaHours"
       ${baseFrom}
       ${whereClause}
       ORDER BY c.name, p.name, pin.code, a.name
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, Number(limit), offset]
    );

    res.json({
      success: true,
      data: listRes.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error listing service zone rules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve service zone rules',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const listServiceZones = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const zoneRes = await query(
      'SELECT id, name, sla_hours as "slaHours", is_active as "isActive" FROM service_zones ORDER BY name'
    );
    res.json({
      success: true,
      data: zoneRes.rows,
    });
  } catch (error) {
    logger.error('Error listing service zones:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve service zones',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const createServiceZoneRule = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = req.body as ServiceZoneRulePayload;
    const refs = await validateReferences(payload);
    if (!refs.ok) {
      return res.status(refs.status).json({
        success: false,
        message: refs.message,
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    const duplicateRes = await query(
      `SELECT id FROM service_zone_rules
       WHERE client_id = $1 AND product_id = $2 AND pincode_id = $3 AND area_id = $4
       LIMIT 1`,
      [payload.clientId, payload.productId, payload.pincodeId, payload.areaId]
    );
    if (duplicateRes.rows[0]) {
      return res.status(400).json({
        success: false,
        message: 'A service zone rule already exists for this exact client/product/pincode/area combination',
        error: { code: 'DUPLICATE_RULE' },
      });
    }

    const insertRes = await query(
      `INSERT INTO service_zone_rules
        (client_id, product_id, pincode_id, area_id, service_zone_id, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [payload.clientId, payload.productId, payload.pincodeId, payload.areaId, payload.serviceZoneId]
    );

    res.status(201).json({
      success: true,
      data: { id: insertRes.rows[0].id },
      message: 'Service zone rule created successfully',
    });
  } catch (error) {
    logger.error('Error creating service zone rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service zone rule',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const updateServiceZoneRule = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const payload = req.body as ServiceZoneRulePayload;
    const existingRes = await query('SELECT id FROM service_zone_rules WHERE id = $1 LIMIT 1', [id]);
    if (!existingRes.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Service zone rule not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const refs = await validateReferences(payload);
    if (!refs.ok) {
      return res.status(refs.status).json({
        success: false,
        message: refs.message,
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    const duplicateRes = await query(
      `SELECT id FROM service_zone_rules
       WHERE client_id = $1 AND product_id = $2 AND pincode_id = $3 AND area_id = $4 AND id <> $5
       LIMIT 1`,
      [payload.clientId, payload.productId, payload.pincodeId, payload.areaId, id]
    );
    if (duplicateRes.rows[0]) {
      return res.status(400).json({
        success: false,
        message: 'A service zone rule already exists for this exact client/product/pincode/area combination',
        error: { code: 'DUPLICATE_RULE' },
      });
    }

    await query(
      `UPDATE service_zone_rules
       SET client_id = $1,
           product_id = $2,
           pincode_id = $3,
           area_id = $4,
           service_zone_id = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [payload.clientId, payload.productId, payload.pincodeId, payload.areaId, payload.serviceZoneId, id]
    );

    res.json({
      success: true,
      message: 'Service zone rule updated successfully',
    });
  } catch (error) {
    logger.error('Error updating service zone rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update service zone rule',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

const setRuleStatus = async (req: AuthenticatedRequest, res: Response, isActive: boolean) => {
  try {
    const id = Number(req.params.id);
    const result = await query(
      `UPDATE service_zone_rules
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id`,
      [isActive, id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Service zone rule not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    res.json({
      success: true,
      message: `Service zone rule ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    logger.error('Error updating service zone rule status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update service zone rule status',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const activateServiceZoneRule = async (req: AuthenticatedRequest, res: Response) =>
  setRuleStatus(req, res, true);

export const deactivateServiceZoneRule = async (req: AuthenticatedRequest, res: Response) =>
  setRuleStatus(req, res, false);
