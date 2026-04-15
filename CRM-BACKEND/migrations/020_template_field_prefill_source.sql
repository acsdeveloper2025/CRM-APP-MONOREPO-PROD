-- Migration 020: Case Data Template Fields — prefill_source column
--
-- Sprint 5 of the Case Data Entry audit plan. Adds a nullable column to
-- `case_data_template_fields` so a template field can be marked as a
-- read-only mirror of an existing system field (customer name, product
-- name, verifier name, etc.) instead of a freestanding dynamic field.
--
-- Behaviour (implemented at the controller layer, not in this migration):
--   - null (default) → normal dynamic field; value lives in
--     case_data_entries.data JSONB.
--   - non-null → value is computed LIVE from the mapped source on every
--     render (cases / products / verification_tasks / applicants /
--     users, etc.). Never stored in JSONB. Disabled in the UI.
--
-- Why VARCHAR(64) rather than a CHECK constraint / enum:
--   The prefill catalog is maintained in the application layer
--   (CRM-BACKEND/src/config/templateFieldPrefillCatalog.ts) and will
--   grow over time. Keeping the column free-form avoids a migration
--   every time a new catalog entry is added; the catalog acts as the
--   source of truth for valid values and the create/update validators
--   reject anything not in it.
--
-- Applied: 2026-04-15

BEGIN;

ALTER TABLE case_data_template_fields
  ADD COLUMN IF NOT EXISTS prefill_source VARCHAR(64);

-- Cheap partial index for the one operational use case: "list every
-- field in this template that needs a prefill resolution" at render
-- time. Partial because the vast majority of fields will have
-- prefill_source = NULL and shouldn't pay b-tree cost.
CREATE INDEX IF NOT EXISTS idx_case_data_template_fields_prefill_source
  ON case_data_template_fields (template_id, prefill_source)
  WHERE prefill_source IS NOT NULL;

COMMIT;
