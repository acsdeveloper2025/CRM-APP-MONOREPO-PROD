-- Backend Review: add SUBMITTED_FOR_REVIEW as a CASE status.
-- A case rolls up to SUBMITTED_FOR_REVIEW when all its field work is submitted/
-- terminal and at least one task is awaiting backend review (no PENDING/ASSIGNED/
-- IN_PROGRESS tasks remain). Lets the office see "submitted, awaiting review"
-- cases separately from active field work. Idempotent.
-- Ref: BACKEND_REVIEW_IMPLEMENTATION_PLAN_2026-06-03.md.

ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS chk_cases_status;
ALTER TABLE public.cases ADD CONSTRAINT chk_cases_status
  CHECK ((status)::text = ANY (ARRAY[
    'PENDING'::varchar,
    'ASSIGNED'::varchar,
    'IN_PROGRESS'::varchar,
    'SUBMITTED_FOR_REVIEW'::varchar,
    'COMPLETED'::varchar,
    'REVOKED'::varchar
  ]::text[]));
