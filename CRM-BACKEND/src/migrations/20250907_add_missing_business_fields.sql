-- Migration: Add missing business verification fields
-- Date: 2025-09-07
-- Description: Add missing columns for business verification forms

-- Add missing business activity and setup fields
ALTER TABLE "businessVerificationReports" 
ADD COLUMN business_activity VARCHAR(255),
ADD COLUMN business_setup VARCHAR(255);

-- Add missing applicant and working fields
ALTER TABLE "businessVerificationReports" 
ADD COLUMN applicant_designation VARCHAR(100),
ADD COLUMN working_period VARCHAR(100),
ADD COLUMN working_status VARCHAR(50);

-- Add comments for documentation
COMMENT ON COLUMN "businessVerificationReports".business_activity IS 'Type of business activity conducted';
COMMENT ON COLUMN "businessVerificationReports".business_setup IS 'Business setup type or configuration';
COMMENT ON COLUMN "businessVerificationReports".applicant_designation IS 'Designation of the applicant in the business';
COMMENT ON COLUMN "businessVerificationReports".working_period IS 'Period of working at the business location';
COMMENT ON COLUMN "businessVerificationReports".working_status IS 'Current working status of the applicant';
