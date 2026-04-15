-- Migration 017: Performance Indexes
--
-- Adds the five composite indexes called out in the
-- 2026-03-26 performance audit. Each one targets a hot query path
-- where the planner has been falling back to a single-column index
-- + filter, costing 50–100x on tables that have grown past a few
-- hundred thousand rows.
--
-- All indexes are CREATEd with IF NOT EXISTS to make this migration
-- idempotent, and `CONCURRENTLY` so the build does not block writes
-- on the live tables. CONCURRENTLY cannot run inside a transaction,
-- so this file deliberately does NOT wrap in BEGIN/COMMIT.
--
-- Applied: 2026-04-15

-- 1) verification_tasks (assigned_to, status)
-- Hot path: "list of tasks for agent X in status Y". The planner
-- currently picks idx_verification_tasks_assigned_to and filters on
-- status in the heap, which is expensive once an agent has thousands
-- of historical tasks.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_tasks_assigned_to_status
  ON public.verification_tasks USING btree (assigned_to, status);

-- 2) verification_tasks (pincode, status)
-- Hot path: assignment service queries "open tasks in territory pincode P
-- with status PENDING/ASSIGNED" when load-balancing. No matching index
-- exists today (no idx_verification_tasks_pincode at all).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_tasks_pincode_status
  ON public.verification_tasks USING btree (pincode, status)
  WHERE pincode IS NOT NULL;

-- 3) verification_tasks address trigram index
-- Hot path: case search by partial address from the web UI.
-- Without this, ILIKE/SIMILAR-TO scans the table.
-- pg_trgm extension is already installed (see baseline dump).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_tasks_address_trgm
  ON public.verification_tasks USING gin (address public.gin_trgm_ops)
  WHERE address IS NOT NULL;

-- 4) form_submissions (verification_task_id, validation_status)
-- Hot path: "is the latest submission for task T validated yet?"
-- Existing composite is on (form_type, validation_status, submitted_at)
-- which is too wide to satisfy the simpler task lookup.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_submissions_task_status
  ON public.form_submissions USING btree (verification_task_id, validation_status);

-- 5) mobile_device_sync (userId, deviceId)
-- Hot path: every mobile sync request looks up the row for the
-- caller's (userId, deviceId) pair. Existing single-column index on
-- userId still scans an average ~5 device rows per user.
-- NOTE: the table uses quoted camelCase identifiers (legacy schema);
-- the index column list mirrors that.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mobile_device_sync_user_device
  ON public.mobile_device_sync USING btree ("userId", "deviceId");
