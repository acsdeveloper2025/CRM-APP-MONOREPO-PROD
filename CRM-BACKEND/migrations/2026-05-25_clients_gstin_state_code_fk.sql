-- D7 (audit 2026-05-25): promote partial unique on states.gst_state_code to a
-- full unique constraint, then add FK from clients.gstin_state_code so that
-- billing-state codes on clients cannot drift from the states master.
--
-- Pre-conditions (verified live on local + prod 2026-05-25):
--   * states: 1 row, 0 NULL gst_state_code, no FK violations
--   * clients: 2 rows, 0 orphan gstin_state_code values
--
-- This migration is idempotent: each block guards against re-applying when the
-- target constraint already exists. Two scenarios it must survive:
--   1. Fresh install: dump creates final constraints, then runner re-applies
--      → IF NOT EXISTS short-circuits, no-op
--   2. Existing env: runner already has row in schema_migrations → never re-runs
-- Without the IF NOT EXISTS guards, the literal `DROP CONSTRAINT … ADD CONSTRAINT`
-- pattern fails on fresh installs because the FK depends on the unique
-- (PG error: 2BP01 "cannot drop constraint … because other objects depend on it").

DO $$
BEGIN
  -- 1+2. Promote partial unique index → full UNIQUE CONSTRAINT (FK-valid)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'states'
      AND constraint_name = 'states_gst_state_code_key'
      AND constraint_type = 'UNIQUE'
  ) THEN
    DROP INDEX IF EXISTS public.states_gst_state_code_unique;
    ALTER TABLE public.states
      ADD CONSTRAINT states_gst_state_code_key UNIQUE (gst_state_code);
  END IF;

  -- 3. Add FK from clients.gstin_state_code → states.gst_state_code
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND constraint_name = 'clients_gstin_state_code_fkey'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_gstin_state_code_fkey
      FOREIGN KEY (gstin_state_code)
      REFERENCES public.states(gst_state_code)
      ON DELETE SET NULL;
  END IF;
END $$;
