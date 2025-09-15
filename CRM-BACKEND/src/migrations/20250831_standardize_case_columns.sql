-- Migration: Standardize case-related column naming conventions
-- Date: 2025-08-31
-- Purpose: Ensure consistent column naming for case references across all tables

-- This migration standardizes the caseId column naming to use consistent case-sensitive naming
-- All tables should reference case IDs using "caseId" (quoted, case-sensitive)

BEGIN;

-- Check current column names and ensure consistency
-- Note: This migration documents the current state and ensures future consistency

-- 1. Verify cases table has proper caseId column
DO $$
BEGIN
    -- Check if caseId column exists with proper case
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cases' 
        AND column_name = 'caseId'
    ) THEN
        RAISE EXCEPTION 'cases.caseId column not found with expected case';
    END IF;
END $$;

-- 2. Verify attachments table has proper caseId column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attachments' 
        AND column_name = 'caseId'
    ) THEN
        RAISE EXCEPTION 'attachments.caseId column not found with expected case';
    END IF;
END $$;

-- 3. Verify residenceVerificationReports table has proper caseId column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'residenceVerificationReports' 
        AND column_name = 'caseId'
    ) THEN
        RAISE EXCEPTION 'residenceVerificationReports.caseId column not found with expected case';
    END IF;
END $$;

-- 4. Verify officeVerificationReports table has proper caseId column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'officeVerificationReports' 
        AND column_name = 'caseId'
    ) THEN
        RAISE EXCEPTION 'officeVerificationReports.caseId column not found with expected case';
    END IF;
END $$;

-- 5. Add indexes for better query performance on case-related joins
-- (Only create if they don't already exist)

-- Index for form submissions queries
CREATE INDEX IF NOT EXISTS idx_residence_reports_case_created 
ON "residenceVerificationReports" ("caseId", "createdAt");

CREATE INDEX IF NOT EXISTS idx_office_reports_case_created 
ON "officeVerificationReports" ("caseId", "createdAt");

-- Index for attachments by case and upload date
CREATE INDEX IF NOT EXISTS idx_attachments_case_created 
ON attachments ("caseId", "createdAt");

-- 6. Create a view for consistent form submissions reporting
CREATE OR REPLACE VIEW form_submissions_view AS
SELECT 
    'RESIDENCE' as form_type,
    r."caseId" as case_id,
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
    o."caseId" as case_id,
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

-- 7. Add comments for documentation
COMMENT ON VIEW form_submissions_view IS 'Unified view of all form submissions for reporting purposes';
COMMENT ON INDEX idx_residence_reports_case_created IS 'Performance index for residence reports by case and date';
COMMENT ON INDEX idx_office_reports_case_created IS 'Performance index for office reports by case and date';
COMMENT ON INDEX idx_attachments_case_created IS 'Performance index for attachments by case and date';

COMMIT;
