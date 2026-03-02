CREATE TABLE IF NOT EXISTS task_revocations (
  id BIGSERIAL PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES verification_tasks(id) ON DELETE CASCADE,
  revoked_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  revoked_by_role VARCHAR(16) NOT NULL,
  revoked_from_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  revoke_reason TEXT NOT NULL,
  previous_status VARCHAR(64) NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reassigned BOOLEAN NOT NULL DEFAULT FALSE,
  reassigned_to_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  reassigned_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_revocations_task_id
  ON task_revocations(task_id);

CREATE INDEX IF NOT EXISTS idx_task_revocations_revoked_from_user_id
  ON task_revocations(revoked_from_user_id);

CREATE INDEX IF NOT EXISTS idx_task_revocations_revoked_by_user_id
  ON task_revocations(revoked_by_user_id);

CREATE INDEX IF NOT EXISTS idx_task_revocations_reassigned
  ON task_revocations(reassigned);

CREATE INDEX IF NOT EXISTS idx_task_revocations_revoked_at
  ON task_revocations(revoked_at DESC);

INSERT INTO permissions (id, code, module, description)
SELECT gen_random_uuid(), 'task.revoke', 'task', 'Administrative task revocation'
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE code = 'task.revoke'
);

INSERT INTO role_permissions (id, role_id, permission_id, allowed)
SELECT
  gen_random_uuid(),
  r.id,
  p.id,
  true
FROM roles_v2 r
JOIN permissions p ON p.code = 'task.revoke'
WHERE r.name IN ('SUPER_ADMIN', 'ADMIN', 'BACKEND_USER', 'MANAGER', 'TEAM_LEADER')
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );
