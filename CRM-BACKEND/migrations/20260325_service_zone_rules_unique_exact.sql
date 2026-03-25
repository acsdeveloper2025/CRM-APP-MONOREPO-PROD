CREATE UNIQUE INDEX IF NOT EXISTS idx_service_zone_rules_exact_unique
ON service_zone_rules (client_id, product_id, pincode_id, area_id);
