-- Migration: Recreate Form Submissions Tables
-- Created: 2025-10-28
-- Purpose: Recreate form_submissions, form_quality_metrics, and form_validation_logs tables
--          These tables are used by analytics and reporting features

-- =====================================================
-- 1. CREATE form_submissions TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    verification_task_id UUID REFERENCES verification_tasks(id) ON DELETE CASCADE,
    verification_type_id INTEGER REFERENCES "verificationTypes"(id),
    form_type VARCHAR(50) NOT NULL,
    submitted_by UUID NOT NULL REFERENCES users(id),
    submission_data JSONB DEFAULT '{}' NOT NULL,
    validation_status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    validation_errors JSONB DEFAULT '[]',
    photos_count INTEGER DEFAULT 0,
    attachments_count INTEGER DEFAULT 0,
    geo_location JSONB,
    submission_score NUMERIC(5,2),
    time_spent_minutes INTEGER,
    device_info JSONB DEFAULT '{}',
    network_quality VARCHAR(20),
    submitted_at TIMESTAMP DEFAULT now() NOT NULL,
    validated_at TIMESTAMP,
    validated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    
    -- Constraints
    CONSTRAINT form_submissions_form_type_check 
        CHECK (form_type IN ('RESIDENCE', 'OFFICE', 'BUSINESS', 'BUILDER', 'RESIDENCE_CUM_OFFICE', 'DSA_CONNECTOR', 'PROPERTY_APF', 'PROPERTY_INDIVIDUAL', 'NOC')),
    CONSTRAINT form_submissions_validation_status_check 
        CHECK (validation_status IN ('PENDING', 'VALID', 'INVALID', 'REQUIRES_REVIEW')),
    CONSTRAINT form_submissions_photos_count_check 
        CHECK (photos_count >= 0),
    CONSTRAINT form_submissions_attachments_count_check 
        CHECK (attachments_count >= 0),
    CONSTRAINT form_submissions_submission_score_check 
        CHECK (submission_score >= 0 AND submission_score <= 100),
    CONSTRAINT form_submissions_time_spent_minutes_check 
        CHECK (time_spent_minutes >= 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_form_submissions_case_id ON form_submissions(case_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_task_id ON form_submissions(verification_task_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_verification_type ON form_submissions(verification_type_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_type ON form_submissions(form_type);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_by ON form_submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON form_submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_form_submissions_validation_status ON form_submissions(validation_status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_composite ON form_submissions(form_type, validation_status, submitted_at);

-- Add comments
COMMENT ON TABLE form_submissions IS 'Generic form submissions table for analytics and reporting';
COMMENT ON COLUMN form_submissions.verification_task_id IS 'Links form submission to specific verification task (multi-task support)';
COMMENT ON COLUMN form_submissions.verification_type_id IS 'Verification type ID from the task (not case) for proper report generation';

-- =====================================================
-- 2. CREATE form_quality_metrics TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS form_quality_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
    overall_quality_score NUMERIC(5,2),
    completeness_score NUMERIC(5,2),
    accuracy_score NUMERIC(5,2),
    photo_quality_score NUMERIC(5,2),
    timeliness_score NUMERIC(5,2),
    consistency_score NUMERIC(5,2),
    calculated_at TIMESTAMP DEFAULT now(),
    calculated_by VARCHAR(50), -- 'SYSTEM' or user ID
    notes TEXT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    
    -- Constraints
    CONSTRAINT form_quality_metrics_overall_quality_score_check 
        CHECK (overall_quality_score >= 0 AND overall_quality_score <= 100),
    CONSTRAINT form_quality_metrics_completeness_score_check 
        CHECK (completeness_score >= 0 AND completeness_score <= 100),
    CONSTRAINT form_quality_metrics_accuracy_score_check 
        CHECK (accuracy_score >= 0 AND accuracy_score <= 100),
    CONSTRAINT form_quality_metrics_photo_quality_score_check 
        CHECK (photo_quality_score >= 0 AND photo_quality_score <= 100),
    CONSTRAINT form_quality_metrics_timeliness_score_check 
        CHECK (timeliness_score >= 0 AND timeliness_score <= 100),
    CONSTRAINT form_quality_metrics_consistency_score_check 
        CHECK (consistency_score >= 0 AND consistency_score <= 100)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_form_quality_metrics_submission_id ON form_quality_metrics(form_submission_id);
CREATE INDEX IF NOT EXISTS idx_form_quality_metrics_overall_score ON form_quality_metrics(overall_quality_score);
CREATE INDEX IF NOT EXISTS idx_form_quality_metrics_calculated_at ON form_quality_metrics(calculated_at);

-- Add comments
COMMENT ON TABLE form_quality_metrics IS 'Quality metrics for form submissions';

-- =====================================================
-- 3. CREATE form_validation_logs TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS form_validation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    field_value TEXT,
    is_valid BOOLEAN NOT NULL,
    error_message TEXT,
    validation_rule VARCHAR(100),
    validated_at TIMESTAMP DEFAULT now(),
    validated_by VARCHAR(50), -- 'SYSTEM' or user ID
    created_at TIMESTAMP DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_form_validation_logs_submission_id ON form_validation_logs(form_submission_id);
CREATE INDEX IF NOT EXISTS idx_form_validation_logs_field_name ON form_validation_logs(field_name);
CREATE INDEX IF NOT EXISTS idx_form_validation_logs_is_valid ON form_validation_logs(is_valid);
CREATE INDEX IF NOT EXISTS idx_form_validation_logs_validated_at ON form_validation_logs(validated_at);

-- Add comments
COMMENT ON TABLE form_validation_logs IS 'Validation logs for form submission fields';

-- =====================================================
-- 4. CREATE form_submission_analytics VIEW
-- =====================================================

CREATE OR REPLACE VIEW form_submission_analytics AS
SELECT 
    fs.id,
    fs.case_id,
    fs.verification_task_id,
    fs.form_type,
    fs.submitted_by,
    fs.submitted_at,
    fs.validation_status,
    fs.submission_score,
    fs.photos_count,
    fs.attachments_count,
    fqm.overall_quality_score,
    fqm.completeness_score,
    fqm.accuracy_score,
    fqm.photo_quality_score,
    fqm.timeliness_score,
    c."customerName",
    c."caseId" as case_number,
    u.name as submitted_by_name,
    u."employeeId" as submitted_by_employee_id,
    vt.task_number,
    vtype.name as verification_type_name
FROM form_submissions fs
LEFT JOIN form_quality_metrics fqm ON fs.id = fqm.form_submission_id
LEFT JOIN cases c ON fs.case_id = c.id
LEFT JOIN users u ON fs.submitted_by = u.id
LEFT JOIN verification_tasks vt ON fs.verification_task_id = vt.id
LEFT JOIN "verificationTypes" vtype ON fs.verification_type_id = vtype.id;

-- Add comment
COMMENT ON VIEW form_submission_analytics IS 'Analytics view combining form submissions with quality metrics and case data';

-- =====================================================
-- 5. VERIFICATION
-- =====================================================

DO $$
DECLARE
    table_count INTEGER;
BEGIN
    -- Count created tables
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('form_submissions', 'form_quality_metrics', 'form_validation_logs');
    
    IF table_count < 3 THEN
        RAISE EXCEPTION 'Migration incomplete: Expected 3 tables, found %', table_count;
    END IF;
    
    RAISE NOTICE 'Migration successful: All form submission tables created';
END $$;

-- =====================================================
-- 6. DOCUMENTATION
-- =====================================================

-- Log migration completion
COMMENT ON DATABASE acs_db IS 'CRM Database - Migration 011 completed: Recreated form_submissions tables';

