BEGIN;

INSERT INTO permissions (code, module, description) VALUES
  ('page.dashboard', 'page', 'Access Dashboard page'),
  ('page.cases', 'page', 'Access Case Management pages'),
  ('page.tasks', 'page', 'Access Task Management pages'),
  ('page.reports', 'page', 'Access Reports pages'),
  ('page.billing', 'page', 'Access Billing and Commission pages'),
  ('page.users', 'page', 'Access User Management pages'),
  ('page.rbac', 'page', 'Access RBAC Administration page'),
  ('page.settings', 'page', 'Access Settings page'),
  ('page.masterdata', 'page', 'Access Master Data pages'),
  ('page.analytics', 'page', 'Access Analytics and MIS pages')
ON CONFLICT (code) DO NOTHING;

WITH grants AS (
  SELECT rv.id AS role_id, p.id AS permission_id
  FROM roles_v2 rv
  JOIN permissions p ON (
    (rv.name IN ('SUPER_ADMIN', 'ADMIN') AND p.code LIKE 'page.%') OR
    (rv.name = 'BACKEND_USER' AND p.code IN (
      'page.dashboard', 'page.cases', 'page.tasks', 'page.reports'
    )) OR
    (rv.name = 'MANAGER' AND p.code IN (
      'page.dashboard', 'page.tasks', 'page.reports'
    )) OR
    (rv.name = 'REPORT_PERSON' AND p.code IN (
      'page.reports'
    ))
  )
)
INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT role_id, permission_id, true
FROM grants
ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = EXCLUDED.allowed;

COMMIT;
