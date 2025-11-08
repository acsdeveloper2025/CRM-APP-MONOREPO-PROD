-- Migration: Fix roles table updated_at trigger
-- Date: 2025-11-08
-- Description: Fix the update_roles_updated_at() trigger function to use correct column name "updatedAt" instead of "updated_at"
-- Issue: The trigger was using snake_case (updated_at) but the column is camelCase (updatedAt)
-- This was causing role updates to fail with error: record "new" has no field "updated_at"

-- Drop and recreate the trigger function with correct column name
CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: The trigger itself doesn't need to be recreated, only the function
-- The trigger "update_roles_updated_at" on table "roles" will automatically use the updated function

