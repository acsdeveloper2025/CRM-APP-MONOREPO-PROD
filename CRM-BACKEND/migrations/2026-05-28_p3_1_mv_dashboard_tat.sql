-- Phase 3.1 (P5 "Phase C") — fold perfQuery TAT into mv_dashboard_kpi_7d.
--
-- dashboardKPIService.getKPIs ran a separate perfQuery: a full CTE scan over
-- verification_tasks computing AVG(completed_at - created_at) for the current
-- and previous 7-day windows on every dashboard cache-miss. AVG-of-differences
-- can't be a plain SUM across pre-grouped rows, but SUM(tat) + COUNT can — then
-- the service recovers a weighted AVG (exactly like cp_avg_overdue_days does).
-- This rebuilds the mat view with 4 added columns and removes the raw perfQuery.
--
-- This is a DROP + CREATE of the mat view (adds columns). On prod the dashboard
-- coreQuery has no fallback during the rebuild, so apply during low traffic;
-- DROP+CREATE+REFRESH in one psql -f run completes quickly at current scale.
-- CONCURRENTLY is not used here (initial REFRESH on a fresh MV cannot be
-- concurrent); the 5-min dbMaintenanceService refresh stays CONCURRENT after.
--
-- Apply with: psql "<conn>" -f this_file.sql

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_kpi_7d;

CREATE MATERIALIZED VIEW mv_dashboard_kpi_7d AS
SELECT
  vt.assigned_to                                        AS agent_user_id,
  c.created_by_backend_user                             AS creator_user_id,
  c.client_id,
  c.product_id,

  COUNT(*) FILTER (WHERE vt.created_at >= NOW() - INTERVAL '7 days')                         AS cp_created,
  COUNT(*) FILTER (WHERE vt.created_at >= NOW() - INTERVAL '14 days'
                     AND vt.created_at <  NOW() - INTERVAL '7 days')                          AS pp_created,

  COUNT(*) FILTER (WHERE vt.status = 'COMPLETED'
                     AND vt.completed_at >= NOW() - INTERVAL '7 days')                        AS cp_completed,
  COUNT(*) FILTER (WHERE vt.status = 'COMPLETED'
                     AND vt.completed_at >= NOW() - INTERVAL '14 days'
                     AND vt.completed_at <  NOW() - INTERVAL '7 days')                        AS pp_completed,

  COUNT(*) FILTER (WHERE vt.status = 'REVOKED'
                     AND vt.updated_at >= NOW() - INTERVAL '7 days')                          AS cp_revoked,
  COUNT(*) FILTER (WHERE vt.status = 'REVOKED'
                     AND vt.updated_at >= NOW() - INTERVAL '14 days'
                     AND vt.updated_at <  NOW() - INTERVAL '7 days')                          AS pp_revoked,

  COUNT(*) FILTER (WHERE vt.status = 'IN_PROGRESS')                                           AS cp_in_progress,
  COUNT(*) FILTER (WHERE vt.status IN ('PENDING','ASSIGNED','IN_PROGRESS'))                   AS cp_open,
  COUNT(*) FILTER (
    WHERE vt.created_at <= NOW() - INTERVAL '7 days'
      AND (vt.completed_at > NOW() - INTERVAL '7 days' OR vt.completed_at IS NULL)
      AND vt.status != 'REVOKED'
  ) AS pp_in_progress,
  COUNT(*) FILTER (
    WHERE vt.created_at <= NOW() - INTERVAL '7 days'
      AND (vt.completed_at > NOW() - INTERVAL '7 days' OR vt.completed_at IS NULL)
  ) AS pp_open,
  COUNT(*) FILTER (WHERE vt.status NOT IN ('COMPLETED','REVOKED','CANCELLED')
                     AND vt.created_at < NOW() - INTERVAL '72 hours')                         AS cp_overdue,
  COUNT(*) FILTER (WHERE vt.status NOT IN ('COMPLETED','REVOKED','CANCELLED')
                     AND vt.created_at < NOW() - INTERVAL '24 hours')                         AS cp_sla_risk,
  AVG(EXTRACT(EPOCH FROM (NOW() - vt.created_at)) / 86400)
    FILTER (WHERE vt.status NOT IN ('COMPLETED','REVOKED','CANCELLED')
              AND vt.created_at < NOW() - INTERVAL '72 hours')                                AS cp_avg_overdue_days,

  COUNT(*) FILTER (WHERE vt.status = 'COMPLETED'
                     AND vt.completed_at >= CURRENT_DATE)                                     AS today_completed,
  COUNT(*) FILTER (WHERE vt.status = 'COMPLETED'
                     AND vt.completed_at >= CURRENT_DATE - INTERVAL '1 day'
                     AND vt.completed_at <  CURRENT_DATE)                                     AS yesterday_completed,
  COUNT(*) FILTER (WHERE vt.assigned_at >= CURRENT_DATE)                                      AS today_assigned,
  COUNT(*) FILTER (WHERE vt.assigned_at >= CURRENT_DATE - INTERVAL '1 day'
                     AND vt.assigned_at <  CURRENT_DATE)                                      AS yesterday_assigned,

  COALESCE(SUM(vt.estimated_amount) FILTER (WHERE vt.created_at >= NOW() - INTERVAL '7 days'), 0)  AS cp_est_amt,
  COALESCE(SUM(vt.estimated_amount) FILTER (WHERE vt.created_at >= NOW() - INTERVAL '14 days'
                                              AND vt.created_at <  NOW() - INTERVAL '7 days'), 0) AS pp_est_amt,
  COALESCE(SUM(vt.actual_amount)    FILTER (WHERE vt.status = 'COMPLETED'
                                              AND vt.completed_at >= NOW() - INTERVAL '7 days'), 0)  AS cp_act_amt,
  COALESCE(SUM(vt.actual_amount)    FILTER (WHERE vt.status = 'COMPLETED'
                                              AND vt.completed_at >= NOW() - INTERVAL '14 days'
                                              AND vt.completed_at <  NOW() - INTERVAL '7 days'), 0) AS pp_act_amt,

  -- TAT (turnaround days) sum + count per window, for weighted AVG in the
  -- service. Folds the former perfQuery off the raw verification_tasks scan.
  -- KYC is already excluded by the WHERE clause below (matches perfQuery's
  -- COALESCE(task_type,'NORMAL') <> 'KYC').
  COALESCE(SUM(EXTRACT(EPOCH FROM (vt.completed_at - vt.created_at)) / 86400)
    FILTER (WHERE vt.status = 'COMPLETED'
              AND vt.completed_at >= NOW() - INTERVAL '7 days'), 0)                           AS cp_tat_sum,
  COUNT(*) FILTER (WHERE vt.status = 'COMPLETED'
              AND vt.completed_at >= NOW() - INTERVAL '7 days')                               AS cp_tat_count,
  COALESCE(SUM(EXTRACT(EPOCH FROM (vt.completed_at - vt.created_at)) / 86400)
    FILTER (WHERE vt.status = 'COMPLETED'
              AND vt.completed_at >= NOW() - INTERVAL '14 days'
              AND vt.completed_at <  NOW() - INTERVAL '7 days'), 0)                           AS pp_tat_sum,
  COUNT(*) FILTER (WHERE vt.status = 'COMPLETED'
              AND vt.completed_at >= NOW() - INTERVAL '14 days'
              AND vt.completed_at <  NOW() - INTERVAL '7 days')                               AS pp_tat_count
FROM verification_tasks vt
LEFT JOIN cases c ON vt.case_id = c.id
WHERE COALESCE(vt.task_type, 'NORMAL') <> 'KYC'
GROUP BY vt.assigned_to, c.created_by_backend_user, c.client_id, c.product_id;

CREATE UNIQUE INDEX mv_dashboard_kpi_7d_dims_idx
  ON mv_dashboard_kpi_7d (agent_user_id, creator_user_id, client_id, product_id)
  NULLS NOT DISTINCT;
CREATE INDEX mv_dashboard_kpi_7d_agent_idx   ON mv_dashboard_kpi_7d (agent_user_id);
CREATE INDEX mv_dashboard_kpi_7d_creator_idx ON mv_dashboard_kpi_7d (creator_user_id);
CREATE INDEX mv_dashboard_kpi_7d_client_idx  ON mv_dashboard_kpi_7d (client_id);
CREATE INDEX mv_dashboard_kpi_7d_product_idx ON mv_dashboard_kpi_7d (product_id);

REFRESH MATERIALIZED VIEW mv_dashboard_kpi_7d;
