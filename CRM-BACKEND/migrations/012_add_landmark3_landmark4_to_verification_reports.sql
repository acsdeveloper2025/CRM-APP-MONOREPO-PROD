-- Migration: Add landmark3 and landmark4 columns to all verification report tables
-- Created: 2025-10-28
-- Purpose: Add support for 4 landmarks in all verification forms (especially UNTRACEABLE forms)

-- Business Verification Reports
ALTER TABLE "businessVerificationReports" 
ADD COLUMN IF NOT EXISTS landmark3 VARCHAR(255),
ADD COLUMN IF NOT EXISTS landmark4 VARCHAR(255);

COMMENT ON COLUMN "businessVerificationReports".landmark3 IS 'Third landmark for location identification (used in untraceable forms)';
COMMENT ON COLUMN "businessVerificationReports".landmark4 IS 'Fourth landmark for location identification (used in untraceable forms)';

-- Office Verification Reports
ALTER TABLE "officeVerificationReports" 
ADD COLUMN IF NOT EXISTS landmark3 VARCHAR(255),
ADD COLUMN IF NOT EXISTS landmark4 VARCHAR(255);

COMMENT ON COLUMN "officeVerificationReports".landmark3 IS 'Third landmark for location identification (used in untraceable forms)';
COMMENT ON COLUMN "officeVerificationReports".landmark4 IS 'Fourth landmark for location identification (used in untraceable forms)';

-- Residence-cum-Office Verification Reports
ALTER TABLE "residenceCumOfficeVerificationReports" 
ADD COLUMN IF NOT EXISTS landmark3 VARCHAR(255),
ADD COLUMN IF NOT EXISTS landmark4 VARCHAR(255);

COMMENT ON COLUMN "residenceCumOfficeVerificationReports".landmark3 IS 'Third landmark for location identification (used in untraceable forms)';
COMMENT ON COLUMN "residenceCumOfficeVerificationReports".landmark4 IS 'Fourth landmark for location identification (used in untraceable forms)';

-- Builder Verification Reports
ALTER TABLE "builderVerificationReports" 
ADD COLUMN IF NOT EXISTS landmark3 VARCHAR(255),
ADD COLUMN IF NOT EXISTS landmark4 VARCHAR(255);

COMMENT ON COLUMN "builderVerificationReports".landmark3 IS 'Third landmark for location identification (used in untraceable forms)';
COMMENT ON COLUMN "builderVerificationReports".landmark4 IS 'Fourth landmark for location identification (used in untraceable forms)';

-- DSA Connector Verification Reports
ALTER TABLE "dsaConnectorVerificationReports" 
ADD COLUMN IF NOT EXISTS landmark3 VARCHAR(255),
ADD COLUMN IF NOT EXISTS landmark4 VARCHAR(255);

COMMENT ON COLUMN "dsaConnectorVerificationReports".landmark3 IS 'Third landmark for location identification (used in untraceable forms)';
COMMENT ON COLUMN "dsaConnectorVerificationReports".landmark4 IS 'Fourth landmark for location identification (used in untraceable forms)';

-- Property APF Verification Reports
ALTER TABLE "propertyApfVerificationReports" 
ADD COLUMN IF NOT EXISTS landmark3 VARCHAR(255),
ADD COLUMN IF NOT EXISTS landmark4 VARCHAR(255);

COMMENT ON COLUMN "propertyApfVerificationReports".landmark3 IS 'Third landmark for location identification (used in untraceable forms)';
COMMENT ON COLUMN "propertyApfVerificationReports".landmark4 IS 'Fourth landmark for location identification (used in untraceable forms)';

-- Property Individual Verification Reports
ALTER TABLE "propertyIndividualVerificationReports" 
ADD COLUMN IF NOT EXISTS landmark3 VARCHAR(255),
ADD COLUMN IF NOT EXISTS landmark4 VARCHAR(255);

COMMENT ON COLUMN "propertyIndividualVerificationReports".landmark3 IS 'Third landmark for location identification (used in untraceable forms)';
COMMENT ON COLUMN "propertyIndividualVerificationReports".landmark4 IS 'Fourth landmark for location identification (used in untraceable forms)';

-- NOC Verification Reports
ALTER TABLE "nocVerificationReports" 
ADD COLUMN IF NOT EXISTS landmark3 VARCHAR(255),
ADD COLUMN IF NOT EXISTS landmark4 VARCHAR(255);

COMMENT ON COLUMN "nocVerificationReports".landmark3 IS 'Third landmark for location identification (used in untraceable forms)';
COMMENT ON COLUMN "nocVerificationReports".landmark4 IS 'Fourth landmark for location identification (used in untraceable forms)';

-- Note: residenceVerificationReports already has landmark3 and landmark4 columns
-- Verify this with: SELECT column_name FROM information_schema.columns WHERE table_name = 'residenceVerificationReports' AND column_name LIKE 'landmark%';

