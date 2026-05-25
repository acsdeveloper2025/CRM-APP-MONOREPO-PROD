-- A2.1 (audit 2026-05-25): introduce revoke_reasons master table.
-- Replaces the drift-prone hardcoded lists in CRM-FRONTEND/src/hooks/
-- useRevokeTaskAction.tsx + crm-mobile-native/src/types/enums.ts +
-- crm-mobile-native/src/types/api.ts. Seeded with the UNION of both lists
-- (9 entries) so neither consumer breaks on rollout.
--
-- Existing task_revocations.revoke_reason TEXT column is preserved for
-- historical data (4 prod rows). A new nullable revoke_reason_id FK is
-- added; new revocations should populate both columns for the transition
-- window. Future audit phase will retire the TEXT column once all
-- consumers send the FK.
--
-- Idempotent — safe to run on greenfield (dump replay) AND on
-- already-applied env. Uses information_schema guards per D7 lesson.

DO $$
BEGIN
  -- 1. Master table
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'revoke_reasons'
  ) THEN
    CREATE TABLE public.revoke_reasons (
      id           SERIAL PRIMARY KEY,
      code         VARCHAR(40)  NOT NULL,
      label        VARCHAR(100) NOT NULL,
      sort_order   INTEGER      NOT NULL DEFAULT 0,
      is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
      CONSTRAINT revoke_reasons_code_key UNIQUE (code)
    );

    CREATE INDEX idx_revoke_reasons_is_active
      ON public.revoke_reasons (is_active)
      WHERE is_active = TRUE;

    -- updated_at touch trigger reusing the shared helper
    CREATE TRIGGER update_revoke_reasons_updated_at
      BEFORE UPDATE ON public.revoke_reasons
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- 2. Seed canonical 9-row union (FE list ∪ mobile list).
  --    ON CONFLICT DO NOTHING so re-runs are no-ops.
  INSERT INTO public.revoke_reasons (code, label, sort_order, is_active) VALUES
    ('NOT_MY_AREA',              'Not my area',              10, TRUE),
    ('WRONG_PINCODE',            'Wrong pincode',            20, TRUE),
    ('ADDRESS_NOT_WORKING',      'Address not working',      30, TRUE),
    ('NOT_WORKING',              'Not working',              40, TRUE),
    ('CUSTOMER_LEFT_AREA',       'Customer left area',       50, TRUE),
    ('LEFT_AREA',                'Left area',                60, TRUE),
    ('WRONG_ADDRESS',            'Wrong address',            70, TRUE),
    ('WRONG_INCOMPLETE_ADDRESS', 'Wrong/incomplete address', 80, TRUE),
    ('OTHER',                    'Other (specify below)',    90, TRUE)
  ON CONFLICT (code) DO NOTHING;

  -- 3. Add nullable FK column to task_revocations. Existing TEXT column
  --    revoke_reason kept untouched for back-compat.
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_revocations'
      AND column_name = 'revoke_reason_id'
  ) THEN
    ALTER TABLE public.task_revocations
      ADD COLUMN revoke_reason_id INTEGER NULL;
  END IF;

  -- 4. FK constraint on the new column
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'task_revocations'
      AND constraint_name = 'task_revocations_revoke_reason_id_fkey'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.task_revocations
      ADD CONSTRAINT task_revocations_revoke_reason_id_fkey
      FOREIGN KEY (revoke_reason_id)
      REFERENCES public.revoke_reasons (id)
      ON DELETE SET NULL;
  END IF;

  -- 5. Lookup index for filtering by reason (analytics path)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'task_revocations'
      AND indexname = 'idx_task_revocations_revoke_reason_id'
  ) THEN
    CREATE INDEX idx_task_revocations_revoke_reason_id
      ON public.task_revocations (revoke_reason_id)
      WHERE revoke_reason_id IS NOT NULL;
  END IF;
END $$;
