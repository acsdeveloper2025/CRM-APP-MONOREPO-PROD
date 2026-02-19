-- Migration: Unify CANCELLED to REVOKED
-- Purpose: Remove CANCELLED status and unify under REVOKED across cases and tasks
-- Date: 2026-02-19

DO $$
BEGIN
    -- 1. Update existing data in verification_tasks
    UPDATE verification_tasks 
    SET status = 'REVOKED',
        revoked_at = COALESCE(revoked_at, cancelled_at, NOW()),
        revoked_by = COALESCE(revoked_by, cancelled_by),
        revocation_reason = COALESCE(revocation_reason, cancellation_reason, 'Migrated from CANCELLED')
    WHERE status = 'CANCELLED';

    -- 2. Update existing data in cases
    UPDATE cases 
    SET status = 'REVOKED'
    WHERE status = 'CANCELLED';

    -- 3. Update constraints for verification_tasks
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_status' AND table_name = 'verification_tasks'
    ) THEN
        ALTER TABLE verification_tasks DROP CONSTRAINT check_status;
    END IF;

    ALTER TABLE verification_tasks 
    ADD CONSTRAINT check_status 
    CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REVOKED', 'SAVED', 'REJECTED', 'ON_HOLD'));

    -- 4. Update constraints for cases
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chk_cases_status' AND table_name = 'cases'
    ) THEN
        ALTER TABLE cases DROP CONSTRAINT chk_cases_status;
    END IF;

    ALTER TABLE cases 
    ADD CONSTRAINT chk_cases_status 
    CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REVOKED', 'REJECTED'));

    RAISE NOTICE 'Successfully unified CANCELLED to REVOKED and updated constraints';
END $$;
