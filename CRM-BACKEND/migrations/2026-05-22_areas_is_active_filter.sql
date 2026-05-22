-- Tighten public.areas.is_active for the canonical list-page filter shell.
ALTER TABLE public.areas
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_areas_is_active
  ON public.areas(is_active);
