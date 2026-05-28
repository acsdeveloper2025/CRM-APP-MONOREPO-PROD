-- Phase 3.7 — dedupe-cluster expression index (API+DB audit 2026-05-28)
-- getDuplicateClusters groups by COALESCE(pan_number, customer_phone). A
-- functional index on that exact expression lets the GROUP BY use an ordered
-- index scan instead of a full seq-scan + hash-agg (run twice: data + count).
--
-- NOTE: plain CREATE INDEX (no CONCURRENTLY) because scripts/run-migrations.ts
-- wraps every migration in BEGIN/COMMIT and CONCURRENTLY cannot run in a
-- transaction. On the current small dataset the in-tx build is instant. When
-- `cases` is large, pre-create this CONCURRENTLY out-of-band BEFORE the deploy
-- so the in-tx CREATE below is a no-op via IF NOT EXISTS (zero lock):
--   psql "<conn>" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_dedup_key
--     ON cases ((COALESCE(pan_number, customer_phone)))
--     WHERE pan_number IS NOT NULL OR customer_phone IS NOT NULL;"
CREATE INDEX IF NOT EXISTS idx_cases_dedup_key
  ON cases ((COALESCE(pan_number, customer_phone)))
  WHERE pan_number IS NOT NULL OR customer_phone IS NOT NULL;
