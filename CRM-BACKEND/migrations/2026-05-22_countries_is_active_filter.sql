-- Tighten public.countries.is_active for the canonical list-page filter shell.
-- Adds the column (NOT NULL DEFAULT TRUE) + a covering index for Status filter
-- queries (isActive=true|false).

ALTER TABLE public.countries
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_countries_is_active
  ON public.countries(is_active);
