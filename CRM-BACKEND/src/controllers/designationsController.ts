import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { createAuditLog } from '@/utils/auditLogger';
import { escapeFormulaRow } from '@/utils/formulaGuard';

// Shared WHERE-clause builder for getDesignations + exportDesignations +
// getDesignationStats so the three stay in lockstep. §9 canonical pattern.
const buildDesignationsWhereClause = (
  req: AuthenticatedRequest | Request
): {
  whereClause: string;
  queryParams: (string | number | boolean)[];
  nextParamIndex: number;
} => {
  const { search, isActive, departmentId, createdFrom, createdTo } = req.query;
  const whereSql: string[] = [];
  const values: (string | number | boolean)[] = [];
  let paramIndex = 1;

  if (search && typeof search === 'string') {
    whereSql.push(
      `(COALESCE(d.name, '') ILIKE $${paramIndex} OR COALESCE(d.description, '') ILIKE $${paramIndex + 1})`
    );
    values.push(`%${search}%`, `%${search}%`);
    paramIndex += 2;
  }

  // §9 isActive contract: 'true' / 'false' / 'all' / undefined
  if (typeof isActive === 'boolean') {
    whereSql.push(`d.is_active = $${paramIndex}`);
    values.push(isActive);
    paramIndex++;
  } else if (isActive === 'true' || isActive === 'false') {
    whereSql.push(`d.is_active = $${paramIndex}`);
    values.push(isActive === 'true');
    paramIndex++;
  }

  if (departmentId && typeof departmentId === 'string') {
    whereSql.push(`d.department_id = $${paramIndex}`);
    values.push(Number(departmentId));
    paramIndex++;
  }

  if (typeof createdFrom === 'string' && createdFrom) {
    whereSql.push(`d.created_at >= $${paramIndex}`);
    values.push(createdFrom);
    paramIndex++;
  }
  if (typeof createdTo === 'string' && createdTo) {
    // Canonical dateTo semantic — full day inclusive.
    whereSql.push(`d.created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
    values.push(createdTo);
    paramIndex++;
  }

  const whereClause = whereSql.length ? `WHERE ${whereSql.join(' AND ')}` : '';
  return { whereClause, queryParams: values, nextParamIndex: paramIndex };
};

const DESIGNATION_SORT_MAP: Record<string, string> = {
  name: 'd.name',
  createdAt: 'd.created_at',
  updatedAt: 'd.updated_at',
};

const DESIGNATION_EXPORT_ROW_LIMIT = 10000;

// GET /api/designations - List designations with pagination + canonical filters
export const getDesignations = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, sortBy = 'name', sortOrder = 'asc' } = req.query;

    const {
      whereClause,
      queryParams: values,
      nextParamIndex: paramIndex,
    } = buildDesignationsWhereClause(req);

    const sortByStr = typeof sortBy === 'string' ? sortBy : 'name';
    const sortOrderStr = typeof sortOrder === 'string' ? sortOrder : 'asc';
    const sortCol = DESIGNATION_SORT_MAP[sortByStr] || DESIGNATION_SORT_MAP.name;
    const sortDir: 'ASC' | 'DESC' = sortOrderStr.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const offset = (Number(page) - 1) * Number(limit);

    const designationsQuery = `
      SELECT
        d.id,
        d.name,
        d.description,
        d.department_id,
        dept.name as "departmentName",
        d.is_active,
        d.created_at,
        d.updated_at,
        creator.name as "createdByName",
        updater.name as "updatedByName",
        (SELECT COUNT(*) FROM users u WHERE u.designation_id = d.id) as "userCount"
      FROM designations d
      LEFT JOIN departments dept ON d.department_id = dept.id
      LEFT JOIN users creator ON d.created_by = creator.id
      LEFT JOIN users updater ON d.updated_by = updater.id
      ${whereClause}
      ORDER BY ${sortCol} ${sortDir} NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM designations d
      ${whereClause}
    `;

    const [designationsResult, countResult] = await Promise.all([
      query(designationsQuery, [...values, Number(limit), offset]),
      query(countQuery, values),
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      success: true,
      data: designationsResult.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    logger.error('Error retrieving designations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve designations',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/designations/stats - canonical 5-card aggregate.
// Route MUST be declared BEFORE /:id (Express matches in declaration order).
export const getDesignationStats = async (_req: Request, res: Response) => {
  try {
    const r = await query<{
      total: string;
      active: string;
      inactive: string;
      recently_added: string;
      without_department: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE is_active = true)::text AS active,
         COUNT(*) FILTER (WHERE is_active = false)::text AS inactive,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::text AS recently_added,
         COUNT(*) FILTER (WHERE department_id IS NULL)::text AS without_department
       FROM designations`
    );
    const row = r.rows[0] || {
      total: '0',
      active: '0',
      inactive: '0',
      recently_added: '0',
      without_department: '0',
    };
    res.json({
      success: true,
      data: {
        total: Number(row.total),
        active: Number(row.active),
        inactive: Number(row.inactive),
        recentlyAddedCount: Number(row.recently_added),
        withoutDepartmentCount: Number(row.without_department),
      },
    });
  } catch (error) {
    logger.error('Error fetching designation stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch designation stats',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/designations/export - xlsx export mirroring list filters + sort.
// Route MUST be declared BEFORE /:id.
export const exportDesignations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sortBy = 'name', sortOrder = 'asc' } = req.query;
    const {
      whereClause,
      queryParams: values,
      nextParamIndex: paramIndex,
    } = buildDesignationsWhereClause(req);

    const sortByStr = typeof sortBy === 'string' ? sortBy : 'name';
    const sortOrderStr = typeof sortOrder === 'string' ? sortOrder : 'asc';
    const sortCol = DESIGNATION_SORT_MAP[sortByStr] || DESIGNATION_SORT_MAP.name;
    const sortDir: 'ASC' | 'DESC' = sortOrderStr.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const rowsRes = await query(
      `SELECT
         d.id, d.name, d.description, d.is_active,
         d.created_at, d.updated_at,
         dept.name as "departmentName",
         (SELECT COUNT(*) FROM users u WHERE u.designation_id = d.id) as "userCount"
       FROM designations d
       LEFT JOIN departments dept ON d.department_id = dept.id
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir} NULLS LAST
       LIMIT $${paramIndex}`,
      [...values, DESIGNATION_EXPORT_ROW_LIMIT]
    );

    // Audit row PRE-stream (DPDP §11 pattern).
    await createAuditLog({
      action: 'DESIGNATION_EXPORTED',
      entityType: 'designation',
      userId: req.user?.id,
      details: { recordCount: rowsRes.rows.length, filters: req.query },
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Designations');
    ws.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Name', key: 'name', width: 32 },
      { header: 'Description', key: 'description', width: 48 },
      { header: 'Department', key: 'departmentName', width: 24 },
      { header: 'Users', key: 'userCount', width: 8 },
      { header: 'Active', key: 'is_active', width: 8 },
      { header: 'Created', key: 'created_at', width: 20 },
      { header: 'Updated', key: 'updated_at', width: 20 },
    ];
    for (const row of rowsRes.rows) {
      ws.addRow(escapeFormulaRow(row));
    }

    const filename = `designations_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const buffer = await wb.xlsx.writeBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    logger.error('Error exporting designations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export designations',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/designations/:id - Get designation by ID
export const getDesignationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const designationQuery = `
      SELECT
        d.id,
        d.name,
        d.description,
        d.department_id,
        dept.name as "departmentName",
        d.is_active,
        d.created_at,
        d.updated_at,
        creator.name as "createdByName",
        updater.name as "updatedByName"
      FROM designations d
      LEFT JOIN departments dept ON d.department_id = dept.id
      LEFT JOIN users creator ON d.created_by = creator.id
      LEFT JOIN users updater ON d.updated_by = updater.id
      WHERE d.id = $1
    `;

    const result = await query(designationQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error retrieving designation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve designation',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/designations - Create new designation
export const createDesignation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, departmentId } = req.body;
    const userId = req.user!.id;

    // Check duplicate name
    const existing = await query('SELECT id FROM designations WHERE name = $1', [name]);
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Designation name already exists',
        error: { code: 'DUPLICATE_NAME' },
      });
    }

    // Validate departmentId if provided
    if (departmentId) {
      const dept = await query('SELECT id FROM departments WHERE id = $1', [departmentId]);
      if (dept.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Department not found',
          error: { code: 'INVALID_DEPARTMENT' },
        });
      }
    }

    const result = await query(
      `INSERT INTO designations (name, description, department_id, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description || null, departmentId || null, userId]
    );

    logger.info(`Designation created: ${name}`, { userId });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Designation created successfully',
    });
  } catch (error) {
    logger.error('Error creating designation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create designation',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/designations/:id - Update designation
export const updateDesignation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, departmentId, isActive } = req.body;
    const userId = req.user!.id;

    const existing = await query('SELECT id, name FROM designations WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    if (name && name !== existing.rows[0].name) {
      const nameConflict = await query('SELECT id FROM designations WHERE name = $1 AND id != $2', [
        name,
        id,
      ]);
      if (nameConflict.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Designation name already exists',
          error: { code: 'DUPLICATE_NAME' },
        });
      }
    }

    if (departmentId !== undefined && departmentId !== null) {
      const dept = await query('SELECT id FROM departments WHERE id = $1', [departmentId]);
      if (dept.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Department not found',
          error: { code: 'INVALID_DEPARTMENT' },
        });
      }
    }

    // COALESCE on every field — omitted fields preserve existing values
    // (B6 don't-regress: silent destructive UPDATE is a real bug class).
    const updateQuery = `
      UPDATE designations
      SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        department_id = COALESCE($3, department_id),
        is_active = COALESCE($4, is_active),
        updated_by = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING id, name, description, department_id, is_active, created_at, updated_at
    `;

    const result = await query(updateQuery, [
      name || null,
      description !== undefined ? description : null,
      departmentId !== undefined ? departmentId : null,
      typeof isActive === 'boolean' ? isActive : null,
      userId,
      id,
    ]);

    logger.info(`Designation updated: ${result.rows[0].name}`, { designationId: id, userId });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Designation updated successfully',
    });
  } catch (error) {
    logger.error('Error updating designation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update designation',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/designations/:id - Delete designation
export const deleteDesignation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const existing = await query('SELECT id, name FROM designations WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Block delete if any user references it.
    const usage = await query('SELECT COUNT(*) as count FROM users WHERE designation_id = $1', [
      id,
    ]);
    if (parseInt(usage.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete designation that has assigned users',
        error: { code: 'DESIGNATION_IN_USE' },
      });
    }

    await query('DELETE FROM designations WHERE id = $1', [id]);

    logger.info(`Designation deleted: ${existing.rows[0].name}`, { designationId: id, userId });

    res.json({
      success: true,
      message: 'Designation deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting designation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete designation',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/designations/active - dropdown helper (back-compat for existing
// user-create/edit dialogs).
export const getActiveDesignations = async (req: Request, res: Response) => {
  try {
    const { departmentId } = req.query;
    const conds = ['is_active = true'];
    const values: (string | number)[] = [];
    if (departmentId) {
      conds.push(`department_id = $${values.length + 1}`);
      values.push(Number(departmentId));
    }
    const result = await query(
      `SELECT id, name, department_id, (SELECT name FROM departments WHERE id = d.department_id) as "departmentName"
       FROM designations d
       WHERE ${conds.join(' AND ')}
       ORDER BY name ASC`,
      values
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching active designations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active designations',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
