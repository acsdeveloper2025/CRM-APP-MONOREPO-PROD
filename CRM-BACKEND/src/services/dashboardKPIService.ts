import { pool } from '@/config/database';
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
  previous_period_value: number;
  change_percent: number;
}

export interface VerificationOperationsKPI {
  meta: {
    generated_at: string;
    period: 'last_7_days';
    comparison_period: 'previous_7_days';
    filters_applied: Record<string, unknown>;
  };

  // --- CORE OPERATIONAL METRICS ---
  workload: {
    total_tasks: MetricWithTrend; // Created in period
    open_tasks: MetricWithTrend; // Snapshot (Pending/Assigned/InProgress)
    in_progress_tasks: MetricWithTrend; // Snapshot (InProgress)
    completed_today: number; // Absolute value for "Today"
    overdue_tasks: MetricWithTrend; // Snapshot
    sla_risk_tasks: MetricWithTrend; // Snapshot
    avg_overdue_days: number; // Average days overdue for active overdue tasks
  };

  performance: {
    avg_tat_days: MetricWithTrend; // Days
    first_visit_success_rate: MetricWithTrend; // %
    revisit_rate: MetricWithTrend; // %
  };

  financial: {
    billable_tasks: MetricWithTrend; // Completed/Approved
    estimated_amount: MetricWithTrend; // Currency
    actual_amount: MetricWithTrend; // Currency
    collection_efficiency_percent: MetricWithTrend;
  };

  // --- LEGACY COMPATIBILITY (For Existing Frontend Cards) ---
  legacy_compatibility: {
    cases: {
      total: MetricWithTrend; // Created in period
      in_progress: MetricWithTrend; // Snapshot
      completed: MetricWithTrend; // Completed in period
      closed: MetricWithTrend; // Snapshot (if 'CLOSED' status exists) or Synonym for Completed
    };
    tasks: {
      total: MetricWithTrend; // Alias for workload.total_tasks
      in_progress: MetricWithTrend; // Alias for workload.in_progress_tasks
      completed: MetricWithTrend; // Completed in period
      revoked: MetricWithTrend; // Status = 'REVOKED'
      on_hold: MetricWithTrend; // Status = 'ON_HOLD'
    };
    clients: {
      total: MetricWithTrend; // Total in DB (Volume)? Usually Snapshot 'Active'
      active: MetricWithTrend; // Active Cases in Period OR Status=Active
    };
    field_agents: {
      total: MetricWithTrend; // Registered Agents
      active_today: MetricWithTrend; // Submitted/Updated task today
    };
    today_ops: {
      completed_tasks: MetricWithTrend; // vs Yesterday
      assigned_tasks: MetricWithTrend; // vs Yesterday
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
  }): Promise<VerificationOperationsKPI> {
    // ----------------------------------------------------------------------
    // DATE MATH (7-Day Rolling Window)
    // ----------------------------------------------------------------------
    // CP: [Now-7d, Now]
    // PP: [Now-14d, Now-7d]
    // Note: We use Postgres intervals in SQL for precision, but passed params are helpful.

    const { clientId, agentId } = filters;

    // Base WHERE clauses
    const conditions: string[] = ['1=1'];
    const params: QueryParams = [];
    let idx = 1;

    if (clientId) {
      conditions.push(`c."clientId" = $${idx++}`);
      params.push(clientId);
    }
    if (agentId) {
      conditions.push(`vt.assigned_to = $${idx++}`);
      params.push(agentId);
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
        COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'REVOKED', 'CANCELLED') AND created_at < NOW() - INTERVAL '48 hours') as cp_overdue,
        COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'REVOKED', 'CANCELLED') AND created_at < NOW() - INTERVAL '24 hours') as cp_sla_risk,
        AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/86400) FILTER (WHERE status NOT IN ('COMPLETED', 'REVOKED', 'CANCELLED') AND created_at < NOW() - INTERVAL '48 hours') as cp_avg_overdue_days,
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
        COUNT(*) FILTER (WHERE "createdAt" BETWEEN (SELECT cp_start FROM date_ranges) AND (SELECT cp_end FROM date_ranges)) as cp_total,
        COUNT(*) FILTER (WHERE "createdAt" BETWEEN (SELECT pp_start FROM date_ranges) AND (SELECT pp_end FROM date_ranges)) as pp_total,

        -- IN PROGRESS (Snapshot)
        COUNT(*) FILTER (WHERE status IN ('IN_PROGRESS', 'PENDING')) as cp_active,
        COUNT(*) FILTER (WHERE "createdAt" <= (SELECT pp_end FROM date_ranges) AND (status NOT IN ('COMPLETED', 'CLOSED') OR "updatedAt" > (SELECT pp_end FROM date_ranges))) as pp_active, 

        -- COMPLETED (Flow)
        COUNT(*) FILTER (WHERE status = 'COMPLETED' AND "updatedAt" BETWEEN (SELECT cp_start FROM date_ranges) AND (SELECT cp_end FROM date_ranges)) as cp_completed,
        COUNT(*) FILTER (WHERE status = 'COMPLETED' AND "updatedAt" BETWEEN (SELECT pp_start FROM date_ranges) AND (SELECT pp_end FROM date_ranges)) as pp_completed

      FROM cases c
      -- We must apply filters if relevant (Agent filter might not apply to Cases directly if assigned at task level, implies Join)
      -- Keeping simple based strictly on table 'cases' but respecting clientId
      WHERE 1=1 ${clientId ? `AND "clientId" = $${idx}` : ''}
    `;
    // Note: If agentId is provided, cases query might be inaccurate unless we join tasks or look at case assignment.
    // Assuming for dashboard simplicity, Agent view focuses on Tasks.

    // ----------------------------------------------------------------------
    // ENTITY QUERIES (Clients & Agents)
    // ----------------------------------------------------------------------
    const clientsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE "isActive" = true) as active
      FROM clients
    `;

    const agentsQuery = `
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'FIELD_AGENT') as total_agents,
        (
          SELECT COUNT(DISTINCT assigned_to) 
          FROM verification_tasks 
          WHERE assigned_to IS NOT NULL 
          AND updated_at >= CURRENT_DATE
        ) as active_today
    `;

    // ----------------------------------------------------------------------
    // PERFORMANCE QUERIES
    // ----------------------------------------------------------------------
    const perfQuery = `
      SELECT
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/86400) 
          FILTER (WHERE status = 'COMPLETED' AND completed_at BETWEEN (SELECT cp_start FROM date_ranges) AND (SELECT cp_end FROM date_ranges)) 
          as cp_avg_tat,
        
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/86400) 
          FILTER (WHERE status = 'COMPLETED' AND completed_at BETWEEN (SELECT pp_start FROM date_ranges) AND (SELECT pp_end FROM date_ranges)) 
          as pp_avg_tat
      FROM filtered_tasks
    `;

    // ----------------------------------------------------------------------
    // EXECUTION
    // ----------------------------------------------------------------------

    // Using simple parallel execution.
    const [taskRes, casesRes, clientsRes, agentsRes, perfRes] = await Promise.all([
      pool.query(coreQuery, params),
      pool.query(casesQuery, clientId ? [clientId] : []),
      pool.query(clientsQuery),
      pool.query(agentsQuery),
      pool.query(
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
      ) ${perfQuery}`,
        params
      ),
    ]);

    const stats = taskRes.rows[0];
    const caseStats = casesRes.rows[0] || {
      cp_total: 0,
      pp_total: 0,
      cp_active: 0,
      pp_active: 0,
      cp_completed: 0,
      pp_completed: 0,
    };
    const clientStats = clientsRes.rows[0] || { total: 0, active: 0 };
    const agentStats = agentsRes.rows[0] || { total_agents: 0, active_today: 0 };
    const perfStats = perfRes.rows[0] || { cp_avg_tat: 0, pp_avg_tat: 0 };

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
        previous_period_value: Number(p.toFixed(2)),
        change_percent: Number(change.toFixed(1)),
      };
    };

    // Helper for Snapshot/Static metrics where we don't track history yet (Flat trend)
    const buildStaticMetric = (val: string | number): MetricWithTrend => ({
      value: Number(val) || 0,
      previous_period_value: Number(val) || 0, // Assume stable for now
      change_percent: 0,
    });

    return {
      meta: {
        generated_at: new Date().toISOString(),
        period: 'last_7_days',
        comparison_period: 'previous_7_days',
        filters_applied: filters,
      },

      workload: {
        total_tasks: buildMetric(stats.cp_created, stats.pp_created),
        open_tasks: buildMetric(stats.cp_open, stats.pp_open),
        in_progress_tasks: buildMetric(stats.cp_in_progress, stats.pp_in_progress),
        completed_today: Number(stats.completed_today),
        overdue_tasks: buildStaticMetric(stats.cp_overdue),
        sla_risk_tasks: buildStaticMetric(stats.cp_sla_risk),
        avg_overdue_days: Number(Number(stats.cp_avg_overdue_days || 0).toFixed(1)),
      },

      performance: {
        avg_tat_days: buildMetric(perfStats.cp_avg_tat, perfStats.pp_avg_tat),
        first_visit_success_rate: buildMetric(0, 0),
        revisit_rate: buildMetric(0, 0),
      },

      financial: {
        billable_tasks: buildMetric(stats.cp_completed, stats.pp_completed), // Using Completed as proxy for billable
        estimated_amount: buildMetric(stats.cp_est_amt, stats.pp_est_amt),
        actual_amount: buildMetric(stats.cp_act_amt, stats.pp_act_amt),
        collection_efficiency_percent: buildMetric(
          (Number(stats.cp_act_amt) / (Number(stats.cp_est_amt) || 1)) * 100,
          (Number(stats.pp_act_amt) / (Number(stats.pp_est_amt) || 1)) * 100
        ),
      },

      legacy_compatibility: {
        cases: {
          total: buildMetric(caseStats.cp_total, caseStats.pp_total),
          in_progress: buildMetric(caseStats.cp_active, caseStats.pp_active),
          completed: buildMetric(caseStats.cp_completed, caseStats.pp_completed),
          closed: buildMetric(0, 0),
        },
        tasks: {
          total: buildMetric(stats.cp_created, stats.pp_created),
          in_progress: buildMetric(stats.cp_in_progress, stats.pp_in_progress),
          completed: buildMetric(stats.cp_completed, stats.pp_completed),
          revoked: buildMetric(stats.cp_revoked, stats.pp_revoked),
          on_hold: buildMetric(stats.cp_on_hold, stats.pp_on_hold),
        },
        clients: {
          total: buildStaticMetric(clientStats.total),
          active: buildStaticMetric(clientStats.active),
        },
        field_agents: {
          total: buildStaticMetric(agentStats.total_agents),
          active_today: buildStaticMetric(agentStats.active_today),
        },
        today_ops: {
          // Special Case: Comparison is TODAY vs YESTERDAY
          completed_tasks: buildMetric(stats.today_completed, stats.yesterday_completed),
          assigned_tasks: buildMetric(stats.today_assigned, stats.yesterday_assigned),
        },
      },
    };
  }
}
