-- Tighten public.cities.is_active for the canonical list-page filter shell.
ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_cities_is_active
  ON public.cities(is_active);
