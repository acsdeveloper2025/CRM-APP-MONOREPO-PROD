-- Add backend support for operation-based mobile sync retries.
-- Safe, additive, and idempotent migration.

CREATE TABLE IF NOT EXISTS mobile_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL,
  user_id UUID NULL,
  scope TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER NULL,
  response_body JSONB NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idempotency_key, user_id, scope)
);

CREATE INDEX IF NOT EXISTS idx_mobile_idempotency_keys_expires_at
  ON mobile_idempotency_keys (expires_at);

CREATE INDEX IF NOT EXISTS idx_mobile_idempotency_keys_user_id
  ON mobile_idempotency_keys (user_id);

CREATE TABLE IF NOT EXISTS mobile_operation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_operation_log_entity
  ON mobile_operation_log (entity_type, entity_id, created_at);

