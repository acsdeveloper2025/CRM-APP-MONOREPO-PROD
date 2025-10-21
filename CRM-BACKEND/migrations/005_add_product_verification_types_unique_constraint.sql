-- =====================================================
-- MIGRATION 005: ADD UNIQUE CONSTRAINT TO PRODUCT VERIFICATION TYPES
-- =====================================================
-- This migration adds a unique constraint to the productVerificationTypes table
-- to prevent duplicate product-verification type mappings and fix ON CONFLICT issues.

-- Add unique constraint to productVerificationTypes table
DO $$ 
BEGIN
    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_product_verification_type' 
        AND table_name = 'productVerificationTypes'
    ) THEN
        -- Remove any duplicate entries first (keep the most recent one)
        DELETE FROM "productVerificationTypes" a USING (
            SELECT MIN(id) as id, "productId", "verificationTypeId"
            FROM "productVerificationTypes" 
            GROUP BY "productId", "verificationTypeId" 
            HAVING COUNT(*) > 1
        ) b
        WHERE a."productId" = b."productId" 
        AND a."verificationTypeId" = b."verificationTypeId" 
        AND a.id <> b.id;
        
        -- Add the unique constraint
        ALTER TABLE "productVerificationTypes" 
        ADD CONSTRAINT unique_product_verification_type 
        UNIQUE ("productId", "verificationTypeId");
        
        RAISE NOTICE 'Added unique constraint to productVerificationTypes table';
    ELSE
        RAISE NOTICE 'Unique constraint already exists on productVerificationTypes table';
    END IF;
END $$;

-- Add comment to document the constraint
COMMENT ON CONSTRAINT unique_product_verification_type ON "productVerificationTypes" IS 'Ensures each product-verification type combination is unique';
