-- Migration: Add trigger and applicant_type fields to verification_tasks table
-- This migration adds fields that were previously only in the cases table

-- Add trigger column
ALTER TABLE verification_tasks 
ADD COLUMN IF NOT EXISTS trigger TEXT;

-- Add applicant_type column
ALTER TABLE verification_tasks 
ADD COLUMN IF NOT EXISTS applicant_type VARCHAR(20);

-- Add check constraint for applicant_type
ALTER TABLE verification_tasks
ADD CONSTRAINT chk_verification_tasks_applicant_type 
CHECK (applicant_type IS NULL OR applicant_type IN ('APPLICANT', 'CO-APPLICANT', 'REFERENCE PERSON'));

-- Add comment to columns
COMMENT ON COLUMN verification_tasks.trigger IS 'Trigger information for the verification task';
COMMENT ON COLUMN verification_tasks.applicant_type IS 'Type of applicant: APPLICANT, CO-APPLICANT, or REFERENCE PERSON';

-- Create index for applicant_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_verification_tasks_applicant_type 
ON verification_tasks(applicant_type);

