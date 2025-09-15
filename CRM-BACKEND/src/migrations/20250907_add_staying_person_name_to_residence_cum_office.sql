-- Migration: Add staying_person_name column to residenceCumOfficeVerificationReports table
-- Date: 2025-09-07
-- Description: Add staying_person_name field to support NSP & Door Lock form submissions

ALTER TABLE "residenceCumOfficeVerificationReports" 
ADD COLUMN staying_person_name VARCHAR(255);

-- Add comment for documentation
COMMENT ON COLUMN "residenceCumOfficeVerificationReports".staying_person_name IS 'Name of the person staying at the residence (different from met_person_name)';
