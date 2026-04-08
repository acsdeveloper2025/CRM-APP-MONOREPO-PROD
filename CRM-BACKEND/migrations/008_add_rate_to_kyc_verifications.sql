-- Migration 008: Add rate amount to kyc_document_verifications
-- Stores the rate looked up from documentTypeRates at time of KYC task creation

ALTER TABLE kyc_document_verifications ADD COLUMN IF NOT EXISTS rate_amount NUMERIC(10,2);
