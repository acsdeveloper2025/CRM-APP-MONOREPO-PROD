-- Migration 024: RBAC — BACKEND_USER role + TEAM_LEADER permission additions
--
-- Sprint RBAC audit. Creates the BACKEND_USER role for backend office
-- staff and adds missing page permissions to TEAM_LEADER.
--
-- Applied: 2026-04-16

BEGIN;

-- 1. Create BACKEND_USER role
INSERT INTO roles_v2 (name, description, is_system)
VALUES ('BACKEND_USER', 'Backend office staff — data entry, case management, MIS, billing', false)
ON CONFLICT (name) DO NOTHING;

-- 2. Assign 18 permissions to BACKEND_USER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles_v2 r, permissions p
WHERE r.name = 'BACKEND_USER'
  AND p.code IN (
    'page.dashboard', 'page.cases', 'page.tasks', 'page.reports',
    'page.analytics', 'page.billing',
    'case.view', 'case.create', 'case.update', 'case.assign', 'case.reassign',
    'dashboard.view',
    'report.generate', 'report.download',
    'billing.generate', 'billing.download',
    'visit.revisit',
    'review.view'
  )
ON CONFLICT DO NOTHING;

-- 3. Add page.reports + page.kyc + kyc.view to TEAM_LEADER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles_v2 r, permissions p
WHERE r.name = 'TEAM_LEADER'
  AND p.code IN ('page.reports', 'page.kyc', 'kyc.view')
ON CONFLICT DO NOTHING;

COMMIT;
