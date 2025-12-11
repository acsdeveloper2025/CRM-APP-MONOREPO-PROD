-- Fix Unique Constraints for Territory Assignments
-- Currently, the constraints include "isActive" which prevents multiple inactive history records.
-- We want to allow multiple inactive records, but restrict active records to be unique.

BEGIN;

-- 1. Fix userPincodeAssignments
ALTER TABLE "userPincodeAssignments"
DROP CONSTRAINT IF EXISTS "uk_user_pincode_assignments_user_pincode_active";

-- Create a partial unique index for ACTIVE assignments only
CREATE UNIQUE INDEX "uk_user_pincode_assignments_active_only"
ON "userPincodeAssignments" ("userId", "pincodeId")
WHERE "isActive" = true;

-- 2. Fix userAreaAssignments
ALTER TABLE "userAreaAssignments"
DROP CONSTRAINT IF EXISTS "uk_user_area_assignments_user_pincode_area_active";

-- Create a partial unique index for ACTIVE assignments only
CREATE UNIQUE INDEX "uk_user_area_assignments_active_only"
ON "userAreaAssignments" ("userId", "pincodeId", "areaId")
WHERE "isActive" = true;

COMMIT;
