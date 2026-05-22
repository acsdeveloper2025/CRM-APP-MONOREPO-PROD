import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import type { QueryParams } from '@/types/database';
import { createAuditLog } from '@/utils/auditLogger';
import { escapeFormulaRow } from '@/utils/formulaGuard';

const EXPORT_ROW_LIMIT = 10000;

// Shared WHERE-clause builder for list + export + stats. Uses table aliases
// szr/c/p/pin/a/rt/vt — see baseFrom in listServiceZoneRules. Filter-
// standardization sweep Page 2 (2026-05-22).
const buildServiceZoneRulesWhereClause = (
  req: AuthenticatedRequest
): { whereClause: string; queryParams: QueryParams; nextParamIndex: number } => {
  const {
    clientId,
    productId,
    pincodeId,
    areaId,
    rateTypeId,
    verificationTypeId,
    isActive,
    search,
  } = req.query;
  const whereConditions: string[] = [];
  const queryParams: QueryParams = [];
  let paramIndex = 1;

  if (clientId) {
    whereConditions.push(`szr.client_id = $${paramIndex}`);
    queryParams.push(Number(clientId));
    paramIndex++;
  }
  if (productId) {
    whereConditions.push(`szr.product_id = $${paramIndex}`);
    queryParams.push(Number(productId));
    paramIndex++;
  }
  if (pincodeId) {
    whereConditions.push(`szr.pincode_id = $${paramIndex}`);
    queryParams.push(Number(pincodeId));
    paramIndex++;
  }
  if (areaId) {
    whereConditions.push(`szr.area_id = $${paramIndex}`);
    queryParams.push(Number(areaId));
    paramIndex++;
  }
  if (rateTypeId) {
    whereConditions.push(`szr.rate_type_id = $${paramIndex}`);
    queryParams.push(Number(rateTypeId));
    paramIndex++;
  }
  if (verificationTypeId) {
    whereConditions.push(`szr.verification_type_id = $${paramIndex}`);
    queryParams.push(Number(verificationTypeId));
    paramIndex++;
  }
  if (isActive === 'true' || isActive === 'false') {
    whereConditions.push(`szr.is_active = $${paramIndex}`);
    queryParams.push(isActive === 'true');
    paramIndex++;
  } else if (typeof isActive === 'boolean') {
    whereConditions.push(`szr.is_active = $${paramIndex}`);
    queryParams.push(isActive);
    paramIndex++;
  }
  if (search && typeof search === 'string') {
    whereConditions.push(
      `(c.name ILIKE $${paramIndex} OR p.name ILIKE $${paramIndex} OR pin.code ILIKE $${paramIndex} OR a.name ILIKE $${paramIndex} OR rt.name ILIKE $${paramIndex})`
    );
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  return { whereClause, queryParams, nextParamIndex: paramIndex };
};

// Matches the FROM clause inside the existing listServiceZoneRules query —
// preserve INNER JOINs to keep behavior identical (Karpathy surgical).
const SZR_BASE_FROM = `
  FROM service_zone_rules szr
  JOIN clients c ON c.id = szr.client_id
  JOIN products p ON p.id = szr.product_id
  JOIN pincodes pin ON pin.id = szr.pincode_id
  JOIN areas a ON a.id = szr.area_id
  LEFT JOIN rate_types rt ON rt.id = szr.rate_type_id
  LEFT JOIN verification_types vt ON vt.id = szr.verification_type_id
`;

const SZR_SORT_COLUMNS: Record<string, string> = {
  name: 'c.name',
  createdAt: 'szr.created_at',
  updatedAt: 'szr.updated_at',
};

type ServiceZoneRulePayload = {
  clientId: number;
  productId: number;
  pincodeId: number;
  areaId: number;
  rateTypeId: number;
  // Phase 7 (refactor 2026-05-10): VT required; DB col is NOT NULL.
  verificationTypeId: number;
};

type ValidateReferencesResult =
  | { ok: true; status?: undefined; message?: undefined }
  | { ok: false; status: number; message: string };

const validateReferences = async (
  payload: ServiceZoneRulePayload
): Promise<ValidateReferencesResult> => {
  const { clientId, productId, pincodeId, areaId, rateTypeId, verificationTypeId } = payload;

  const [
    clientRes,
    productRes,
    pincodeRes,
    areaRes,
    mappingRes,
    rateTypeRes,
    verificationTypeRes,
    rtaRes,
  ] = await Promise.all([
    query('SELECT id FROM clients WHERE id = $1 LIMIT 1', [clientId]),
    query('SELECT id FROM products WHERE id = $1 LIMIT 1', [productId]),
    query('SELECT id FROM pincodes WHERE id = $1 LIMIT 1', [pincodeId]),
    query('SELECT id FROM areas WHERE id = $1 LIMIT 1', [areaId]),
    query('SELECT 1 FROM pincode_areas WHERE pincode_id = $1 AND area_id = $2 LIMIT 1', [
      pincodeId,
      areaId,
    ]),
    query('SELECT id FROM rate_types WHERE id = $1 AND is_active = true LIMIT 1', [rateTypeId]),
    // Phase 7 (refactor 2026-05-10): VT required.
    query('SELECT id FROM verification_types WHERE id = $1 AND is_active = true LIMIT 1', [
      verificationTypeId,
    ]),
    // Bug B-4 (audit 2026-05-10): backend defense-in-depth — selected rate
    // type MUST be active in rate_type_assignments for this (c, p, vt). Closes
    // the curl-bypass / stale-form gap where FE filters dropdown to RTA-allowed
    // but BE accepted any active rate type. Symmetric to ratesController
    // line 219-232 which already enforces this for Rate Amounts INSERT.
    query(
      `SELECT 1 FROM rate_type_assignments
       WHERE client_id = $1 AND product_id = $2
         AND verification_type_id = $3 AND rate_type_id = $4
         AND is_active = true
       LIMIT 1`,
      [clientId, productId, verificationTypeId, rateTypeId]
    ),
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
  // Phase 7 (refactor 2026-05-10): VT required.
  if (!verificationTypeRes.rows[0]) {
    return {
      ok: false,
      status: 400,
      message: 'Selected verification type does not exist or is inactive',
    };
  }
  // Bug B-4 (audit 2026-05-10): rate type must be RTA-allowed for (c, p, vt).
  if (!rtaRes.rows[0]) {
    return {
      ok: false,
      status: 400,
      message:
        'Selected rate type is not allowed for this client/product/verification type combination. Configure Rate Type Assignment first.',
    };
  }

  return { ok: true };
};

export const listServiceZoneRules = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = req.query;

    const {
      whereClause,
      queryParams: values,
      nextParamIndex,
    } = buildServiceZoneRulesWhereClause(req);

    const sortCol =
      SZR_SORT_COLUMNS[typeof sortBy === 'string' ? sortBy : ''] || SZR_SORT_COLUMNS.name;
    const sortDir =
      typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count ${SZR_BASE_FROM} ${whereClause}`,
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
        szr.verification_type_id as verification_type_id,
        szr.is_active as is_active,
        szr.created_at as created_at,
        szr.updated_at as updated_at,
        c.name as client_name,
        p.name as product_name,
        pin.code as pincode_code,
        a.name as "areaName",
        rt.name as rate_type_name,
        vt.code as verification_type_code,
        vt.name as verification_type_name
       ${SZR_BASE_FROM}
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir}, p.name, pin.code, a.name
       LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`,
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

    const { clientId, productId, pincodeId, areaId, rateTypeId, verificationTypeId } = payload;

    // Upsert on (clientId, productId, pincodeId, areaId). One rule per combo
    // is the data model; the rate_type_id IS the editable value. If the user
    // submits a combo that already has a rule, update its rate type rather
    // than reject — that matches intent and avoids the "create a new rule"
    // vs "click Edit on the old one" UX trap. Rare accidental overwrite is
    // acceptable vs the common "duplicate, try again" friction.
    // Bug B-2 (audit 2026-05-10): VT is part of the SZR key. Existence check
    // must include verification_type_id, else creating a 2nd VT rule for the
    // same (c, p, pincode, area) silently overwrites a different VT's rule
    // (UPDATE branch below changes the existing row's VT instead of inserting).
    const existingRes = await query(
      `SELECT id FROM service_zone_rules
       WHERE client_id = $1 AND product_id = $2 AND verification_type_id = $3
         AND pincode_id = $4 AND area_id = $5
       LIMIT 1`,
      [clientId, productId, verificationTypeId, pincodeId, areaId]
    );
    if (existingRes.rows[0]) {
      const existingId = existingRes.rows[0].id;
      await query(
        `UPDATE service_zone_rules
         SET rate_type_id = $1,
             verification_type_id = $2,
             is_active = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [rateTypeId, verificationTypeId, existingId]
      );
      return res.status(200).json({
        success: true,
        data: { id: existingId, updated: true },
        message: 'Rate type rule updated successfully',
      });
    }

    const insertRes = await query(
      `INSERT INTO service_zone_rules
        (client_id, product_id, pincode_id, area_id, rate_type_id, verification_type_id, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [clientId, productId, pincodeId, areaId, rateTypeId, verificationTypeId]
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

    // Bug B-2 (audit 2026-05-10): VT is part of the SZR key. Duplicate check
    // must include verification_type_id, else editing one VT's rule incorrectly
    // raises DUPLICATE_RULE against another VT's rule for the same geography.
    const duplicateRes = await query(
      `SELECT id FROM service_zone_rules
       WHERE client_id = $1 AND product_id = $2 AND verification_type_id = $3
         AND pincode_id = $4 AND area_id = $5 AND id <> $6
       LIMIT 1`,
      [
        payload.clientId,
        payload.productId,
        payload.verificationTypeId,
        payload.pincodeId,
        payload.areaId,
        id,
      ]
    );
    if (duplicateRes.rows[0]) {
      const dupMsg =
        'A rule already exists for this client/product/verification type/pincode/area combination';
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
           verification_type_id = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7`,
      [
        payload.clientId,
        payload.productId,
        payload.pincodeId,
        payload.areaId,
        payload.rateTypeId,
        payload.verificationTypeId,
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

// GET /api/service-zone-rules/stats - 5-card stats aggregate. No filter
// params — global counters. Filter-standardization sweep Page 2 (2026-05-22).
export const getServiceZoneRuleStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statsRes = await query<{
      total: number;
      active: number;
      inactive: number;
      recentlyAddedCount: number;
      pincodesCoveredCount: number;
    }>(`
      SELECT
        COUNT(*)::int as total,
        COUNT(CASE WHEN is_active = true THEN 1 END)::int as active,
        COUNT(CASE WHEN is_active = false THEN 1 END)::int as inactive,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::int as "recentlyAddedCount",
        COUNT(DISTINCT CASE WHEN is_active = true THEN pincode_id END)::int as "pincodesCoveredCount"
      FROM service_zone_rules
    `);
    const stats = statsRes.rows[0] || {
      total: 0,
      active: 0,
      inactive: 0,
      recentlyAddedCount: 0,
      pincodesCoveredCount: 0,
    };
    res.json({ success: true, data: stats, message: 'Stats retrieved' });
  } catch (error) {
    logger.error('Error retrieving SZR stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve service zone rule statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/service-zone-rules/export - xlsx mirroring list filters via the
// shared buildServiceZoneRulesWhereClause helper. Cap EXPORT_ROW_LIMIT;
// every cell through escapeFormulaRow (CWE-1236). Audit row pre-stream.
// Route MUST stay declared BEFORE /:id (Express order).
export const exportServiceZoneRules = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sortBy = 'name', sortOrder = 'asc' } = req.query;
    const {
      whereClause,
      queryParams: values,
      nextParamIndex,
    } = buildServiceZoneRulesWhereClause(req);

    const sortCol =
      SZR_SORT_COLUMNS[typeof sortBy === 'string' ? sortBy : ''] || SZR_SORT_COLUMNS.name;
    const sortDir =
      typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const listRes = await query<{
      clientName: string;
      productName: string;
      verificationTypeName: string | null;
      pincodeCode: string;
      areaName: string;
      rateTypeName: string | null;
      isActive: boolean;
      createdAt: Date;
    }>(
      `SELECT
         c.name AS "clientName",
         p.name AS "productName",
         vt.name AS "verificationTypeName",
         pin.code AS "pincodeCode",
         a.name AS "areaName",
         rt.name AS "rateTypeName",
         szr.is_active AS "isActive",
         szr.created_at AS "createdAt"
         ${SZR_BASE_FROM}
         ${whereClause}
         ORDER BY ${sortCol} ${sortDir}, p.name, pin.code, a.name
         LIMIT $${nextParamIndex}`,
      [...values, EXPORT_ROW_LIMIT]
    );

    await createAuditLog({
      action: 'SZR_EXPORTED',
      entityType: 'SERVICE_ZONE_RULE',
      entityId: undefined,
      userId: req.user?.id,
      details: { rowCount: listRes.rows.length, filters: req.query },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Service Zone Rules');
    ws.addRow([
      'Client',
      'Product',
      'Verification Type',
      'Pincode',
      'Area',
      'Rate Type',
      'Created Date',
      'Status',
    ]);
    for (const r of listRes.rows) {
      ws.addRow(
        escapeFormulaRow([
          r.clientName,
          r.productName,
          r.verificationTypeName ?? '',
          r.pincodeCode,
          r.areaName,
          r.rateTypeName ?? '',
          r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
          r.isActive ? 'ACTIVE' : 'INACTIVE',
        ])
      );
    }

    const filename = `service_zone_rules_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const buf = await wb.xlsx.writeBuffer();
    res.send(Buffer.from(buf));
  } catch (error) {
    logger.error('Error exporting service zone rules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export service zone rules',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
