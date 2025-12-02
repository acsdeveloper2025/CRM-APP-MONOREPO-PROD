-- Migration: Add saved_at and is_saved columns to verification_tasks table
-- Date: 2025-12-02
-- Purpose: Add timestamp and boolean fields to track when tasks are saved

BEGIN;

-- Add saved_at column to track when task was saved
ALTER TABLE verification_tasks
ADD COLUMN IF NOT EXISTS saved_at timestamp
with
    time zone;

-- Add is_saved boolean column to track saved state
ALTER TABLE verification_tasks
ADD COLUMN IF NOT EXISTS is_saved boolean DEFAULT false NOT NULL;

-- Create index on saved_at for better query performance
CREATE INDEX IF NOT EXISTS idx_verification_tasks_saved_at ON verification_tasks (saved_at)
WHERE
    saved_at IS NOT NULL;

-- Create index on is_saved for filtering saved tasks
CREATE INDEX IF NOT EXISTS idx_verification_tasks_is_saved ON verification_tasks (is_saved)
WHERE
    is_saved = true;

-- Add comment to columns for documentation
COMMENT ON COLUMN verification_tasks.saved_at IS 'Timestamp when the task was saved by field agent';

COMMENT ON COLUMN verification_tasks.is_saved IS 'Boolean flag indicating if task is in saved state';

COMMIT;

-- Rollback script (if needed):
-- BEGIN;
-- DROP INDEX IF EXISTS idx_verification_tasks_is_saved;
-- DROP INDEX IF EXISTS idx_verification_tasks_saved_at;
-- ALTER TABLE verification_tasks DROP COLUMN IF EXISTS is_saved;
-- ALTER TABLE verification_tasks DROP COLUMN IF EXISTS saved_at;
-- COMMIT;