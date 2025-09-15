-- =====================================================
-- SIMPLIFY COMMISSION SYSTEM TO AMOUNT ONLY
-- Date: 2025-09-13
-- Purpose: Remove percentage functionality, keep only fixed commission amounts
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: DROP PERCENTAGE COLUMNS AND CONSTRAINTS
-- =====================================================

-- Drop existing constraints first
ALTER TABLE commission_rate_types DROP CONSTRAINT IF EXISTS chk_commission_rate_types_amount_or_percentage;
ALTER TABLE commission_rate_types DROP CONSTRAINT IF EXISTS chk_commission_rate_types_has_commission;

ALTER TABLE field_user_commission_assignments DROP CONSTRAINT IF EXISTS chk_field_user_commission_amount_or_percentage;
ALTER TABLE field_user_commission_assignments DROP CONSTRAINT IF EXISTS chk_field_user_commission_has_commission;

-- Remove percentage columns from commission_rate_types
ALTER TABLE commission_rate_types DROP COLUMN IF EXISTS commission_percentage;

-- Remove percentage columns from field_user_commission_assignments  
ALTER TABLE field_user_commission_assignments DROP COLUMN IF EXISTS commission_percentage;

-- Remove percentage columns from commission_calculations
ALTER TABLE commission_calculations DROP COLUMN IF EXISTS commission_percentage;

-- =====================================================
-- STEP 2: UPDATE COMMISSION AMOUNT CONSTRAINTS
-- =====================================================

-- Make commission_amount NOT NULL and add proper constraints
ALTER TABLE commission_rate_types 
ALTER COLUMN commission_amount SET NOT NULL,
ADD CONSTRAINT chk_commission_rate_types_amount_positive 
CHECK (commission_amount > 0);

ALTER TABLE field_user_commission_assignments 
ALTER COLUMN commission_amount SET NOT NULL,
ADD CONSTRAINT chk_field_user_commission_amount_positive 
CHECK (commission_amount > 0);

-- =====================================================
-- STEP 3: UPDATE COMMISSION CALCULATIONS TABLE
-- =====================================================

-- Update calculation_method to only support FIXED_AMOUNT
ALTER TABLE commission_calculations 
DROP CONSTRAINT IF EXISTS commission_calculations_calculation_method_check;

ALTER TABLE commission_calculations 
ADD CONSTRAINT commission_calculations_calculation_method_check 
CHECK (calculation_method = 'FIXED_AMOUNT');

-- Set default calculation method
ALTER TABLE commission_calculations 
ALTER COLUMN calculation_method SET DEFAULT 'FIXED_AMOUNT';

-- Make commission_amount NOT NULL in calculations
ALTER TABLE commission_calculations 
ALTER COLUMN commission_amount SET NOT NULL,
ADD CONSTRAINT chk_commission_calculations_amount_positive 
CHECK (commission_amount > 0);

-- =====================================================
-- STEP 4: UPDATE EXISTING DATA
-- =====================================================

-- Update any existing records to use FIXED_AMOUNT method
UPDATE commission_calculations 
SET calculation_method = 'FIXED_AMOUNT' 
WHERE calculation_method != 'FIXED_AMOUNT';

-- =====================================================
-- STEP 5: ADD UPDATED COMMENTS
-- =====================================================

COMMENT ON COLUMN commission_rate_types.commission_amount IS 'Fixed commission amount in specified currency';
COMMENT ON COLUMN field_user_commission_assignments.commission_amount IS 'Fixed commission amount for this user assignment';
COMMENT ON COLUMN commission_calculations.commission_amount IS 'Fixed commission amount used for calculation';
COMMENT ON COLUMN commission_calculations.calculation_method IS 'Always FIXED_AMOUNT - percentage support removed';

COMMENT ON TABLE commission_rate_types IS 'Commission rate templates with fixed amounts only';
COMMENT ON TABLE field_user_commission_assignments IS 'Field user commission assignments with fixed amounts only';

COMMIT;
