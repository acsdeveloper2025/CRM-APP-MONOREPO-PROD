import type { Response } from 'express';
import ExcelJS from 'exceljs';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { createAuditLog } from '@/utils/auditLogger';
import { escapeFormulaRow } from '@/utils/formulaGuard';
import {
  ACTIVITY_SORT_MAP,
  USER_EXPORT_ROW_LIMIT,
  buildUserActivitiesWhereClause,
} from './queryBuilder';

export const getUserActivities = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const {
      whereClause,
      queryParams,
      nextParamIndex: paramIndex,
    } = await buildUserActivitiesWhereClause(req);

    const countQuery = `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`;
    const countResult = await query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    const offset = (page - 1) * limit;
    const activitiesQuery = `
      SELECT
        al.id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.created_at,
        al.ip_address,
        al.user_agent,
        al.details,
        al.user_id,
        u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY ${ACTIVITY_SORT_MAP[req.query.sortBy as string] ?? 'al.created_at'} ${sortOrder} NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await query(activitiesQuery, [...queryParams, limit, offset]);

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
    logger.error('Error fetching user activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user activities',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/users/activities/stats — canonical 5-card aggregate.
export const getUserActivitiesStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { whereClause, queryParams } = await buildUserActivitiesWhereClause(req);
    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE al.created_at >= CURRENT_DATE) as today,
        COUNT(*) FILTER (WHERE al.created_at >= NOW() - INTERVAL '7 days') as last7days,
        COUNT(*) FILTER (WHERE al.created_at >= NOW() - INTERVAL '30 days') as last30days,
        COUNT(DISTINCT al.user_id) as unique_users
      FROM audit_logs al
      ${whereClause}
    `;
    const result = await query(statsQuery, queryParams);
    const row = (result.rows[0] || {}) as Record<string, unknown>;
    const num = (k: string) => Number(row[k] ?? 0);
    res.json({
      success: true,
      data: {
        total: num('total'),
        today: num('today'),
        last7Days: num('last7days'),
        last30Days: num('last30days'),
        uniqueUsers: num('unique_users'),
      },
    });
  } catch (error) {
    logger.error('Error fetching user activities stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user activities stats',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/users/activities/export — xlsx using shared WHERE helper.
export const exportUserActivities = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const {
      whereClause,
      queryParams,
      nextParamIndex: paramIndex,
    } = await buildUserActivitiesWhereClause(req);

    const dataQuery = `
      SELECT
        al.action,
        al.entity_type as "entityType",
        al.entity_id as "entityId",
        al.created_at as "createdAt",
        al.ip_address as "ipAddress",
        al.user_agent as "userAgent",
        al.details,
        u.name as "userName",
        u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY ${ACTIVITY_SORT_MAP[req.query.sortBy as string] ?? 'al.created_at'} ${sortOrder} NULLS LAST
      LIMIT $${paramIndex}
    `;
    const result = await query(dataQuery, [...queryParams, USER_EXPORT_ROW_LIMIT]);
    const rows = result.rows;

    await createAuditLog({
      userId: req.user?.id,
      action: 'USER_ACTIVITY_EXPORTED',
      entityType: 'audit_logs',
      details: { recordCount: rows.length, filters: req.query },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('User Activity');
    worksheet.columns = [
      { header: 'Date', key: 'createdAt', width: 22 },
      { header: 'User', key: 'userName', width: 25 },
      { header: 'Username', key: 'username', width: 20 },
      { header: 'Action', key: 'action', width: 28 },
      { header: 'Entity', key: 'entityType', width: 18 },
      { header: 'Entity ID', key: 'entityId', width: 28 },
      { header: 'IP Address', key: 'ipAddress', width: 18 },
      { header: 'User Agent', key: 'userAgent', width: 40 },
      { header: 'Details', key: 'details', width: 60 },
    ];
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };

    rows.forEach(
      (r: {
        createdAt: string;
        userName?: string;
        username?: string;
        action: string;
        entityType?: string;
        entityId?: string;
        ipAddress?: string;
        userAgent?: string;
        details?: unknown;
      }) => {
        worksheet.addRow(
          escapeFormulaRow({
            createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
            userName: r.userName,
            username: r.username,
            action: r.action,
            entityType: r.entityType,
            entityId: r.entityId,
            ipAddress: r.ipAddress,
            userAgent: r.userAgent,
            details: r.details ? JSON.stringify(r.details) : '',
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
      `attachment; filename=user_activity_${new Date().toISOString().split('T')[0]}.xlsx`
    );
    res.send(buffer);
  } catch (error) {
    logger.error('Error exporting user activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export user activities',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
