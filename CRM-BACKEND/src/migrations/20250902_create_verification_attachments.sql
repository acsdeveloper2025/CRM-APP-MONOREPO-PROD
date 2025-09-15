-- Create verification_attachments table to separate verification images from case attachments
CREATE TABLE IF NOT EXISTS verification_attachments (
    id SERIAL PRIMARY KEY,
    case_id UUID NOT NULL,
    "caseId" INTEGER,
    verification_type VARCHAR(50) NOT NULL, -- 'RESIDENCE', 'OFFICE', 'BUSINESS', etc.
    filename VARCHAR(255) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "thumbnailPath" VARCHAR(500),
    "uploadedBy" UUID NOT NULL,
    "geoLocation" JSONB,
    "photoType" VARCHAR(50) DEFAULT 'verification', -- 'verification', 'selfie'
    "submissionId" VARCHAR(100), -- Links to verification submission
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_verification_attachments_case_id 
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_verification_attachments_uploaded_by 
        FOREIGN KEY ("uploadedBy") REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_verification_attachments_case_id ON verification_attachments(case_id);
CREATE INDEX IF NOT EXISTS idx_verification_attachments_verification_type ON verification_attachments(verification_type);
CREATE INDEX IF NOT EXISTS idx_verification_attachments_submission_id ON verification_attachments("submissionId");
CREATE INDEX IF NOT EXISTS idx_verification_attachments_photo_type ON verification_attachments("photoType");

-- Add comments for documentation
COMMENT ON TABLE verification_attachments IS 'Stores verification images captured during mobile form submissions, separate from regular case attachments';
COMMENT ON COLUMN verification_attachments.verification_type IS 'Type of verification: RESIDENCE, OFFICE, BUSINESS, etc.';
COMMENT ON COLUMN verification_attachments."photoType" IS 'Type of photo: verification, selfie';
COMMENT ON COLUMN verification_attachments."submissionId" IS 'Links to specific verification form submission';
COMMENT ON COLUMN verification_attachments."geoLocation" IS 'GPS coordinates where photo was taken';
