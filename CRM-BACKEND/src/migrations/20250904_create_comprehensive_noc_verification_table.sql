-- Migration: Create comprehensive NOC verification reports table
-- Date: 2025-09-04
-- Description: Create table for storing all NOC verification form data with comprehensive field coverage

-- Create NOC verification reports table
CREATE TABLE IF NOT EXISTS "nocVerificationReports" (
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
    
    -- NOC-specific fields
    noc_status VARCHAR(50), -- Available/Not Available/Expired
    noc_type VARCHAR(100), -- Type of NOC (Building, Environmental, etc.)
    noc_number VARCHAR(100),
    noc_issue_date DATE,
    noc_expiry_date DATE,
    noc_issuing_authority VARCHAR(255),
    noc_validity_status VARCHAR(50), -- Valid/Expired/Invalid
    
    -- Property/Project details
    property_type VARCHAR(100),
    project_name VARCHAR(255),
    project_status VARCHAR(50),
    construction_status VARCHAR(50),
    project_approval_status VARCHAR(50),
    total_units INTEGER,
    completed_units INTEGER,
    sold_units INTEGER,
    possession_status VARCHAR(50),
    
    -- Builder/Developer information
    builder_name VARCHAR(255),
    builder_contact VARCHAR(20),
    developer_name VARCHAR(255),
    developer_contact VARCHAR(20),
    builder_registration_number VARCHAR(100),
    
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
    
    -- Environment and compliance
    environmental_clearance VARCHAR(50),
    fire_safety_clearance VARCHAR(50),
    pollution_clearance VARCHAR(50),
    water_connection_status VARCHAR(50),
    electricity_connection_status VARCHAR(50),
    
    -- Area and infrastructure
    political_connection VARCHAR(100),
    dominated_area VARCHAR(100),
    feedback_from_neighbour VARCHAR(100),
    infrastructure_status VARCHAR(100),
    road_connectivity VARCHAR(100),
    
    -- Observations and remarks
    other_observation TEXT,
    compliance_issues TEXT,
    regulatory_concerns TEXT,
    
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
COMMENT ON TABLE "nocVerificationReports" IS 'Comprehensive table for storing NOC verification form data from mobile app submissions';
COMMENT ON COLUMN "nocVerificationReports".form_type IS 'Type of NOC verification form: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE';
COMMENT ON COLUMN "nocVerificationReports".verification_outcome IS 'Maps to verification outcome from case (Positive & Door Locked, Shifted & Door Lock, etc.)';
COMMENT ON COLUMN "nocVerificationReports".case_id IS 'UUID reference to the case being verified';
COMMENT ON COLUMN "nocVerificationReports".verified_by IS 'UUID of the field agent who performed the verification';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_noc_verification_case_id" ON "nocVerificationReports" (case_id);
CREATE INDEX IF NOT EXISTS "idx_noc_verification_form_type" ON "nocVerificationReports" (form_type);
CREATE INDEX IF NOT EXISTS "idx_noc_verification_outcome" ON "nocVerificationReports" (verification_outcome);
CREATE INDEX IF NOT EXISTS "idx_noc_verification_final_status" ON "nocVerificationReports" (final_status);
CREATE INDEX IF NOT EXISTS "idx_noc_verification_verification_date" ON "nocVerificationReports" (verification_date);
CREATE INDEX IF NOT EXISTS "idx_noc_verification_verified_by" ON "nocVerificationReports" (verified_by);
CREATE INDEX IF NOT EXISTS "idx_noc_verification_customer_name" ON "nocVerificationReports" (customer_name);
CREATE INDEX IF NOT EXISTS "idx_noc_verification_customer_phone" ON "nocVerificationReports" (customer_phone);
CREATE INDEX IF NOT EXISTS "idx_noc_verification_locality" ON "nocVerificationReports" (locality);
CREATE INDEX IF NOT EXISTS "idx_noc_verification_noc_number" ON "nocVerificationReports" (noc_number);
CREATE INDEX IF NOT EXISTS "idx_noc_verification_builder_name" ON "nocVerificationReports" (builder_name);
CREATE INDEX IF NOT EXISTS "idx_noc_verification_project_name" ON "nocVerificationReports" (project_name);
CREATE INDEX IF NOT EXISTS "idx_noc_verification_legacy_case_id" ON "nocVerificationReports" ("caseId");

-- Add constraints
ALTER TABLE "nocVerificationReports" 
ADD CONSTRAINT "chk_noc_verification_form_type" 
CHECK (form_type IN ('POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED', 'UNTRACEABLE'));

ALTER TABLE "nocVerificationReports" 
ADD CONSTRAINT "chk_noc_verification_final_status" 
CHECK (final_status IN ('Positive', 'Negative', 'Refer', 'Fraud', 'Hold'));

ALTER TABLE "nocVerificationReports" 
ADD CONSTRAINT "chk_noc_verification_total_units" 
CHECK (total_units IS NULL OR (total_units >= 1 AND total_units <= 10000));

ALTER TABLE "nocVerificationReports" 
ADD CONSTRAINT "chk_noc_verification_completed_units" 
CHECK (completed_units IS NULL OR (completed_units >= 0 AND completed_units <= total_units));

ALTER TABLE "nocVerificationReports" 
ADD CONSTRAINT "chk_noc_verification_sold_units" 
CHECK (sold_units IS NULL OR (sold_units >= 0 AND sold_units <= total_units));

-- Add foreign key constraints
ALTER TABLE "nocVerificationReports" 
ADD CONSTRAINT "fk_noc_verification_case_id" 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE "nocVerificationReports" 
ADD CONSTRAINT "fk_noc_verification_verified_by" 
FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_noc_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_noc_verification_updated_at
    BEFORE UPDATE ON "nocVerificationReports"
    FOR EACH ROW
    EXECUTE FUNCTION update_noc_verification_updated_at();
