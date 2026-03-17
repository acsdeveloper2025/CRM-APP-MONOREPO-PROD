# API Catalog (Grouped by Module)

Generated from `CRM-BACKEND/src/routes/*` with base mounts in `CRM-BACKEND/src/app.ts`.

## aiReports.ts (/api/ai-reports)

| Method | Path |
|---|---|
| GET | /api/ai-reports/cases/:caseId/submissions/:submissionId |
| POST | /api/ai-reports/cases/:caseId/submissions/:submissionId/generate |
| GET | /api/ai-reports/statistics |
| GET | /api/ai-reports/test-connection |

## areas.ts (/api/areas)

| Method | Path |
|---|---|
| GET | /api/areas/ |
| POST | /api/areas/ |
| DELETE | /api/areas/:id |
| GET | /api/areas/:id |
| PUT | /api/areas/:id |
| GET | /api/areas/by-pincodes |
| GET | /api/areas/standalone |

## attachments.ts (/api/attachments)

| Method | Path |
|---|---|
| DELETE | /api/attachments/:id |
| GET | /api/attachments/:id |
| PUT | /api/attachments/:id |
| POST | /api/attachments/:id/download |
| GET | /api/attachments/:id/serve |
| POST | /api/attachments/bulk-delete |
| POST | /api/attachments/bulk-upload |
| GET | /api/attachments/case/:caseId |
| GET | /api/attachments/types |
| POST | /api/attachments/upload |

## audit-logs.ts (/api/audit-logs)

| Method | Path |
|---|---|
| GET | /api/audit-logs/ |
| POST | /api/audit-logs/ |
| GET | /api/audit-logs/:id |
| GET | /api/audit-logs/actions |
| GET | /api/audit-logs/categories |
| DELETE | /api/audit-logs/cleanup |
| POST | /api/audit-logs/export |
| GET | /api/audit-logs/stats |

## auth.ts (/api/auth)

| Method | Path |
|---|---|
| POST | /api/auth/login |
| POST | /api/auth/logout |
| GET | /api/auth/me |
| POST | /api/auth/refresh-token |
| POST | /api/auth/reset-rate-limit |
| POST | /api/auth/reset-user-rate-limit/:userId |

## cases.ts (/api/cases)

| Method | Path |
|---|---|
| GET | /api/cases/ |
| GET | /api/cases/:id |
| PUT | /api/cases/:id |
| GET | /api/cases/:id/summary |
| GET | /api/cases/:id/verification-images |
| GET | /api/cases/analytics/field-agent-workload |
| POST | /api/cases/create |
| POST | /api/cases/dedupe/global-search |
| GET | /api/cases/export |
| GET | /api/cases/verification-images/:imageId/serve |
| GET | /api/cases/verification-images/:imageId/thumbnail |

## cities.ts (/api/cities)

| Method | Path |
|---|---|
| GET | /api/cities/ |
| POST | /api/cities/ |
| DELETE | /api/cities/:id |
| GET | /api/cities/:id |
| PUT | /api/cities/:id |
| GET | /api/cities/:id/pincodes |
| POST | /api/cities/bulk-import |
| GET | /api/cities/stats |

## client-document-types.ts (/api/clients)

| Method | Path |
|---|---|
| DELETE | /api/clients/:clientId/document-types/:documentTypeId |
| PUT | /api/clients/:clientId/document-types/:documentTypeId |
| GET | /api/clients/:id/document-types |
| POST | /api/clients/:id/document-types |

## clients.ts (/api/clients)

| Method | Path |
|---|---|
| GET | /api/clients/ |
| POST | /api/clients/ |
| DELETE | /api/clients/:id |
| GET | /api/clients/:id |
| PUT | /api/clients/:id |
| GET | /api/clients/:id/products |
| GET | /api/clients/:id/verification-types |

## commissionManagement.ts (/api/commission-management)

| Method | Path |
|---|---|
| GET | /api/commission-management/calculations |
| GET | /api/commission-management/field-user-assignments |
| POST | /api/commission-management/field-user-assignments |
| DELETE | /api/commission-management/field-user-assignments/:id |
| PUT | /api/commission-management/field-user-assignments/:id |
| GET | /api/commission-management/rate-types |
| POST | /api/commission-management/rate-types |
| DELETE | /api/commission-management/rate-types/:id |
| PUT | /api/commission-management/rate-types/:id |
| GET | /api/commission-management/stats |
| POST | /api/commission-management/test-calculation |

## commissions.ts (/api/commissions)

| Method | Path |
|---|---|
| GET | /api/commissions/ |
| GET | /api/commissions/:id |
| POST | /api/commissions/:id/approve |
| POST | /api/commissions/:id/mark-paid |
| POST | /api/commissions/bulk-approve |
| POST | /api/commissions/bulk-mark-paid |
| GET | /api/commissions/summary |

## countries.ts (/api/countries)

| Method | Path |
|---|---|
| GET | /api/countries/ |
| POST | /api/countries/ |
| DELETE | /api/countries/:id |
| GET | /api/countries/:id |
| PUT | /api/countries/:id |
| POST | /api/countries/bulk-import |
| GET | /api/countries/stats |

## dashboard.ts (/api/dashboard)

| Method | Path |
|---|---|
| GET | /api/dashboard/ |
| GET | /api/dashboard/case-status-distribution |
| GET | /api/dashboard/charts |
| GET | /api/dashboard/kpi |
| GET | /api/dashboard/monthly-trends |
| GET | /api/dashboard/overdue-tasks |
| GET | /api/dashboard/performance-metrics |
| GET | /api/dashboard/recent-activities |
| GET | /api/dashboard/stats |
| GET | /api/dashboard/tat-stats |

## deduplication.ts (/api/cases/deduplication)

| Method | Path |
|---|---|
| GET | /api/cases/deduplication/:caseId/history |
| GET | /api/cases/deduplication/clusters |
| POST | /api/cases/deduplication/decision |
| POST | /api/cases/deduplication/search |

## departments.ts (/api/departments)

| Method | Path |
|---|---|
| GET | /api/departments/ |
| POST | /api/departments/ |
| DELETE | /api/departments/:id |
| GET | /api/departments/:id |
| PUT | /api/departments/:id |

## designations.ts (/api/designations)

| Method | Path |
|---|---|
| GET | /api/designations/ |
| POST | /api/designations/ |
| DELETE | /api/designations/:id |
| GET | /api/designations/:id |
| PUT | /api/designations/:id |
| GET | /api/designations/active |

## document-type-rates.ts (/api/document-type-rates)

| Method | Path |
|---|---|
| GET | /api/document-type-rates/ |
| POST | /api/document-type-rates/ |
| DELETE | /api/document-type-rates/:id |
| GET | /api/document-type-rates/stats |

## document-types.ts (/api/document-types)

| Method | Path |
|---|---|
| GET | /api/document-types/ |
| POST | /api/document-types/ |
| DELETE | /api/document-types/:id |
| GET | /api/document-types/:id |
| PUT | /api/document-types/:id |
| GET | /api/document-types/categories |
| GET | /api/document-types/stats |

## enhancedAnalytics.ts (/api/enhanced-analytics)

| Method | Path |
|---|---|
| GET | /api/enhanced-analytics/agent-performance |
| GET | /api/enhanced-analytics/case-analytics |
| GET | /api/enhanced-analytics/form-submissions |
| GET | /api/enhanced-analytics/form-validation |
| GET | /api/enhanced-analytics/my-performance |

## exports.ts (/api/exports)

| Method | Path |
|---|---|
| GET | /api/exports/download/:fileName |
| POST | /api/exports/email/monthly-performance |
| POST | /api/exports/email/weekly-summary |
| GET | /api/exports/formats |
| POST | /api/exports/generate |
| GET | /api/exports/history |
| POST | /api/exports/quick/agent-performance |
| POST | /api/exports/quick/case-analytics |
| POST | /api/exports/quick/form-submissions |
| GET | /api/exports/scheduled |
| POST | /api/exports/scheduled |
| DELETE | /api/exports/scheduled/:id |
| GET | /api/exports/scheduled/:id |
| PUT | /api/exports/scheduled/:id |
| GET | /api/exports/scheduled/:id/history |
| POST | /api/exports/scheduled/:id/test |
| PATCH | /api/exports/scheduled/:id/toggle |
| GET | /api/exports/templates |
| POST | /api/exports/test-email |

## fieldMonitoring.ts (/api/field-monitoring)

| Method | Path |
|---|---|
| GET | /api/field-monitoring/stats |
| GET | /api/field-monitoring/users |
| GET | /api/field-monitoring/users/:id |

## forms.ts (/api/forms)

| Method | Path |
|---|---|
| POST | /api/forms/auto-save |
| GET | /api/forms/auto-save/:caseId |
| GET | /api/forms/cases/:caseId/submissions |
| POST | /api/forms/office-verification |
| POST | /api/forms/residence-verification |

## health.ts (/api)

| Method | Path |
|---|---|
| GET | /api/health |
| GET | /api/health/detailed |
| GET | /api/health/live |
| GET | /api/health/metrics |
| GET | /api/health/ready |
| GET | /api/sync/health |

## invoices.ts (/api/invoices)

| Method | Path |
|---|---|
| GET | /api/invoices/ |
| POST | /api/invoices/ |
| DELETE | /api/invoices/:id |
| GET | /api/invoices/:id |
| PUT | /api/invoices/:id |
| POST | /api/invoices/:id/cancel |
| GET | /api/invoices/:id/download |
| POST | /api/invoices/:id/regenerate |
| GET | /api/invoices/stats |

## mobile.ts (/api/mobile)

| Method | Path |
|---|---|
| DELETE | /api/mobile/attachments/:attachmentId |
| GET | /api/mobile/attachments/:attachmentId/content |
| POST | /api/mobile/audit/logs |
| GET | /api/mobile/auth/config |
| POST | /api/mobile/auth/login |
| POST | /api/mobile/auth/logout |
| POST | /api/mobile/auth/notifications/register |
| POST | /api/mobile/auth/refresh |
| POST | /api/mobile/auth/version-check |
| GET | /api/mobile/cases |
| POST | /api/mobile/cases/batch/attachments |
| GET | /api/mobile/forms/:formType/template |
| GET | /api/mobile/health |
| POST | /api/mobile/location/capture |
| GET | /api/mobile/location/reverse-geocode |
| GET | /api/mobile/location/trail |
| POST | /api/mobile/location/validate |
| GET | /api/mobile/sync/changes |
| GET | /api/mobile/sync/download |
| POST | /api/mobile/sync/enterprise |
| GET | /api/mobile/sync/health |
| GET | /api/mobile/sync/status |
| POST | /api/mobile/sync/upload |
| GET | /api/mobile/tasks |
| POST | /api/mobile/telemetry/mobile/ingest |
| GET | /api/mobile/verification-tasks/:taskId |
| GET | /api/mobile/verification-tasks/:taskId/attachments |
| POST | /api/mobile/verification-tasks/:taskId/attachments |
| GET | /api/mobile/verification-tasks/:taskId/attachments/:attachmentId |
| POST | /api/mobile/verification-tasks/:taskId/auto-save |
| GET | /api/mobile/verification-tasks/:taskId/auto-save/:formType |
| POST | /api/mobile/verification-tasks/:taskId/complete |
| GET | /api/mobile/verification-tasks/:taskId/forms |
| POST | /api/mobile/verification-tasks/:taskId/forms |
| GET | /api/mobile/verification-tasks/:taskId/location-history |
| POST | /api/mobile/verification-tasks/:taskId/operations |
| PUT | /api/mobile/verification-tasks/:taskId/priority |
| POST | /api/mobile/verification-tasks/:taskId/revoke |
| POST | /api/mobile/verification-tasks/:taskId/start |
| GET | /api/mobile/verification-tasks/:taskId/status |
| GET | /api/mobile/verification-tasks/:taskId/verification-images |
| POST | /api/mobile/verification-tasks/:taskId/verification/builder |
| POST | /api/mobile/verification-tasks/:taskId/verification/business |
| POST | /api/mobile/verification-tasks/:taskId/verification/dsa-connector |
| POST | /api/mobile/verification-tasks/:taskId/verification/noc |
| POST | /api/mobile/verification-tasks/:taskId/verification/office |
| POST | /api/mobile/verification-tasks/:taskId/verification/property-apf |
| POST | /api/mobile/verification-tasks/:taskId/verification/property-individual |
| POST | /api/mobile/verification-tasks/:taskId/verification/residence |
| POST | /api/mobile/verification-tasks/:taskId/verification/residence-cum-office |

## notifications.ts (/api/notifications)

| Method | Path |
|---|---|
| DELETE | /api/notifications/ |
| GET | /api/notifications/ |
| DELETE | /api/notifications/:notificationId |
| GET | /api/notifications/:notificationId/delivery |
| PUT | /api/notifications/:notificationId/read |
| PUT | /api/notifications/:notificationId/unread |
| GET | /api/notifications/analytics |
| PUT | /api/notifications/mark-all-read |
| GET | /api/notifications/preferences |
| PUT | /api/notifications/preferences |
| POST | /api/notifications/test |
| GET | /api/notifications/test/connectivity |
| GET | /api/notifications/tokens |
| POST | /api/notifications/tokens |
| DELETE | /api/notifications/tokens/:tokenId |

## pincodes.ts (/api/pincodes)

| Method | Path |
|---|---|
| GET | /api/pincodes/ |
| POST | /api/pincodes/ |
| DELETE | /api/pincodes/:id |
| GET | /api/pincodes/:id |
| PUT | /api/pincodes/:id |
| GET | /api/pincodes/:id/areas |
| POST | /api/pincodes/:id/areas |
| DELETE | /api/pincodes/:id/areas/:areaId |
| POST | /api/pincodes/bulk-import |
| GET | /api/pincodes/search |

## products.ts (/api/products)

| Method | Path |
|---|---|
| GET | /api/products/ |
| POST | /api/products/ |
| DELETE | /api/products/:id |
| GET | /api/products/:id |
| PUT | /api/products/:id |
| GET | /api/products/:id/verification-types |
| GET | /api/products/stats |

## rate-type-assignments.ts (/api/rate-type-assignments)

| Method | Path |
|---|---|
| GET | /api/rate-type-assignments/ |
| POST | /api/rate-type-assignments/ |
| DELETE | /api/rate-type-assignments/:id |
| POST | /api/rate-type-assignments/bulk-assign |
| GET | /api/rate-type-assignments/by-combination |

## rate-types.ts (/api/rate-types)

| Method | Path |
|---|---|
| GET | /api/rate-types/ |
| POST | /api/rate-types/ |
| DELETE | /api/rate-types/:id |
| GET | /api/rate-types/:id |
| PUT | /api/rate-types/:id |
| GET | /api/rate-types/available-for-case |
| GET | /api/rate-types/stats |

## rates.ts (/api/rates)

| Method | Path |
|---|---|
| GET | /api/rates/ |
| POST | /api/rates/ |
| DELETE | /api/rates/:id |
| GET | /api/rates/available-for-assignment |
| GET | /api/rates/stats |

## rbac.ts (/api/permissions)

| Method | Path |
|---|---|
| GET | /api/permissions/ |
| GET | /api/permissions/permissions |
| GET | /api/permissions/roles |
| POST | /api/permissions/roles |
| DELETE | /api/permissions/roles/:id |
| GET | /api/permissions/roles/:id |
| PUT | /api/permissions/roles/:id |
| GET | /api/permissions/roles/:id/permissions |
| PUT | /api/permissions/roles/:id/permissions |
| GET | /api/permissions/roles/:id/routes |
| PUT | /api/permissions/roles/:id/routes |

## reports.ts (/api/reports)

| Method | Path |
|---|---|
| GET | /api/reports/agent-performance |
| GET | /api/reports/agent-productivity/:agentId |
| GET | /api/reports/case-analytics |
| GET | /api/reports/case-timeline/:caseId |
| GET | /api/reports/cases |
| GET | /api/reports/clients |
| GET | /api/reports/form-submissions |
| GET | /api/reports/form-submissions/:formType |
| GET | /api/reports/form-validation-status |
| GET | /api/reports/invoices |
| GET | /api/reports/invoices/download |
| POST | /api/reports/invoices/download |
| GET | /api/reports/mis-dashboard-data |
| GET | /api/reports/mis-dashboard-data/export |
| GET | /api/reports/users |

## roles.ts (/api/roles)

| Method | Path |
|---|---|
| GET | /api/roles/ |
| POST | /api/roles/ |
| DELETE | /api/roles/:id |
| GET | /api/roles/:id |
| PUT | /api/roles/:id |
| GET | /api/roles/:id/permissions |
| PUT | /api/roles/:id/permissions |
| GET | /api/roles/:id/routes |
| PUT | /api/roles/:id/routes |

## security.ts (/api/security)

| Method | Path |
|---|---|
| POST | /api/security/mac-addresses |
| DELETE | /api/security/mac-addresses/:id |
| GET | /api/security/mac-addresses/:userId |

## states.ts (/api/states)

| Method | Path |
|---|---|
| GET | /api/states/ |
| POST | /api/states/ |
| DELETE | /api/states/:id |
| GET | /api/states/:id |
| PUT | /api/states/:id |
| POST | /api/states/bulk-import |
| GET | /api/states/stats |

## templateReports.ts (/api/template-reports)

| Method | Path |
|---|---|
| GET | /api/template-reports/cases/:caseId |
| GET | /api/template-reports/cases/:caseId/submissions/:submissionId |
| POST | /api/template-reports/cases/:caseId/submissions/:submissionId/generate |
| DELETE | /api/template-reports/reports/:reportId |

## territoryAssignments.ts (/api/territory-assignments)

| Method | Path |
|---|---|
| GET | /api/territory-assignments/field-agents |
| GET | /api/territory-assignments/field-agents/:userId |
| POST | /api/territory-assignments/field-agents/:userId/add-pincode |
| DELETE | /api/territory-assignments/field-agents/:userId/all |
| POST | /api/territory-assignments/field-agents/:userId/areas |
| DELETE | /api/territory-assignments/field-agents/:userId/areas/:areaId |
| POST | /api/territory-assignments/field-agents/:userId/pincodes |
| DELETE | /api/territory-assignments/field-agents/:userId/pincodes/:pincodeId |

## user.ts (/api/user)

| Method | Path |
|---|---|
| GET | /api/user/id-card |
| GET | /api/user/profile |
| PUT | /api/user/profile/photo |

## userTerritory.ts (/api/users)

| Method | Path |
|---|---|
| GET | /api/users/:userId/territory-assignments |
| POST | /api/users/:userId/territory-assignments/bulk |

## users.ts (/api/users)

| Method | Path |
|---|---|
| GET | /api/users/ |
| POST | /api/users/ |
| DELETE | /api/users/:id |
| GET | /api/users/:id |
| PUT | /api/users/:id |
| POST | /api/users/:id/activate |
| POST | /api/users/:id/change-password |
| POST | /api/users/:id/deactivate |
| POST | /api/users/:id/generate-temp-password |
| GET | /api/users/:userId/client-assignments |
| POST | /api/users/:userId/client-assignments |
| DELETE | /api/users/:userId/client-assignments/:clientId |
| GET | /api/users/:userId/product-assignments |
| POST | /api/users/:userId/product-assignments |
| DELETE | /api/users/:userId/product-assignments/:productId |
| GET | /api/users/activities |
| POST | /api/users/bulk-operation |
| GET | /api/users/departments |
| GET | /api/users/designations |
| POST | /api/users/export |
| GET | /api/users/field-agents/available |
| GET | /api/users/import-template |
| POST | /api/users/reset-password |
| GET | /api/users/roles/permissions |
| GET | /api/users/search |
| GET | /api/users/sessions |
| GET | /api/users/stats |

## verification-types.ts (/api/verification-types)

| Method | Path |
|---|---|
| GET | /api/verification-types/ |
| POST | /api/verification-types/ |
| DELETE | /api/verification-types/:id |
| GET | /api/verification-types/:id |
| PUT | /api/verification-types/:id |
| GET | /api/verification-types/stats |

## verificationTasks.ts (/api)

| Method | Path |
|---|---|
| GET | /api/cases/:caseId/verification-tasks |
| POST | /api/cases/:caseId/verification-tasks |
| GET | /api/mobile/my-verification-tasks |
| POST | /api/mobile/verification-tasks/:taskId/submit |
| GET | /api/verification-tasks |
| GET | /api/verification-tasks/:taskId |
| PUT | /api/verification-tasks/:taskId |
| POST | /api/verification-tasks/:taskId/assign |
| GET | /api/verification-tasks/:taskId/assignment-history |
| POST | /api/verification-tasks/:taskId/cancel |
| POST | /api/verification-tasks/:taskId/complete |
| POST | /api/verification-tasks/:taskId/revoke |
| POST | /api/verification-tasks/:taskId/start |
| GET | /api/verification-tasks/:taskId/validate |
| POST | /api/verification-tasks/bulk-assign |
| POST | /api/verification-tasks/revisit/:taskId |
