-- 2026-05-22 — Filter-standardization sweep Page 3 (KYC Rates).
-- Backfill any NULL, tighten kyc_rates.is_active to NOT NULL DEFAULT TRUE.
-- idx_kyc_rates_active already exists (created on the table since rename).
--
-- Apply via:
--   docker exec crm_postgres psql -U acs_user -d acs_db -f <this file>

UPDATE public.kyc_rates SET is_active = true WHERE is_active IS NULL;
ALTER TABLE public.kyc_rates ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE public.kyc_rates ALTER COLUMN is_active SET DEFAULT true;
