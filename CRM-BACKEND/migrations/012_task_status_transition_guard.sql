-- Phase D1: DB-level guard for verification_tasks.status transitions.
--
-- The application enforces valid transitions in
-- src/services/taskCompletionValidator.ts via VALID_STATUS_TRANSITIONS,
-- but that's a single code path. Any other write to verification_tasks
-- (a direct UPDATE from a migration, a bug in a newer controller, an
-- ops-initiated fix) can drive the row into an impossible state and
-- corrupt downstream projections.
--
-- This migration adds a defense-in-depth layer at the DB level:
--
--   1. task_status_transitions seed table enumerates every allowed
--      (from_status, to_status) pair that the application uses today.
--      Matches the VALID_STATUS_TRANSITIONS map 1:1.
--
--   2. enforce_verification_task_status_transition() trigger function
--      runs BEFORE UPDATE on verification_tasks. When the status
--      column changes it looks the pair up in task_status_transitions
--      and raises an exception with code CHECK_VIOLATION if the pair
--      is not present.
--
--   3. The trigger is a no-op when status is unchanged, so heartbeat
--      UPDATEs on other columns pay zero extra cost.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS verification_task_status_guard ON verification_tasks;
--   DROP FUNCTION IF EXISTS enforce_verification_task_status_transition();
--   DROP TABLE IF EXISTS task_status_transitions;

BEGIN;

-- Seed table listing every allowed transition.
CREATE TABLE IF NOT EXISTS task_status_transitions (
  from_status VARCHAR(32) NOT NULL,
  to_status   VARCHAR(32) NOT NULL,
  PRIMARY KEY (from_status, to_status)
);

-- Populate from the VALID_STATUS_TRANSITIONS map in
-- src/services/taskCompletionValidator.ts. ON CONFLICT DO NOTHING so
-- reruns are idempotent.
INSERT INTO task_status_transitions (from_status, to_status) VALUES
  ('PENDING', 'ASSIGNED'),
  ('PENDING', 'REVOKED'),
  ('ASSIGNED', 'IN_PROGRESS'),
  ('ASSIGNED', 'REVOKED'),
  ('IN_PROGRESS', 'COMPLETED'),
  ('IN_PROGRESS', 'ON_HOLD'),
  ('IN_PROGRESS', 'REVOKED'),
  ('ON_HOLD', 'IN_PROGRESS'),
  ('ON_HOLD', 'REVOKED'),
  ('SAVED', 'IN_PROGRESS'),
  ('SAVED', 'REVOKED'),
  -- Allow ASSIGNED → SAVED so field agents can save a draft immediately
  -- after accepting a task without entering IN_PROGRESS first.
  ('ASSIGNED', 'SAVED'),
  ('IN_PROGRESS', 'SAVED')
ON CONFLICT (from_status, to_status) DO NOTHING;

-- Trigger function.
CREATE OR REPLACE FUNCTION enforce_verification_task_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  allowed BOOLEAN;
BEGIN
  -- No-op when status is unchanged. Still runs on UPDATEs that touch
  -- only other columns, which is fine — the early return keeps it
  -- cheap.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Allow NULL → any (covers the first INSERT path; technically this
  -- is a BEFORE UPDATE trigger so NULL OLD.status shouldn't happen,
  -- but be explicit).
  IF OLD.status IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT TRUE INTO allowed
  FROM task_status_transitions
  WHERE from_status = OLD.status
    AND to_status   = NEW.status
  LIMIT 1;

  IF allowed IS NULL THEN
    RAISE EXCEPTION 'Invalid verification_task status transition: % -> % (task id %)',
      OLD.status, NEW.status, OLD.id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Install the trigger (idempotent — drop first so rerunning the
-- migration updates the function body cleanly).
DROP TRIGGER IF EXISTS verification_task_status_guard ON verification_tasks;
CREATE TRIGGER verification_task_status_guard
  BEFORE UPDATE ON verification_tasks
  FOR EACH ROW
  EXECUTE FUNCTION enforce_verification_task_status_transition();

COMMIT;
