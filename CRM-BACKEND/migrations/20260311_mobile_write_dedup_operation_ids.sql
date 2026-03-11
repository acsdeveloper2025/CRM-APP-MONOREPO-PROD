-- Reliability hardening: dedupe mobile write operations at DB level.
-- Additive and backward-compatible migration.

ALTER TABLE verification_attachments
ADD COLUMN IF NOT EXISTS operation_id TEXT;

ALTER TABLE locations
ADD COLUMN IF NOT EXISTS operation_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_verification_attachments_operation_id
  ON verification_attachments (operation_id)
  WHERE operation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_locations_operation_id
  ON locations (operation_id)
  WHERE operation_id IS NOT NULL;

