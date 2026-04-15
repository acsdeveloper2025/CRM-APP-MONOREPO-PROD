-- Migration 019: Case Data Values — normalized reporting projection
--
-- Sprint 3 of the Case Data Entry audit fix plan. Introduces a derived
-- projection of the JSONB `case_data_entries.data` column into a
-- per-(entry,field) row with typed columns. The projection is populated
-- automatically by a trigger on case_data_entries so it stays in sync
-- without any application-side discipline.
--
-- Why this exists:
--   The flexible `data JSONB` write path is ideal for client-specific
--   dynamic forms but hostile to MIS / billing / dashboard queries
--   ("how many cases this month had loan_amount > 50L for Client X"),
--   which need typed comparisons and indexable columns. Reports point
--   at this projection; the source of truth remains JSONB, so the
--   projection can always be rebuilt from scratch.
--
-- What this migration adds:
--   1. case_data_values table (entry_id, template_field_id, field_key,
--      field_type, case_id, value_text, value_number, value_date,
--      value_boolean, value_json). Primary key (entry_id, template_field_id)
--      means re-saving an entry upserts cleanly.
--   2. Per-type partial indexes so reports on any single column are
--      b-tree fast without bloating write cost.
--   3. safe_to_numeric() and safe_to_date() IMMUTABLE helpers that
--      swallow cast errors — a stray "abc" in a NUMBER cell must NEVER
--      abort the owning case_data_entries INSERT/UPDATE.
--   4. sync_case_data_values() trigger function + AFTER INSERT/UPDATE
--      trigger on case_data_entries.
--   5. One-shot backfill (no-op in dev where no entries exist).
--
-- Applied: 2026-04-15

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. case_data_values — the projection
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS case_data_values (
  entry_id          INTEGER      NOT NULL REFERENCES case_data_entries(id) ON DELETE CASCADE,
  template_field_id INTEGER      NOT NULL REFERENCES case_data_template_fields(id) ON DELETE CASCADE,
  field_key         VARCHAR(100) NOT NULL,
  field_type        VARCHAR(50)  NOT NULL,
  case_id           UUID         NOT NULL,

  -- Exactly one of these is populated per row (except MULTISELECT which
  -- uses value_json). Extraction logic lives in sync_case_data_values().
  value_text        TEXT,
  value_number      NUMERIC,
  value_date        DATE,
  value_boolean     BOOLEAN,
  value_json        JSONB,

  PRIMARY KEY (entry_id, template_field_id)
);

-- Per-case lookup: "show me every field value for case X". Covers the
-- "case detail" read path without an extra JOIN to case_data_entries.
CREATE INDEX IF NOT EXISTS idx_case_data_values_case
  ON case_data_values (case_id);

-- Reporting indexes. Partial on the relevant value column so each
-- index only stores rows where that typed value matters.
CREATE INDEX IF NOT EXISTS idx_case_data_values_field_text
  ON case_data_values (field_key, value_text) WHERE value_text IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_case_data_values_field_number
  ON case_data_values (field_key, value_number) WHERE value_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_case_data_values_field_date
  ON case_data_values (field_key, value_date) WHERE value_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_case_data_values_field_boolean
  ON case_data_values (field_key, value_boolean) WHERE value_boolean IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Safe-cast helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION safe_to_numeric(t TEXT) RETURNS NUMERIC AS $$
BEGIN
  RETURN t::NUMERIC;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION safe_to_date(t TEXT) RETURNS DATE AS $$
BEGIN
  RETURN t::DATE;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ---------------------------------------------------------------------------
-- 3. Trigger function: project JSONB `data` into case_data_values
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_case_data_values() RETURNS TRIGGER AS $$
DECLARE
  field_rec RECORD;
  key_value JSONB;
  text_val  TEXT;
BEGIN
  -- On UPDATE, wipe existing projection rows for this entry. Simpler
  -- than diffing field-by-field; the set of rows is small (one per
  -- template field) so DELETE + INSERT is cheap.
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM case_data_values WHERE entry_id = NEW.id;
  END IF;

  -- Project each active field defined on the entry's template. Fields
  -- with no value in NEW.data are skipped (projection reflects what was
  -- actually entered, not every possible field).
  FOR field_rec IN
    SELECT tf.id AS template_field_id, tf.field_key, tf.field_type
      FROM case_data_template_fields tf
     WHERE tf.template_id = NEW.template_id
       AND tf.is_active = true
  LOOP
    IF NEW.data ? field_rec.field_key THEN
      key_value := NEW.data -> field_rec.field_key;
      -- Skip JSON null — same semantics as "field not entered".
      IF jsonb_typeof(key_value) = 'null' THEN
        CONTINUE;
      END IF;

      -- Unquoted textual representation: "hello" → hello, 42 → 42,
      -- true → true, ["a","b"] → ["a","b"]. Used for TEXT/TEXTAREA/SELECT
      -- and as input to safe_to_numeric / safe_to_date.
      text_val := key_value #>> '{}';

      INSERT INTO case_data_values
        (entry_id, template_field_id, field_key, field_type, case_id,
         value_text, value_number, value_date, value_boolean, value_json)
      VALUES (
        NEW.id,
        field_rec.template_field_id,
        field_rec.field_key,
        field_rec.field_type,
        NEW.case_id,
        CASE WHEN field_rec.field_type IN ('TEXT', 'TEXTAREA', 'SELECT')
             THEN text_val ELSE NULL END,
        CASE WHEN field_rec.field_type = 'NUMBER'
             THEN safe_to_numeric(text_val) ELSE NULL END,
        CASE WHEN field_rec.field_type = 'DATE'
             THEN safe_to_date(text_val) ELSE NULL END,
        CASE WHEN field_rec.field_type = 'BOOLEAN'
             THEN CASE
                    WHEN key_value IN ('true'::jsonb, '"true"'::jsonb)   THEN true
                    WHEN key_value IN ('false'::jsonb, '"false"'::jsonb) THEN false
                    ELSE NULL
                  END
             ELSE NULL END,
        CASE WHEN field_rec.field_type = 'MULTISELECT'
             THEN key_value ELSE NULL END
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_case_data_values ON case_data_entries;
CREATE TRIGGER trg_sync_case_data_values
  AFTER INSERT OR UPDATE ON case_data_entries
  FOR EACH ROW EXECUTE FUNCTION sync_case_data_values();

-- ---------------------------------------------------------------------------
-- 4. Backfill existing rows
--    Idempotent: ON CONFLICT DO NOTHING on the primary key means
--    re-running this migration in an environment where the projection
--    is already partially populated is safe.
-- ---------------------------------------------------------------------------
INSERT INTO case_data_values
  (entry_id, template_field_id, field_key, field_type, case_id,
   value_text, value_number, value_date, value_boolean, value_json)
SELECT
  e.id,
  tf.id,
  tf.field_key,
  tf.field_type,
  e.case_id,
  CASE WHEN tf.field_type IN ('TEXT', 'TEXTAREA', 'SELECT')
       THEN (e.data -> tf.field_key) #>> '{}' ELSE NULL END,
  CASE WHEN tf.field_type = 'NUMBER'
       THEN safe_to_numeric((e.data -> tf.field_key) #>> '{}') ELSE NULL END,
  CASE WHEN tf.field_type = 'DATE'
       THEN safe_to_date((e.data -> tf.field_key) #>> '{}') ELSE NULL END,
  CASE WHEN tf.field_type = 'BOOLEAN'
       THEN CASE
              WHEN (e.data -> tf.field_key) IN ('true'::jsonb, '"true"'::jsonb)   THEN true
              WHEN (e.data -> tf.field_key) IN ('false'::jsonb, '"false"'::jsonb) THEN false
              ELSE NULL
            END
       ELSE NULL END,
  CASE WHEN tf.field_type = 'MULTISELECT'
       THEN (e.data -> tf.field_key) ELSE NULL END
FROM case_data_entries e
JOIN case_data_template_fields tf
  ON tf.template_id = e.template_id AND tf.is_active = true
WHERE e.data ? tf.field_key
  AND jsonb_typeof(e.data -> tf.field_key) <> 'null'
ON CONFLICT (entry_id, template_field_id) DO NOTHING;

COMMIT;
