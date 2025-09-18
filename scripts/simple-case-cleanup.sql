-- Simple Case Data Cleanup Script
-- This script will clean all case-related data and reset sequences
-- No transactions to avoid rollback on errors

-- 1. Delete all case-related data (in correct order to avoid foreign key constraints)
DELETE FROM form_submissions;
DELETE FROM verification_attachments;
DELETE FROM attachments WHERE "caseId" IS NOT NULL;
DELETE FROM "auditLogs" WHERE "entityType" = 'cases';
DELETE FROM cases;

-- 2. Reset case ID sequence to start from 1
SELECT setval(pg_get_serial_sequence('cases', 'caseId'), 1, false);

-- 3. Reset other sequences if they exist
SELECT setval('"auditLogs_temp_id_seq"', 1, false);
SELECT setval('form_submissions_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'form_submissions_id_seq');
SELECT setval('attachments_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'attachments_id_seq');

-- 4. Verify cleanup
SELECT 
    'cases' as table_name, 
    COUNT(*) as remaining_records 
FROM cases
UNION ALL
SELECT 
    'auditLogs (cases)' as table_name, 
    COUNT(*) as remaining_records 
FROM "auditLogs" WHERE "entityType" = 'cases'
UNION ALL
SELECT 
    'form_submissions' as table_name, 
    COUNT(*) as remaining_records 
FROM form_submissions
UNION ALL
SELECT 
    'attachments (with caseId)' as table_name, 
    COUNT(*) as remaining_records 
FROM attachments WHERE "caseId" IS NOT NULL;

-- Display success message
SELECT 'Case data cleanup completed successfully. All case-related data has been cleared and sequences reset.' as status;
