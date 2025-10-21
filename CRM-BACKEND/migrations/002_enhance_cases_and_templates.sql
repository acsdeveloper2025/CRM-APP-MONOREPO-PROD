-- =====================================================
-- MIGRATION 002: ENHANCE CASES AND ADD TEMPLATES
-- =====================================================
-- This migration enhances the cases table for multi-task support
-- and adds task templates and form submission linking.

-- Add new fields to existing cases table to support multi-verification
ALTER TABLE cases ADD COLUMN IF NOT EXISTS has_multiple_tasks BOOLEAN DEFAULT FALSE;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS total_tasks_count INTEGER DEFAULT 1;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS completed_tasks_count INTEGER DEFAULT 0;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_completion_percentage DECIMAL(5,2) DEFAULT 0.00;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_cases_has_multiple_tasks ON cases(has_multiple_tasks);
CREATE INDEX IF NOT EXISTS idx_cases_completion_percentage ON cases(case_completion_percentage);
CREATE INDEX IF NOT EXISTS idx_cases_total_tasks_count ON cases(total_tasks_count);

-- Create task_form_submissions table
CREATE TABLE IF NOT EXISTS task_form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_task_id UUID NOT NULL,        -- Links to specific verification task
    case_id UUID NOT NULL,                     -- Links to main case
    form_submission_id UUID NOT NULL,          -- Links to existing form_submissions table
    
    -- Submission Details
    form_type VARCHAR(50) NOT NULL,            -- RESIDENCE, OFFICE, BUSINESS, etc.
    submitted_by UUID NOT NULL,                -- Field user who submitted
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Validation Status
    validation_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, VALID, INVALID
    validated_by UUID,
    validated_at TIMESTAMP,
    validation_notes TEXT,
    
    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_task_form_verification_task FOREIGN KEY (verification_task_id) REFERENCES verification_tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_form_case FOREIGN KEY (case_id) REFERENCES cases(id),
    CONSTRAINT fk_task_form_submitted_by FOREIGN KEY (submitted_by) REFERENCES users(id),
    CONSTRAINT unique_task_form_submission UNIQUE (verification_task_id, form_submission_id),
    CONSTRAINT check_validation_status CHECK (validation_status IN ('PENDING', 'VALID', 'INVALID'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_form_verification_task ON task_form_submissions(verification_task_id);
CREATE INDEX IF NOT EXISTS idx_task_form_case ON task_form_submissions(case_id);
CREATE INDEX IF NOT EXISTS idx_task_form_submission ON task_form_submissions(form_submission_id);
CREATE INDEX IF NOT EXISTS idx_task_form_submitted_at ON task_form_submissions(submitted_at);

-- Create verification_task_types table
CREATE TABLE IF NOT EXISTS verification_task_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,         -- e.g., "Document Verification", "Address Verification"
    code VARCHAR(20) NOT NULL UNIQUE,          -- e.g., "DOC_VERIFY", "ADDR_VERIFY"
    description TEXT,
    category VARCHAR(50),                       -- DOCUMENT, ADDRESS, BUSINESS, IDENTITY
    
    -- Default settings
    default_priority VARCHAR(10) DEFAULT 'MEDIUM',
    estimated_duration_hours INTEGER DEFAULT 24,
    requires_location BOOLEAN DEFAULT FALSE,
    requires_documents BOOLEAN DEFAULT FALSE,
    
    -- Form requirements
    required_form_type VARCHAR(50),            -- Which form type is required
    validation_rules JSONB,                    -- Custom validation rules
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    
    -- Constraints
    CONSTRAINT check_task_type_priority CHECK (default_priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    CONSTRAINT check_task_type_category CHECK (category IN ('DOCUMENT', 'ADDRESS', 'BUSINESS', 'IDENTITY', 'FINANCIAL', 'EMPLOYMENT'))
);

-- Insert default verification task types
INSERT INTO verification_task_types (name, code, description, category, requires_location, requires_documents, required_form_type) VALUES
('Residence Address Verification', 'RESIDENCE_ADDR', 'Verify residential address and occupancy', 'ADDRESS', TRUE, FALSE, 'RESIDENCE'),
('Office Address Verification', 'OFFICE_ADDR', 'Verify office/business address', 'ADDRESS', TRUE, FALSE, 'OFFICE'),
('Document Verification', 'DOCUMENT', 'Verify authenticity of provided documents', 'DOCUMENT', FALSE, TRUE, 'DOCUMENT'),
('Identity Verification', 'IDENTITY', 'Verify identity of the applicant', 'IDENTITY', FALSE, TRUE, 'IDENTITY'),
('Business Verification', 'BUSINESS', 'Verify business operations and legitimacy', 'BUSINESS', TRUE, TRUE, 'BUSINESS'),
('Bank Account Verification', 'BANK_ACCOUNT', 'Verify bank account details', 'FINANCIAL', FALSE, TRUE, 'FINANCIAL'),
('Employment Verification', 'EMPLOYMENT', 'Verify employment status and details', 'EMPLOYMENT', TRUE, FALSE, 'OFFICE')
ON CONFLICT (code) DO NOTHING;

-- Create verification_task_templates table
CREATE TABLE IF NOT EXISTS verification_task_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,                -- e.g., "Standard KYC Package", "Property Verification"
    description TEXT,
    category VARCHAR(50),                       -- INDIVIDUAL, BUSINESS, PROPERTY, FINANCIAL
    
    -- Template configuration
    tasks JSONB NOT NULL,                       -- Array of task configurations
    estimated_total_cost NUMERIC(10,2),
    estimated_duration_days INTEGER,
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    
    -- Constraints
    CONSTRAINT check_template_category CHECK (category IN ('INDIVIDUAL', 'BUSINESS', 'PROPERTY', 'FINANCIAL'))
);

-- Insert default templates
INSERT INTO verification_task_templates (name, description, category, tasks, estimated_total_cost, estimated_duration_days) VALUES
(
    'Standard Individual KYC',
    'Complete KYC verification for individual customers',
    'INDIVIDUAL',
    '[
        {"task_type": "RESIDENCE_ADDR", "priority": "HIGH", "title": "Verify Residential Address"},
        {"task_type": "DOCUMENT", "priority": "HIGH", "title": "Verify Identity Documents"},
        {"task_type": "IDENTITY", "priority": "MEDIUM", "title": "Verify Personal Identity"}
    ]'::jsonb,
    1500.00,
    3
),
(
    'Business Verification Package',
    'Complete verification for business entities',
    'BUSINESS',
    '[
        {"task_type": "OFFICE_ADDR", "priority": "HIGH", "title": "Verify Business Address"},
        {"task_type": "BUSINESS", "priority": "HIGH", "title": "Verify Business Operations"},
        {"task_type": "DOCUMENT", "priority": "MEDIUM", "title": "Verify Business Documents"}
    ]'::jsonb,
    2500.00,
    5
),
(
    'Property Verification Complete',
    'Comprehensive property verification package',
    'PROPERTY',
    '[
        {"task_type": "RESIDENCE_ADDR", "priority": "HIGH", "title": "Verify Property Address"},
        {"task_type": "DOCUMENT", "priority": "HIGH", "title": "Verify Property Documents"},
        {"task_type": "BUSINESS", "priority": "MEDIUM", "title": "Verify Property Business Use"}
    ]'::jsonb,
    2000.00,
    4
)
ON CONFLICT DO NOTHING;

-- Function to update case completion percentage
CREATE OR REPLACE FUNCTION update_case_completion_percentage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE cases 
    SET 
        completed_tasks_count = (
            SELECT COUNT(*) 
            FROM verification_tasks 
            WHERE case_id = NEW.case_id AND status = 'COMPLETED'
        ),
        case_completion_percentage = (
            SELECT 
                CASE 
                    WHEN COUNT(*) = 0 THEN 0
                    ELSE ROUND(
                        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::DECIMAL / 
                        COUNT(*)::DECIMAL * 100, 2
                    )
                END
            FROM verification_tasks 
            WHERE case_id = NEW.case_id
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.case_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update case completion percentage
DROP TRIGGER IF EXISTS trigger_update_case_completion ON verification_tasks;
CREATE TRIGGER trigger_update_case_completion
    AFTER INSERT OR UPDATE OF status ON verification_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_case_completion_percentage();

-- Function to update task updated_at timestamp
CREATE OR REPLACE FUNCTION update_task_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_task_updated_at ON verification_tasks;
CREATE TRIGGER trigger_update_task_updated_at
    BEFORE UPDATE ON verification_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_task_updated_at();

-- Create trigger for task_commission_calculations updated_at
DROP TRIGGER IF EXISTS trigger_update_commission_updated_at ON task_commission_calculations;
CREATE TRIGGER trigger_update_commission_updated_at
    BEFORE UPDATE ON task_commission_calculations
    FOR EACH ROW
    EXECUTE FUNCTION update_task_updated_at();

-- Create indexes for task templates
CREATE INDEX IF NOT EXISTS idx_task_templates_category ON verification_task_templates(category);
CREATE INDEX IF NOT EXISTS idx_task_templates_is_active ON verification_task_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_task_templates_usage_count ON verification_task_templates(usage_count);

-- Create indexes for task types
CREATE INDEX IF NOT EXISTS idx_task_types_category ON verification_task_types(category);
CREATE INDEX IF NOT EXISTS idx_task_types_is_active ON verification_task_types(is_active);
CREATE INDEX IF NOT EXISTS idx_task_types_code ON verification_task_types(code);
