-- 2026-05-22 — make products.is_active dependable for a real Active/Inactive
-- filter on ProductsPage (Page 2 of the filter-standardisation sweep).
--
-- Column was already present (DEFAULT true, nullable). Tightened to NOT NULL +
-- added a covering index. All 4 existing rows = true so the NOT NULL flip is
-- a no-op data-wise.
--
-- Triple-write per feedback_sql_live_db_apply.md.

ALTER TABLE public.products
  ALTER COLUMN is_active SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_is_active
  ON public.products(is_active);
