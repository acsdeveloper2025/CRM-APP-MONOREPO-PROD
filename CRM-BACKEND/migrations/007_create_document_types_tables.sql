-- Migration: Create document types tables and relationships
-- This migration creates the document types system for managing document requirements

-- Create documentTypes table
CREATE TABLE IF NOT EXISTS "documentTypes" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100),
    is_government_issued BOOLEAN DEFAULT true,
    requires_verification BOOLEAN DEFAULT true,
    validity_period_months INTEGER,
    format_pattern VARCHAR(255),
    min_length INTEGER,
    max_length INTEGER,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    updated_by UUID,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create clientDocumentTypes junction table
CREATE TABLE IF NOT EXISTS "clientDocumentTypes" (
    id SERIAL PRIMARY KEY,
    "clientId" INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    "documentTypeId" INTEGER NOT NULL REFERENCES "documentTypes"(id) ON DELETE CASCADE,
    is_mandatory BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    updated_by UUID,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("clientId", "documentTypeId")
);

-- Create productDocumentTypes junction table
CREATE TABLE IF NOT EXISTS "productDocumentTypes" (
    id SERIAL PRIMARY KEY,
    "productId" INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    "documentTypeId" INTEGER NOT NULL REFERENCES "documentTypes"(id) ON DELETE CASCADE,
    is_mandatory BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    updated_by UUID,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("productId", "documentTypeId")
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_document_types_code ON "documentTypes"(code);
CREATE INDEX IF NOT EXISTS idx_document_types_category ON "documentTypes"(category);
CREATE INDEX IF NOT EXISTS idx_document_types_is_active ON "documentTypes"(is_active);
CREATE INDEX IF NOT EXISTS idx_document_types_sort_order ON "documentTypes"(sort_order);

CREATE INDEX IF NOT EXISTS idx_client_document_types_client ON "clientDocumentTypes"("clientId");
CREATE INDEX IF NOT EXISTS idx_client_document_types_document ON "clientDocumentTypes"("documentTypeId");
CREATE INDEX IF NOT EXISTS idx_client_document_types_active ON "clientDocumentTypes"(is_active);

CREATE INDEX IF NOT EXISTS idx_product_document_types_product ON "productDocumentTypes"("productId");
CREATE INDEX IF NOT EXISTS idx_product_document_types_document ON "productDocumentTypes"("documentTypeId");
CREATE INDEX IF NOT EXISTS idx_product_document_types_active ON "productDocumentTypes"(is_active);

-- Add comments to tables
COMMENT ON TABLE "documentTypes" IS 'Master table for document types used in verification processes';
COMMENT ON TABLE "clientDocumentTypes" IS 'Junction table mapping document types to clients';
COMMENT ON TABLE "productDocumentTypes" IS 'Junction table mapping document types to products';

-- Add comments to key columns
COMMENT ON COLUMN "documentTypes".code IS 'Unique code for the document type (e.g., AADHAAR, PAN, PASSPORT)';
COMMENT ON COLUMN "documentTypes".category IS 'Category of document (e.g., IDENTITY, ADDRESS, FINANCIAL)';
COMMENT ON COLUMN "documentTypes".is_government_issued IS 'Whether this is a government-issued document';
COMMENT ON COLUMN "documentTypes".requires_verification IS 'Whether this document requires verification';
COMMENT ON COLUMN "documentTypes".validity_period_months IS 'Validity period in months (NULL for no expiry)';
COMMENT ON COLUMN "documentTypes".format_pattern IS 'Regex pattern for document number validation';

-- Insert some common document types
INSERT INTO "documentTypes" (name, code, description, category, is_government_issued, requires_verification, validity_period_months, format_pattern, min_length, max_length, sort_order)
VALUES
    ('Aadhaar Card', 'AADHAAR', 'Unique Identification Number issued by UIDAI', 'IDENTITY', true, true, NULL, '^[0-9]{12}$', 12, 12, 1),
    ('PAN Card', 'PAN', 'Permanent Account Number issued by Income Tax Department', 'IDENTITY', true, true, NULL, '^[A-Z]{5}[0-9]{4}[A-Z]{1}$', 10, 10, 2),
    ('Passport', 'PASSPORT', 'International travel document', 'IDENTITY', true, true, 120, '^[A-Z]{1}[0-9]{7}$', 8, 8, 3),
    ('Voter ID', 'VOTER_ID', 'Electoral Photo Identity Card', 'IDENTITY', true, true, NULL, '^[A-Z]{3}[0-9]{7}$', 10, 10, 4),
    ('Driving License', 'DRIVING_LICENSE', 'License to drive motor vehicles', 'IDENTITY', true, true, 240, NULL, 10, 20, 5),
    ('Electricity Bill', 'ELECTRICITY_BILL', 'Utility bill for electricity consumption', 'ADDRESS', false, true, 3, NULL, NULL, NULL, 6),
    ('Bank Statement', 'BANK_STATEMENT', 'Statement of bank account transactions', 'FINANCIAL', false, true, 3, NULL, NULL, NULL, 7),
    ('Salary Slip', 'SALARY_SLIP', 'Monthly salary statement', 'FINANCIAL', false, true, 3, NULL, NULL, NULL, 8),
    ('Property Documents', 'PROPERTY_DOCS', 'Property ownership or rental documents', 'ADDRESS', false, true, NULL, NULL, NULL, NULL, 9),
    ('GST Certificate', 'GST_CERTIFICATE', 'Goods and Services Tax Registration Certificate', 'BUSINESS', true, true, NULL, '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', 15, 15, 10)
ON CONFLICT (code) DO NOTHING;

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Document types tables created successfully';
    RAISE NOTICE 'Inserted 10 common document types';
    RAISE NOTICE 'Created indexes for optimal query performance';
END $$;

