-- Create template_reports table for storing template-based verification reports
-- This table stores structured reports generated using predefined templates

CREATE TABLE IF NOT EXISTS template_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    submission_id VARCHAR(255) NOT NULL,
    verification_type VARCHAR(100) NOT NULL,
    outcome VARCHAR(255) NOT NULL,
    report_content TEXT NOT NULL,
    metadata JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_template_reports_case_id ON template_reports(case_id);
CREATE INDEX IF NOT EXISTS idx_template_reports_submission_id ON template_reports(submission_id);
CREATE INDEX IF NOT EXISTS idx_template_reports_verification_type ON template_reports(verification_type);
CREATE INDEX IF NOT EXISTS idx_template_reports_outcome ON template_reports(outcome);
CREATE INDEX IF NOT EXISTS idx_template_reports_created_by ON template_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_template_reports_created_at ON template_reports(created_at);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_template_reports_case_submission ON template_reports(case_id, submission_id);

-- Add comments for documentation
COMMENT ON TABLE template_reports IS 'Stores template-based verification reports generated for form submissions';
COMMENT ON COLUMN template_reports.id IS 'Unique identifier for the template report';
COMMENT ON COLUMN template_reports.case_id IS 'Reference to the case this report belongs to';
COMMENT ON COLUMN template_reports.submission_id IS 'Identifier for the form submission this report is based on';
COMMENT ON COLUMN template_reports.verification_type IS 'Type of verification (RESIDENCE, OFFICE, BUSINESS, etc.)';
COMMENT ON COLUMN template_reports.outcome IS 'Verification outcome (Positive & Door Locked, etc.)';
COMMENT ON COLUMN template_reports.report_content IS 'The generated template-based report content';
COMMENT ON COLUMN template_reports.metadata IS 'Additional metadata about the report generation (template used, etc.)';
COMMENT ON COLUMN template_reports.created_by IS 'User who generated the report';
COMMENT ON COLUMN template_reports.created_at IS 'Timestamp when the report was created';
COMMENT ON COLUMN template_reports.updated_at IS 'Timestamp when the report was last updated';

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_template_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_template_reports_updated_at
    BEFORE UPDATE ON template_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_template_reports_updated_at();
