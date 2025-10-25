-- Migration: Add trigger and applicant_type fields to verification_tasks table
-- This migration adds fields that were previously only in the cases table
-- Updated: 2025-10-25 - Added IF NOT EXISTS checks for idempotency

-- Add trigger column
ALTER TABLE verification_tasks 
ADD COLUMN IF NOT EXISTS trigger TEXT;

-- Add applicant_type column
ALTER TABLE verification_tasks 
ADD COLUMN IF NOT EXISTS applicant_type VARCHAR(20);

-- Add check constraint for applicant_type (with idempotency check)
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_verification_tasks_applicant_type'
        AND conrelid = 'verification_tasks'::regclass
    ) THEN
        -- Add constraint only if it doesn't exist
        ALTER TABLE verification_tasks
        ADD CONSTRAINT chk_verification_tasks_applicant_type 
        CHECK (applicant_type IS NULL OR applicant_type IN ('APPLICANT', 'CO-APPLICANT', 'REFERENCE PERSON'));
        
        RAISE NOTICE 'Added constraint chk_verification_tasks_applicant_type';
    ELSE
        RAISE NOTICE 'Constraint chk_verification_tasks_applicant_type already exists, skipping';
    END IF;
END $$;

-- Add comment to columns
COMMENT ON COLUMN verification_tasks.trigger IS 'Trigger information for the verification task';
COMMENT ON COLUMN verification_tasks.applicant_type IS 'Type of applicant: APPLICANT, CO-APPLICANT, or REFERENCE PERSON';

-- Create index for applicant_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_verification_tasks_applicant_type 
ON verification_tasks(applicant_type);

