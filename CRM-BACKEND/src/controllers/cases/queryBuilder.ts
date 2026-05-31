import type { AuthenticatedRequest } from '../../middleware/auth';
import { isFieldExecutionActor, isScopedOperationsUser } from '@/security/rbacAccess';
import { getScopedOperationalUserIds } from '@/security/userScope';

// =====================================================
// Module-scope export + sort constants (filter-sweep 2026-05-23)
// =====================================================
//
// Single source of WHERE-truth for list + export + stats. Mirrors the
// canonical pattern locked in invoicesController / verificationTasksController.
// Any new filter param goes in `buildCasesBaseWhereClause` ONCE and all 3
// endpoints inherit it.
export const CASE_EXPORT_ROW_LIMIT = 10000;
export const CASE_SORT_MAP: Record<string, string> = {
  createdAt: 'c.created_at',
  updatedAt: 'c.updated_at',
  customerName: 'c.customer_name',
  priority: 'c.priority',
  status: 'c.status',
  caseId: 'c.case_id',
  completedAt: 'c.completed_at',
  // pendingDuration is a computed expression — handled inline in getCases.
};

type CasesBaseWhereResult = {
  baseConditions: string[];
  baseParams: (string | number | boolean | string[] | number[])[];
  baseParamIndex: number;
};

/**
 * Build the BASE WHERE clause shared by list + export + stats — every
 * filter EXCEPT `status` and `exportType` (those are caller-specific —
 * stats endpoint ignores them; list applies status; export applies
 * exportType + optional status). Preserves all scope branches
 * (FIELD_AGENT pincode+area / scoped-ops hierarchy+client/product /
 * activeScope narrowing).
 */
export async function buildCasesBaseWhereClause(
  req: AuthenticatedRequest
): Promise<CasesBaseWhereResult> {
  const baseConditions: string[] = [];
  const baseParams: (string | number | boolean | string[] | number[])[] = [];
  let baseParamIndex = 1;

  const userId = req.user!.id;
  const isExecutionActor = isFieldExecutionActor(req.user);
  const isScopedOps = isScopedOperationsUser(req.user);
  const hierarchyUserIds = userId ? await getScopedOperationalUserIds(userId) : undefined;

  if (isExecutionActor) {
    const { getAssignedPincodeIds } = await import('@/middleware/pincodeAccess');
    const { getAssignedAreaIds } = await import('@/middleware/areaAccess');

    const assignedPincodeIds = await getAssignedPincodeIds(userId);
    const assignedAreaIds = await getAssignedAreaIds(userId);

    const fieldAgentConditions: string[] = [];

    fieldAgentConditions.push(`EXISTS (
      SELECT 1 FROM verification_tasks vt
      WHERE vt.case_id = c.id
      AND vt.assigned_to = $${baseParamIndex}
    )`);
    baseParams.push(userId);
    baseParamIndex++;

    if (assignedPincodeIds && assignedPincodeIds.length > 0) {
      fieldAgentConditions.push(`EXISTS (
        SELECT 1 FROM verification_tasks vt
        WHERE vt.case_id = c.id
        AND vt.pincode_id = ANY($${baseParamIndex}::int[])
      )`);
      baseParams.push(assignedPincodeIds);
      baseParamIndex++;
    }

    if (assignedAreaIds && assignedAreaIds.length > 0) {
      fieldAgentConditions.push(`EXISTS (
        SELECT 1 FROM verification_tasks vt
        WHERE vt.case_id = c.id
        AND vt.area_id = ANY($${baseParamIndex}::int[])
      )`);
      baseParams.push(assignedAreaIds);
      baseParamIndex++;
    }

    if (fieldAgentConditions.length > 0) {
      baseConditions.push(`(${fieldAgentConditions.join(' OR ')})`);
    } else {
      baseConditions.push('FALSE');
    }
  } else if (isScopedOps) {
    if (hierarchyUserIds) {
      if (hierarchyUserIds.length === 0) {
        baseConditions.push('FALSE');
      } else {
        baseConditions.push(`(
          c.created_by_backend_user = ANY($${baseParamIndex}::uuid[])
          OR EXISTS (
            SELECT 1 FROM verification_tasks vt_scope
            WHERE vt_scope.case_id = c.id
              AND vt_scope.assigned_to = ANY($${baseParamIndex}::uuid[])
          )
        )`);
        baseParams.push(hierarchyUserIds);
        baseParamIndex++;
      }
    } else {
      const { getAssignedClientIds } = await import('@/middleware/clientAccess');
      const { getAssignedProductIds } = await import('@/middleware/productAccess');

      const assignedClientIds = await getAssignedClientIds(userId);
      const assignedProductIds = await getAssignedProductIds(userId);

      if (assignedClientIds && assignedClientIds.length > 0) {
        baseConditions.push(`c.client_id = ANY($${baseParamIndex}::int[])`);
        baseParams.push(assignedClientIds);
        baseParamIndex++;
      } else if (assignedClientIds && assignedClientIds.length === 0) {
        baseConditions.push('FALSE');
      }

      if (assignedProductIds && assignedProductIds.length > 0) {
        baseConditions.push(`c.product_id = ANY($${baseParamIndex}::int[])`);
        baseParams.push(assignedProductIds);
        baseParamIndex++;
      } else if (assignedProductIds && assignedProductIds.length === 0) {
        baseConditions.push('FALSE');
      }
    }
  } else if (req.query.assignedTo) {
    baseConditions.push(`EXISTS (
      SELECT 1 FROM verification_tasks vt
      WHERE vt.case_id = c.id
      AND vt.assigned_to = $${baseParamIndex}
    )`);
    baseParams.push(req.query.assignedTo as string);
    baseParamIndex++;
  }

  // P11.A.1/A.2 — active-scope narrowing.
  if (req.activeScope?.clientId != null) {
    baseConditions.push(`c.client_id = $${baseParamIndex}`);
    baseParams.push(req.activeScope.clientId);
    baseParamIndex++;
  }
  if (req.activeScope?.productId != null) {
    baseConditions.push(`c.product_id = $${baseParamIndex}`);
    baseParams.push(req.activeScope.productId);
    baseParamIndex++;
  }

  // Search (case_id::text cast required — case_id is INTEGER).
  const search = req.query.search;
  if (search) {
    baseConditions.push(`(
      COALESCE(c.customer_name, '') ILIKE $${baseParamIndex} OR
      COALESCE(c.case_id::text, '') ILIKE $${baseParamIndex} OR
      EXISTS (
        SELECT 1 FROM verification_tasks vt
        WHERE vt.case_id = c.id AND vt.address ILIKE $${baseParamIndex}
      ) OR
      COALESCE(c.customer_phone, '') ILIKE $${baseParamIndex} OR
      COALESCE(c.trigger, '') ILIKE $${baseParamIndex} OR
      COALESCE(c.applicant_type, '') ILIKE $${baseParamIndex}
    )`);
    baseParams.push(
      `%${typeof search === 'string' || typeof search === 'number' ? String(search) : ''}%`
    );
    baseParamIndex++;
  }

  const { clientId, productId, verificationTypeId, priority, dateFrom, dateTo } = req.query;

  if (clientId) {
    baseConditions.push(`c.client_id = $${baseParamIndex}`);
    baseParams.push(parseInt(clientId as string));
    baseParamIndex++;
  }
  if (productId) {
    baseConditions.push(`c.product_id = $${baseParamIndex}`);
    baseParams.push(parseInt(productId as string));
    baseParamIndex++;
  }
  if (verificationTypeId) {
    baseConditions.push(`c.verification_type_id = $${baseParamIndex}`);
    baseParams.push(verificationTypeId as string);
    baseParamIndex++;
  }
  if (priority) {
    baseConditions.push(`c.priority = $${baseParamIndex}`);
    baseParams.push(priority as string);
    baseParamIndex++;
  }

  if (dateFrom) {
    baseConditions.push(`c.created_at >= $${baseParamIndex}`);
    baseParams.push(dateFrom as string);
    baseParamIndex++;
  }
  if (dateTo) {
    // Canonical inclusive-end-of-day semantic (mirrors invoices/MIS/tasks):
    // < (dateTo::date + INTERVAL '1 day') captures the full dateTo day.
    baseConditions.push(`c.created_at < ($${baseParamIndex}::date + INTERVAL '1 day')`);
    baseParams.push(dateTo as string);
    baseParamIndex++;
  }

  return { baseConditions, baseParams, baseParamIndex };
}
