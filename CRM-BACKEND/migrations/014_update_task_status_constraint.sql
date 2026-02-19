-- Migration: Update Task Status Constraint
-- Purpose: Allow REVOKED and CANCELLED statuses in verification_tasks
-- Date: 2026-02-19

DO $$
BEGIN
    -- Drop the old constraint if it exists
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'check_status'
        AND table_name = 'verification_tasks'
    ) THEN
        ALTER TABLE verification_tasks DROP CONSTRAINT check_status;
        RAISE NOTICE 'Dropped old check_status constraint';
    END IF;

    -- Add the new constraint with expanded status list
    -- Including REJECTED as a common status, just in case
    ALTER TABLE verification_tasks
    ADD CONSTRAINT check_status
    CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REVOKED', 'CANCELLED', 'SAVED', 'REJECTED'));
    
    RAISE NOTICE 'Added new check_status constraint with REVOKED and CANCELLED support';
END $$;
