-- Migration: Fix update_updated_at_column trigger to use camelCase column name
-- Purpose: Fix the trigger function that was using snake_case 'updated_at' instead of camelCase 'updatedAt'
-- This was causing 500 errors when updating/deleting clients and other entities
-- Date: 2025-10-30

-- Drop and recreate the trigger function with correct column name
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Use camelCase "updatedAt" instead of snake_case updated_at
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the function was created successfully
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
    ) THEN
        RAISE NOTICE 'Trigger function update_updated_at_column successfully updated';
    ELSE
        RAISE EXCEPTION 'Failed to create trigger function update_updated_at_column';
    END IF;
END $$;

