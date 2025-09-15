-- Migration: Add submission progress and retry queue tables
-- Date: 2025-09-02
-- Description: Add tables to track submission progress, retry queue, and compression statistics

-- Create submission_progress table
CREATE TABLE IF NOT EXISTS submission_progress (
    id VARCHAR(255) PRIMARY KEY,
    case_id VARCHAR(255) NOT NULL,
    verification_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PREPARING',
    overall_progress INTEGER NOT NULL DEFAULT 0,
    current_step VARCHAR(100) NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]',
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    estimated_time_remaining INTEGER,
    bytes_uploaded BIGINT DEFAULT 0,
    total_bytes BIGINT,
    upload_speed BIGINT DEFAULT 0,
    compression_stats JSONB,
    retry_info JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create retry_queue table
CREATE TABLE IF NOT EXISTS retry_queue (
    id VARCHAR(255) PRIMARY KEY,
    case_id VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    method VARCHAR(10) NOT NULL,
    headers JSONB NOT NULL DEFAULT '{}',
    body TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    last_attempt TIMESTAMP NOT NULL,
    next_retry TIMESTAMP NOT NULL,
    error TEXT,
    priority VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_submission_progress_case_id ON submission_progress(case_id);
CREATE INDEX IF NOT EXISTS idx_submission_progress_status ON submission_progress(status);
CREATE INDEX IF NOT EXISTS idx_submission_progress_created_at ON submission_progress(created_at);

CREATE INDEX IF NOT EXISTS idx_retry_queue_case_id ON retry_queue(case_id);
CREATE INDEX IF NOT EXISTS idx_retry_queue_status ON retry_queue(status);
CREATE INDEX IF NOT EXISTS idx_retry_queue_next_retry ON retry_queue(next_retry);
CREATE INDEX IF NOT EXISTS idx_retry_queue_priority ON retry_queue(priority);
CREATE INDEX IF NOT EXISTS idx_retry_queue_created_at ON retry_queue(created_at);

-- Add foreign key constraints (if cases table exists)
DO $$
BEGIN
    -- Check if cases table exists before adding foreign key
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cases') THEN
        -- Add foreign key constraint for submission_progress
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_submission_progress_case_id'
        ) THEN
            ALTER TABLE submission_progress 
            ADD CONSTRAINT fk_submission_progress_case_id 
            FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;
        END IF;
        
        -- Add foreign key constraint for retry_queue
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_retry_queue_case_id'
        ) THEN
            ALTER TABLE retry_queue 
            ADD CONSTRAINT fk_retry_queue_case_id 
            FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Add check constraints
ALTER TABLE submission_progress 
ADD CONSTRAINT chk_submission_progress_status 
CHECK (status IN ('PREPARING', 'UPLOADING', 'SUBMITTING', 'COMPLETED', 'FAILED'));

ALTER TABLE submission_progress 
ADD CONSTRAINT chk_submission_progress_overall_progress 
CHECK (overall_progress >= 0 AND overall_progress <= 100);

ALTER TABLE retry_queue 
ADD CONSTRAINT chk_retry_queue_method 
CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE'));

ALTER TABLE retry_queue 
ADD CONSTRAINT chk_retry_queue_priority 
CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW'));

ALTER TABLE retry_queue 
ADD CONSTRAINT chk_retry_queue_type 
CHECK (type IN ('VERIFICATION_SUBMISSION', 'ATTACHMENT_UPLOAD', 'CASE_UPDATE'));

ALTER TABLE retry_queue 
ADD CONSTRAINT chk_retry_queue_status 
CHECK (status IN ('PENDING', 'RETRYING', 'SUCCESS', 'FAILED'));

ALTER TABLE retry_queue 
ADD CONSTRAINT chk_retry_queue_attempts 
CHECK (attempts >= 0 AND attempts <= max_attempts);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic updated_at updates
DROP TRIGGER IF EXISTS update_submission_progress_updated_at ON submission_progress;
CREATE TRIGGER update_submission_progress_updated_at
    BEFORE UPDATE ON submission_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_retry_queue_updated_at ON retry_queue;
CREATE TRIGGER update_retry_queue_updated_at
    BEFORE UPDATE ON retry_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing (optional)
-- This can be removed in production
INSERT INTO submission_progress (
    id, case_id, verification_type, status, overall_progress, current_step,
    steps, start_time, created_at, updated_at
) VALUES (
    'sample_submission_001',
    '62cb776f-db6f-4e43-a5a9-04aaad802be4',
    'residence',
    'COMPLETED',
    100,
    'confirmation',
    '[
        {"id": "validation", "name": "Validating Form Data", "status": "COMPLETED", "progress": 100},
        {"id": "compression", "name": "Optimizing Data", "status": "COMPLETED", "progress": 100},
        {"id": "upload_photos", "name": "Uploading Photos", "status": "COMPLETED", "progress": 100},
        {"id": "submit_form", "name": "Submitting Verification", "status": "COMPLETED", "progress": 100},
        {"id": "confirmation", "name": "Processing Confirmation", "status": "COMPLETED", "progress": 100}
    ]',
    NOW() - INTERVAL '5 minutes',
    NOW() - INTERVAL '5 minutes',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE submission_progress IS 'Tracks real-time progress of case verification submissions from mobile app';
COMMENT ON TABLE retry_queue IS 'Manages failed requests that need to be retried with exponential backoff';

COMMENT ON COLUMN submission_progress.case_id IS 'Reference to the case being submitted';
COMMENT ON COLUMN submission_progress.verification_type IS 'Type of verification (residence, office, business, etc.)';
COMMENT ON COLUMN submission_progress.status IS 'Overall submission status';
COMMENT ON COLUMN submission_progress.overall_progress IS 'Overall progress percentage (0-100)';
COMMENT ON COLUMN submission_progress.current_step IS 'Currently active step ID';
COMMENT ON COLUMN submission_progress.steps IS 'JSON array of all submission steps with their status and progress';
COMMENT ON COLUMN submission_progress.compression_stats IS 'JSON object with compression statistics (original size, compressed size, ratio)';
COMMENT ON COLUMN submission_progress.retry_info IS 'JSON object with retry information (attempts, next retry time, etc.)';

COMMENT ON COLUMN retry_queue.case_id IS 'Reference to the case for this retry request';
COMMENT ON COLUMN retry_queue.url IS 'API endpoint URL to retry';
COMMENT ON COLUMN retry_queue.method IS 'HTTP method (GET, POST, PUT, etc.)';
COMMENT ON COLUMN retry_queue.headers IS 'JSON object with HTTP headers';
COMMENT ON COLUMN retry_queue.body IS 'Request body content';
COMMENT ON COLUMN retry_queue.attempts IS 'Number of retry attempts made';
COMMENT ON COLUMN retry_queue.max_attempts IS 'Maximum number of retry attempts allowed';
COMMENT ON COLUMN retry_queue.next_retry IS 'Timestamp when next retry should be attempted';
COMMENT ON COLUMN retry_queue.priority IS 'Request priority (HIGH, MEDIUM, LOW)';
COMMENT ON COLUMN retry_queue.type IS 'Type of request being retried';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON submission_progress TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON retry_queue TO your_app_user;
