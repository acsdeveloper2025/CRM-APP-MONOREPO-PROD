-- =====================================================
-- SIMPLIFIED DATABASE STANDARDIZATION MIGRATION
-- Date: 2025-08-31
-- Purpose: Add UUID id column to cases table, keep caseId as business identifier
-- Strategy: Step-by-step approach with existing tables only
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: BACKUP AND ADD UUID COLUMN
-- =====================================================
-- Add new UUID id column to cases table
ALTER TABLE cases ADD COLUMN id UUID DEFAULT gen_random_uuid() NOT NULL;

-- Create unique index on new id column
CREATE UNIQUE INDEX cases_id_unique ON cases (id);

-- =====================================================
-- STEP 2: ADD NEW CASE_ID COLUMNS TO EXISTING TABLES
-- =====================================================
-- Only add to tables that actually exist and have caseId references

-- Add case_id (UUID) columns to existing tables
ALTER TABLE attachments ADD COLUMN case_id UUID;
ALTER TABLE "autoSaves" ADD COLUMN case_id UUID;
ALTER TABLE "caseDeduplicationAudit" ADD COLUMN case_id UUID;
ALTER TABLE case_assignment_history ADD COLUMN case_id UUID;
ALTER TABLE case_status_history ADD COLUMN case_id UUID;
ALTER TABLE locations ADD COLUMN case_id UUID;
ALTER TABLE "officeVerificationReports" ADD COLUMN case_id UUID;
ALTER TABLE "residenceVerificationReports" ADD COLUMN case_id UUID;
ALTER TABLE mobile_notification_audit ADD COLUMN case_id UUID;

-- =====================================================
-- STEP 3: POPULATE NEW UUID FOREIGN KEYS
-- =====================================================
-- Update all tables with the new UUID references

UPDATE attachments SET case_id = (
    SELECT c.id FROM cases c WHERE c."caseId" = attachments."caseId"
);

UPDATE "autoSaves" SET case_id = (
    SELECT c.id FROM cases c WHERE c."caseId" = "autoSaves"."caseId"
);

UPDATE "caseDeduplicationAudit" SET case_id = (
    SELECT c.id FROM cases c WHERE c."caseId" = "caseDeduplicationAudit"."caseId"
);

UPDATE case_assignment_history SET case_id = (
    SELECT c.id FROM cases c WHERE c."caseId" = case_assignment_history."caseId"
);

UPDATE case_status_history SET case_id = (
    SELECT c.id FROM cases c WHERE c."caseId" = case_status_history."caseId"
);

UPDATE locations SET case_id = (
    SELECT c.id FROM cases c WHERE c."caseId" = locations."caseId"
);

UPDATE "officeVerificationReports" SET case_id = (
    SELECT c.id FROM cases c WHERE c."caseId" = "officeVerificationReports"."caseId"
);

UPDATE "residenceVerificationReports" SET case_id = (
    SELECT c.id FROM cases c WHERE c."caseId" = "residenceVerificationReports"."caseId"
);

UPDATE mobile_notification_audit SET case_id = (
    SELECT c.id FROM cases c WHERE c."caseId" = mobile_notification_audit."caseId"
);

-- =====================================================
-- STEP 4: ADD NOT NULL CONSTRAINTS
-- =====================================================
-- Make new case_id columns NOT NULL (after population)
ALTER TABLE attachments ALTER COLUMN case_id SET NOT NULL;
ALTER TABLE "autoSaves" ALTER COLUMN case_id SET NOT NULL;
ALTER TABLE "caseDeduplicationAudit" ALTER COLUMN case_id SET NOT NULL;
ALTER TABLE case_assignment_history ALTER COLUMN case_id SET NOT NULL;
ALTER TABLE case_status_history ALTER COLUMN case_id SET NOT NULL;
ALTER TABLE locations ALTER COLUMN case_id SET NOT NULL;
ALTER TABLE "officeVerificationReports" ALTER COLUMN case_id SET NOT NULL;
ALTER TABLE "residenceVerificationReports" ALTER COLUMN case_id SET NOT NULL;
ALTER TABLE mobile_notification_audit ALTER COLUMN case_id SET NOT NULL;

-- =====================================================
-- STEP 5: CREATE NEW FOREIGN KEY CONSTRAINTS
-- =====================================================
-- Add foreign key constraints for new UUID references
ALTER TABLE attachments 
ADD CONSTRAINT fk_attachments_case_uuid 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE "autoSaves" 
ADD CONSTRAINT fk_autoSaves_case_uuid 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE "caseDeduplicationAudit" 
ADD CONSTRAINT fk_caseDeduplicationAudit_case_uuid 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE case_assignment_history 
ADD CONSTRAINT fk_case_assignment_history_case_uuid 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE case_status_history 
ADD CONSTRAINT fk_case_status_history_case_uuid 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE locations 
ADD CONSTRAINT fk_locations_case_uuid 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE "officeVerificationReports" 
ADD CONSTRAINT fk_officeVerificationReports_case_uuid 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE "residenceVerificationReports" 
ADD CONSTRAINT fk_residenceVerificationReports_case_uuid 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE mobile_notification_audit 
ADD CONSTRAINT fk_mobile_notification_audit_case_uuid 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

-- =====================================================
-- STEP 6: CREATE PERFORMANCE INDEXES
-- =====================================================
-- Create indexes on new foreign key columns for performance
CREATE INDEX idx_attachments_case_uuid ON attachments (case_id);
CREATE INDEX idx_autoSaves_case_uuid ON "autoSaves" (case_id);
CREATE INDEX idx_caseDeduplicationAudit_case_uuid ON "caseDeduplicationAudit" (case_id);
CREATE INDEX idx_case_assignment_history_case_uuid ON case_assignment_history (case_id);
CREATE INDEX idx_case_status_history_case_uuid ON case_status_history (case_id);
CREATE INDEX idx_locations_case_uuid ON locations (case_id);
CREATE INDEX idx_officeVerificationReports_case_uuid ON "officeVerificationReports" (case_id);
CREATE INDEX idx_residenceVerificationReports_case_uuid ON "residenceVerificationReports" (case_id);
CREATE INDEX idx_mobile_notification_audit_case_uuid ON mobile_notification_audit (case_id);

-- =====================================================
-- STEP 7: UPDATE VIEWS TO USE NEW SCHEMA
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
-- STEP 8: ADD DOCUMENTATION
-- =====================================================
-- Add comments for documentation
COMMENT ON COLUMN cases.id IS 'Primary key - UUID identifier for internal references';
COMMENT ON COLUMN cases."caseId" IS 'Business identifier - Case number for display and external references';
COMMENT ON VIEW form_submissions_view IS 'Updated view using new UUID case references';

-- Log migration completion
INSERT INTO migrations (id, filename, "executedAt")
VALUES ('20250831_standardize_cases_schema_v2', '20250831_standardize_cases_schema_v2.sql', NOW())
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES (run separately after migration)
-- =====================================================
-- SELECT COUNT(*) FROM cases WHERE id IS NOT NULL;
-- SELECT COUNT(*) FROM attachments WHERE case_id IS NOT NULL;
-- SELECT * FROM form_submissions_view LIMIT 5;
