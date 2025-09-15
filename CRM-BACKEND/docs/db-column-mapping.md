# Database Column → Controller Variable Mapping (snake_case → camelCase)

Purpose: Quick reference to keep database column names and JS/TS variable names in sync after migration 20250815_standardize_naming_conventions.sql.

Notes
- Unless otherwise noted, controllers use the same camelCase names for:
  - Request body fields (express-validator schemas)
  - Response JSON aliases (SELECT ... AS "camelCase")
- Table shows the original snake_case column, the new camelCase column, typical variable usage in controllers, and the table name.

---

## Users

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| created_at | createdAt | createdAt (response) | users |
| updated_at | updatedAt | updatedAt (response/update) | users |
| is_active | isActive | isActive (req body for toggles; response) | users |
| last_login | lastLogin | lastLogin (response) | users |
| role_id | roleId | roleId (req body); roleId (JOIN/response) | users |
| department_id | departmentId | departmentId (req body); departmentId (JOIN/response) | users |
| designation_id | designationId | designationId (req body/response) | users |
| device_id | deviceId | deviceId (req body/response/validation) | users |

## Roles

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| is_system_role | isSystemRole | isSystemRole (response) | roles |
| is_active | isActive | isActive (req body/response) | roles |
| created_at | createdAt | createdAt (response) | roles |
| updated_at | updatedAt | updatedAt (response) | roles |
| created_by | createdBy | createdBy (response) | roles |
| updated_by | updatedBy | updatedBy (response) | roles |

## Departments

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| department_head_id | departmentHeadId | departmentHeadId (req body/response) | departments |
| parent_department_id | parentDepartmentId | parentDepartmentId (filter/response) | departments |
| is_active | isActive | isActive (req body/response) | departments |
| created_at | createdAt | createdAt (response) | departments |
| updated_at | updatedAt | updatedAt (response) | departments |
| created_by | createdBy | createdBy (response) | departments |
| updated_by | updatedBy | updatedBy (response) | departments |

## Designations

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| department_id | departmentId | departmentId (req body/response) | designations |
| is_active | isActive | isActive (req body/response) | designations |
| created_at | createdAt | createdAt (response) | designations |
| updated_at | updatedAt | updatedAt (response) | designations |
| created_by | createdBy | createdBy (response) | designations |
| updated_by | updatedBy | updatedBy (response) | designations |

## Products

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| is_active | isActive | isActive (req body/response) | products |
| created_at | createdAt | createdAt (response) | products |
| updated_at | updatedAt | updatedAt (response) | products |

## Verification Types

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| is_active | isActive | isActive (req body/response) | verification_types |
| created_at | createdAt | createdAt (response) | verification_types |
| updated_at | updatedAt | updatedAt (response) | verification_types |

## Cases

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| case_number | caseNumber | caseNumber (response) | cases |
| client_id | clientId | clientId (JOIN/response); clientId in mobile responses | cases |
| product_id | productId | productId (response) | cases |
| verification_type_id | verificationTypeId | verificationTypeId (response) | cases |
| applicant_name | applicantName | applicantName (req/res) | cases |
| applicant_phone | applicantPhone | applicantPhone (req/res) | cases |
| applicant_email | applicantEmail | applicantEmail (req/res) | cases |
| city_id | cityId | cityId (req/res; joins) | cases |
| assigned_to | assignedTo | assignedTo (req/res) | cases |
| created_by | createdBy | createdBy (response) | cases |
| created_at | createdAt | createdAt (response) | cases |
| updated_at | updatedAt | updatedAt (response) | cases |

## Clients

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| is_active | isActive | isActive (req/res) | clients |
| created_at | createdAt | createdAt (response) | clients |
| updated_at | updatedAt | updatedAt (response) | clients |

## Attachments

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| case_id | caseId | caseId (req params/queries) | attachments |
| original_name | originalName | originalName (req/res) | attachments |
| file_path | filePath | filePath (req/res) | attachments |
| file_size | fileSize | fileSize (req/res) | attachments |
| mime_type | mimeType | mimeType (req/res) | attachments |
| uploaded_by | uploadedBy | uploadedBy (response/audit) | attachments |
| created_at | createdAt | createdAt (response) | attachments |

## Audit Logs

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| user_id | userId | userId (service logs) | audit_logs |
| entity_type | entityType | entityType (service logs) | audit_logs |
| entity_id | entityId | entityId (service logs) | audit_logs |
| old_values | oldValues | oldValues (service logs) | audit_logs |
| new_values | newValues | newValues (service logs) | audit_logs |
| ip_address | ipAddress | ipAddress (service logs) | audit_logs |
| user_agent | userAgent | userAgent (service logs) | audit_logs |
| created_at | createdAt | createdAt (service logs) | audit_logs |

## Countries

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| created_at | createdAt | createdAt (response) | countries |
| updated_at | updatedAt | updatedAt (response) | countries |

## States

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| country_id | countryId | countryId (req/res; joins) | states |
| created_at | createdAt | createdAt (response) | states |
| updated_at | updatedAt | updatedAt (response) | states |

## Cities

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| state_id | stateId | stateId (req/res; joins) | cities |
| country_id | countryId | countryId (req/res; joins) | cities |
| created_at | createdAt | createdAt (response) | cities |
| updated_at | updatedAt | updatedAt (response) | cities |

## Pincodes

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| city_id | cityId | cityId (filters/joins/response); client APIs use cityId | pincodes |
| created_at | createdAt | createdAt (response) | pincodes |
| updated_at | updatedAt | updatedAt (response) | pincodes |

## Areas

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| created_at | createdAt | createdAt (response) | areas |
| updated_at | updatedAt | updatedAt (response) | areas |

## Devices

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| user_id | userId | userId (req/res; joins) | devices |
| device_id | deviceId | deviceId (req/res; joins) | devices |
| device_name | deviceName | deviceName (req/res) | devices |
| app_version | appVersion | appVersion (req/res) | devices |
| is_active | isActive | isActive (admin routes/responses) | devices |
| last_used | lastUsed | lastUsed (updates in sync; response) | devices |
| created_at | createdAt | createdAt (response) | devices |

## Refresh Tokens

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| user_id | userId | userId (auth) | refresh_tokens |
| device_id | deviceId | deviceId (auth) | refresh_tokens |
| expires_at | expiresAt | expiresAt (auth) | refresh_tokens |
| created_at | createdAt | createdAt (auth) | refresh_tokens |

## Auto Saves

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| case_id | caseId | caseId (req params) | auto_saves |
| user_id | userId | userId (auth) | auto_saves |
| form_data | formData | formData (req/res) | auto_saves |
| created_at | createdAt | createdAt (response) | auto_saves |

## Background Sync Queue

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| user_id | userId | userId (service/worker) | background_sync_queue |
| entity_type | entityType | entityType (service/worker) | background_sync_queue |
| entity_data | entityData | entityData (service/worker) | background_sync_queue |
| retry_count | retryCount | retryCount (service/worker) | background_sync_queue |
| error_message | errorMessage | errorMessage (service/worker) | background_sync_queue |
| created_at | createdAt | createdAt (service/worker) | background_sync_queue |
| processed_at | processedAt | processedAt (service/worker) | background_sync_queue |

## Locations

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| case_id | caseId | caseId (params/filters/response) | locations |
| recorded_by | recordedBy | recordedBy (response) | locations |
| recorded_at | recordedAt | recordedAt (response) | locations |

## Notification Tokens

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| user_id | userId | userId (notification registration) | notification_tokens |
| is_active | isActive | isActive (response) | notification_tokens |
| created_at | createdAt | createdAt (response) | notification_tokens |

## Office Verification Reports

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| case_id | caseId | caseId (req params) | office_verification_reports |
| company_name | companyName | companyName (req/res) | office_verification_reports |
| verification_date | verificationDate | verificationDate (req/res) | office_verification_reports |
| verification_time | verificationTime | verificationTime (req/res) | office_verification_reports |
| person_met | personMet | personMet (req/res) | office_verification_reports |
| office_confirmed | officeConfirmed | officeConfirmed (req/res) | office_verification_reports |
| created_by | createdBy | createdBy (auth/res) | office_verification_reports |
| created_at | createdAt | createdAt (response) | office_verification_reports |

## Residence Verification Reports

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| case_id | caseId | caseId (req params) | residence_verification_reports |
| applicant_name | applicantName | applicantName (req/res) | residence_verification_reports |
| verification_date | verificationDate | verificationDate (req/res) | residence_verification_reports |
| verification_time | verificationTime | verificationTime (req/res) | residence_verification_reports |
| person_met | personMet | personMet (req/res) | residence_verification_reports |
| residence_confirmed | residenceConfirmed | residenceConfirmed (req/res) | residence_verification_reports |
| created_by | createdBy | createdBy (auth/res) | residence_verification_reports |
| created_at | createdAt | createdAt (response) | residence_verification_reports |

## Junction Tables

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| client_id | clientId | clientId (req/res) | client_products |
| product_id | productId | productId (req/res) | client_products |
| created_at | createdAt | createdAt (response) | client_products |
| client_id | clientId | clientId (req/res) | client_verification_types |
| verification_type_id | verificationTypeId | verificationTypeId (req/res) | client_verification_types |
| created_at | createdAt | createdAt (response) | client_verification_types |
| product_id | productId | productId (req/res) | product_verification_types |
| verification_type_id | verificationTypeId | verificationTypeId (req/res) | product_verification_types |
| created_at | createdAt | createdAt (response) | product_verification_types |
| pincode_id | pincodeId | pincodeId (req/res) | pincode_areas |
| area_id | areaId | areaId (req/res) | pincode_areas |
| display_order | displayOrder | displayOrder (req/res) | pincode_areas |
| created_at | createdAt | createdAt (response) | pincode_areas |
| updated_at | updatedAt | updatedAt (response) | pincode_areas |

## Migrations

| snake_case | camelCase | Controller variables (req/res) | Table |
|---|---|---|---|
| executed_at | executedAt | executedAt (internal) | migrations |

---

If you notice any controller using a different alias for a field, update this doc and standardize the controller to the camelCase convention.

