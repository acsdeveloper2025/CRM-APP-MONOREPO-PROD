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
      onHold: MetricWithTrend; // Status = 'ON_HOLD'
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

    // Base WHERE clauses
    const conditions: string[] = ['1=1'];
    const params: QueryParams = [];
    let idx = 1;

    // Creator-based scope: BACKEND_USER sees only their own cases' stats.
    if (creatorUserIds && creatorUserIds.length > 0) {
      conditions.push(`c.created_by_backend_user = ANY($${idx++}::uuid[])`);
      params.push(creatorUserIds);
    }
    if (clientId) {
      conditions.push(`c.client_id = $${idx++}`);
      params.push(clientId);
    }
    if (clientIds && clientIds.length > 0) {
      conditions.push(`c.client_id = ANY($${idx++}::int[])`);
      params.push(clientIds);
    }
    if (productIds && productIds.length > 0) {
      conditions.push(`c.product_id = ANY($${idx++}::int[])`);
      params.push(productIds);
    }
    if (agentId) {
      conditions.push(`vt.assigned_to = $${idx++}`);
      params.push(agentId);
    }
    if (agentIds && agentIds.length > 0) {
      conditions.push(`vt.assigned_to = ANY($${idx++}::uuid[])`);
      params.push(agentIds);
    }

    const whereClause = conditions.join(' AND ');

    // ----------------------------------------------------------------------
    // CORE QUERY: Aggregating Verification Tasks (Flow & Snapshot)
    // ----------------------------------------------------------------------
    // We calculate 4 sets of numbers:
    // 1. CP Flow (Created/Completed in last 7 days)
    // 2. PP Flow (Created/Completed in prev 7 days)
    // 3. CP Snapshot (Status at NOW)
    // 4. PP Snapshot (Status at NOW-7d)

    // NOTE: reconstructing PP Snapshot for "In Progress" requires checking history.
    // Logic: Task was InProgress at T if:
    //    created_at <= T AND (completed_at > T OR completed_at IS NULL)
    //    AND status != 'REVOKED' (simplified)

    const coreQuery = `
      WITH date_ranges AS (
        SELECT 
          NOW() as cp_end,
          NOW() - INTERVAL '7 days' as cp_start,
          NOW() - INTERVAL '7 days' as pp_end,  -- same as cp_start
          NOW() - INTERVAL '14 days' as pp_start,
          CURRENT_DATE as today_start,
          CURRENT_DATE - INTERVAL '1 day' as yesterday_start
      ),
      filtered_tasks AS (
        SELECT vt.* 
        FROM verification_tasks vt
        LEFT JOIN cases c ON vt.case_id = c.id
        WHERE ${whereClause}
      )
      SELECT
        -- VOLUME (CREATED)
        COUNT(*) FILTER (WHERE created_at BETWEEN (SELECT cp_start FROM date_ranges) AND (SELECT cp_end FROM date_ranges)) as cp_created,
        COUNT(*) FILTER (WHERE created_at BETWEEN (SELECT pp_start FROM date_ranges) AND (SELECT pp_end FROM date_ranges)) as pp_created,
        
        -- COMPLETED (FLOW)
        COUNT(*) FILTER (WHERE status = 'COMPLETED' AND completed_at BETWEEN (SELECT cp_start FROM date_ranges) AND (SELECT cp_end FROM date_ranges)) as cp_completed,
        COUNT(*) FILTER (WHERE status = 'COMPLETED' AND completed_at BETWEEN (SELECT pp_start FROM date_ranges) AND (SELECT pp_end FROM date_ranges)) as pp_completed,

        -- REVOKED (FLOW)
        COUNT(*) FILTER (WHERE status = 'REVOKED' AND updated_at BETWEEN (SELECT cp_start FROM date_ranges) AND (SELECT cp_end FROM date_ranges)) as cp_revoked,
        COUNT(*) FILTER (WHERE status = 'REVOKED' AND updated_at BETWEEN (SELECT pp_start FROM date_ranges) AND (SELECT pp_end FROM date_ranges)) as pp_revoked,

        -- ON HOLD (FLOW)
        COUNT(*) FILTER (WHERE status = 'ON_HOLD' AND updated_at BETWEEN (SELECT cp_start FROM date_ranges) AND (SELECT cp_end FROM date_ranges)) as cp_on_hold,
        COUNT(*) FILTER (WHERE status = 'ON_HOLD' AND updated_at BETWEEN (SELECT pp_start FROM date_ranges) AND (SELECT pp_end FROM date_ranges)) as pp_on_hold,

        -- IN PROGRESS (SNAPSHOT RECONSTRUCTION)
        -- Current: Status is IN_PROGRESS
        COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as cp_in_progress,
        
        -- Previous: Created before PP_End AND (Not completed OR Completed after PP_End)
        COUNT(*) FILTER (
          WHERE created_at <= (SELECT pp_end FROM date_ranges) 
          AND (completed_at > (SELECT pp_end FROM date_ranges) OR completed_at IS NULL)
          AND status != 'REVOKED' -- Exclude revoked from active count approximation
        ) as pp_in_progress,

        -- OPEN TASKS (PENDING + ASSIGNED + IN_PROGRESS)
        COUNT(*) FILTER (WHERE status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')) as cp_open,
        COUNT(*) FILTER (
           WHERE created_at <= (SELECT pp_end FROM date_ranges)
           AND (completed_at > (SELECT pp_end FROM date_ranges) OR completed_at IS NULL)
           -- Ideally strict logic would check assignment history, but this is a solid approximation
        ) as pp_open,

        -- TODAY OPS (vs YESTERDAY)
        COUNT(*) FILTER (WHERE status = 'COMPLETED' AND completed_at >= (SELECT today_start FROM date_ranges)) as today_completed,
        COUNT(*) FILTER (WHERE status = 'COMPLETED' AND completed_at >= (SELECT yesterday_start FROM date_ranges) AND completed_at < (SELECT today_start FROM date_ranges)) as yesterday_completed,
        
        COUNT(*) FILTER (WHERE assigned_at >= (SELECT today_start FROM date_ranges)) as today_assigned,
        COUNT(*) FILTER (WHERE assigned_at >= (SELECT yesterday_start FROM date_ranges) AND assigned_at < (SELECT today_start FROM date_ranges)) as yesterday_assigned,

        -- FINANCIAL
        SUM(estimated_amount) FILTER (WHERE created_at BETWEEN (SELECT cp_start FROM date_ranges) AND (SELECT cp_end FROM date_ranges)) as cp_est_amt,
        SUM(estimated_amount) FILTER (WHERE created_at BETWEEN (SELECT pp_start FROM date_ranges) AND (SELECT pp_end FROM date_ranges)) as pp_est_amt,

        SUM(actual_amount) FILTER (WHERE status = 'COMPLETED' AND completed_at BETWEEN (SELECT cp_start FROM date_ranges) AND (SELECT cp_end FROM date_ranges)) as cp_act_amt,
        SUM(actual_amount) FILTER (WHERE status = 'COMPLETED' AND completed_at BETWEEN (SELECT pp_start FROM date_ranges) AND (SELECT pp_end FROM date_ranges)) as pp_act_amt,

        -- OVERDUE & RISK (SNAPSHOT)
        COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'REVOKED', 'CANCELLED') AND created_at < NOW() - INTERVAL '72 hours') as cp_overdue,
        COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'REVOKED', 'CANCELLED') AND created_at < NOW() - INTERVAL '24 hours') as cp_sla_risk,
        AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/86400) FILTER (WHERE status NOT IN ('COMPLETED', 'REVOKED', 'CANCELLED') AND created_at < NOW() - INTERVAL '72 hours') as cp_avg_overdue_days,
        COUNT(*) FILTER (WHERE status = 'COMPLETED' AND completed_at >= CURRENT_DATE) as completed_today
      FROM filtered_tasks
    `;

    // ----------------------------------------------------------------------
    // LEGACY: CASES QUERY
    // ----------------------------------------------------------------------
    const casesQuery = `
      WITH date_ranges AS (
        SELECT 
          NOW() as cp_end,
          NOW() - INTERVAL '7 days' as cp_start,
          NOW() - INTERVAL '7 days' as pp_end,
          NOW() - INTERVAL '14 days' as pp_start
      )
      SELECT 
        -- TOTAL (Created)
        COUNT(*) FILTER (WHERE created_at BETWEEN (SELECT cp_start FROM date_ranges) AND (SELECT cp_end FROM date_ranges)) as cp_total,
        COUNT(*) FILTER (WHERE created_at BETWEEN (SELECT pp_start FROM date_ranges) AND (SELECT pp_end FROM date_ranges)) as pp_total,

        -- IN PROGRESS (Snapshot)
        COUNT(*) FILTER (WHERE status IN ('IN_PROGRESS', 'PENDING')) as cp_active,
        COUNT(*) FILTER (WHERE created_at <= (SELECT pp_end FROM date_ranges) AND (status NOT IN ('COMPLETED', 'CLOSED') OR updated_at > (SELECT pp_end FROM date_ranges))) as pp_active, 

        -- COMPLETED (Flow)
        COUNT(*) FILTER (WHERE status = 'COMPLETED' AND updated_at BETWEEN (SELECT cp_start FROM date_ranges) AND (SELECT cp_end FROM date_ranges)) as cp_completed,
        COUNT(*) FILTER (WHERE status = 'COMPLETED' AND updated_at BETWEEN (SELECT pp_start FROM date_ranges) AND (SELECT pp_end FROM date_ranges)) as pp_completed

      FROM cases c
      -- We must apply filters if relevant (Agent filter might not apply to Cases directly if assigned at task level, implies Join)
      -- Keeping simple based strictly on table 'cases' but respecting clientId
      WHERE 1=1 ${clientId ? `AND client_id = $1` : ''}
    `;
    // Note: If agentId is provided, cases query might be inaccurate unless we join tasks or look at case assignment.
    // Assuming for dashboard simplicity, Agent view focuses on Tasks.

    // ----------------------------------------------------------------------
    // ENTITY QUERIES (Clients & Agents)
    // ----------------------------------------------------------------------
    const clientsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active
      FROM clients
    `;

    const agentsQuery = `
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
    const kycQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE verification_status = 'PENDING') as pending,
        COUNT(*) FILTER (WHERE verification_status = 'PASS') as passed,
        COUNT(*) FILTER (WHERE verification_status = 'FAIL') as failed,
        COUNT(*) FILTER (WHERE verification_status = 'REFER') as referred,
        COUNT(*) FILTER (WHERE verified_at >= CURRENT_DATE) as verified_today
      FROM kyc_document_verifications
    `;

    const [taskRes, casesRes, clientsRes, agentsRes, perfRes, kycRes] = await Promise.all([
      query(coreQuery, params),
      query(casesQuery, clientId ? [clientId] : []),
      query(clientsQuery),
      query(agentsQuery),
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
      query(kycQuery),
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
          onHold: buildMetric(stats.cpOnHold, stats.ppOnHold),
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
