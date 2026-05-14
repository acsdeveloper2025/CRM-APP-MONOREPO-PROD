-- P20 DB hygiene — 2026-05-15
--
-- Three independent cleanups identified by the 2026-05-14 7-agent
-- app-wide audit (G-1, G-2, G-7). Each runs in a single transaction;
-- safe to re-run (DELETE matches zero rows on the second pass; DROP
-- INDEX uses IF EXISTS for G-7; G-2 rebuilds idempotently).
--
-- Local DB on 2026-05-15 already had these applied directly via psql
-- (the BEFORE/AFTER verification step). This file captures the same
-- changes for the prod cutover so the schema dump and migration
-- history stay in sync.

BEGIN;

-- ============================================================
-- G-1: stale workflow rows in task_status_transitions
-- ============================================================
-- The workflow audit (2026-05-13, project_workflow_audit_2026_05_13.md)
-- dropped ON_HOLD and SAVED as valid statuses on verification_tasks.
-- The CHECK constraint `check_status_unified` and the case-side
-- `chk_status_unified` were both narrowed to the canonical 5-status
-- set {PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, REVOKED}. But 8 rows
-- in `task_status_transitions` (the allow-list consulted by the
-- `enforce_verification_task_status_transition` trigger) still
-- referenced ON_HOLD and SAVED — the trigger would allow such a
-- transition and then the CHECK constraint would reject with 23514.
-- Confusing two-step failure shape. Drop the dead rows.
DELETE FROM task_status_transitions
 WHERE from_status IN ('ON_HOLD', 'SAVED')
    OR to_status IN ('ON_HOLD', 'SAVED');

-- ============================================================
-- G-2: stale predicate on verification_tasks_active_unique_idx
-- ============================================================
-- The partial-unique index that prevents multiple "active" rows for
-- the same (case_id, verification_type_id) pair had a predicate
-- including ON_HOLD and SAVED. Harmless functionally (no row could
-- ever land in those statuses post-G-1), but it muddied the meaning
-- of "active" and made future debugging slower. Rebuild with the
-- canonical 3-status active set.
DROP INDEX IF EXISTS verification_tasks_active_unique_idx;
CREATE UNIQUE INDEX verification_tasks_active_unique_idx
   ON verification_tasks (case_id, verification_type_id)
   WHERE status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS');

-- ============================================================
-- G-7: duplicate indexes on verification_tasks
-- ============================================================
-- Audit found two pairs of byte-identical indexes covering the same
-- columns under different names. We keep the longer-named member of
-- each pair (more descriptive, matches our naming convention) and
-- drop the shorter sibling.
DROP INDEX IF EXISTS idx_vt_assigned_status;  -- duplicate of idx_verification_tasks_assigned_to_status
DROP INDEX IF EXISTS idx_vt_case_status;      -- duplicate of idx_verification_tasks_case_status

COMMIT;
