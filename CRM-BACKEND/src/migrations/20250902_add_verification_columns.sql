-- Add missing verification columns to cases table
-- Migration: 20250902_add_verification_columns.sql

-- Add verification data columns to cases table if they don't exist
DO $$ 
BEGIN
    -- Add verificationData column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cases' AND column_name = 'verificationData'
    ) THEN
        ALTER TABLE cases ADD COLUMN "verificationData" JSONB;
        RAISE NOTICE 'Added verificationData column to cases table';
    ELSE
        RAISE NOTICE 'verificationData column already exists in cases table';
    END IF;

    -- Add verificationType column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cases' AND column_name = 'verificationType'
    ) THEN
        ALTER TABLE cases ADD COLUMN "verificationType" VARCHAR(50);
        RAISE NOTICE 'Added verificationType column to cases table';
    ELSE
        RAISE NOTICE 'verificationType column already exists in cases table';
    END IF;

    -- Add verificationOutcome column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cases' AND column_name = 'verificationOutcome'
    ) THEN
        ALTER TABLE cases ADD COLUMN "verificationOutcome" VARCHAR(50);
        RAISE NOTICE 'Added verificationOutcome column to cases table';
    ELSE
        RAISE NOTICE 'verificationOutcome column already exists in cases table';
    END IF;

    -- Add completedAt column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cases' AND column_name = 'completedAt'
    ) THEN
        ALTER TABLE cases ADD COLUMN "completedAt" TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added completedAt column to cases table';
    ELSE
        RAISE NOTICE 'completedAt column already exists in cases table';
    END IF;
END $$;

-- Create index on verificationType for better query performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_verification_type 
ON cases ("verificationType") 
WHERE "verificationType" IS NOT NULL;

-- Create index on verificationOutcome for better query performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_verification_outcome 
ON cases ("verificationOutcome") 
WHERE "verificationOutcome" IS NOT NULL;

-- Create index on completedAt for better query performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_completed_at 
ON cases ("completedAt") 
WHERE "completedAt" IS NOT NULL;

COMMIT;
