-- Migration 022: Enforce one active template per client+product at the DB level
--
-- Final audit found that idx_case_data_templates_client_product_active is a
-- plain (non-unique) index. Two concurrent createTemplate requests for the
-- same (client_id, product_id) can both pass the application-level "is there
-- already an active template?" check and both INSERT, violating the one-
-- active-template invariant.
--
-- Fix: replace the plain index with a UNIQUE partial index. The DB will now
-- reject the second INSERT with a unique constraint violation, which the
-- application can catch and return a clean 409 to the caller.
--
-- Safe to apply: existing data already satisfies the constraint (checked by
-- the application's deactivation logic in updateTemplate). If the data does
-- NOT satisfy the constraint (e.g. due to a past race), the migration will
-- fail with a detailed error pointing at the duplicate rows, which must be
-- cleaned up manually before retrying.
--
-- Applied: 2026-04-16

BEGIN;

-- Drop the non-unique index first.
DROP INDEX IF EXISTS idx_case_data_templates_client_product_active;

-- Create the unique replacement.
CREATE UNIQUE INDEX idx_case_data_templates_unique_active
  ON case_data_templates (client_id, product_id)
  WHERE is_active = true;

COMMIT;
