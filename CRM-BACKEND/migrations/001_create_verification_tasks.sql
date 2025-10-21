-- =====================================================
-- MIGRATION 001: CREATE VERIFICATION TASKS TABLES
-- =====================================================
-- This migration creates the core tables for multi-verification support
-- while maintaining backward compatibility with existing system.

-- Create verification_tasks table
CREATE TABLE IF NOT EXISTS verification_tasks (
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
    CONSTRAINT unique_task_number UNIQUE (task_number),
    CONSTRAINT check_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    CONSTRAINT check_status CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_verification_tasks_case_id ON verification_tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_verification_tasks_assigned_to ON verification_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_verification_tasks_status ON verification_tasks(status);
CREATE INDEX IF NOT EXISTS idx_verification_tasks_verification_type ON verification_tasks(verification_type_id);
CREATE INDEX IF NOT EXISTS idx_verification_tasks_created_at ON verification_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_verification_tasks_priority ON verification_tasks(priority);

-- Create task_commission_calculations table
CREATE TABLE IF NOT EXISTS task_commission_calculations (
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
    CONSTRAINT unique_task_commission UNIQUE (verification_task_id, user_id),
    CONSTRAINT check_commission_status CHECK (status IN ('PENDING', 'CALCULATED', 'APPROVED', 'PAID', 'REJECTED')),
    CONSTRAINT check_calculation_method CHECK (calculation_method IN ('FIXED_AMOUNT', 'PERCENTAGE'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_commission_verification_task ON task_commission_calculations(verification_task_id);
CREATE INDEX IF NOT EXISTS idx_task_commission_user ON task_commission_calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_task_commission_status ON task_commission_calculations(status);
CREATE INDEX IF NOT EXISTS idx_task_commission_case ON task_commission_calculations(case_id);
CREATE INDEX IF NOT EXISTS idx_task_commission_calculation_date ON task_commission_calculations(calculation_date);

-- Create task_assignment_history table
CREATE TABLE IF NOT EXISTS task_assignment_history (
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_assignment_verification_task ON task_assignment_history(verification_task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignment_assigned_to ON task_assignment_history(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_assignment_assigned_by ON task_assignment_history(assigned_by);
CREATE INDEX IF NOT EXISTS idx_task_assignment_assigned_at ON task_assignment_history(assigned_at);

-- Create sequence for task numbers
CREATE SEQUENCE IF NOT EXISTS verification_task_number_seq START 1;

-- Create function to generate task numbers
CREATE OR REPLACE FUNCTION generate_task_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.task_number IS NULL THEN
        NEW.task_number := 'VT-' || LPAD(nextval('verification_task_number_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate task numbers
DROP TRIGGER IF EXISTS trigger_generate_task_number ON verification_tasks;
CREATE TRIGGER trigger_generate_task_number
    BEFORE INSERT ON verification_tasks
    FOR EACH ROW
    EXECUTE FUNCTION generate_task_number();

-- Add verification_task_id column to existing commission_calculations for backward compatibility
ALTER TABLE commission_calculations 
ADD COLUMN IF NOT EXISTS verification_task_id UUID;

-- Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_commission_verification_task'
    ) THEN
        ALTER TABLE commission_calculations 
        ADD CONSTRAINT fk_commission_verification_task 
        FOREIGN KEY (verification_task_id) REFERENCES verification_tasks(id);
    END IF;
END $$;
