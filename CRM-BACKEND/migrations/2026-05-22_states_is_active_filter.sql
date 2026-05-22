-- Tighten public.states.is_active for the canonical list-page filter shell.
ALTER TABLE public.states
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_states_is_active
  ON public.states(is_active);
