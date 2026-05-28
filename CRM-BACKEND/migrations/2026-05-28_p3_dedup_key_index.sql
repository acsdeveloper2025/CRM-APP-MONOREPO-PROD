-- Phase 3.7 — dedupe-cluster expression index (API+DB audit 2026-05-28)
-- getDuplicateClusters groups by COALESCE(pan_number, customer_phone). A
-- functional index on that exact expression lets the GROUP BY use an ordered
-- index scan instead of a full seq-scan + hash-agg (run twice: data + count).
-- Expression index via CONCURRENTLY = no table rewrite, no lock (vs a STORED
-- generated column, which would ACCESS EXCLUSIVE-lock + rewrite cases — costly
-- at 10M rows). Apply with psql -f (CONCURRENTLY cannot run in a txn).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_dedup_key
  ON cases ((COALESCE(pan_number, customer_phone)))
  WHERE pan_number IS NOT NULL OR customer_phone IS NOT NULL;
