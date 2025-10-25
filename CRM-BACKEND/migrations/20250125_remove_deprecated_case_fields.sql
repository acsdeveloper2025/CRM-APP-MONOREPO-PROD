-- Migration: Remove deprecated case-level fields (address, assignedTo)
-- Date: 2025-01-25
-- Description: Remove deprecated case-level address and assignedTo fields
--              These fields are now managed at the verification_tasks level
--              This migration aligns production DB with development DB schema

-- Step 1: Drop foreign key constraint on assignedTo
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_assigned_to_fkey;

-- Step 2: Drop indexes on deprecated fields
DROP INDEX IF EXISTS idx_cases_assigned_to;
DROP INDEX IF EXISTS idx_cases_status_assigned_to;

-- Step 3: Drop the deprecated columns
ALTER TABLE cases DROP COLUMN IF EXISTS "assignedTo";
ALTER TABLE cases DROP COLUMN IF EXISTS address;

-- Verification: Check that columns are removed
-- Run this to verify: SELECT column_name FROM information_schema.columns WHERE table_name = 'cases' AND column_name IN ('assignedTo', 'address');
-- Expected result: 0 rows

