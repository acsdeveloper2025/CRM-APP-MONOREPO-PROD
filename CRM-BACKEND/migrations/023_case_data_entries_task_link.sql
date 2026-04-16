-- Migration 023: Link case_data_entries to verification_tasks
--
-- Sprint 7: Revisit-aware data entry. Adds a nullable FK from
-- case_data_entries to verification_tasks so each data entry instance
-- can be tied to the specific task it was created for. Critical for
-- the revisit workflow: when a completed task is revisited, the system
-- auto-creates a new data entry instance linked to the revisit task
-- while the original instance (linked to the original task or NULL for
-- legacy data) remains read-only.
--
-- Nullable because existing instances predate this link and cannot be
-- reliably backfilled (we don't know which task they belonged to).
-- New instances will always have the link populated.
--
-- Applied: 2026-04-16

BEGIN;

ALTER TABLE case_data_entries
  ADD COLUMN IF NOT EXISTS verification_task_id UUID REFERENCES verification_tasks(id);

CREATE INDEX IF NOT EXISTS idx_case_data_entries_task
  ON case_data_entries (verification_task_id)
  WHERE verification_task_id IS NOT NULL;

COMMIT;
