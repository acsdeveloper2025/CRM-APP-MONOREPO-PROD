import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';

// ---------------------------------------------------------------------------
// GET /api/case-data-entries/dashboard
//
// Paginated list of cases annotated with their data-entry status (not
// started / in progress / completed) and verification-task progress.
// Used by the Data Entry Dashboard page to give the backend team a
// single view of what needs attention.
// ---------------------------------------------------------------------------
export const getDataEntryDashboard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const clientId = req.query.clientId ? Number(req.query.clientId) : null;
    const productId = req.query.productId ? Number(req.query.productId) : null;
    const dataEntryStatus =
      typeof req.query.dataEntryStatus === 'string' ? req.query.dataEntryStatus : null;

    // Build WHERE clauses dynamically.
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(
        `(c.customer_name ILIKE $${paramIdx} OR cl.name ILIKE $${paramIdx} OR p.name ILIKE $${paramIdx} OR c.case_id::text = $${paramIdx + 1})`
      );
      params.push(`%${search}%`, search);
      paramIdx += 2;
    }
    if (clientId) {
      conditions.push(`c.client_id = $${paramIdx++}`);
      params.push(clientId);
    }
    if (productId) {
      conditions.push(`c.product_id = $${paramIdx++}`);
      params.push(productId);
    }

    // Data-entry status filter is applied as a HAVING-style post-filter
    // via a CTE because it depends on the aggregated instance counts.
    // We build it as a wrapper WHERE on the outer query.
    let deStatusFilter = '';
    if (dataEntryStatus === 'not_started') {
      deStatusFilter = 'AND (de_instances = 0)';
    } else if (dataEntryStatus === 'in_progress') {
      deStatusFilter = 'AND (de_instances > 0 AND de_completed < de_instances)';
    } else if (dataEntryStatus === 'completed') {
      deStatusFilter = 'AND (de_instances > 0 AND de_completed = de_instances)';
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      WITH base AS (
        SELECT
          c.id,
          c.case_id,
          c.customer_name,
          c.status AS case_status,
          c.created_at,
          cl.name AS client_name,
          p.name AS product_name,
          (SELECT COUNT(*)::int FROM verification_tasks vt
            WHERE vt.case_id = c.id AND vt.status != 'REVOKED') AS total_tasks,
          (SELECT COUNT(*)::int FROM verification_tasks vt
            WHERE vt.case_id = c.id AND vt.status = 'COMPLETED') AS completed_tasks,
          COALESCE(de.instance_count, 0) AS de_instances,
          COALESCE(de.completed_count, 0) AS de_completed,
          de.last_updated AS de_last_updated
        FROM cases c
        JOIN clients cl ON cl.id = c.client_id
        JOIN products p ON p.id = c.product_id
        LEFT JOIN (
          SELECT
            case_id,
            COUNT(*)::int AS instance_count,
            COUNT(*) FILTER (WHERE is_completed)::int AS completed_count,
            MAX(updated_at) AS last_updated
          FROM case_data_entries
          GROUP BY case_id
        ) de ON de.case_id = c.id
        ${whereClause}
      )
      SELECT *,
        CASE
          WHEN de_instances = 0 THEN 'not_started'
          WHEN de_completed < de_instances THEN 'in_progress'
          ELSE 'completed'
        END AS data_entry_status,
        COUNT(*) OVER() AS total_count
      FROM base
      WHERE 1=1 ${deStatusFilter}
      ORDER BY created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    params.push(limit, offset);

    const result = await query(sql, params);
    const rows = result.rows;
    const total =
      rows.length > 0 ? Number((rows[0] as { totalCount?: string }).totalCount ?? 0) : 0;

    return res.json({
      success: true,
      data: {
        data: rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          caseId: r.caseId,
          customerName: r.customerName,
          caseStatus: r.caseStatus,
          clientName: r.clientName,
          productName: r.productName,
          totalTasks: r.totalTasks,
          completedTasks: r.completedTasks,
          dataEntryInstances: r.deInstances,
          dataEntryCompleted: r.deCompleted,
          dataEntryLastUpdated: r.deLastUpdated,
          dataEntryStatus: r.dataEntryStatus,
          createdAt: r.createdAt,
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching data entry dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch data entry dashboard',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
