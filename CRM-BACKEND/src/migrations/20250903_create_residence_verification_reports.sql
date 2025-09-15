-- Migration: Create residenceVerificationReports table
-- Date: 2025-09-03
-- Description: Create dedicated table for residence verification reports

CREATE TABLE IF NOT EXISTS "residenceVerificationReports" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "caseId" UUID NOT NULL,
    "applicantName" VARCHAR(255),
    "applicantPhone" VARCHAR(20),
    "applicantEmail" VARCHAR(255),
    "residenceType" VARCHAR(50) DEFAULT 'HOUSE',
    "ownershipStatus" VARCHAR(50) DEFAULT 'OWNED',
    "monthlyRent" DECIMAL(10,2),
    "landlordName" VARCHAR(255),
    "landlordPhone" VARCHAR(20),
    "residenceSince" DATE,
    "familyMembers" INTEGER,
    "neighborVerification" BOOLEAN DEFAULT false,
    "neighborName" VARCHAR(255),
    "neighborPhone" VARCHAR(20),
    "propertyCondition" TEXT,
    "accessibilityNotes" TEXT,
    "verificationNotes" TEXT,
    "recommendationStatus" VARCHAR(50) DEFAULT 'POSITIVE',
    "verifiedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_residence_verification_reports_case_id 
        FOREIGN KEY ("caseId") REFERENCES cases(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_residence_verification_reports_case_id ON "residenceVerificationReports"("caseId");
CREATE INDEX IF NOT EXISTS idx_residence_verification_reports_applicant_name ON "residenceVerificationReports"("applicantName");
CREATE INDEX IF NOT EXISTS idx_residence_verification_reports_applicant_phone ON "residenceVerificationReports"("applicantPhone");
CREATE INDEX IF NOT EXISTS idx_residence_verification_reports_recommendation_status ON "residenceVerificationReports"("recommendationStatus");
CREATE INDEX IF NOT EXISTS idx_residence_verification_reports_verified_at ON "residenceVerificationReports"("verifiedAt");

-- Add check constraints
ALTER TABLE "residenceVerificationReports" 
ADD CONSTRAINT chk_residence_verification_reports_residence_type 
CHECK ("residenceType" IN ('HOUSE', 'APARTMENT', 'VILLA', 'BUNGALOW', 'FLAT', 'CHAWL', 'SLUM', 'OTHER'));

ALTER TABLE "residenceVerificationReports" 
ADD CONSTRAINT chk_residence_verification_reports_ownership_status 
CHECK ("ownershipStatus" IN ('OWNED', 'RENTED', 'FAMILY_OWNED', 'COMPANY_PROVIDED', 'OTHER'));

ALTER TABLE "residenceVerificationReports" 
ADD CONSTRAINT chk_residence_verification_reports_recommendation_status 
CHECK ("recommendationStatus" IN ('POSITIVE', 'NEGATIVE', 'REFER', 'FRAUD', 'HOLD'));

ALTER TABLE "residenceVerificationReports" 
ADD CONSTRAINT chk_residence_verification_reports_family_members 
CHECK ("familyMembers" IS NULL OR ("familyMembers" >= 1 AND "familyMembers" <= 50));

-- Create trigger for automatic updated_at updates
CREATE OR REPLACE FUNCTION update_residence_verification_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_residence_verification_reports_updated_at ON "residenceVerificationReports";
CREATE TRIGGER update_residence_verification_reports_updated_at
    BEFORE UPDATE ON "residenceVerificationReports"
    FOR EACH ROW
    EXECUTE FUNCTION update_residence_verification_reports_updated_at();

-- Add comments for documentation
COMMENT ON TABLE "residenceVerificationReports" IS 'Dedicated table for residence verification form submissions';
COMMENT ON COLUMN "residenceVerificationReports"."caseId" IS 'Reference to the case being verified';
COMMENT ON COLUMN "residenceVerificationReports"."applicantName" IS 'Name of the applicant being verified';
COMMENT ON COLUMN "residenceVerificationReports"."applicantPhone" IS 'Phone number of the applicant';
COMMENT ON COLUMN "residenceVerificationReports"."residenceType" IS 'Type of residence (HOUSE, APARTMENT, etc.)';
COMMENT ON COLUMN "residenceVerificationReports"."ownershipStatus" IS 'Ownership status (OWNED, RENTED, etc.)';
COMMENT ON COLUMN "residenceVerificationReports"."monthlyRent" IS 'Monthly rent amount if rented';
COMMENT ON COLUMN "residenceVerificationReports"."familyMembers" IS 'Number of family members living at the residence';
COMMENT ON COLUMN "residenceVerificationReports"."neighborVerification" IS 'Whether neighbor verification was conducted';
COMMENT ON COLUMN "residenceVerificationReports"."recommendationStatus" IS 'Final recommendation status';
COMMENT ON COLUMN "residenceVerificationReports"."verifiedAt" IS 'Timestamp when verification was completed';
