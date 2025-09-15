-- Migration: Create comprehensive business verification reports table
-- Date: 2025-09-04
-- Description: Create table for storing all business verification form data with comprehensive field coverage

-- Create business verification reports table
CREATE TABLE IF NOT EXISTS "businessVerificationReports" (
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
    company_nameplate_status VARCHAR(50),
    name_on_company_board VARCHAR(255),
    landmark1 VARCHAR(255),
    landmark2 VARCHAR(255),
    
    -- Business status and details
    business_status VARCHAR(50), -- Opened/Closed
    business_existence VARCHAR(50), -- For NSP forms
    business_type VARCHAR(50),
    ownership_type VARCHAR(50),
    address_status VARCHAR(50),
    company_nature_of_business VARCHAR(255),
    business_period VARCHAR(100),
    establishment_period VARCHAR(100),
    business_approx_area INTEGER,
    staff_strength INTEGER,
    staff_seen INTEGER,
    
    -- Owner/Person details
    met_person_name VARCHAR(255),
    designation VARCHAR(100),
    name_of_company_owners VARCHAR(255),
    owner_name VARCHAR(255),
    business_owner_name VARCHAR(255),
    
    -- Document verification
    document_shown VARCHAR(255),
    
    -- Third Party Confirmation (TPC)
    tpc_met_person1 VARCHAR(50),
    tpc_name1 VARCHAR(255),
    tpc_confirmation1 VARCHAR(50),
    tpc_met_person2 VARCHAR(50),
    tpc_name2 VARCHAR(255),
    tpc_confirmation2 VARCHAR(50),
    
    -- Shifted business specific fields
    shifted_period VARCHAR(100),
    old_business_shifted_period VARCHAR(100),
    current_company_name VARCHAR(255),
    current_company_period VARCHAR(100),
    premises_status VARCHAR(50),
    
    -- Entry restricted specific fields
    name_of_met_person VARCHAR(255),
    met_person_type VARCHAR(50),
    met_person_confirmation VARCHAR(50),
    applicant_working_status VARCHAR(50),
    
    -- Untraceable specific fields
    contact_person VARCHAR(255),
    call_remark VARCHAR(50),
    
    -- Environment and area details
    political_connection VARCHAR(100),
    dominated_area VARCHAR(100),
    feedback_from_neighbour VARCHAR(100),
    other_observation TEXT,
    other_extra_remark TEXT,
    
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
COMMENT ON TABLE "businessVerificationReports" IS 'Comprehensive table for storing business verification form data from mobile app submissions';
COMMENT ON COLUMN "businessVerificationReports".form_type IS 'Type of business verification form: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE';
COMMENT ON COLUMN "businessVerificationReports".verification_outcome IS 'Maps to verification outcome from case (Positive & Door Locked, Shifted & Door Lock, etc.)';
COMMENT ON COLUMN "businessVerificationReports".case_id IS 'UUID reference to the case being verified';
COMMENT ON COLUMN "businessVerificationReports".verified_by IS 'UUID of the field agent who performed the verification';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_business_verification_case_id" ON "businessVerificationReports" (case_id);
CREATE INDEX IF NOT EXISTS "idx_business_verification_form_type" ON "businessVerificationReports" (form_type);
CREATE INDEX IF NOT EXISTS "idx_business_verification_outcome" ON "businessVerificationReports" (verification_outcome);
CREATE INDEX IF NOT EXISTS "idx_business_verification_final_status" ON "businessVerificationReports" (final_status);
CREATE INDEX IF NOT EXISTS "idx_business_verification_verification_date" ON "businessVerificationReports" (verification_date);
CREATE INDEX IF NOT EXISTS "idx_business_verification_verified_by" ON "businessVerificationReports" (verified_by);
CREATE INDEX IF NOT EXISTS "idx_business_verification_customer_name" ON "businessVerificationReports" (customer_name);
CREATE INDEX IF NOT EXISTS "idx_business_verification_customer_phone" ON "businessVerificationReports" (customer_phone);
CREATE INDEX IF NOT EXISTS "idx_business_verification_locality" ON "businessVerificationReports" (locality);
CREATE INDEX IF NOT EXISTS "idx_business_verification_legacy_case_id" ON "businessVerificationReports" ("caseId");

-- Add constraints
ALTER TABLE "businessVerificationReports" 
ADD CONSTRAINT "chk_business_verification_form_type" 
CHECK (form_type IN ('POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED', 'UNTRACEABLE'));

ALTER TABLE "businessVerificationReports" 
ADD CONSTRAINT "chk_business_verification_final_status" 
CHECK (final_status IN ('Positive', 'Negative', 'Refer', 'Fraud', 'Hold'));

ALTER TABLE "businessVerificationReports" 
ADD CONSTRAINT "chk_business_verification_staff_strength" 
CHECK (staff_strength IS NULL OR (staff_strength >= 1 AND staff_strength <= 10000));

ALTER TABLE "businessVerificationReports" 
ADD CONSTRAINT "chk_business_verification_staff_seen" 
CHECK (staff_seen IS NULL OR (staff_seen >= 0 AND staff_seen <= staff_strength));

ALTER TABLE "businessVerificationReports" 
ADD CONSTRAINT "chk_business_verification_business_area" 
CHECK (business_approx_area IS NULL OR (business_approx_area >= 1 AND business_approx_area <= 100000));

-- Add foreign key constraints
ALTER TABLE "businessVerificationReports" 
ADD CONSTRAINT "fk_business_verification_case_id" 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE "businessVerificationReports" 
ADD CONSTRAINT "fk_business_verification_verified_by" 
FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_business_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_business_verification_updated_at
    BEFORE UPDATE ON "businessVerificationReports"
    FOR EACH ROW
    EXECUTE FUNCTION update_business_verification_updated_at();
