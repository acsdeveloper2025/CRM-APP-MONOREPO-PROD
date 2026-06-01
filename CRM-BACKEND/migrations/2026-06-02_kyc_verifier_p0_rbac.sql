-- =====================================================================
-- P0 — KYC Verifier read-only RBAC reshape
-- Ref: KYC_VERIFIER_WORKFLOW_AUDIT_2026-06-02.md  §6 (permissions) + §15 Phase 0
-- Idempotent. Triple-write target: acs_db_final_version.sql + this migration + live DB(s).
--
-- Net effect:
--   * 3 new permission codes: kyc.complete, kyc.reverify, kyc.download
--   * KYC_VERIFIER becomes strictly READ-ONLY: loses kyc.verify + kyc.start,
--     gains kyc.download. Keeps case.view, kyc.export, kyc.view, page.kyc.
--   * BACKEND_USER becomes the KYC executor (read + assign + complete + reverify
--     + download). Also TRANSITIONALLY gets kyc.verify + kyc.start because the
--     current /verify + /start routes still gate on those until P2 swaps
--     /verify -> kyc.complete; REMOVE the two transitional grants in P2.
--   * SUPER_ADMIN + MANAGER already hold kyc.verify/kyc.start; gain the 2 new
--     exec perms (kyc.complete, kyc.reverify).
-- Role ids (verified live 2026-06-02):
--   KYC_VERIFIER = 678135c3-561e-478a-a3b6-6123f8babdf8
--   BACKEND_USER = 26202ac1-1e55-4433-b04f-f6e68cc7b3db
-- role_permissions(id uuid default gen_random_uuid(), role_id, permission_id, allowed)
-- UNIQUE (role_id, permission_id); permissions UNIQUE (code).
-- =====================================================================


-- 1. New permission codes ------------------------------------------------
INSERT INTO public.permissions (code, module, description) VALUES
  ('kyc.complete', 'kyc', 'Backend User: enter findings and complete a KYC cycle'),
  ('kyc.reverify', 'kyc', 'Backend User/Manager: open a new billable KYC reverification cycle'),
  ('kyc.download', 'kyc', 'Download assignment/customer docs + KYC package (read-only)')
ON CONFLICT (code) DO NOTHING;

-- 2. KYC_VERIFIER -> strictly read-only ----------------------------------
--    Strip the two mutating/execution grants.
DELETE FROM public.role_permissions
 WHERE role_id = '678135c3-561e-478a-a3b6-6123f8babdf8'
   AND permission_id IN (SELECT id FROM public.permissions WHERE code IN ('kyc.verify','kyc.start'));

--    Grant the read-only download permission.
INSERT INTO public.role_permissions (role_id, permission_id, allowed)
SELECT '678135c3-561e-478a-a3b6-6123f8babdf8', p.id, true
  FROM public.permissions p WHERE p.code = 'kyc.download'
ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = true;

-- 3. BACKEND_USER -> KYC executor ----------------------------------------
--    case.* + report.* already held. kyc.verify + kyc.start are TRANSITIONAL
--    (remove in P2 once /verify gates on kyc.complete).
INSERT INTO public.role_permissions (role_id, permission_id, allowed)
SELECT '26202ac1-1e55-4433-b04f-f6e68cc7b3db', p.id, true
  FROM public.permissions p
 WHERE p.code IN ('kyc.view','page.kyc','kyc.assign','kyc.complete','kyc.reverify','kyc.download','kyc.verify','kyc.start')
ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = true;

-- 4. SUPER_ADMIN + MANAGER -> add the 2 new exec perms -------------------
INSERT INTO public.role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
  FROM public.roles_v2 r
  JOIN public.permissions p ON p.code IN ('kyc.complete','kyc.reverify')
 WHERE r.name IN ('SUPER_ADMIN','MANAGER')
ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = true;

