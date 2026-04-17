-- Migration 026: Grant report_template.manage to admin roles
--
-- Migration 025 added the `report_template.manage` permission but did not
-- attach it to any role (mirroring the pattern in migration 016 for
-- `case_data_template.manage`, which was granted via the RBAC UI after
-- the fact). That left the feature unusable out of the box: no role could
-- create or edit PDF report templates.
--
-- This migration grants it to the same roles that currently have
-- `case_data_template.manage` in production — SUPER_ADMIN and MANAGER —
-- so the feature is immediately usable. TEAM_LEADER is intentionally
-- excluded (matching the case_data_template.manage policy) but an
-- administrator can add it later via Settings → RBAC.
--
-- Applied: 2026-04-17

BEGIN;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles_v2 r, permissions p
WHERE r.name IN ('SUPER_ADMIN', 'MANAGER')
  AND p.code = 'report_template.manage'
ON CONFLICT DO NOTHING;

COMMIT;
