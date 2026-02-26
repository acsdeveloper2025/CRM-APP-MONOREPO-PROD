BEGIN;

-- Consolidate legacy RBAC roles into canonical roles:
-- ADMIN -> SUPER_ADMIN
-- MANAGER -> BACKEND_USER
-- REPORT_PERSON -> BACKEND_USER
--
-- This migration is idempotent and safe to rerun.

-- Ensure canonical roles exist.
INSERT INTO roles_v2 (name, description, is_system)
VALUES
  ('SUPER_ADMIN', 'System super administrator', true),
  ('BACKEND_USER', 'Backend operations user', true),
  ('FIELD_AGENT', 'Field execution user', true)
ON CONFLICT (name) DO NOTHING;

WITH role_map AS (
  SELECT
    legacy.id AS legacy_role_id,
    legacy.name AS legacy_role_name,
    canonical.id AS canonical_role_id,
    canonical.name AS canonical_role_name
  FROM roles_v2 legacy
  JOIN roles_v2 canonical
    ON canonical.name = CASE
      WHEN legacy.name = 'ADMIN' THEN 'SUPER_ADMIN'
      WHEN legacy.name IN ('MANAGER', 'REPORT_PERSON') THEN 'BACKEND_USER'
      ELSE NULL
    END
  WHERE legacy.name IN ('ADMIN', 'MANAGER', 'REPORT_PERSON')
)
-- Re-parent custom roles that still point to legacy system roles.
UPDATE roles_v2 child
SET parent_role_id = rm.canonical_role_id
FROM role_map rm
WHERE child.parent_role_id = rm.legacy_role_id
  AND child.parent_role_id <> rm.canonical_role_id;

WITH role_map AS (
  SELECT
    legacy.id AS legacy_role_id,
    canonical.id AS canonical_role_id
  FROM roles_v2 legacy
  JOIN roles_v2 canonical
    ON canonical.name = CASE
      WHEN legacy.name = 'ADMIN' THEN 'SUPER_ADMIN'
      WHEN legacy.name IN ('MANAGER', 'REPORT_PERSON') THEN 'BACKEND_USER'
      ELSE NULL
    END
  WHERE legacy.name IN ('ADMIN', 'MANAGER', 'REPORT_PERSON')
)
INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT
  rm.canonical_role_id,
  rp.permission_id,
  BOOL_OR(rp.allowed) as allowed
FROM role_permissions rp
JOIN role_map rm ON rm.legacy_role_id = rp.role_id
GROUP BY rm.canonical_role_id, rp.permission_id
ON CONFLICT (role_id, permission_id)
DO UPDATE SET allowed = role_permissions.allowed OR EXCLUDED.allowed;

WITH role_map AS (
  SELECT
    legacy.id AS legacy_role_id,
    canonical.id AS canonical_role_id
  FROM roles_v2 legacy
  JOIN roles_v2 canonical
    ON canonical.name = CASE
      WHEN legacy.name = 'ADMIN' THEN 'SUPER_ADMIN'
      WHEN legacy.name IN ('MANAGER', 'REPORT_PERSON') THEN 'BACKEND_USER'
      ELSE NULL
    END
  WHERE legacy.name IN ('ADMIN', 'MANAGER', 'REPORT_PERSON')
)
INSERT INTO role_routes (role_id, route_key, allowed)
SELECT
  rm.canonical_role_id,
  rr.route_key,
  BOOL_OR(rr.allowed) as allowed
FROM role_routes rr
JOIN role_map rm ON rm.legacy_role_id = rr.role_id
GROUP BY rm.canonical_role_id, rr.route_key
ON CONFLICT (role_id, route_key)
DO UPDATE SET allowed = role_routes.allowed OR EXCLUDED.allowed;

-- Normalize legacy roles in users table for legacy-compatible reads and exports.
UPDATE users
SET role = CASE
  WHEN role = 'ADMIN' THEN 'SUPER_ADMIN'
  WHEN role IN ('MANAGER', 'REPORT_PERSON') THEN 'BACKEND_USER'
  ELSE role
END
WHERE role IN ('ADMIN', 'MANAGER', 'REPORT_PERSON');

-- Move user_roles assignments from legacy roles to canonical roles.
WITH role_map AS (
  SELECT
    legacy.id AS legacy_role_id,
    canonical.id AS canonical_role_id
  FROM roles_v2 legacy
  JOIN roles_v2 canonical
    ON canonical.name = CASE
      WHEN legacy.name = 'ADMIN' THEN 'SUPER_ADMIN'
      WHEN legacy.name IN ('MANAGER', 'REPORT_PERSON') THEN 'BACKEND_USER'
      ELSE NULL
    END
  WHERE legacy.name IN ('ADMIN', 'MANAGER', 'REPORT_PERSON')
)
INSERT INTO user_roles (user_id, role_id)
SELECT ur.user_id, rm.canonical_role_id
FROM user_roles ur
JOIN role_map rm ON rm.legacy_role_id = ur.role_id
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Ensure canonical user_roles exist for users rows already normalized but missing RBAC linkage.
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles_v2 r ON r.name = u.role
LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.role_id = r.id
WHERE u.role IN ('SUPER_ADMIN', 'BACKEND_USER', 'FIELD_AGENT')
  AND ur.id IS NULL;

-- Remove legacy user-role links now that canonical links exist.
DELETE FROM user_roles ur
USING roles_v2 r
WHERE ur.role_id = r.id
  AND r.name IN ('ADMIN', 'MANAGER', 'REPORT_PERSON');

-- Delete legacy role rows (permissions/routes cascade; user_roles already removed; child parent_role_id repointed).
DELETE FROM roles_v2
WHERE name IN ('ADMIN', 'MANAGER', 'REPORT_PERSON');

COMMIT;
