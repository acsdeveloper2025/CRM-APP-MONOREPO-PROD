-- Migration: Add Configuration Quarantine System
-- Created: 2026-02-16

-- 1. Add CONFIG_PENDING status to cases table (if using enum)
-- Note: If case status is a string field, this step may not be needed
-- If it's an enum, you'll need to add the new value

-- 2. Create case_configuration_errors table
CREATE TABLE IF NOT EXISTS case_configuration_errors (
  id SERIAL PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  error_code VARCHAR(100) NOT NULL,
  error_message TEXT NOT NULL,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id)
);

-- Index for fast lookup of pending cases
CREATE INDEX IF NOT EXISTS idx_case_config_errors_case_id ON case_configuration_errors(case_id);
CREATE INDEX IF NOT EXISTS idx_case_config_errors_unresolved ON case_configuration_errors(case_id) 
  WHERE resolved_at IS NULL;

-- Add comment for documentation
COMMENT ON TABLE case_configuration_errors IS 
  'Stores configuration validation errors for cases in CONFIG_PENDING state. Used for bulk upload quarantine flow.';

COMMENT ON COLUMN case_configuration_errors.error_details IS 
  'JSON object containing context like clientId, productId, verificationTypeId, pincodeId, areaId';
