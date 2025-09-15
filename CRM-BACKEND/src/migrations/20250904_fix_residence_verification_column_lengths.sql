-- Migration: Fix column lengths for residence verification reports
-- Date: 2025-09-04
-- Description: Increase column lengths for address_structure and address_floor to accommodate longer values

-- Increase address_structure column length from 10 to 100 characters
ALTER TABLE "residenceVerificationReports" 
ALTER COLUMN address_structure TYPE character varying(100);

-- Increase address_floor column length from 10 to 50 characters  
ALTER TABLE "residenceVerificationReports"
ALTER COLUMN address_floor TYPE character varying(50);

-- Add comment to document the change
COMMENT ON COLUMN "residenceVerificationReports".address_structure IS 'Type of address structure (Independent House, Apartment, etc.) - increased from 10 to 100 chars';
COMMENT ON COLUMN "residenceVerificationReports".address_floor IS 'Floor information (Ground Floor, 1st Floor, etc.) - increased from 10 to 50 chars';

-- Log the migration
INSERT INTO migration_log (migration_name, executed_at, description) 
VALUES (
    '20250904_fix_residence_verification_column_lengths',
    CURRENT_TIMESTAMP,
    'Increased address_structure (10->100) and address_floor (10->50) column lengths for residence verification reports'
) ON CONFLICT (migration_name) DO NOTHING;
