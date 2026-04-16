-- Migration 021: Template list ordering index + drop unused prefill_source index
--
-- Two index housekeeping items flagged by the production readiness audit:
--
-- 1. ADD composite index on case_data_templates for the list endpoint's
--    ORDER BY. At 100s of clients × products, the template list can grow
--    to thousands of rows. The list endpoint sorts by created_at DESC
--    (default) and the planner falls back to in-memory sort without an
--    index on that column. This partial index covers the common "active
--    templates, newest first" path.
--
-- 2. DROP the unused idx_case_data_template_fields_prefill_source index
--    from migration 020. It was built for a "list only prefill fields"
--    query path that never materialized — the resolver always fetches
--    all fields for a template and filters in-app. The index adds write
--    cost on every field INSERT/UPDATE for no read benefit.
--
-- Both operations use IF EXISTS / IF NOT EXISTS for idempotence.
-- CONCURRENTLY is not used because the tables are small and the
-- migration is wrapped in a transaction.
--
-- Applied: 2026-04-16

BEGIN;

-- 1. Ordering index for the template list endpoint
CREATE INDEX IF NOT EXISTS idx_case_data_templates_list_order
  ON case_data_templates (created_at DESC)
  WHERE is_active = true;

-- 2. Drop unused prefill_source index
DROP INDEX IF EXISTS idx_case_data_template_fields_prefill_source;

COMMIT;
