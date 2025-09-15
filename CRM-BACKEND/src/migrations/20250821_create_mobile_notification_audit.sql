-- Migration: Create mobile notification audit table
-- Description: Track WebSocket notifications sent to mobile apps for compliance and debugging
-- Date: 2025-08-21

-- Create mobile notification audit table
CREATE TABLE IF NOT EXISTS mobile_notification_audit (
    id BIGSERIAL PRIMARY KEY,
    "notificationId" VARCHAR(255) NOT NULL UNIQUE,
    "userId" UUID REFERENCES users(id) ON DELETE SET NULL,
    "caseId" INTEGER,
    "notificationType" VARCHAR(100) NOT NULL,
    "notificationData" TEXT NOT NULL,
    "sentAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "deliveryStatus" VARCHAR(50) NOT NULL DEFAULT 'SENT',
    "acknowledgedAt" TIMESTAMP WITH TIME ZONE,
    "metadata" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mobile_notification_audit_user_id 
    ON mobile_notification_audit("userId");

CREATE INDEX IF NOT EXISTS idx_mobile_notification_audit_case_id 
    ON mobile_notification_audit("caseId");

CREATE INDEX IF NOT EXISTS idx_mobile_notification_audit_type 
    ON mobile_notification_audit("notificationType");

CREATE INDEX IF NOT EXISTS idx_mobile_notification_audit_status 
    ON mobile_notification_audit("deliveryStatus");

CREATE INDEX IF NOT EXISTS idx_mobile_notification_audit_sent_at 
    ON mobile_notification_audit("sentAt");

CREATE INDEX IF NOT EXISTS idx_mobile_notification_audit_notification_id 
    ON mobile_notification_audit("notificationId");

-- Create trigger to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_mobile_notification_audit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_mobile_notification_audit_updated_at
    BEFORE UPDATE ON mobile_notification_audit
    FOR EACH ROW
    EXECUTE FUNCTION update_mobile_notification_audit_updated_at();

-- Add comments for documentation
COMMENT ON TABLE mobile_notification_audit IS 'Audit log for WebSocket notifications sent to mobile applications';
COMMENT ON COLUMN mobile_notification_audit."notificationId" IS 'Unique identifier for the notification';
COMMENT ON COLUMN mobile_notification_audit."userId" IS 'ID of the user who received the notification';
COMMENT ON COLUMN mobile_notification_audit."caseId" IS 'ID of the case related to the notification';
COMMENT ON COLUMN mobile_notification_audit."notificationType" IS 'Type of notification (CASE_ASSIGNED, CASE_STATUS_CHANGED, etc.)';
COMMENT ON COLUMN mobile_notification_audit."notificationData" IS 'JSON data of the notification payload';
COMMENT ON COLUMN mobile_notification_audit."sentAt" IS 'Timestamp when notification was sent';
COMMENT ON COLUMN mobile_notification_audit."deliveryStatus" IS 'Status of notification delivery (SENT, DELIVERED, ACKNOWLEDGED, FAILED)';
COMMENT ON COLUMN mobile_notification_audit."acknowledgedAt" IS 'Timestamp when notification was acknowledged by mobile app';
COMMENT ON COLUMN mobile_notification_audit."metadata" IS 'Additional metadata about the notification';
