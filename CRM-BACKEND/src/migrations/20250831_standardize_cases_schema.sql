-- =====================================================
-- COMPREHENSIVE DATABASE STANDARDIZATION MIGRATION
-- Date: 2025-08-31
-- Purpose: Standardize cases table to use UUID id as primary key
-- Strategy: Add UUID id column, keep caseId as business identifier
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: BACKUP CURRENT STATE
-- =====================================================
CREATE TABLE IF NOT EXISTS migration_backup_cases AS SELECT * FROM cases LIMIT 0;
INSERT INTO migration_backup_cases SELECT * FROM cases;

-- =====================================================
-- STEP 2: ADD UUID ID COLUMN TO CASES TABLE
-- =====================================================
-- Add new UUID id column
ALTER TABLE cases ADD COLUMN id UUID DEFAULT gen_random_uuid() NOT NULL;

-- Create unique index on new id column
CREATE UNIQUE INDEX cases_id_unique ON cases (id);

-- =====================================================
-- STEP 3: DROP EXISTING FOREIGN KEY CONSTRAINTS
-- =====================================================
-- Drop all existing foreign key constraints that reference cases.caseId
ALTER TABLE case_assignment_history DROP CONSTRAINT IF EXISTS case_assignment_history_caseId_fkey;
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS fk_attachments_case_id;
ALTER TABLE autoSaves DROP CONSTRAINT IF EXISTS fk_autoSaves_case_id;
ALTER TABLE caseDeduplicationAudit DROP CONSTRAINT IF EXISTS fk_caseDeduplicationAudit_case_id;
ALTER TABLE locations DROP CONSTRAINT IF EXISTS fk_locations_case_id;
ALTER TABLE officeVerificationReports DROP CONSTRAINT IF EXISTS fk_officeVerificationReports_case_id;
ALTER TABLE residenceVerificationReports DROP CONSTRAINT IF EXISTS fk_residenceVerificationReports_case_id;
ALTER TABLE case_status_history DROP CONSTRAINT IF EXISTS fk_case_status_history_case;
ALTER TABLE mobile_notification_audit DROP CONSTRAINT IF EXISTS fk_mobile_notification_audit_case_id;

-- Drop any other existing foreign key constraints
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'cases'
        AND ccu.column_name = 'caseId'
    LOOP
        EXECUTE 'ALTER TABLE ' || constraint_record.table_name || ' DROP CONSTRAINT IF EXISTS ' || constraint_record.constraint_name;
    END LOOP;
END $$;

-- =====================================================
-- STEP 4: UPDATE PRIMARY KEY CONSTRAINTS
-- =====================================================
-- Drop existing primary key constraint
ALTER TABLE cases DROP CONSTRAINT cases_pkey;

-- Add new primary key on id column
ALTER TABLE cases ADD CONSTRAINT cases_pkey PRIMARY KEY (id);

-- Make caseId a unique business identifier (not primary key)
ALTER TABLE cases ADD CONSTRAINT cases_caseId_unique UNIQUE (caseId);

-- =====================================================
-- STEP 5: ADD NEW ID COLUMNS TO REFERENCING TABLES
-- =====================================================

-- Add case_id (UUID) columns to all referencing tables
ALTER TABLE attachments ADD COLUMN case_id UUID;
ALTER TABLE autoSaves ADD COLUMN case_id UUID;
ALTER TABLE caseDeduplicationAudit ADD COLUMN case_id UUID;
ALTER TABLE case_assignment_history ADD COLUMN case_id UUID;
ALTER TABLE case_status_history ADD COLUMN case_id UUID;
ALTER TABLE locations ADD COLUMN case_id UUID;
ALTER TABLE officeVerificationReports ADD COLUMN case_id UUID;
ALTER TABLE residenceVerificationReports ADD COLUMN case_id UUID;
ALTER TABLE mobile_notification_audit ADD COLUMN case_id UUID;

-- =====================================================
-- STEP 6: POPULATE NEW UUID FOREIGN KEYS
-- =====================================================

-- Update attachments
UPDATE attachments SET case_id = (
    SELECT c.id FROM cases c WHERE c.caseId = attachments.caseId
);

-- Update autoSaves
UPDATE autoSaves SET case_id = (
    SELECT c.id FROM cases c WHERE c.caseId = autoSaves.caseId
);

-- Update caseDeduplicationAudit
UPDATE caseDeduplicationAudit SET case_id = (
    SELECT c.id FROM cases c WHERE c.caseId = caseDeduplicationAudit.caseId
);

-- Update case_assignment_history
UPDATE case_assignment_history SET case_id = (
    SELECT c.id FROM cases c WHERE c.caseId = case_assignment_history.caseId
);

-- Update case_status_history
UPDATE case_status_history SET case_id = (
    SELECT c.id FROM cases c WHERE c.caseId = case_status_history.caseId
);

-- Update locations
UPDATE locations SET case_id = (
    SELECT c.id FROM cases c WHERE c.caseId = locations.caseId
);

-- Update officeVerificationReports
UPDATE officeVerificationReports SET case_id = (
    SELECT c.id FROM cases c WHERE c.caseId = officeVerificationReports.caseId
);

-- Update residenceVerificationReports
UPDATE residenceVerificationReports SET case_id = (
    SELECT c.id FROM cases c WHERE c.caseId = residenceVerificationReports.caseId
);

-- Update mobile_notification_audit
UPDATE mobile_notification_audit SET case_id = (
    SELECT c.id FROM cases c WHERE c.caseId = mobile_notification_audit.caseId
);

-- =====================================================
-- STEP 7: ADD NOT NULL CONSTRAINTS TO NEW COLUMNS
-- =====================================================

-- Make new case_id columns NOT NULL (after population)
ALTER TABLE attachments ALTER COLUMN case_id SET NOT NULL;
ALTER TABLE autoSaves ALTER COLUMN case_id SET NOT NULL;
ALTER TABLE caseDeduplicationAudit ALTER COLUMN case_id SET NOT NULL;
ALTER TABLE case_assignment_history ALTER COLUMN case_id SET NOT NULL;
ALTER TABLE case_status_history ALTER COLUMN case_id SET NOT NULL;
ALTER TABLE locations ALTER COLUMN case_id SET NOT NULL;
ALTER TABLE officeVerificationReports ALTER COLUMN case_id SET NOT NULL;
ALTER TABLE residenceVerificationReports ALTER COLUMN case_id SET NOT NULL;
ALTER TABLE mobile_notification_audit ALTER COLUMN case_id SET NOT NULL;

-- =====================================================
-- STEP 8: CREATE NEW FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Add foreign key constraints for new UUID references
ALTER TABLE attachments 
ADD CONSTRAINT fk_attachments_case_id 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE autoSaves 
ADD CONSTRAINT fk_autoSaves_case_id 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE caseDeduplicationAudit 
ADD CONSTRAINT fk_caseDeduplicationAudit_case_id 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE case_assignment_history 
ADD CONSTRAINT fk_case_assignment_history_case_id 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE case_status_history 
ADD CONSTRAINT fk_case_status_history_case_id 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE locations 
ADD CONSTRAINT fk_locations_case_id 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE officeVerificationReports 
ADD CONSTRAINT fk_officeVerificationReports_case_id 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE residenceVerificationReports 
ADD CONSTRAINT fk_residenceVerificationReports_case_id 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE mobile_notification_audit 
ADD CONSTRAINT fk_mobile_notification_audit_case_id 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

-- =====================================================
-- STEP 9: CREATE PERFORMANCE INDEXES
-- =====================================================

-- Create indexes on new foreign key columns for performance
CREATE INDEX idx_attachments_case_id ON attachments (case_id);
CREATE INDEX idx_autoSaves_case_id ON autoSaves (case_id);
CREATE INDEX idx_caseDeduplicationAudit_case_id ON caseDeduplicationAudit (case_id);
CREATE INDEX idx_case_assignment_history_case_id ON case_assignment_history (case_id);
CREATE INDEX idx_case_status_history_case_id ON case_status_history (case_id);
CREATE INDEX idx_locations_case_id ON locations (case_id);
CREATE INDEX idx_officeVerificationReports_case_id ON officeVerificationReports (case_id);
CREATE INDEX idx_residenceVerificationReports_case_id ON residenceVerificationReports (case_id);
CREATE INDEX idx_mobile_notification_audit_case_id ON mobile_notification_audit (case_id);

-- =====================================================
-- STEP 10: UPDATE VIEWS TO USE NEW SCHEMA
-- =====================================================

-- Drop and recreate form_submissions_view with new schema
DROP VIEW IF EXISTS form_submissions_view;

CREATE VIEW form_submissions_view AS
SELECT 
    'RESIDENCE' as form_type,
    r.case_id,
    r."createdBy" as submitted_by,
    r."createdAt" as submitted_at,
    CASE 
        WHEN r."residenceConfirmed" IS NOT NULL THEN 'VALID'
        ELSE 'PENDING'
    END as validation_status,
    jsonb_build_object(
        'applicantName', r."applicantName",
        'address', r.address,
        'personMet', r."personMet",
        'relationship', r.relationship,
        'residenceConfirmed', r."residenceConfirmed",
        'remarks', r.remarks
    ) as submission_data,
    0 as photos_count
FROM "residenceVerificationReports" r

UNION ALL

SELECT 
    'OFFICE' as form_type,
    o.case_id,
    o."createdBy" as submitted_by,
    o."createdAt" as submitted_at,
    CASE 
        WHEN o."officeConfirmed" IS NOT NULL THEN 'VALID'
        ELSE 'PENDING'
    END as validation_status,
    jsonb_build_object(
        'companyName', o."companyName",
        'address', o.address,
        'personMet', o."personMet",
        'designation', o.designation,
        'officeConfirmed', o."officeConfirmed",
        'remarks', o.remarks
    ) as submission_data,
    0 as photos_count
FROM "officeVerificationReports" o;

-- =====================================================
-- STEP 11: ADD DOCUMENTATION
-- =====================================================

-- Add comments for documentation
COMMENT ON COLUMN cases.id IS 'Primary key - UUID identifier for internal references';
COMMENT ON COLUMN cases.caseId IS 'Business identifier - Case number for display and external references';
COMMENT ON VIEW form_submissions_view IS 'Updated view using new UUID case references';

-- Log migration completion
INSERT INTO migrations (id, name, executed_at) 
VALUES ('20250831_standardize_cases_schema', 'Standardize cases table schema with UUID primary key', NOW())
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these after migration to verify success:
-- SELECT COUNT(*) FROM cases WHERE id IS NOT NULL;
-- SELECT COUNT(*) FROM attachments WHERE case_id IS NOT NULL;
-- SELECT * FROM form_submissions_view LIMIT 5;
