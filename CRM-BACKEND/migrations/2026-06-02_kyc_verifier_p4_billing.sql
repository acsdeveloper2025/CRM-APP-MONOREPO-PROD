-- =====================================================================
-- P4 — Per-cycle KYC billing re-key
-- Ref: KYC_VERIFIER_WORKFLOW_AUDIT_2026-06-02.md §3.4, §9
-- Idempotent. Moves the billing-uniqueness from per-task to per-cycle for KYC,
-- while PRESERVING the exact "one invoice line per field task, ever" invariant
-- for NORMAL/REVISIT rows (kyc_cycle_id IS NULL).
-- Triple-write target: acs_db_final_version.sql + this migration + live DB(s).
-- =====================================================================


-- 1. Link an invoice line to a specific KYC cycle (additive; field rows stay NULL)
ALTER TABLE public.invoice_item_tasks
  ADD COLUMN IF NOT EXISTS kyc_cycle_id uuid REFERENCES public.kyc_verification_cycles(id);

-- 2. Backfill existing KYC invoice lines -> their cycle 1 (no-op if none billed yet)
UPDATE public.invoice_item_tasks iit
   SET kyc_cycle_id = c.id
  FROM public.verification_tasks vt
  JOIN public.kyc_verification_cycles c
    ON c.verification_task_id = vt.id AND c.cycle_number = 1
 WHERE iit.verification_task_id = vt.id
   AND vt.task_type = 'KYC'
   AND iit.kyc_cycle_id IS NULL;

-- Mark those backfilled cycles as billed so the new loader won't re-offer them.
UPDATE public.kyc_verification_cycles c
   SET billed = true, updated_at = now()
  FROM public.invoice_item_tasks iit
 WHERE iit.kyc_cycle_id = c.id
   AND c.billed = false;

-- 3. Replace the per-task unique with two partial uniques --------------------
ALTER TABLE public.invoice_item_tasks
  DROP CONSTRAINT IF EXISTS invoice_item_tasks_verification_task_id_key;

-- Field tasks (kyc_cycle_id IS NULL): unchanged "one line per task, ever".
CREATE UNIQUE INDEX IF NOT EXISTS uq_iit_task_when_not_kyc
  ON public.invoice_item_tasks(verification_task_id)
  WHERE kyc_cycle_id IS NULL;

-- KYC cycles: one billing line per cycle.
CREATE UNIQUE INDEX IF NOT EXISTS uq_iit_kyc_cycle
  ON public.invoice_item_tasks(kyc_cycle_id)
  WHERE kyc_cycle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_item_tasks_kyc_cycle
  ON public.invoice_item_tasks(kyc_cycle_id);

