-- Tighten designations.is_active to NOT NULL (default TRUE).
-- Section 2 Designations build (2026-05-24).
-- Departments already had this; mirrors Section 1 filter-sweep don't-regress
-- ("every is_active column on a master-data table should be NOT NULL").

-- Backfill any NULL rows first (verified zero NULLs pre-migration on dev).
UPDATE public.designations SET is_active = TRUE WHERE is_active IS NULL;

ALTER TABLE public.designations
  ALTER COLUMN is_active SET DEFAULT TRUE,
  ALTER COLUMN is_active SET NOT NULL;
