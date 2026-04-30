#!/usr/bin/env ts-node

import { adminRoleV2Id, adminUserId, createPool, logger } from './lib/dbAdmin';

const syncSql = `
BEGIN;

-- 2026-04-28 F1.1.1: removed \`role = 'SUPER_ADMIN'\` from this UPDATE
-- because the \`users.role\` text column was dropped. SUPER_ADMIN is
-- enforced via the user_roles INSERT below (which assigns adminRoleV2Id).
UPDATE users
SET "isActive" = TRUE,
    manager_id = NULL,
    team_leader_id = NULL
WHERE id = '${adminUserId}';

DELETE FROM user_roles
WHERE user_id = '${adminUserId}'
  AND role_id <> '${adminRoleV2Id}';

INSERT INTO user_roles (user_id, role_id)
VALUES ('${adminUserId}', '${adminRoleV2Id}')
ON CONFLICT (user_id, role_id) DO NOTHING;

DELETE FROM role_permissions
WHERE role_id = '${adminRoleV2Id}'
  AND permission_id NOT IN (SELECT id FROM permissions);

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT '${adminRoleV2Id}', p.id, TRUE
FROM permissions p
LEFT JOIN role_permissions rp
  ON rp.role_id = '${adminRoleV2Id}'
 AND rp.permission_id = p.id
WHERE rp.id IS NULL;

UPDATE role_permissions
SET allowed = TRUE
WHERE role_id = '${adminRoleV2Id}'
  AND allowed = FALSE;

COMMIT;
`;

async function main(): Promise<void> {
  const pool = createPool();
  try {
    logger.info('Synchronizing canonical Admin role and permissions');
    await pool.query(syncSql);
    logger.info('Admin role synchronization complete');
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
