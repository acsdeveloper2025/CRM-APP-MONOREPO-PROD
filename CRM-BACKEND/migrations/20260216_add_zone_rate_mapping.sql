-- Migration: Add Deterministic Zone-Rate Type Mapping
-- Created: 2026-02-16

-- Create zone_rate_type_mapping table
CREATE TABLE IF NOT EXISTS zone_rate_type_mapping (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL,
  product_id INT NOT NULL,
  verification_type_id INT NOT NULL,
  service_zone_id INT NOT NULL REFERENCES service_zones(id),
  rate_type_id INT NOT NULL REFERENCES "rateTypes"(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one mapping per context (deterministic)
  UNIQUE(client_id, product_id, verification_type_id, service_zone_id)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_zone_rate_mapping ON zone_rate_type_mapping 
  (client_id, product_id, verification_type_id, service_zone_id);

-- Add comment for documentation
COMMENT ON TABLE zone_rate_type_mapping IS 
  'Deterministic mapping from Service Zone to Rate Type for billing. Ensures that for a given Client+Product+VerificationType+Zone, exactly one Rate Type is used for financial calculations.';
