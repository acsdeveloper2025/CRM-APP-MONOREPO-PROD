-- Migration: Remove hardcoded chk_users_role constraint
-- Role validation is now handled by the RBAC system (roles_v2 table).
-- The hardcoded CHECK constraint blocked creation of any new custom roles.

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
