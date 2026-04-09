-- Migration 011: Add unique constraint on service_zone_rules
-- Prevents duplicate rate_type mappings for the same client+product+pincode+area combination.
-- Previously enforced only at application level — race conditions could create duplicates.

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_zone_rules_unique
ON service_zone_rules (client_id, product_id, pincode_id, area_id)
WHERE is_active = true;

-- Track migration
INSERT INTO schema_migrations (id, filename, executed_at, checksum, success)
VALUES ('011', '011_add_service_zone_unique_constraint.sql', NOW(), 'sha256:szr_unique', true)
ON CONFLICT (id) DO NOTHING;
