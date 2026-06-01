-- =====================================================================
-- P1 — KYC reverification CYCLE schema + assignment_type marker + backfill cycle 1
-- Ref: KYC_VERIFIER_WORKFLOW_AUDIT_2026-06-02.md  §3.2, §3.3, §12, §13 (steps 2-4)
-- Idempotent. NON-DESTRUCTIVE: reads existing KYC rows, never mutates kyc_document_verifications.
-- Does NOT re-key invoice_item_tasks billing uniqueness (that is P4).
-- Triple-write target: acs_db_final_version.sql + this migration + live DB(s).
-- All FK targets verified uuid live 2026-06-02. task_type_enum = {NORMAL,REVISIT,KYC}.
-- =====================================================================


-- 1. Assignment-type marker (additive, nullable; KYC only inferable via task_type today) --
DO $$ BEGIN
  CREATE TYPE public.assignment_type_enum AS ENUM ('FIELD_EXECUTIVE','KYC_VERIFIER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.verification_tasks
  ADD COLUMN IF NOT EXISTS assignment_type public.assignment_type_enum;

UPDATE public.verification_tasks
   SET assignment_type = CASE WHEN task_type = 'KYC'
                              THEN 'KYC_VERIFIER'::public.assignment_type_enum
                              ELSE 'FIELD_EXECUTIVE'::public.assignment_type_enum END
 WHERE assignment_type IS NULL;

-- 2. Reverification cycle table (append-only, per-task; KYC lifecycle lives HERE) --------
CREATE TABLE IF NOT EXISTS public.kyc_verification_cycles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_task_id  uuid NOT NULL REFERENCES public.verification_tasks(id) ON DELETE CASCADE,
  case_id               uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  cycle_number          integer NOT NULL CHECK (cycle_number >= 1),

  -- read-only verifier assignment snapshot
  assigned_verifier_id  uuid REFERENCES public.users(id),
  assigned_by           uuid REFERENCES public.users(id),
  assigned_at           timestamptz,

  -- external-verification lifecycle (off the shared engine, per D1/D5)
  status                varchar(32) NOT NULL DEFAULT 'KYC_ASSIGNED',
  report_received_at    timestamptz,

  -- backend-user completion snapshot (the actual executor)
  completed_by          uuid REFERENCES public.users(id),
  completed_at          timestamptz,
  final_status          varchar(20),

  -- per-cycle billing snapshot (billing re-key to this is P4)
  rate_amount           numeric(10,2),
  billable              boolean NOT NULL DEFAULT true,
  billed                boolean NOT NULL DEFAULT false,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_kyc_cycle_per_task UNIQUE (verification_task_id, cycle_number),
  CONSTRAINT chk_kyc_cycle_status CHECK (status = ANY (ARRAY[
    'KYC_ASSIGNED','KYC_IN_EXTERNAL_VERIFICATION','KYC_REPORT_RECEIVED',
    'KYC_COMPLETED','KYC_REASSIGNED'])),
  CONSTRAINT chk_kyc_cycle_final_status CHECK (
    final_status IS NULL OR final_status = ANY (ARRAY['Positive','Negative','Refer','Fraud']))
);
CREATE INDEX IF NOT EXISTS idx_kyc_cycle_task   ON public.kyc_verification_cycles(verification_task_id);
CREATE INDEX IF NOT EXISTS idx_kyc_cycle_case   ON public.kyc_verification_cycles(case_id);
CREATE INDEX IF NOT EXISTS idx_kyc_cycle_status ON public.kyc_verification_cycles(status);
CREATE INDEX IF NOT EXISTS idx_kyc_cycle_unbilled
  ON public.kyc_verification_cycles(billable, billed) WHERE billable = true AND billed = false;

-- 3. Per-document snapshot child (D2: per-doc detail under a per-task cycle) --------------
CREATE TABLE IF NOT EXISTS public.kyc_cycle_documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id            uuid NOT NULL REFERENCES public.kyc_verification_cycles(id) ON DELETE CASCADE,
  kyc_id              uuid NOT NULL REFERENCES public.kyc_document_verifications(id),
  document_type_id    integer,
  final_status        varchar(20),
  document_file_path  text,
  storage_key         text,
  sha256              text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_kyc_cycle_doc UNIQUE (cycle_id, kyc_id)
);
CREATE INDEX IF NOT EXISTS idx_kyc_cycle_docs_cycle ON public.kyc_cycle_documents(cycle_id);

-- 4. Backfill cycle 1 from existing KYC (non-destructive; billed=true if already invoiced) --
INSERT INTO public.kyc_verification_cycles
  (verification_task_id, case_id, cycle_number, assigned_verifier_id, assigned_at,
   status, completed_by, completed_at, final_status, rate_amount, billable, billed)
SELECT vt.id, vt.case_id, 1,
       kdv.assigned_to, kdv.assigned_at,
       CASE WHEN vt.status = 'COMPLETED' THEN 'KYC_COMPLETED' ELSE 'KYC_ASSIGNED' END,
       kdv.verified_by, kdv.verified_at, kdv.final_status,
       COALESCE(vt.actual_amount, vt.estimated_amount, kdv.rate_amount),
       true,
       (iit.id IS NOT NULL)
  FROM public.verification_tasks vt
  JOIN public.kyc_document_verifications kdv ON kdv.verification_task_id = vt.id
  LEFT JOIN public.invoice_item_tasks iit ON iit.verification_task_id = vt.id
 WHERE vt.task_type = 'KYC'
ON CONFLICT (verification_task_id, cycle_number) DO NOTHING;

-- 4b. Backfill per-document snapshot rows for cycle 1
INSERT INTO public.kyc_cycle_documents
  (cycle_id, kyc_id, document_type_id, final_status, document_file_path, storage_key, sha256)
SELECT c.id, kdv.id, kdv.document_type_id, kdv.final_status,
       kdv.document_file_path, kdv.document_storage_key, kdv.sha256_hash
  FROM public.kyc_verification_cycles c
  JOIN public.kyc_document_verifications kdv
    ON kdv.verification_task_id = c.verification_task_id
 WHERE c.cycle_number = 1
ON CONFLICT (cycle_id, kyc_id) DO NOTHING;

