-- Migration 007: Repoint documentTypeRates from documentTypes to kyc_document_types
-- The documentTypeRates table was originally linked to the generic "documentTypes" table.
-- Since KYC verification uses kyc_document_types (55 types with categories and custom fields),
-- we repoint the FK so rate management works with KYC document types directly.
-- The documentTypeRates table has 0 rows, so this is a safe schema change.

-- Step 1: Drop old FK constraint
ALTER TABLE "documentTypeRates" DROP CONSTRAINT IF EXISTS "documentTypeRates_documentTypeId_fkey";

-- Step 2: Add new FK pointing to kyc_document_types
ALTER TABLE "documentTypeRates"
  ADD CONSTRAINT "documentTypeRates_documentTypeId_fkey"
  FOREIGN KEY ("documentTypeId") REFERENCES kyc_document_types(id) ON DELETE CASCADE;

-- Step 3: Recreate the view to join kyc_document_types instead of documentTypes
DROP VIEW IF EXISTS "documentTypeRatesView";
CREATE VIEW "documentTypeRatesView" AS
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
  c.name AS "clientName",
  c.code AS "clientCode",
  p.name AS "productName",
  p.code AS "productCode",
  kdt.name AS "documentTypeName",
  kdt.code AS "documentTypeCode",
  kdt.category AS "documentTypeCategory"
FROM "documentTypeRates" dtr
JOIN clients c ON dtr."clientId" = c.id
JOIN products p ON dtr."productId" = p.id
JOIN kyc_document_types kdt ON dtr."documentTypeId" = kdt.id;
