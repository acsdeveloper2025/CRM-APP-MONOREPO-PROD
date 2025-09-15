-- Migration: Add normalized data tables for better search and validation
-- Date: 2025-09-02
-- Description: Add tables for normalized form data, business rules, and standardized addresses

-- Create normalized_form_data table for better querying
CREATE TABLE IF NOT EXISTS normalized_form_data (
    case_id VARCHAR(255) PRIMARY KEY,
    
    -- Customer Information (searchable fields)
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    customer_pan VARCHAR(10),
    customer_age INTEGER,
    customer_gender VARCHAR(20),
    customer_marital_status VARCHAR(50),
    customer_occupation VARCHAR(100),
    customer_monthly_income DECIMAL(15,2),
    
    -- Address Information (searchable fields)
    full_address TEXT NOT NULL,
    house_number VARCHAR(50),
    street_name VARCHAR(255),
    locality VARCHAR(255),
    landmark VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    district VARCHAR(100),
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    address_locatable BOOLEAN DEFAULT true,
    address_rating INTEGER,
    
    -- Verification Details
    verification_type VARCHAR(50) NOT NULL,
    verification_date DATE NOT NULL,
    verification_time TIME,
    verifier_name VARCHAR(255) NOT NULL,
    verifier_employee_id VARCHAR(100),
    met_person_name VARCHAR(255),
    relationship_with_applicant VARCHAR(100),
    verification_method VARCHAR(50) DEFAULT 'PHYSICAL_VISIT',
    
    -- Verification Outcome
    final_status VARCHAR(50) NOT NULL,
    recommendation_status VARCHAR(50),
    risk_category VARCHAR(20),
    credit_limit DECIMAL(15,2),
    remarks TEXT,
    reason_for_negative TEXT,
    
    -- Property Details (for residence/property verifications)
    property_type VARCHAR(50),
    property_status VARCHAR(50),
    property_value DECIMAL(15,2),
    monthly_rent DECIMAL(10,2),
    total_family_members INTEGER,
    working_members INTEGER,
    
    -- Business Details (for business/office verifications)
    business_name VARCHAR(255),
    business_type VARCHAR(100),
    business_nature VARCHAR(255),
    establishment_year INTEGER,
    gst_number VARCHAR(15),
    business_turnover DECIMAL(15,2),
    number_of_employees INTEGER,
    
    -- Metadata
    raw_data JSONB NOT NULL, -- Complete normalized data structure
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create business_rules table for validation rules
CREATE TABLE IF NOT EXISTS business_rules (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    verification_type JSONB NOT NULL DEFAULT '[]', -- Array of verification types
    rule_type VARCHAR(20) NOT NULL, -- VALIDATION, SCORING, DECISION, WARNING
    priority VARCHAR(10) NOT NULL DEFAULT 'MEDIUM', -- HIGH, MEDIUM, LOW
    condition_logic TEXT NOT NULL, -- Rule condition (JSON Logic or custom)
    action VARCHAR(100) NOT NULL, -- Action to take when rule triggers
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create standardized_addresses table for consistent address handling
CREATE TABLE IF NOT EXISTS standardized_addresses (
    case_id VARCHAR(255) PRIMARY KEY,
    
    -- Standardized address fields
    full_address TEXT NOT NULL,
    house_number VARCHAR(50),
    building_name VARCHAR(255),
    street_name VARCHAR(255),
    locality VARCHAR(255),
    sub_locality VARCHAR(255),
    landmark VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    district VARCHAR(100),
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    country VARCHAR(50) NOT NULL DEFAULT 'India',
    
    -- Address metadata
    address_type VARCHAR(20) NOT NULL, -- RESIDENTIAL, COMMERCIAL, OFFICE, INDUSTRIAL, MIXED
    address_category VARCHAR(20) NOT NULL, -- PERMANENT, CURRENT, OFFICE, BUSINESS, TEMPORARY
    address_quality VARCHAR(20) NOT NULL, -- EXCELLENT, GOOD, AVERAGE, POOR
    is_locatable BOOLEAN NOT NULL DEFAULT true,
    accessibility_rating INTEGER NOT NULL DEFAULT 3, -- 1-5 scale
    
    -- Geographic data
    coordinates JSONB, -- {latitude, longitude, accuracy, source}
    
    -- Verification metadata
    verification_method VARCHAR(20) NOT NULL DEFAULT 'PHYSICAL_VISIT',
    verification_date TIMESTAMP NOT NULL,
    verifier_comments TEXT,
    
    -- Standardization metadata
    original_address TEXT NOT NULL,
    standardization_score INTEGER NOT NULL DEFAULT 0, -- 0-100
    standardization_method VARCHAR(20) NOT NULL DEFAULT 'AUTOMATIC',
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance

-- Normalized form data indexes
CREATE INDEX IF NOT EXISTS idx_normalized_form_data_customer_name ON normalized_form_data(customer_name);
CREATE INDEX IF NOT EXISTS idx_normalized_form_data_customer_phone ON normalized_form_data(customer_phone);
CREATE INDEX IF NOT EXISTS idx_normalized_form_data_customer_email ON normalized_form_data(customer_email);
CREATE INDEX IF NOT EXISTS idx_normalized_form_data_customer_pan ON normalized_form_data(customer_pan);
CREATE INDEX IF NOT EXISTS idx_normalized_form_data_city ON normalized_form_data(city);
CREATE INDEX IF NOT EXISTS idx_normalized_form_data_state ON normalized_form_data(state);
CREATE INDEX IF NOT EXISTS idx_normalized_form_data_pincode ON normalized_form_data(pincode);
CREATE INDEX IF NOT EXISTS idx_normalized_form_data_verification_type ON normalized_form_data(verification_type);
CREATE INDEX IF NOT EXISTS idx_normalized_form_data_verification_date ON normalized_form_data(verification_date);
CREATE INDEX IF NOT EXISTS idx_normalized_form_data_verifier_name ON normalized_form_data(verifier_name);
CREATE INDEX IF NOT EXISTS idx_normalized_form_data_final_status ON normalized_form_data(final_status);
CREATE INDEX IF NOT EXISTS idx_normalized_form_data_risk_category ON normalized_form_data(risk_category);
CREATE INDEX IF NOT EXISTS idx_normalized_form_data_business_name ON normalized_form_data(business_name);
CREATE INDEX IF NOT EXISTS idx_normalized_form_data_gst_number ON normalized_form_data(gst_number);
CREATE INDEX IF NOT EXISTS idx_normalized_form_data_created_at ON normalized_form_data(created_at);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_normalized_form_data_full_text ON normalized_form_data 
USING gin(to_tsvector('english', 
    coalesce(customer_name, '') || ' ' || 
    coalesce(full_address, '') || ' ' || 
    coalesce(business_name, '') || ' ' || 
    coalesce(verifier_name, '')
));

-- Business rules indexes
CREATE INDEX IF NOT EXISTS idx_business_rules_verification_type ON business_rules USING gin(verification_type);
CREATE INDEX IF NOT EXISTS idx_business_rules_rule_type ON business_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_business_rules_priority ON business_rules(priority);
CREATE INDEX IF NOT EXISTS idx_business_rules_is_active ON business_rules(is_active);

-- Standardized addresses indexes
CREATE INDEX IF NOT EXISTS idx_standardized_addresses_city ON standardized_addresses(city);
CREATE INDEX IF NOT EXISTS idx_standardized_addresses_state ON standardized_addresses(state);
CREATE INDEX IF NOT EXISTS idx_standardized_addresses_pincode ON standardized_addresses(pincode);
CREATE INDEX IF NOT EXISTS idx_standardized_addresses_address_type ON standardized_addresses(address_type);
CREATE INDEX IF NOT EXISTS idx_standardized_addresses_address_quality ON standardized_addresses(address_quality);
CREATE INDEX IF NOT EXISTS idx_standardized_addresses_is_locatable ON standardized_addresses(is_locatable);

-- Add foreign key constraints (if cases table exists)
DO $$
BEGIN
    -- Check if cases table exists before adding foreign keys
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cases') THEN
        -- Add foreign key constraint for normalized_form_data
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_normalized_form_data_case_id'
        ) THEN
            ALTER TABLE normalized_form_data 
            ADD CONSTRAINT fk_normalized_form_data_case_id 
            FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;
        END IF;
        
        -- Add foreign key constraint for standardized_addresses
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_standardized_addresses_case_id'
        ) THEN
            ALTER TABLE standardized_addresses 
            ADD CONSTRAINT fk_standardized_addresses_case_id 
            FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Add check constraints
ALTER TABLE normalized_form_data 
ADD CONSTRAINT chk_normalized_form_data_verification_type 
CHECK (verification_type IN ('residence', 'office', 'business', 'builder', 'residence-cum-office', 'dsa-connector', 'property-individual', 'property-apf', 'noc'));

ALTER TABLE normalized_form_data 
ADD CONSTRAINT chk_normalized_form_data_final_status 
CHECK (final_status IN ('POSITIVE', 'NEGATIVE', 'REFER_TO_CREDIT'));

ALTER TABLE normalized_form_data 
ADD CONSTRAINT chk_normalized_form_data_risk_category 
CHECK (risk_category IN ('LOW', 'MEDIUM', 'HIGH'));

ALTER TABLE normalized_form_data 
ADD CONSTRAINT chk_normalized_form_data_customer_age 
CHECK (customer_age IS NULL OR (customer_age >= 18 AND customer_age <= 100));

ALTER TABLE normalized_form_data 
ADD CONSTRAINT chk_normalized_form_data_address_rating 
CHECK (address_rating IS NULL OR (address_rating >= 1 AND address_rating <= 5));

ALTER TABLE business_rules 
ADD CONSTRAINT chk_business_rules_rule_type 
CHECK (rule_type IN ('VALIDATION', 'SCORING', 'DECISION', 'WARNING'));

ALTER TABLE business_rules 
ADD CONSTRAINT chk_business_rules_priority 
CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW'));

ALTER TABLE standardized_addresses 
ADD CONSTRAINT chk_standardized_addresses_address_type 
CHECK (address_type IN ('RESIDENTIAL', 'COMMERCIAL', 'OFFICE', 'INDUSTRIAL', 'MIXED'));

ALTER TABLE standardized_addresses 
ADD CONSTRAINT chk_standardized_addresses_address_category 
CHECK (address_category IN ('PERMANENT', 'CURRENT', 'OFFICE', 'BUSINESS', 'TEMPORARY'));

ALTER TABLE standardized_addresses 
ADD CONSTRAINT chk_standardized_addresses_address_quality 
CHECK (address_quality IN ('EXCELLENT', 'GOOD', 'AVERAGE', 'POOR'));

ALTER TABLE standardized_addresses 
ADD CONSTRAINT chk_standardized_addresses_accessibility_rating 
CHECK (accessibility_rating >= 1 AND accessibility_rating <= 5);

ALTER TABLE standardized_addresses 
ADD CONSTRAINT chk_standardized_addresses_standardization_score 
CHECK (standardization_score >= 0 AND standardization_score <= 100);

-- Create triggers for automatic updated_at updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
DROP TRIGGER IF EXISTS update_normalized_form_data_updated_at ON normalized_form_data;
CREATE TRIGGER update_normalized_form_data_updated_at
    BEFORE UPDATE ON normalized_form_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_business_rules_updated_at ON business_rules;
CREATE TRIGGER update_business_rules_updated_at
    BEFORE UPDATE ON business_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_standardized_addresses_updated_at ON standardized_addresses;
CREATE TRIGGER update_standardized_addresses_updated_at
    BEFORE UPDATE ON standardized_addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample business rules for testing
INSERT INTO business_rules (id, name, description, verification_type, rule_type, priority, condition_logic, action, is_active) VALUES
('ADDR_001', 'Address Locatable Check', 'Address must be easily locatable for positive verification', '["residence", "office", "business"]', 'VALIDATION', 'HIGH', 'addressInfo.addressLocatable === true', 'REQUIRE_ADDRESS_LOCATABLE', true),
('CUST_001', 'Phone Number Validation', 'Phone number must be valid Indian mobile number', '["residence", "office", "business"]', 'VALIDATION', 'HIGH', '/^[6-9]\\d{9}$/.test(customerInfo.phoneNumber)', 'VALIDATE_PHONE_FORMAT', true),
('VERIF_001', 'Person Met Requirement', 'Verifier must have met someone at the address for positive verification', '["residence", "office"]', 'VALIDATION', 'HIGH', 'verificationOutcome.finalStatus !== "POSITIVE" || verificationDetails.metPersonName', 'REQUIRE_PERSON_MET', true),
('CREDIT_001', 'Credit Limit for Negative Cases', 'Credit limit should not be set for negative verifications', '["residence", "office", "business"]', 'VALIDATION', 'HIGH', 'verificationOutcome.finalStatus !== "NEGATIVE" || !verificationOutcome.creditLimit', 'REJECT_CREDIT_FOR_NEGATIVE', true)
ON CONFLICT (id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE normalized_form_data IS 'Normalized and searchable form submission data extracted from raw JSON';
COMMENT ON TABLE business_rules IS 'Configurable business rules for form validation and scoring';
COMMENT ON TABLE standardized_addresses IS 'Standardized address data with consistent field mapping across verification types';

COMMENT ON COLUMN normalized_form_data.raw_data IS 'Complete normalized data structure in JSON format';
COMMENT ON COLUMN business_rules.verification_type IS 'JSON array of verification types this rule applies to';
COMMENT ON COLUMN business_rules.condition_logic IS 'Rule condition logic (JavaScript expression or JSON Logic)';
COMMENT ON COLUMN standardized_addresses.coordinates IS 'GPS coordinates in JSON format {latitude, longitude, accuracy, source}';
COMMENT ON COLUMN standardized_addresses.standardization_score IS 'Quality score of address standardization (0-100)';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON normalized_form_data TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON business_rules TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON standardized_addresses TO your_app_user;
