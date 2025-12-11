-- Consolidated migration for User Deletion improvements
-- 1. Adds ON DELETE CASCADE to related tables (Safe Cleanup for hard deletes)
-- 2. Adds "deletedAt" column to users table (Soft Delete support)

BEGIN;

-- Part 1: Cascading Deletes for Assignments and Preferences
-- 1. Notification Preferences
ALTER TABLE "notification_preferences" 
  DROP CONSTRAINT IF EXISTS "notification_preferences_user_id_fkey",
  ADD CONSTRAINT "notification_preferences_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- 2. Notifications
ALTER TABLE "notifications" 
  DROP CONSTRAINT IF EXISTS "notifications_user_id_fkey",
  ADD CONSTRAINT "notifications_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- 3. User Client Assignments
ALTER TABLE "userClientAssignments" 
  DROP CONSTRAINT IF EXISTS "userClientAssignments_userId_fkey",
  ADD CONSTRAINT "userClientAssignments_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

-- 4. User Product Assignments
ALTER TABLE "userProductAssignments" 
  DROP CONSTRAINT IF EXISTS "userProductAssignments_userId_fkey",
  ADD CONSTRAINT "userProductAssignments_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

-- 5. User Pincode Assignments
ALTER TABLE "userPincodeAssignments" 
  DROP CONSTRAINT IF EXISTS "userPincodeAssignments_userId_fkey",
  ADD CONSTRAINT "userPincodeAssignments_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

-- 6. User Area Assignments
ALTER TABLE "userAreaAssignments" 
  DROP CONSTRAINT IF EXISTS "userAreaAssignments_userId_fkey",
  ADD CONSTRAINT "userAreaAssignments_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;


-- Part 2: Soft Delete Support
-- Check if column exists to be safe (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='deletedAt') THEN
        ALTER TABLE users ADD COLUMN "deletedAt" TIMESTAMPTZ DEFAULT NULL;
        CREATE INDEX idx_users_deleted_at ON users("deletedAt");
    END IF;
END
$$;


-- Part 3: Backfill Missing Timestamps
-- Ensures all users have createdAt/updatedAt
UPDATE users
SET
    "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
    "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE
    "createdAt" IS NULL
    OR "updatedAt" IS NULL;

COMMIT;
