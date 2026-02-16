-- Migration: Add Performance Indexes for SLA Risk Monitoring
-- Created: 2026-02-16

-- 1. Index on service_zone_id for JOIN performance
CREATE INDEX IF NOT EXISTS idx_verification_tasks_service_zone_id 
ON verification_tasks(service_zone_id);

-- 2. Composite index for SLA queries (status + first_assigned_at + service_zone_id)
-- Partial index to only index active tasks
CREATE INDEX IF NOT EXISTS idx_verification_tasks_sla_monitoring 
ON verification_tasks(status, first_assigned_at, service_zone_id)
WHERE status IN ('ASSIGNED', 'IN_PROGRESS') 
  AND first_assigned_at IS NOT NULL
  AND service_zone_id IS NOT NULL;

-- 3. Index on assigned_to for user filtering
CREATE INDEX IF NOT EXISTS idx_verification_tasks_assigned_to 
ON verification_tasks(assigned_to)
WHERE status IN ('ASSIGNED', 'IN_PROGRESS');

-- Add comments for documentation
COMMENT ON INDEX idx_verification_tasks_sla_monitoring IS 
  'Partial index for SLA risk monitoring queries. Only indexes active tasks with SLA tracking data.';
