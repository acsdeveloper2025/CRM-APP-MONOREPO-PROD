import { query } from '@/config/database';
import type { PoolClient } from 'pg';
import { getAssignedAreaIds } from '@/middleware/areaAccess';
import { getAssignedClientIds } from '@/middleware/clientAccess';
import { getAssignedPincodeIds } from '@/middleware/pincodeAccess';
import { getAssignedProductIds } from '@/middleware/productAccess';
import {
  hasSystemScopeBypass,
  isFieldExecutionActor,
  isScopedOperationsUser,
} from '@/security/rbacAccess';
import { getScopedOperationalUserIds } from '@/security/userScope';
import { loadUserCapabilityProfile } from '@/security/userCapabilities';

type Queryable = Pick<PoolClient, 'query'>;

export type NotificationViewer = {
  id: string;
  permissionCodes?: string[];
  assignedClientIds?: number[];
  assignedProductIds?: number[];
};

export type NotificationReference = {
  id: string;
  userId: string;
  caseId?: string | null;
  taskId?: string | null;
};

type ViewerContext = {
  viewer: NotificationViewer;
  isBypass: boolean;
  isExecutionActor: boolean;
  isScopedOps: boolean;
  assignedClientIds?: number[];
  assignedProductIds?: number[];
  assignedAreaIds?: number[];
  assignedPincodeIds?: number[];
  hierarchyUserIds?: string[];
};

type TaskScopeRow = {
  id: string;
  caseId: string;
  assignedTo: string | null;
  areaId: number | null;
  pincodeId: number | null;
  clientId: number;
  productId: number;
};

type CaseScopeRow = {
  id: string;
  assignedTo: string | null;
  clientId: number;
  productId: number;
  // 2026-05-03 (bug 33): the user who created this case via the web
  // frontend. They MUST receive notifications about its lifecycle even
  // if their hierarchy/client/product access changed afterwards. Without
  // this, the case creator (e.g. pradnya.mohite) was being skipped on
  // task-completion notifications for their own cases.
  createdByBackendUser: string | null;
  taskAssignees: string[] | null;
  areaIds: number[] | null;
  pincodeIds: number[] | null;
};

const toArraySet = <T>(values: T[] | undefined): Set<T> | undefined =>
  values ? new Set(values) : undefined;

const arraysOverlap = <T>(left: T[] | undefined, right: Set<T> | undefined): boolean => {
  if (!left || !right || left.length === 0 || right.size === 0) {
    return false;
  }

  return left.some(value => right.has(value));
};

const isDefinedString = (value: string | null | undefined): value is string =>
  typeof value === 'string';

const buildViewerContext = async (
  viewer: NotificationViewer,
  db?: Queryable
): Promise<ViewerContext | null> => {
  const profile = await loadUserCapabilityProfile(viewer.id, db);
  if (!profile) {
    return null;
  }

  const permissionCodes = viewer.permissionCodes || profile.permissionCodes;
  const scopedOps = isScopedOperationsUser({ id: viewer.id, permissionCodes } as never);
  const executionActor = isFieldExecutionActor({ id: viewer.id, permissionCodes } as never);
  const bypass = hasSystemScopeBypass({ id: viewer.id, permissionCodes } as never);

  const needsScopedAssignments = scopedOps && !bypass;
  const needsExecutionAssignments = executionActor && !bypass;

  const [
    assignedClientIds,
    assignedProductIds,
    assignedAreaIds,
    assignedPincodeIds,
    hierarchyUserIds,
  ] = await Promise.all([
    needsScopedAssignments
      ? viewer.assignedClientIds
        ? Promise.resolve(viewer.assignedClientIds)
        : getAssignedClientIds(viewer.id)
      : Promise.resolve(undefined),
    needsScopedAssignments
      ? viewer.assignedProductIds
        ? Promise.resolve(viewer.assignedProductIds)
        : getAssignedProductIds(viewer.id)
      : Promise.resolve(undefined),
    needsExecutionAssignments ? getAssignedAreaIds(viewer.id) : Promise.resolve(undefined),
    needsExecutionAssignments ? getAssignedPincodeIds(viewer.id) : Promise.resolve(undefined),
    needsScopedAssignments
      ? getScopedOperationalUserIds(viewer.id, db)
      : Promise.resolve(undefined),
  ]);

  return {
    viewer: { ...viewer, permissionCodes },
    isBypass: bypass,
    isExecutionActor: executionActor,
    isScopedOps: scopedOps,
    assignedClientIds: assignedClientIds ?? viewer.assignedClientIds,
    assignedProductIds: assignedProductIds ?? viewer.assignedProductIds,
    assignedAreaIds,
    assignedPincodeIds,
    hierarchyUserIds,
  };
};

const loadTaskScopeRows = async (
  taskIds: string[],
  db?: Queryable
): Promise<Map<string, TaskScopeRow>> => {
  if (taskIds.length === 0) {
    return new Map();
  }

  const result = db
    ? await db.query<TaskScopeRow>(
        `
          SELECT
            vt.id,
            vt.case_id as case_id,
            vt.assigned_to as assigned_to,
            vt.area_id as area_id,
            p_scope.id as pincode_id,
            c.client_id as client_id,
            c.product_id as product_id
          FROM verification_tasks vt
          JOIN cases c ON c.id = vt.case_id
          LEFT JOIN pincodes p_scope ON p_scope.id = vt.pincode_id
          WHERE vt.id = ANY($1::uuid[])
        `,
        [taskIds]
      )
    : await query<TaskScopeRow>(
        `
      SELECT
        vt.id,
        vt.case_id as case_id,
        vt.assigned_to as assigned_to,
        vt.area_id as area_id,
        p_scope.id as pincode_id,
        c.client_id as client_id,
        c.product_id as product_id
      FROM verification_tasks vt
      JOIN cases c ON c.id = vt.case_id
      LEFT JOIN pincodes p_scope ON p_scope.id = vt.pincode_id
      WHERE vt.id = ANY($1::uuid[])
    `,
        [taskIds]
      );

  return new Map(result.rows.map(row => [row.id, row]));
};

const loadCaseScopeRows = async (
  caseIds: string[],
  db?: Queryable
): Promise<Map<string, CaseScopeRow>> => {
  if (caseIds.length === 0) {
    return new Map();
  }

  const result = db
    ? await db.query<CaseScopeRow>(
        `
          SELECT
            c.id,
            NULL::uuid as assigned_to,
            c.client_id as client_id,
            c.product_id as product_id,
            c.created_by_backend_user as "created_by_backend_user",
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT vt.assigned_to), NULL) as "task_assignees",
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT vt.area_id), NULL) as "area_ids",
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT p_scope.id), NULL) as "pincode_ids"
          FROM cases c
          LEFT JOIN verification_tasks vt ON vt.case_id = c.id
          LEFT JOIN pincodes p_scope ON p_scope.id = vt.pincode_id
          WHERE c.id = ANY($1::uuid[])
          GROUP BY c.id, c.client_id, c.product_id, c.created_by_backend_user
        `,
        [caseIds]
      )
    : await query<CaseScopeRow>(
        `
      SELECT
        c.id,
        NULL::uuid as assigned_to,
        c.client_id as client_id,
        c.product_id as product_id,
        c.created_by_backend_user as "created_by_backend_user",
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT vt.assigned_to), NULL) as "task_assignees",
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT vt.area_id), NULL) as "area_ids",
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT p_scope.id), NULL) as "pincode_ids"
      FROM cases c
      LEFT JOIN verification_tasks vt ON vt.case_id = c.id
      LEFT JOIN pincodes p_scope ON p_scope.id = vt.pincode_id
      WHERE c.id = ANY($1::uuid[])
      GROUP BY c.id, c.client_id, c.product_id, c.created_by_backend_user
    `,
        [caseIds]
      );

  return new Map(result.rows.map(row => [row.id, row]));
};

const canAccessTask = (task: TaskScopeRow | undefined, viewerContext: ViewerContext): boolean => {
  if (!task) {
    return false;
  }

  if (viewerContext.isBypass) {
    return true;
  }

  if (viewerContext.isExecutionActor) {
    const areaSet = toArraySet(viewerContext.assignedAreaIds);
    const pincodeSet = toArraySet(viewerContext.assignedPincodeIds);

    return (
      task.assignedTo === viewerContext.viewer.id ||
      (task.areaId !== null && Boolean(areaSet?.has(task.areaId))) ||
      (task.pincodeId !== null && Boolean(pincodeSet?.has(task.pincodeId)))
    );
  }

  if (viewerContext.isScopedOps) {
    if (viewerContext.hierarchyUserIds) {
      return viewerContext.hierarchyUserIds.includes(task.assignedTo || '');
    }

    const clientAllowed = viewerContext.assignedClientIds?.includes(task.clientId) ?? false;
    const productAllowed = viewerContext.assignedProductIds?.includes(task.productId) ?? false;
    return clientAllowed && productAllowed;
  }

  return true;
};

const canAccessCase = (
  caseRow: CaseScopeRow | undefined,
  viewerContext: ViewerContext
): boolean => {
  if (!caseRow) {
    return false;
  }

  if (viewerContext.isBypass) {
    return true;
  }

  // 2026-05-03 (bug 33): the user who created this case via the web frontend
  // ALWAYS has access to its lifecycle notifications, regardless of their
  // current hierarchy / client / product assignments. Without this, a backend
  // user (e.g. pradnya.mohite) creating a case for nikhil.parab to verify
  // would NOT receive the task-completion notification because nikhil is not
  // in pradnya's reporting hierarchy. Case creator → notification recipient
  // is a strict invariant: you opened the work, you hear about its outcome.
  if (
    caseRow.createdByBackendUser &&
    caseRow.createdByBackendUser === viewerContext.viewer.id
  ) {
    return true;
  }

  if (viewerContext.isExecutionActor) {
    const areaSet = toArraySet(viewerContext.assignedAreaIds);
    const pincodeSet = toArraySet(viewerContext.assignedPincodeIds);

    return (
      caseRow.assignedTo === viewerContext.viewer.id ||
      caseRow.taskAssignees?.includes(viewerContext.viewer.id) === true ||
      arraysOverlap(caseRow.areaIds || undefined, areaSet) ||
      arraysOverlap(caseRow.pincodeIds || undefined, pincodeSet)
    );
  }

  if (viewerContext.isScopedOps) {
    if (viewerContext.hierarchyUserIds) {
      return (
        viewerContext.hierarchyUserIds.includes(caseRow.assignedTo || '') ||
        arraysOverlap(
          caseRow.taskAssignees || undefined,
          toArraySet(viewerContext.hierarchyUserIds)
        )
      );
    }

    const clientAllowed = viewerContext.assignedClientIds?.includes(caseRow.clientId) ?? false;
    const productAllowed = viewerContext.assignedProductIds?.includes(caseRow.productId) ?? false;
    return clientAllowed && productAllowed;
  }

  return true;
};

export const filterNotificationsByCurrentScope = async (
  viewer: NotificationViewer,
  notifications: NotificationReference[],
  db?: Queryable
): Promise<{
  visibleIds: Set<string>;
  actionTargets: Map<string, string>;
}> => {
  if (notifications.length === 0) {
    return { visibleIds: new Set(), actionTargets: new Map() };
  }

  const viewerContext = await buildViewerContext(viewer, db);
  if (!viewerContext) {
    return { visibleIds: new Set(), actionTargets: new Map() };
  }

  const taskIds = Array.from(
    new Set(notifications.map(notification => notification.taskId).filter(isDefinedString))
  );
  const caseIds = Array.from(
    new Set(notifications.map(notification => notification.caseId).filter(isDefinedString))
  );

  const [taskRows, caseRows] = await Promise.all([
    loadTaskScopeRows(taskIds, db),
    loadCaseScopeRows(caseIds, db),
  ]);

  const visibleIds = new Set<string>();
  const actionTargets = new Map<string, string>();

  for (const notification of notifications) {
    let allowed = true;
    let actionTarget = '/dashboard';

    if (notification.taskId) {
      allowed = canAccessTask(taskRows.get(notification.taskId), viewerContext);
      if (allowed) {
        actionTarget = `/task-management/${notification.taskId}`;
      }
    } else if (notification.caseId) {
      allowed = canAccessCase(caseRows.get(notification.caseId), viewerContext);
      if (allowed) {
        actionTarget = `/case-management/${notification.caseId}`;
      }
    }

    if (allowed) {
      visibleIds.add(notification.id);
      actionTargets.set(notification.id, actionTarget);
    }
  }

  return { visibleIds, actionTargets };
};

export const canTargetUserAccessNotificationObject = async (
  viewerUserId: string,
  refs: Pick<NotificationReference, 'caseId' | 'taskId'>
): Promise<{ allowed: boolean; actionUrl?: string }> => {
  const notification: NotificationReference = {
    id: 'validation',
    userId: viewerUserId,
    caseId: refs.caseId ?? null,
    taskId: refs.taskId ?? null,
  };

  const result = await filterNotificationsByCurrentScope({ id: viewerUserId }, [notification]);

  const allowed = result.visibleIds.has('validation');
  return {
    allowed,
    actionUrl: allowed ? result.actionTargets.get('validation') : undefined,
  };
};
