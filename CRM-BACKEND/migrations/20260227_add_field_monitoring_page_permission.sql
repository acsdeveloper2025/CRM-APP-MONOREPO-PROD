BEGIN;

INSERT INTO permissions (code, module, description)
VALUES ('page.field_monitoring', 'page', 'Access Field Executive Monitoring Dashboard')
ON CONFLICT (code) DO NOTHING;

WITH target_roles AS (
  SELECT rv.id AS role_id
  FROM roles_v2 rv
  WHERE rv.name IN ('SUPER_ADMIN', 'ADMIN', 'BACKEND_USER', 'TEAM_LEADER', 'MANAGER')
),
target_permission AS (
  SELECT id AS permission_id
  FROM permissions
  WHERE code = 'page.field_monitoring'
)
INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT tr.role_id, tp.permission_id, true
FROM target_roles tr
CROSS JOIN target_permission tp
ON CONFLICT (role_id, permission_id) DO UPDATE
SET allowed = EXCLUDED.allowed;

COMMIT;
