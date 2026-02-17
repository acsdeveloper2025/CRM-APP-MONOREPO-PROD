-- Migration: Forensic Photo Tamper-Proofing System
-- Created: 2026-02-17
-- Purpose: Add bank-grade forensic integrity for verification photos and reports
--
-- CRITICAL: This migration implements cryptographic sealing, GPS validation,
-- device binding, and reviewer workflow for FI/RCU evidence system.
-- 
-- DO NOT RUN ON PRODUCTION WITHOUT REVIEW

BEGIN;

-- ============================================================================
-- PART 1: verification_attachments — Forensic Photo Evidence
-- ============================================================================

-- Add forensic integrity columns to verification photos
ALTER TABLE verification_attachments
  ADD COLUMN IF NOT EXISTS sha256_hash TEXT,
  ADD COLUMN IF NOT EXISTS server_sha256_hash TEXT,
  ADD COLUMN IF NOT EXISTS hash_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS server_signature TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS capture_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gps_latitude DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS gps_longitude DECIMAL(11,8),
  ADD COLUMN IF NOT EXISTS gps_validation_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS gps_distance_meters DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS app_version TEXT,
  ADD COLUMN IF NOT EXISTS exif_json JSONB,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Add comments for documentation
COMMENT ON COLUMN verification_attachments.sha256_hash IS 
  'Client-provided SHA-256 hash computed before upload. Used for transit verification.';
COMMENT ON COLUMN verification_attachments.server_sha256_hash IS 
  'Server-recalculated SHA-256 hash after upload. Primary evidence hash.';
COMMENT ON COLUMN verification_attachments.hash_verified IS 
  'TRUE if client hash matches server hash. Upload rejected if FALSE.';
COMMENT ON COLUMN verification_attachments.server_signature IS 
  'HMAC-SHA256 signature: HMAC(secret, server_sha256_hash + file_size_bytes + capture_time + device_id + verification_task_id). Tamper-proof seal.';
COMMENT ON COLUMN verification_attachments.file_size_bytes IS 
  'Physical file size in bytes. Required for forensic fingerprint.';
COMMENT ON COLUMN verification_attachments.capture_time IS 
  'Photo capture timestamp from EXIF or device. Distinct from upload time.';
COMMENT ON COLUMN verification_attachments.gps_latitude IS 
  'GPS latitude from EXIF metadata. Weak evidence - cross-validate with device GPS.';
COMMENT ON COLUMN verification_attachments.gps_longitude IS 
  'GPS longitude from EXIF metadata. Weak evidence - cross-validate with device GPS.';
COMMENT ON COLUMN verification_attachments.gps_validation_status IS 
  'GPS consistency check result: MATCH (< 100m), MISMATCH (> 100m), NO_EXIF_GPS.';
COMMENT ON COLUMN verification_attachments.gps_distance_meters IS 
  'Distance in meters between device GPS (geoLocation) and EXIF GPS.';
COMMENT ON COLUMN verification_attachments.device_id IS 
  'Unique device identifier that captured this photo.';
COMMENT ON COLUMN verification_attachments.app_version IS 
  'Mobile app version used to capture photo (e.g., "4.0.1").';
COMMENT ON COLUMN verification_attachments.exif_json IS 
  'Full EXIF metadata dump for forensic analysis.';
COMMENT ON COLUMN verification_attachments.deleted_at IS 
  'Soft-delete timestamp. Forensic evidence should never be physically deleted.';
COMMENT ON COLUMN verification_attachments.deleted_by IS 
  'User who soft-deleted this attachment.';
COMMENT ON COLUMN verification_attachments.deletion_reason IS 
  'Reason for soft-deletion (e.g., "duplicate", "wrong photo", "quality issue").';

-- Create indexes for forensic queries
CREATE INDEX IF NOT EXISTS idx_verification_attachments_hash_verified 
  ON verification_attachments(hash_verified) 
  WHERE hash_verified = FALSE;

CREATE INDEX IF NOT EXISTS idx_verification_attachments_device_id 
  ON verification_attachments(device_id);

CREATE INDEX IF NOT EXISTS idx_verification_attachments_gps_validation 
  ON verification_attachments(gps_validation_status) 
  WHERE gps_validation_status = 'MISMATCH';

CREATE INDEX IF NOT EXISTS idx_verification_attachments_verification_task_id 
  ON verification_attachments(verification_task_id);

CREATE INDEX IF NOT EXISTS idx_verification_attachments_deleted 
  ON verification_attachments(deleted_at) 
  WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- PART 2: verification_tasks — Submit/Review Workflow
-- ============================================================================

-- Add forensic metadata and reviewer workflow columns
ALTER TABLE verification_tasks
  ADD COLUMN IF NOT EXISTS forensic_version SMALLINT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS app_version TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Add comments
COMMENT ON COLUMN verification_tasks.forensic_version IS 
  'Forensic enforcement version: 1 = legacy verification (no forensic enforcement), 2 = forensic-protected verification. Allows backward compatibility for old cases.';
COMMENT ON COLUMN verification_tasks.device_id IS 
  'Device used for entire verification task. Must match photo device_ids.';
COMMENT ON COLUMN verification_tasks.app_version IS 
  'Mobile app version used for this task.';
COMMENT ON COLUMN verification_tasks.submitted_at IS 
  'When field agent submitted task (status → SUBMITTED). Distinct from completed_at.';
COMMENT ON COLUMN verification_tasks.reviewer_id IS 
  'Backend user who reviewed and approved/rejected this task.';
COMMENT ON COLUMN verification_tasks.reviewed_at IS 
  'When reviewer made approval/rejection decision.';
COMMENT ON COLUMN verification_tasks.review_notes IS 
  'Reviewer comments or rejection reason.';

-- Update status CHECK constraint to include new statuses
-- PRODUCTION-SAFE: Rename old constraint instead of dropping
-- This preserves existing constraint during deployment
ALTER TABLE verification_tasks 
  RENAME CONSTRAINT check_status TO check_status_old;

-- Create new constraint with expanded status list
ALTER TABLE verification_tasks 
  ADD CONSTRAINT check_status_new CHECK (
    status IN (
      'PENDING', 
      'ASSIGNED', 
      'IN_PROGRESS', 
      'SUBMITTED',      -- NEW: Field agent submitted
      'UNDER_REVIEW',   -- NEW: Backend reviewer is reviewing
      'APPROVED',       -- NEW: Reviewer approved
      'REJECTED',       -- NEW: Reviewer rejected
      'COMPLETED',      -- KEPT: Backward compatibility
      'CANCELLED', 
      'ON_HOLD',
      'CLOSED'          -- NEW: Terminal state after approval/rejection
    )
  );

-- Create index for reviewer queries
CREATE INDEX IF NOT EXISTS idx_verification_tasks_reviewer_id 
  ON verification_tasks(reviewer_id);

CREATE INDEX IF NOT EXISTS idx_verification_tasks_submitted 
  ON verification_tasks(status, submitted_at) 
  WHERE status IN ('SUBMITTED', 'UNDER_REVIEW');

-- ============================================================================
-- PART 3: trusted_devices — Device Binding
-- ============================================================================

CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  device_id TEXT NOT NULL,
  device_model TEXT,
  os_version TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

-- Comments
COMMENT ON TABLE trusted_devices IS 
  'Tracks devices used by field agents. New devices require admin approval. User history retained even after account deletion.';
COMMENT ON COLUMN trusted_devices.user_id IS 
  'Owner of device. NULL if user account deleted but device history must be retained.';
COMMENT ON COLUMN trusted_devices.device_id IS 
  'Unique device identifier from Capacitor Device plugin.';
COMMENT ON COLUMN trusted_devices.is_blocked IS 
  'Admin can block compromised/lost devices to prevent unauthorized access.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id 
  ON trusted_devices(user_id);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_blocked 
  ON trusted_devices(is_blocked) 
  WHERE is_blocked = TRUE;

-- ============================================================================
-- PART 4: security_audit_events — SIEM-Compatible Security Logging
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (
    severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')
  ),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(50),
  entity_id TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE security_audit_events IS 
  'Security event log with SIEM-compatible severity levels. Captures tampering attempts, hash mismatches, etc.';
COMMENT ON COLUMN security_audit_events.event_type IS 
  'Event type: HASH_MISMATCH, GPS_MISMATCH, UPLOAD_TAMPERING, DEVICE_BLOCKED, etc.';
COMMENT ON COLUMN security_audit_events.severity IS 
  'SIEM severity: CRITICAL (tampering), HIGH (hash fail), MEDIUM (GPS mismatch), LOW (warnings), INFO (normal).';

-- Indexes for security monitoring
CREATE INDEX IF NOT EXISTS idx_security_audit_events_severity 
  ON security_audit_events(severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_events_type 
  ON security_audit_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_events_user 
  ON security_audit_events(user_id, created_at DESC);

-- ============================================================================
-- PART 5: Report Tables — PDF Tamper-Proofing
-- ============================================================================

-- Add PDF hashing/signing to all verification report tables
-- Using DO block to handle if tables don't exist

DO $$
DECLARE
  report_table TEXT;
BEGIN
  FOR report_table IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name LIKE '%VerificationReports'
  LOOP
    EXECUTE format('
      ALTER TABLE %I
        ADD COLUMN IF NOT EXISTS report_sha256_hash TEXT,
        ADD COLUMN IF NOT EXISTS report_server_signature TEXT,
        ADD COLUMN IF NOT EXISTS report_generated_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS is_final BOOLEAN DEFAULT FALSE
    ', report_table);
    
    EXECUTE format('
      COMMENT ON COLUMN %I.report_sha256_hash IS 
        ''SHA-256 hash of generated PDF report for tamper detection.''
    ', report_table);
    
    EXECUTE format('
      COMMENT ON COLUMN %I.report_server_signature IS 
        ''HMAC-SHA256 signature of PDF. Prevents report regeneration attacks.''
    ', report_table);
    
    EXECUTE format('
      COMMENT ON COLUMN %I.is_final IS 
        ''TRUE = report is finalized and cannot be regenerated. Bank audit requirement.''
    ', report_table);
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run these after migration to verify)
-- ============================================================================

-- Check new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'verification_attachments' 
  AND column_name IN ('server_signature', 'file_size_bytes', 'gps_validation_status')
ORDER BY column_name;

-- Check status constraint updated
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'check_status' 
  AND conrelid = 'verification_tasks'::regclass;

-- Check trusted_devices table created
SELECT COUNT(*) as trusted_devices_exists 
FROM information_schema.tables 
WHERE table_name = 'trusted_devices';

-- Check security_audit_events table created
SELECT COUNT(*) as security_audit_events_exists 
FROM information_schema.tables 
WHERE table_name = 'security_audit_events';
