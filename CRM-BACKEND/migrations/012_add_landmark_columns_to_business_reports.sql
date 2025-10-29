-- Migration: Add landmark3 and landmark4 columns to businessVerificationReports
-- Created: 2025-10-28
-- Purpose: Add missing landmark columns for UNTRACEABLE form type support

-- Add landmark3 and landmark4 columns to businessVerificationReports table
ALTER TABLE "businessVerificationReports" 
ADD COLUMN IF NOT EXISTS landmark3 VARCHAR(255),
ADD COLUMN IF NOT EXISTS landmark4 VARCHAR(255);

-- Add comments
COMMENT ON COLUMN "businessVerificationReports".landmark3 IS 'Third landmark for location identification (used in UNTRACEABLE forms)';
COMMENT ON COLUMN "businessVerificationReports".landmark4 IS 'Fourth landmark for location identification (used in UNTRACEABLE forms)';

