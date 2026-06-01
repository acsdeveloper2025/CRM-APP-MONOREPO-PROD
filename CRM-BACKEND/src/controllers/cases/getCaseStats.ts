import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { query as dbQuery } from '../../config/database';
import { buildCasesBaseWhereClause } from './queryBuilder';

// Extracted verbatim from casesController (§7 decomposition); behaviour pinned
// by cases.integration.test.ts (GET /api/cases/stats numeric status breakdown).
/**
 * Canonical 5-card stats endpoint for /case-management/* pages.
 * GET /api/cases/stats
 *
 * Mirrors the getCases inline statistics shape but ignores the caller's
 * `status` filter (returns partition counters for ALL statuses scoped
 * by the user's other filters). Each FE list page picks 5 from this
 * shape (AllCases / InProgressCases / CompletedCases).
 */
export const getCaseStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const where = await buildCasesBaseWhereClause(req);
    const whereClause =
      where.baseConditions.length > 0 ? `WHERE ${where.baseConditions.join(' AND ')}` : '';

    const result = await dbQuery(
      `
      SELECT
        COUNT(DISTINCT c.id) as total,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'PENDING') as pending,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'ASSIGNED') as assigned,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'IN_PROGRESS') as "inProgress",
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'COMPLETED') as completed,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'REVOKED') as revoked,
        COUNT(DISTINCT c.id) FILTER (
          WHERE c.status IN ('PENDING','ASSIGNED','IN_PROGRESS')
        ) as open,
        COUNT(DISTINCT c.id) FILTER (
          WHERE c.priority IN ('HIGH', 'URGENT')
        ) as "highPriority",
        COUNT(DISTINCT c.id) FILTER (
          WHERE c.status NOT IN ('COMPLETED','REVOKED')
          AND c.created_at < NOW() - INTERVAL '3 days'
        ) as "longRunning",
        COUNT(DISTINCT c.id) FILTER (
          WHERE c.status NOT IN ('COMPLETED','REVOKED','CANCELLED')
          AND c.created_at < NOW() - INTERVAL '48 hours'
        ) as overdue,
        COUNT(DISTINCT c.id) FILTER (
          WHERE c.status = 'COMPLETED' AND c.completed_at >= CURRENT_DATE
        ) as "completedToday",
        COUNT(DISTINCT c.id) FILTER (
          WHERE c.status = 'COMPLETED'
          AND c.completed_at >= date_trunc('week', CURRENT_DATE)
        ) as "completedThisWeek",
        -- Field agents vs KYC verifiers are SEPARATE roles — track both.
        -- Truthful-sweep 2026-05-26: user flagged that agent counts were
        -- including KYC verifiers. task_type_enum is {NORMAL, REVISIT,
        -- KYC} — field tasks are NORMAL or REVISIT.
        COUNT(DISTINCT vt.assigned_to) FILTER (
          WHERE c.status = 'IN_PROGRESS' AND vt.assigned_to IS NOT NULL
            AND vt.task_type <> 'KYC'
        ) as "activeAgentsInProgress",
        COUNT(DISTINCT vt.assigned_to) FILTER (
          WHERE vt.assigned_to IS NOT NULL AND vt.task_type <> 'KYC'
        ) as "activeAgentsAny",
        COUNT(DISTINCT vt.assigned_to) FILTER (
          WHERE vt.assigned_to IS NOT NULL AND vt.task_type = 'KYC'
        ) as "activeKycVerifiers",
        AVG(EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 86400) FILTER (
          WHERE c.status IN ('PENDING','ASSIGNED')
        ) as "avgPendingDays",
        AVG(EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 86400) FILTER (
          WHERE c.status = 'IN_PROGRESS'
        ) as "avgInProgressDays",
        AVG(EXTRACT(EPOCH FROM (c.completed_at - c.created_at)) / 86400) FILTER (
          WHERE c.status = 'COMPLETED'
        ) as "avgTATDays"
      FROM cases c
      LEFT JOIN verification_tasks vt ON c.id = vt.case_id
      ${whereClause}
    `,
      where.baseParams
    );

    const row = result.rows[0] || {};
    const num = (key: string): number => parseInt(row[key] || '0', 10);
    const flt = (key: string): number => parseFloat(row[key] || '0');

    res.json({
      success: true,
      data: {
        total: num('total'),
        pending: num('pending'),
        assigned: num('assigned'),
        inProgress: num('inProgress'),
        completed: num('completed'),
        revoked: num('revoked'),
        open: num('open'),
        highPriority: num('highPriority'),
        longRunning: num('longRunning'),
        overdue: num('overdue'),
        completedToday: num('completedToday'),
        completedThisWeek: num('completedThisWeek'),
        activeAgentsInProgress: num('activeAgentsInProgress'),
        activeAgentsAny: num('activeAgentsAny'),
        activeKycVerifiers: num('activeKycVerifiers'),
        avgPendingDays: flt('avgPendingDays'),
        avgInProgressDays: flt('avgInProgressDays'),
        avgTATDays: flt('avgTATDays'),
      },
      message: 'Case stats retrieved successfully',
    });
  } catch (error) {
    logger.error('Error getting case stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get case stats',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
