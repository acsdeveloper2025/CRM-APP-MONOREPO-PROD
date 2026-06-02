-- =====================================================================
-- P2 — KYC completion report attachment (per cycle)
-- Ref: KYC_WORKFLOW_REDESIGN_2026-06-02.md (P2)
-- The backend user may attach the source's reply / report file when completing
-- a KYC document. One report per reverification cycle. Additive, nullable,
-- idempotent. Triple-write: acs_db_final_version.sql + this migration + live DB(s).
-- =====================================================================

ALTER TABLE public.kyc_verification_cycles
  ADD COLUMN IF NOT EXISTS report_file_path   text,
  ADD COLUMN IF NOT EXISTS report_file_name   text,
  ADD COLUMN IF NOT EXISTS report_storage_key text,
  ADD COLUMN IF NOT EXISTS report_sha256      text,
  ADD COLUMN IF NOT EXISTS report_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS report_uploaded_by uuid;
