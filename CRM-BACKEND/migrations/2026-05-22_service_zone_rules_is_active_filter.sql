-- 2026-05-22 — Filter-standardization sweep Page 2 (Service Zone Rules).
-- Backfill any NULL → true, tighten is_active to NOT NULL DEFAULT TRUE,
-- add filter index.
--
-- Apply via:
--   docker exec crm_postgres psql -U acs_user -d acs_db -f <this file>

UPDATE public.service_zone_rules SET is_active = true WHERE is_active IS NULL;
ALTER TABLE public.service_zone_rules ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE public.service_zone_rules ALTER COLUMN is_active SET DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_service_zone_rules_is_active
  ON public.service_zone_rules (is_active);
