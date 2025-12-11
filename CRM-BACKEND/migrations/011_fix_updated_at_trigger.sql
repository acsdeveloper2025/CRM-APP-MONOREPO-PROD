-- Fix Trigger Mismatch for CamelCase updatedAt columns
-- The existing update_updated_at_column() function uses snake_case 'updated_at'
-- Tables userPincodeAssignments and userAreaAssignments use camelCase 'updatedAt'

BEGIN;

-- 1. Create a new generic trigger function for camelCase 'updatedAt'
CREATE OR REPLACE FUNCTION update_camel_case_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Fix Trigger for userPincodeAssignments
DROP TRIGGER IF EXISTS update_user_pincode_assignments_updated_at ON "userPincodeAssignments";

CREATE TRIGGER update_user_pincode_assignments_updated_at
BEFORE UPDATE ON "userPincodeAssignments"
FOR EACH ROW EXECUTE FUNCTION update_camel_case_updated_at();

-- 3. Fix Trigger for userAreaAssignments
DROP TRIGGER IF EXISTS update_user_area_assignments_updated_at ON "userAreaAssignments";

CREATE TRIGGER update_user_area_assignments_updated_at
BEFORE UPDATE ON "userAreaAssignments"
FOR EACH ROW EXECUTE FUNCTION update_camel_case_updated_at();

COMMIT;
