-- Migration 016: Case Data Entry Module
--
-- 1. Create case_data_templates table (field sets per client+product)
-- 2. Create case_data_template_fields table (individual field definitions)
-- 3. Create case_data_entries table (actual data per case)
-- 4. Add case_data_template.manage permission
--
-- Applied: 2026-04-13

BEGIN;

-- =====================================================
-- TABLE 1: case_data_templates
-- Defines a set of data entry fields for a client+product combination.
-- Supports versioning: old cases keep their original template.
-- =====================================================

CREATE TABLE case_data_templates (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  name VARCHAR(255) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, product_id, version)
);

CREATE INDEX idx_case_data_templates_client_product_active
  ON case_data_templates(client_id, product_id)
  WHERE is_active = true;

-- =====================================================
-- TABLE 2: case_data_template_fields
-- Individual field definitions within a template.
-- =====================================================

CREATE TABLE case_data_template_fields (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES case_data_templates(id) ON DELETE CASCADE,
  field_key VARCHAR(100) NOT NULL,
  field_label VARCHAR(255) NOT NULL,
  field_type VARCHAR(50) NOT NULL CHECK (
    field_type IN ('TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTISELECT', 'BOOLEAN', 'TEXTAREA')
  ),
  is_required BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  section VARCHAR(100),
  placeholder VARCHAR(255),
  default_value TEXT,
  validation_rules JSONB DEFAULT '{}',
  options JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(template_id, field_key)
);

CREATE INDEX idx_case_data_template_fields_template_active
  ON case_data_template_fields(template_id)
  WHERE is_active = true;

-- =====================================================
-- TABLE 3: case_data_entries
-- Actual data entered per case. 1:1 with cases.
-- JSONB column stores field values keyed by field_key.
-- =====================================================

CREATE TABLE case_data_entries (
  id SERIAL PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES cases(id),
  template_id INTEGER NOT NULL REFERENCES case_data_templates(id),
  data JSONB NOT NULL DEFAULT '{}',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES users(id),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(case_id)
);

CREATE INDEX idx_case_data_entries_case ON case_data_entries(case_id);
CREATE INDEX idx_case_data_entries_template ON case_data_entries(template_id);

-- =====================================================
-- PERMISSION: case_data_template.manage
-- =====================================================

INSERT INTO permissions (id, code, module, description)
VALUES (
  gen_random_uuid(),
  'case_data_template.manage',
  'settings',
  'Create, update, and delete case data entry templates for client-product combinations'
)
ON CONFLICT (code) DO NOTHING;

COMMIT;
