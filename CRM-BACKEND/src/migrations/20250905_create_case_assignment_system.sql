-- Migration: Create Case Assignment System Tables
-- Date: 2025-09-05
-- Description: Create tables and indexes for queue-based case assignment system

-- Create case assignment history table
CREATE TABLE IF NOT EXISTS case_assignment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "caseId" UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    "fromUserId" UUID REFERENCES users(id) ON DELETE SET NULL,
    "toUserId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "assignedById" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    "assignedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "batchId" VARCHAR(255), -- For bulk assignments
    metadata JSONB DEFAULT '{}',
    
    -- Indexes for performance
    CONSTRAINT case_assignment_history_case_id_idx 
        FOREIGN KEY ("caseId") REFERENCES cases(id),
    CONSTRAINT case_assignment_history_from_user_idx 
        FOREIGN KEY ("fromUserId") REFERENCES users(id),
    CONSTRAINT case_assignment_history_to_user_idx 
        FOREIGN KEY ("toUserId") REFERENCES users(id),
    CONSTRAINT case_assignment_history_assigned_by_idx 
        FOREIGN KEY ("assignedById") REFERENCES users(id)
);

-- Create indexes for case assignment history
CREATE INDEX IF NOT EXISTS idx_case_assignment_history_case_id 
    ON case_assignment_history("caseId");
CREATE INDEX IF NOT EXISTS idx_case_assignment_history_to_user 
    ON case_assignment_history("toUserId");
CREATE INDEX IF NOT EXISTS idx_case_assignment_history_assigned_at 
    ON case_assignment_history("assignedAt");
CREATE INDEX IF NOT EXISTS idx_case_assignment_history_batch_id 
    ON case_assignment_history("batchId") WHERE "batchId" IS NOT NULL;

-- Create case assignment queue status table
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

-- Create mobile notification queue table
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

-- Create case assignment conflict resolution table
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

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_case_assignment_queue_status_updated_at 
    BEFORE UPDATE ON case_assignment_queue_status 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mobile_notification_queue_updated_at 
    BEFORE UPDATE ON mobile_notification_queue 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for case assignment analytics
CREATE OR REPLACE VIEW case_assignment_analytics AS
SELECT 
    DATE_TRUNC('day', cah."assignedAt") as assignment_date,
    COUNT(*) as total_assignments,
    COUNT(DISTINCT cah."caseId") as unique_cases,
    COUNT(DISTINCT cah."toUserId") as unique_assignees,
    COUNT(CASE WHEN cah."fromUserId" IS NOT NULL THEN 1 END) as reassignments,
    COUNT(CASE WHEN cah."batchId" IS NOT NULL THEN 1 END) as bulk_assignments,
    AVG(CASE WHEN cah."batchId" IS NOT NULL THEN 
        (SELECT "totalCases" FROM case_assignment_queue_status 
         WHERE "batchId" = cah."batchId" LIMIT 1) 
    END) as avg_bulk_size
FROM case_assignment_history cah
GROUP BY DATE_TRUNC('day', cah."assignedAt")
ORDER BY assignment_date DESC;

-- Create view for field agent workload
CREATE OR REPLACE VIEW field_agent_workload AS
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

-- Insert initial data or update existing records
-- (This section can be used for data migration if needed)

-- Add comments for documentation
COMMENT ON TABLE case_assignment_history IS 'Tracks all case assignment and reassignment operations';
COMMENT ON TABLE case_assignment_queue_status IS 'Tracks status of bulk assignment operations';
COMMENT ON TABLE mobile_notification_queue IS 'Queue for mobile push notifications';
COMMENT ON TABLE case_assignment_conflicts IS 'Tracks and resolves assignment conflicts';
COMMENT ON VIEW case_assignment_analytics IS 'Analytics view for assignment operations';
COMMENT ON VIEW field_agent_workload IS 'Current workload distribution among field agents';

-- Grant permissions (adjust as needed for your user roles)
-- GRANT SELECT, INSERT, UPDATE ON case_assignment_history TO crm_app_role;
-- GRANT SELECT, INSERT, UPDATE ON case_assignment_queue_status TO crm_app_role;
-- GRANT SELECT, INSERT, UPDATE ON mobile_notification_queue TO crm_app_role;
-- GRANT SELECT, INSERT, UPDATE ON case_assignment_conflicts TO crm_app_role;
-- GRANT SELECT ON case_assignment_analytics TO crm_app_role;
-- GRANT SELECT ON field_agent_workload TO crm_app_role;
