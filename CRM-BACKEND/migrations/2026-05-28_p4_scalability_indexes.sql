-- Phase 4 — scalability indexes (API+DB audit 2026-05-28)
-- Confirmed-missing indexes backing list sorts, TAT/aging aggregates, geo,
-- latest-submission lookups, overdue-invoice filters, and search ILIKE.
--
-- IMPORTANT: every statement uses CREATE INDEX CONCURRENTLY, which CANNOT run
-- inside a transaction block. Apply with `psql -f` (autocommit per statement),
-- NOT inside BEGIN/COMMIT and NOT via a migration runner that wraps the file
-- in a transaction. If a CONCURRENTLY build fails it leaves an INVALID index —
-- DROP it and re-run that one statement.
--
-- pg_trgm is already present (cases.customer_name has a gin_trgm index).

-- ─── commission_calculations (1M+ at scale) ───
-- Default sort on /commissions + /commission-management/calculations is
-- ORDER BY created_at; today no created_at index exists.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_commission_calculations_created_at
  ON commission_calculations (created_at DESC);
-- Status-filtered stats/summary aggregates + pivot status<>'REJECTED'.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_commission_calculations_status_created
  ON commission_calculations (status, created_at DESC);

-- ─── cases ───
-- getCaseStats FILTER(completed) + completedAt sort.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_completed_at
  ON cases (completed_at);
-- Dedupe-cluster GROUP BY COALESCE(pan_number, customer_phone) + global-search
-- LIKE on phone; customer_name already has gin_trgm, customer_phone did not.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_customer_phone_trgm
  ON cases USING gin (customer_phone gin_trgm_ops);

-- ─── verification_tasks (1M+ at scale) ───
-- TAT / turnaround / aging AVG+FILTER blocks (stats endpoints) filter on the
-- terminal/active timestamp columns.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vt_completed_at_completed
  ON verification_tasks (completed_at) WHERE status = 'COMPLETED';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vt_started_at_in_progress
  ON verification_tasks (started_at) WHERE status = 'IN_PROGRESS';
-- Per-REVOKED-row EXISTS(replacement task) in getStats/getAllTasks; BASELINE
-- has plain parent_task_id, this composite lets the EXISTS be index-only.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vt_parent_status
  ON verification_tasks (parent_task_id, status);
-- Field-monitoring map geo branch (DISTINCT ON latest location); zero lat/lng
-- index exists today so the bbox/geo paths seq-scan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vt_assigned_geo
  ON verification_tasks (assigned_to, latitude, longitude) WHERE latitude IS NOT NULL;

-- ─── form_submissions / task_form_submissions ───
-- Latest-submission / latest-location DISTINCT ON (submitted_by, submitted_at DESC).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_submissions_submitter_recent
  ON form_submissions (submitted_by, submitted_at DESC);
-- MIS LATERAL: latest task_form_submission per task (ORDER BY submitted_at DESC, id DESC LIMIT 1).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tfs_task_recent
  ON task_form_submissions (verification_task_id, submitted_at DESC, id DESC);

-- ─── invoices ───
-- OVERDUE list filter + getInvoiceStats outstanding/overdue aggregates.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_overdue
  ON invoices (due_date) WHERE status = 'SENT' AND paid_date IS NULL;
-- Billing-list ILIKE search (invoice_number / client_name) — currently seq-scan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_invoice_number_trgm
  ON invoices USING gin (invoice_number gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_client_name_trgm
  ON invoices USING gin (client_name gin_trgm_ops);

-- ─── users ───
-- Territory + user search ILIKE on username / employee_id (only name had trgm).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username_trgm
  ON users USING gin (username gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_employee_id_trgm
  ON users USING gin (employee_id gin_trgm_ops);

-- DEFERRED (not in this file):
--   * notifications(case_id) — notifications is PARTITIONED; CONCURRENTLY is
--     unsupported on the partitioned parent. Add via per-partition CONCURRENTLY
--     or a brief-lock CREATE INDEX ON ONLY parent + attach. Handle separately.
--   * cases/verification_tasks document_type_id — columns DO NOT EXIST; the
--     deleteDocumentType usage-check that references them is a separate code bug.
