-- Migration: Create comprehensive DSA/DST Connector verification reports table
-- Date: 2025-09-04
-- Description: Create table for storing all DSA/DST Connector verification form data with comprehensive field coverage

-- Create DSA/DST Connector verification reports table
CREATE TABLE IF NOT EXISTS "dsaConnectorVerificationReports" (
    -- Primary key and case reference
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    "caseId" INTEGER, -- Legacy integer case ID for backward compatibility
    
    -- Form metadata
    form_type VARCHAR(50) NOT NULL DEFAULT 'POSITIVE',
    verification_outcome VARCHAR(50) NOT NULL,
    
    -- Customer information
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    
    -- Address and location
    address_locatable VARCHAR(50),
    address_rating VARCHAR(50),
    full_address TEXT,
    locality VARCHAR(100),
    address_structure VARCHAR(100),
    address_floor VARCHAR(50),
    address_structure_color VARCHAR(50),
    door_color VARCHAR(50),
    landmark1 VARCHAR(255),
    landmark2 VARCHAR(255),
    landmark3 VARCHAR(255),
    landmark4 VARCHAR(255),
    
    -- DSA/DST Connector specific fields
    connector_type VARCHAR(50), -- DSA/DST/Channel Partner
    connector_code VARCHAR(100), -- Unique connector identifier
    connector_name VARCHAR(255),
    connector_designation VARCHAR(100),
    connector_experience INTEGER, -- Years of experience
    connector_status VARCHAR(50), -- Active/Inactive/Suspended
    
    -- Business/Office details
    business_name VARCHAR(255),
    business_type VARCHAR(100), -- Individual/Partnership/Company
    business_registration_number VARCHAR(100),
    business_establishment_year INTEGER,
    office_type VARCHAR(100), -- Owned/Rented/Shared
    office_area DECIMAL(10,2), -- Area in sq ft
    office_rent DECIMAL(10,2), -- Monthly rent if applicable
    
    -- Team and staff details
    total_staff INTEGER,
    sales_staff INTEGER,
    support_staff INTEGER,
    team_size INTEGER,
    monthly_business_volume DECIMAL(15,2),
    average_monthly_sales DECIMAL(15,2),
    
    -- Financial details
    annual_turnover DECIMAL(15,2),
    monthly_income DECIMAL(12,2),
    commission_structure VARCHAR(255),
    payment_terms VARCHAR(255),
    bank_account_details VARCHAR(255),
    
    -- Technology and infrastructure
    computer_systems INTEGER,
    internet_connection VARCHAR(50),
    software_systems VARCHAR(255),
    pos_terminals INTEGER,
    printer_scanner VARCHAR(50),
    
    -- Compliance and documentation
    license_status VARCHAR(50),
    license_number VARCHAR(100),
    license_expiry_date DATE,
    compliance_status VARCHAR(50),
    audit_status VARCHAR(50),
    training_status VARCHAR(50),
    
    -- Met person details
    met_person_name VARCHAR(255),
    met_person_designation VARCHAR(100),
    met_person_relation VARCHAR(100),
    met_person_contact VARCHAR(20),
    
    -- Business verification
    business_operational VARCHAR(50), -- Yes/No
    customer_footfall VARCHAR(100), -- High/Medium/Low
    business_hours VARCHAR(100),
    weekend_operations VARCHAR(50),
    
    -- Third Party Confirmation (TPC)
    tpc_met_person1 VARCHAR(50),
    tpc_name1 VARCHAR(255),
    tpc_confirmation1 VARCHAR(50),
    tpc_met_person2 VARCHAR(50),
    tpc_name2 VARCHAR(255),
    tpc_confirmation2 VARCHAR(50),
    
    -- Shifted specific fields
    shifted_period VARCHAR(100),
    current_location VARCHAR(255),
    premises_status VARCHAR(50),
    previous_business_name VARCHAR(255),
    
    -- Entry restricted specific fields
    entry_restriction_reason VARCHAR(255),
    security_person_name VARCHAR(255),
    security_confirmation VARCHAR(50),
    
    -- Untraceable specific fields
    contact_person VARCHAR(255),
    call_remark VARCHAR(50),
    
    -- Market and competition
    market_presence VARCHAR(100),
    competitor_analysis VARCHAR(255),
    market_reputation VARCHAR(100),
    customer_feedback VARCHAR(100),
    
    -- Area and environment
    political_connection VARCHAR(100),
    dominated_area VARCHAR(100),
    feedback_from_neighbour VARCHAR(100),
    infrastructure_status VARCHAR(100),
    commercial_viability VARCHAR(100),
    
    -- Observations and remarks
    other_observation TEXT,
    business_concerns TEXT,
    operational_challenges TEXT,
    growth_potential TEXT,
    
    -- Status and outcome
    final_status VARCHAR(50) NOT NULL,
    hold_reason TEXT,
    recommendation_status VARCHAR(50),
    risk_assessment VARCHAR(50),
    
    -- Verification metadata
    verification_date DATE NOT NULL DEFAULT CURRENT_DATE,
    verification_time TIME NOT NULL DEFAULT CURRENT_TIME,
    verified_by UUID NOT NULL,
    remarks TEXT,
    total_images INTEGER DEFAULT 0,
    total_selfies INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add comments for documentation
COMMENT ON TABLE "dsaConnectorVerificationReports" IS 'Comprehensive table for storing DSA/DST Connector verification form data from mobile app submissions';
COMMENT ON COLUMN "dsaConnectorVerificationReports".form_type IS 'Type of DSA/DST Connector verification form: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE';
COMMENT ON COLUMN "dsaConnectorVerificationReports".verification_outcome IS 'Maps to verification outcome from case (Positive & Door Locked, Shifted & Door Lock, etc.)';
COMMENT ON COLUMN "dsaConnectorVerificationReports".case_id IS 'UUID reference to the case being verified';
COMMENT ON COLUMN "dsaConnectorVerificationReports".verified_by IS 'UUID of the field agent who performed the verification';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_dsa_connector_verification_case_id" ON "dsaConnectorVerificationReports" (case_id);
CREATE INDEX IF NOT EXISTS "idx_dsa_connector_verification_form_type" ON "dsaConnectorVerificationReports" (form_type);
CREATE INDEX IF NOT EXISTS "idx_dsa_connector_verification_outcome" ON "dsaConnectorVerificationReports" (verification_outcome);
CREATE INDEX IF NOT EXISTS "idx_dsa_connector_verification_final_status" ON "dsaConnectorVerificationReports" (final_status);
CREATE INDEX IF NOT EXISTS "idx_dsa_connector_verification_verification_date" ON "dsaConnectorVerificationReports" (verification_date);
CREATE INDEX IF NOT EXISTS "idx_dsa_connector_verification_verified_by" ON "dsaConnectorVerificationReports" (verified_by);
CREATE INDEX IF NOT EXISTS "idx_dsa_connector_verification_customer_name" ON "dsaConnectorVerificationReports" (customer_name);
CREATE INDEX IF NOT EXISTS "idx_dsa_connector_verification_customer_phone" ON "dsaConnectorVerificationReports" (customer_phone);
CREATE INDEX IF NOT EXISTS "idx_dsa_connector_verification_locality" ON "dsaConnectorVerificationReports" (locality);
CREATE INDEX IF NOT EXISTS "idx_dsa_connector_verification_connector_code" ON "dsaConnectorVerificationReports" (connector_code);
CREATE INDEX IF NOT EXISTS "idx_dsa_connector_verification_connector_name" ON "dsaConnectorVerificationReports" (connector_name);
CREATE INDEX IF NOT EXISTS "idx_dsa_connector_verification_business_name" ON "dsaConnectorVerificationReports" (business_name);
CREATE INDEX IF NOT EXISTS "idx_dsa_connector_verification_connector_type" ON "dsaConnectorVerificationReports" (connector_type);
CREATE INDEX IF NOT EXISTS "idx_dsa_connector_verification_legacy_case_id" ON "dsaConnectorVerificationReports" ("caseId");

-- Add constraints
ALTER TABLE "dsaConnectorVerificationReports" 
ADD CONSTRAINT "chk_dsa_connector_verification_form_type" 
CHECK (form_type IN ('POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED', 'UNTRACEABLE'));

ALTER TABLE "dsaConnectorVerificationReports" 
ADD CONSTRAINT "chk_dsa_connector_verification_final_status" 
CHECK (final_status IN ('Positive', 'Negative', 'Refer', 'Fraud', 'Hold'));

ALTER TABLE "dsaConnectorVerificationReports" 
ADD CONSTRAINT "chk_dsa_connector_verification_connector_experience" 
CHECK (connector_experience IS NULL OR (connector_experience >= 0 AND connector_experience <= 50));

ALTER TABLE "dsaConnectorVerificationReports" 
ADD CONSTRAINT "chk_dsa_connector_verification_establishment_year" 
CHECK (business_establishment_year IS NULL OR (business_establishment_year >= 1900 AND business_establishment_year <= EXTRACT(YEAR FROM CURRENT_DATE)));

ALTER TABLE "dsaConnectorVerificationReports" 
ADD CONSTRAINT "chk_dsa_connector_verification_total_staff" 
CHECK (total_staff IS NULL OR (total_staff >= 1 AND total_staff <= 1000));

ALTER TABLE "dsaConnectorVerificationReports" 
ADD CONSTRAINT "chk_dsa_connector_verification_staff_consistency" 
CHECK (total_staff IS NULL OR (sales_staff + support_staff) <= total_staff);

-- Add foreign key constraints
ALTER TABLE "dsaConnectorVerificationReports" 
ADD CONSTRAINT "fk_dsa_connector_verification_case_id" 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE "dsaConnectorVerificationReports" 
ADD CONSTRAINT "fk_dsa_connector_verification_verified_by" 
FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_dsa_connector_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dsa_connector_verification_updated_at
    BEFORE UPDATE ON "dsaConnectorVerificationReports"
    FOR EACH ROW
    EXECUTE FUNCTION update_dsa_connector_verification_updated_at();
