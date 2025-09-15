-- =====================================================
-- PHASE 2: DATABASE SCHEMA ENHANCEMENTS
-- Analytics and Reporting Optimization
-- =====================================================

-- 2.1 Form Submission Tracking Table
-- Enhanced tracking for all form submissions with validation details
CREATE TABLE form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  form_type VARCHAR(50) NOT NULL CHECK (form_type IN ('RESIDENCE', 'OFFICE', 'BUSINESS')),
  submitted_by UUID NOT NULL REFERENCES users(id),
  submission_data JSONB NOT NULL DEFAULT '{}',
  validation_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (validation_status IN ('PENDING', 'VALID', 'INVALID', 'REQUIRES_REVIEW')),
  validation_errors JSONB DEFAULT '[]',
  photos_count INTEGER DEFAULT 0 CHECK (photos_count >= 0),
  attachments_count INTEGER DEFAULT 0 CHECK (attachments_count >= 0),
  geo_location JSONB DEFAULT NULL, -- {lat: number, lng: number, accuracy: number}
  submission_score DECIMAL(5,2) DEFAULT NULL CHECK (submission_score >= 0 AND submission_score <= 100),
  time_spent_minutes INTEGER DEFAULT NULL CHECK (time_spent_minutes >= 0),
  device_info JSONB DEFAULT '{}', -- Device and app version info
  network_quality VARCHAR(20) DEFAULT NULL, -- EXCELLENT, GOOD, POOR, OFFLINE
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMP DEFAULT NULL,
  validated_by UUID DEFAULT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2.2 Form Validation Logs Table
-- Detailed field-level validation tracking
CREATE TABLE form_validation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  field_value TEXT DEFAULT NULL,
  validation_rule VARCHAR(100) NOT NULL,
  is_valid BOOLEAN NOT NULL,
  error_message TEXT DEFAULT NULL,
  error_code VARCHAR(50) DEFAULT NULL,
  severity VARCHAR(20) DEFAULT 'ERROR' CHECK (severity IN ('ERROR', 'WARNING', 'INFO')),
  auto_corrected BOOLEAN DEFAULT FALSE,
  corrected_value TEXT DEFAULT NULL,
  validated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2.3 Agent Performance Daily Metrics Table
-- Daily aggregated performance metrics for agents
CREATE TABLE agent_performance_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  cases_assigned INTEGER DEFAULT 0 CHECK (cases_assigned >= 0),
  cases_completed INTEGER DEFAULT 0 CHECK (cases_completed >= 0),
  cases_in_progress INTEGER DEFAULT 0 CHECK (cases_in_progress >= 0),
  forms_submitted INTEGER DEFAULT 0 CHECK (forms_submitted >= 0),
  residence_forms INTEGER DEFAULT 0 CHECK (residence_forms >= 0),
  office_forms INTEGER DEFAULT 0 CHECK (office_forms >= 0),
  business_forms INTEGER DEFAULT 0 CHECK (business_forms >= 0),
  attachments_uploaded INTEGER DEFAULT 0 CHECK (attachments_uploaded >= 0),
  avg_completion_time_hours DECIMAL(8,2) DEFAULT NULL CHECK (avg_completion_time_hours >= 0),
  quality_score DECIMAL(5,2) DEFAULT NULL CHECK (quality_score >= 0 AND quality_score <= 100),
  validation_success_rate DECIMAL(5,2) DEFAULT NULL CHECK (validation_success_rate >= 0 AND validation_success_rate <= 100),
  total_distance_km DECIMAL(8,2) DEFAULT NULL CHECK (total_distance_km >= 0),
  active_hours DECIMAL(4,2) DEFAULT NULL CHECK (active_hours >= 0 AND active_hours <= 24),
  login_time TIMESTAMP DEFAULT NULL,
  logout_time TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure one record per agent per date
  UNIQUE(agent_id, date)
);

-- 2.4 Case Timeline Events Table
-- Detailed tracking of all case-related events
CREATE TABLE case_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_category VARCHAR(30) NOT NULL DEFAULT 'GENERAL' CHECK (event_category IN ('ASSIGNMENT', 'STATUS_CHANGE', 'FORM_SUBMISSION', 'VALIDATION', 'COMMUNICATION', 'GENERAL')),
  performed_by UUID DEFAULT NULL REFERENCES users(id),
  event_data JSONB DEFAULT '{}',
  previous_value TEXT DEFAULT NULL,
  new_value TEXT DEFAULT NULL,
  event_description TEXT DEFAULT NULL,
  is_system_generated BOOLEAN DEFAULT FALSE,
  event_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2.5 Form Quality Metrics Table
-- Track quality metrics for different form types
CREATE TABLE form_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  completeness_score DECIMAL(5,2) DEFAULT NULL CHECK (completeness_score >= 0 AND completeness_score <= 100),
  accuracy_score DECIMAL(5,2) DEFAULT NULL CHECK (accuracy_score >= 0 AND accuracy_score <= 100),
  consistency_score DECIMAL(5,2) DEFAULT NULL CHECK (consistency_score >= 0 AND consistency_score <= 100),
  timeliness_score DECIMAL(5,2) DEFAULT NULL CHECK (timeliness_score >= 0 AND timeliness_score <= 100),
  photo_quality_score DECIMAL(5,2) DEFAULT NULL CHECK (photo_quality_score >= 0 AND photo_quality_score <= 100),
  overall_quality_score DECIMAL(5,2) DEFAULT NULL CHECK (overall_quality_score >= 0 AND overall_quality_score <= 100),
  quality_issues JSONB DEFAULT '[]',
  improvement_suggestions JSONB DEFAULT '[]',
  reviewed_by UUID DEFAULT NULL REFERENCES users(id),
  reviewed_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 2.6 SCHEMA ENHANCEMENTS TO EXISTING TABLES
-- =====================================================

-- Add form completion tracking to cases table
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS form_completion_percentage DECIMAL(5,2) DEFAULT 0 CHECK (form_completion_percentage >= 0 AND form_completion_percentage <= 100),
ADD COLUMN IF NOT EXISTS quality_score DECIMAL(5,2) DEFAULT NULL CHECK (quality_score >= 0 AND quality_score <= 100),
ADD COLUMN IF NOT EXISTS last_form_submitted_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS total_forms_required INTEGER DEFAULT 1 CHECK (total_forms_required > 0),
ADD COLUMN IF NOT EXISTS forms_submitted_count INTEGER DEFAULT 0 CHECK (forms_submitted_count >= 0),
ADD COLUMN IF NOT EXISTS validation_issues_count INTEGER DEFAULT 0 CHECK (validation_issues_count >= 0);

-- Add performance tracking to users table for agents
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS performance_rating DECIMAL(3,2) DEFAULT NULL CHECK (performance_rating >= 0 AND performance_rating <= 5),
ADD COLUMN IF NOT EXISTS total_cases_handled INTEGER DEFAULT 0 CHECK (total_cases_handled >= 0),
ADD COLUMN IF NOT EXISTS avg_case_completion_days DECIMAL(6,2) DEFAULT NULL CHECK (avg_case_completion_days >= 0),
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS preferred_form_types VARCHAR(100) DEFAULT NULL;

-- =====================================================
-- 2.7 PERFORMANCE INDEXES
-- =====================================================

-- Form submissions indexes
CREATE INDEX IF NOT EXISTS idx_form_submissions_case_id ON form_submissions(case_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_by ON form_submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_type ON form_submissions(form_type);
CREATE INDEX IF NOT EXISTS idx_form_submissions_validation_status ON form_submissions(validation_status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON form_submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_form_submissions_composite ON form_submissions(form_type, validation_status, submitted_at);

-- Form validation logs indexes
CREATE INDEX IF NOT EXISTS idx_form_validation_logs_submission_id ON form_validation_logs(form_submission_id);
CREATE INDEX IF NOT EXISTS idx_form_validation_logs_field_name ON form_validation_logs(field_name);
CREATE INDEX IF NOT EXISTS idx_form_validation_logs_is_valid ON form_validation_logs(is_valid);
CREATE INDEX IF NOT EXISTS idx_form_validation_logs_validated_at ON form_validation_logs(validated_at);

-- Agent performance indexes
CREATE INDEX IF NOT EXISTS idx_agent_performance_daily_agent_id ON agent_performance_daily(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_daily_date ON agent_performance_daily(date);
CREATE INDEX IF NOT EXISTS idx_agent_performance_daily_composite ON agent_performance_daily(agent_id, date);
CREATE INDEX IF NOT EXISTS idx_agent_performance_daily_quality_score ON agent_performance_daily(quality_score);

-- Case timeline events indexes
CREATE INDEX IF NOT EXISTS idx_case_timeline_events_case_id ON case_timeline_events(case_id);
CREATE INDEX IF NOT EXISTS idx_case_timeline_events_event_type ON case_timeline_events(event_type);
CREATE INDEX IF NOT EXISTS idx_case_timeline_events_performed_by ON case_timeline_events(performed_by);
CREATE INDEX IF NOT EXISTS idx_case_timeline_events_timestamp ON case_timeline_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_case_timeline_events_composite ON case_timeline_events(case_id, event_timestamp);

-- Form quality metrics indexes
CREATE INDEX IF NOT EXISTS idx_form_quality_metrics_submission_id ON form_quality_metrics(form_submission_id);
CREATE INDEX IF NOT EXISTS idx_form_quality_metrics_overall_score ON form_quality_metrics(overall_quality_score);
CREATE INDEX IF NOT EXISTS idx_form_quality_metrics_reviewed_at ON form_quality_metrics(reviewed_at);

-- Enhanced cases table indexes
CREATE INDEX IF NOT EXISTS idx_cases_form_completion_percentage ON cases(form_completion_percentage);
CREATE INDEX IF NOT EXISTS idx_cases_quality_score ON cases(quality_score);
CREATE INDEX IF NOT EXISTS idx_cases_last_form_submitted_at ON cases(last_form_submitted_at);

-- Enhanced users table indexes for agents
CREATE INDEX IF NOT EXISTS idx_users_performance_rating ON users(performance_rating);
CREATE INDEX IF NOT EXISTS idx_users_last_active_at ON users(last_active_at);

-- =====================================================
-- 2.8 ANALYTICS VIEWS
-- =====================================================

-- View for form submission analytics
CREATE OR REPLACE VIEW form_submission_analytics AS
SELECT 
  fs.id,
  fs.case_id,
  fs.form_type,
  fs.validation_status,
  fs.submitted_at,
  fs.photos_count,
  fs.attachments_count,
  fs.submission_score,
  u.name as agent_name,
  u."employeeId" as employee_id,
  c."caseId" as case_number,
  c."customerName" as customer_name,
  c.status as case_status,
  fqm.overall_quality_score,
  fqm.completeness_score,
  fqm.accuracy_score
FROM form_submissions fs
LEFT JOIN users u ON fs.submitted_by = u.id
LEFT JOIN cases c ON fs.case_id = c.id
LEFT JOIN form_quality_metrics fqm ON fs.id = fqm.form_submission_id;

-- View for agent performance summary
CREATE OR REPLACE VIEW agent_performance_summary AS
SELECT 
  u.id as agent_id,
  u.name as agent_name,
  u."employeeId" as employee_id,
  u.email,
  d.name as department_name,
  COUNT(DISTINCT c.id) as total_cases_assigned,
  COUNT(DISTINCT CASE WHEN c.status IN ('COMPLETED', 'APPROVED') THEN c.id END) as cases_completed,
  COUNT(DISTINCT fs.id) as total_forms_submitted,
  COUNT(DISTINCT CASE WHEN fs.form_type = 'RESIDENCE' THEN fs.id END) as residence_forms_submitted,
  COUNT(DISTINCT CASE WHEN fs.form_type = 'OFFICE' THEN fs.id END) as office_forms_submitted,
  COUNT(DISTINCT CASE WHEN fs.form_type = 'BUSINESS' THEN fs.id END) as business_forms_submitted,
  AVG(fqm.overall_quality_score) as avg_quality_score,
  AVG(EXTRACT(EPOCH FROM (c."updatedAt" - c."createdAt"))/86400) as avg_completion_days,
  COUNT(DISTINCT a.id) as attachments_uploaded,
  MAX(u.last_active_at) as last_active_at
FROM users u
LEFT JOIN departments d ON u."departmentId" = d.id
LEFT JOIN cases c ON c."assignedTo" = u.id
LEFT JOIN form_submissions fs ON fs.submitted_by = u.id
LEFT JOIN form_quality_metrics fqm ON fs.id = fqm.form_submission_id
LEFT JOIN attachments a ON a."uploadedBy" = u.id
WHERE u.role = 'FIELD_AGENT'
GROUP BY u.id, u.name, u."employeeId", u.email, d.name;

-- View for case completion analytics
CREATE OR REPLACE VIEW case_completion_analytics AS
SELECT 
  c.id,
  c."caseId",
  c."customerName",
  c.status,
  c.priority,
  c."assignedTo",
  u.name as agent_name,
  u."employeeId" as employee_id,
  cl.name as client_name,
  c.form_completion_percentage,
  c.quality_score,
  c.forms_submitted_count,
  c.total_forms_required,
  COUNT(DISTINCT fs.id) as actual_forms_submitted,
  COUNT(DISTINCT CASE WHEN fs.validation_status = 'VALID' THEN fs.id END) as valid_forms,
  COUNT(DISTINCT a.id) as attachment_count,
  EXTRACT(EPOCH FROM (c."updatedAt" - c."createdAt"))/86400 as completion_days,
  c."createdAt",
  c."updatedAt"
FROM cases c
LEFT JOIN users u ON c."assignedTo" = u.id
LEFT JOIN clients cl ON c."clientId" = cl.id
LEFT JOIN form_submissions fs ON fs.case_id = c.id
LEFT JOIN attachments a ON a.case_id = c.id
GROUP BY c.id, c."caseId", c."customerName", c.status, c.priority, c."assignedTo", 
         u.name, u."employeeId", cl.name, c.form_completion_percentage, c.quality_score,
         c.forms_submitted_count, c.total_forms_required, c."createdAt", c."updatedAt";

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
