-- =====================================================
-- FIX COMMISSION SYSTEM CONSTRAINTS
-- Date: 2025-09-13
-- Purpose: Fix commission amount/percentage constraints to allow NULL values
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: ALTER COMMISSION RATE TYPES TABLE
-- =====================================================
-- Remove NOT NULL constraint from commission_amount
ALTER TABLE commission_rate_types ALTER COLUMN commission_amount DROP NOT NULL;

-- =====================================================
-- STEP 2: ALTER FIELD USER COMMISSION ASSIGNMENTS TABLE
-- =====================================================
-- Remove NOT NULL constraint from commission_amount
ALTER TABLE field_user_commission_assignments ALTER COLUMN commission_amount DROP NOT NULL;

-- =====================================================
-- STEP 3: ALTER COMMISSION CALCULATIONS TABLE
-- =====================================================
-- Remove NOT NULL constraint from commission_amount
ALTER TABLE commission_calculations ALTER COLUMN commission_amount DROP NOT NULL;

-- =====================================================
-- STEP 4: ADD PROPER CHECK CONSTRAINTS
-- =====================================================
-- Add constraint to ensure at least one commission type is set for commission_rate_types
ALTER TABLE commission_rate_types 
ADD CONSTRAINT chk_commission_rate_types_has_commission 
CHECK ((commission_amount IS NOT NULL AND commission_percentage IS NULL) OR 
       (commission_amount IS NULL AND commission_percentage IS NOT NULL));

-- Add constraint to ensure at least one commission type is set for field_user_commission_assignments
ALTER TABLE field_user_commission_assignments 
ADD CONSTRAINT chk_field_user_commission_has_commission 
CHECK ((commission_amount IS NOT NULL AND commission_percentage IS NULL) OR 
       (commission_amount IS NULL AND commission_percentage IS NOT NULL));

-- =====================================================
-- STEP 5: ADD COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON CONSTRAINT chk_commission_rate_types_has_commission ON commission_rate_types IS 'Ensures either commission_amount or commission_percentage is set, but not both';
COMMENT ON CONSTRAINT chk_field_user_commission_has_commission ON field_user_commission_assignments IS 'Ensures either commission_amount or commission_percentage is set, but not both';

COMMIT;
