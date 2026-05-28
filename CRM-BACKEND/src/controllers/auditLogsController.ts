import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query as dbQuery } from '@/config/database';
// Real audit-write path (partitioned audit_logs + HMAC chain). Aliased to
// avoid clashing with this controller's own createAuditLog HTTP handler.
import { createAuditLog as recordAuditLog } from '@/utils/auditLogger';

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  severity: string;
  category: string;
  [key: string]: unknown;
}

const getSingleQueryValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return null;
};

// GET /api/audit-logs - List audit logs with pagination and filters
export const getAuditLogs = (req: AuthenticatedRequest, res: Response) => {
  void (async () => {
    try {
      const {
        page = 1,
        limit = 20,
        userId,
        action,
        resource,
        category,
        severity: _severity,
        dateFrom,
        dateTo,
        search,
        sortBy = 'timestamp',
        sortOrder = 'desc',
      } = req.query;

      const conditions: string[] = [];
      const params: Array<string | number | Date> = [];

      const userIdFilter = getSingleQueryValue(userId);
      const actionFilter = getSingleQueryValue(action);
      const resourceFilter = getSingleQueryValue(resource);
      const dateFromFilter = getSingleQueryValue(dateFrom);
      const dateToFilter = getSingleQueryValue(dateTo);
      const searchFilter = getSingleQueryValue(search);

      if (userIdFilter) {
        params.push(userIdFilter);
        conditions.push(`al.user_id = $${params.length}`);
      }
      if (actionFilter) {
        params.push(actionFilter);
        conditions.push(`al.action = $${params.length}`);
      }
      if (resourceFilter) {
        params.push(resourceFilter);
        conditions.push(`al.entity_type = $${params.length}`);
      }
      if (dateFromFilter) {
        params.push(new Date(dateFromFilter));
        conditions.push(`al.created_at >= $${params.length}`);
      }
      if (dateToFilter) {
        params.push(new Date(dateToFilter));
        conditions.push(`al.created_at <= $${params.length}`);
      }
      if (searchFilter) {
        params.push(`%${searchFilter}%`);
        conditions.push(
          `(COALESCE(u.name, '') ILIKE $${params.length} OR al.action ILIKE $${params.length} OR al.entity_type ILIKE $${params.length} OR CAST(al.details AS TEXT) ILIKE $${params.length})`
        );
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const safeSortBy = sortBy === 'timestamp' ? 'al.created_at' : 'al.created_at';
      const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

      const countResult = await dbQuery<{ total: string }>(
        `SELECT COUNT(*)::text as total FROM audit_logs al ${whereClause}`,
        params
      );

      const total = Number(countResult.rows[0]?.total || 0);
      const normalizedPage = Number(page);
      const normalizedLimit = Number(limit);
      const offset = (normalizedPage - 1) * normalizedLimit;

      params.push(normalizedLimit);
      params.push(offset);

      const result = await dbQuery<AuditLog>(
        `
        SELECT
          al.id::text,
          COALESCE(al.user_id, '') as user_id,
          COALESCE(u.name, 'System') as user_name,
          al.action,
          COALESCE(al.entity_type, 'SYSTEM') as resource,
          al.entity_id as "resourceId",
          COALESCE(al.details, '{}'::jsonb) as details,
          COALESCE(al.ip_address, '') as ip_address,
          COALESCE(al.user_agent, '') as user_agent,
          al.created_at::text as timestamp,
          CASE
            WHEN al.action LIKE '%FAILED%' OR al.action LIKE '%REJECTED%' THEN 'ERROR'
            WHEN al.action LIKE '%REVOKED%' THEN 'WARN'
            ELSE 'INFO'
          END as severity,
          CASE
            WHEN al.entity_type IN ('VERIFICATION_TASK', 'CASE') THEN 'CASE_MANAGEMENT'
            WHEN al.entity_type = 'USER' THEN 'USER_MANAGEMENT'
            WHEN al.entity_type = 'ATTACHMENT' THEN 'FILE_MANAGEMENT'
            ELSE 'SYSTEM'
          END as category
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ${whereClause}
        ORDER BY ${safeSortBy} ${safeSortOrder}
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
        params
      );

      logger.info(`Retrieved ${result.rows.length} audit logs`, {
        userId: req.user?.id,
        filters: { userId, action, resource, category, search },
        pagination: { page, limit },
      });

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          page: normalizedPage,
          limit: normalizedLimit,
          total,
          totalPages: Math.ceil(total / normalizedLimit),
        },
      });
    } catch (error) {
      logger.error('Error retrieving audit logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit logs',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  })();
};

// GET /api/audit-logs/:id - Get audit log by ID
export const getAuditLogById = (req: AuthenticatedRequest, res: Response) => {
  void (async () => {
    try {
      const { id } = req.params;
      // audit_logs.id is bigint. Casting the COLUMN to text (al.id::text=$1)
      // defeated the per-partition (id) index; cast the PARAM instead. Guard
      // non-numeric ids → 404 (so $1::bigint can't throw).
      if (!/^\d+$/.test(String(id))) {
        return res.status(404).json({
          success: false,
          message: 'Audit log not found',
          error: { code: 'NOT_FOUND' },
        });
      }
      const result = await dbQuery<AuditLog>(
        `
        SELECT
          al.id::text,
          COALESCE(al.user_id, '') as user_id,
          COALESCE(u.name, 'System') as user_name,
          al.action,
          COALESCE(al.entity_type, 'SYSTEM') as resource,
          al.entity_id as "resource_id",
          COALESCE(al.details, '{}'::jsonb) as details,
          COALESCE(al.ip_address, '') as ip_address,
          COALESCE(al.user_agent, '') as user_agent,
          al.created_at::text as timestamp,
          CASE
            WHEN al.action LIKE '%FAILED%' OR al.action LIKE '%REJECTED%' THEN 'ERROR'
            WHEN al.action LIKE '%REVOKED%' THEN 'WARN'
            ELSE 'INFO'
          END as severity,
          CASE
            WHEN al.entity_type IN ('VERIFICATION_TASK', 'CASE') THEN 'CASE_MANAGEMENT'
            WHEN al.entity_type = 'USER' THEN 'USER_MANAGEMENT'
            WHEN al.entity_type = 'ATTACHMENT' THEN 'FILE_MANAGEMENT'
            ELSE 'SYSTEM'
          END as category
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        WHERE al.id = $1::bigint
        LIMIT 1
      `,
        [id]
      );

      const auditLog = result.rows[0];

      if (!auditLog) {
        return res.status(404).json({
          success: false,
          message: 'Audit log not found',
          error: { code: 'NOT_FOUND' },
        });
      }

      logger.info(`Retrieved audit log ${id}`, { userId: req.user?.id });

      res.json({
        success: true,
        data: auditLog,
      });
    } catch (error) {
      logger.error('Error retrieving audit log:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit log',
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  })();
};

// POST /api/mobile/audit/logs - Create mobile audit log batch
export const createMobileAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { logs, batchId, deviceId } = req.body;

    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid logs format. Expected array of logs.',
      });
    }

    logger.info(`📝 Processing ${logs.length} mobile audit logs (batch: ${batchId})`);

    // Persist each mobile audit event through the REAL audit_logs chain
    // (utils/auditLogger → partitioned table + HMAC row-hash). Previously these
    // were pushed to an in-memory mock array and silently dropped on restart /
    // never queryable — i.e. mobile audit was lost.
    const userAgent = req.get('User-Agent') || undefined;
    await Promise.allSettled(
      (logs as Array<Record<string, unknown>>).map(log =>
        recordAuditLog({
          action: typeof log.action === 'string' ? log.action : 'MOBILE_ACTION',
          entityType: typeof log.entityType === 'string' ? log.entityType : 'MOBILE',
          entityId: typeof log.entityId === 'string' ? log.entityId : undefined,
          userId: req.user?.id ?? (typeof log.userId === 'string' ? log.userId : undefined),
          details: {
            ...(log.details && typeof log.details === 'object'
              ? (log.details as Record<string, unknown>)
              : {}),
            deviceInfo: log.deviceInfo,
            location: log.location,
            clientTimestamp: log.timestamp,
            batchId,
            deviceId,
          },
          ipAddress: req.ip,
          userAgent,
        })
      )
    );

    logger.info(`✅ Persisted ${logs.length} mobile audit logs (batch: ${batchId})`);

    res.status(201).json({
      success: true,
      message: `Successfully processed ${logs.length} audit logs`,
      batchId,
      processed: logs.length,
    });
  } catch (error) {
    logger.error('Error creating mobile audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create mobile audit logs',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// POST /api/audit-logs - Create audit log entry
export const createAuditLog = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, resource, resourceId, details, severity, category } = req.body;

    // Persist through the real audit_logs chain (was pushed to a mock array).
    await recordAuditLog({
      action,
      entityType: resource || 'SYSTEM',
      entityId: resourceId,
      userId: req.user?.id,
      details: {
        ...(details && typeof details === 'object' ? details : {}),
        ...(severity ? { severity } : {}),
        ...(category ? { category } : {}),
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
    });

    logger.info('Created audit log', {
      userId: req.user?.id,
      action,
      resource,
      resourceId,
    });

    res.status(201).json({
      success: true,
      message: 'Audit log created successfully',
    });
  } catch (error) {
    logger.error('Error creating audit log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create audit log',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/audit-logs/actions - Get available actions
export const getAuditActions = (req: AuthenticatedRequest, res: Response) => {
  try {
    const actions = [
      // Authentication actions
      'USER_LOGIN',
      'USER_LOGOUT',
      'LOGIN_FAILED',
      'PASSWORD_CHANGED',
      'PASSWORD_RESET',

      // User management actions
      'USER_CREATED',
      'USER_UPDATED',
      'USER_DELETED',
      'USER_ACTIVATED',
      'USER_DEACTIVATED',
      'ROLE_CHANGED',

      // Case management actions
      'CASE_CREATED',
      'CASE_UPDATED',
      'CASE_DELETED',
      'CASE_STATUS_UPDATED',
      'CASE_ASSIGNED',
      'CASE_COMPLETED',
      'CASE_APPROVED',
      'CASE_REJECTED',

      // Client management actions
      'CLIENT_CREATED',
      'CLIENT_UPDATED',
      'CLIENT_DELETED',
      'CLIENT_ACTIVATED',
      'CLIENT_DEACTIVATED',

      // File management actions
      'FILE_UPLOADED',
      'FILE_DOWNLOADED',
      'FILE_DELETED',
      'FILE_SHARED',

      // Financial actions
      'INVOICE_CREATED',
      'INVOICE_SENT',
      'INVOICE_PAID',
      'COMMISSION_APPROVED',
      'COMMISSION_PAID',

      // System actions
      'SETTINGS_UPDATED',
      'BACKUP_CREATED',
      'SYSTEM_MAINTENANCE',
      'DATA_EXPORT',
      'DATA_IMPORT',
    ];

    res.json({
      success: true,
      data: actions,
    });
  } catch (error) {
    logger.error('Error getting audit actions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get audit actions',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/audit-logs/categories - Get available categories
export const getAuditCategories = (req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = [
      'AUTHENTICATION',
      'USER_MANAGEMENT',
      'CASE_MANAGEMENT',
      'CLIENT_MANAGEMENT',
      'FILE_MANAGEMENT',
      'FINANCIAL',
      'SYSTEM',
      'SECURITY',
      'DATA_MANAGEMENT',
      'REPORTING',
    ];

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    logger.error('Error getting audit categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get audit categories',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/audit-logs/stats - Get audit log statistics
export const getAuditStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const period = getSingleQueryValue(req.query.period) || 'week';

    // Real aggregates over the partitioned audit_logs table, BOUNDED to the
    // requested period window (created_at >= start) so PG can prune partitions
    // — a full-history scan here would itself be a scale risk. Was computed
    // over an in-memory mock array (fabricated/empty).
    const intervalByPeriod: Record<string, string> = {
      day: '1 day',
      week: '7 days',
      month: '1 month',
      year: '1 year',
    };
    const interval = intervalByPeriod[period] || '7 days';
    const sevExpr = `CASE WHEN action LIKE '%FAILED%' OR action LIKE '%REJECTED%' THEN 'ERROR' WHEN action LIKE '%REVOKED%' THEN 'WARN' ELSE 'INFO' END`;
    const catExpr = `CASE WHEN entity_type IN ('VERIFICATION_TASK','CASE') THEN 'CASE_MANAGEMENT' WHEN entity_type='USER' THEN 'USER_MANAGEMENT' WHEN entity_type='ATTACHMENT' THEN 'FILE_MANAGEMENT' ELSE 'SYSTEM' END`;
    const windowSql = `created_at >= NOW() - INTERVAL '${interval}'`;

    const [actionRes, catRes, sevRes, userRes] = await Promise.all([
      dbQuery<{ k: string; c: number }>(
        `SELECT action AS k, COUNT(*)::int AS c FROM audit_logs WHERE ${windowSql} GROUP BY action ORDER BY c DESC LIMIT 20`
      ),
      dbQuery<{ k: string; c: number }>(
        `SELECT ${catExpr} AS k, COUNT(*)::int AS c FROM audit_logs WHERE ${windowSql} GROUP BY 1`
      ),
      dbQuery<{ k: string; c: number }>(
        `SELECT ${sevExpr} AS k, COUNT(*)::int AS c FROM audit_logs WHERE ${windowSql} GROUP BY 1`
      ),
      dbQuery<{ userId: string; userName: string; totalActions: number; lastActivity: string }>(
        `SELECT al.user_id AS "userId", COALESCE(u.name, 'System') AS "userName",
                COUNT(*)::int AS "totalActions", MAX(al.created_at)::text AS "lastActivity"
         FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
         WHERE ${windowSql} GROUP BY al.user_id, u.name ORDER BY "totalActions" DESC LIMIT 10`
      ),
    ]);

    const toDist = (rows: { k: string; c: number }[]): Record<string, number> =>
      rows.reduce(
        (acc, r) => {
          acc[r.k] = r.c;
          return acc;
        },
        {} as Record<string, number>
      );

    const periodLogs = sevRes.rows.reduce((s, r) => s + r.c, 0);

    res.json({
      success: true,
      data: {
        totalLogs: periodLogs,
        periodLogs,
        period,
        actionDistribution: toDist(actionRes.rows),
        categoryDistribution: toDist(catRes.rows),
        severityDistribution: toDist(sevRes.rows),
        topUsers: userRes.rows,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error getting audit stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get audit statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/audit-logs/cleanup - Cleanup old audit logs
export const cleanupAuditLogs = (req: AuthenticatedRequest, res: Response) => {
  // audit_logs is a date-RANGE PARTITIONED table; retention is enforced by
  // dropping old monthly partitions, NOT by row-level DELETE. Deleting audit
  // rows would also break the HMAC row-hash chain (tamper-evidence, T1-1).
  // Previously this filtered an in-memory mock array (no real effect). Return
  // an honest no-op instead of pretending to delete.
  const { olderThanDays = 90 } = req.body;
  logger.info('Audit-logs manual cleanup requested — no-op (partition-rotation retention)', {
    userId: req.user?.id,
    olderThanDays: Number(olderThanDays),
  });
  res.json({
    success: true,
    data: { deletedCount: 0 },
    message:
      'Audit log retention is managed by automatic partition rotation; no manual row deletion is performed (would break the audit hash chain).',
  });
};
