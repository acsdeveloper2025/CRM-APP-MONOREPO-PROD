-- Migration 006: Remove document_type, document_number, document_details from verification_tasks
-- These fields are now handled by the separate kyc_document_verifications table
-- and are no longer needed on the verification_tasks table itself.

ALTER TABLE verification_tasks DROP COLUMN IF EXISTS document_type;
ALTER TABLE verification_tasks DROP COLUMN IF EXISTS document_number;
ALTER TABLE verification_tasks DROP COLUMN IF EXISTS document_details;
