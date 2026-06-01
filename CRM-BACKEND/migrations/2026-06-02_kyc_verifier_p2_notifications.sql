-- =====================================================================
-- P2 notifications + P0 transitional cleanup
-- Ref: KYC_VERIFIER_WORKFLOW_AUDIT_2026-06-02.md §11 (notifications/timeline)
-- Idempotent. Triple-write: acs_db_final_version.sql + this migration + live DB(s).
-- =====================================================================


-- 1. Cleanup: BACKEND_USER no longer needs kyc.verify — /verify now gates on
--    kyc.complete, and /upload accepts case.create (which BACKEND_USER holds).
DELETE FROM public.role_permissions
 WHERE role_id = '26202ac1-1e55-4433-b04f-f6e68cc7b3db'
   AND permission_id IN (SELECT id FROM public.permissions WHERE code = 'kyc.verify');

-- 2. New notification type KYC_ASSIGNED (fires to the verifier on assign/reverify).
--    These rows also surface on the case-detail notifications timeline.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type::text = ANY (ARRAY[
    'CASE_ASSIGNED','CASE_REASSIGNED','CASE_REMOVED','CASE_COMPLETED','CASE_REVOKED',
    'TASK_REVOKED','TASK_COMPLETED','CASE_APPROVED','CASE_REJECTED',
    'SYSTEM_MAINTENANCE','APP_UPDATE','EMERGENCY_ALERT','TEST',
    'KYC_ASSIGNED'
  ]::text[]));

