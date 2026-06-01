import type { AuthenticatedRequest } from '../../middleware/auth';
import { isFieldExecutionActor, isScopedOperationsUser } from '@/security/rbacAccess';
import { getScopedOperationalUserIds } from '@/security/userScope';
import { getAssignedClientIds } from '@/middleware/clientAccess';
import { getAssignedProductIds } from '@/middleware/productAccess';

// =====================================================
// Module-scope export + sort constants (filter-sweep 2026-05-23)
// =====================================================
//
// Single source of WHERE-truth for list + export + stats. Mirrors the
// canonical pattern locked in invoicesController / clientsController /
// reportsController. Any new filter param goes in
// `buildVerificationTasksWhereClause` ONCE and all 3 endpoints inherit
// it (closes the export-vs-list drift class).
export const TASK_EXPORT_ROW_LIMIT = 10000;
export const TASK_SORT_MAP: Record<string, string> = {
  createdAt: 'vt.created_at',
  updatedAt: 'vt.updated_at',
  assignedAt: 'vt.assigned_at',
  completedAt: 'vt.completed_at',
  startedAt: 'vt.started_at',
  priority: 'vt.priority',
  status: 'vt.status',
  taskNumber: 'vt.task_number',
};

export type TaskWhereResult = {
  conditions: string[];
  params: (string | number | boolean | null | string[] | number[])[];
  paramIndex: number;
};

export async function buildVerificationTasksWhereClause(
  req: AuthenticatedRequest
): Promise<TaskWhereResult> {
  const conditions: string[] = [];
  const params: (string | number | boolean | null | string[] | number[])[] = [];
  let paramIndex = 1;

  const userId = req.user!.id;
  const isExecutionActor = isFieldExecutionActor(req.user);
  const isScopedOps = isScopedOperationsUser(req.user);
  const hierarchyUserIds = userId ? await getScopedOperationalUserIds(userId) : undefined;

  // Role-based filtering — FIELD_AGENT users see tasks assigned to them
  // OR in their assigned pincodes/areas.
  if (isExecutionActor) {
    const { getAssignedPincodeIds } = await import('@/middleware/pincodeAccess');
    const { getAssignedAreaIds } = await import('@/middleware/areaAccess');

    const assignedPincodeIds = await getAssignedPincodeIds(userId);
    const assignedAreaIds = await getAssignedAreaIds(userId);

    const fieldAgentConditions: string[] = [];
    fieldAgentConditions.push(`vt.assigned_to = $${paramIndex}`);
    params.push(userId);
    paramIndex++;

    if (assignedPincodeIds && assignedPincodeIds.length > 0) {
      fieldAgentConditions.push(`vt.pincode_id = ANY($${paramIndex}::int[])`);
      params.push(assignedPincodeIds);
      paramIndex++;
    }
    if (assignedAreaIds && assignedAreaIds.length > 0) {
      fieldAgentConditions.push(`vt.area_id = ANY($${paramIndex}::int[])`);
      params.push(assignedAreaIds);
      paramIndex++;
    }

    if (fieldAgentConditions.length > 0) {
      conditions.push(`(${fieldAgentConditions.join(' OR ')})`);
    } else {
      conditions.push('FALSE');
    }
  } else if (isScopedOps) {
    if (hierarchyUserIds) {
      if (hierarchyUserIds.length === 0) {
        conditions.push('FALSE');
      } else {
        // Creator OR assignment scope. BACKEND_USER [self]: creator-only
        // (no tasks assigned to them). TL/Manager: created by subordinates
        // OR tasks assigned to them.
        conditions.push(`(
          c.created_by_backend_user = ANY($${paramIndex}::uuid[])
          OR vt.assigned_to = ANY($${paramIndex}::uuid[])
        )`);
        params.push(hierarchyUserIds);
        paramIndex++;
      }
    } else {
      const [assignedClientIds, assignedProductIds] = await Promise.all([
        getAssignedClientIds(userId),
        getAssignedProductIds(userId),
      ]);
      if (
        !assignedClientIds ||
        !assignedProductIds ||
        assignedClientIds.length === 0 ||
        assignedProductIds.length === 0
      ) {
        conditions.push('FALSE');
      } else {
        conditions.push(`c.client_id = ANY($${paramIndex}::int[])`);
        params.push(assignedClientIds);
        paramIndex++;
        conditions.push(`c.product_id = ANY($${paramIndex}::int[])`);
        params.push(assignedProductIds);
        paramIndex++;
      }
    }
  }

  // P11.A.3 — active-scope narrowing (mirrors site 1 in this controller
  // + P11.A.1/A.2 in cases). Closes leak L-C from the post-P10 re-audit.
  if (req.activeScope?.clientId != null) {
    conditions.push(`c.client_id = $${paramIndex}`);
    params.push(req.activeScope.clientId);
    paramIndex++;
  }
  if (req.activeScope?.productId != null) {
    conditions.push(`c.product_id = $${paramIndex}`);
    params.push(req.activeScope.productId);
    paramIndex++;
  }

  const {
    status,
    priority,
    assignedTo,
    verificationTypeId,
    clientId,
    productId,
    search,
    dateFrom,
    dateTo,
    taskType,
    excludeTaskType,
    excludeUnassignedRevisit,
    reassignedFilter,
  } = req.query;

  if (!isExecutionActor && assignedTo) {
    conditions.push(`vt.assigned_to = $${paramIndex}`);
    params.push(assignedTo as string);
    paramIndex++;
  }

  // Status filter (comma-separated). Skip when 'all' (export contract).
  if (status && status !== 'all') {
    const statuses = (status as string).split(',');
    const statusPlaceholders = statuses.map((_, idx) => `$${paramIndex + idx}`).join(',');
    conditions.push(`vt.status IN (${statusPlaceholders})`);
    params.push(...statuses);
    paramIndex += statuses.length;
  }

  // 2026-05-16 (+2026-05-17 fix): reassignedFilter narrows REVOKED list
  // views by whether an ACTIVE REPLACEMENT TASK exists. See B-152 in
  // memory for full rationale.
  if (reassignedFilter === 'awaiting') {
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM verification_tasks repl
      WHERE repl.parent_task_id = vt.id
        AND repl.status NOT IN ('REVOKED', 'COMPLETED')
    )`);
  } else if (reassignedFilter === 'reassigned') {
    conditions.push(`EXISTS (
      SELECT 1 FROM verification_tasks repl
      WHERE repl.parent_task_id = vt.id
        AND repl.status NOT IN ('REVOKED', 'COMPLETED')
    )`);
  }

  if (priority) {
    conditions.push(`vt.priority = $${paramIndex}`);
    params.push(priority as string);
    paramIndex++;
  }

  if (verificationTypeId) {
    conditions.push(`vt.verification_type_id = $${paramIndex}`);
    params.push(verificationTypeId as string);
    paramIndex++;
  }

  if (taskType) {
    conditions.push(`vt.task_type = $${paramIndex}`);
    params.push(taskType as string);
    paramIndex++;
  }

  if (excludeTaskType) {
    conditions.push(`(vt.task_type IS NULL OR vt.task_type != $${paramIndex})`);
    params.push(excludeTaskType as string);
    paramIndex++;
  }

  if (excludeUnassignedRevisit === 'true') {
    conditions.push(`NOT (vt.task_type = 'REVISIT' AND vt.assigned_to IS NULL)`);
  }

  if (clientId) {
    conditions.push(`c.client_id = $${paramIndex}`);
    params.push(parseInt(clientId as string));
    paramIndex++;
  }

  if (productId) {
    conditions.push(`c.product_id = $${paramIndex}`);
    params.push(parseInt(productId as string));
    paramIndex++;
  }

  // Search across customer/title/address/task#/trigger/applicantType/case#.
  // case_id is integer; ::text cast required (CWE class flagged in
  // Reports&MIS sub-sweep, commit 59b23553).
  if (search) {
    conditions.push(`(
      COALESCE(c.customer_name, '') ILIKE $${paramIndex} OR
      COALESCE(vt.task_title, '') ILIKE $${paramIndex} OR
      COALESCE(vt.address, '') ILIKE $${paramIndex} OR
      COALESCE(vt.task_number, '') ILIKE $${paramIndex} OR
      COALESCE(vt.trigger, '') ILIKE $${paramIndex} OR
      COALESCE(vt.applicant_type, '') ILIKE $${paramIndex} OR
      COALESCE(c.case_id::text, '') ILIKE $${paramIndex}
    )`);
    params.push(
      `%${typeof search === 'string' || typeof search === 'number' ? String(search) : ''}%`
    );
    paramIndex++;
  }

  if (dateFrom) {
    conditions.push(`vt.created_at >= $${paramIndex}`);
    params.push(dateFrom as string);
    paramIndex++;
  }
  if (dateTo) {
    // Canonical inclusive-end-of-day semantic (mirrors invoices/MIS):
    // < (dateTo::date + INTERVAL '1 day') captures the full dateTo day
    // regardless of timestamp precision.
    conditions.push(`vt.created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
    params.push(dateTo as string);
    paramIndex++;
  }

  return { conditions, params, paramIndex };
}
