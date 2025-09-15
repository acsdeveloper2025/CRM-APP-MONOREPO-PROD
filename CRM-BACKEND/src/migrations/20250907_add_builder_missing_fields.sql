-- Migration: Add missing builder verification fields
-- Date: 2025-09-07
-- Description: Add missing columns for builder verification forms

-- Add missing builder verification fields
ALTER TABLE "builderVerificationReports" 
ADD COLUMN landmark3 VARCHAR(255),
ADD COLUMN landmark4 VARCHAR(255),
ADD COLUMN applicant_designation VARCHAR(100);

-- Add comments for documentation
COMMENT ON COLUMN "builderVerificationReports".landmark3 IS 'Third landmark near the builder office';
COMMENT ON COLUMN "builderVerificationReports".landmark4 IS 'Fourth landmark near the builder office';
COMMENT ON COLUMN "builderVerificationReports".applicant_designation IS 'Designation of the applicant in the builder company';
