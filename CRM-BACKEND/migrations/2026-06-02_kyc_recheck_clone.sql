-- =====================================================================
-- P3 — KYC recheck-clone lineage
-- Ref: KYC_WORKFLOW_REDESIGN_2026-06-02.md (P3)
-- Recheck a COMPLETED KYC doc by CLONING it into a new Pending task (replaces
-- the reverify-cycle path). The new kdv row links back to the original via
-- recheck_of_kyc_id for lineage / MIS reverification counting. Additive,
-- nullable, idempotent. Triple-write: dump + this migration + live DB(s).
-- =====================================================================

ALTER TABLE public.kyc_document_verifications
  ADD COLUMN IF NOT EXISTS recheck_of_kyc_id uuid
    REFERENCES public.kyc_document_verifications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kdv_recheck_of
  ON public.kyc_document_verifications(recheck_of_kyc_id)
  WHERE recheck_of_kyc_id IS NOT NULL;
