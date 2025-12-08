-- Migration: Fix update_updated_at_column trigger function
-- Date: 2025-11-19
-- Description: Fix the trigger function to use correct column name (updated_at instead of updatedAt)
-- This fixes the 500 error when updating field_user_commission_assignments

-- Drop and recreate the trigger function with correct column name
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists for field_user_commission_assignments
DROP TRIGGER IF EXISTS update_field_user_commission_assignments_updated_at ON field_user_commission_assignments;

CREATE TRIGGER update_field_user_commission_assignments_updated_at
    BEFORE UPDATE ON field_user_commission_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
