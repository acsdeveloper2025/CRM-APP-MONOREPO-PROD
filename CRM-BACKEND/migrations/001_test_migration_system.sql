-- Migration: Test Migration System
-- Created: 2025-10-24
-- Author: System
-- Purpose: Verify that the migration system is working correctly in production

-- This migration creates a test table to verify the migration system
-- It can be safely removed after confirming migrations work in production

-- Create test table
CREATE TABLE IF NOT EXISTS migration_test (
    id SERIAL PRIMARY KEY,
    test_message VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert test record
INSERT INTO migration_test (test_message) 
VALUES ('Migration system is working correctly!')
ON CONFLICT DO NOTHING;

-- Create index
CREATE INDEX IF NOT EXISTS idx_migration_test_created_at 
ON migration_test(created_at);

-- Validation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'migration_test'
    ) THEN
        RAISE EXCEPTION 'Migration failed: migration_test table was not created';
    END IF;
    
    RAISE NOTICE 'Migration validation passed: migration_test table created successfully';
END $$;

