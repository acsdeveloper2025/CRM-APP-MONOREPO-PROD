-- Fix data inconsistency: Sync case status with verification tasks
-- Date: 2025-12-02

BEGIN;

-- 1. Sync COMPLETED cases
-- If all tasks are COMPLETED, case should be COMPLETED
UPDATE cases c
SET status = 'COMPLETED', "updatedAt" = NOW()
WHERE c.id IN (
    SELECT vt.case_id 
    FROM verification_tasks vt 
    GROUP BY vt.case_id 
    HAVING COUNT(*) = COUNT(CASE WHEN vt.status = 'COMPLETED' THEN 1 END) 
    AND COUNT(*) > 0
) AND c.status != 'COMPLETED';

-- 2. Sync IN_PROGRESS cases
-- If not all completed, but at least one IN_PROGRESS
UPDATE cases c
SET status = 'IN_PROGRESS', "updatedAt" = NOW()
WHERE c.id IN (
    SELECT vt.case_id 
    FROM verification_tasks vt 
    GROUP BY vt.case_id 
    HAVING COUNT(*) > COUNT(CASE WHEN vt.status = 'COMPLETED' THEN 1 END) 
    AND COUNT(CASE WHEN vt.status = 'IN_PROGRESS' THEN 1 END) > 0
) AND c.status != 'IN_PROGRESS';

-- 3. Sync ASSIGNED cases
-- If not all completed/in_progress, but at least one ASSIGNED
UPDATE cases c
SET status = 'ASSIGNED', "updatedAt" = NOW()
WHERE c.id IN (
    SELECT vt.case_id 
    FROM verification_tasks vt 
    GROUP BY vt.case_id 
    HAVING COUNT(*) > COUNT(CASE WHEN vt.status = 'COMPLETED' THEN 1 END) 
    AND COUNT(CASE WHEN vt.status = 'IN_PROGRESS' THEN 1 END) = 0
    AND COUNT(CASE WHEN vt.status = 'ASSIGNED' THEN 1 END) > 0
) AND c.status != 'ASSIGNED';

COMMIT;
