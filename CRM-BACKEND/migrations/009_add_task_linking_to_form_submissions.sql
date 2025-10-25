-- Migration: Add Task Linking to Form Submissions and Verification Reports
-- Created: 2025-10-25
-- Purpose: Link form submissions and verification reports to specific verification tasks
--          to support multi-task architecture where one case can have multiple verification tasks

-- =====================================================
-- 1. UPDATE form_submissions TABLE
-- =====================================================

-- Add verification_task_id column
ALTER TABLE form_submissions 
ADD COLUMN IF NOT EXISTS verification_task_id UUID REFERENCES verification_tasks(id) ON DELETE CASCADE;

-- Add verification_type_id column (from task, not case)
ALTER TABLE form_submissions 
ADD COLUMN IF NOT EXISTS verification_type_id INTEGER REFERENCES "verificationTypes"(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_form_submissions_task_id 
ON form_submissions(verification_task_id);

CREATE INDEX IF NOT EXISTS idx_form_submissions_verification_type 
ON form_submissions(verification_type_id);

-- Add comments
COMMENT ON COLUMN form_submissions.verification_task_id IS 
'Links form submission to specific verification task (multi-task support)';

COMMENT ON COLUMN form_submissions.verification_type_id IS 
'Verification type ID from the task (not case) for proper report generation';

-- =====================================================
-- 2. UPDATE VERIFICATION REPORT TABLES
-- =====================================================

-- Residence Verification Reports
ALTER TABLE "residenceVerificationReports" 
ADD COLUMN IF NOT EXISTS verification_task_id UUID REFERENCES verification_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_residence_reports_task_id 
ON "residenceVerificationReports"(verification_task_id);

COMMENT ON COLUMN "residenceVerificationReports".verification_task_id IS 
'Links residence verification report to specific verification task';

-- Office Verification Reports
ALTER TABLE "officeVerificationReports" 
ADD COLUMN IF NOT EXISTS verification_task_id UUID REFERENCES verification_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_office_reports_task_id 
ON "officeVerificationReports"(verification_task_id);

COMMENT ON COLUMN "officeVerificationReports".verification_task_id IS 
'Links office verification report to specific verification task';

-- Business Verification Reports
ALTER TABLE "businessVerificationReports" 
ADD COLUMN IF NOT EXISTS verification_task_id UUID REFERENCES verification_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_business_reports_task_id 
ON "businessVerificationReports"(verification_task_id);

COMMENT ON COLUMN "businessVerificationReports".verification_task_id IS 
'Links business verification report to specific verification task';

-- Builder Verification Reports
ALTER TABLE "builderVerificationReports" 
ADD COLUMN IF NOT EXISTS verification_task_id UUID REFERENCES verification_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_builder_reports_task_id 
ON "builderVerificationReports"(verification_task_id);

COMMENT ON COLUMN "builderVerificationReports".verification_task_id IS 
'Links builder verification report to specific verification task';

-- Residence-cum-Office Verification Reports
ALTER TABLE "residenceCumOfficeVerificationReports" 
ADD COLUMN IF NOT EXISTS verification_task_id UUID REFERENCES verification_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_residence_cum_office_reports_task_id 
ON "residenceCumOfficeVerificationReports"(verification_task_id);

COMMENT ON COLUMN "residenceCumOfficeVerificationReports".verification_task_id IS 
'Links residence-cum-office verification report to specific verification task';

-- DSA Connector Verification Reports
ALTER TABLE "dsaConnectorVerificationReports" 
ADD COLUMN IF NOT EXISTS verification_task_id UUID REFERENCES verification_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_dsa_connector_reports_task_id 
ON "dsaConnectorVerificationReports"(verification_task_id);

COMMENT ON COLUMN "dsaConnectorVerificationReports".verification_task_id IS 
'Links DSA connector verification report to specific verification task';

-- Property APF Verification Reports
ALTER TABLE "propertyApfVerificationReports" 
ADD COLUMN IF NOT EXISTS verification_task_id UUID REFERENCES verification_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_property_apf_reports_task_id 
ON "propertyApfVerificationReports"(verification_task_id);

COMMENT ON COLUMN "propertyApfVerificationReports".verification_task_id IS 
'Links property APF verification report to specific verification task';

-- Property Individual Verification Reports
ALTER TABLE "propertyIndividualVerificationReports" 
ADD COLUMN IF NOT EXISTS verification_task_id UUID REFERENCES verification_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_property_individual_reports_task_id 
ON "propertyIndividualVerificationReports"(verification_task_id);

COMMENT ON COLUMN "propertyIndividualVerificationReports".verification_task_id IS 
'Links property individual verification report to specific verification task';

-- NOC Verification Reports
ALTER TABLE "nocVerificationReports" 
ADD COLUMN IF NOT EXISTS verification_task_id UUID REFERENCES verification_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_noc_reports_task_id 
ON "nocVerificationReports"(verification_task_id);

COMMENT ON COLUMN "nocVerificationReports".verification_task_id IS 
'Links NOC verification report to specific verification task';

-- =====================================================
-- 3. UPDATE verification_attachments TABLE
-- =====================================================

ALTER TABLE verification_attachments 
ADD COLUMN IF NOT EXISTS verification_task_id UUID REFERENCES verification_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_verification_attachments_task_id 
ON verification_attachments(verification_task_id);

COMMENT ON COLUMN verification_attachments.verification_task_id IS 
'Links verification image/attachment to specific verification task';

-- =====================================================
-- 4. VALIDATION AND LOGGING
-- =====================================================

DO $$
DECLARE
    table_count INTEGER;
BEGIN
    -- Count tables that were updated
    SELECT COUNT(*) INTO table_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND column_name = 'verification_task_id'
    AND table_name IN (
        'form_submissions',
        'residenceVerificationReports',
        'officeVerificationReports',
        'businessVerificationReports',
        'builderVerificationReports',
        'residenceCumOfficeVerificationReports',
        'dsaConnectorVerificationReports',
        'propertyApfVerificationReports',
        'propertyIndividualVerificationReports',
        'nocVerificationReports',
        'verification_attachments'
    );
    
    IF table_count < 11 THEN
        RAISE EXCEPTION 'Migration incomplete: Expected 11 tables with verification_task_id, found %', table_count;
    END IF;
    
    RAISE NOTICE '✅ Migration completed successfully';
    RAISE NOTICE '   - Added verification_task_id to % tables', table_count;
    RAISE NOTICE '   - Added verification_type_id to form_submissions';
    RAISE NOTICE '   - Created % indexes for performance', table_count;
    RAISE NOTICE '   - Multi-task form submission support enabled';
END $$;

