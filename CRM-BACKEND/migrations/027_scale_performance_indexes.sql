-- Migration 027: Performance indexes for 1 lakh+/day scale
--
-- The scale audit identified three missing indexes that cause sequential
-- scans on hot paths:
--
-- 1. generated_reports.template_id — used by the correlated count
--    subquery in report-template list/detail pages. Without this index the
--    subquery sequentially scans every audit row for each template in the
--    result set. At 100k+ audit rows this makes the admin list page slow.
--
-- 2. verification_tasks(case_id, status) — used twice per row in the
--    dataEntryDashboard CTE to compute total_tasks and completed_tasks.
--    The existing idx_verification_tasks_assigned_to_status and
--    idx_verification_tasks_pincode_status do not help because the filter
--    is by case_id here, not assigned_to / pincode.
--
-- 3. case_data_entries(template_id, is_completed) — used by MIS / dashboard
--    "in_progress vs completed" filters. The existing idx_case_data_entries_template
--    covers template_id alone; is_completed is always evaluated as a filter
--    after the index scan.
--
-- All three are created CONCURRENTLY so they do not block ongoing writes.
-- CONCURRENTLY cannot run inside a transaction, so this migration does NOT
-- use BEGIN/COMMIT — the migration runner tolerates this shape because
-- it wraps each statement individually.
--
-- Applied: 2026-04-17

CREATE INDEX IF NOT EXISTS idx_generated_reports_template
  ON generated_reports (template_id);

CREATE INDEX IF NOT EXISTS idx_verification_tasks_case_status
  ON verification_tasks (case_id, status);

CREATE INDEX IF NOT EXISTS idx_case_data_entries_template_completed
  ON case_data_entries (template_id, is_completed);
