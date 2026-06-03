-- Mandatory Backend Review & Finalization — Phase 0 foundation.
-- INERT until the `backend_review_enabled` feature flag is turned on (Phase 6).
-- Idempotent: safe to re-run via the compose migrate gate.
-- Refs: BACKEND_REVIEW_IMPLEMENTATION_PLAN_2026-06-03.md (Rev 2).

BEGIN;

-- 1. Feature-flag kill switch (no pre-existing flag/settings table in this CRM).
CREATE TABLE IF NOT EXISTS feature_flags (
  flag_key    text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT false,
  client_ids  uuid[] NULL,                       -- optional staged enable (NULL = all clients when enabled)
  description text NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO feature_flags (flag_key, enabled, description)
VALUES ('backend_review_enabled', false,
        'Mandatory backend review before a FIELD verification task is completed')
ON CONFLICT (flag_key) DO NOTHING;

-- 2. Backend Final Decision layer (Layer 2). Append-only. NEVER modifies FE data
--    (verification_reports / form_submissions stay immutable). One current row per task.
--    A review ALWAYS records the official Backend Final Result and completes the task.
--    "Needs more verification" is NOT modelled here — it is a separate, existing
--    Revisit (field) / Recheck (KYC) action on the completed task.
CREATE TABLE IF NOT EXISTS task_backend_reviews (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_task_id uuid NOT NULL REFERENCES verification_tasks(id),
  case_id              uuid NOT NULL REFERENCES cases(id),
  fe_submission_id     uuid NULL REFERENCES form_submissions(id),   -- the exact FE submission reviewed (NULL for KYC: no FE layer)
  task_kind            text NOT NULL CHECK (task_kind IN ('FIELD','KYC')),
  backend_final_result text NOT NULL CHECK (backend_final_result IN ('Positive','Negative','Refer','Fraud')),
  backend_remarks      text NOT NULL,
  backend_findings     text NULL,
  backend_observations text NULL,
  backend_recommendation text NULL,
  report_file_path     text NULL,
  report_file_name     text NULL,
  report_storage_key   text NULL,
  report_sha256        text NULL,
  reviewed_by          uuid NOT NULL REFERENCES users(id),
  reviewed_at          timestamptz NOT NULL DEFAULT now(),
  is_current           boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tbr_task ON task_backend_reviews(verification_task_id);
CREATE INDEX IF NOT EXISTS idx_tbr_case ON task_backend_reviews(case_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tbr_task_current
  ON task_backend_reviews(verification_task_id) WHERE is_current;

-- 3. New non-terminal status: SUBMITTED_FOR_REVIEW (FE submitted, awaiting backend decision).
--    Superset of the existing constraint; all current rows still satisfy it.
ALTER TABLE verification_tasks DROP CONSTRAINT IF EXISTS check_status_unified;
ALTER TABLE verification_tasks ADD CONSTRAINT check_status_unified
  CHECK ((status)::text = ANY (ARRAY[
    'PENDING','ASSIGNED','IN_PROGRESS','SUBMITTED_FOR_REVIEW','COMPLETED','REVOKED'
  ]));

-- 4. Status-transition edges for the review gate. The trigger
--    enforce_verification_task_status_transition() reads this table; a missing
--    edge would stall completion (KYC precedent), so add all four up front.
INSERT INTO task_status_transitions (from_status, to_status) VALUES
  ('IN_PROGRESS',          'SUBMITTED_FOR_REVIEW'),
  ('SUBMITTED_FOR_REVIEW', 'COMPLETED'),
  ('SUBMITTED_FOR_REVIEW', 'REVOKED'),
  ('SUBMITTED_FOR_REVIEW', 'IN_PROGRESS')   -- return-to-agent safety
ON CONFLICT (from_status, to_status) DO NOTHING;

-- 5. Unified read of the official Backend result per task (field + KYC).
--    Legacy pre-feature COMPLETED field tasks have no review row -> absent here
--    (callers coalesce to the FE result). FE result is NEVER read from this view.
CREATE OR REPLACE VIEW v_task_finalization AS
  SELECT tbr.verification_task_id,
         'FIELD'::text         AS kind,
         tbr.backend_final_result AS backend_result,
         tbr.reviewed_by,
         tbr.reviewed_at       AS decided_at
    FROM task_backend_reviews tbr
   WHERE tbr.is_current
  UNION ALL
  SELECT kdv.verification_task_id,
         'KYC'::text           AS kind,
         kdv.final_status      AS backend_result,
         kdv.verified_by       AS reviewed_by,
         kdv.verified_at       AS decided_at
    FROM kyc_document_verifications kdv
   WHERE kdv.verification_status = 'COMPLETED'
     AND kdv.deleted_at IS NULL;

COMMIT;
