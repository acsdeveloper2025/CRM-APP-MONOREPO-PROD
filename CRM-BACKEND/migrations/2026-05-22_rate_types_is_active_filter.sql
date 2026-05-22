-- 2026-05-22 — tighten rate_types.is_active to NOT NULL DEFAULT TRUE +
-- add filter index. Part of the rate management filter-standardization
-- sweep (Page 1 — Rate Types). Mirror of the Client Mgmt pattern from
-- 2026-05-22_clients_is_active_filter.sql.
--
-- Apply via:
--   docker exec crm_postgres psql -U acs_user -d acs_db -f <this file>
-- Prod (deferred until deploy):
--   ssh ... && docker exec crm_postgres psql -U acs_user -d acs_db -f ...

ALTER TABLE public.rate_types ALTER COLUMN is_active SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rate_types_is_active ON public.rate_types (is_active);
