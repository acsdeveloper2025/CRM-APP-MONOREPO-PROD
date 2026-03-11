-- Bandwidth-safe sync optimization support.
-- Create an index for attachment update scans used by /api/mobile/sync/changes.
-- Supports both legacy snake_case (updated_at) and current camelCase ("updatedAt") schemas.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'verification_attachments'
      AND column_name = 'updated_at'
  ) THEN
    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_verification_attachments_updated_at
      ON verification_attachments (updated_at)
    ';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'verification_attachments'
      AND column_name = 'updatedAt'
  ) THEN
    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_verification_attachments_updatedAt
      ON verification_attachments ("updatedAt")
    ';
  ELSE
    RAISE NOTICE ''No updated timestamp column found on verification_attachments; index not created.'';
  END IF;
END $$;
