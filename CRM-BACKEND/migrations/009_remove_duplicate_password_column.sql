-- Migration 009: Remove redundant password column from users table
--
-- The users table has both "password" and "passwordHash" columns.
-- Both always store identical bcrypt hashes. Only "passwordHash" is ever
-- read (for login verification, password change). The "password" column
-- is never read anywhere in the codebase — it is pure dead weight.
--
-- This migration drops the redundant column.

ALTER TABLE users DROP COLUMN IF EXISTS password;

-- Track migration
INSERT INTO schema_migrations (id, filename, executed_at, checksum, success)
VALUES (
  '009',
  '009_remove_duplicate_password_column.sql',
  NOW(),
  'sha256:remove_duplicate_password_column',
  true
)
ON CONFLICT (id) DO NOTHING;
