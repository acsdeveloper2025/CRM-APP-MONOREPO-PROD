-- Migration: Add rateTypeId to cases table for rate type assignment
-- Date: 2025-01-12
-- Description: Add rateTypeId field to cases table to support rate type selection during case assignment

-- Add rateTypeId column to cases table
ALTER TABLE cases ADD COLUMN "rateTypeId" INTEGER;

-- Add foreign key constraint to rateTypes table
ALTER TABLE cases ADD CONSTRAINT "fk_cases_rate_type_id" 
  FOREIGN KEY ("rateTypeId") REFERENCES "rateTypes"(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX "idx_cases_rate_type_id" ON cases("rateTypeId");

-- Add comment for documentation
COMMENT ON COLUMN cases."rateTypeId" IS 'Foreign key to rateTypes table for rate calculation and assignment';

-- Update the cases table comment
COMMENT ON TABLE cases IS 'Main cases table with rate type assignment support for financial calculations';
