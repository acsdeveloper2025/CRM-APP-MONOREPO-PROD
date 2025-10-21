-- Migration: Create Document Types Management System
-- Description: Add document types table and client-document type mapping
-- Following the same pattern as verification types and products

-- =====================================================
-- 1. DOCUMENT TYPES TABLE
-- =====================================================
-- Create document types table (similar to verificationTypes)
CREATE TABLE IF NOT EXISTS "documentTypes" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,                 -- e.g., "Aadhaar Card", "PAN Card", "Passport"
    code VARCHAR(50) NOT NULL UNIQUE,           -- e.g., "AADHAAR", "PAN", "PASSPORT"
    description TEXT,                           -- Detailed description of the document
    category VARCHAR(100),                      -- e.g., "IDENTITY", "ADDRESS", "FINANCIAL", "EDUCATION"
    
    -- Document properties
    is_government_issued BOOLEAN DEFAULT TRUE,  -- Whether it's a government-issued document
    requires_verification BOOLEAN DEFAULT TRUE, -- Whether this document type requires verification
    validity_period_months INTEGER,             -- How long the document is valid (NULL for permanent)
    
    -- Validation rules
    format_pattern VARCHAR(255),                -- Regex pattern for document number validation
    min_length INTEGER,                         -- Minimum length for document number
    max_length INTEGER,                         -- Maximum length for document number
    
    -- Status and metadata
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,               -- For ordering in UI
    
    -- Audit fields
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_types_code ON "documentTypes"(code);
CREATE INDEX IF NOT EXISTS idx_document_types_category ON "documentTypes"(category);
CREATE INDEX IF NOT EXISTS idx_document_types_active ON "documentTypes"(is_active);
CREATE INDEX IF NOT EXISTS idx_document_types_sort_order ON "documentTypes"(sort_order);

-- =====================================================
-- 2. CLIENT-DOCUMENT TYPE MAPPING TABLE
-- =====================================================
-- Create client-document type mapping table (similar to clientProducts)
CREATE TABLE IF NOT EXISTS "clientDocumentTypes" (
    id SERIAL PRIMARY KEY,
    "clientId" INTEGER NOT NULL,                -- References clients.id
    "documentTypeId" INTEGER NOT NULL,          -- References documentTypes.id
    
    -- Mapping properties
    is_required BOOLEAN DEFAULT FALSE,          -- Whether this document is required for this client
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,                 -- Priority/order for this client
    
    -- Client-specific validation rules (overrides document type defaults)
    client_specific_rules JSONB,               -- Custom validation rules for this client
    
    -- Audit fields
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    
    -- Constraints
    CONSTRAINT fk_client_document_types_client 
        FOREIGN KEY ("clientId") REFERENCES clients(id) ON DELETE CASCADE,
    CONSTRAINT fk_client_document_types_document_type 
        FOREIGN KEY ("documentTypeId") REFERENCES "documentTypes"(id) ON DELETE CASCADE,
    CONSTRAINT unique_client_document_type 
        UNIQUE ("clientId", "documentTypeId")
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_document_types_client ON "clientDocumentTypes"("clientId");
CREATE INDEX IF NOT EXISTS idx_client_document_types_document_type ON "clientDocumentTypes"("documentTypeId");
CREATE INDEX IF NOT EXISTS idx_client_document_types_active ON "clientDocumentTypes"(is_active);

-- =====================================================
-- 3. PRODUCT-DOCUMENT TYPE MAPPING TABLE (OPTIONAL)
-- =====================================================
-- Create product-document type mapping table for more granular control
CREATE TABLE IF NOT EXISTS "productDocumentTypes" (
    id SERIAL PRIMARY KEY,
    "productId" INTEGER NOT NULL,               -- References products.id
    "documentTypeId" INTEGER NOT NULL,          -- References documentTypes.id
    
    -- Mapping properties
    is_required BOOLEAN DEFAULT FALSE,          -- Whether this document is required for this product
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,                 -- Priority/order for this product
    
    -- Product-specific validation rules
    product_specific_rules JSONB,              -- Custom validation rules for this product
    
    -- Audit fields
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    
    -- Constraints
    CONSTRAINT fk_product_document_types_product 
        FOREIGN KEY ("productId") REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_product_document_types_document_type 
        FOREIGN KEY ("documentTypeId") REFERENCES "documentTypes"(id) ON DELETE CASCADE,
    CONSTRAINT unique_product_document_type 
        UNIQUE ("productId", "documentTypeId")
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_document_types_product ON "productDocumentTypes"("productId");
CREATE INDEX IF NOT EXISTS idx_product_document_types_document_type ON "productDocumentTypes"("documentTypeId");
CREATE INDEX IF NOT EXISTS idx_product_document_types_active ON "productDocumentTypes"(is_active);

-- =====================================================
-- 4. INSERT DEFAULT DOCUMENT TYPES
-- =====================================================
-- Insert common Indian document types
INSERT INTO "documentTypes" (name, code, description, category, is_government_issued, format_pattern, min_length, max_length, sort_order) VALUES
-- Identity Documents
('Aadhaar Card', 'AADHAAR', 'Unique Identification Authority of India issued identity document', 'IDENTITY', TRUE, '^[0-9]{12}$', 12, 12, 1),
('PAN Card', 'PAN', 'Permanent Account Number issued by Income Tax Department', 'IDENTITY', TRUE, '^[A-Z]{5}[0-9]{4}[A-Z]{1}$', 10, 10, 2),
('Voter ID Card', 'VOTER_ID', 'Election Commission of India issued voter identity card', 'IDENTITY', TRUE, '^[A-Z]{3}[0-9]{7}$', 10, 10, 3),
('Driving License', 'DRIVING_LICENSE', 'State Transport Authority issued driving license', 'IDENTITY', TRUE, NULL, 8, 20, 4),
('Passport', 'PASSPORT', 'Ministry of External Affairs issued passport', 'IDENTITY', TRUE, '^[A-Z]{1}[0-9]{7}$', 8, 8, 5),

-- Address Documents
('Electricity Bill', 'ELECTRICITY_BILL', 'Utility bill for electricity consumption', 'ADDRESS', FALSE, NULL, 5, 50, 10),
('Gas Bill', 'GAS_BILL', 'Utility bill for gas consumption', 'ADDRESS', FALSE, NULL, 5, 50, 11),
('Water Bill', 'WATER_BILL', 'Utility bill for water consumption', 'ADDRESS', FALSE, NULL, 5, 50, 12),
('Telephone Bill', 'TELEPHONE_BILL', 'Landline or mobile phone bill', 'ADDRESS', FALSE, NULL, 5, 50, 13),
('Bank Statement', 'BANK_STATEMENT', 'Bank account statement', 'ADDRESS', FALSE, NULL, 5, 50, 14),
('Rent Agreement', 'RENT_AGREEMENT', 'Property rental agreement', 'ADDRESS', FALSE, NULL, 5, 50, 15),

-- Financial Documents
('Bank Account Details', 'BANK_ACCOUNT', 'Bank account number and IFSC details', 'FINANCIAL', FALSE, NULL, 8, 20, 20),
('Salary Certificate', 'SALARY_CERTIFICATE', 'Employment salary certificate', 'FINANCIAL', FALSE, NULL, 5, 50, 21),
('ITR (Income Tax Return)', 'ITR', 'Income Tax Return filing document', 'FINANCIAL', TRUE, NULL, 5, 50, 22),
('Form 16', 'FORM_16', 'Tax deduction certificate from employer', 'FINANCIAL', FALSE, NULL, 5, 50, 23),

-- Education Documents
('10th Marksheet', 'CLASS_10_MARKSHEET', 'Class 10 board examination marksheet', 'EDUCATION', TRUE, NULL, 5, 50, 30),
('12th Marksheet', 'CLASS_12_MARKSHEET', 'Class 12 board examination marksheet', 'EDUCATION', TRUE, NULL, 5, 50, 31),
('Graduation Certificate', 'GRADUATION_CERT', 'Bachelor degree certificate', 'EDUCATION', TRUE, NULL, 5, 50, 32),
('Post Graduation Certificate', 'POST_GRADUATION_CERT', 'Master degree certificate', 'EDUCATION', TRUE, NULL, 5, 50, 33),

-- Business Documents
('GST Certificate', 'GST_CERTIFICATE', 'Goods and Services Tax registration certificate', 'BUSINESS', TRUE, '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', 15, 15, 40),
('Trade License', 'TRADE_LICENSE', 'Municipal corporation issued trade license', 'BUSINESS', TRUE, NULL, 5, 50, 41),
('Shop Act License', 'SHOP_ACT_LICENSE', 'State government issued shop and establishment license', 'BUSINESS', TRUE, NULL, 5, 50, 42),
('MSME Certificate', 'MSME_CERTIFICATE', 'Micro, Small and Medium Enterprises registration certificate', 'BUSINESS', TRUE, NULL, 5, 50, 43),

-- Other Documents
('Caste Certificate', 'CASTE_CERTIFICATE', 'Government issued caste certificate', 'OTHER', TRUE, NULL, 5, 50, 50),
('Income Certificate', 'INCOME_CERTIFICATE', 'Government issued income certificate', 'OTHER', TRUE, NULL, 5, 50, 51),
('Domicile Certificate', 'DOMICILE_CERTIFICATE', 'State government issued domicile certificate', 'OTHER', TRUE, NULL, 5, 50, 52);

-- =====================================================
-- 5. UPDATE EXISTING TABLES (IF NEEDED)
-- =====================================================
-- Add document_type_id to verification_tasks table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'verification_tasks' 
                   AND column_name = 'document_type_id') THEN
        ALTER TABLE verification_tasks 
        ADD COLUMN document_type_id INTEGER REFERENCES "documentTypes"(id);
        
        CREATE INDEX IF NOT EXISTS idx_verification_tasks_document_type 
        ON verification_tasks(document_type_id);
    END IF;
END $$;

-- Add document_type_id to cases table for backward compatibility
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cases' 
                   AND column_name = 'document_type_id') THEN
        ALTER TABLE cases 
        ADD COLUMN document_type_id INTEGER REFERENCES "documentTypes"(id);
        
        CREATE INDEX IF NOT EXISTS idx_cases_document_type 
        ON cases(document_type_id);
    END IF;
END $$;

-- =====================================================
-- 6. CREATE TRIGGERS FOR UPDATED_AT
-- =====================================================
-- Create trigger function for updating updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for document types tables
DROP TRIGGER IF EXISTS update_document_types_updated_at ON "documentTypes";
CREATE TRIGGER update_document_types_updated_at
    BEFORE UPDATE ON "documentTypes"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_document_types_updated_at ON "clientDocumentTypes";
CREATE TRIGGER update_client_document_types_updated_at
    BEFORE UPDATE ON "clientDocumentTypes"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_document_types_updated_at ON "productDocumentTypes";
CREATE TRIGGER update_product_document_types_updated_at
    BEFORE UPDATE ON "productDocumentTypes"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
