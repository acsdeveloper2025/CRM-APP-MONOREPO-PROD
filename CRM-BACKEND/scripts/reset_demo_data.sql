-- Reset Case and Verification Data for Demo

TRUNCATE TABLE cases CASCADE;
TRUNCATE TABLE verification_tasks CASCADE;
TRUNCATE TABLE verification_attachments CASCADE;
TRUNCATE TABLE locations CASCADE;
TRUNCATE TABLE attachments CASCADE; -- Legacy table?
TRUNCATE TABLE "residenceVerificationReports" CASCADE;
TRUNCATE TABLE "officeVerificationReports" CASCADE;
TRUNCATE TABLE "businessVerificationReports" CASCADE;
TRUNCATE TABLE "builderVerificationReports" CASCADE;
TRUNCATE TABLE "nocVerificationReports" CASCADE;
TRUNCATE TABLE "dsaConnectorVerificationReports" CASCADE;
TRUNCATE TABLE "propertyApfVerificationReports" CASCADE;
TRUNCATE TABLE "propertyIndividualVerificationReports" CASCADE;
TRUNCATE TABLE "residenceCumOfficeVerificationReports" CASCADE;
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE task_assignment_history CASCADE;
TRUNCATE TABLE field_user_commission_assignments CASCADE;
TRUNCATE TABLE commission_calculations CASCADE;
TRUNCATE TABLE task_form_submissions CASCADE;

-- Reset sequences if necessary (Postgres usually handles identity columns automatically after truncate restart identity, but explicit restart is good)
ALTER SEQUENCE cases_id_seq RESTART WITH 1;
-- Add other sequences if needed
