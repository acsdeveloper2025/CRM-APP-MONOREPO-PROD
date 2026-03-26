-- Migration: Add task.revoke permission to permissions table
-- This permission is used in verificationTasks routes but was missing from the permissions catalog

INSERT INTO permissions (code, module, description)
VALUES ('task.revoke', 'VISIT', 'Revoke/cancel verification tasks')
ON CONFLICT (code) DO NOTHING;
