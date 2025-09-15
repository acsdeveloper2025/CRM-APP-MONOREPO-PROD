-- Migration: Update Case Assignment System Tables
-- Date: 2025-09-05
-- Description: Update existing tables and add missing columns for queue-based case assignment system

-- Add missing columns to case_assignment_history table
ALTER TABLE case_assignment_history 
ADD COLUMN IF NOT EXISTS "fromUserId" UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "toUserId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS "assignedById" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS "batchId" VARCHAR(255),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Update existing data to use new column names (map existing columns)
UPDATE case_assignment_history 
SET 
    "fromUserId" = "previousAssignee",
    "toUserId" = "newAssignee", 
    "assignedById" = "assignedBy"
WHERE "fromUserId" IS NULL OR "toUserId" IS NULL OR "assignedById" IS NULL;

-- Create missing indexes
CREATE INDEX IF NOT EXISTS idx_case_assignment_history_from_user 
    ON case_assignment_history("fromUserId");
CREATE INDEX IF NOT EXISTS idx_case_assignment_history_to_user 
    ON case_assignment_history("toUserId");
CREATE INDEX IF NOT EXISTS idx_case_assignment_history_assigned_by 
    ON case_assignment_history("assignedById");
CREATE INDEX IF NOT EXISTS idx_case_assignment_history_batch_id 
    ON case_assignment_history("batchId") WHERE "batchId" IS NOT NULL;

-- Update the case_assignment_history table to use UUID for caseId consistently
-- First, ensure we're using the UUID case_id column
ALTER TABLE case_assignment_history 
ADD COLUMN IF NOT EXISTS "caseUUID" UUID;

-- Update caseUUID with values from case_id if not already set
UPDATE case_assignment_history 
SET "caseUUID" = case_id 
WHERE "caseUUID" IS NULL AND case_id IS NOT NULL;

-- Add foreign key constraint for caseUUID
ALTER TABLE case_assignment_history 
ADD CONSTRAINT IF NOT EXISTS fk_case_assignment_history_case_uuid_new 
FOREIGN KEY ("caseUUID") REFERENCES cases(id) ON DELETE CASCADE;

-- Create case assignment queue status table (if not exists)
CREATE TABLE IF NOT EXISTS case_assignment_queue_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "batchId" VARCHAR(255) NOT NULL UNIQUE,
    "jobId" VARCHAR(255) NOT NULL,
    "createdById" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "assignedToId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "processedCases" INTEGER NOT NULL DEFAULT 0,
    "successfulAssignments" INTEGER NOT NULL DEFAULT 0,
    "failedAssignments" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP WITH TIME ZONE,
    "completedAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    errors JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for queue status
CREATE INDEX IF NOT EXISTS idx_case_assignment_queue_status_batch_id 
    ON case_assignment_queue_status("batchId");
CREATE INDEX IF NOT EXISTS idx_case_assignment_queue_status_job_id 
    ON case_assignment_queue_status("jobId");
CREATE INDEX IF NOT EXISTS idx_case_assignment_queue_status_created_by 
    ON case_assignment_queue_status("createdById");
CREATE INDEX IF NOT EXISTS idx_case_assignment_queue_status_status 
    ON case_assignment_queue_status(status);
CREATE INDEX IF NOT EXISTS idx_case_assignment_queue_status_created_at 
    ON case_assignment_queue_status("createdAt");

-- Create mobile notification queue table (if not exists)
CREATE TABLE IF NOT EXISTS mobile_notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "notificationType" VARCHAR(100) NOT NULL, -- CASE_ASSIGNED, CASE_REASSIGNED, etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, SENT, FAILED
    "scheduledAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "sentAt" TIMESTAMP WITH TIME ZONE,
    "failedAt" TIMESTAMP WITH TIME ZONE,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    error TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for mobile notifications
CREATE INDEX IF NOT EXISTS idx_mobile_notification_queue_user_id 
    ON mobile_notification_queue("userId");
CREATE INDEX IF NOT EXISTS idx_mobile_notification_queue_status 
    ON mobile_notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_mobile_notification_queue_scheduled_at 
    ON mobile_notification_queue("scheduledAt");
CREATE INDEX IF NOT EXISTS idx_mobile_notification_queue_notification_type 
    ON mobile_notification_queue("notificationType");

-- Create case assignment conflict resolution table (if not exists)
CREATE TABLE IF NOT EXISTS case_assignment_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "caseId" UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    "conflictType" VARCHAR(100) NOT NULL, -- OFFLINE_REASSIGNMENT, CONCURRENT_ASSIGNMENT, etc.
    "serverAssignedTo" UUID REFERENCES users(id) ON DELETE SET NULL,
    "clientAssignedTo" UUID REFERENCES users(id) ON DELETE SET NULL,
    "detectedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "resolvedAt" TIMESTAMP WITH TIME ZONE,
    "resolvedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
    "resolutionStrategy" VARCHAR(100), -- SERVER_WINS, CLIENT_WINS, MANUAL_RESOLUTION
    "resolutionData" JSONB DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, RESOLVED, ESCALATED
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for conflict resolution
CREATE INDEX IF NOT EXISTS idx_case_assignment_conflicts_case_id 
    ON case_assignment_conflicts("caseId");
CREATE INDEX IF NOT EXISTS idx_case_assignment_conflicts_status 
    ON case_assignment_conflicts(status);
CREATE INDEX IF NOT EXISTS idx_case_assignment_conflicts_detected_at 
    ON case_assignment_conflicts("detectedAt");

-- Add triggers for updated_at timestamps (if function exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        -- Apply triggers only if function exists
        DROP TRIGGER IF EXISTS update_case_assignment_queue_status_updated_at ON case_assignment_queue_status;
        CREATE TRIGGER update_case_assignment_queue_status_updated_at 
            BEFORE UPDATE ON case_assignment_queue_status 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS update_mobile_notification_queue_updated_at ON mobile_notification_queue;
        CREATE TRIGGER update_mobile_notification_queue_updated_at 
            BEFORE UPDATE ON mobile_notification_queue 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Create or replace views with corrected column names
DROP VIEW IF EXISTS case_assignment_analytics;
CREATE VIEW case_assignment_analytics AS
SELECT 
    DATE_TRUNC('day', cah."assignedAt") as assignment_date,
    COUNT(*) as total_assignments,
    COUNT(DISTINCT COALESCE(cah."caseUUID", cah.case_id)) as unique_cases,
    COUNT(DISTINCT cah."toUserId") as unique_assignees,
    COUNT(CASE WHEN cah."fromUserId" IS NOT NULL THEN 1 END) as reassignments,
    COUNT(CASE WHEN cah."batchId" IS NOT NULL THEN 1 END) as bulk_assignments,
    AVG(CASE WHEN cah."batchId" IS NOT NULL THEN 
        (SELECT "totalCases" FROM case_assignment_queue_status 
         WHERE "batchId" = cah."batchId" LIMIT 1) 
    END) as avg_bulk_size
FROM case_assignment_history cah
WHERE cah."assignedAt" IS NOT NULL
GROUP BY DATE_TRUNC('day', cah."assignedAt")
ORDER BY assignment_date DESC;

-- Create or replace field agent workload view
DROP VIEW IF EXISTS field_agent_workload;
CREATE VIEW field_agent_workload AS
SELECT 
    u.id as user_id,
    u.name as agent_name,
    u.email as agent_email,
    COUNT(c.id) as total_assigned_cases,
    COUNT(CASE WHEN c.status = 'ASSIGNED' THEN 1 END) as pending_cases,
    COUNT(CASE WHEN c.status = 'IN_PROGRESS' THEN 1 END) as in_progress_cases,
    COUNT(CASE WHEN c.status = 'COMPLETED' THEN 1 END) as completed_cases,
    MAX(cah."assignedAt") as last_assignment_date,
    COUNT(CASE WHEN cah."assignedAt" >= NOW() - INTERVAL '7 days' THEN 1 END) as assignments_last_7_days
FROM users u
LEFT JOIN cases c ON u.id = c."assignedTo"
LEFT JOIN case_assignment_history cah ON u.id = cah."toUserId"
WHERE u.role = 'FIELD_AGENT' AND u."isActive" = true
GROUP BY u.id, u.name, u.email
ORDER BY total_assigned_cases DESC;

-- Add comments for documentation
COMMENT ON TABLE case_assignment_history IS 'Tracks all case assignment and reassignment operations';
COMMENT ON TABLE case_assignment_queue_status IS 'Tracks status of bulk assignment operations';
COMMENT ON TABLE mobile_notification_queue IS 'Queue for mobile push notifications';
COMMENT ON TABLE case_assignment_conflicts IS 'Tracks and resolves assignment conflicts';
COMMENT ON VIEW case_assignment_analytics IS 'Analytics view for assignment operations';
COMMENT ON VIEW field_agent_workload IS 'Current workload distribution among field agents';

-- Create mobile device sync tracking table for enterprise scale
CREATE TABLE IF NOT EXISTS mobile_device_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "deviceId" VARCHAR(255) NOT NULL,
    "lastSyncAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "appVersion" VARCHAR(50) NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('iOS', 'Android')),
    "syncCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Unique constraint for user-device combination
    UNIQUE("userId", "deviceId")
);

-- Create indexes for mobile device sync
CREATE INDEX IF NOT EXISTS idx_mobile_device_sync_user_id
    ON mobile_device_sync("userId");
CREATE INDEX IF NOT EXISTS idx_mobile_device_sync_last_sync
    ON mobile_device_sync("lastSyncAt");
CREATE INDEX IF NOT EXISTS idx_mobile_device_sync_platform
    ON mobile_device_sync(platform);

-- Add trigger for mobile device sync updated_at
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS update_mobile_device_sync_updated_at ON mobile_device_sync;
        CREATE TRIGGER update_mobile_device_sync_updated_at
            BEFORE UPDATE ON mobile_device_sync
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Create enterprise sync analytics view
CREATE OR REPLACE VIEW mobile_sync_analytics AS
SELECT
    DATE_TRUNC('hour', mds."lastSyncAt") as sync_hour,
    COUNT(*) as total_syncs,
    COUNT(DISTINCT mds."userId") as unique_users,
    COUNT(DISTINCT mds."deviceId") as unique_devices,
    AVG(mds."syncCount") as avg_sync_count,
    COUNT(CASE WHEN mds.platform = 'iOS' THEN 1 END) as ios_syncs,
    COUNT(CASE WHEN mds.platform = 'Android' THEN 1 END) as android_syncs
FROM mobile_device_sync mds
WHERE mds."lastSyncAt" >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', mds."lastSyncAt")
ORDER BY sync_hour DESC;

-- Add comments
COMMENT ON TABLE mobile_device_sync IS 'Tracks mobile device synchronization for enterprise scale monitoring';
COMMENT ON VIEW mobile_sync_analytics IS 'Analytics view for mobile sync operations';

-- Success message
SELECT 'Enterprise case assignment system tables updated successfully' as result;
