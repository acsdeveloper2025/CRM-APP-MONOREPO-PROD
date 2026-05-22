-- 2026-05-22 — Filter-standardization sweep Page 4 (Rate Report).
-- Backfill NULL → true, tighten rates.is_active to NOT NULL DEFAULT TRUE,
-- add filter index. Apply via local docker + prod ssh.

UPDATE public.rates SET is_active = true WHERE is_active IS NULL;
ALTER TABLE public.rates ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE public.rates ALTER COLUMN is_active SET DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_rates_is_active ON public.rates (is_active);
