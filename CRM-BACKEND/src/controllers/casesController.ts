// casesController is now a thin re-export BARREL. Every handler lives in its
// own module under ./cases/* (the §7 god-controller decomposition, 2026-06-01).
// routes/cases.ts imports the same symbol names from this file, so the public
// surface is unchanged — the implementations just moved into focused modules.

// Multer upload config for case-creation attachments lives in ./cases/upload.
// Re-exported here so routes/cases.ts keeps importing it from this controller.
export { uploadForCaseCreation } from './cases/upload';

// The /create body-normalize middleware + express-validator chain live in
// ./cases/createValidation. Re-exported so routes/cases.ts keeps importing
// them from this controller.
export { normalizeCaseCreationBody, createCaseValidation } from './cases/createValidation';

// GET /api/cases (getCases) lives in ./cases/getCases.
export { getCases } from './cases/getCases';

// GET /api/cases/stats (getCaseStats) lives in ./cases/getCaseStats.
export { getCaseStats } from './cases/getCaseStats';

// GET /api/cases/:id (getCaseById) lives in ./cases/getCaseById.
export { getCaseById } from './cases/getCaseById';

// POST /api/cases - Create new case (OLD - REMOVED)
// Replaced by unified createCase endpoint at the end of this file

// PUT /api/cases/:id (updateCase) lives in ./cases/updateCase.
export { updateCase } from './cases/updateCase';

// 2026-04-28 PE2.b cleanup: deleted dead caseAssignment chain (6 handlers,
// services/caseAssignmentService.ts, jobs/caseAssignmentProcessor.ts,
// config/queue.ts). Case-level assignment is no longer a valid concept —
// assignment lives on verification_tasks. The 5 unmounted handlers had no
// route; getFieldAgentWorkload was routed at /analytics/field-agent-workload
// but had zero frontend consumers AND its backing view `field_agent_workload`
// did not exist in the DB (500 on call).

// GET /api/cases/export (exportCases) lives in ./cases/exportCases.
export { exportCases } from './cases/exportCases';

// =====================================================
// ENHANCED MULTI-VERIFICATION CASE CREATION
// =====================================================

/**
 * Create case with multiple verification tasks (OLD - REMOVED)
 * Replaced by unified createCase endpoint below
 */

// getCaseSummaryWithTasks (GET /api/cases/:id/summary) lives in ./cases/summary.
// Re-exported so routes/cases.ts keeps importing it from this controller.
export { getCaseSummaryWithTasks } from './cases/summary';

// ============================================================================
// UNIFIED CASE CREATION ENDPOINT - PRODUCTION READY
// ============================================================================

// POST /api/cases/config-validation (validateCaseConfiguration) lives in
// ./cases/configValidation. Re-exported so routes/cases.ts is untouched.
export { validateCaseConfiguration } from './cases/configValidation';

// POST /api/cases/create (createCase) — the unified case-creation handler —
// lives in ./cases/createCase. Re-exported so routes/cases.ts keeps importing
// it from this controller. The DatabaseError interface it used moved there too.
export { createCase } from './cases/createCase';
