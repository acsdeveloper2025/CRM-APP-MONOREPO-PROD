import type { Response } from 'express';
import ExcelJS from 'exceljs';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { createAuditLog } from '@/utils/auditLogger';
import { escapeFormulaRow } from '@/utils/formulaGuard';
import {
  SESSION_SORT_MAP,
  USER_EXPORT_ROW_LIMIT,
  buildUserSessionsWhereClause,
} from './queryBuilder';

// GET /api/users/sessions - Get user refresh token sessions
export const getUserSessions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const {
      whereClause,
      queryParams,
      nextParamIndex: paramIndex,
    } = buildUserSessionsWhereClause(req);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM refresh_tokens rt
      LEFT JOIN users u ON rt.user_id = u.id
      ${whereClause}
    `;
    const countResult = await query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    const offset = (page - 1) * limit;
    const sessionsQuery = `
      SELECT
        rt.id,
        rt.user_id,
        rt.created_at,
        rt.expires_at,
        rt.ip_address,
        rt.user_agent,
        rt.revoked_at,
        rt.revoked_reason,
        -- 2026-04-28 F1.7.2: a token is "active" only if not expired AND not revoked.
        (rt.expires_at > CURRENT_TIMESTAMP AND rt.revoked_at IS NULL) as is_active,
        u.name as user_name,
        u.username
      FROM refresh_tokens rt
      LEFT JOIN users u ON rt.user_id = u.id
      ${whereClause}
      ORDER BY ${SESSION_SORT_MAP[req.query.sortBy as string] ?? 'rt.created_at'} ${sortOrder} NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const result = await query(sessionsQuery, [...queryParams, limit, offset]);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching user sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user sessions',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/users/sessions/stats — canonical 5-card aggregate.
export const getUserSessionsStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { whereClause, queryParams } = buildUserSessionsWhereClause(req);
    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (
          WHERE rt.expires_at > CURRENT_TIMESTAMP AND rt.revoked_at IS NULL
        ) as active,
        COUNT(*) FILTER (
          WHERE rt.expires_at <= CURRENT_TIMESTAMP AND rt.revoked_at IS NULL
        ) as expired,
        COUNT(*) FILTER (WHERE rt.revoked_at IS NOT NULL) as revoked,
        COUNT(DISTINCT rt.user_id) as unique_users
      FROM refresh_tokens rt
      LEFT JOIN users u ON rt.user_id = u.id
      ${whereClause}
    `;
    const result = await query(statsQuery, queryParams);
    const row = (result.rows[0] || {}) as Record<string, unknown>;
    const num = (k: string) => Number(row[k] ?? 0);
    res.json({
      success: true,
      data: {
        total: num('total'),
        active: num('active'),
        expired: num('expired'),
        revoked: num('revoked'),
        uniqueUsers: num('unique_users'),
      },
    });
  } catch (error) {
    logger.error('Error fetching user sessions stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user sessions stats',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/users/sessions/export — xlsx using shared WHERE helper.
export const exportUserSessions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const {
      whereClause,
      queryParams,
      nextParamIndex: paramIndex,
    } = buildUserSessionsWhereClause(req);

    const dataQuery = `
      SELECT
        u.name as "userName",
        u.username,
        rt.ip_address as "ipAddress",
        rt.user_agent as "userAgent",
        rt.device_label as "deviceLabel",
        (rt.expires_at > CURRENT_TIMESTAMP AND rt.revoked_at IS NULL) as "isActive",
        rt.created_at as "createdAt",
        rt.expires_at as "expiresAt",
        rt.revoked_at as "revokedAt",
        rt.revoked_reason as "revokedReason"
      FROM refresh_tokens rt
      LEFT JOIN users u ON rt.user_id = u.id
      ${whereClause}
      ORDER BY ${SESSION_SORT_MAP[req.query.sortBy as string] ?? 'rt.created_at'} ${sortOrder} NULLS LAST
      LIMIT $${paramIndex}
    `;
    const result = await query(dataQuery, [...queryParams, USER_EXPORT_ROW_LIMIT]);
    const rows = result.rows;

    await createAuditLog({
      userId: req.user?.id,
      action: 'USER_SESSION_EXPORTED',
      entityType: 'refresh_tokens',
      details: { recordCount: rows.length, filters: req.query },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('User Sessions');
    worksheet.columns = [
      { header: 'User', key: 'userName', width: 25 },
      { header: 'Username', key: 'username', width: 20 },
      { header: 'IP Address', key: 'ipAddress', width: 18 },
      { header: 'User Agent', key: 'userAgent', width: 40 },
      { header: 'Device', key: 'deviceLabel', width: 22 },
      { header: 'Status', key: 'isActive', width: 10 },
      { header: 'Created At', key: 'createdAt', width: 22 },
      { header: 'Expires At', key: 'expiresAt', width: 22 },
      { header: 'Revoked At', key: 'revokedAt', width: 22 },
      { header: 'Revoked Reason', key: 'revokedReason', width: 30 },
    ];
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };

    rows.forEach(
      (r: {
        userName?: string;
        username?: string;
        ipAddress?: string;
        userAgent?: string;
        deviceLabel?: string;
        isActive: boolean;
        createdAt: string;
        expiresAt?: string;
        revokedAt?: string;
        revokedReason?: string;
      }) => {
        worksheet.addRow(
          escapeFormulaRow({
            userName: r.userName,
            username: r.username,
            ipAddress: r.ipAddress,
            userAgent: r.userAgent,
            deviceLabel: r.deviceLabel,
            isActive: r.isActive ? 'Active' : 'Inactive',
            createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
            expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : '',
            revokedAt: r.revokedAt ? new Date(r.revokedAt).toISOString() : '',
            revokedReason: r.revokedReason,
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
      `attachment; filename=user_sessions_${new Date().toISOString().split('T')[0]}.xlsx`
    );
    res.send(buffer);
  } catch (error) {
    logger.error('Error exporting user sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export user sessions',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
