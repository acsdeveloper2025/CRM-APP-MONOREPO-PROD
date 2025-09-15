-- Migration: Add more missing business verification fields
-- Date: 2025-09-07
-- Description: Add additional missing columns for business verification forms

-- Add missing business verification fields
ALTER TABLE "businessVerificationReports" 
ADD COLUMN applicant_working_premises VARCHAR(255),
ADD COLUMN document_type VARCHAR(100),
ADD COLUMN name_of_tpc1 VARCHAR(255),
ADD COLUMN name_of_tpc2 VARCHAR(255);

-- Add comments for documentation
COMMENT ON COLUMN "businessVerificationReports".applicant_working_premises IS 'Premises where the applicant is working';
COMMENT ON COLUMN "businessVerificationReports".document_type IS 'Type of document shown during verification';
COMMENT ON COLUMN "businessVerificationReports".name_of_tpc1 IS 'Name of first third party contact';
COMMENT ON COLUMN "businessVerificationReports".name_of_tpc2 IS 'Name of second third party contact';
