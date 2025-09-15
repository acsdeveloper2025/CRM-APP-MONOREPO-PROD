-- Comprehensive Notification System Database Schema
-- Migration: 001_create_notifications_schema.sql

-- Notification tokens table for push notification device registration
CREATE TABLE IF NOT EXISTS notification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('IOS', 'ANDROID', 'WEB')),
  push_token TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique token per device
  UNIQUE(device_id, platform)
);

-- Create indexes for notification_tokens
CREATE INDEX IF NOT EXISTS idx_notification_tokens_user_id ON notification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_tokens_platform ON notification_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_notification_tokens_active ON notification_tokens(is_active);

-- Notification preferences table for user notification settings
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Case assignment notifications
  case_assignment_enabled BOOLEAN DEFAULT true,
  case_assignment_push BOOLEAN DEFAULT true,
  case_assignment_websocket BOOLEAN DEFAULT true,
  
  -- Case reassignment notifications
  case_reassignment_enabled BOOLEAN DEFAULT true,
  case_reassignment_push BOOLEAN DEFAULT true,
  case_reassignment_websocket BOOLEAN DEFAULT true,
  
  -- Case completion notifications (for backend users)
  case_completion_enabled BOOLEAN DEFAULT true,
  case_completion_push BOOLEAN DEFAULT false,
  case_completion_websocket BOOLEAN DEFAULT true,
  
  -- Case revocation notifications (for backend users)
  case_revocation_enabled BOOLEAN DEFAULT true,
  case_revocation_push BOOLEAN DEFAULT false,
  case_revocation_websocket BOOLEAN DEFAULT true,
  
  -- System notifications
  system_notifications_enabled BOOLEAN DEFAULT true,
  system_notifications_push BOOLEAN DEFAULT true,
  system_notifications_websocket BOOLEAN DEFAULT true,
  
  -- Quiet hours (24-hour format)
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00:00',
  quiet_hours_end TIME DEFAULT '08:00:00',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one preference record per user
  UNIQUE(user_id)
);

-- Create indexes for notification_preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Main notifications table for storing all notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Recipient information
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification content
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'CASE_ASSIGNED', 'CASE_REASSIGNED', 'CASE_REMOVED',
    'CASE_COMPLETED', 'CASE_REVOKED', 'CASE_APPROVED', 'CASE_REJECTED',
    'SYSTEM_MAINTENANCE', 'APP_UPDATE', 'EMERGENCY_ALERT'
  )),
  
  -- Related entity information
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  case_number VARCHAR(50),
  
  -- Notification data (JSON for additional context)
  data JSONB DEFAULT '{}',
  
  -- Navigation information
  action_url VARCHAR(500), -- Deep link or web route
  action_type VARCHAR(50) DEFAULT 'NAVIGATE', -- NAVIGATE, OPEN_CASE, OPEN_FORM, etc.
  
  -- Delivery status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Delivery tracking
  delivery_status VARCHAR(20) DEFAULT 'PENDING' CHECK (delivery_status IN (
    'PENDING', 'SENT', 'DELIVERED', 'FAILED', 'ACKNOWLEDGED'
  )),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  
  -- Priority and expiration
  priority VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_case_id ON notifications(case_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_delivery_status ON notifications(delivery_status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at);

-- Notification delivery log for tracking delivery attempts
CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  
  -- Delivery method
  delivery_method VARCHAR(20) NOT NULL CHECK (delivery_method IN ('PUSH', 'WEBSOCKET', 'EMAIL')),
  
  -- Delivery attempt information
  attempt_number INTEGER DEFAULT 1,
  delivery_status VARCHAR(20) NOT NULL CHECK (delivery_status IN (
    'PENDING', 'SENT', 'DELIVERED', 'FAILED', 'RETRY'
  )),
  
  -- Error information
  error_code VARCHAR(50),
  error_message TEXT,
  
  -- Device/platform information
  device_id VARCHAR(255),
  platform VARCHAR(20),
  push_token_used TEXT,
  
  -- Timing information
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Response information
  response_data JSONB DEFAULT '{}'
);

-- Create indexes for notification_delivery_log
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_notification_id ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_delivery_method ON notification_delivery_log(delivery_method);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_delivery_status ON notification_delivery_log(delivery_status);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_attempted_at ON notification_delivery_log(attempted_at DESC);

-- Notification batch table for bulk operations
CREATE TABLE IF NOT EXISTS notification_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Batch information
  batch_name VARCHAR(255),
  batch_type VARCHAR(50) NOT NULL CHECK (batch_type IN (
    'BULK_ASSIGNMENT', 'SYSTEM_ANNOUNCEMENT', 'EMERGENCY_ALERT', 'MAINTENANCE_NOTICE'
  )),
  
  -- Target information
  target_user_ids UUID[] DEFAULT '{}',
  target_roles VARCHAR(50)[] DEFAULT '{}',
  
  -- Batch status
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'
  )),
  
  -- Statistics
  total_notifications INTEGER DEFAULT 0,
  sent_notifications INTEGER DEFAULT 0,
  failed_notifications INTEGER DEFAULT 0,
  
  -- Timing
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for notification_batches
CREATE INDEX IF NOT EXISTS idx_notification_batches_status ON notification_batches(status);
CREATE INDEX IF NOT EXISTS idx_notification_batches_batch_type ON notification_batches(batch_type);
CREATE INDEX IF NOT EXISTS idx_notification_batches_scheduled_at ON notification_batches(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_batches_created_by ON notification_batches(created_by);

-- Create default notification preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM users 
WHERE id NOT IN (SELECT user_id FROM notification_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- Create function to automatically create notification preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create notification preferences for new users
DROP TRIGGER IF EXISTS trigger_create_notification_preferences ON users;
CREATE TRIGGER trigger_create_notification_preferences
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_preferences();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS trigger_notification_tokens_updated_at ON notification_tokens;
CREATE TRIGGER trigger_notification_tokens_updated_at
  BEFORE UPDATE ON notification_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER trigger_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_notifications_updated_at ON notifications;
CREATE TRIGGER trigger_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_notification_batches_updated_at ON notification_batches;
CREATE TRIGGER trigger_notification_batches_updated_at
  BEFORE UPDATE ON notification_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
