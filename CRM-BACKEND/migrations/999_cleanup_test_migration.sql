-- Migration: Cleanup Test Migration Table
-- Created: 2025-10-25
-- Author: System
-- Purpose: Remove the test migration table after confirming migration system works correctly

-- Drop the test table (created by 001_test_migration_system.sql)
DROP TABLE IF EXISTS migration_test;

-- Log the cleanup
DO $$
BEGIN
    RAISE NOTICE 'Test migration table cleanup completed successfully';
    RAISE NOTICE 'Migration system has been verified and is working correctly';
END $$;

