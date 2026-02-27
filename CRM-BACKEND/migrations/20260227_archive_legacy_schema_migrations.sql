CREATE TABLE IF NOT EXISTS schema_migrations_legacy_archive (
  id VARCHAR(255) PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP,
  checksum VARCHAR(64) NOT NULL,
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations_legacy_archive (
  id,
  filename,
  executed_at,
  checksum,
  execution_time_ms,
  success
)
SELECT
  id,
  filename,
  executed_at,
  checksum,
  execution_time_ms,
  success
FROM schema_migrations
WHERE filename NOT IN (
  '20260225_rbac_role_routes.sql',
  '20260225_true_rbac.sql',
  '20260226_page_permissions.sql',
  '20260226_rbac_canonical_role_consolidation.sql',
  '20260226_territory_integrity_phase4.sql',
  '20260226_user_hierarchy_roles.sql'
)
ON CONFLICT (id) DO NOTHING;

DELETE FROM schema_migrations
WHERE filename NOT IN (
  '20260225_rbac_role_routes.sql',
  '20260225_true_rbac.sql',
  '20260226_page_permissions.sql',
  '20260226_rbac_canonical_role_consolidation.sql',
  '20260226_territory_integrity_phase4.sql',
  '20260226_user_hierarchy_roles.sql'
);
