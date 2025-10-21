-- =====================================================
-- ENHANCED MULTI-VERIFICATION DATABASE SCHEMA
-- =====================================================
-- This schema extends the existing CRM system to support
-- multiple verification tasks per case while maintaining
-- backward compatibility with the current system.

-- =====================================================
-- 1. VERIFICATION TASKS TABLE (NEW)
-- =====================================================
-- Core table for individual verification tasks within a case
CREATE TABLE verification_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_number VARCHAR(20) NOT NULL,           -- Human-readable task ID (e.g., VT-001, VT-002)
    case_id UUID NOT NULL,                      -- Links to main cases table
    
    -- Task Details
    verification_type_id INTEGER NOT NULL,      -- Type of verification (document, address, etc.)
    task_title VARCHAR(255) NOT NULL,           -- Descriptive title for the task
    task_description TEXT,                      -- Detailed description of what needs to be verified
    priority VARCHAR(10) DEFAULT 'MEDIUM',     -- Task-specific priority
    
    -- Assignment Details
    assigned_to UUID,                           -- Field user assigned to this specific task
    assigned_by UUID,                           -- Who assigned this task
    assigned_at TIMESTAMP,                      -- When task was assigned
    
    -- Task Status and Progress
    status VARCHAR(20) DEFAULT 'PENDING',      -- PENDING, IN_PROGRESS, COMPLETED, CANCELLED
    verification_outcome VARCHAR(50),           -- Outcome of this specific verification
    
    -- Billing Information
    rate_type_id INTEGER,                       -- Rate type for this specific task
    estimated_amount NUMERIC(10,2),             -- Estimated cost for this task
    actual_amount NUMERIC(10,2),                -- Actual billed amount
    
    -- Location and Address (for address verification tasks)
    address TEXT,                               -- Specific address for this task
    pincode VARCHAR(10),                        -- Pincode for this task
    latitude DECIMAL(10, 8),                    -- GPS coordinates
    longitude DECIMAL(11, 8),
    
    -- Document Information (for document verification tasks)
    document_type VARCHAR(100),                 -- Type of document to verify
    document_number VARCHAR(100),               -- Document number/ID
    document_details JSONB,                     -- Additional document metadata
    
    -- Timing and Completion
    estimated_completion_date DATE,             -- Expected completion date
    started_at TIMESTAMP,                       -- When field user started working
    completed_at TIMESTAMP,                     -- When task was completed
    
    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    
    -- Constraints
    CONSTRAINT fk_verification_tasks_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_verification_tasks_verification_type FOREIGN KEY (verification_type_id) REFERENCES "verificationTypes"(id),
    CONSTRAINT fk_verification_tasks_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id),
    CONSTRAINT fk_verification_tasks_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id),
    CONSTRAINT fk_verification_tasks_rate_type FOREIGN KEY (rate_type_id) REFERENCES "rateTypes"(id),
    CONSTRAINT unique_task_number UNIQUE (task_number)
);

-- Indexes for performance
CREATE INDEX idx_verification_tasks_case_id ON verification_tasks(case_id);
CREATE INDEX idx_verification_tasks_assigned_to ON verification_tasks(assigned_to);
CREATE INDEX idx_verification_tasks_status ON verification_tasks(status);
CREATE INDEX idx_verification_tasks_verification_type ON verification_tasks(verification_type_id);

-- =====================================================
-- 2. TASK COMMISSION CALCULATIONS (NEW)
-- =====================================================
-- Individual commission calculations for each verification task
CREATE TABLE task_commission_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_task_id UUID NOT NULL,        -- Links to specific verification task
    case_id UUID NOT NULL,                     -- Links to main case (for reporting)
    task_number VARCHAR(20) NOT NULL,          -- Task number for reference
    
    -- User and Assignment Details
    user_id UUID NOT NULL,                     -- Field user who completed the task
    client_id INTEGER NOT NULL,                -- Client for billing
    rate_type_id INTEGER NOT NULL,             -- Rate type used for calculation
    
    -- Financial Calculations
    base_amount NUMERIC(10,2) NOT NULL,        -- Base rate for this task type
    commission_amount NUMERIC(10,2) NOT NULL,  -- Commission amount for this task
    calculated_commission NUMERIC(10,2) NOT NULL, -- Final calculated commission
    currency VARCHAR(3) DEFAULT 'INR',
    
    -- Calculation Details
    calculation_method VARCHAR(20) DEFAULT 'FIXED_AMOUNT', -- FIXED_AMOUNT, PERCENTAGE
    calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Payment Status
    status VARCHAR(20) DEFAULT 'PENDING',      -- PENDING, APPROVED, PAID, REJECTED
    approved_by UUID,
    approved_at TIMESTAMP,
    paid_by UUID,
    paid_at TIMESTAMP,
    payment_method VARCHAR(50),
    transaction_id VARCHAR(100),
    rejection_reason TEXT,
    
    -- Task Completion Details
    task_completed_at TIMESTAMP NOT NULL,      -- When the task was completed
    verification_outcome VARCHAR(50),          -- Outcome of the verification
    
    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    notes TEXT,
    
    -- Constraints
    CONSTRAINT fk_task_commission_verification_task FOREIGN KEY (verification_task_id) REFERENCES verification_tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_commission_case FOREIGN KEY (case_id) REFERENCES cases(id),
    CONSTRAINT fk_task_commission_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_task_commission_rate_type FOREIGN KEY (rate_type_id) REFERENCES "rateTypes"(id),
    CONSTRAINT unique_task_commission UNIQUE (verification_task_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_task_commission_verification_task ON task_commission_calculations(verification_task_id);
CREATE INDEX idx_task_commission_user ON task_commission_calculations(user_id);
CREATE INDEX idx_task_commission_status ON task_commission_calculations(status);
CREATE INDEX idx_task_commission_case ON task_commission_calculations(case_id);

-- =====================================================
-- 3. TASK FORM SUBMISSIONS (NEW)
-- =====================================================
-- Links form submissions to specific verification tasks
CREATE TABLE task_form_submissions (
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
    CONSTRAINT fk_task_form_submission FOREIGN KEY (form_submission_id) REFERENCES form_submissions(id),
    CONSTRAINT fk_task_form_submitted_by FOREIGN KEY (submitted_by) REFERENCES users(id),
    CONSTRAINT unique_task_form_submission UNIQUE (verification_task_id, form_submission_id)
);

-- Indexes for performance
CREATE INDEX idx_task_form_verification_task ON task_form_submissions(verification_task_id);
CREATE INDEX idx_task_form_case ON task_form_submissions(case_id);
CREATE INDEX idx_task_form_submission ON task_form_submissions(form_submission_id);

-- =====================================================
-- 4. TASK ASSIGNMENT HISTORY (NEW)
-- =====================================================
-- Track assignment changes for individual verification tasks
CREATE TABLE task_assignment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_task_id UUID NOT NULL,        -- Links to verification task
    case_id UUID NOT NULL,                     -- Links to main case
    
    -- Assignment Details
    assigned_from UUID,                         -- Previous assignee (NULL for initial assignment)
    assigned_to UUID NOT NULL,                 -- New assignee
    assigned_by UUID NOT NULL,                 -- Who made the assignment
    assignment_reason TEXT,                     -- Reason for assignment/reassignment
    
    -- Timing
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Status at time of assignment
    task_status_before VARCHAR(20),            -- Task status before assignment
    task_status_after VARCHAR(20),             -- Task status after assignment
    
    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_task_assignment_verification_task FOREIGN KEY (verification_task_id) REFERENCES verification_tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_assignment_case FOREIGN KEY (case_id) REFERENCES cases(id),
    CONSTRAINT fk_task_assignment_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id),
    CONSTRAINT fk_task_assignment_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_task_assignment_verification_task ON task_assignment_history(verification_task_id);
CREATE INDEX idx_task_assignment_assigned_to ON task_assignment_history(assigned_to);
CREATE INDEX idx_task_assignment_assigned_by ON task_assignment_history(assigned_by);

-- =====================================================
-- 5. CASE MODIFICATIONS (BACKWARD COMPATIBILITY)
-- =====================================================
-- Add new fields to existing cases table to support multi-verification
ALTER TABLE cases ADD COLUMN IF NOT EXISTS has_multiple_tasks BOOLEAN DEFAULT FALSE;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS total_tasks_count INTEGER DEFAULT 1;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS completed_tasks_count INTEGER DEFAULT 0;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_completion_percentage DECIMAL(5,2) DEFAULT 0.00;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_cases_has_multiple_tasks ON cases(has_multiple_tasks);
CREATE INDEX IF NOT EXISTS idx_cases_completion_percentage ON cases(case_completion_percentage);

-- =====================================================
-- 6. VERIFICATION TASK TYPES (NEW)
-- =====================================================
-- Define different types of verification tasks that can be created
CREATE TABLE verification_task_types (
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
    created_by UUID
);

-- Insert default verification task types
INSERT INTO verification_task_types (name, code, description, category, requires_location, requires_documents, required_form_type) VALUES
('Residence Address Verification', 'RESIDENCE_ADDR', 'Verify residential address and occupancy', 'ADDRESS', TRUE, FALSE, 'RESIDENCE'),
('Office Address Verification', 'OFFICE_ADDR', 'Verify office/business address', 'ADDRESS', TRUE, FALSE, 'OFFICE'),
('Document Verification', 'DOCUMENT', 'Verify authenticity of provided documents', 'DOCUMENT', FALSE, TRUE, 'DOCUMENT'),
('Identity Verification', 'IDENTITY', 'Verify identity of the applicant', 'IDENTITY', FALSE, TRUE, 'IDENTITY'),
('Business Verification', 'BUSINESS', 'Verify business operations and legitimacy', 'BUSINESS', TRUE, TRUE, 'BUSINESS'),
('Bank Account Verification', 'BANK_ACCOUNT', 'Verify bank account details', 'FINANCIAL', FALSE, TRUE, 'FINANCIAL'),
('Employment Verification', 'EMPLOYMENT', 'Verify employment status and details', 'EMPLOYMENT', TRUE, FALSE, 'OFFICE');

-- =====================================================
-- 7. TASK TEMPLATES (NEW)
-- =====================================================
-- Pre-defined templates for common verification task combinations
CREATE TABLE verification_task_templates (
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
    created_by UUID
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
);

-- =====================================================
-- 8. VIEWS FOR REPORTING AND ANALYTICS
-- =====================================================

-- Comprehensive case overview with task summary
CREATE OR REPLACE VIEW case_task_summary AS
SELECT
    c.id as case_id,
    c."caseId" as case_number,
    c."customerName",
    c.status as case_status,
    c."createdAt" as case_created_at,
    c.has_multiple_tasks,
    c.total_tasks_count,
    c.completed_tasks_count,
    c.case_completion_percentage,

    -- Task statistics
    COUNT(vt.id) as actual_tasks_count,
    COUNT(CASE WHEN vt.status = 'COMPLETED' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN vt.status = 'IN_PROGRESS' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN vt.status = 'PENDING' THEN 1 END) as pending_tasks,

    -- Financial summary
    SUM(vt.estimated_amount) as total_estimated_amount,
    SUM(vt.actual_amount) as total_actual_amount,
    SUM(CASE WHEN vt.status = 'COMPLETED' THEN vt.actual_amount ELSE 0 END) as completed_amount,

    -- Commission summary
    SUM(tcc.calculated_commission) as total_commission,
    SUM(CASE WHEN tcc.status = 'PAID' THEN tcc.calculated_commission ELSE 0 END) as paid_commission,

    -- Timing
    MIN(vt.assigned_at) as first_task_assigned,
    MAX(vt.completed_at) as last_task_completed

FROM cases c
LEFT JOIN verification_tasks vt ON c.id = vt.case_id
LEFT JOIN task_commission_calculations tcc ON vt.id = tcc.verification_task_id
GROUP BY c.id, c."caseId", c."customerName", c.status, c."createdAt",
         c.has_multiple_tasks, c.total_tasks_count, c.completed_tasks_count, c.case_completion_percentage;

-- Field user task workload view
CREATE OR REPLACE VIEW field_user_task_workload AS
SELECT
    u.id as user_id,
    u.name as user_name,
    u."employeeId",

    -- Task counts
    COUNT(vt.id) as total_assigned_tasks,
    COUNT(CASE WHEN vt.status = 'PENDING' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN vt.status = 'IN_PROGRESS' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN vt.status = 'COMPLETED' THEN 1 END) as completed_tasks,

    -- Performance metrics
    ROUND(
        COUNT(CASE WHEN vt.status = 'COMPLETED' THEN 1 END)::DECIMAL /
        NULLIF(COUNT(vt.id), 0) * 100, 2
    ) as completion_rate_percentage,

    -- Financial metrics
    SUM(CASE WHEN vt.status = 'COMPLETED' THEN vt.actual_amount ELSE 0 END) as total_completed_amount,
    SUM(tcc.calculated_commission) as total_commission_earned,
    SUM(CASE WHEN tcc.status = 'PAID' THEN tcc.calculated_commission ELSE 0 END) as paid_commission,

    -- Timing metrics
    AVG(
        CASE WHEN vt.status = 'COMPLETED' AND vt.started_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (vt.completed_at - vt.started_at))/3600
        END
    ) as avg_completion_time_hours

FROM users u
LEFT JOIN verification_tasks vt ON u.id = vt.assigned_to
LEFT JOIN task_commission_calculations tcc ON vt.id = tcc.verification_task_id
WHERE u.role = 'FIELD_USER'
GROUP BY u.id, u.name, u."employeeId";

-- Task type performance analytics
CREATE OR REPLACE VIEW task_type_analytics AS
SELECT
    vtt.name as task_type_name,
    vtt.code as task_type_code,
    vtt.category,

    -- Volume metrics
    COUNT(vt.id) as total_tasks,
    COUNT(CASE WHEN vt.status = 'COMPLETED' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN vt.status = 'IN_PROGRESS' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN vt.status = 'PENDING' THEN 1 END) as pending_tasks,

    -- Performance metrics
    ROUND(
        COUNT(CASE WHEN vt.status = 'COMPLETED' THEN 1 END)::DECIMAL /
        NULLIF(COUNT(vt.id), 0) * 100, 2
    ) as completion_rate_percentage,

    -- Financial metrics
    AVG(vt.estimated_amount) as avg_estimated_amount,
    AVG(vt.actual_amount) as avg_actual_amount,
    SUM(vt.actual_amount) as total_revenue,

    -- Timing metrics
    AVG(
        CASE WHEN vt.status = 'COMPLETED' AND vt.started_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (vt.completed_at - vt.started_at))/3600
        END
    ) as avg_completion_time_hours

FROM verification_task_types vtt
LEFT JOIN verification_tasks vt ON vtt.id = vt.verification_type_id
GROUP BY vtt.id, vtt.name, vtt.code, vtt.category;

-- =====================================================
-- 9. FUNCTIONS AND TRIGGERS
-- =====================================================

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
        )
    WHERE id = NEW.case_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update case completion percentage
CREATE TRIGGER trigger_update_case_completion
    AFTER INSERT OR UPDATE OF status ON verification_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_case_completion_percentage();

-- Function to generate task numbers
CREATE OR REPLACE FUNCTION generate_task_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.task_number IS NULL THEN
        NEW.task_number := 'VT-' || LPAD(nextval('verification_task_number_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for task numbers
CREATE SEQUENCE IF NOT EXISTS verification_task_number_seq START 1;

-- Trigger to auto-generate task numbers
CREATE TRIGGER trigger_generate_task_number
    BEFORE INSERT ON verification_tasks
    FOR EACH ROW
    EXECUTE FUNCTION generate_task_number();

-- =====================================================
-- 10. MIGRATION SCRIPT FOR EXISTING DATA
-- =====================================================

-- Function to migrate existing cases to new multi-verification structure
CREATE OR REPLACE FUNCTION migrate_existing_cases_to_multi_verification()
RETURNS INTEGER AS $$
DECLARE
    case_record RECORD;
    task_id UUID;
    migrated_count INTEGER := 0;
BEGIN
    -- Loop through all existing cases that don't have verification tasks
    FOR case_record IN
        SELECT c.* FROM cases c
        LEFT JOIN verification_tasks vt ON c.id = vt.case_id
        WHERE vt.id IS NULL
    LOOP
        -- Create a verification task for each existing case
        INSERT INTO verification_tasks (
            case_id,
            verification_type_id,
            task_title,
            task_description,
            priority,
            assigned_to,
            assigned_by,
            assigned_at,
            status,
            verification_outcome,
            rate_type_id,
            address,
            pincode,
            completed_at,
            created_at,
            updated_at
        ) VALUES (
            case_record.id,
            case_record."verificationTypeId",
            'Legacy Verification Task',
            'Migrated from existing case structure',
            case_record.priority,
            case_record."assignedTo",
            case_record."createdByBackendUser",
            case_record."createdAt",
            case_record.status,
            case_record."verificationOutcome",
            case_record."rateTypeId",
            case_record.address,
            case_record.pincode,
            case_record."completedAt",
            case_record."createdAt",
            case_record."updatedAt"
        ) RETURNING id INTO task_id;

        -- Update the case to reflect it now has tasks
        UPDATE cases
        SET
            has_multiple_tasks = FALSE,
            total_tasks_count = 1,
            completed_tasks_count = CASE WHEN case_record.status = 'COMPLETED' THEN 1 ELSE 0 END,
            case_completion_percentage = CASE WHEN case_record.status = 'COMPLETED' THEN 100.00 ELSE 0.00 END
        WHERE id = case_record.id;

        -- Migrate existing commission calculations
        UPDATE commission_calculations
        SET verification_task_id = task_id
        WHERE case_id = case_record.id;

        migrated_count := migrated_count + 1;
    END LOOP;

    RETURN migrated_count;
END;
$$ LANGUAGE plpgsql;

-- Add verification_task_id column to commission_calculations for backward compatibility
ALTER TABLE commission_calculations
ADD COLUMN IF NOT EXISTS verification_task_id UUID;

-- Add foreign key constraint
ALTER TABLE commission_calculations
ADD CONSTRAINT fk_commission_verification_task
FOREIGN KEY (verification_task_id) REFERENCES verification_tasks(id);

-- =====================================================
-- SCHEMA COMPLETE
-- =====================================================
