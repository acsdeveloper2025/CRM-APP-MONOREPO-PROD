-- Migration 018: Case Data Entry — Multi-Instance + Version Pinning + Audit History
--
-- Sprint 1 of the Case Data Entry audit fix plan. Covers three related
-- schema changes that belong in one migration because they share the
-- same table family and a single refactor pass through the controller:
--
--   1. Multi-instance support  — one case can now hold multiple data
--      entries (Primary Applicant, Co-Applicant, Asset 1, …). Drops
--      UNIQUE(case_id), adds (instance_index, instance_label) with a
--      new composite unique.
--
--   2. Template version pinning — each entry records the exact template
--      version it was filled against, so the save path can hard-reject
--      writes when an admin has published a newer version mid-edit.
--
--   3. Audit history table     — append-only log of every data change
--      on an entry. Required because the CRM operates in a regulated
--      (KYC/finance/insurance) context; every field change must be
--      attributable to a user at a point in time.
--
-- Also, two housekeeping items that are cheap to ship alongside:
--   - Drop the redundant idx_case_data_entries_case (the unique
--     constraint already builds a b-tree on case_id; after this
--     migration, the new composite unique covers (case_id, ...) too).
--   - Add a GIN index on case_data_entries.data so MIS/report queries
--     that filter on JSONB fields do not full-scan.
--
-- Backfill strategy for existing rows:
--   - All current entries become the "Primary" instance (index 0,
--     label 'Primary'). Safe because UNIQUE(case_id) guarantees at
--     most one row per case today.
--   - template_version is backfilled from case_data_templates.version.
--
-- Applied: 2026-04-15

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Multi-instance columns on case_data_entries
-- ---------------------------------------------------------------------------

ALTER TABLE case_data_entries
  ADD COLUMN IF NOT EXISTS instance_index   INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instance_label   VARCHAR(100) NOT NULL DEFAULT 'Primary',
  ADD COLUMN IF NOT EXISTS template_version INTEGER;

-- Backfill template_version for pre-existing rows.
UPDATE case_data_entries e
   SET template_version = t.version
  FROM case_data_templates t
 WHERE e.template_id = t.id
   AND e.template_version IS NULL;

-- Make template_version NOT NULL now that backfill is complete.
ALTER TABLE case_data_entries
  ALTER COLUMN template_version SET NOT NULL;

-- Drop the old single-case unique constraint and the redundant index.
-- The constraint name is the PG default: <table>_<column>_key.
ALTER TABLE case_data_entries
  DROP CONSTRAINT IF EXISTS case_data_entries_case_id_key;

DROP INDEX IF EXISTS idx_case_data_entries_case;

-- New composite unique: one row per (case, instance_index).
ALTER TABLE case_data_entries
  ADD CONSTRAINT case_data_entries_case_instance_uk
  UNIQUE (case_id, instance_index);

-- Index on case_id alone (for "list all instances for this case") is
-- automatically covered by the leading column of the composite unique,
-- so no separate index is needed.

-- Sanity CHECK: instance_index is non-negative.
ALTER TABLE case_data_entries
  ADD CONSTRAINT case_data_entries_instance_index_chk
  CHECK (instance_index >= 0);

-- ---------------------------------------------------------------------------
-- 2. GIN index on JSONB data (reporting prep)
-- ---------------------------------------------------------------------------
-- Not CREATED CONCURRENTLY here because we are inside a BEGIN block.
-- Table is expected to be small during this migration window; if that
-- changes at scale, re-run as a separate CONCURRENTLY migration.

CREATE INDEX IF NOT EXISTS idx_case_data_entries_data_gin
  ON case_data_entries USING GIN (data);

-- ---------------------------------------------------------------------------
-- 3. case_data_entries_history (append-only audit log)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS case_data_entries_history (
  id            BIGSERIAL PRIMARY KEY,
  entry_id      INTEGER  NOT NULL REFERENCES case_data_entries(id) ON DELETE CASCADE,
  case_id       UUID     NOT NULL,
  template_id   INTEGER  NOT NULL,
  template_version INTEGER NOT NULL,
  data          JSONB    NOT NULL,
  change_type   VARCHAR(20) NOT NULL CHECK (
    change_type IN ('CREATE', 'UPDATE', 'COMPLETE', 'REOPEN')
  ),
  changed_by    UUID     NOT NULL REFERENCES users(id),
  changed_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_data_entries_history_entry
  ON case_data_entries_history (entry_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_data_entries_history_case
  ON case_data_entries_history (case_id, changed_at DESC);

COMMIT;
