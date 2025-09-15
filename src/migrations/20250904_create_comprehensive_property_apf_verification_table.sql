-- Migration: Create comprehensive Property APF verification reports table
-- Date: 2025-09-04
-- Description: Create table for storing all Property APF verification form data with comprehensive field coverage

-- Create Property APF verification reports table
CREATE TABLE IF NOT EXISTS "propertyApfVerificationReports" (
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
    
    -- Property-specific fields
    property_type VARCHAR(100), -- Residential/Commercial/Industrial
    property_status VARCHAR(50), -- Under Construction/Ready/Occupied
    property_ownership VARCHAR(50), -- Freehold/Leasehold
    property_age INTEGER, -- Age in years
    property_condition VARCHAR(50), -- Excellent/Good/Average/Poor
    property_area DECIMAL(10,2), -- Area in sq ft
    property_value DECIMAL(15,2), -- Property value
    market_value DECIMAL(15,2), -- Current market value
    
    -- APF-specific fields
    apf_status VARCHAR(50), -- Available/Not Available/Pending
    apf_number VARCHAR(100),
    apf_issue_date DATE,
    apf_expiry_date DATE,
    apf_issuing_authority VARCHAR(255),
    apf_validity_status VARCHAR(50), -- Valid/Expired/Invalid
    apf_amount DECIMAL(15,2), -- APF approved amount
    apf_utilized_amount DECIMAL(15,2), -- Amount utilized
    apf_balance_amount DECIMAL(15,2), -- Balance amount
    
    -- Project details
    project_name VARCHAR(255),
    project_status VARCHAR(50),
    project_approval_status VARCHAR(50),
    project_completion_percentage INTEGER,
    total_units INTEGER,
    completed_units INTEGER,
    sold_units INTEGER,
    available_units INTEGER,
    possession_status VARCHAR(50),
    
    -- Builder/Developer information
    builder_name VARCHAR(255),
    builder_contact VARCHAR(20),
    developer_name VARCHAR(255),
    developer_contact VARCHAR(20),
    builder_registration_number VARCHAR(100),
    rera_registration_number VARCHAR(100),
    
    -- Financial details
    loan_amount DECIMAL(15,2),
    loan_purpose VARCHAR(255),
    loan_status VARCHAR(50),
    bank_name VARCHAR(255),
    loan_account_number VARCHAR(50),
    emi_amount DECIMAL(10,2),
    
    -- Met person details
    met_person_name VARCHAR(255),
    met_person_designation VARCHAR(100),
    met_person_relation VARCHAR(100),
    met_person_contact VARCHAR(20),
    
    -- Document verification
    document_shown_status VARCHAR(50),
    document_type VARCHAR(255),
    document_verification_status VARCHAR(50),
    
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
    
    -- Entry restricted specific fields
    entry_restriction_reason VARCHAR(255),
    security_person_name VARCHAR(255),
    security_confirmation VARCHAR(50),
    
    -- Untraceable specific fields
    contact_person VARCHAR(255),
    call_remark VARCHAR(50),
    
    -- Legal and compliance
    legal_clearance VARCHAR(50),
    title_clearance VARCHAR(50),
    encumbrance_status VARCHAR(50),
    litigation_status VARCHAR(50),
    
    -- Area and infrastructure
    political_connection VARCHAR(100),
    dominated_area VARCHAR(100),
    feedback_from_neighbour VARCHAR(100),
    infrastructure_status VARCHAR(100),
    road_connectivity VARCHAR(100),
    
    -- Observations and remarks
    other_observation TEXT,
    property_concerns TEXT,
    financial_concerns TEXT,
    
    -- Status and outcome
    final_status VARCHAR(50) NOT NULL,
    hold_reason TEXT,
    recommendation_status VARCHAR(50),
    
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
COMMENT ON TABLE "propertyApfVerificationReports" IS 'Comprehensive table for storing Property APF verification form data from mobile app submissions';
COMMENT ON COLUMN "propertyApfVerificationReports".form_type IS 'Type of Property APF verification form: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE';
COMMENT ON COLUMN "propertyApfVerificationReports".verification_outcome IS 'Maps to verification outcome from case (Positive & Door Locked, Shifted & Door Lock, etc.)';
COMMENT ON COLUMN "propertyApfVerificationReports".case_id IS 'UUID reference to the case being verified';
COMMENT ON COLUMN "propertyApfVerificationReports".verified_by IS 'UUID of the field agent who performed the verification';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_property_apf_verification_case_id" ON "propertyApfVerificationReports" (case_id);
CREATE INDEX IF NOT EXISTS "idx_property_apf_verification_form_type" ON "propertyApfVerificationReports" (form_type);
CREATE INDEX IF NOT EXISTS "idx_property_apf_verification_outcome" ON "propertyApfVerificationReports" (verification_outcome);
CREATE INDEX IF NOT EXISTS "idx_property_apf_verification_final_status" ON "propertyApfVerificationReports" (final_status);
CREATE INDEX IF NOT EXISTS "idx_property_apf_verification_verification_date" ON "propertyApfVerificationReports" (verification_date);
CREATE INDEX IF NOT EXISTS "idx_property_apf_verification_verified_by" ON "propertyApfVerificationReports" (verified_by);
CREATE INDEX IF NOT EXISTS "idx_property_apf_verification_customer_name" ON "propertyApfVerificationReports" (customer_name);
CREATE INDEX IF NOT EXISTS "idx_property_apf_verification_customer_phone" ON "propertyApfVerificationReports" (customer_phone);
CREATE INDEX IF NOT EXISTS "idx_property_apf_verification_locality" ON "propertyApfVerificationReports" (locality);
CREATE INDEX IF NOT EXISTS "idx_property_apf_verification_apf_number" ON "propertyApfVerificationReports" (apf_number);
CREATE INDEX IF NOT EXISTS "idx_property_apf_verification_builder_name" ON "propertyApfVerificationReports" (builder_name);
CREATE INDEX IF NOT EXISTS "idx_property_apf_verification_project_name" ON "propertyApfVerificationReports" (project_name);
CREATE INDEX IF NOT EXISTS "idx_property_apf_verification_property_type" ON "propertyApfVerificationReports" (property_type);
CREATE INDEX IF NOT EXISTS "idx_property_apf_verification_legacy_case_id" ON "propertyApfVerificationReports" ("caseId");

-- Add constraints
ALTER TABLE "propertyApfVerificationReports" 
ADD CONSTRAINT "chk_property_apf_verification_form_type" 
CHECK (form_type IN ('POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED', 'UNTRACEABLE'));

ALTER TABLE "propertyApfVerificationReports" 
ADD CONSTRAINT "chk_property_apf_verification_final_status" 
CHECK (final_status IN ('Positive', 'Negative', 'Refer', 'Fraud', 'Hold'));

ALTER TABLE "propertyApfVerificationReports" 
ADD CONSTRAINT "chk_property_apf_verification_property_age" 
CHECK (property_age IS NULL OR (property_age >= 0 AND property_age <= 100));

ALTER TABLE "propertyApfVerificationReports" 
ADD CONSTRAINT "chk_property_apf_verification_completion_percentage" 
CHECK (project_completion_percentage IS NULL OR (project_completion_percentage >= 0 AND project_completion_percentage <= 100));

ALTER TABLE "propertyApfVerificationReports" 
ADD CONSTRAINT "chk_property_apf_verification_total_units" 
CHECK (total_units IS NULL OR (total_units >= 1 AND total_units <= 10000));

ALTER TABLE "propertyApfVerificationReports" 
ADD CONSTRAINT "chk_property_apf_verification_completed_units" 
CHECK (completed_units IS NULL OR (completed_units >= 0 AND completed_units <= total_units));

-- Add foreign key constraints
ALTER TABLE "propertyApfVerificationReports" 
ADD CONSTRAINT "fk_property_apf_verification_case_id" 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE "propertyApfVerificationReports" 
ADD CONSTRAINT "fk_property_apf_verification_verified_by" 
FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_property_apf_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_property_apf_verification_updated_at
    BEFORE UPDATE ON "propertyApfVerificationReports"
    FOR EACH ROW
    EXECUTE FUNCTION update_property_apf_verification_updated_at();
