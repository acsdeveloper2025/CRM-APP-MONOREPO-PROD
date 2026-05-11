-- ============================================================================
-- Migration: 2026-05-12 billing audit phase 2
-- ============================================================================
--
-- Reconciles local↔remote schema drift after the 2026-05-11 + 2026-05-12
-- billing/invoice/commission/GST audit phases.
--
-- DROPS:
--   1. verification_tasks.cancelled_at / cancelled_by / cancellation_reason
--      (applied to local 2026-05-11 — dead stubs; cancel route writes to
--       revoked_* instead)
--   2. verification_tasks.submitted_at / reviewer_id / reviewed_at / review_notes
--      (applied to local 2026-05-12 — reviewer workflow not wired; 0 writers)
--   3. idx_verification_tasks_cancelled_at / idx_vt_cancelled_by
--      (drop-implicit via column cascade)
--   4. idx_verification_tasks_submitted / idx_verification_tasks_reviewer_id
--      (drop-implicit via column cascade)
--
-- ADDS:
--   (none — schema-only drops)
--
-- DATA IMPACT:
--   All 7 columns were 0-rows-populated in dev/staging/prod as of the
--   2026-05-12 audit. Per `feedback_dev_state_no_assumptions.md`, this was
--   verified by exhaustive grep across BE/FE/Mobile + live DB row count.
--
-- ROLLBACK SAFETY:
--   This migration is ONE-WAY at DB level — re-adding the columns does NOT
--   restore historical data (which was already empty). The TS-type fields
--   were removed in the same code release; re-adding columns without the
--   matching schema interfaces will not break existing code (columns
--   would just be unused again).
--
-- REQUIRED CONFIG (deployed BEFORE running this migration):
--   - SUPPLIER_GST_STATE_CODE env var on the application server.
--     Invoice generation will FAIL LOUD with operator-readable 422 if
--     missing. Set it to a valid 2-digit GST state code (e.g. "27" for
--     Maharashtra) before allowing invoice generation traffic.
--   - GST_RATE_DEFAULT env var (optional, defaults to 18). Standard rate
--     for SAC 9986 services.
--
-- IDEMPOTENT:
--   All DROPs use IF EXISTS — re-running the migration is a no-op once
--   it has applied once. Safe for split deploys and rerun.
--
-- HOW TO APPLY:
--   psql -U acs_user -d acs_db -f migrations/2026-05-12_billing_audit_phase2.sql
--
-- HOW TO VERIFY (post-apply, on remote):
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'verification_tasks'
--     AND column_name IN ('cancelled_at','cancelled_by','cancellation_reason',
--                         'submitted_at','reviewer_id','reviewed_at','review_notes');
--   -- expect 0 rows
--
--   SELECT indexname FROM pg_indexes WHERE tablename = 'verification_tasks'
--     AND indexname LIKE ANY (ARRAY['%cancelled%','%submitted%','%reviewer%']);
--   -- expect 0 rows
--
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Drop dead cancel-mirror columns (2026-05-11 closure)
-- ----------------------------------------------------------------------------
ALTER TABLE public.verification_tasks DROP CONSTRAINT IF EXISTS verification_tasks_cancelled_by_fkey;
DROP INDEX  IF EXISTS public.idx_verification_tasks_cancelled_at;
DROP INDEX  IF EXISTS public.idx_vt_cancelled_by;
ALTER TABLE public.verification_tasks DROP COLUMN IF EXISTS cancelled_at;
ALTER TABLE public.verification_tasks DROP COLUMN IF EXISTS cancelled_by;
ALTER TABLE public.verification_tasks DROP COLUMN IF EXISTS cancellation_reason;

-- ----------------------------------------------------------------------------
-- Drop dead reviewer/SUBMITTED stubs (2026-05-12 closure)
-- ----------------------------------------------------------------------------
ALTER TABLE public.verification_tasks DROP CONSTRAINT IF EXISTS verification_tasks_reviewer_id_fkey;
DROP INDEX  IF EXISTS public.idx_verification_tasks_submitted;
DROP INDEX  IF EXISTS public.idx_verification_tasks_reviewer_id;
ALTER TABLE public.verification_tasks DROP COLUMN IF EXISTS submitted_at;
ALTER TABLE public.verification_tasks DROP COLUMN IF EXISTS reviewer_id;
ALTER TABLE public.verification_tasks DROP COLUMN IF EXISTS reviewed_at;
ALTER TABLE public.verification_tasks DROP COLUMN IF EXISTS review_notes;

-- ----------------------------------------------------------------------------
-- Post-migration sanity probes (these will raise if anything was missed)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  dead_cols int;
BEGIN
  SELECT COUNT(*) INTO dead_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'verification_tasks'
    AND column_name IN (
      'cancelled_at', 'cancelled_by', 'cancellation_reason',
      'submitted_at', 'reviewer_id', 'reviewed_at', 'review_notes'
    );

  IF dead_cols > 0 THEN
    RAISE EXCEPTION
      'Migration 2026-05-12 partial failure: % dead columns still present', dead_cols;
  END IF;
END
$$;

COMMIT;
