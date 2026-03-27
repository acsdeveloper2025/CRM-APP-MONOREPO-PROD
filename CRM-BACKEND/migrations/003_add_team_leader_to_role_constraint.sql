-- Migration: Add TEAM_LEADER to users.role check constraint
-- The chk_users_role constraint was missing TEAM_LEADER, causing 500 errors on user creation

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (
  role IN ('SUPER_ADMIN', 'ADMIN', 'BACKEND_USER', 'FIELD_AGENT', 'MANAGER', 'TEAM_LEADER', 'REPORT_PERSON')
);
