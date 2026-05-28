import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import type { AuthenticatedRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/auditLogger';
import { escapeFormulaRow } from '../utils/formulaGuard';

// Shared WHERE-clause builder for getDepartments + exportDepartments + getDepartmentStats
// so the three stay in lockstep. §9 canonical pattern.
const buildDepartmentsWhereClause = (
  req: AuthenticatedRequest
): {
  whereClause: string;
  queryParams: (string | number | boolean)[];
  nextParamIndex: number;
} => {
  const { search, isActive, createdFrom, createdTo } = req.query;
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

// Sort whitelist — keys are FE-facing camelCase, values are SQL fragments.
// Adding a sort goes here AND in the FE SORT_OPTIONS const.
const DEPARTMENT_SORT_MAP: Record<string, string> = {
  name: 'd.name',
  createdAt: 'd.created_at',
  updatedAt: 'd.updated_at',
};

const DEPARTMENT_EXPORT_ROW_LIMIT = 10000;

// GET /api/departments - List departments with pagination + canonical filters
export const getDepartments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = req.query;
    const safeLimit = Math.min(500, Math.max(1, Number(limit) || 20));
    const safePage = Math.max(1, Number(page) || 1);

    const {
      whereClause,
      queryParams: values,
      nextParamIndex: paramIndex,
    } = buildDepartmentsWhereClause(req);

    const sortByStr = typeof sortBy === 'string' ? sortBy : 'name';
    const sortOrderStr = typeof sortOrder === 'string' ? sortOrder : 'asc';
    const sortCol = DEPARTMENT_SORT_MAP[sortByStr] || DEPARTMENT_SORT_MAP.name;
    const sortDir: 'ASC' | 'DESC' = sortOrderStr.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Total count
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM departments d ${whereClause}`,
      values
    );
    const totalCount = Number(countRes.rows[0]?.count || 0);

    // Page slice
    const offset = (safePage - 1) * safeLimit;
    const listRes = await query(
      `SELECT
         d.*,
         dh.name as "departmentHeadName",
         u1.name as "createdByName",
         u2.name as "updatedByName",
         (SELECT COUNT(*) FROM users WHERE department_id = d.id) as "userCount"
       FROM departments d
       LEFT JOIN users dh ON d.department_head_id = dh.id
       LEFT JOIN users u1 ON d.created_by = u1.id
       LEFT JOIN users u2 ON d.updated_by = u2.id
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir} NULLS LAST
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, safeLimit, offset]
    );

    logger.info('Retrieved departments', {
      userId: req.user?.id,
      total: totalCount,
      pagination: { page, limit },
    });

    res.json({
      success: true,
      data: listRes.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / safeLimit),
      },
    });
  } catch (error) {
    logger.error('Error retrieving departments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve departments',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/departments/stats - canonical 5-card aggregate
// Route MUST be declared BEFORE /:id (Express matches in declaration order).
export const getDepartmentStats = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const r = await query<{
      total: string;
      active: string;
      inactive: string;
      recently_added: string;
      with_users: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE is_active = true)::text AS active,
         COUNT(*) FILTER (WHERE is_active = false)::text AS inactive,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::text AS recently_added,
         COUNT(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM users u WHERE u.department_id = departments.id
         ))::text AS with_users
       FROM departments`
    );
    const row = r.rows[0] || {
      total: '0',
      active: '0',
      inactive: '0',
      recently_added: '0',
      with_users: '0',
    };
    res.json({
      success: true,
      data: {
        total: Number(row.total),
        active: Number(row.active),
        inactive: Number(row.inactive),
        recentlyAddedCount: Number(row.recently_added),
        withUsersCount: Number(row.with_users),
      },
    });
  } catch (error) {
    logger.error('Error fetching department stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department stats',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/departments/export - xlsx export mirroring list filters + sort.
// Route MUST be declared BEFORE /:id (Express matches in declaration order).
export const exportDepartments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sortBy = 'name', sortOrder = 'asc' } = req.query;
    const {
      whereClause,
      queryParams: values,
      nextParamIndex: paramIndex,
    } = buildDepartmentsWhereClause(req);

    const sortByStr = typeof sortBy === 'string' ? sortBy : 'name';
    const sortOrderStr = typeof sortOrder === 'string' ? sortOrder : 'asc';
    const sortCol = DEPARTMENT_SORT_MAP[sortByStr] || DEPARTMENT_SORT_MAP.name;
    const sortDir: 'ASC' | 'DESC' = sortOrderStr.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const rowsRes = await query(
      `SELECT
         d.id, d.name, d.description, d.is_active,
         d.created_at, d.updated_at,
         dh.name as "departmentHeadName",
         (SELECT COUNT(*) FROM users WHERE department_id = d.id) as "userCount"
       FROM departments d
       LEFT JOIN users dh ON d.department_head_id = dh.id
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir} NULLS LAST
       LIMIT $${paramIndex}`,
      [...values, DEPARTMENT_EXPORT_ROW_LIMIT]
    );

    // Audit row PRE-stream (DPDP §11 pattern).
    await createAuditLog({
      action: 'DEPARTMENT_EXPORTED',
      entityType: 'department',
      userId: req.user?.id,
      details: { recordCount: rowsRes.rows.length, filters: req.query },
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Departments');
    ws.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Name', key: 'name', width: 32 },
      { header: 'Description', key: 'description', width: 48 },
      { header: 'Head', key: 'departmentHeadName', width: 24 },
      { header: 'Users', key: 'userCount', width: 8 },
      { header: 'Active', key: 'is_active', width: 8 },
      { header: 'Created', key: 'created_at', width: 20 },
      { header: 'Updated', key: 'updated_at', width: 20 },
    ];
    for (const row of rowsRes.rows) {
      ws.addRow(escapeFormulaRow(row));
    }

    const filename = `departments_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const buffer = await wb.xlsx.writeBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    logger.error('Error exporting departments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export departments',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/departments/:id - Get department by ID
export const getDepartmentById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const departmentQuery = `
      SELECT
        d.*,
        dh.name as "department_head_name",
        u1.name as "created_by_name",
        u2.name as "updated_by_name",
        (SELECT COUNT(*) FROM users WHERE department_id = d.id) as "user_count"
      FROM departments d
      LEFT JOIN users dh ON d.department_head_id = dh.id
      LEFT JOIN users u1 ON d.created_by = u1.id
      LEFT JOIN users u2 ON d.updated_by = u2.id
      WHERE d.id = $1
    `;

    const result = await query(departmentQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
        error: { code: 'DEPARTMENT_NOT_FOUND' },
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error retrieving department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve department',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/departments - Create new department
export const createDepartment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, departmentHeadId } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Department name is required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    const existingDepartment = await query('SELECT id FROM departments WHERE name = $1', [name]);
    if (existingDepartment.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Department name already exists',
        error: { code: 'DUPLICATE_DEPARTMENT_NAME' },
      });
    }

    if (departmentHeadId) {
      const headExists = await query('SELECT id FROM users WHERE id = $1', [departmentHeadId]);
      if (headExists.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Department head user not found',
          error: { code: 'INVALID_DEPARTMENT_HEAD' },
        });
      }
    }

    const createQuery = `
      INSERT INTO departments (name, description, department_head_id, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await query(createQuery, [
      name,
      description || null,
      departmentHeadId || null,
      req.user?.id,
    ]);

    logger.info('Created new department', {
      userId: req.user?.id,
      departmentId: result.rows[0].id,
      departmentName: name,
    });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Department created successfully',
    });
  } catch (error) {
    logger.error('Error creating department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create department',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/departments/:id - Update department
export const updateDepartment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, departmentHeadId, isActive } = req.body;

    const existingDepartment = await query(
      'SELECT id, name, description, is_active, created_at, updated_at FROM departments WHERE id = $1',
      [id]
    );
    if (existingDepartment.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
        error: { code: 'DEPARTMENT_NOT_FOUND' },
      });
    }

    if (name && name !== existingDepartment.rows[0].name) {
      const duplicateDepartment = await query(
        'SELECT id FROM departments WHERE name = $1 AND id != $2',
        [name, id]
      );
      if (duplicateDepartment.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Department name already exists',
          error: { code: 'DUPLICATE_DEPARTMENT_NAME' },
        });
      }
    }

    if (departmentHeadId) {
      const headExists = await query('SELECT id FROM users WHERE id = $1', [departmentHeadId]);
      if (headExists.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Department head user not found',
          error: { code: 'INVALID_DEPARTMENT_HEAD' },
        });
      }
    }

    // Update uses COALESCE for every field so omitted fields preserve existing
    // values (B6 don't-regress — silent destructive write is a real bug class).
    const updateQuery = `
      UPDATE departments
      SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        department_head_id = COALESCE($3, department_head_id),
        is_active = COALESCE($4, is_active),
        updated_by = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;

    const result = await query(updateQuery, [
      name || null,
      description !== undefined ? description : null,
      departmentHeadId !== undefined ? departmentHeadId : null,
      typeof isActive === 'boolean' ? isActive : null,
      req.user?.id,
      id,
    ]);

    logger.info('Updated department', {
      userId: req.user?.id,
      departmentId: id,
      departmentName: result.rows[0].name,
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Department updated successfully',
    });
  } catch (error) {
    logger.error('Error updating department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update department',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/departments/:id - Delete department
export const deleteDepartment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingDepartment = await query(
      'SELECT id, name, description, is_active, created_at, updated_at FROM departments WHERE id = $1',
      [id]
    );
    if (existingDepartment.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
        error: { code: 'DEPARTMENT_NOT_FOUND' },
      });
    }

    const usageCheck = await query('SELECT COUNT(*) as count FROM users WHERE department_id = $1', [
      id,
    ]);
    if (parseInt(usageCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete department that has assigned users',
        error: { code: 'DEPARTMENT_IN_USE' },
      });
    }

    await query('DELETE FROM departments WHERE id = $1', [id]);

    logger.info('Deleted department', {
      userId: req.user?.id,
      departmentId: id,
      departmentName: existingDepartment.rows[0].name,
    });

    res.json({
      success: true,
      message: 'Department deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete department',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
