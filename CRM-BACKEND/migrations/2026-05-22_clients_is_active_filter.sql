-- 2026-05-22 — make clients.is_active dependable for a real Active/Inactive filter.
--
-- Column was already present (DEFAULT true, nullable). Tightened to NOT NULL +
-- added a covering index because the new ClientsPage filter selects on it.
-- All 2 existing rows = true so the NOT NULL flip is a no-op data-wise.
--
-- Triple-write per feedback_sql_live_db_apply.md:
--   1) acs_db_final_version.sql (CREATE TABLE block updated)
--   2) local docker crm_postgres (applied)
--   3) prod (deferred — runs at deploy time)

ALTER TABLE public.clients
  ALTER COLUMN is_active SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_is_active
  ON public.clients(is_active);
