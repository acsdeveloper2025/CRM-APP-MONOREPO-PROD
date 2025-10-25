-- Migration: Create document type rates table
-- This migration creates the document type rates system for managing pricing of document verification services
-- Unlike verification type rates, document type rates are simpler and don't depend on rate types or pincodes

-- Create documentTypeRates table
CREATE TABLE IF NOT EXISTS "documentTypeRates" (
    id BIGSERIAL PRIMARY KEY,
    "clientId" INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    "productId" INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    "documentTypeId" INTEGER NOT NULL REFERENCES "documentTypes"(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) DEFAULT 'INR',
    "isActive" BOOLEAN DEFAULT true,
    "effectiveFrom" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP,
    "createdBy" UUID REFERENCES users(id),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Ensure only one active rate per client-product-document type combination
    CONSTRAINT unique_active_document_type_rate 
        UNIQUE("clientId", "productId", "documentTypeId", "isActive")
        DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_document_type_rates_client 
    ON "documentTypeRates"("clientId");

CREATE INDEX IF NOT EXISTS idx_document_type_rates_product 
    ON "documentTypeRates"("productId");

CREATE INDEX IF NOT EXISTS idx_document_type_rates_document_type 
    ON "documentTypeRates"("documentTypeId");

CREATE INDEX IF NOT EXISTS idx_document_type_rates_active 
    ON "documentTypeRates"("isActive");

CREATE INDEX IF NOT EXISTS idx_document_type_rates_effective 
    ON "documentTypeRates"("effectiveFrom", "effectiveTo");

CREATE INDEX IF NOT EXISTS idx_document_type_rates_created_by 
    ON "documentTypeRates"("createdBy");

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_document_type_rates_lookup 
    ON "documentTypeRates"("clientId", "productId", "documentTypeId", "isActive");

-- Create view for easy querying with joined names
CREATE OR REPLACE VIEW "documentTypeRatesView" AS
SELECT 
    dtr.id,
    dtr."clientId",
    dtr."productId",
    dtr."documentTypeId",
    dtr.amount,
    dtr.currency,
    dtr."isActive",
    dtr."effectiveFrom",
    dtr."effectiveTo",
    dtr."createdBy",
    dtr."createdAt",
    dtr."updatedAt",
    c.name as "clientName",
    c.code as "clientCode",
    p.name as "productName",
    p.code as "productCode",
    dt.name as "documentTypeName",
    dt.code as "documentTypeCode",
    dt.category as "documentTypeCategory"
FROM "documentTypeRates" dtr
JOIN clients c ON dtr."clientId" = c.id
JOIN products p ON dtr."productId" = p.id
JOIN "documentTypes" dt ON dtr."documentTypeId" = dt.id;

-- Add comments to table and columns
COMMENT ON TABLE "documentTypeRates" IS 'Stores pricing for document verification services by client, product, and document type';
COMMENT ON COLUMN "documentTypeRates"."clientId" IS 'Reference to the client requesting document verification';
COMMENT ON COLUMN "documentTypeRates"."productId" IS 'Reference to the product/service for which document is required';
COMMENT ON COLUMN "documentTypeRates"."documentTypeId" IS 'Reference to the type of document (Aadhaar, PAN, Passport, etc.)';
COMMENT ON COLUMN "documentTypeRates".amount IS 'Rate amount for this document type verification';
COMMENT ON COLUMN "documentTypeRates".currency IS 'Currency code (default: INR)';
COMMENT ON COLUMN "documentTypeRates"."isActive" IS 'Whether this rate is currently active';
COMMENT ON COLUMN "documentTypeRates"."effectiveFrom" IS 'Date from which this rate is effective';
COMMENT ON COLUMN "documentTypeRates"."effectiveTo" IS 'Date until which this rate is effective (NULL for indefinite)';

-- Create trigger function to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_document_type_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_document_type_rates_updated_at ON "documentTypeRates";
CREATE TRIGGER trigger_update_document_type_rates_updated_at
    BEFORE UPDATE ON "documentTypeRates"
    FOR EACH ROW
    EXECUTE FUNCTION update_document_type_rates_updated_at();

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Document type rates table created successfully';
    RAISE NOTICE 'Created 8 indexes for optimal query performance';
    RAISE NOTICE 'Created documentTypeRatesView for easy querying';
    RAISE NOTICE 'Created trigger for automatic updatedAt timestamp updates';
END $$;

