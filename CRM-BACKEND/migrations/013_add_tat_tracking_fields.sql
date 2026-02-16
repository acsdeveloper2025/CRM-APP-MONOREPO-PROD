-- Migration: Add Dual TAT Tracking fields
-- Date: 2026-02-16
-- Purpose: Add fields to track Bank SLA vs Agent SLA

BEGIN;

-- Add columns if they don't exist
ALTER TABLE verification_tasks
ADD COLUMN IF NOT EXISTS first_assigned_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS current_assigned_at timestamp with time zone;

-- Initialize existing data
-- Bank SLA: When the task was first assignable/created
-- Agent SLA: When the task was last assigned
UPDATE verification_tasks
SET 
  first_assigned_at = COALESCE(assigned_at, created_at, NOW()),
  current_assigned_at = COALESCE(assigned_at, created_at, NOW())
WHERE first_assigned_at IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN verification_tasks.first_assigned_at IS 'When the task was first assigned for Bank SLA tracking';
COMMENT ON COLUMN verification_tasks.current_assigned_at IS 'When the task was last assigned/reassigned for Agent Performance tracking';

COMMIT;
