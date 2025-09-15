-- Migration: Create template_reports table
-- Date: 2025-09-15
-- Description: Create table for storing template-based verification reports

-- Create template_reports table
CREATE TABLE IF NOT EXISTS template_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    submission_id VARCHAR(255) NOT NULL,
    verification_type VARCHAR(50) NOT NULL,
    outcome VARCHAR(100) NOT NULL,
    report_content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_template_reports_case_id 
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_template_reports_created_by 
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Unique constraint to prevent duplicate reports for same submission
    CONSTRAINT unique_template_report_per_submission 
        UNIQUE (case_id, submission_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_template_reports_case_id ON template_reports(case_id);
CREATE INDEX IF NOT EXISTS idx_template_reports_submission_id ON template_reports(submission_id);
CREATE INDEX IF NOT EXISTS idx_template_reports_verification_type ON template_reports(verification_type);
CREATE INDEX IF NOT EXISTS idx_template_reports_outcome ON template_reports(outcome);
CREATE INDEX IF NOT EXISTS idx_template_reports_created_at ON template_reports(created_at);

-- Add comments for documentation
COMMENT ON TABLE template_reports IS 'Stores template-based verification reports generated from form submissions';
COMMENT ON COLUMN template_reports.id IS 'Unique identifier for the template report';
COMMENT ON COLUMN template_reports.case_id IS 'Reference to the case this report belongs to';
COMMENT ON COLUMN template_reports.submission_id IS 'Mobile app submission ID that this report was generated from';
COMMENT ON COLUMN template_reports.verification_type IS 'Type of verification (RESIDENCE, BUSINESS, etc.)';
COMMENT ON COLUMN template_reports.outcome IS 'Verification outcome (Positive, Negative, etc.)';
COMMENT ON COLUMN template_reports.report_content IS 'Generated template-based report content';
COMMENT ON COLUMN template_reports.metadata IS 'Additional metadata about the report generation';
COMMENT ON COLUMN template_reports.created_at IS 'Timestamp when the report was created';
COMMENT ON COLUMN template_reports.created_by IS 'User who generated the report';
COMMENT ON COLUMN template_reports.updated_at IS 'Timestamp when the report was last updated';
