-- 2026-05-22 — Tighten users.is_active to NOT NULL DEFAULT TRUE for the
-- canonical list-page filter contract (5-card stats + Active/Inactive
-- filter). Triple-write rule per feedback_sql_live_db_apply.md:
--   1. acs_db_final_version.sql dump (edited inline)
--   2. live local docker DB (already applied via docker exec psql)
--   3. this migration file — run on prod via migrate container.
--
-- idx_users_active already exists on is_active (legacy name); kept as-is
-- to avoid an index rename. Pre-existing rows have no NULLs (verified
-- 0 rows before tighten).

BEGIN;

UPDATE public.users SET is_active = TRUE WHERE is_active IS NULL;

ALTER TABLE public.users ALTER COLUMN is_active SET NOT NULL;

COMMIT;
