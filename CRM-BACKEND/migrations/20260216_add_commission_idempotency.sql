-- Migration: Add Commission Idempotency Safeguard
-- Created: 2026-02-16

-- 1. Add UNIQUE constraint on verification_task_id
-- This ensures each task can only have ONE commission record
ALTER TABLE commission_calculations
ADD CONSTRAINT unique_commission_per_task 
UNIQUE (verification_task_id);

-- 2. Add index for fast lookup (if not already exists)
CREATE INDEX IF NOT EXISTS idx_commission_calc_task_id 
ON commission_calculations(verification_task_id);

-- Add comment for documentation
COMMENT ON CONSTRAINT unique_commission_per_task ON commission_calculations IS 
  'Ensures each verification task can generate commission only once. Prevents duplicate payouts from concurrent requests or retries.';
