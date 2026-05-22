-- Tighten public.pincodes.is_active for the canonical list-page filter shell.
ALTER TABLE public.pincodes
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_pincodes_is_active
  ON public.pincodes(is_active);
