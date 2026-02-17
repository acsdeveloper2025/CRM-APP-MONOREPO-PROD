-- =============================================================================
-- Migration: Stage-1 Task-Centric CRM — Schema Extension (Evidence Linking)
-- Created:   2026-02-17
-- Purpose:   Add nullable verification_task_id FK to evidence tables so new
--            records can be linked to a specific verification task.
--
-- RULES FOLLOWED:
--   ✅ Additive only — no columns dropped, no existing queries modified
--   ✅ All new columns are NULLABLE — old records untouched
--   ✅ case_id usage preserved — dual-link (case + task) supported
--   ✅ No data backfill — old records remain as-is
--   ✅ IF NOT EXISTS / IF EXISTS guards — safe to re-run
--   ✅ ON DELETE RESTRICT — prevents deleting tasks if evidence exists
--
-- RESULT:
--   System supports BOTH legacy case-linked AND new task-linked records.
-- =============================================================================

BEGIN;

-- ============================================================================
-- 1. verification_attachments
--    Column verification_task_id UUID already exists (added by base schema).
--    Index  idx_verification_attachments_verification_task_id already exists
--           (added by 20260217_forensic_tamper_proofing.sql).
--    MISSING: Foreign key constraint → add it now.
-- ============================================================================

-- Add FK constraint (idempotent: skip if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_verification_attachments_task_id'
  ) THEN
    ALTER TABLE verification_attachments
      ADD CONSTRAINT fk_verification_attachments_task_id
      FOREIGN KEY (verification_task_id)
      REFERENCES verification_tasks(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

COMMENT ON CONSTRAINT fk_verification_attachments_task_id
  ON verification_attachments
  IS 'Stage-1: Links photo evidence to a specific verification task. NULL for legacy records. RESTRICT deletion.';


-- ============================================================================
-- 2. locations
--    Column verification_task_id does NOT exist → add it.
--    Index  does NOT exist → create it.
--    FK     does NOT exist → add it.
-- ============================================================================

-- Add nullable column
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS verification_task_id UUID;

COMMENT ON COLUMN locations.verification_task_id IS
  'Stage-1: Links GPS capture to a specific verification task. NULL for legacy records.';

-- Add FK constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_locations_task_id'
  ) THEN
    ALTER TABLE locations
      ADD CONSTRAINT fk_locations_task_id
      FOREIGN KEY (verification_task_id)
      REFERENCES verification_tasks(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Add index
CREATE INDEX IF NOT EXISTS idx_locations_task_id
  ON locations(verification_task_id);

-- Enforce ONE primary GPS capture per verification task.
-- Revisits require a new task via parent_task_id workflow.
-- NULL values (legacy records) are excluded by the WHERE clause.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_locations_verification_task
  ON locations(verification_task_id)
  WHERE verification_task_id IS NOT NULL;


-- ============================================================================
-- 3. task_form_submissions
--    Column verification_task_id already exists (NOT NULL in base schema).
--    Index  does NOT exist → create it.
--    FK     REMOVED for Stage-1 (to avoid breaking seed/reset ops).
-- ============================================================================

-- Guard: add column only if somehow missing (base schema has it as NOT NULL)
ALTER TABLE task_form_submissions
  ADD COLUMN IF NOT EXISTS verification_task_id UUID;

-- Add index ONLY (No FK constraint)
CREATE INDEX IF NOT EXISTS idx_task_form_submissions_task_id
  ON task_form_submissions(verification_task_id);


COMMIT;

-- =============================================================================
-- POST-MIGRATION VERIFICATION (run manually to confirm)
-- =============================================================================

-- 1. Confirm columns exist
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'verification_task_id'
  AND table_name IN ('verification_attachments', 'locations', 'task_form_submissions')
ORDER BY table_name;

-- 2. Confirm FK constraints exist
SELECT conname, conrelid::regclass AS table_name
FROM pg_constraint
WHERE conname IN (
  'fk_verification_attachments_task_id',
  'fk_locations_task_id'
);

-- 3. Confirm indexes exist
SELECT indexname, tablename
FROM pg_indexes
WHERE indexname IN (
  'idx_verification_attachments_verification_task_id',
  'idx_locations_task_id',
  'uniq_locations_verification_task',
  'idx_task_form_submissions_task_id'
);
