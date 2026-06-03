-- Mandatory Backend Review — Phase 1 RBAC.
-- New permission gating the field-review FINALIZE endpoint (POST /verification-tasks/:id/finalize).
-- Idempotent. Field agents are NOT granted this (only backend reviewers).
-- Ref: BACKEND_REVIEW_IMPLEMENTATION_PLAN_2026-06-03.md (Rev 2) Phase 1.

-- 1. New permission code.
INSERT INTO public.permissions (code, module, description) VALUES
  ('field_review.complete', 'field_review',
   'Backend User: review a submitted field verification and record the official Backend Final Result')
ON CONFLICT (code) DO NOTHING;

-- 2. Grant to the backend reviewer roles (NOT FIELD_AGENT).
INSERT INTO public.role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
  FROM public.roles_v2 r
  JOIN public.permissions p ON p.code = 'field_review.complete'
 WHERE r.name IN ('BACKEND_USER','MANAGER','SUPER_ADMIN')
ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = true;
