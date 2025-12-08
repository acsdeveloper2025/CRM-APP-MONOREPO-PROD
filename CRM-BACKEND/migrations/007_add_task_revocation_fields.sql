-- Migration: Add Task Revocation Fields
-- Purpose: Add revocation tracking fields to verification_tasks table to support task-level revocation
-- Date: 2025-11-04
-- Author: System Migration

-- Safety checks
DO $$
BEGIN
    -- Verify verification_tasks table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'verification_tasks') THEN
        RAISE EXCEPTION 'Required table "verification_tasks" does not exist';
    END IF;
END $$;

-- Add revocation fields to verification_tasks table
DO $$
BEGIN
    -- Add revoked_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'verification_tasks' AND column_name = 'revoked_at'
    ) THEN
        ALTER TABLE verification_tasks 
        ADD COLUMN revoked_at TIMESTAMP WITH TIME ZONE;
        
        RAISE NOTICE 'Added revoked_at column to verification_tasks';
    END IF;

    -- Add revoked_by column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'verification_tasks' AND column_name = 'revoked_by'
    ) THEN
        ALTER TABLE verification_tasks 
        ADD COLUMN revoked_by UUID REFERENCES users(id);
        
        RAISE NOTICE 'Added revoked_by column to verification_tasks';
    END IF;

    -- Add revocation_reason column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'verification_tasks' AND column_name = 'revocation_reason'
    ) THEN
        ALTER TABLE verification_tasks 
        ADD COLUMN revocation_reason TEXT;
        
        RAISE NOTICE 'Added revocation_reason column to verification_tasks';
    END IF;

    -- Add cancelled_at column if it doesn't exist (for CANCELLED status)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'verification_tasks' AND column_name = 'cancelled_at'
    ) THEN
        ALTER TABLE verification_tasks 
        ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE;
        
        RAISE NOTICE 'Added cancelled_at column to verification_tasks';
    END IF;

    -- Add cancelled_by column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'verification_tasks' AND column_name = 'cancelled_by'
    ) THEN
        ALTER TABLE verification_tasks 
        ADD COLUMN cancelled_by UUID REFERENCES users(id);
        
        RAISE NOTICE 'Added cancelled_by column to verification_tasks';
    END IF;

    -- Add cancellation_reason column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'verification_tasks' AND column_name = 'cancellation_reason'
    ) THEN
        ALTER TABLE verification_tasks 
        ADD COLUMN cancellation_reason TEXT;
        
        RAISE NOTICE 'Added cancellation_reason column to verification_tasks';
    END IF;
END $$;

-- Create indexes for better query performance
DO $$
BEGIN
    -- Index on revoked_at for filtering revoked tasks
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'verification_tasks' AND indexname = 'idx_verification_tasks_revoked_at'
    ) THEN
        CREATE INDEX idx_verification_tasks_revoked_at ON verification_tasks(revoked_at) 
        WHERE revoked_at IS NOT NULL;
        
        RAISE NOTICE 'Created index idx_verification_tasks_revoked_at';
    END IF;

    -- Index on revoked_by for filtering by user
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'verification_tasks' AND indexname = 'idx_verification_tasks_revoked_by'
    ) THEN
        CREATE INDEX idx_verification_tasks_revoked_by ON verification_tasks(revoked_by) 
        WHERE revoked_by IS NOT NULL;
        
        RAISE NOTICE 'Created index idx_verification_tasks_revoked_by';
    END IF;

    -- Index on cancelled_at for filtering cancelled tasks
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'verification_tasks' AND indexname = 'idx_verification_tasks_cancelled_at'
    ) THEN
        CREATE INDEX idx_verification_tasks_cancelled_at ON verification_tasks(cancelled_at) 
        WHERE cancelled_at IS NOT NULL;
        
        RAISE NOTICE 'Created index idx_verification_tasks_cancelled_at';
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN verification_tasks.revoked_at IS 'Timestamp when the task was revoked by field agent';
COMMENT ON COLUMN verification_tasks.revoked_by IS 'User ID of the field agent who revoked the task';
COMMENT ON COLUMN verification_tasks.revocation_reason IS 'Reason provided by field agent for revoking the task';
COMMENT ON COLUMN verification_tasks.cancelled_at IS 'Timestamp when the task was cancelled by backend user';
COMMENT ON COLUMN verification_tasks.cancelled_by IS 'User ID of the backend user who cancelled the task';
COMMENT ON COLUMN verification_tasks.cancellation_reason IS 'Reason provided by backend user for cancelling the task';

-- Verification query to confirm migration success
DO $$
DECLARE
    column_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_name = 'verification_tasks'
    AND column_name IN ('revoked_at', 'revoked_by', 'revocation_reason', 
                        'cancelled_at', 'cancelled_by', 'cancellation_reason');
    
    IF column_count = 6 THEN
        RAISE NOTICE '✅ Migration successful: All 6 revocation/cancellation columns added';
    ELSE
        RAISE WARNING '⚠️  Migration incomplete: Only % of 6 columns added', column_count;
    END IF;
END $$;

