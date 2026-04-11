-- Phase D2: partial unique index preventing duplicate ACTIVE tasks
-- for the same (case_id, verification_type_id).
--
-- Motivation. The reassign-after-revoke flow in
-- src/controllers/verificationTasksController.ts's
-- createReplacementTask() inserts a new verification_task row
-- whenever a revoked task is reassigned. If two admins race to
-- reassign the same revoked task, both SELECTs return the revoked
-- row, both decide "revoked → reassign", and both INSERT a new
-- replacement. The case now has two ACTIVE tasks for the same
-- verification_type — a state the rest of the app treats as a
-- corruption because every query that groups by verification_type
-- starts producing duplicate rows.
--
-- The matching SELECT was already locked with FOR UPDATE in the
-- same commit (D2). The partial unique index adds a DB-level
-- backstop: even if some future code path forgets the FOR UPDATE,
-- the second INSERT is rejected by the DB with a unique-violation
-- error instead of silently succeeding.
--
-- Why partial: terminal states (COMPLETED, REVOKED) are allowed to
-- coexist freely — a case can have many historical tasks for the
-- same verification_type across its lifetime. The uniqueness
-- constraint only applies while the row is in an ACTIVE state
-- (PENDING / ASSIGNED / IN_PROGRESS / ON_HOLD / SAVED).
--
-- Rollback:
--   DROP INDEX IF EXISTS verification_tasks_active_unique_idx;

BEGIN;

-- Guard: fail loudly if the table already contains a duplicate. If
-- this assertion fires, the data needs to be cleaned up (or the
-- affected duplicates retired) before the index can be created.
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT case_id, verification_type_id
    FROM verification_tasks
    WHERE status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'SAVED')
    GROUP BY case_id, verification_type_id
    HAVING COUNT(*) > 1
  ) AS duplicates;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot create verification_tasks_active_unique_idx: % case/verification_type pairs already have duplicate ACTIVE tasks. Clean up data first.',
      dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS verification_tasks_active_unique_idx
  ON verification_tasks (case_id, verification_type_id)
  WHERE status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'SAVED');

COMMIT;
