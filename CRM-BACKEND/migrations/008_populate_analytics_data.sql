-- =====================================================
-- PHASE 2: POPULATE ANALYTICS DATA
-- Sample data for testing analytics features
-- =====================================================

-- Function to generate random timestamps within a date range
CREATE OR REPLACE FUNCTION random_timestamp(start_date DATE, end_date DATE)
RETURNS TIMESTAMP AS $$
BEGIN
  RETURN start_date + (random() * (end_date - start_date)) + (random() * INTERVAL '24 hours');
END;
$$ LANGUAGE plpgsql;

-- Function to generate random decimal within range
CREATE OR REPLACE FUNCTION random_decimal(min_val DECIMAL, max_val DECIMAL, precision_val INTEGER DEFAULT 2)
RETURNS DECIMAL AS $$
BEGIN
  RETURN ROUND((random() * (max_val - min_val) + min_val)::NUMERIC, precision_val);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2.1 POPULATE FORM SUBMISSIONS
-- =====================================================

-- Insert form submissions for existing cases
INSERT INTO form_submissions (
  case_id, 
  form_type, 
  submitted_by, 
  submission_data,
  validation_status,
  validation_errors,
  photos_count,
  attachments_count,
  geo_location,
  submission_score,
  time_spent_minutes,
  device_info,
  network_quality,
  submitted_at,
  validated_at,
  validated_by
)
SELECT 
  c.id as case_id,
  CASE 
    WHEN random() < 0.6 THEN 'RESIDENCE'
    WHEN random() < 0.8 THEN 'OFFICE'
    ELSE 'BUSINESS'
  END as form_type,
  c."assignedTo" as submitted_by,
  jsonb_build_object(
    'customer_name', c."customerName",
    'address', 'Sample Address ' || floor(random() * 1000),
    'phone', '+91' || floor(random() * 9000000000 + 1000000000),
    'verification_type', c."verificationType",
    'notes', 'Form submitted via mobile app'
  ) as submission_data,
  CASE 
    WHEN random() < 0.7 THEN 'VALID'
    WHEN random() < 0.9 THEN 'PENDING'
    ELSE 'INVALID'
  END as validation_status,
  CASE 
    WHEN random() < 0.2 THEN jsonb_build_array(
      jsonb_build_object('field', 'phone', 'message', 'Invalid phone number format'),
      jsonb_build_object('field', 'address', 'message', 'Address verification required')
    )
    ELSE '[]'::jsonb
  END as validation_errors,
  floor(random() * 8 + 2)::INTEGER as photos_count,
  floor(random() * 5 + 1)::INTEGER as attachments_count,
  jsonb_build_object(
    'lat', random_decimal(12.9716, 77.5946, 6),
    'lng', random_decimal(77.5946, 77.7500, 6),
    'accuracy', random_decimal(5.0, 50.0, 1)
  ) as geo_location,
  random_decimal(70.0, 98.0, 2) as submission_score,
  floor(random() * 45 + 15)::INTEGER as time_spent_minutes,
  jsonb_build_object(
    'device_type', CASE WHEN random() < 0.7 THEN 'mobile' ELSE 'tablet' END,
    'os', CASE WHEN random() < 0.6 THEN 'Android' ELSE 'iOS' END,
    'app_version', '2.1.' || floor(random() * 10),
    'device_model', CASE WHEN random() < 0.5 THEN 'Samsung Galaxy' ELSE 'iPhone' END
  ) as device_info,
  CASE 
    WHEN random() < 0.4 THEN 'EXCELLENT'
    WHEN random() < 0.7 THEN 'GOOD'
    WHEN random() < 0.9 THEN 'POOR'
    ELSE 'OFFLINE'
  END as network_quality,
  random_timestamp(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE) as submitted_at,
  CASE 
    WHEN random() < 0.8 THEN random_timestamp(CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE)
    ELSE NULL
  END as validated_at,
  CASE 
    WHEN random() < 0.8 THEN (SELECT id FROM users WHERE role = 'ADMIN' ORDER BY random() LIMIT 1)
    ELSE NULL
  END as validated_by
FROM cases c
WHERE c."assignedTo" IS NOT NULL;

-- Add additional form submissions for some cases (multiple forms per case)
INSERT INTO form_submissions (
  case_id, 
  form_type, 
  submitted_by, 
  submission_data,
  validation_status,
  photos_count,
  attachments_count,
  submission_score,
  time_spent_minutes,
  submitted_at
)
SELECT 
  c.id as case_id,
  CASE 
    WHEN random() < 0.4 THEN 'OFFICE'
    ELSE 'BUSINESS'
  END as form_type,
  c."assignedTo" as submitted_by,
  jsonb_build_object(
    'follow_up', true,
    'additional_notes', 'Follow-up form submission',
    'verification_status', 'completed'
  ) as submission_data,
  CASE 
    WHEN random() < 0.8 THEN 'VALID'
    ELSE 'PENDING'
  END as validation_status,
  floor(random() * 5 + 1)::INTEGER as photos_count,
  floor(random() * 3 + 1)::INTEGER as attachments_count,
  random_decimal(75.0, 95.0, 2) as submission_score,
  floor(random() * 30 + 10)::INTEGER as time_spent_minutes,
  random_timestamp(CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE) as submitted_at
FROM cases c
WHERE c."assignedTo" IS NOT NULL AND random() < 0.3;

-- =====================================================
-- 2.2 POPULATE FORM VALIDATION LOGS
-- =====================================================

-- Insert validation logs for form submissions
INSERT INTO form_validation_logs (
  form_submission_id,
  field_name,
  field_value,
  validation_rule,
  is_valid,
  error_message,
  error_code,
  severity,
  auto_corrected,
  corrected_value
)
SELECT 
  fs.id as form_submission_id,
  field_data.field_name,
  field_data.field_value,
  field_data.validation_rule,
  field_data.is_valid,
  field_data.error_message,
  field_data.error_code,
  field_data.severity,
  field_data.auto_corrected,
  field_data.corrected_value
FROM form_submissions fs
CROSS JOIN (
  VALUES 
    ('customer_name', 'John Doe', 'required_field', true, NULL, NULL, 'INFO', false, NULL),
    ('phone_number', '+919876543210', 'phone_format', true, NULL, NULL, 'INFO', false, NULL),
    ('address', '123 Main St', 'required_field', true, NULL, NULL, 'INFO', false, NULL),
    ('email', 'invalid-email', 'email_format', false, 'Invalid email format', 'EMAIL_001', 'ERROR', true, 'user@example.com'),
    ('pincode', '560001', 'pincode_format', true, NULL, NULL, 'INFO', false, NULL),
    ('id_proof', 'AADHAAR123', 'id_proof_format', false, 'Invalid ID format', 'ID_001', 'WARNING', false, NULL),
    ('signature', 'present', 'required_field', true, NULL, NULL, 'INFO', false, NULL),
    ('photo_quality', 'good', 'quality_check', true, NULL, NULL, 'INFO', false, NULL)
) AS field_data(field_name, field_value, validation_rule, is_valid, error_message, error_code, severity, auto_corrected, corrected_value)
WHERE random() < 0.4; -- Only add logs for 40% of submissions

-- =====================================================
-- 2.3 POPULATE AGENT PERFORMANCE DAILY
-- =====================================================

-- Generate daily performance data for the last 30 days
INSERT INTO agent_performance_daily (
  agent_id,
  date,
  cases_assigned,
  cases_completed,
  cases_in_progress,
  forms_submitted,
  residence_forms,
  office_forms,
  business_forms,
  attachments_uploaded,
  avg_completion_time_hours,
  quality_score,
  validation_success_rate,
  total_distance_km,
  active_hours,
  login_time,
  logout_time
)
SELECT 
  u.id as agent_id,
  date_series.date,
  floor(random() * 8 + 2)::INTEGER as cases_assigned,
  floor(random() * 6 + 1)::INTEGER as cases_completed,
  floor(random() * 4 + 1)::INTEGER as cases_in_progress,
  floor(random() * 12 + 3)::INTEGER as forms_submitted,
  floor(random() * 6 + 1)::INTEGER as residence_forms,
  floor(random() * 4 + 1)::INTEGER as office_forms,
  floor(random() * 3 + 0)::INTEGER as business_forms,
  floor(random() * 15 + 5)::INTEGER as attachments_uploaded,
  random_decimal(2.5, 8.0, 2) as avg_completion_time_hours,
  random_decimal(75.0, 98.0, 2) as quality_score,
  random_decimal(80.0, 100.0, 2) as validation_success_rate,
  random_decimal(15.0, 120.0, 2) as total_distance_km,
  random_decimal(6.0, 10.0, 2) as active_hours,
  (date_series.date + INTERVAL '8 hours' + (random() * INTERVAL '2 hours')) as login_time,
  (date_series.date + INTERVAL '17 hours' + (random() * INTERVAL '3 hours')) as logout_time
FROM users u
CROSS JOIN (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE - INTERVAL '1 day',
    INTERVAL '1 day'
  )::DATE as date
) date_series
WHERE u.role = 'FIELD_AGENT' AND random() < 0.8; -- 80% attendance rate

-- =====================================================
-- 2.4 POPULATE CASE TIMELINE EVENTS
-- =====================================================

-- Insert timeline events for cases
INSERT INTO case_timeline_events (
  case_id,
  event_type,
  event_category,
  performed_by,
  event_data,
  previous_value,
  new_value,
  event_description,
  is_system_generated,
  event_timestamp
)
SELECT 
  c.id as case_id,
  event_data.event_type,
  event_data.event_category,
  CASE 
    WHEN event_data.event_type = 'CASE_CREATED' THEN NULL
    WHEN event_data.event_type = 'CASE_ASSIGNED' THEN (SELECT id FROM users WHERE role = 'ADMIN' ORDER BY random() LIMIT 1)
    ELSE c."assignedTo"
  END as performed_by,
  jsonb_build_object(
    'details', event_data.event_description,
    'metadata', jsonb_build_object('source', 'system', 'version', '2.1.0')
  ) as event_data,
  event_data.previous_value,
  event_data.new_value,
  event_data.event_description,
  event_data.is_system_generated,
  c."createdAt" + (event_data.time_offset * INTERVAL '1 hour') as event_timestamp
FROM cases c
CROSS JOIN (
  VALUES 
    ('CASE_CREATED', 'GENERAL', NULL, 'PENDING', 'Case created in system', true, 0),
    ('CASE_ASSIGNED', 'ASSIGNMENT', 'PENDING', 'ASSIGNED', 'Case assigned to field agent', false, 1),
    ('STATUS_CHANGED', 'STATUS_CHANGE', 'ASSIGNED', 'IN_PROGRESS', 'Agent started working on case', false, 24),
    ('FORM_SUBMITTED', 'FORM_SUBMISSION', NULL, NULL, 'Form submitted by agent', false, 48),
    ('VALIDATION_COMPLETED', 'VALIDATION', 'PENDING', 'VALID', 'Form validation completed', true, 72),
    ('STATUS_CHANGED', 'STATUS_CHANGE', 'IN_PROGRESS', 'COMPLETED', 'Case marked as completed', false, 96)
) AS event_data(event_type, event_category, previous_value, new_value, event_description, is_system_generated, time_offset)
WHERE random() < 0.6; -- Add events for 60% of cases

-- =====================================================
-- 2.5 POPULATE FORM QUALITY METRICS
-- =====================================================

-- Insert quality metrics for form submissions
INSERT INTO form_quality_metrics (
  form_submission_id,
  completeness_score,
  accuracy_score,
  consistency_score,
  timeliness_score,
  photo_quality_score,
  overall_quality_score,
  quality_issues,
  improvement_suggestions,
  reviewed_by,
  reviewed_at
)
SELECT 
  fs.id as form_submission_id,
  random_decimal(80.0, 100.0, 2) as completeness_score,
  random_decimal(75.0, 98.0, 2) as accuracy_score,
  random_decimal(85.0, 100.0, 2) as consistency_score,
  random_decimal(70.0, 95.0, 2) as timeliness_score,
  random_decimal(80.0, 100.0, 2) as photo_quality_score,
  random_decimal(78.0, 96.0, 2) as overall_quality_score,
  CASE 
    WHEN random() < 0.3 THEN jsonb_build_array(
      'Photo clarity could be improved',
      'Some fields require additional verification'
    )
    ELSE '[]'::jsonb
  END as quality_issues,
  CASE 
    WHEN random() < 0.2 THEN jsonb_build_array(
      'Use better lighting for photos',
      'Double-check address details',
      'Ensure all required fields are filled'
    )
    ELSE '[]'::jsonb
  END as improvement_suggestions,
  (SELECT id FROM users WHERE role IN ('ADMIN', 'BACKEND') ORDER BY random() LIMIT 1) as reviewed_by,
  fs.validated_at as reviewed_at
FROM form_submissions fs
WHERE fs.validation_status IN ('VALID', 'INVALID') AND random() < 0.7;

-- =====================================================
-- 2.6 UPDATE EXISTING CASES WITH NEW FIELDS
-- =====================================================

-- Update cases with form completion and quality data
UPDATE cases 
SET 
  form_completion_percentage = CASE 
    WHEN random() < 0.7 THEN random_decimal(80.0, 100.0, 2)
    ELSE random_decimal(40.0, 79.0, 2)
  END,
  quality_score = random_decimal(75.0, 95.0, 2),
  last_form_submitted_at = (
    SELECT MAX(fs.submitted_at) 
    FROM form_submissions fs 
    WHERE fs.case_id = cases.id
  ),
  total_forms_required = CASE 
    WHEN "verificationType" = 'RESIDENCE' THEN 1
    WHEN "verificationType" = 'OFFICE' THEN 2
    ELSE 1
  END,
  forms_submitted_count = (
    SELECT COUNT(*) 
    FROM form_submissions fs 
    WHERE fs.case_id = cases.id
  ),
  validation_issues_count = (
    SELECT COUNT(*) 
    FROM form_submissions fs 
    WHERE fs.case_id = cases.id AND fs.validation_status = 'INVALID'
  );

-- Update users with performance data
UPDATE users 
SET 
  performance_rating = random_decimal(3.5, 5.0, 2),
  total_cases_handled = (
    SELECT COUNT(*) 
    FROM cases c 
    WHERE c."assignedTo" = users.id
  ),
  avg_case_completion_days = random_decimal(3.0, 12.0, 2),
  last_active_at = CURRENT_TIMESTAMP - (random() * INTERVAL '7 days'),
  preferred_form_types = CASE 
    WHEN random() < 0.4 THEN 'RESIDENCE,OFFICE'
    WHEN random() < 0.7 THEN 'RESIDENCE'
    ELSE 'OFFICE,BUSINESS'
  END
WHERE role = 'FIELD_AGENT';

-- Clean up temporary functions
DROP FUNCTION IF EXISTS random_timestamp(DATE, DATE);
DROP FUNCTION IF EXISTS random_decimal(DECIMAL, DECIMAL, INTEGER);

-- =====================================================
-- DATA POPULATION COMPLETE
-- =====================================================
