-- 2026-05-22 — make verification_types.is_active dependable for the real
-- Active/Inactive filter on VerificationTypesPage (Page 3 of the
-- filter-standardisation sweep).
--
-- Column was already present (DEFAULT true, nullable). Tightened to NOT NULL +
-- added a covering index. All 9 existing rows = true so the NOT NULL flip is
-- a no-op data-wise.
--
-- Triple-write per feedback_sql_live_db_apply.md.

ALTER TABLE public.verification_types
  ALTER COLUMN is_active SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_verification_types_is_active
  ON public.verification_types(is_active);
