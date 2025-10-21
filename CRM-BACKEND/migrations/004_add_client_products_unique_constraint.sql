-- =====================================================
-- MIGRATION 004: ADD UNIQUE CONSTRAINT TO CLIENT PRODUCTS
-- =====================================================
-- This migration adds a unique constraint to the clientProducts table
-- to prevent duplicate client-product mappings and fix ON CONFLICT issues.

-- Add unique constraint to clientProducts table
DO $$ 
BEGIN
    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_client_product' 
        AND table_name = 'clientProducts'
    ) THEN
        -- Remove any duplicate entries first (keep the most recent one)
        DELETE FROM "clientProducts" a USING (
            SELECT MIN(id) as id, "clientId", "productId"
            FROM "clientProducts" 
            GROUP BY "clientId", "productId" 
            HAVING COUNT(*) > 1
        ) b
        WHERE a."clientId" = b."clientId" 
        AND a."productId" = b."productId" 
        AND a.id <> b.id;
        
        -- Add the unique constraint
        ALTER TABLE "clientProducts" 
        ADD CONSTRAINT unique_client_product 
        UNIQUE ("clientId", "productId");
        
        RAISE NOTICE 'Added unique constraint to clientProducts table';
    ELSE
        RAISE NOTICE 'Unique constraint already exists on clientProducts table';
    END IF;
END $$;

-- Create index for better performance on client-product lookups
CREATE INDEX IF NOT EXISTS idx_client_products_client_id ON "clientProducts"("clientId");
CREATE INDEX IF NOT EXISTS idx_client_products_product_id ON "clientProducts"("productId");

-- Add comment to document the constraint
COMMENT ON CONSTRAINT unique_client_product ON "clientProducts" IS 'Ensures each client-product combination is unique';
