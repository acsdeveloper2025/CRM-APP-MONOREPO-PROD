-- Create AI Reports table for storing AI-generated verification reports
CREATE TABLE IF NOT EXISTS ai_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    submission_id VARCHAR(255) NOT NULL,
    report_data JSONB NOT NULL,
    generated_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_ai_reports_case_id FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_ai_reports_generated_by FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_reports_case_id ON ai_reports(case_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_submission_id ON ai_reports(submission_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_generated_by ON ai_reports(generated_by);
CREATE INDEX IF NOT EXISTS idx_ai_reports_created_at ON ai_reports(created_at);

-- Create unique constraint to prevent duplicate reports for same submission
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_reports_unique_submission 
ON ai_reports(case_id, submission_id);

-- Add comments for documentation
COMMENT ON TABLE ai_reports IS 'Stores AI-generated verification reports for form submissions';
COMMENT ON COLUMN ai_reports.id IS 'Unique identifier for the AI report';
COMMENT ON COLUMN ai_reports.case_id IS 'Reference to the case this report belongs to';
COMMENT ON COLUMN ai_reports.submission_id IS 'Identifier of the form submission this report analyzes';
COMMENT ON COLUMN ai_reports.report_data IS 'JSON data containing the complete AI-generated report';
COMMENT ON COLUMN ai_reports.generated_by IS 'User who requested the AI report generation';
COMMENT ON COLUMN ai_reports.created_at IS 'Timestamp when the report was generated';
COMMENT ON COLUMN ai_reports.updated_at IS 'Timestamp when the report was last updated';

-- Create trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_ai_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_reports_updated_at
    BEFORE UPDATE ON ai_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_reports_updated_at();
