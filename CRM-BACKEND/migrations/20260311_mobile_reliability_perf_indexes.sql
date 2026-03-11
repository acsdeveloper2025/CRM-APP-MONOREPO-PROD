-- Performance hardening for mobile sync/idempotency paths.
-- Additive and backward-compatible indexes only.

CREATE INDEX IF NOT EXISTS idx_mobile_idempotency_keys_lookup_active
  ON mobile_idempotency_keys (idempotency_key, user_id, scope, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_verification_attachments_operation_group
  ON verification_attachments ((split_part(operation_id, ':', 1)), "createdAt")
  WHERE operation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_verification_tasks_case_assignee_created_updated
  ON verification_tasks (case_id, assigned_to, created_at DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_cases_updated_at_id
  ON cases ("updatedAt", id);

CREATE INDEX IF NOT EXISTS idx_attachments_case_id_lookup
  ON attachments ("caseId");
