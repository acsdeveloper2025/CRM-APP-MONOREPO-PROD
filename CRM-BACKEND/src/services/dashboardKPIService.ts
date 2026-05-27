import { query } from '@/config/database';
import type { QueryParams } from '@/types/database';

/**
 * ============================================================================
 * UNIFIED KPI DASHBOARD ENGINE
 * ============================================================================
 *
 * Goal: Single source of truth for CRM dashboard using ONLY verification_tasks (where possible).
 * Context: Replaces legacy case-based and hybrid dashboards.
 *
 * CORE RULES:
 * 1. Primary Entity: verification_tasks (vt)
 * 2. Secondary (Metadata only): cases (c), clients (cl), products (p), users (u)
 * 3. No Pagination calculations (Aggregates only)
 * 4. No Frontend calculations (Backend must return final numbers)
 * 5. Trends: "Last 7 days" vs "Previous 7 days" (Shifted by 7 days)
 * 6. Hardcoded Percentages: FORBIDDEN. Must be calculated.
 */

// ============================================================================
// 1. KPI CONTRACT (The Response Structure)
// ============================================================================

export interface MetricWithTrend {
  value: number;
  previousPeriodValue: number;
  changePercent: number;
}

export interface VerificationOperationsKPI {
  meta: {
    generatedAt: string;
    period: 'last_7_days';
    comparisonPeriod: 'previous_7_days';
    filtersApplied: Record<string, unknown>;
  };

  // --- CORE OPERATIONAL METRICS ---
  workload: {
    totalTasks: MetricWithTrend; // Created in period
    openTasks: MetricWithTrend; // Snapshot (Pending/Assigned/InProgress)
    inProgressTasks: MetricWithTrend; // Snapshot (InProgress)
    completedToday: number; // Absolute value for "Today"
    overdueTasks: MetricWithTrend; // Snapshot
    slaRiskTasks: MetricWithTrend; // Snapshot
    avgOverdueDays: number; // Average days overdue for active overdue tasks
  };

  performance: {
    avgTatDays: MetricWithTrend; // Days
    firstVisitSuccessRate: MetricWithTrend; // %
    revisitRate: MetricWithTrend; // %
  };

  financial: {
    billableTasks: MetricWithTrend; // Completed/Approved
    estimatedAmount: MetricWithTrend; // Currency
    actualAmount: MetricWithTrend; // Currency
    collectionEfficiencyPercent: MetricWithTrend;
  };

  // --- KYC VERIFICATION METRICS ---
  kyc: {
    total: number;
    pending: number;
    passed: number;
    failed: number;
    referred: number;
    verifiedToday: number;
  };

  // --- LEGACY COMPATIBILITY (For Existing Frontend Cards) ---
  legacyCompatibility: {
    cases: {
      total: MetricWithTrend; // Created in period
      inProgress: MetricWithTrend; // Snapshot
      completed: MetricWithTrend; // Completed in period
      closed: MetricWithTrend; // Snapshot (if 'CLOSED' status exists) or Synonym for Completed
    };
    tasks: {
      total: MetricWithTrend; // Alias for workload.totalTasks
      inProgress: MetricWithTrend; // Alias for workload.inProgressTasks
      completed: MetricWithTrend; // Completed in period
      revoked: MetricWithTrend; // Status = 'REVOKED'
    };
    clients: {
      total: MetricWithTrend; // Total in DB (Volume)? Usually Snapshot 'Active'
      active: MetricWithTrend; // Active Cases in Period OR Status=Active
    };
    fieldAgents: {
      total: MetricWithTrend; // Registered Agents
      activeToday: MetricWithTrend; // Submitted/Updated task today
    };
    todayOps: {
      completedTasks: MetricWithTrend; // vs Yesterday
      assignedTasks: MetricWithTrend; // vs Yesterday
    };
  };
}

// ============================================================================
// 2. SQL QUERY REPOSITORY (The Logic)
// ============================================================================

export class DashboardKPIService {
  /**
   * Generates the KPI response.
   * Logic: Calculates metrics for Current Period (CP) and Previous Period (PP).
   * Default CP: Last 7 Days.
   * Default PP: 7 Days prior to CP.
   */
  static async getKPIs(filters: {
    clientId?: number;
    agentId?: string;
    agentIds?: string[];
    clientIds?: number[];
    productIds?: number[];
    creatorUserIds?: string[];
  }): Promise<VerificationOperationsKPI> {
    // ----------------------------------------------------------------------
    // DATE MATH (7-Day Rolling Window)
    // ----------------------------------------------------------------------
    // CP: [Now-7d, Now]
    // PP: [Now-14d, Now-7d]
    // Note: We use Postgres intervals in SQL for precision, but passed params are helpful.

    const { clientId, agentId, agentIds, clientIds, productIds, creatorUserIds } = filters;

    // ----------------------------------------------------------------------
    // CORE QUERY: scope-filtered SUM across mv_dashboard_kpi_7d
    // ----------------------------------------------------------------------
    // P5 Phase B truthful-sweep 2026-05-27: this was a 25-FILTER CTE
    // against verification_tasks scanning all rows on every dashboard
    // request. Now SUMs across pre-aggregated rows in mv_dashboard_kpi_7d
    // (refreshed every 5 min by dbMaintenanceService). KYC exclusion is
    // baked into the mat view at materialize time.
    //
    // Mat view dimensions: agent_user_id, creator_user_id, client_id,
    // product_id. Service scope filters map directly:
    //   - creatorUserIds → (creator_user_id IN OR agent_user_id IN)
    //   - clientId / clientIds → client_id IN
    //   - productIds → product_id IN
    //   - agentId / agentIds → agent_user_id IN
    //
    // Stale-by-up-to-5-min is accepted UX; cache TTL on the controller
    // is already 60s (longer than refresh cycle is fine — eventually
    // consistent).

    const mvConditions: string[] = ['1=1'];
    const params: QueryParams = [];
    let idx = 1;

    if (creatorUserIds && creatorUserIds.length > 0) {
      mvConditions.push(
        `(creator_user_id = ANY($${idx}::uuid[]) OR agent_user_id = ANY($${idx}::uuid[]))`
      );
      params.push(creatorUserIds);
      idx++;
    }
    if (clientId) {
      mvConditions.push(`client_id = $${idx++}`);
      params.push(clientId);
    }
    if (clientIds && clientIds.length > 0) {
      mvConditions.push(`client_id = ANY($${idx++}::int[])`);
      params.push(clientIds);
    }
    if (productIds && productIds.length > 0) {
      mvConditions.push(`product_id = ANY($${idx++}::int[])`);
      params.push(productIds);
    }
    if (agentId) {
      mvConditions.push(`agent_user_id = $${idx++}`);
      params.push(agentId);
    }
    if (agentIds && agentIds.length > 0) {
      mvConditions.push(`agent_user_id = ANY($${idx++}::uuid[])`);
      params.push(agentIds);
    }

    const mvWhereClause = mvConditions.join(' AND ');

    // Legacy WHERE-clause shape for queries that still scan raw tables
    // (kycQuery + perfQuery). Mat view doesn't cover KYC (excluded at
    // materialize time) or per-task TAT metrics (point-in-time AVG of
    // completed_at - created_at requires per-row data, not pre-grouped
    // counts). These queries remain on raw tables; the coreQuery
    // (which IS the 25-FILTER monster) is the one that moved.
    //
    // Param positions MUST match the mvConditions build above (same
    // order, same set) so both whereClause variants can share the
    // single `params` array.
    const conditions: string[] = ['1=1'];
    let legacyIdx = 1;
    if (creatorUserIds && creatorUserIds.length > 0) {
      conditions.push(`(
        c.created_by_backend_user = ANY($${legacyIdx}::uuid[])
        OR EXISTS (
          SELECT 1 FROM verification_tasks vt_scope
          WHERE vt_scope.case_id = c.id
            AND vt_scope.assigned_to = ANY($${legacyIdx}::uuid[])
        )
      )`);
      legacyIdx++;
    }
    if (clientId) {
      conditions.push(`c.client_id = $${legacyIdx++}`);
    }
    if (clientIds && clientIds.length > 0) {
      conditions.push(`c.client_id = ANY($${legacyIdx++}::int[])`);
    }
    if (productIds && productIds.length > 0) {
      conditions.push(`c.product_id = ANY($${legacyIdx++}::int[])`);
    }
    if (agentId) {
      conditions.push(`vt.assigned_to = $${legacyIdx++}`);
    }
    if (agentIds && agentIds.length > 0) {
      conditions.push(`vt.assigned_to = ANY($${legacyIdx++}::uuid[])`);
    }
    const whereClause = conditions.join(' AND ');

    // SUM across the matching mat-view rows. Weighted AVG for
    // cp_avg_overdue_days: SUM(cp_overdue × cp_avg_overdue_days) /
    // SUM(cp_overdue) recovers the correct cross-scope average.
    const coreQuery = `
      SELECT
        COALESCE(SUM(cp_created), 0)        as cp_created,
        COALESCE(SUM(pp_created), 0)        as pp_created,
        COALESCE(SUM(cp_completed), 0)      as cp_completed,
        COALESCE(SUM(pp_completed), 0)      as pp_completed,
        COALESCE(SUM(cp_revoked), 0)        as cp_revoked,
        COALESCE(SUM(pp_revoked), 0)        as pp_revoked,
        COALESCE(SUM(cp_in_progress), 0)    as cp_in_progress,
        COALESCE(SUM(pp_in_progress), 0)    as pp_in_progress,
        COALESCE(SUM(cp_open), 0)           as cp_open,
        COALESCE(SUM(pp_open), 0)           as pp_open,
        COALESCE(SUM(today_completed), 0)   as today_completed,
        COALESCE(SUM(yesterday_completed), 0) as yesterday_completed,
        COALESCE(SUM(today_assigned), 0)    as today_assigned,
        COALESCE(SUM(yesterday_assigned), 0) as yesterday_assigned,
        COALESCE(SUM(cp_est_amt), 0)        as cp_est_amt,
        COALESCE(SUM(pp_est_amt), 0)        as pp_est_amt,
        COALESCE(SUM(cp_act_amt), 0)        as cp_act_amt,
        COALESCE(SUM(pp_act_amt), 0)        as pp_act_amt,
        COALESCE(SUM(cp_overdue), 0)        as cp_overdue,
        COALESCE(SUM(cp_sla_risk), 0)       as cp_sla_risk,
        CASE WHEN COALESCE(SUM(cp_overdue), 0) > 0
          THEN SUM(cp_overdue * cp_avg_overdue_days) / SUM(cp_overdue)
          ELSE 0 END                        as cp_avg_overdue_days,
        COALESCE(SUM(today_completed), 0)   as completed_today
      FROM mv_dashboard_kpi_7d
      WHERE ${mvWhereClause}
    `;

    // ----------------------------------------------------------------------
    // P13.C — LEGACY CASES + CLIENTS + AGENTS QUERIES, SCOPE-AWARE
    //
    // These three legacy queries previously returned global counts even
    // when the caller had locked scope, leaking cross-tenant case totals
    // (Quick Actions tile), client counts and field-agent counts. We
    // rebuild the WHERE clauses here to mirror the operational filters
    // applied to coreQuery (clientIds, productIds, creatorUserIds, single
    // clientId/agentId). agentId is honoured via an EXISTS subquery on
    // verification_tasks so the cases table doesn't need an agent FK.
    // ----------------------------------------------------------------------
    const casesConditions: string[] = ['1=1'];
    const casesParams: QueryParams = [];
    let casesIdx = 1;

    if (creatorUserIds && creatorUserIds.length > 0) {
      casesConditions.push(`(
        c.created_by_backend_user = ANY($${casesIdx}::uuid[])
        OR EXISTS (
          SELECT 1 FROM verification_tasks vt_scope
          WHERE vt_scope.case_id = c.id
            AND vt_scope.assigned_to = ANY($${casesIdx}::uuid[])
        )
      )`);
      casesParams.push(creatorUserIds);
      casesIdx++;
    }
    if (clientId) {
      casesConditions.push(`c.client_id = $${casesIdx++}`);
      casesParams.push(clientId);
    }
    if (clientIds && clientIds.length > 0) {
      casesConditions.push(`c.client_id = ANY($${casesIdx++}::int[])`);
      casesParams.push(clientIds);
    }
    if (productIds && productIds.length > 0) {
      casesConditions.push(`c.product_id = ANY($${casesIdx++}::int[])`);
      casesParams.push(productIds);
    }
    if (agentId) {
      casesConditions.push(`EXISTS (
        SELECT 1 FROM verification_tasks vt_agent
        WHERE vt_agent.case_id = c.id AND vt_agent.assigned_to = $${casesIdx++}
      )`);
      casesParams.push(agentId);
    }
    if (agentIds && agentIds.length > 0) {
      casesConditions.push(`EXISTS (
        SELECT 1 FROM verification_tasks vt_agent
        WHERE vt_agent.case_id = c.id AND vt_agent.assigned_to = ANY($${casesIdx++}::uuid[])
      )`);
      casesParams.push(agentIds);
    }
    const casesWhereClause = casesConditions.join(' AND ');

    const casesQuery = `
      WITH date_ranges AS (
        SELECT
          NOW() as cp_end,
          NOW() - INTERVAL '7 days' as cp_start,
          NOW() - INTERVAL '7 days' as pp_end,
          NOW() - INTERVAL '14 days' as pp_start
      )
      SELECT
        COUNT(*) FILTER (WHERE created_at BETWEEN (SELECT cp_start FROM date_ranges) AND (SELECT cp_end FROM date_ranges)) as cp_total,
        COUNT(*) FILTER (WHERE created_at BETWEEN (SELECT pp_start FROM date_ranges) AND (SELECT pp_end FROM date_ranges)) as pp_total,
        COUNT(*) FILTER (WHERE status IN ('IN_PROGRESS', 'PENDING')) as cp_active,
        COUNT(*) FILTER (WHERE created_at <= (SELECT pp_end FROM date_ranges) AND (status NOT IN ('COMPLETED', 'CLOSED') OR updated_at > (SELECT pp_end FROM date_ranges))) as pp_active,
        COUNT(*) FILTER (WHERE status = 'COMPLETED' AND updated_at BETWEEN (SELECT cp_start FROM date_ranges) AND (SELECT cp_end FROM date_ranges)) as cp_completed,
        COUNT(*) FILTER (WHERE status = 'COMPLETED' AND updated_at BETWEEN (SELECT pp_start FROM date_ranges) AND (SELECT pp_end FROM date_ranges)) as pp_completed
      FROM cases c
      WHERE ${casesWhereClause}
    `;

    // Clients query: when the caller has a scoped client set, narrow to
    // those ids; admin/global callers see all clients. clientId (singular)
    // overrides clientIds when supplied.
    const clientsConditions: string[] = ['1=1'];
    const clientsParams: QueryParams = [];
    let clientsIdx = 1;
    if (clientId) {
      clientsConditions.push(`id = $${clientsIdx++}`);
      clientsParams.push(clientId);
    } else if (clientIds && clientIds.length > 0) {
      clientsConditions.push(`id = ANY($${clientsIdx++}::int[])`);
      clientsParams.push(clientIds);
    }
    const clientsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active
      FROM clients
      WHERE ${clientsConditions.join(' AND ')}
    `;

    // Agents query: count distinct field agents with any task on cases
    // in the caller's scope. active_today narrows the same set to tasks
    // touched today. When no scope filters apply (admin/global), the
    // EXISTS subquery is vacuous and counts every visit.submit user.
    const agentsScopeConditions: string[] = [];
    const agentsParams: QueryParams = [];
    let agentsIdx = 1;
    if (creatorUserIds && creatorUserIds.length > 0) {
      agentsScopeConditions.push(`(
        c.created_by_backend_user = ANY($${agentsIdx}::uuid[])
        OR vt.assigned_to = ANY($${agentsIdx}::uuid[])
      )`);
      agentsParams.push(creatorUserIds);
      agentsIdx++;
    }
    if (clientId) {
      agentsScopeConditions.push(`c.client_id = $${agentsIdx++}`);
      agentsParams.push(clientId);
    }
    if (clientIds && clientIds.length > 0) {
      agentsScopeConditions.push(`c.client_id = ANY($${agentsIdx++}::int[])`);
      agentsParams.push(clientIds);
    }
    if (productIds && productIds.length > 0) {
      agentsScopeConditions.push(`c.product_id = ANY($${agentsIdx++}::int[])`);
      agentsParams.push(productIds);
    }
    const hasAgentScope = agentsScopeConditions.length > 0;
    const agentsScopeWhere = hasAgentScope ? ` AND ${agentsScopeConditions.join(' AND ')}` : '';
    // Both subqueries reuse the same params. We append a second copy of
    // the values to agentsParamsFull and rewrite each DISTINCT $N to a
    // new index in the second subquery — a $N that appears twice in one
    // condition (e.g. the creator OR clause) must point at the same new
    // index in the rewritten copy.
    const placeholderMap = new Map<string, string>();
    let activeTodayIdx = agentsIdx;
    const activeTodayConditions = agentsScopeConditions.map(cond =>
      cond.replace(/\$\d+/g, match => {
        if (!placeholderMap.has(match)) {
          placeholderMap.set(match, `$${activeTodayIdx++}`);
        }
        return placeholderMap.get(match) as string;
      })
    );
    const activeTodayWhere = hasAgentScope ? ` AND ${activeTodayConditions.join(' AND ')}` : '';
    const agentsParamsFull = hasAgentScope ? [...agentsParams, ...agentsParams] : [];
    const agentsQuery = hasAgentScope
      ? `
      SELECT
        (
          SELECT COUNT(DISTINCT vt.assigned_to)
          FROM verification_tasks vt
          LEFT JOIN cases c ON c.id = vt.case_id
          WHERE vt.assigned_to IS NOT NULL${agentsScopeWhere}
        ) as total_agents,
        (
          SELECT COUNT(DISTINCT vt.assigned_to)
          FROM verification_tasks vt
          LEFT JOIN cases c ON c.id = vt.case_id
          WHERE vt.assigned_to IS NOT NULL
            AND vt.updated_at >= CURRENT_DATE${activeTodayWhere}
        ) as active_today
    `
      : `
      SELECT
        (
          SELECT COUNT(*)
          FROM users u
          WHERE EXISTS (
            SELECT 1
            FROM user_roles urf
            JOIN role_permissions rpf ON rpf.role_id = urf.role_id AND rpf.allowed = true
            JOIN permissions pf ON pf.id = rpf.permission_id
            WHERE urf.user_id = u.id AND pf.code = 'visit.submit'
          )
        ) as total_agents,
        (
          SELECT COUNT(DISTINCT assigned_to)
          FROM verification_tasks
          WHERE assigned_to IS NOT NULL
          AND updated_at >= CURRENT_DATE
        ) as active_today
    `;

    // Performance queries moved to separate DB call for simplicity

    // ----------------------------------------------------------------------
    // EXECUTION
    // ----------------------------------------------------------------------

    // Using simple parallel execution.
    // KYC stats query
    // Workflow buckets read verification_status (PENDING/IN_PROGRESS/COMPLETED…).
    // Outcome buckets read final_status (Positive/Negative/Refer/Fraud).
    // Scoped via the same whereClause as core/perf queries — JOIN through verification_tasks → cases
    // so creator/client/product/agent filters apply. kdv. prefix on filtered columns avoids ambiguity.
    const kycQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE kdv.verification_status = 'PENDING') as pending,
        COUNT(*) FILTER (WHERE kdv.final_status = 'Positive') as passed,
        COUNT(*) FILTER (WHERE kdv.final_status = 'Negative') as failed,
        COUNT(*) FILTER (WHERE kdv.final_status = 'Refer') as referred,
        COUNT(*) FILTER (WHERE kdv.final_status = 'Fraud') as fraud,
        COUNT(*) FILTER (WHERE kdv.verified_at >= CURRENT_DATE) as verified_today
      FROM kyc_document_verifications kdv
      JOIN verification_tasks vt ON vt.id = kdv.verification_task_id
      LEFT JOIN cases c ON c.id = vt.case_id
      WHERE kdv.deleted_at IS NULL AND (${whereClause})
    `;

    const [taskRes, casesRes, clientsRes, agentsRes, perfRes, kycRes] = await Promise.all([
      query(coreQuery, params),
      query(casesQuery, casesParams),
      query(clientsQuery, clientsParams),
      query(agentsQuery, agentsParamsFull),
      query(
        `WITH date_ranges AS (
        SELECT
          NOW() as cp_end,
          NOW() - INTERVAL '7 days' as cp_start,
          NOW() - INTERVAL '7 days' as pp_end,
          NOW() - INTERVAL '14 days' as pp_start
      ), filtered_tasks AS (
        SELECT vt.* FROM verification_tasks vt
        LEFT JOIN cases c ON vt.case_id = c.id
        WHERE ${whereClause}
          -- 2026-05-06 bug 74: exclude KYC from TAT/perf metrics — same reason as core query.
          AND COALESCE(vt.task_type, 'NORMAL') <> 'KYC'
      )
      SELECT
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/86400)
          FILTER (WHERE status = 'COMPLETED' AND completed_at BETWEEN (SELECT cp_start FROM date_ranges) AND (SELECT cp_end FROM date_ranges))
          as cp_avg_tat,

        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/86400)
          FILTER (WHERE status = 'COMPLETED' AND completed_at BETWEEN (SELECT pp_start FROM date_ranges) AND (SELECT pp_end FROM date_ranges))
          as pp_avg_tat
      FROM filtered_tasks`,
        params
      ),
      query(kycQuery, params),
    ]);

    const stats = taskRes.rows[0];
    const caseStats = casesRes.rows[0] || {
      cpTotal: 0,
      ppTotal: 0,
      cpActive: 0,
      ppActive: 0,
      cpCompleted: 0,
      ppCompleted: 0,
    };
    const clientStats = clientsRes.rows[0] || { total: 0, active: 0 };
    const agentStats = agentsRes.rows[0] || { totalAgents: 0, activeToday: 0 };
    const perfStats = perfRes.rows[0] || { cpAvgTat: 0, ppAvgTat: 0 };
    const kycStats = kycRes.rows[0] || {
      total: 0,
      pending: 0,
      passed: 0,
      failed: 0,
      referred: 0,
      verifiedToday: 0,
    };

    // Helper to build Metric (no trend for static entities unless we track history, using flat value for now)
    const buildMetric = (curr: string | number, prev: string | number): MetricWithTrend => {
      const c = Number(curr) || 0;
      const p = Number(prev) || 0;
      let change = 0;
      if (p > 0) {
        change = ((c - p) / p) * 100;
      } else if (c > 0) {
        change = 100; // 0 to something is 100% growth effectively
      }
      return {
        value: Number(c.toFixed(2)), // Round to 2 decimals
        previousPeriodValue: Number(p.toFixed(2)),
        changePercent: Number(change.toFixed(1)),
      };
    };

    // Helper for Snapshot/Static metrics where we don't track history yet (Flat trend)
    const buildStaticMetric = (val: string | number): MetricWithTrend => ({
      value: Number(val) || 0,
      previousPeriodValue: Number(val) || 0, // Assume stable for now
      changePercent: 0,
    });

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        period: 'last_7_days',
        comparisonPeriod: 'previous_7_days',
        filtersApplied: filters,
      },

      workload: {
        totalTasks: buildMetric(stats.cpCreated, stats.ppCreated),
        openTasks: buildMetric(stats.cpOpen, stats.ppOpen),
        inProgressTasks: buildMetric(stats.cpInProgress, stats.ppInProgress),
        completedToday: Number(stats.completedToday),
        overdueTasks: buildStaticMetric(stats.cpOverdue),
        slaRiskTasks: buildStaticMetric(stats.cpSlaRisk),
        avgOverdueDays: Number(Number(stats.cpAvgOverdueDays || 0).toFixed(1)),
      },

      performance: {
        avgTatDays: buildMetric(perfStats.cpAvgTat, perfStats.ppAvgTat),
        firstVisitSuccessRate: buildMetric(0, 0),
        revisitRate: buildMetric(0, 0),
      },

      financial: {
        billableTasks: buildMetric(stats.cpCompleted, stats.ppCompleted), // Using Completed as proxy for billable
        estimatedAmount: buildMetric(stats.cpEstAmt, stats.ppEstAmt),
        actualAmount: buildMetric(stats.cpActAmt, stats.ppActAmt),
        collectionEfficiencyPercent: buildMetric(
          (Number(stats.cpActAmt) / (Number(stats.cpEstAmt) || 1)) * 100,
          (Number(stats.ppActAmt) / (Number(stats.ppEstAmt) || 1)) * 100
        ),
      },

      kyc: {
        total: Number(kycStats.total) || 0,
        pending: Number(kycStats.pending) || 0,
        passed: Number(kycStats.passed) || 0,
        failed: Number(kycStats.failed) || 0,
        referred: Number(kycStats.referred) || 0,
        verifiedToday: Number(kycStats.verifiedToday) || 0,
      },

      legacyCompatibility: {
        cases: {
          total: buildMetric(caseStats.cpTotal, caseStats.ppTotal),
          inProgress: buildMetric(caseStats.cpActive, caseStats.ppActive),
          completed: buildMetric(caseStats.cpCompleted, caseStats.ppCompleted),
          closed: buildMetric(0, 0),
        },
        tasks: {
          total: buildMetric(stats.cpCreated, stats.ppCreated),
          inProgress: buildMetric(stats.cpInProgress, stats.ppInProgress),
          completed: buildMetric(stats.cpCompleted, stats.ppCompleted),
          revoked: buildMetric(stats.cpRevoked, stats.ppRevoked),
        },
        clients: {
          total: buildStaticMetric(clientStats.total),
          active: buildStaticMetric(clientStats.active),
        },
        fieldAgents: {
          total: buildStaticMetric(agentStats.totalAgents),
          activeToday: buildStaticMetric(agentStats.activeToday),
        },
        todayOps: {
          // Special Case: Comparison is TODAY vs YESTERDAY
          completedTasks: buildMetric(stats.todayCompleted, stats.yesterdayCompleted),
          assignedTasks: buildMetric(stats.todayAssigned, stats.yesterdayAssigned),
        },
      },
    };
  }
}
