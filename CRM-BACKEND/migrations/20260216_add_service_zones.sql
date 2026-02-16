-- Migration: Add Service Zones and Rules
-- Created: 2026-02-16

-- 1. Create service_zones table
CREATE TABLE IF NOT EXISTS service_zones (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE, -- Local, OGL, Outstation
  sla_hours INT NOT NULL DEFAULT 48,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create service_zone_rules table
CREATE TABLE IF NOT EXISTS service_zone_rules (
  id SERIAL PRIMARY KEY,
  client_id INT, -- Nullable for Global Rules
  product_id INT, -- Nullable for All Products
  pincode_id INT NOT NULL,
  area_id INT, -- Nullable for entire Pincode
  service_zone_id INT NOT NULL REFERENCES service_zones(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for the Rules Engine lookup
CREATE INDEX IF NOT EXISTS idx_sz_rules_lookup ON service_zone_rules (client_id, product_id, pincode_id, area_id);

-- 3. Update verification_tasks table
-- Check if column exists first to avoid error on re-run
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'verification_tasks' AND column_name = 'service_zone_id') THEN
        ALTER TABLE verification_tasks ADD COLUMN service_zone_id INT REFERENCES service_zones(id);
    END IF;
END
$$;

-- 4. Seed Default Zones
INSERT INTO service_zones (name, sla_hours) VALUES
('Local', 24),
('OGL', 48),
('Outstation', 72)
ON CONFLICT (name) DO NOTHING;
