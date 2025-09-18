-- Complete Case Data Reset Script
-- This script will clean all case-related data and reset sequences

-- Start transaction
BEGIN;

-- 1. Delete all case-related data (in correct order to avoid foreign key constraints)
-- Only delete from tables that exist
DELETE FROM form_submissions;
DELETE FROM verification_attachments;
DELETE FROM attachments WHERE "caseId" IS NOT NULL;
DELETE FROM "auditLogs" WHERE "tableName" = 'cases';
DELETE FROM cases;

-- 2. Reset case ID sequence to start from 1
-- First, find the sequence name for the caseId column
SELECT setval(pg_get_serial_sequence('cases', 'caseId'), 1, false);

-- 3. Clear Redis cache and queues (this will be done via API calls)
-- Note: Redis cleanup will be handled separately via backend API

-- 4. Reset any audit trail sequences if they exist
-- Reset audit log sequence if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'auditLogs_id_seq') THEN
        PERFORM setval('auditLogs_id_seq', 1, false);
    END IF;
END $$;

-- Reset form submissions sequence if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'form_submissions_id_seq') THEN
        PERFORM setval('form_submissions_id_seq', 1, false);
    END IF;
END $$;

-- Reset attachments sequence if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'attachments_id_seq') THEN
        PERFORM setval('attachments_id_seq', 1, false);
    END IF;
END $$;

-- 5. Verify cleanup
SELECT 
    'cases' as table_name, 
    COUNT(*) as remaining_records 
FROM cases
UNION ALL
SELECT
    'auditLogs' as table_name,
    COUNT(*) as remaining_records
FROM "auditLogs" WHERE "tableName" = 'cases'
UNION ALL
SELECT 
    'form_submissions' as table_name, 
    COUNT(*) as remaining_records 
FROM form_submissions
UNION ALL
SELECT 
    'attachments' as table_name, 
    COUNT(*) as remaining_records 
FROM attachments WHERE "caseId" IS NOT NULL;

-- Commit the transaction
COMMIT;

-- Display success message
SELECT 'Case data reset completed successfully. All case-related data has been cleared and sequences reset.' as status;
