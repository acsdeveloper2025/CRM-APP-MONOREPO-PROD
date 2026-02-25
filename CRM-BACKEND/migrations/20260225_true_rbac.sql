BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(100) UNIQUE NOT NULL,
  module varchar(50) NOT NULL,
  description text
);

CREATE TABLE IF NOT EXISTS roles_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) UNIQUE NOT NULL,
  description text,
  parent_role_id uuid NULL REFERENCES roles_v2(id) ON DELETE SET NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles_v2(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT true,
  UNIQUE (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles_v2(id) ON DELETE CASCADE,
  UNIQUE (user_id, role_id)
);

CREATE OR REPLACE FUNCTION set_updated_at_roles_v2()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_roles_v2_updated_at ON roles_v2;
CREATE TRIGGER trg_roles_v2_updated_at
BEFORE UPDATE ON roles_v2
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_roles_v2();

INSERT INTO permissions (code, module, description) VALUES
  ('case.view', 'case', 'View cases'),
  ('case.create', 'case', 'Create cases'),
  ('case.assign', 'case', 'Assign case/visit'),
  ('case.reassign', 'case', 'Reassign case/visit'),
  ('case.update', 'case', 'Update case'),
  ('case.delete', 'case', 'Delete case'),
  ('visit.start', 'visit', 'Start visit'),
  ('visit.upload', 'visit', 'Upload visit evidence'),
  ('visit.submit', 'visit', 'Submit visit'),
  ('visit.revoke', 'visit', 'Revoke visit'),
  ('visit.revisit', 'visit', 'Create revisit visit'),
  ('review.view', 'review', 'View review'),
  ('review.approve', 'review', 'Approve review'),
  ('review.rework', 'review', 'Send review rework'),
  ('report.generate', 'report', 'Generate report'),
  ('report.download', 'report', 'Download report'),
  ('billing.generate', 'billing', 'Generate billing'),
  ('billing.download', 'billing', 'Download billing'),
  ('billing.approve', 'billing', 'Approve billing'),
  ('user.view', 'user', 'View users'),
  ('user.create', 'user', 'Create users'),
  ('user.update', 'user', 'Update users'),
  ('user.delete', 'user', 'Delete users'),
  ('role.manage', 'user', 'Manage roles'),
  ('permission.manage', 'user', 'Manage permissions'),
  ('territory.assign', 'user', 'Assign territories'),
  ('dashboard.view', 'system', 'View dashboard'),
  ('settings.manage', 'system', 'Manage settings')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles_v2 (name, description, is_system) VALUES
  ('SUPER_ADMIN', 'System super administrator', true),
  ('ADMIN', 'System administrator', true),
  ('BACKEND_USER', 'Backend operations user', true),
  ('MANAGER', 'Manager / reviewer', true),
  ('FIELD_AGENT', 'Field execution user', true),
  ('REPORT_PERSON', 'Report-only user', true)
ON CONFLICT (name) DO NOTHING;

WITH rp AS (
  SELECT r.id AS role_id, p.id AS permission_id
  FROM roles_v2 r
  JOIN permissions p ON (
    (r.name = 'SUPER_ADMIN') OR
    (r.name = 'ADMIN' AND p.code IN (
      'case.view','case.create','case.assign','case.reassign','case.update',
      'visit.start','visit.upload','visit.submit','visit.revoke','visit.revisit',
      'review.view','review.approve','review.rework',
      'report.generate','report.download',
      'billing.generate','billing.download','billing.approve',
      'user.view','user.create','user.update','user.delete',
      'territory.assign','dashboard.view','settings.manage'
    )) OR
    (r.name = 'BACKEND_USER' AND p.code IN (
      'case.view','case.create','case.assign','case.reassign','case.update',
      'visit.start','visit.upload','visit.submit','visit.revoke','visit.revisit',
      'report.generate','report.download','dashboard.view'
    )) OR
    (r.name = 'MANAGER' AND p.code IN (
      'case.view','review.view','review.approve','review.rework',
      'report.generate','report.download','dashboard.view'
    )) OR
    (r.name = 'FIELD_AGENT' AND p.code IN (
      'case.view','visit.start','visit.upload','visit.submit','visit.revoke','visit.revisit','dashboard.view'
    )) OR
    (r.name = 'REPORT_PERSON' AND p.code IN (
      'report.download'
    ))
  )
)
INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT role_id, permission_id, true
FROM rp
ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = EXCLUDED.allowed;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, rv.id
FROM users u
JOIN roles_v2 rv ON rv.name = u.role
LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.role_id = rv.id
WHERE ur.id IS NULL;

COMMIT;
