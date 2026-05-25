-- D7 (audit 2026-05-25): promote partial unique on states.gst_state_code to a
-- full unique constraint, then add FK from clients.gstin_state_code so that
-- billing-state codes on clients cannot drift from the states master.
--
-- Pre-conditions (verified live on local + prod 2026-05-25):
--   * states: 1 row, 0 NULL gst_state_code, no FK violations
--   * clients: 2 rows, 0 orphan gstin_state_code values
--
-- The DROP INDEX + ADD CONSTRAINT is functionally instant on a 1-row table.
-- Postgres unique CONSTRAINTs allow multiple NULL rows (same semantic as the
-- partial unique it replaces, just FK-valid).

-- 1. Drop the partial unique index (cannot be used as a FK target)
DROP INDEX IF EXISTS public.states_gst_state_code_unique;

-- 2. Promote to a full unique constraint (FK-valid; still allows NULL rows)
ALTER TABLE public.states
  DROP CONSTRAINT IF EXISTS states_gst_state_code_key;
ALTER TABLE public.states
  ADD CONSTRAINT states_gst_state_code_key UNIQUE (gst_state_code);

-- 3. Add FK from clients.gstin_state_code to states.gst_state_code
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_gstin_state_code_fkey;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_gstin_state_code_fkey
  FOREIGN KEY (gstin_state_code)
  REFERENCES public.states(gst_state_code)
  ON DELETE SET NULL;
