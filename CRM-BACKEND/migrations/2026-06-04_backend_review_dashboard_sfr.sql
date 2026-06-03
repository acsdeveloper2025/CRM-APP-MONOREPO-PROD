-- Backend Review: add a point-in-time "awaiting backend review" snapshot to the
-- dashboard KPI materialized view. SUBMITTED_FOR_REVIEW = FE submitted, not yet
-- finalized — it must be visible as a live backlog on the dashboard (the windowed
-- completion/flow metrics correctly exclude it).
--
-- Recreates mv_dashboard_kpi_7d from the authoritative 2026-05-28 TAT definition
-- (the live view on some envs is stale/pre-TAT; this recreate also re-heals that
-- drift) + ONE new snapshot column cp_submitted_for_review. Idempotent.
-- Ref: BACKEND_REVIEW_IMPLEMENTATION_PLAN_2026-06-03.md.

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
  -- NEW: point-in-time count of tasks awaiting mandatory backend review.
  COUNT(*) FILTER (WHERE vt.status = 'SUBMITTED_FOR_REVIEW')                                  AS cp_submitted_for_review,
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
