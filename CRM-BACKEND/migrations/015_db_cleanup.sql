-- Migration 015: Database cleanup
--
-- 1. Drop ~48 duplicate indexes (created during migration 010 rename)
-- 2. Delete all case/task/KYC test data
-- 3. Reset sequences so new cases start from 1
--
-- Applied: 2026-04-12

BEGIN;

-- =====================================================
-- SECTION A: Drop duplicate indexes (48)
-- For each (table, columns) group with multiple indexes,
-- keep the first alphabetically and drop the rest.
-- =====================================================

DROP INDEX IF EXISTS idx_agent_performance_daily_composite;
DROP INDEX IF EXISTS idx_audit_logs_created_at;
DROP INDEX IF EXISTS idx_builder_verification_case_id;
DROP INDEX IF EXISTS idx_bvr_case;
DROP INDEX IF EXISTS idx_case_assignment_queue_status_batch_id;
DROP INDEX IF EXISTS idx_cases_createdat;
DROP INDEX IF EXISTS idx_cases_customer_phone_trgm;
DROP INDEX IF EXISTS idx_cases_status_client;
DROP INDEX IF EXISTS idx_cases_status_created;
DROP INDEX IF EXISTS idx_clients_code;
DROP INDEX IF EXISTS idx_countries_code;
DROP INDEX IF EXISTS idx_dedup_audit_performed_at;
DROP INDEX IF EXISTS idx_dedup_audit_performed_by;
DROP INDEX IF EXISTS idx_departments_name;
DROP INDEX IF EXISTS idx_designations_name;
DROP INDEX IF EXISTS idx_document_types_code;
DROP INDEX IF EXISTS idx_dvr_case;
DROP INDEX IF EXISTS idx_notifications_created_at;
DROP INDEX IF EXISTS idx_nvr_case;
DROP INDEX IF EXISTS idx_ovr_case;
DROP INDEX IF EXISTS idx_performance_metrics_timestamp;
DROP INDEX IF EXISTS idx_property_apf_verification_case_id;
DROP INDEX IF EXISTS idx_property_individual_verification_case_id;
DROP INDEX IF EXISTS idx_refresh_tokens_user_id;
DROP INDEX IF EXISTS idx_res_cum_office_verification_case_id;
DROP INDEX IF EXISTS idx_rt_expires;
DROP INDEX IF EXISTS idx_rt_userid;
DROP INDEX IF EXISTS idx_rvr_case;
DROP INDEX IF EXISTS idx_service_zone_rules_unique;
DROP INDEX IF EXISTS idx_sz_rules_lookup;
DROP INDEX IF EXISTS idx_task_form_verification_task;
DROP INDEX IF EXISTS idx_users_is_active;
DROP INDEX IF EXISTS idx_verification_attachments_submission_id;
DROP INDEX IF EXISTS idx_verification_attachments_verification_task_id;
DROP INDEX IF EXISTS idx_vt_created_at;
DROP INDEX IF EXISTS idx_vt_reviewer_id;
DROP INDEX IF EXISTS idx_vt_revoked_by;
DROP INDEX IF EXISTS idx_vt_status;
DROP INDEX IF EXISTS idx_vtasks_assigned_status;
-- These are UNIQUE constraints (not plain indexes) — must use ALTER TABLE
ALTER TABLE mobile_notification_audit DROP CONSTRAINT IF EXISTS "mobile_notification_audit_notificationId_key";
ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_user_id_key;
ALTER TABLE pincodes DROP CONSTRAINT IF EXISTS pincodes_code_key;
ALTER TABLE user_client_assignments DROP CONSTRAINT IF EXISTS uk_user_client_assignments_user_client;
ALTER TABLE user_product_assignments DROP CONSTRAINT IF EXISTS uk_user_product_assignments_user_product;
ALTER TABLE locations DROP CONSTRAINT IF EXISTS uniq_locations_verification_task;
ALTER TABLE document_type_rates DROP CONSTRAINT IF EXISTS unique_active_document_type_rate;
ALTER TABLE commission_calculations DROP CONSTRAINT IF EXISTS unique_commission_per_task;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;

-- =====================================================
-- SECTION B: Delete all case/task/KYC data
-- Order: deepest FK children first, then parents.
-- =====================================================

-- Verification report tables (FK → verification_tasks)
DELETE FROM verification_attachments;
DELETE FROM residence_verification_reports;
DELETE FROM office_verification_reports;
DELETE FROM business_verification_reports;
DELETE FROM builder_verification_reports;
DELETE FROM residence_cum_office_verification_reports;
DELETE FROM dsa_connector_verification_reports;
DELETE FROM property_individual_verification_reports;
DELETE FROM property_apf_verification_reports;
DELETE FROM noc_verification_reports;

-- Task child tables
DELETE FROM task_form_submissions;
DELETE FROM task_assignment_history;
DELETE FROM task_status_transitions;
DELETE FROM task_revocations;
DELETE FROM task_commission_calculations;
DELETE FROM commission_calculations;

-- KYC
DELETE FROM kyc_document_verifications;

-- Case child tables
DELETE FROM case_deduplication_audit;
DELETE FROM case_assignment_history;
DELETE FROM case_assignment_queue_status;
DELETE FROM case_timeline_events;
DELETE FROM form_submissions;
DELETE FROM form_validation_logs;
DELETE FROM auto_saves;
DELETE FROM locations;
DELETE FROM attachments;

-- Notifications (case-related)
DELETE FROM mobile_notification_audit;
DELETE FROM mobile_operation_log;
DELETE FROM notifications;
DELETE FROM notification_delivery_log;

-- Case hierarchy
DELETE FROM visits;
DELETE FROM verifications;
DELETE FROM applicants;

-- Main tables (after all FK children)
DELETE FROM verification_tasks;
DELETE FROM cases;

-- Audit trail
DELETE FROM audit_logs;

-- =====================================================
-- SECTION C: Reset sequences to 1
-- =====================================================

ALTER SEQUENCE "cases_caseId_seq" RESTART WITH 1;
ALTER SEQUENCE verification_task_number_seq RESTART WITH 1;
ALTER SEQUENCE verification_attachments_id_seq RESTART WITH 1;
ALTER SEQUENCE attachments_temp_id_seq RESTART WITH 1;
ALTER SEQUENCE "caseDeduplicationAudit_temp_id_seq" RESTART WITH 1;
ALTER SEQUENCE "auditLogs_temp_id_seq" RESTART WITH 1;
ALTER SEQUENCE case_assignment_history_id_seq RESTART WITH 1;
ALTER SEQUENCE commission_calculations_id_seq RESTART WITH 1;
ALTER SEQUENCE locations_temp_id_seq RESTART WITH 1;
ALTER SEQUENCE mobile_notification_audit_id_seq RESTART WITH 1;
ALTER SEQUENCE task_revocations_id_seq RESTART WITH 1;
ALTER SEQUENCE "territoryAssignmentAudit_id_seq" RESTART WITH 1;

COMMIT;
