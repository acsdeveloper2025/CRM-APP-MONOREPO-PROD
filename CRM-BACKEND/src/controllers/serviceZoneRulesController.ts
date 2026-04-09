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
  rateTypeId: number;
};

const validateReferences = async (payload: ServiceZoneRulePayload) => {
  const { clientId, productId, pincodeId, areaId, rateTypeId } = payload;

  const [clientRes, productRes, pincodeRes, areaRes, mappingRes, rateTypeRes] = await Promise.all([
    query('SELECT id FROM clients WHERE id = $1 LIMIT 1', [clientId]),
    query('SELECT id FROM products WHERE id = $1 LIMIT 1', [productId]),
    query('SELECT id FROM pincodes WHERE id = $1 LIMIT 1', [pincodeId]),
    query('SELECT id FROM areas WHERE id = $1 LIMIT 1', [areaId]),
    query('SELECT 1 FROM pincode_areas WHERE pincode_id = $1 AND area_id = $2 LIMIT 1', [
      pincodeId,
      areaId,
    ]),
    query('SELECT id FROM rate_types WHERE id = $1 AND is_active = true LIMIT 1', [rateTypeId]),
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
  if (!rateTypeRes.rows[0]) {
    return {
      ok: false,
      status: 400,
      message: 'Selected rate type does not exist or is inactive',
    };
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
      rateTypeId,
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
    if (rateTypeId) {
      values.push(Number(rateTypeId));
      whereSql.push(`szr.rate_type_id = $${values.length}`);
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
        `(c.name ILIKE $${values.length - 4} OR p.name ILIKE $${values.length - 3} OR pin.code ILIKE $${values.length - 2} OR a.name ILIKE $${values.length - 1} OR rt.name ILIKE $${values.length})`
      );
    }

    const whereClause = whereSql.length ? `WHERE ${whereSql.join(' AND ')}` : '';
    const baseFrom = `
      FROM service_zone_rules szr
      JOIN clients c ON c.id = szr.client_id
      JOIN products p ON p.id = szr.product_id
      JOIN pincodes pin ON pin.id = szr.pincode_id
      JOIN areas a ON a.id = szr.area_id
      LEFT JOIN rate_types rt ON rt.id = szr.rate_type_id
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
        szr.client_id as client_id,
        szr.product_id as product_id,
        szr.pincode_id as pincode_id,
        szr.area_id as area_id,
        szr.rate_type_id as rate_type_id,
        szr.is_active as is_active,
        szr.created_at as created_at,
        szr.updated_at as updated_at,
        c.name as client_name,
        p.name as product_name,
        pin.code as pincode_code,
        a.name as "areaName",
        rt.name as rate_type_name
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
    // Now returns rate types instead of service zones
    const rateTypesRes = await query(
      'SELECT id, name, description, is_active as is_active FROM rate_types ORDER BY name'
    );
    res.json({
      success: true,
      data: rateTypesRes.rows,
    });
  } catch (error) {
    logger.error('Error listing rate types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve rate types',
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
      const dupMsg = 'A rule already exists for this client/product/pincode/area combination';
      return res.status(400).json({
        success: false,
        message: dupMsg,
        error: { code: 'DUPLICATE_RULE' },
      });
    }

    const { clientId, productId, pincodeId, areaId, rateTypeId } = payload;
    const insertRes = await query(
      `INSERT INTO service_zone_rules
        (client_id, product_id, pincode_id, area_id, rate_type_id, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [clientId, productId, pincodeId, areaId, rateTypeId]
    );

    res.status(201).json({
      success: true,
      data: { id: insertRes.rows[0].id },
      message: 'Rate type rule created successfully',
    });
  } catch (error) {
    logger.error('Error creating rate type rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create rate type rule',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const updateServiceZoneRule = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const payload = req.body as ServiceZoneRulePayload;
    const existingRes = await query('SELECT id FROM service_zone_rules WHERE id = $1 LIMIT 1', [
      id,
    ]);
    if (!existingRes.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Rate type rule not found',
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
      const dupMsg = 'A rule already exists for this client/product/pincode/area combination';
      return res.status(400).json({
        success: false,
        message: dupMsg,
        error: { code: 'DUPLICATE_RULE' },
      });
    }

    await query(
      `UPDATE service_zone_rules
       SET client_id = $1,
           product_id = $2,
           pincode_id = $3,
           area_id = $4,
           rate_type_id = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [
        payload.clientId,
        payload.productId,
        payload.pincodeId,
        payload.areaId,
        payload.rateTypeId,
        id,
      ]
    );

    res.json({
      success: true,
      message: 'Rate type rule updated successfully',
    });
  } catch (error) {
    logger.error('Error updating rate type rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update rate type rule',
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
        message: 'Rate type rule not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    res.json({
      success: true,
      message: `Rate type rule ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    logger.error('Error updating rate type rule status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update rate type rule status',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const activateServiceZoneRule = async (req: AuthenticatedRequest, res: Response) =>
  setRuleStatus(req, res, true);

export const deactivateServiceZoneRule = async (req: AuthenticatedRequest, res: Response) =>
  setRuleStatus(req, res, false);
