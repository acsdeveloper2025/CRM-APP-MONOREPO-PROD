-- 2026-05-22 — make document_types.is_active dependable for the real
-- Active/Inactive filter on DocumentTypesPage (Page 4 of the
-- filter-standardisation sweep).
--
-- Column was already present (DEFAULT true, nullable). Tightened to NOT NULL +
-- added a covering index. All 59 existing rows = true so the NOT NULL flip is
-- a no-op data-wise.
--
-- Triple-write per feedback_sql_live_db_apply.md.

ALTER TABLE public.document_types
  ALTER COLUMN is_active SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_types_is_active
  ON public.document_types(is_active);
