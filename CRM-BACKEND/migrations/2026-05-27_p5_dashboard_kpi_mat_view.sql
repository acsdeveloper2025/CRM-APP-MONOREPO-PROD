-- P5 truthful-sweep 2026-05-27: dashboard KPI materialized view.
--
-- Audit context: dashboardKPIService.coreQuery currently runs a single
-- CTE with 25+ FILTER aggregates against verification_tasks on every
-- dashboard request. Today (~113 tasks) it returns sub-ms; at 1M+
-- tasks the FILTER COUNTs become a real cost. This mat view
-- pre-aggregates the dimensions the service GROUPs by so the runtime
-- query becomes a SUM across pre-grouped rows scoped to the caller's
-- permission set.
--
-- DIMENSIONS (the columns the service WHERE-clauses against):
--   agent_user_id    — verification_tasks.assigned_to (NULL = unassigned)
--   creator_user_id  — cases.created_by_backend_user
--   client_id, product_id — cases.client_id, cases.product_id
--
-- AGGREGATES (rolling 7d + snapshots + today/yesterday + financial):
--   cp_*  — current period (last 7 days)
--   pp_*  — previous period (7-14 days ago)
--   today_*, yesterday_* — calendar-day partitions
--   cp_in_progress / cp_open / cp_overdue / cp_sla_risk — point-in-time snapshots
--   cp_est_amt / cp_act_amt — money sums per period
--
-- REFRESH: scheduled every 5 min by dbMaintenanceService (P5 Phase A).
-- The window expressions (NOW(), CURRENT_DATE) freeze at refresh time;
-- stale-by-up-to-5-min is acceptable for dashboard KPIs.
--
-- KYC EXCLUSION: KYC tasks have their own dashboard section
-- (kycQuery in dashboardKPIService). Mat view scoped to
-- task_type <> 'KYC' so dashboard "Pending Tasks" counts match
-- /task-management/pending-tasks (which uses excludeTaskType=KYC).
--
-- Phase B (deferred): refactor dashboardKPIService.coreQuery to read
-- from mv_dashboard_kpi_7d instead of verification_tasks. Mat view
-- exists + refreshes in Phase A; service swap when scale demands it.

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_kpi_7d;

CREATE MATERIALIZED VIEW mv_dashboard_kpi_7d AS
SELECT
  -- Dimensions
  vt.assigned_to                                        AS agent_user_id,
  c.created_by_backend_user                             AS creator_user_id,
  c.client_id,
  c.product_id,

  -- VOLUME (CREATED)
  COUNT(*) FILTER (WHERE vt.created_at >= NOW() - INTERVAL '7 days')                         AS cp_created,
  COUNT(*) FILTER (WHERE vt.created_at >= NOW() - INTERVAL '14 days'
                     AND vt.created_at <  NOW() - INTERVAL '7 days')                          AS pp_created,

  -- FLOW (COMPLETED)
  COUNT(*) FILTER (WHERE vt.status = 'COMPLETED'
                     AND vt.completed_at >= NOW() - INTERVAL '7 days')                        AS cp_completed,
  COUNT(*) FILTER (WHERE vt.status = 'COMPLETED'
                     AND vt.completed_at >= NOW() - INTERVAL '14 days'
                     AND vt.completed_at <  NOW() - INTERVAL '7 days')                        AS pp_completed,

  -- FLOW (REVOKED)
  COUNT(*) FILTER (WHERE vt.status = 'REVOKED'
                     AND vt.updated_at >= NOW() - INTERVAL '7 days')                          AS cp_revoked,
  COUNT(*) FILTER (WHERE vt.status = 'REVOKED'
                     AND vt.updated_at >= NOW() - INTERVAL '14 days'
                     AND vt.updated_at <  NOW() - INTERVAL '7 days')                          AS pp_revoked,

  -- SNAPSHOTS (point-in-time at refresh)
  COUNT(*) FILTER (WHERE vt.status = 'IN_PROGRESS')                                           AS cp_in_progress,
  COUNT(*) FILTER (WHERE vt.status IN ('PENDING','ASSIGNED','IN_PROGRESS'))                   AS cp_open,
  -- PP snapshots (approximation — same shape as the original
  -- dashboardKPIService.coreQuery comment "solid approximation"):
  -- task was active 7 days ago if created_at <= 7d_ago AND
  -- (completed_at > 7d_ago OR completed_at IS NULL) AND status != REVOKED.
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

  -- TODAY / YESTERDAY
  COUNT(*) FILTER (WHERE vt.status = 'COMPLETED'
                     AND vt.completed_at >= CURRENT_DATE)                                     AS today_completed,
  COUNT(*) FILTER (WHERE vt.status = 'COMPLETED'
                     AND vt.completed_at >= CURRENT_DATE - INTERVAL '1 day'
                     AND vt.completed_at <  CURRENT_DATE)                                     AS yesterday_completed,
  COUNT(*) FILTER (WHERE vt.assigned_at >= CURRENT_DATE)                                      AS today_assigned,
  COUNT(*) FILTER (WHERE vt.assigned_at >= CURRENT_DATE - INTERVAL '1 day'
                     AND vt.assigned_at <  CURRENT_DATE)                                      AS yesterday_assigned,

  -- FINANCIAL (rolling 7d)
  COALESCE(SUM(vt.estimated_amount) FILTER (WHERE vt.created_at >= NOW() - INTERVAL '7 days'), 0)  AS cp_est_amt,
  COALESCE(SUM(vt.estimated_amount) FILTER (WHERE vt.created_at >= NOW() - INTERVAL '14 days'
                                              AND vt.created_at <  NOW() - INTERVAL '7 days'), 0) AS pp_est_amt,
  COALESCE(SUM(vt.actual_amount)    FILTER (WHERE vt.status = 'COMPLETED'
                                              AND vt.completed_at >= NOW() - INTERVAL '7 days'), 0)  AS cp_act_amt,
  COALESCE(SUM(vt.actual_amount)    FILTER (WHERE vt.status = 'COMPLETED'
                                              AND vt.completed_at >= NOW() - INTERVAL '14 days'
                                              AND vt.completed_at <  NOW() - INTERVAL '7 days'), 0) AS pp_act_amt
FROM verification_tasks vt
LEFT JOIN cases c ON vt.case_id = c.id
WHERE COALESCE(vt.task_type, 'NORMAL') <> 'KYC'
GROUP BY vt.assigned_to, c.created_by_backend_user, c.client_id, c.product_id;

-- UNIQUE INDEX is required for CONCURRENT REFRESH. PG 17+ supports
-- NULLS NOT DISTINCT — treats NULL values as equal for uniqueness so
-- two rows with (NULL, NULL, 1, 1) don't both qualify. Required for
-- this mat view because all 4 dimension columns are nullable.
-- Plain (non-functional) index — CONCURRENT REFRESH rejects functional
-- indexes (no expressions, no WHERE clause).
CREATE UNIQUE INDEX mv_dashboard_kpi_7d_dims_idx
  ON mv_dashboard_kpi_7d (agent_user_id, creator_user_id, client_id, product_id)
  NULLS NOT DISTINCT;

-- Common-scope lookup indexes
CREATE INDEX mv_dashboard_kpi_7d_agent_idx   ON mv_dashboard_kpi_7d (agent_user_id);
CREATE INDEX mv_dashboard_kpi_7d_creator_idx ON mv_dashboard_kpi_7d (creator_user_id);
CREATE INDEX mv_dashboard_kpi_7d_client_idx  ON mv_dashboard_kpi_7d (client_id);
CREATE INDEX mv_dashboard_kpi_7d_product_idx ON mv_dashboard_kpi_7d (product_id);

-- Initial populate
REFRESH MATERIALIZED VIEW mv_dashboard_kpi_7d;
