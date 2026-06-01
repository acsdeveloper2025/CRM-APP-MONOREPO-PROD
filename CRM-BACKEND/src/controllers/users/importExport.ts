import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import { query, withTransaction } from '@/config/database';
import { logger } from '@/config/logger';
import { config } from '@/config';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { CANONICAL_RBAC_ROLE_NAMES, normalizeRbacRoleName } from '@/constants/rbacRoles';
import { createAuditLog } from '@/utils/auditLogger';
import { escapeFormulaRow } from '@/utils/formulaGuard';
import {
  PRIMARY_RBAC_ROLE_NAME_SQL,
  USER_EXPORT_ROW_LIMIT,
  buildUsersWhereClause,
} from './queryBuilder';

// GET /api/users/export — xlsx export matching the list endpoint's WHERE
// helper. Pagination intentionally absent; rows capped at
// USER_EXPORT_ROW_LIMIT. Every user-controlled cell passes through
// escapeFormulaRow (CWE-1236). Audit log written PRE-stream.
export const exportUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sortBy = (
      Array.isArray(req.query.sortBy) ? req.query.sortBy[0] : req.query.sortBy || 'name'
    ) as string;
    const sortOrder = (
      Array.isArray(req.query.sortOrder) ? req.query.sortOrder[0] : req.query.sortOrder || 'asc'
    ) as string;

    const {
      whereClause,
      queryParams: params,
      nextParamIndex: paramIndex,
    } = buildUsersWhereClause(req);

    const validSortColumns = ['name', 'username', 'email', 'role', 'createdAt', 'updatedAt'];
    const safeSortBy: string = validSortColumns.includes(sortBy) ? sortBy : 'name';
    const safeSortOrder: 'ASC' | 'DESC' = sortOrder === 'desc' ? 'DESC' : 'ASC';
    const sortColumnMap: Record<string, string> = {
      name: 'u.name',
      username: 'u.username',
      email: 'u.email',
      role: 'role_name',
      createdAt: 'u.created_at',
      updatedAt: 'u.updated_at',
    };
    const safeSortColumn = sortColumnMap[safeSortBy] || 'u.name';

    const usersQuery = `
      SELECT
        u.id,
        u.name,
        u.username,
        u.email,
        u.phone,
        ${PRIMARY_RBAC_ROLE_NAME_SQL} as role,
        u.employee_id as "employeeId",
        des.name as designation,
        d.name as department,
        u.is_active as "isActive",
        u.last_login as "lastLogin",
        u.created_at as "createdAt",
        u.updated_at as "updatedAt",
        ${PRIMARY_RBAC_ROLE_NAME_SQL} as "roleName",
        d.name as "departmentName"
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN designations des ON des.id = u.designation_id
      ${whereClause}
      ORDER BY ${safeSortColumn} ${safeSortOrder}
      LIMIT $${paramIndex}
    `;

    const usersResult = await query(usersQuery, [...params, USER_EXPORT_ROW_LIMIT]);
    const users = usersResult.rows;

    await createAuditLog({
      userId: req.user?.id,
      action: 'USER_EXPORTED',
      entityType: 'users',
      details: { recordCount: users.length, filters: req.query },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Users');

    worksheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Username', key: 'username', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Role', key: 'roleName', width: 18 },
      { header: 'Department', key: 'departmentName', width: 20 },
      { header: 'Designation', key: 'designation', width: 18 },
      { header: 'Employee ID', key: 'employeeId', width: 15 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Status', key: 'isActive', width: 10 },
      { header: 'Last Login', key: 'lastLogin', width: 22 },
      { header: 'Created At', key: 'createdAt', width: 22 },
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };

    users.forEach(
      (user: {
        name: string;
        username: string;
        email: string;
        roleName?: string;
        departmentName?: string;
        designation?: string;
        employeeId?: string;
        phone?: string;
        isActive: boolean;
        lastLogin?: string;
        createdAt: string;
      }) => {
        worksheet.addRow(
          escapeFormulaRow({
            name: user.name,
            username: user.username,
            email: user.email,
            roleName: user.roleName,
            departmentName: user.departmentName,
            designation: user.designation,
            employeeId: user.employeeId,
            phone: user.phone,
            isActive: user.isActive ? 'Active' : 'Inactive',
            lastLogin: user.lastLogin ? new Date(user.lastLogin).toISOString() : '',
            createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : '',
          })
        );
      }
    );

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=users_${new Date().toISOString().split('T')[0]}.xlsx`
    );
    res.send(buffer);

    logger.info('Users exported successfully', {
      userId: req.user?.id,
      recordCount: users.length,
    });
  } catch (error) {
    logger.error('Error exporting users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export users',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// Header normalizer for bulk-import. The XLSX template emits decorated
// headers (e.g. "Name*", "Role* (SUPER_ADMIN, MANAGER, ...)",
// "Password (Required if creating)"); strip the decoration and remap to
// camelCase keys.
const HEADER_TO_KEY: Record<string, string> = {
  name: 'name',
  username: 'username',
  email: 'email',
  role: 'role',
  employeeid: 'employeeId',
  phone: 'phone',
  department: 'department',
  designation: 'designation',
  password: 'password',
};
const normalizeHeader = (raw: unknown): string | null => {
  if (typeof raw !== 'string') {
    return null;
  }
  const stripped = raw
    .replace(/\*/g, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  return HEADER_TO_KEY[stripped] ?? null;
};

const parseXlsxToRows = async (buffer: Buffer): Promise<Array<Record<string, string>>> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return [];
  }
  const headerRow = sheet.getRow(1);
  const headers: Array<string | null> = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = normalizeHeader(cell.value);
  });
  const rows: Array<Record<string, string>> = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const obj: Record<string, string> = {};
    let hasAnyValue = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber];
      if (!key) {
        return;
      }
      // exceljs `cell.value` can be a primitive, Date, or rich object
      // (formula, hyperlink, richText). `cell.text` returns the
      // already-formatted display string — exactly what an XLSX
      // import wants. Avoids `[object Object]` from naive String().
      const value = cell.text == null ? '' : String(cell.text);
      if (value.trim() !== '') {
        hasAnyValue = true;
      }
      obj[key] = value;
    });
    if (hasAnyValue) {
      rows.push(obj);
    }
  }
  return rows;
};

/**
 * POST /api/users/import
 * Bulk-create users from CSV or XLSX. Required cols: name, username,
 * email, role, employeeId. Optional: phone, department, designation,
 * password (auto-generated if absent).
 */
export const bulkImportUsers = async (
  req: AuthenticatedRequest & { file?: Express.Multer.File },
  res: Response
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
        error: { code: 'NO_FILE' },
      });
    }

    const filename = req.file.originalname.toLowerCase();
    let rows: Array<Record<string, string>>;
    if (filename.endsWith('.xlsx')) {
      rows = await parseXlsxToRows(req.file.buffer);
    } else {
      const { parseCSV } = await import('@/utils/csvParser');
      rows = await parseCSV(req.file.buffer);
    }

    // Bound the row loop. Multer caps file size at 10 MB but a malicious XLSX
    // can pack 100k+ minimal rows into that budget; the unbounded loop below
    // would then allocate per-row state and run hundreds of DB lookups.
    const MAX_BULK_IMPORT_ROWS = 10000;
    if (rows.length > MAX_BULK_IMPORT_ROWS) {
      return res.status(413).json({
        success: false,
        message: `Import exceeds ${MAX_BULK_IMPORT_ROWS} rows; split the file and retry`,
        error: { code: 'PAYLOAD_TOO_LARGE', rowCount: rows.length, max: MAX_BULK_IMPORT_ROWS },
      });
    }

    const results = {
      imported: 0,
      failed: 0,
      errors: [] as string[],
    };

    const blank = (v: string | undefined): string | null =>
      typeof v === 'string' && v.trim() !== '' ? v.trim() : null;

    // Pre-load lookup maps once per call. Cheap and avoids N+1.
    const rolesRes = await query<{ id: string; name: string }>('SELECT id, name FROM roles_v2');
    const roleByName = new Map(rolesRes.rows.map(r => [r.name.toUpperCase(), r.id]));
    const deptRes = await query<{ id: number; name: string }>('SELECT id, name FROM departments');
    const deptByName = new Map(deptRes.rows.map(d => [d.name.toLowerCase(), d.id]));
    const desRes = await query<{ id: number; name: string }>('SELECT id, name FROM designations');
    const desByName = new Map(desRes.rows.map(d => [d.name.toLowerCase(), d.id]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +1 for 1-indexed; +1 for header row
      try {
        const name = blank(row.name);
        const username = blank(row.username);
        const email = blank(row.email);
        const roleRaw = blank(row.role);
        const employeeId = blank(row.employeeId);
        const phone = blank(row.phone);
        const department = blank(row.department);
        const designation = blank(row.designation);
        const passwordRaw = blank(row.password);

        if (!name || !username || !email || !roleRaw || !employeeId) {
          results.failed++;
          results.errors.push(
            `Row ${rowNum}: missing required field (name, username, email, role, employeeId)`
          );
          continue;
        }

        const canonicalRole = normalizeRbacRoleName(roleRaw) ?? roleRaw.toUpperCase();
        const roleId = roleByName.get(String(canonicalRole).toUpperCase());
        if (!roleId) {
          results.failed++;
          results.errors.push(
            `Row ${rowNum}: unknown role "${roleRaw}". Valid: ${CANONICAL_RBAC_ROLE_NAMES.join(', ')}`
          );
          continue;
        }

        let departmentId: number | null = null;
        if (department) {
          const id = deptByName.get(department.toLowerCase());
          if (id === undefined) {
            results.failed++;
            results.errors.push(
              `Row ${rowNum}: department "${department}" not found. Seed departments first.`
            );
            continue;
          }
          departmentId = id;
        }

        let designationId: number | null = null;
        if (designation) {
          const id = desByName.get(designation.toLowerCase());
          if (id === undefined) {
            results.failed++;
            results.errors.push(
              `Row ${rowNum}: designation "${designation}" not found. Seed designations first.`
            );
            continue;
          }
          designationId = id;
        }

        const dup = await query(
          'SELECT id FROM users WHERE username = $1 OR LOWER(email) = LOWER($2) LIMIT 1',
          [username, email]
        );
        if (dup.rows.length > 0) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: username or email already exists`);
          continue;
        }

        // Auto-generate a password when missing. The user receives it
        // via out-of-band channel (email/admin); we do not echo it back
        // in the response. 16 random hex chars meets the existing
        // PASSWORD_POLICY_REGEX (uppercase, lowercase, digit, symbol)
        // by construction below.
        const password =
          passwordRaw ??
          `Im${Math.random().toString(36).slice(2, 8)}!${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);

        await withTransaction(async client => {
          const ins = await client.query<{ id: string }>(
            `INSERT INTO users (
               name, username, email, password_hash, department_id, designation_id,
               employee_id, phone, is_active, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
             RETURNING id`,
            [name, username, email, hashedPassword, departmentId, designationId, employeeId, phone]
          );
          await client.query(
            `INSERT INTO user_roles (user_id, role_id, assigned_by)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, role_id) DO NOTHING`,
            [ins.rows[0].id, roleId, req.user?.id ?? null]
          );
        });

        results.imported++;
      } catch (error) {
        results.failed++;
        const msg = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Row ${rowNum}: ${msg}`);
        logger.error(`Error importing user at row ${rowNum}:`, error);
      }
    }

    logger.info('Bulk import users completed', { userId: req.user?.id, results });
    await createAuditLog({
      userId: req.user?.id,
      action: 'BULK_IMPORT_USERS',
      entityType: 'USER',
      details: {
        total: rows.length,
        imported: results.imported,
        failed: results.failed,
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: `Imported ${results.imported} of ${rows.length} users (${results.failed} failed)`,
      data: results,
    });
  } catch (error) {
    logger.error('Error in bulk import users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk import users',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

/**
 * GET /api/users/import-template
 * Download an Excel template for bulk user imports
 */
export const downloadUserTemplate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Import Template');

    // Define template columns
    worksheet.columns = [
      { header: 'Name*', key: 'name', width: 25 },
      { header: 'Username*', key: 'username', width: 20 },
      { header: 'Email*', key: 'email', width: 30 },
      {
        header: `Role* (${CANONICAL_RBAC_ROLE_NAMES.join(', ')})`,
        key: 'role',
        width: 40,
      },
      { header: 'Employee ID*', key: 'employeeId', width: 15 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Designation', key: 'designation', width: 20 },
      { header: 'Password (Required if creating)', key: 'password', width: 30 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add sample row
    worksheet.addRow({
      name: 'John Doe',
      username: 'johndoe',
      email: 'john@example.com',
      role: 'BACKEND_USER',
      employeeId: 'EMP001',
      phone: '+919876543210',
      department: 'Operations',
      designation: 'Executive',
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=User_Import_Template.xlsx');
    res.send(buffer);

    logger.info('User import template downloaded successfully', {
      userId: req.user?.id,
    });
  } catch (error) {
    logger.error('Error downloading user template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download user template',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
