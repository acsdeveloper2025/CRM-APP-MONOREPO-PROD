-- Migration: Create comprehensive residence verification table for all form types
-- Date: 2025-09-03
-- Description: Single table to handle all residence verification form types with proper field mapping

-- Drop existing table if it exists (backup data first if needed)
DROP TABLE IF EXISTS "residenceVerificationReports" CASCADE;

-- Create comprehensive residence verification table
CREATE TABLE IF NOT EXISTS "residenceVerificationReports" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    "caseId" INTEGER, -- Legacy field for compatibility
    
    -- Form Type and Metadata
    form_type VARCHAR(50) NOT NULL DEFAULT 'POSITIVE', -- POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE
    verification_outcome VARCHAR(50) NOT NULL, -- Maps to verification outcome from case
    
    -- Common Customer Information
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    
    -- Address and Location Fields (Common to all forms)
    address_locatable VARCHAR(50), -- Easy to Locate, Difficult to Locate, etc.
    address_rating VARCHAR(50), -- Excellent, Good, Average, Poor
    full_address TEXT,
    locality VARCHAR(100), -- Tower/Building, Row House, etc.
    address_structure VARCHAR(10), -- Number of floors
    address_floor VARCHAR(10), -- Floor where applicant stays
    address_structure_color VARCHAR(50),
    door_color VARCHAR(50),
    door_nameplate_status VARCHAR(50), -- Sighted, Not Sighted
    name_on_door_plate VARCHAR(255),
    society_nameplate_status VARCHAR(50), -- Sighted, Not Sighted  
    name_on_society_board VARCHAR(255),
    company_nameplate_status VARCHAR(50), -- For residence-cum-office
    name_on_company_board VARCHAR(255),
    landmark1 VARCHAR(255),
    landmark2 VARCHAR(255),
    landmark3 VARCHAR(255), -- For untraceable
    landmark4 VARCHAR(255), -- For untraceable
    
    -- Person Met and Relationship (Positive, Shifted, NSP forms)
    house_status VARCHAR(50), -- Opened, Closed (for Positive/NSP)
    room_status VARCHAR(50), -- Opened, Closed (for Shifted)
    met_person_name VARCHAR(255),
    met_person_relation VARCHAR(50), -- Self, Father, Mother, etc.
    met_person_status VARCHAR(50), -- For shifted/NSP forms
    staying_person_name VARCHAR(255), -- For NSP when house closed
    
    -- Family and Personal Details (Positive form mainly)
    total_family_members INTEGER,
    total_earning DECIMAL(15,2),
    applicant_dob DATE,
    applicant_age INTEGER,
    working_status VARCHAR(50), -- Salaried, Business, House Wife, etc.
    company_name VARCHAR(255),
    staying_period VARCHAR(100),
    staying_status VARCHAR(50), -- On Owned Basis, On Rental Basis, etc.
    approx_area INTEGER,
    
    -- Document Verification (Positive form)
    document_shown_status VARCHAR(50), -- Showed, Not Showed
    document_type VARCHAR(50), -- Aadhar Card, PAN Card, etc.
    
    -- Third Party Confirmation (TPC) - Common to multiple forms
    tpc_met_person1 VARCHAR(50), -- Neighbour, Security, etc.
    tpc_name1 VARCHAR(255),
    tpc_confirmation1 VARCHAR(50), -- Confirmed, Not Confirmed
    tpc_met_person2 VARCHAR(50),
    tpc_name2 VARCHAR(255),
    tpc_confirmation2 VARCHAR(50),
    
    -- Shifted Form Specific Fields
    shifted_period VARCHAR(100), -- How long ago they shifted
    premises_status VARCHAR(50), -- For shifted form
    
    -- Entry Restricted Form Specific Fields
    name_of_met_person VARCHAR(255), -- For entry restricted
    met_person_type VARCHAR(50), -- Security, Neighbour, etc. (for entry restricted)
    met_person_confirmation VARCHAR(50), -- For entry restricted
    applicant_staying_status VARCHAR(50), -- For entry restricted
    
    -- Untraceable Form Specific Fields
    call_remark VARCHAR(50), -- Did Not Pick Up Call, Number Switch Off, etc.
    
    -- Area Assessment (Common to all forms)
    political_connection VARCHAR(100), -- Having Political Connection, Not Having, etc.
    dominated_area VARCHAR(100), -- A Community Dominated, Not a Community Dominated
    feedback_from_neighbour VARCHAR(100), -- No Adverse, Adverse, etc.
    other_observation TEXT,
    
    -- Final Status and Outcome
    final_status VARCHAR(50) NOT NULL, -- Positive, Negative, Refer, Fraud, Hold
    hold_reason TEXT, -- Required when final_status is Hold
    recommendation_status VARCHAR(50), -- Overall recommendation
    
    -- Verification Metadata
    verification_date DATE NOT NULL DEFAULT CURRENT_DATE,
    verification_time TIME NOT NULL DEFAULT CURRENT_TIME,
    verified_by UUID NOT NULL, -- Field agent who verified
    remarks TEXT,
    
    -- Image References (stored in verification_attachments table)
    total_images INTEGER DEFAULT 0,
    total_selfies INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_residence_verification_case_id 
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_residence_verification_verified_by 
        FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_residence_verification_case_id ON "residenceVerificationReports"(case_id);
CREATE INDEX IF NOT EXISTS idx_residence_verification_legacy_case_id ON "residenceVerificationReports"("caseId");
CREATE INDEX IF NOT EXISTS idx_residence_verification_form_type ON "residenceVerificationReports"(form_type);
CREATE INDEX IF NOT EXISTS idx_residence_verification_outcome ON "residenceVerificationReports"(verification_outcome);
CREATE INDEX IF NOT EXISTS idx_residence_verification_customer_name ON "residenceVerificationReports"(customer_name);
CREATE INDEX IF NOT EXISTS idx_residence_verification_customer_phone ON "residenceVerificationReports"(customer_phone);
CREATE INDEX IF NOT EXISTS idx_residence_verification_final_status ON "residenceVerificationReports"(final_status);
CREATE INDEX IF NOT EXISTS idx_residence_verification_verified_by ON "residenceVerificationReports"(verified_by);
CREATE INDEX IF NOT EXISTS idx_residence_verification_verification_date ON "residenceVerificationReports"(verification_date);
CREATE INDEX IF NOT EXISTS idx_residence_verification_locality ON "residenceVerificationReports"(locality);

-- Add check constraints
ALTER TABLE "residenceVerificationReports" 
ADD CONSTRAINT chk_residence_verification_form_type 
CHECK (form_type IN ('POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED', 'UNTRACEABLE'));

ALTER TABLE "residenceVerificationReports" 
ADD CONSTRAINT chk_residence_verification_final_status 
CHECK (final_status IN ('Positive', 'Negative', 'Refer', 'Fraud', 'Hold'));

ALTER TABLE "residenceVerificationReports" 
ADD CONSTRAINT chk_residence_verification_family_members 
CHECK (total_family_members IS NULL OR (total_family_members >= 1 AND total_family_members <= 50));

ALTER TABLE "residenceVerificationReports" 
ADD CONSTRAINT chk_residence_verification_age 
CHECK (applicant_age IS NULL OR (applicant_age >= 18 AND applicant_age <= 100));

-- Create trigger for automatic updated_at updates
CREATE OR REPLACE FUNCTION update_residence_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_residence_verification_updated_at ON "residenceVerificationReports";
CREATE TRIGGER update_residence_verification_updated_at
    BEFORE UPDATE ON "residenceVerificationReports"
    FOR EACH ROW
    EXECUTE FUNCTION update_residence_verification_updated_at();

-- Add comments for documentation
COMMENT ON TABLE "residenceVerificationReports" IS 'Comprehensive table for all residence verification form types (Positive, Shifted, NSP, Entry Restricted, Untraceable)';
COMMENT ON COLUMN "residenceVerificationReports".form_type IS 'Type of residence verification form: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE';
COMMENT ON COLUMN "residenceVerificationReports".verification_outcome IS 'Maps to verification outcome from case (Positive & Door Locked, Shifted & Door Lock, etc.)';
COMMENT ON COLUMN "residenceVerificationReports".case_id IS 'UUID reference to the case being verified';
COMMENT ON COLUMN "residenceVerificationReports"."caseId" IS 'Legacy integer case ID for backward compatibility';
COMMENT ON COLUMN "residenceVerificationReports".total_images IS 'Count of verification images (stored in verification_attachments table)';
COMMENT ON COLUMN "residenceVerificationReports".total_selfies IS 'Count of selfie images (stored in verification_attachments table)';
COMMENT ON COLUMN "residenceVerificationReports".verified_by IS 'UUID of the field agent who performed the verification';
