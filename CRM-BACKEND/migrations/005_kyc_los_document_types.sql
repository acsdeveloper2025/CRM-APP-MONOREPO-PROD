-- Migration: Update KYC document types to match LOS system exactly
-- Adds custom_fields JSONB to kyc_document_types
-- Seeds all 55 verification types from LOS

-- 1. Add custom_fields column to kyc_document_types
ALTER TABLE kyc_document_types ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '[]';

-- 2. Add document_details JSONB to kyc_document_verifications (stores custom field values)
ALTER TABLE kyc_document_verifications ADD COLUMN IF NOT EXISTS document_details JSONB DEFAULT '{}';

-- 3. Add description field to kyc_document_verifications
ALTER TABLE kyc_document_verifications ADD COLUMN IF NOT EXISTS description TEXT;

-- 4. Add document_mime_type if not exists
ALTER TABLE kyc_document_verifications ADD COLUMN IF NOT EXISTS document_mime_type VARCHAR(100);

-- 5. Clear existing document types and reseed with LOS types
DELETE FROM kyc_document_types;

-- Reset sequence
ALTER SEQUENCE IF EXISTS kyc_document_types_id_seq RESTART WITH 1;

-- Seed all 55 LOS document types
-- Category: IDENTITY (documents with identity-related fields)
INSERT INTO kyc_document_types (code, name, category, custom_fields, sort_order, is_active) VALUES
('PAN_CARD', 'PAN Card', 'IDENTITY', '[{"key":"pan_number","label":"Pan Number","type":"text","required":true}]', 1, true),
('AADHAR_CARD', 'Aadhar Card', 'IDENTITY', '[{"key":"aadhar_number","label":"Aadhar Number","type":"text","required":true}]', 2, true),
('PASSPORT', 'Passport', 'IDENTITY', '[{"key":"passport_number","label":"Passport Number","type":"text","required":true}]', 3, true),
('VOTER_ID', 'Voter ID', 'IDENTITY', '[{"key":"voter_id_number","label":"Voter Id Number","type":"text","required":true}]', 4, true),
('DRIVING_LICENSE', 'Driving License', 'IDENTITY', '[{"key":"license_number","label":"License Number","type":"text","required":true},{"key":"dob","label":"DOB","type":"date","required":false}]', 5, true),
('OFFICE_ID_CARD', 'Office ID Card', 'IDENTITY', '[]', 6, true),
('RATION_CARD', 'Ration Card', 'IDENTITY', '[]', 7, true),
('BIRTH_CERTIFICATE', 'Birth Certificate', 'IDENTITY', '[]', 8, true),
('SCHOOL_LEAVING_CERTIFICATE', 'School Leaving Certificate', 'IDENTITY', '[]', 9, true),
('DEATH_CERTIFICATE', 'Death Certificate', 'IDENTITY', '[]', 10, true),

-- Category: FINANCIAL (documents with financial fields)
('BANK_STATEMENT', 'Bank Statement', 'FINANCIAL', '[{"key":"account_number","label":"Account Number","type":"text","required":true},{"key":"bank_name","label":"Bank Name","type":"text","required":true},{"key":"transaction_1","label":"Transaction 1","type":"text","required":false},{"key":"transaction_2","label":"Transaction 2","type":"text","required":false},{"key":"transaction_3","label":"Transaction 3","type":"text","required":false}]', 11, true),
('BANK_STATEMENT_COPY', 'Bank Statement Copy', 'FINANCIAL', '[]', 12, true),
('ITR', 'ITR', 'FINANCIAL', '[{"key":"assessment_year","label":"Assessment Year","type":"text","required":true},{"key":"pan_number","label":"Pan Number","type":"text","required":true}]', 13, true),
('FINANCIAL', 'Financial', 'FINANCIAL', '[{"key":"assessment_year","label":"Assessment Year","type":"text","required":true},{"key":"pan_number","label":"Pan Number","type":"text","required":true}]', 14, true),
('FORM_16', 'Form 16', 'FINANCIAL', '[{"key":"pan_number","label":"Pan Number","type":"text","required":true},{"key":"address","label":"Address","type":"text","required":false}]', 15, true),
('SALARY_SLIP', 'Salary Slip', 'FINANCIAL', '[{"key":"address","label":"Address","type":"text","required":false}]', 16, true),
('TDS_CERTIFICATE', 'TDS Certificate', 'FINANCIAL', '[]', 17, true),
('26_AS', '26 AS', 'FINANCIAL', '[]', 18, true),
('SHARE_CERTIFICATE', 'Share Certificate', 'FINANCIAL', '[]', 19, true),
('EPFO', 'EPFO', 'FINANCIAL', '[]', 20, true),

-- Category: BUSINESS (business-related documents)
('GST', 'GST', 'BUSINESS', '[{"key":"gst_number","label":"GST Number","type":"text","required":true}]', 21, true),
('UDYOG_ADHAR', 'Udyog Adhar', 'BUSINESS', '[{"key":"udyog_aadhar","label":"Udyog Aadhar","type":"text","required":true}]', 22, true),
('SHOP_ACT', 'Shop Act', 'BUSINESS', '[{"key":"shop_act_number","label":"Shop Act Number","type":"text","required":true},{"key":"ward_number","label":"Ward Number","type":"text","required":false}]', 23, true),

-- Category: ADDRESS (address proof documents)
('UTILITY_BILL', 'Utility Bill', 'ADDRESS', '[{"key":"account_number","label":"Account Number","type":"text","required":false},{"key":"unit_number","label":"Unit Number","type":"text","required":false},{"key":"customer_id_number","label":"Customer Id Number","type":"text","required":false}]', 24, true),
('LAND_LINE_BILL', 'Land Line Bill', 'ADDRESS', '[{"key":"land_line_number","label":"Land Line Number","type":"text","required":true}]', 25, true),
('MOBILE_DETAILS', 'Mobile Details', 'ADDRESS', '[{"key":"mobile_number","label":"Mobile Number","type":"text","required":true}]', 26, true),
('RENT_AGREEMENT', 'Rent Agreement', 'ADDRESS', '[]', 27, true),

-- Category: PROPERTY (property-related documents)
('AGREEMENT', 'Agreement', 'PROPERTY', '[]', 28, true),
('SALE_DEED', 'Sale Deed', 'PROPERTY', '[]', 29, true),
('SOCIETY_NOC', 'Society NOC', 'PROPERTY', '[]', 30, true),
('BUILDER_NOC', 'Builder NOC', 'PROPERTY', '[]', 31, true),
('LANDLORD_NOC', 'Landlord NOC', 'PROPERTY', '[]', 32, true),
('TENANT_NOC', 'Tenant NOC', 'PROPERTY', '[]', 33, true),
('LEGAL_HEIR_NOC', 'Legal Heir NOC', 'PROPERTY', '[]', 34, true),
('PLAN_COPY', 'Plan Copy', 'PROPERTY', '[]', 35, true),
('COMMENCEMENT_CERTIFICATE', 'Commencement Certificate', 'PROPERTY', '[]', 36, true),
('OCCUPANCY_CERTIFICATE', 'Occupancy Certificate', 'PROPERTY', '[]', 37, true),

-- Category: LEGAL (legal/compliance documents)
('SANCTION_LETTER', 'Sanction Letter', 'LEGAL', '[]', 38, true),
('DEMAND_LETTER', 'Demand Letter', 'LEGAL', '[]', 39, true),
('FORECLOUSER_LETTER', 'Foreclouser Letter', 'LEGAL', '[]', 40, true),
('GRAMPANCHAYAT_LETTER', 'Grampanchayat Letter', 'LEGAL', '[]', 41, true),
('ARCHITECTURE_CERTIFICATE', 'Architecture Certificate', 'LEGAL', '[]', 42, true),

-- Category: VERIFICATION (verification-specific documents)
('SIGNATURE_VERIFICATION', 'Signature Verification', 'VERIFICATION', '[]', 43, true),
('CROSS_PROFILE_CHECK', 'Cross Profile Check (CPV Cross Check)', 'VERIFICATION', '[]', 44, true),
('DISCREET_PROFILE', 'Discreet Profile', 'VERIFICATION', '[]', 45, true),
('GUARANTOR_VISIT', 'Guarantor Visit', 'VERIFICATION', '[]', 46, true),

-- Category: MEDICAL (medical documents)
('MEDICAL_CERTIFICATE', 'Medical Certificate', 'MEDICAL', '[]', 47, true),
('MEDICAL_BILL', 'Medical Bill', 'MEDICAL', '[]', 48, true),

-- Category: OTHER (miscellaneous documents)
('OFFER_LETTER', 'Offer Letter', 'OTHER', '[]', 49, true),
('QUOTATION', 'Quotation', 'OTHER', '[]', 50, true),
('INVOICE_COPY', 'Invoice Copy', 'OTHER', '[]', 51, true),
('OCR_RECEIPT', 'OCR Receipt', 'OTHER', '[]', 52, true),
('APPLICATION_FORM', 'Application Form', 'OTHER', '[]', 53, true),
('LIST_OF_DOCUMENT', 'List of Document', 'OTHER', '[]', 54, true),
('OTHER', 'Other', 'OTHER', '[]', 55, true);

-- Index on custom_fields for quick lookup
CREATE INDEX IF NOT EXISTS idx_kyc_doc_verifications_document_details ON kyc_document_verifications USING gin(document_details);
CREATE INDEX IF NOT EXISTS idx_kyc_doc_types_category ON kyc_document_types(category);
