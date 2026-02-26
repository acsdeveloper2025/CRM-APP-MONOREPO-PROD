BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS team_leader_id uuid NULL,
  ADD COLUMN IF NOT EXISTS manager_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_team_leader_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_team_leader_id_fkey
      FOREIGN KEY (team_leader_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_manager_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_team_leader_id ON users(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id);

INSERT INTO roles_v2 (name, description, is_system)
VALUES
  ('MANAGER', 'Supervisory manager role', true),
  ('TEAM_LEADER', 'Supervisory team leader role', true)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    is_system = true;

-- Legacy roles table is still used by some user CRUD compatibility paths.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'roles'
  ) THEN
    INSERT INTO roles (name)
    SELECT x.name
    FROM (VALUES ('MANAGER'), ('TEAM_LEADER')) AS x(name)
    WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = x.name);
  END IF;
END $$;

-- Sync user_roles for any users already carrying these legacy/canonical names in users.role.
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, rv.id
FROM users u
JOIN roles_v2 rv ON rv.name = u.role
LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.role_id = rv.id
WHERE u.role IN ('MANAGER', 'TEAM_LEADER')
  AND ur.id IS NULL;

WITH grants AS (
  SELECT rv.id AS role_id, p.id AS permission_id, true AS allowed
  FROM roles_v2 rv
  JOIN permissions p ON (
    (rv.name = 'TEAM_LEADER' AND p.code IN (
      'case.view',
      'report.generate',
      'report.download',
      'review.view',
      'dashboard.view',
      'page.dashboard',
      'page.tasks',
      'page.cases',
      'page.reports',
      'page.analytics'
    )) OR
    (rv.name = 'MANAGER' AND p.code IN (
      'case.view',
      'report.generate',
      'report.download',
      'review.view',
      'review.approve',
      'review.rework',
      'dashboard.view',
      'billing.generate',
      'billing.download',
      'page.dashboard',
      'page.tasks',
      'page.cases',
      'page.reports',
      'page.analytics',
      'page.billing'
    ))
  )
)
INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT role_id, permission_id, allowed
FROM grants
ON CONFLICT (role_id, permission_id) DO UPDATE
SET allowed = EXCLUDED.allowed;

COMMIT;
