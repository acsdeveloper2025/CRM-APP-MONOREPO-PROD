-- Migration: Create comprehensive Property Individual verification reports table
-- Date: 2025-09-04
-- Description: Create table for storing all Property Individual verification form data with comprehensive field coverage

-- Create Property Individual verification reports table
CREATE TABLE IF NOT EXISTS "propertyIndividualVerificationReports" (
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
    property_type VARCHAR(100), -- Residential/Commercial/Agricultural
    property_status VARCHAR(50), -- Occupied/Vacant/Under Construction
    property_ownership VARCHAR(50), -- Self Owned/Rented/Family Owned
    property_age INTEGER, -- Age in years
    property_condition VARCHAR(50), -- Excellent/Good/Average/Poor
    property_area DECIMAL(10,2), -- Area in sq ft
    property_value DECIMAL(15,2), -- Property value
    market_value DECIMAL(15,2), -- Current market value
    construction_type VARCHAR(100), -- RCC/Brick/Wood etc.
    
    -- Individual owner details
    owner_name VARCHAR(255),
    owner_relation VARCHAR(100), -- Self/Father/Mother/Spouse etc.
    owner_age INTEGER,
    owner_occupation VARCHAR(255),
    owner_income DECIMAL(12,2), -- Monthly income
    years_of_residence INTEGER,
    family_members INTEGER,
    earning_members INTEGER,
    
    -- Property documents
    property_documents VARCHAR(255), -- Sale Deed/Registry/Mutation etc.
    document_verification_status VARCHAR(50),
    title_clear_status VARCHAR(50),
    mutation_status VARCHAR(50),
    tax_payment_status VARCHAR(50),
    
    -- Met person details
    met_person_name VARCHAR(255),
    met_person_designation VARCHAR(100),
    met_person_relation VARCHAR(100),
    met_person_contact VARCHAR(20),
    
    -- Neighbors and locality
    neighbor1_name VARCHAR(255),
    neighbor1_confirmation VARCHAR(50),
    neighbor2_name VARCHAR(255),
    neighbor2_confirmation VARCHAR(50),
    locality_reputation VARCHAR(100),
    
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
    previous_owner_name VARCHAR(255),
    
    -- Entry restricted specific fields
    entry_restriction_reason VARCHAR(255),
    security_person_name VARCHAR(255),
    security_confirmation VARCHAR(50),
    
    -- Untraceable specific fields
    contact_person VARCHAR(255),
    call_remark VARCHAR(50),
    
    -- Legal and financial
    legal_issues VARCHAR(50), -- Any legal disputes
    loan_against_property VARCHAR(50), -- Yes/No
    bank_name VARCHAR(255), -- If loan exists
    loan_amount DECIMAL(15,2), -- Outstanding loan amount
    emi_amount DECIMAL(10,2), -- Monthly EMI
    
    -- Utilities and infrastructure
    electricity_connection VARCHAR(50),
    water_connection VARCHAR(50),
    gas_connection VARCHAR(50),
    internet_connection VARCHAR(50),
    road_connectivity VARCHAR(100),
    public_transport VARCHAR(100),
    
    -- Area and environment
    political_connection VARCHAR(100),
    dominated_area VARCHAR(100),
    feedback_from_neighbour VARCHAR(100),
    infrastructure_status VARCHAR(100),
    safety_security VARCHAR(100),
    
    -- Observations and remarks
    other_observation TEXT,
    property_concerns TEXT,
    verification_challenges TEXT,
    
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
COMMENT ON TABLE "propertyIndividualVerificationReports" IS 'Comprehensive table for storing Property Individual verification form data from mobile app submissions';
COMMENT ON COLUMN "propertyIndividualVerificationReports".form_type IS 'Type of Property Individual verification form: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE';
COMMENT ON COLUMN "propertyIndividualVerificationReports".verification_outcome IS 'Maps to verification outcome from case (Positive & Door Locked, Shifted & Door Lock, etc.)';
COMMENT ON COLUMN "propertyIndividualVerificationReports".case_id IS 'UUID reference to the case being verified';
COMMENT ON COLUMN "propertyIndividualVerificationReports".verified_by IS 'UUID of the field agent who performed the verification';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_property_individual_verification_case_id" ON "propertyIndividualVerificationReports" (case_id);
CREATE INDEX IF NOT EXISTS "idx_property_individual_verification_form_type" ON "propertyIndividualVerificationReports" (form_type);
CREATE INDEX IF NOT EXISTS "idx_property_individual_verification_outcome" ON "propertyIndividualVerificationReports" (verification_outcome);
CREATE INDEX IF NOT EXISTS "idx_property_individual_verification_final_status" ON "propertyIndividualVerificationReports" (final_status);
CREATE INDEX IF NOT EXISTS "idx_property_individual_verification_verification_date" ON "propertyIndividualVerificationReports" (verification_date);
CREATE INDEX IF NOT EXISTS "idx_property_individual_verification_verified_by" ON "propertyIndividualVerificationReports" (verified_by);
CREATE INDEX IF NOT EXISTS "idx_property_individual_verification_customer_name" ON "propertyIndividualVerificationReports" (customer_name);
CREATE INDEX IF NOT EXISTS "idx_property_individual_verification_customer_phone" ON "propertyIndividualVerificationReports" (customer_phone);
CREATE INDEX IF NOT EXISTS "idx_property_individual_verification_locality" ON "propertyIndividualVerificationReports" (locality);
CREATE INDEX IF NOT EXISTS "idx_property_individual_verification_owner_name" ON "propertyIndividualVerificationReports" (owner_name);
CREATE INDEX IF NOT EXISTS "idx_property_individual_verification_property_type" ON "propertyIndividualVerificationReports" (property_type);
CREATE INDEX IF NOT EXISTS "idx_property_individual_verification_legacy_case_id" ON "propertyIndividualVerificationReports" ("caseId");

-- Add constraints
ALTER TABLE "propertyIndividualVerificationReports" 
ADD CONSTRAINT "chk_property_individual_verification_form_type" 
CHECK (form_type IN ('POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED', 'UNTRACEABLE'));

ALTER TABLE "propertyIndividualVerificationReports" 
ADD CONSTRAINT "chk_property_individual_verification_final_status" 
CHECK (final_status IN ('Positive', 'Negative', 'Refer', 'Fraud', 'Hold'));

ALTER TABLE "propertyIndividualVerificationReports" 
ADD CONSTRAINT "chk_property_individual_verification_property_age" 
CHECK (property_age IS NULL OR (property_age >= 0 AND property_age <= 200));

ALTER TABLE "propertyIndividualVerificationReports" 
ADD CONSTRAINT "chk_property_individual_verification_owner_age" 
CHECK (owner_age IS NULL OR (owner_age >= 18 AND owner_age <= 120));

ALTER TABLE "propertyIndividualVerificationReports" 
ADD CONSTRAINT "chk_property_individual_verification_family_members" 
CHECK (family_members IS NULL OR (family_members >= 1 AND family_members <= 50));

ALTER TABLE "propertyIndividualVerificationReports" 
ADD CONSTRAINT "chk_property_individual_verification_earning_members" 
CHECK (earning_members IS NULL OR (earning_members >= 0 AND earning_members <= family_members));

-- Add foreign key constraints
ALTER TABLE "propertyIndividualVerificationReports" 
ADD CONSTRAINT "fk_property_individual_verification_case_id" 
FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE "propertyIndividualVerificationReports" 
ADD CONSTRAINT "fk_property_individual_verification_verified_by" 
FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_property_individual_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_property_individual_verification_updated_at
    BEFORE UPDATE ON "propertyIndividualVerificationReports"
    FOR EACH ROW
    EXECUTE FUNCTION update_property_individual_verification_updated_at();
