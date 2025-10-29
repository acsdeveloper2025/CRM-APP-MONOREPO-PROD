-- Migration: Add task_id and task_number fields to notifications table
-- This allows notifications to reference specific verification tasks instead of just cases

-- Add task_id column
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES verification_tasks(id) ON DELETE CASCADE;

-- Add task_number column
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS task_number VARCHAR(20);

-- Create index for task_id lookups
CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id);

-- Create index for task_number lookups
CREATE INDEX IF NOT EXISTS idx_notifications_task_number ON notifications(task_number);

-- Add comment
COMMENT ON COLUMN notifications.task_id IS 'Reference to specific verification task (for task-level notifications)';
COMMENT ON COLUMN notifications.task_number IS 'Human-readable task number for display in notifications';

