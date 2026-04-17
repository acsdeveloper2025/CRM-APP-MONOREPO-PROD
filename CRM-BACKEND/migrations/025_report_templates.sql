-- Migration 025: PDF Report Templates Module
--
-- 1. Create report_templates table (HTML/Handlebars templates per client+product, versioned)
-- 2. Create generated_reports table (audit log of PDF generations, metadata only - no bytes)
-- 3. Add branding columns to clients table (logo_url, stamp_url, primary_color, header_color)
-- 4. Add report_template.manage permission (scoped to settings module)
--
-- Mirrors the case_data_templates architecture from migration 016:
--   - Same client+product+version uniqueness
--   - Same one-active-per-pair invariant (UNIQUE partial index)
--   - Same soft-delete via is_active = false
--   - Old generated reports keep referencing their pinned template_version
--
-- Applied: 2026-04-17

BEGIN;

-- =====================================================
-- TABLE 1: report_templates
-- One Handlebars HTML template per (client, product) combination.
-- Versioned exactly like case_data_templates.
-- =====================================================

CREATE TABLE report_templates (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  name VARCHAR(255) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  html_content TEXT NOT NULL,
  page_size VARCHAR(10) NOT NULL DEFAULT 'A4' CHECK (page_size IN ('A4', 'LETTER', 'LEGAL')),
  page_orientation VARCHAR(20) NOT NULL DEFAULT 'portrait'
    CHECK (page_orientation IN ('portrait', 'landscape')),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (client_id, product_id, version)
);

-- Hard DB-level guarantee: only one active template per (client, product).
-- Mirrors idx_case_data_templates_unique_active from migration 022.
CREATE UNIQUE INDEX idx_report_templates_unique_active
  ON report_templates (client_id, product_id)
  WHERE is_active = true;

-- Optimizes the admin list page's ORDER BY created_at DESC WHERE is_active = true.
CREATE INDEX idx_report_templates_list_order
  ON report_templates (created_at DESC)
  WHERE is_active = true;

-- =====================================================
-- TABLE 2: generated_reports
-- Audit log. One row per PDF generation. No file bytes stored.
-- Lets admins answer "who generated a report for case X on date Y using
-- template version Z?".
-- =====================================================

CREATE TABLE generated_reports (
  id SERIAL PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES cases(id),
  template_id INTEGER NOT NULL REFERENCES report_templates(id),
  template_version INTEGER NOT NULL,
  generated_by UUID NOT NULL REFERENCES users(id),
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  file_size_bytes INTEGER,
  generation_ms INTEGER
);

-- Look-up pattern: "show me all reports ever generated for this case, newest first".
CREATE INDEX idx_generated_reports_case
  ON generated_reports (case_id, generated_at DESC);

-- Look-up pattern: "who generated what, in a given date window".
CREATE INDEX idx_generated_reports_user_date
  ON generated_reports (generated_by, generated_at DESC);

-- =====================================================
-- ALTER: clients (branding columns)
-- Logo, stamp image, and two color hex codes used by the Handlebars template.
-- All nullable - a client without branding gets a plain-text fallback in the PDF.
-- =====================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS stamp_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20),
  ADD COLUMN IF NOT EXISTS header_color VARCHAR(20);

-- =====================================================
-- RBAC: report_template.manage permission
-- Mirrors case_data_template.manage from migration 016. Not auto-granted
-- to any role by this migration - admins are expected to assign it via the
-- RBAC admin UI.
-- =====================================================

INSERT INTO permissions (id, code, module, description)
VALUES (
  gen_random_uuid(),
  'report_template.manage',
  'settings',
  'Create, update, and delete PDF report templates for client-product combinations'
)
ON CONFLICT (code) DO NOTHING;

COMMIT;
