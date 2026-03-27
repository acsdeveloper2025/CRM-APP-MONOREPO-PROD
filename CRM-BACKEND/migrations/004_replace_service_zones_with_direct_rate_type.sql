-- Migration: Replace service_zones indirection with direct rate_type mapping
-- Before: service_zone_rules → service_zones → zone_rate_type_mapping → rateTypes
-- After:  service_zone_rules → rateTypes (direct)

-- Step 1: Drop FK constraint on service_zone_rules → service_zones
ALTER TABLE service_zone_rules DROP CONSTRAINT IF EXISTS service_zone_rules_service_zone_id_fkey;

-- Step 2: Add rate_type_id column to service_zone_rules
ALTER TABLE service_zone_rules ADD COLUMN IF NOT EXISTS rate_type_id integer;

-- Step 3: Migrate existing data (if any service_zone_rules + zone_rate_type_mapping exist)
UPDATE service_zone_rules szr
SET rate_type_id = zrtm.rate_type_id
FROM zone_rate_type_mapping zrtm
WHERE zrtm.service_zone_id = szr.service_zone_id
  AND zrtm.is_active = true;

-- Step 4: Drop service_zone_id column from service_zone_rules
ALTER TABLE service_zone_rules DROP COLUMN IF EXISTS service_zone_id;

-- Step 5: Add FK constraint service_zone_rules.rate_type_id → rateTypes.id
ALTER TABLE service_zone_rules
  ADD CONSTRAINT service_zone_rules_rate_type_id_fkey
  FOREIGN KEY (rate_type_id) REFERENCES "rateTypes"(id);

-- Step 6: Drop service_zone_id from verification_tasks
ALTER TABLE verification_tasks DROP CONSTRAINT IF EXISTS verification_tasks_service_zone_id_fkey;
DROP INDEX IF EXISTS idx_verification_tasks_service_zone_id;
DROP INDEX IF EXISTS idx_verification_tasks_sla_monitoring;
ALTER TABLE verification_tasks DROP COLUMN IF EXISTS service_zone_id;

-- Step 7: Drop zone_rate_type_mapping table (no longer needed)
DROP TABLE IF EXISTS zone_rate_type_mapping;

-- Step 8: Drop service_zones table (no longer needed)
DROP TABLE IF EXISTS service_zones CASCADE;
