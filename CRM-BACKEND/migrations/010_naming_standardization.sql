-- Migration 010: Full naming standardization (snake_case)
-- Renames ALL camelCase columns and tables to snake_case
-- Handles conflict columns (both camelCase and snake_case exist)

BEGIN;

-- STEP 1: Drop views that reference old names
DROP VIEW IF EXISTS "documentTypeRatesView" CASCADE;
DROP VIEW IF EXISTS "rateManagementView" CASCADE;
DROP VIEW IF EXISTS "rateTypeAssignmentView" CASCADE;
DROP VIEW IF EXISTS "fieldAgentTerritories" CASCADE;

-- STEP 2: Drop legacy camelCase columns where snake_case already exists
ALTER TABLE "attachments" DROP COLUMN IF EXISTS "caseId";
ALTER TABLE "autoSaves" DROP COLUMN IF EXISTS "caseId";
ALTER TABLE "builderVerificationReports" DROP COLUMN IF EXISTS "caseId";
ALTER TABLE "businessVerificationReports" DROP COLUMN IF EXISTS "caseId";
ALTER TABLE "caseDeduplicationAudit" DROP COLUMN IF EXISTS "caseId";
ALTER TABLE "case_assignment_history" DROP COLUMN IF EXISTS "caseId";
ALTER TABLE "dsaConnectorVerificationReports" DROP COLUMN IF EXISTS "caseId";
ALTER TABLE "locations" DROP COLUMN IF EXISTS "caseId";
ALTER TABLE "mobile_notification_audit" DROP COLUMN IF EXISTS "caseId";
ALTER TABLE "nocVerificationReports" DROP COLUMN IF EXISTS "caseId";
ALTER TABLE "officeVerificationReports" DROP COLUMN IF EXISTS "caseId";
ALTER TABLE "propertyApfVerificationReports" DROP COLUMN IF EXISTS "caseId";
ALTER TABLE "propertyIndividualVerificationReports" DROP COLUMN IF EXISTS "caseId";
ALTER TABLE "residenceCumOfficeVerificationReports" DROP COLUMN IF EXISTS "caseId";
ALTER TABLE "residenceVerificationReports" DROP COLUMN IF EXISTS "caseId";
ALTER TABLE "verification_attachments" DROP COLUMN IF EXISTS "caseId";

-- STEP 3: Rename camelCase columns to snake_case
ALTER TABLE "areas" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "areas" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "attachments" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "attachments" RENAME COLUMN "filePath" TO file_path;
ALTER TABLE "attachments" RENAME COLUMN "fileSize" TO file_size;
ALTER TABLE "attachments" RENAME COLUMN "mimeType" TO mime_type;
ALTER TABLE "attachments" RENAME COLUMN "originalName" TO original_name;
ALTER TABLE "attachments" RENAME COLUMN "uploadedBy" TO uploaded_by;
ALTER TABLE "auditLogs" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "auditLogs" RENAME COLUMN "entityId" TO entity_id;
ALTER TABLE "auditLogs" RENAME COLUMN "entityType" TO entity_type;
ALTER TABLE "auditLogs" RENAME COLUMN "ipAddress" TO ip_address;
ALTER TABLE "auditLogs" RENAME COLUMN "newValues" TO new_values;
ALTER TABLE "auditLogs" RENAME COLUMN "oldValues" TO old_values;
ALTER TABLE "auditLogs" RENAME COLUMN "userAgent" TO user_agent;
ALTER TABLE "auditLogs" RENAME COLUMN "userId" TO user_id;
ALTER TABLE "autoSaves" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "autoSaves" RENAME COLUMN "formData" TO form_data;
ALTER TABLE "autoSaves" RENAME COLUMN "userId" TO user_id;
ALTER TABLE "caseDeduplicationAudit" RENAME COLUMN "duplicatesFound" TO duplicates_found;
ALTER TABLE "caseDeduplicationAudit" RENAME COLUMN "performedAt" TO performed_at;
ALTER TABLE "caseDeduplicationAudit" RENAME COLUMN "performedBy" TO performed_by;
ALTER TABLE "caseDeduplicationAudit" RENAME COLUMN "searchCriteria" TO search_criteria;
ALTER TABLE "caseDeduplicationAudit" RENAME COLUMN "userDecision" TO user_decision;
ALTER TABLE "case_assignment_history" RENAME COLUMN "assignedAt" TO assigned_at;
ALTER TABLE "case_assignment_history" RENAME COLUMN "assignedBy" TO assigned_by;
ALTER TABLE "case_assignment_history" RENAME COLUMN "assignedById" TO assigned_by_id;
ALTER TABLE "case_assignment_history" RENAME COLUMN "batchId" TO batch_id;
ALTER TABLE "case_assignment_history" RENAME COLUMN "caseUUID" TO case_uuid;
ALTER TABLE "case_assignment_history" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "case_assignment_history" RENAME COLUMN "fromUserId" TO from_user_id;
ALTER TABLE "case_assignment_history" RENAME COLUMN "newAssignee" TO new_assignee;
ALTER TABLE "case_assignment_history" RENAME COLUMN "previousAssignee" TO previous_assignee;
ALTER TABLE "case_assignment_history" RENAME COLUMN "toUserId" TO to_user_id;
ALTER TABLE "case_assignment_queue_status" RENAME COLUMN "assignedToId" TO assigned_to_id;
ALTER TABLE "case_assignment_queue_status" RENAME COLUMN "batchId" TO batch_id;
ALTER TABLE "case_assignment_queue_status" RENAME COLUMN "completedAt" TO completed_at;
ALTER TABLE "case_assignment_queue_status" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "case_assignment_queue_status" RENAME COLUMN "createdById" TO created_by_id;
ALTER TABLE "case_assignment_queue_status" RENAME COLUMN "failedAssignments" TO failed_assignments;
ALTER TABLE "case_assignment_queue_status" RENAME COLUMN "jobId" TO job_id;
ALTER TABLE "case_assignment_queue_status" RENAME COLUMN "processedCases" TO processed_cases;
ALTER TABLE "case_assignment_queue_status" RENAME COLUMN "startedAt" TO started_at;
ALTER TABLE "case_assignment_queue_status" RENAME COLUMN "successfulAssignments" TO successful_assignments;
ALTER TABLE "case_assignment_queue_status" RENAME COLUMN "totalCases" TO total_cases;
ALTER TABLE "case_assignment_queue_status" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "cases" RENAME COLUMN "applicantType" TO applicant_type;
ALTER TABLE "cases" RENAME COLUMN "backendContactNumber" TO backend_contact_number;
ALTER TABLE "cases" RENAME COLUMN "caseId" TO case_id;
ALTER TABLE "cases" RENAME COLUMN "cityId" TO city_id;
ALTER TABLE "cases" RENAME COLUMN "clientId" TO client_id;
ALTER TABLE "cases" RENAME COLUMN "completedAt" TO completed_at;
ALTER TABLE "cases" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "cases" RENAME COLUMN "createdByBackendUser" TO created_by_backend_user;
ALTER TABLE "cases" RENAME COLUMN "customerCallingCode" TO customer_calling_code;
ALTER TABLE "cases" RENAME COLUMN "customerName" TO customer_name;
ALTER TABLE "cases" RENAME COLUMN "customerPhone" TO customer_phone;
ALTER TABLE "cases" RENAME COLUMN "deduplicationChecked" TO deduplication_checked;
ALTER TABLE "cases" RENAME COLUMN "deduplicationDecision" TO deduplication_decision;
ALTER TABLE "cases" RENAME COLUMN "deduplicationRationale" TO deduplication_rationale;
ALTER TABLE "cases" RENAME COLUMN "panNumber" TO pan_number;
ALTER TABLE "cases" RENAME COLUMN "productId" TO product_id;
ALTER TABLE "cases" RENAME COLUMN "rateTypeId" TO rate_type_id;
ALTER TABLE "cases" RENAME COLUMN "revokeReason" TO revoke_reason;
ALTER TABLE "cases" RENAME COLUMN "revokedAt" TO revoked_at;
ALTER TABLE "cases" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "cases" RENAME COLUMN "verificationData" TO verification_data;
ALTER TABLE "cases" RENAME COLUMN "verificationOutcome" TO verification_outcome;
ALTER TABLE "cases" RENAME COLUMN "verificationType" TO verification_type;
ALTER TABLE "cases" RENAME COLUMN "verificationTypeId" TO verification_type_id;
ALTER TABLE "cities" RENAME COLUMN "countryId" TO country_id;
ALTER TABLE "cities" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "cities" RENAME COLUMN "stateId" TO state_id;
ALTER TABLE "cities" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "clientDocumentTypes" RENAME COLUMN "clientId" TO client_id;
ALTER TABLE "clientDocumentTypes" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "clientDocumentTypes" RENAME COLUMN "documentTypeId" TO document_type_id;
ALTER TABLE "clientDocumentTypes" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "clientProducts" RENAME COLUMN "clientId" TO client_id;
ALTER TABLE "clientProducts" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "clientProducts" RENAME COLUMN "isActive" TO is_active;
ALTER TABLE "clientProducts" RENAME COLUMN "productId" TO product_id;
ALTER TABLE "clientProducts" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "clients" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "clients" RENAME COLUMN "isActive" TO is_active;
ALTER TABLE "clients" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "countries" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "countries" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "departments" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "departments" RENAME COLUMN "createdBy" TO created_by;
ALTER TABLE "departments" RENAME COLUMN "departmentHeadId" TO department_head_id;
ALTER TABLE "departments" RENAME COLUMN "isActive" TO is_active;
ALTER TABLE "departments" RENAME COLUMN "parentDepartmentId" TO parent_department_id;
ALTER TABLE "departments" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "departments" RENAME COLUMN "updatedBy" TO updated_by;
ALTER TABLE "designations" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "designations" RENAME COLUMN "createdBy" TO created_by;
ALTER TABLE "designations" RENAME COLUMN "departmentId" TO department_id;
ALTER TABLE "designations" RENAME COLUMN "isActive" TO is_active;
ALTER TABLE "designations" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "designations" RENAME COLUMN "updatedBy" TO updated_by;
ALTER TABLE "documentTypeRates" RENAME COLUMN "clientId" TO client_id;
ALTER TABLE "documentTypeRates" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "documentTypeRates" RENAME COLUMN "createdBy" TO created_by;
ALTER TABLE "documentTypeRates" RENAME COLUMN "documentTypeId" TO document_type_id;
ALTER TABLE "documentTypeRates" RENAME COLUMN "effectiveFrom" TO effective_from;
ALTER TABLE "documentTypeRates" RENAME COLUMN "effectiveTo" TO effective_to;
ALTER TABLE "documentTypeRates" RENAME COLUMN "isActive" TO is_active;
ALTER TABLE "documentTypeRates" RENAME COLUMN "productId" TO product_id;
ALTER TABLE "documentTypeRates" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "documentTypes" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "documentTypes" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "locations" RENAME COLUMN "recordedAt" TO recorded_at;
ALTER TABLE "locations" RENAME COLUMN "recordedBy" TO recorded_by;
ALTER TABLE "migrations" RENAME COLUMN "executedAt" TO executed_at;
ALTER TABLE "mobile_device_sync" RENAME COLUMN "appVersion" TO app_version;
ALTER TABLE "mobile_device_sync" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "mobile_device_sync" RENAME COLUMN "deviceId" TO device_id;
ALTER TABLE "mobile_device_sync" RENAME COLUMN "lastSyncAt" TO last_sync_at;
ALTER TABLE "mobile_device_sync" RENAME COLUMN "syncCount" TO sync_count;
ALTER TABLE "mobile_device_sync" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "mobile_device_sync" RENAME COLUMN "userId" TO user_id;
ALTER TABLE "mobile_notification_audit" RENAME COLUMN "acknowledgedAt" TO acknowledged_at;
ALTER TABLE "mobile_notification_audit" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "mobile_notification_audit" RENAME COLUMN "deliveryStatus" TO delivery_status;
ALTER TABLE "mobile_notification_audit" RENAME COLUMN "notificationData" TO notification_data;
ALTER TABLE "mobile_notification_audit" RENAME COLUMN "notificationId" TO notification_id;
ALTER TABLE "mobile_notification_audit" RENAME COLUMN "notificationType" TO notification_type;
ALTER TABLE "mobile_notification_audit" RENAME COLUMN "sentAt" TO sent_at;
ALTER TABLE "mobile_notification_audit" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "mobile_notification_audit" RENAME COLUMN "userId" TO user_id;
ALTER TABLE "mobile_notification_queue" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "mobile_notification_queue" RENAME COLUMN "failedAt" TO failed_at;
ALTER TABLE "mobile_notification_queue" RENAME COLUMN "maxRetries" TO max_retries;
ALTER TABLE "mobile_notification_queue" RENAME COLUMN "notificationType" TO notification_type;
ALTER TABLE "mobile_notification_queue" RENAME COLUMN "retryCount" TO retry_count;
ALTER TABLE "mobile_notification_queue" RENAME COLUMN "scheduledAt" TO scheduled_at;
ALTER TABLE "mobile_notification_queue" RENAME COLUMN "sentAt" TO sent_at;
ALTER TABLE "mobile_notification_queue" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "mobile_notification_queue" RENAME COLUMN "userId" TO user_id;
ALTER TABLE "notificationTokens" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "notificationTokens" RENAME COLUMN "isActive" TO is_active;
ALTER TABLE "notificationTokens" RENAME COLUMN "userId" TO user_id;
ALTER TABLE "pincodeAreas" RENAME COLUMN "areaId" TO area_id;
ALTER TABLE "pincodeAreas" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "pincodeAreas" RENAME COLUMN "displayOrder" TO display_order;
ALTER TABLE "pincodeAreas" RENAME COLUMN "pincodeId" TO pincode_id;
ALTER TABLE "pincodeAreas" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "pincodes" RENAME COLUMN "cityId" TO city_id;
ALTER TABLE "pincodes" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "pincodes" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "productDocumentTypes" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "productDocumentTypes" RENAME COLUMN "documentTypeId" TO document_type_id;
ALTER TABLE "productDocumentTypes" RENAME COLUMN "productId" TO product_id;
ALTER TABLE "productDocumentTypes" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "productVerificationTypes" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "productVerificationTypes" RENAME COLUMN "isActive" TO is_active;
ALTER TABLE "productVerificationTypes" RENAME COLUMN "productId" TO product_id;
ALTER TABLE "productVerificationTypes" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "productVerificationTypes" RENAME COLUMN "verificationTypeId" TO verification_type_id;
ALTER TABLE "products" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "products" RENAME COLUMN "isActive" TO is_active;
ALTER TABLE "products" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "rateHistory" RENAME COLUMN "changeReason" TO change_reason;
ALTER TABLE "rateHistory" RENAME COLUMN "changedAt" TO changed_at;
ALTER TABLE "rateHistory" RENAME COLUMN "changedBy" TO changed_by;
ALTER TABLE "rateHistory" RENAME COLUMN "newAmount" TO new_amount;
ALTER TABLE "rateHistory" RENAME COLUMN "oldAmount" TO old_amount;
ALTER TABLE "rateHistory" RENAME COLUMN "rateId" TO rate_id;
ALTER TABLE "rateTypeAssignments" RENAME COLUMN "clientId" TO client_id;
ALTER TABLE "rateTypeAssignments" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "rateTypeAssignments" RENAME COLUMN "isActive" TO is_active;
ALTER TABLE "rateTypeAssignments" RENAME COLUMN "productId" TO product_id;
ALTER TABLE "rateTypeAssignments" RENAME COLUMN "rateTypeId" TO rate_type_id;
ALTER TABLE "rateTypeAssignments" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "rateTypeAssignments" RENAME COLUMN "verificationTypeId" TO verification_type_id;
ALTER TABLE "rateTypes" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "rateTypes" RENAME COLUMN "isActive" TO is_active;
ALTER TABLE "rateTypes" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "rates" RENAME COLUMN "clientId" TO client_id;
ALTER TABLE "rates" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "rates" RENAME COLUMN "createdBy" TO created_by;
ALTER TABLE "rates" RENAME COLUMN "effectiveFrom" TO effective_from;
ALTER TABLE "rates" RENAME COLUMN "effectiveTo" TO effective_to;
ALTER TABLE "rates" RENAME COLUMN "isActive" TO is_active;
ALTER TABLE "rates" RENAME COLUMN "productId" TO product_id;
ALTER TABLE "rates" RENAME COLUMN "rateTypeId" TO rate_type_id;
ALTER TABLE "rates" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "rates" RENAME COLUMN "verificationTypeId" TO verification_type_id;
ALTER TABLE "refreshTokens" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "refreshTokens" RENAME COLUMN "expiresAt" TO expires_at;
ALTER TABLE "refreshTokens" RENAME COLUMN "ipAddress" TO ip_address;
ALTER TABLE "refreshTokens" RENAME COLUMN "userAgent" TO user_agent;
ALTER TABLE "refreshTokens" RENAME COLUMN "userId" TO user_id;
ALTER TABLE "states" RENAME COLUMN "countryId" TO country_id;
ALTER TABLE "states" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "states" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "territoryAssignmentAudit" RENAME COLUMN "assignmentId" TO assignment_id;
ALTER TABLE "territoryAssignmentAudit" RENAME COLUMN "assignmentType" TO assignment_type;
ALTER TABLE "territoryAssignmentAudit" RENAME COLUMN "newData" TO new_data;
ALTER TABLE "territoryAssignmentAudit" RENAME COLUMN "performedAt" TO performed_at;
ALTER TABLE "territoryAssignmentAudit" RENAME COLUMN "performedBy" TO performed_by;
ALTER TABLE "territoryAssignmentAudit" RENAME COLUMN "previousData" TO previous_data;
ALTER TABLE "territoryAssignmentAudit" RENAME COLUMN "userId" TO user_id;
ALTER TABLE "userAreaAssignments" RENAME COLUMN "areaId" TO area_id;
ALTER TABLE "userAreaAssignments" RENAME COLUMN "assignedAt" TO assigned_at;
ALTER TABLE "userAreaAssignments" RENAME COLUMN "assignedBy" TO assigned_by;
ALTER TABLE "userAreaAssignments" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "userAreaAssignments" RENAME COLUMN "isActive" TO is_active;
ALTER TABLE "userAreaAssignments" RENAME COLUMN "pincodeId" TO pincode_id;
ALTER TABLE "userAreaAssignments" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "userAreaAssignments" RENAME COLUMN "userId" TO user_id;
ALTER TABLE "userAreaAssignments" RENAME COLUMN "userPincodeAssignmentId" TO user_pincode_assignment_id;
ALTER TABLE "userClientAssignments" RENAME COLUMN "assignedAt" TO assigned_at;
ALTER TABLE "userClientAssignments" RENAME COLUMN "assignedBy" TO assigned_by;
ALTER TABLE "userClientAssignments" RENAME COLUMN "clientId" TO client_id;
ALTER TABLE "userClientAssignments" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "userClientAssignments" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "userClientAssignments" RENAME COLUMN "userId" TO user_id;
ALTER TABLE "userPincodeAssignments" RENAME COLUMN "assignedAt" TO assigned_at;
ALTER TABLE "userPincodeAssignments" RENAME COLUMN "assignedBy" TO assigned_by;
ALTER TABLE "userPincodeAssignments" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "userPincodeAssignments" RENAME COLUMN "isActive" TO is_active;
ALTER TABLE "userPincodeAssignments" RENAME COLUMN "pincodeId" TO pincode_id;
ALTER TABLE "userPincodeAssignments" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "userPincodeAssignments" RENAME COLUMN "userId" TO user_id;
ALTER TABLE "userProductAssignments" RENAME COLUMN "assignedAt" TO assigned_at;
ALTER TABLE "userProductAssignments" RENAME COLUMN "assignedBy" TO assigned_by;
ALTER TABLE "userProductAssignments" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "userProductAssignments" RENAME COLUMN "productId" TO product_id;
ALTER TABLE "userProductAssignments" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "userProductAssignments" RENAME COLUMN "userId" TO user_id;
ALTER TABLE "users" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "users" RENAME COLUMN "deletedAt" TO deleted_at;
ALTER TABLE "users" RENAME COLUMN "departmentId" TO department_id;
ALTER TABLE "users" RENAME COLUMN "designationId" TO designation_id;
ALTER TABLE "users" RENAME COLUMN "employeeId" TO employee_id;
ALTER TABLE "users" RENAME COLUMN "isActive" TO is_active;
ALTER TABLE "users" RENAME COLUMN "lastLogin" TO last_login;
ALTER TABLE "users" RENAME COLUMN "passwordHash" TO password_hash;
ALTER TABLE "users" RENAME COLUMN "profilePhotoUrl" TO profile_photo_url;
ALTER TABLE "users" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "verificationTypes" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "verificationTypes" RENAME COLUMN "isActive" TO is_active;
ALTER TABLE "verificationTypes" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "verification_attachments" RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE "verification_attachments" RENAME COLUMN "filePath" TO file_path;
ALTER TABLE "verification_attachments" RENAME COLUMN "fileSize" TO file_size;
ALTER TABLE "verification_attachments" RENAME COLUMN "geoLocation" TO geo_location;
ALTER TABLE "verification_attachments" RENAME COLUMN "mimeType" TO mime_type;
ALTER TABLE "verification_attachments" RENAME COLUMN "originalName" TO original_name;
ALTER TABLE "verification_attachments" RENAME COLUMN "photoType" TO photo_type;
ALTER TABLE "verification_attachments" RENAME COLUMN "submissionId" TO submission_id;
ALTER TABLE "verification_attachments" RENAME COLUMN "thumbnailPath" TO thumbnail_path;
ALTER TABLE "verification_attachments" RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE "verification_attachments" RENAME COLUMN "uploadedBy" TO uploaded_by;

-- STEP 4: Rename camelCase tables to snake_case
ALTER TABLE "auditLogs" RENAME TO audit_logs;
ALTER TABLE "autoSaves" RENAME TO auto_saves;
ALTER TABLE "builderVerificationReports" RENAME TO builder_verification_reports;
ALTER TABLE "businessVerificationReports" RENAME TO business_verification_reports;
ALTER TABLE "caseDeduplicationAudit" RENAME TO case_deduplication_audit;
ALTER TABLE "clientDocumentTypes" RENAME TO client_document_types;
ALTER TABLE "clientProducts" RENAME TO client_products;
ALTER TABLE "documentTypeRates" RENAME TO document_type_rates;
ALTER TABLE "documentTypes" RENAME TO document_types;
ALTER TABLE "dsaConnectorVerificationReports" RENAME TO dsa_connector_verification_reports;
ALTER TABLE "nocVerificationReports" RENAME TO noc_verification_reports;
-- notificationTokens: snake_case version already exists, drop the camelCase duplicate
DROP TABLE IF EXISTS "notificationTokens" CASCADE;
ALTER TABLE "officeVerificationReports" RENAME TO office_verification_reports;
ALTER TABLE "pincodeAreas" RENAME TO pincode_areas;
ALTER TABLE "productDocumentTypes" RENAME TO product_document_types;
ALTER TABLE "productVerificationTypes" RENAME TO product_verification_types;
ALTER TABLE "propertyApfVerificationReports" RENAME TO property_apf_verification_reports;
ALTER TABLE "propertyIndividualVerificationReports" RENAME TO property_individual_verification_reports;
ALTER TABLE "rateHistory" RENAME TO rate_history;
ALTER TABLE "rateTypeAssignments" RENAME TO rate_type_assignments;
ALTER TABLE "rateTypes" RENAME TO rate_types;
ALTER TABLE "refreshTokens" RENAME TO refresh_tokens;
ALTER TABLE "residenceCumOfficeVerificationReports" RENAME TO residence_cum_office_verification_reports;
ALTER TABLE "residenceVerificationReports" RENAME TO residence_verification_reports;
ALTER TABLE "territoryAssignmentAudit" RENAME TO territory_assignment_audit;
ALTER TABLE "userAreaAssignments" RENAME TO user_area_assignments;
ALTER TABLE "userClientAssignments" RENAME TO user_client_assignments;
ALTER TABLE "userPincodeAssignments" RENAME TO user_pincode_assignments;
ALTER TABLE "userProductAssignments" RENAME TO user_product_assignments;
ALTER TABLE "verificationTypes" RENAME TO verification_types;

-- STEP 5: Recreate views with snake_case names

CREATE OR REPLACE VIEW document_type_rates_view AS
SELECT dtr.id,
    dtr.client_id, dtr.product_id, dtr.document_type_id,
    dtr.amount, dtr.currency, dtr.is_active,
    dtr.effective_from, dtr.effective_to,
    dtr.created_by, dtr.created_at, dtr.updated_at,
    c.name AS client_name, c.code AS client_code,
    p.name AS product_name, p.code AS product_code,
    kdt.name AS document_type_name, kdt.code AS document_type_code,
    kdt.category AS document_type_category
FROM document_type_rates dtr
    JOIN clients c ON dtr.client_id = c.id
    JOIN products p ON dtr.product_id = p.id
    JOIN kyc_document_types kdt ON dtr.document_type_id = kdt.id;

CREATE OR REPLACE VIEW rate_management_view AS
SELECT r.id,
    r.client_id, c.name AS client_name, c.code AS client_code,
    r.product_id, p.name AS product_name, p.code AS product_code,
    r.verification_type_id, vt.name AS verification_type_name, vt.code AS verification_type_code,
    r.rate_type_id, rt.name AS rate_type_name,
    r.amount, r.currency, r.is_active,
    r.effective_from, r.effective_to, r.created_at, r.updated_at
FROM rates r
    JOIN clients c ON r.client_id = c.id
    JOIN products p ON r.product_id = p.id
    JOIN verification_types vt ON r.verification_type_id = vt.id
    JOIN rate_types rt ON r.rate_type_id = rt.id;

CREATE OR REPLACE VIEW rate_type_assignment_view AS
SELECT rta.id,
    rta.client_id, c.name AS client_name, c.code AS client_code,
    rta.product_id, p.name AS product_name, p.code AS product_code,
    rta.verification_type_id, vt.name AS verification_type_name, vt.code AS verification_type_code,
    rta.rate_type_id, rt.name AS rate_type_name,
    rta.is_active, rta.created_at, rta.updated_at
FROM rate_type_assignments rta
    JOIN clients c ON rta.client_id = c.id
    JOIN products p ON rta.product_id = p.id
    JOIN verification_types vt ON rta.verification_type_id = vt.id
    JOIN rate_types rt ON rta.rate_type_id = rt.id;

CREATE OR REPLACE VIEW field_agent_territories AS
SELECT u.id AS user_id,
    u.name AS user_name, u.username, u.employee_id,
    upa.id AS pincode_assignment_id,
    p.id AS pincode_id, p.code AS pincode_code,
    c.name AS city_name, s.name AS state_name, co.name AS country_name,
    COALESCE(json_agg(json_build_object(
        'areaAssignmentId', uaa.id, 'areaId', a.id, 'areaName', a.name, 'assignedAt', uaa.assigned_at
    ) ORDER BY a.name) FILTER (WHERE a.id IS NOT NULL), '[]'::json) AS assigned_areas,
    upa.assigned_at AS pincode_assigned_at,
    upa.assigned_by, upa.is_active
FROM users u
    JOIN user_pincode_assignments upa ON u.id = upa.user_id
    JOIN pincodes p ON upa.pincode_id = p.id
    JOIN cities c ON p.city_id = c.id
    JOIN states s ON c.state_id = s.id
    JOIN countries co ON c.country_id = co.id
    LEFT JOIN user_area_assignments uaa ON upa.id = uaa.user_pincode_assignment_id AND uaa.is_active = true
    LEFT JOIN areas a ON uaa.area_id = a.id
WHERE upa.is_active = true
GROUP BY u.id, u.name, u.username, u.employee_id, upa.id, p.id, p.code, c.name, s.name, co.name, upa.assigned_at, upa.assigned_by, upa.is_active;

-- STEP 6: Track migration
INSERT INTO schema_migrations (id, filename, executed_at, checksum, success)
VALUES ('010', '010_naming_standardization.sql', NOW(), 'sha256:naming_standardization_full', true)
ON CONFLICT (id) DO NOTHING;

COMMIT;

