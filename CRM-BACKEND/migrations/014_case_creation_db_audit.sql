-- Migration 014: Case creation DB-level audit fixes
--
-- Applied manually on 2026-04-12. This file documents the changes
-- so they can be replayed on staging/production.
--
-- Issues found during case creation audit:
--   #1 BLOCKER: chk_cases_dedup_decision allowed 'NO_DUPLICATES'
--      but frontend sends 'NO_DUPLICATES_FOUND' — INSERT fails.
--   #2 BLOCKER: chk_dedup_audit_decision missing 'NO_DUPLICATES_FOUND'.
--   #3 MEDIUM:  chk_cases_applicant_type missing 'GUARANTOR'.
--   #4 MEDIUM:  Duplicate legacy camelCase columns (revokereason,
--      revokedat) never dropped in migration 010.
--   #5 LOW:     7 duplicate indexes wasting disk + slowing writes.

BEGIN;

-- #1: Fix cases.deduplication_decision constraint + widen column
ALTER TABLE cases DROP CONSTRAINT IF EXISTS chk_cases_dedup_decision;
ALTER TABLE cases ALTER COLUMN deduplication_decision TYPE varchar(30);
ALTER TABLE cases ADD CONSTRAINT chk_cases_dedup_decision CHECK (
  deduplication_decision IN (
    'CREATE_NEW', 'USE_EXISTING', 'MERGE_CASES',
    'NO_DUPLICATES', 'NO_DUPLICATES_FOUND'
  )
);

-- #2: Fix case_deduplication_audit.user_decision constraint
ALTER TABLE case_deduplication_audit DROP CONSTRAINT IF EXISTS chk_dedup_audit_decision;
ALTER TABLE case_deduplication_audit ADD CONSTRAINT chk_dedup_audit_decision CHECK (
  user_decision IN (
    'CREATE_NEW', 'USE_EXISTING', 'MERGE_CASES',
    'NO_DUPLICATES', 'NO_DUPLICATES_FOUND'
  )
);

-- #3: Fix applicant_type constraints — add GUARANTOR
ALTER TABLE cases DROP CONSTRAINT IF EXISTS chk_cases_applicant_type;
ALTER TABLE cases ADD CONSTRAINT chk_cases_applicant_type CHECK (
  applicant_type IN ('APPLICANT', 'CO-APPLICANT', 'REFERENCE PERSON', 'GUARANTOR')
);

ALTER TABLE verification_tasks DROP CONSTRAINT IF EXISTS chk_verification_tasks_applicant_type;
ALTER TABLE verification_tasks ADD CONSTRAINT chk_verification_tasks_applicant_type CHECK (
  applicant_type IS NULL OR
  applicant_type IN ('APPLICANT', 'CO-APPLICANT', 'REFERENCE PERSON', 'GUARANTOR')
);

-- #4: Drop legacy camelCase duplicate columns (verified 0 non-null rows)
ALTER TABLE cases DROP COLUMN IF EXISTS revokereason;
ALTER TABLE cases DROP COLUMN IF EXISTS revokedat;

-- #5: Drop duplicate indexes
DROP INDEX IF EXISTS idx_cases_clientid;
DROP INDEX IF EXISTS idx_cases_productid;
DROP INDEX IF EXISTS idx_cases_verificationtypeid;
DROP INDEX IF EXISTS idx_cases_ratetypeid;
DROP INDEX IF EXISTS idx_cases_createdbybackenduser;
DROP INDEX IF EXISTS idx_cases_case_id;
DROP INDEX IF EXISTS idx_cases_customer_name_gin;

COMMIT;
