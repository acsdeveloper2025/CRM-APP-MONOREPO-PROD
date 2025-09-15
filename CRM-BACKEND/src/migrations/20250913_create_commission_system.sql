-- =====================================================
-- COMMISSION MANAGEMENT SYSTEM MIGRATION
-- Date: 2025-09-13
-- Purpose: Create comprehensive commission system for field employees
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: CREATE COMMISSION RATE TYPES TABLE
-- =====================================================
-- This table stores commission rates for different rate types assigned to field users
CREATE TABLE IF NOT EXISTS commission_rate_types (
    id BIGSERIAL PRIMARY KEY,
    rate_type_id INTEGER NOT NULL REFERENCES "rateTypes"(id) ON DELETE CASCADE,
    commission_amount DECIMAL(10,2) NOT NULL CHECK (commission_amount >= 0),
    commission_percentage DECIMAL(5,2) CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
    currency VARCHAR(3) DEFAULT 'INR',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure either amount or percentage is set, not both
    CONSTRAINT chk_commission_rate_types_amount_or_percentage 
    CHECK ((commission_amount IS NOT NULL AND commission_percentage IS NULL) OR 
           (commission_amount IS NULL AND commission_percentage IS NOT NULL))
);

-- =====================================================
-- STEP 2: CREATE FIELD USER COMMISSION ASSIGNMENTS TABLE
-- =====================================================
-- This table assigns commission rate types to specific field users
CREATE TABLE IF NOT EXISTS field_user_commission_assignments (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rate_type_id INTEGER NOT NULL REFERENCES "rateTypes"(id) ON DELETE CASCADE,
    commission_amount DECIMAL(10,2) NOT NULL CHECK (commission_amount >= 0),
    commission_percentage DECIMAL(5,2) CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
    currency VARCHAR(3) DEFAULT 'INR',
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE, -- Institute-specific assignments
    is_active BOOLEAN DEFAULT true,
    effective_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    effective_to TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure either amount or percentage is set, not both
    CONSTRAINT chk_field_user_commission_amount_or_percentage 
    CHECK ((commission_amount IS NOT NULL AND commission_percentage IS NULL) OR 
           (commission_amount IS NULL AND commission_percentage IS NOT NULL)),
    
    -- Unique constraint to prevent duplicate assignments
    CONSTRAINT uk_field_user_commission_assignments 
    UNIQUE (user_id, rate_type_id, client_id, effective_from)
);

-- =====================================================
-- STEP 3: CREATE COMMISSION CALCULATIONS TABLE
-- =====================================================
-- This table stores calculated commissions for completed cases
CREATE TABLE IF NOT EXISTS commission_calculations (
    id BIGSERIAL PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    case_number INTEGER NOT NULL, -- Business case ID for reference
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    rate_type_id INTEGER NOT NULL REFERENCES "rateTypes"(id) ON DELETE CASCADE,
    base_amount DECIMAL(10,2) NOT NULL CHECK (base_amount >= 0), -- Rate amount from rates table
    commission_amount DECIMAL(10,2) NOT NULL CHECK (commission_amount >= 0),
    commission_percentage DECIMAL(5,2) CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
    calculated_commission DECIMAL(10,2) NOT NULL CHECK (calculated_commission >= 0),
    currency VARCHAR(3) DEFAULT 'INR',
    calculation_method VARCHAR(20) NOT NULL CHECK (calculation_method IN ('FIXED_AMOUNT', 'PERCENTAGE')),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'PAID', 'REJECTED')),
    case_completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    paid_by UUID REFERENCES users(id),
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_method VARCHAR(50),
    transaction_id VARCHAR(100),
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- STEP 4: CREATE COMMISSION PAYMENT BATCHES TABLE
-- =====================================================
-- This table groups commission payments into batches for easier management
CREATE TABLE IF NOT EXISTS commission_payment_batches (
    id BIGSERIAL PRIMARY KEY,
    batch_number VARCHAR(50) UNIQUE NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
    total_commissions INTEGER NOT NULL CHECK (total_commissions >= 0),
    currency VARCHAR(3) DEFAULT 'INR',
    payment_method VARCHAR(50) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    created_by UUID NOT NULL REFERENCES users(id),
    processed_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- STEP 5: CREATE COMMISSION BATCH ITEMS TABLE
-- =====================================================
-- This table links commission calculations to payment batches
CREATE TABLE IF NOT EXISTS commission_batch_items (
    id BIGSERIAL PRIMARY KEY,
    batch_id BIGINT NOT NULL REFERENCES commission_payment_batches(id) ON DELETE CASCADE,
    commission_id BIGINT NOT NULL REFERENCES commission_calculations(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure each commission is only in one batch
    CONSTRAINT uk_commission_batch_items_commission 
    UNIQUE (commission_id)
);

-- =====================================================
-- STEP 6: CREATE INDEXES FOR PERFORMANCE
-- =====================================================
-- Commission rate types indexes
CREATE INDEX idx_commission_rate_types_rate_type_id ON commission_rate_types(rate_type_id);
CREATE INDEX idx_commission_rate_types_active ON commission_rate_types(is_active);

-- Field user commission assignments indexes
CREATE INDEX idx_field_user_commission_user_id ON field_user_commission_assignments(user_id);
CREATE INDEX idx_field_user_commission_rate_type_id ON field_user_commission_assignments(rate_type_id);
CREATE INDEX idx_field_user_commission_client_id ON field_user_commission_assignments(client_id);
CREATE INDEX idx_field_user_commission_active ON field_user_commission_assignments(is_active);
CREATE INDEX idx_field_user_commission_effective ON field_user_commission_assignments(effective_from, effective_to);

-- Commission calculations indexes
CREATE INDEX idx_commission_calculations_case_id ON commission_calculations(case_id);
CREATE INDEX idx_commission_calculations_user_id ON commission_calculations(user_id);
CREATE INDEX idx_commission_calculations_client_id ON commission_calculations(client_id);
CREATE INDEX idx_commission_calculations_status ON commission_calculations(status);
CREATE INDEX idx_commission_calculations_completed_at ON commission_calculations(case_completed_at);
CREATE INDEX idx_commission_calculations_user_status ON commission_calculations(user_id, status);

-- Commission payment batches indexes
CREATE INDEX idx_commission_payment_batches_status ON commission_payment_batches(status);
CREATE INDEX idx_commission_payment_batches_created_by ON commission_payment_batches(created_by);
CREATE INDEX idx_commission_payment_batches_payment_date ON commission_payment_batches(payment_date);

-- Commission batch items indexes
CREATE INDEX idx_commission_batch_items_batch_id ON commission_batch_items(batch_id);
CREATE INDEX idx_commission_batch_items_commission_id ON commission_batch_items(commission_id);

-- =====================================================
-- STEP 7: CREATE TRIGGERS FOR UPDATED_AT
-- =====================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all commission tables
CREATE TRIGGER update_commission_rate_types_updated_at 
    BEFORE UPDATE ON commission_rate_types 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_field_user_commission_assignments_updated_at 
    BEFORE UPDATE ON field_user_commission_assignments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_calculations_updated_at 
    BEFORE UPDATE ON commission_calculations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_payment_batches_updated_at 
    BEFORE UPDATE ON commission_payment_batches 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 8: ADD COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE commission_rate_types IS 'Commission rates for different rate types - template for field user assignments';
COMMENT ON TABLE field_user_commission_assignments IS 'Commission assignments for field users by rate type and client';
COMMENT ON TABLE commission_calculations IS 'Calculated commissions for completed cases';
COMMENT ON TABLE commission_payment_batches IS 'Batched commission payments for easier processing';
COMMENT ON TABLE commission_batch_items IS 'Individual commission items within payment batches';

COMMENT ON COLUMN field_user_commission_assignments.client_id IS 'NULL for global assignments, specific client_id for institute-specific rates';
COMMENT ON COLUMN commission_calculations.calculation_method IS 'FIXED_AMOUNT for fixed commission, PERCENTAGE for percentage-based';
COMMENT ON COLUMN commission_calculations.base_amount IS 'Original rate amount from rates table';
COMMENT ON COLUMN commission_calculations.calculated_commission IS 'Final commission amount to be paid';

COMMIT;
