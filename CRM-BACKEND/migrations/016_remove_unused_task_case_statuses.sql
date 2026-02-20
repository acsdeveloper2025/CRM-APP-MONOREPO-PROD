-- Migration to remove unused APPROVED, REJECTED, SUBMITTED, UNDER_REVIEW, CLOSED, and legacy CANCELLED statuses
-- Date: 2026-02-19

BEGIN;

-- 1. Update verification_tasks status constraints
ALTER TABLE verification_tasks DROP CONSTRAINT IF EXISTS check_status_new;
ALTER TABLE verification_tasks DROP CONSTRAINT IF EXISTS check_status_old;
ALTER TABLE verification_tasks DROP CONSTRAINT IF EXISTS check_status;

ALTER TABLE verification_tasks ADD CONSTRAINT check_status_unified 
CHECK (status::text = ANY (ARRAY[
    'PENDING'::character varying, 
    'ASSIGNED'::character varying, 
    'IN_PROGRESS'::character varying, 
    'COMPLETED'::character varying, 
    'REVOKED'::character varying, 
    'SAVED'::character varying, 
    'ON_HOLD'::character varying
]::text[]));

-- 2. Update cases status constraints
ALTER TABLE cases DROP CONSTRAINT IF EXISTS chk_cases_status;

ALTER TABLE cases ADD CONSTRAINT chk_cases_status 
CHECK (status::text = ANY (ARRAY[
    'PENDING'::character varying, 
    'ASSIGNED'::character varying, 
    'IN_PROGRESS'::character varying, 
    'COMPLETED'::character varying, 
    'REVOKED'::character varying
]::text[]));

COMMIT;
