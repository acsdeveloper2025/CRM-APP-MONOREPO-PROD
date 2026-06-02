import { useQuery } from '@tanstack/react-query';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { useActiveScope } from '@/hooks/useActiveScope';
import { kycService, type KYCTaskListQuery } from '@/services/kyc';
import { usePermissionContext } from '@/contexts/PermissionContext';

const kycKeys = {
  all: ['kyc'] as const,
  documentTypes: (filter?: { clientId?: number | null; productId?: number | null }) =>
    [...kycKeys.all, 'document-types', filter || {}] as const,
  tasks: (query: KYCTaskListQuery, scope: { c: number | null; p: number | null }) =>
    [...kycKeys.all, 'tasks', query, scope] as const,
  task: (id: string) => [...kycKeys.all, 'task', id] as const,
  caseTasks: (caseId: string) => [...kycKeys.all, 'case', caseId] as const,
  cycles: (id: string) => [...kycKeys.all, 'cycles', id] as const,
  mis: () => [...kycKeys.all, 'mis'] as const,
};

// P3/P6 (2026-06-02): per-cycle reverification history for a KYC task.
export const useKYCCycles = (taskId: string, enabled = true) => {
  return useQuery({
    queryKey: kycKeys.cycles(taskId),
    queryFn: () => kycService.getCycles(taskId),
    enabled: enabled && !!taskId,
    select: (res) => res.data || [],
  });
};

// P5/P6 (2026-06-02): KYC MIS metrics over the cycle table.
export const useKYCMis = (enabled = true) => {
  return useQuery({
    queryKey: kycKeys.mis(),
    queryFn: () => kycService.getMis(),
    enabled,
    select: (res) => res.data,
  });
};

/**
 * Phase 1.4 (2026-05-04): optional (clientId, productId) filter. When
 * BOTH are set, the dropdown returns only doc types that have an active
 * row in `document_type_rates` for that pair. Without the filter (or
 * with only one of them), behaves as before — returns ALL active
 * document types.
 */
export const useKYCDocumentTypes = (filter?: {
  clientId?: number | null;
  productId?: number | null;
}) => {
  return useQuery({
    queryKey: kycKeys.documentTypes(filter),
    queryFn: () =>
      kycService.getDocumentTypes({
        clientId: filter?.clientId ?? undefined,
        productId: filter?.productId ?? undefined,
      }),
    select: (data) => data.data || [],
    staleTime: 30 * 60 * 1000, // 30 min cache
  });
};

export const useKYCTasks = (query: KYCTaskListQuery = {}) => {
  // Defense-in-depth: include the active scope tuple in the cache key so
  // a scope flip cannot serve stale KYC data even if queryClient.clear()
  // is missed somewhere in the chain. Mirrors useCases (P18.A-05).
  const { selectedClientId, selectedProductId } = useActiveScope();
  return useQuery({
    queryKey: kycKeys.tasks(query, { c: selectedClientId, p: selectedProductId }),
    queryFn: () => kycService.listTasks(query),
    select: (response) => {
      // 2026-05-23: statistics wrap dropped — KYCDashboardPage now consumes
      // GET /api/kyc/tasks/stats directly. BE list endpoint no longer
      // returns the bundled stats block.
      const payload = response.data;
      return {
        data: payload?.data || [],
        pagination: payload?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
    },
  });
};

export const useKYCTaskDetail = (taskId: string) => {
  return useQuery({
    queryKey: kycKeys.task(taskId),
    queryFn: () => kycService.getTaskDetail(taskId),
    select: (data) => data.data || null,
    enabled: !!taskId,
  });
};

export const useKYCTasksForCase = (caseId: string) => {
  // 2026-05-03: gate on `kyc.view` permission. The backend route is
  // protected by `authorize('kyc.view')`, so users without the permission
  // (most backend users + field agents in some configs) get a 403. Without
  // this gate, the case-detail page fires the request anyway → repeated
  // 403 noise in the browser console + axios retry storms. With the gate,
  // the query stays disabled and `kycTasks` defaults to [] → KYC tab hides
  // its content gracefully.
  const { hasPermissionCode } = usePermissionContext();
  // 2026-05-05 (bug 48): also allow case.view so backend users who
  // CREATED the case can see the KYC tasks they attached. Verifying
  // documents still requires kyc.verify (the action endpoints check
  // that), but reading the list to confirm what was attached is
  // strictly a case-detail visibility concern.
  const canViewKyc = hasPermissionCode('kyc.view') || hasPermissionCode('case.view');
  return useQuery({
    queryKey: kycKeys.caseTasks(caseId),
    queryFn: () => kycService.getTasksForCase(caseId),
    select: (data) => data.data || [],
    enabled: !!caseId && canViewKyc,
  });
};

export const useVerifyKYCDocument = () => {
  return useMutationWithInvalidation({
    mutationFn: ({
      taskId,
      data,
    }: {
      taskId: string;
      data: { status: string; remarks?: string; rejectionReason?: string };
    }) => kycService.verifyDocument(taskId, data),
    invalidateKeys: [kycKeys.all],
    errorContext: 'KYC Verification',
  });
};

export const useAssignKYCTask = () => {
  return useMutationWithInvalidation({
    mutationFn: ({ taskId, assignedTo }: { taskId: string; assignedTo: string }) =>
      kycService.assignTask(taskId, assignedTo),
    invalidateKeys: [kycKeys.all],
    errorContext: 'KYC Task Assignment',
  });
};

// F9.1: KYC state transitions
export const useStartKYCTask = () => {
  return useMutationWithInvalidation({
    mutationFn: (taskId: string) => kycService.startTask(taskId),
    invalidateKeys: [kycKeys.all],
    errorContext: 'KYC Start',
  });
};

export const useRevokeKYCTask = () => {
  return useMutationWithInvalidation({
    mutationFn: ({ taskId, revokeReason }: { taskId: string; revokeReason: string }) =>
      kycService.revokeTask(taskId, revokeReason),
    invalidateKeys: [kycKeys.all],
    errorContext: 'KYC Revoke',
  });
};

export const useRecheckKYCTask = () => {
  return useMutationWithInvalidation({
    mutationFn: (taskId: string) => kycService.recheckTask(taskId),
    invalidateKeys: [kycKeys.all],
    errorContext: 'KYC Recheck',
  });
};

// P3 (2026-06-02): open a new billable reverification cycle (non-destructive).
export const useReverifyKYCTask = () => {
  return useMutationWithInvalidation({
    mutationFn: ({
      taskId,
      assignedTo,
      reason,
    }: {
      taskId: string;
      assignedTo?: string;
      reason?: string;
    }) => kycService.reverifyTask(taskId, { assignedTo, reason }),
    invalidateKeys: [kycKeys.all],
    errorContext: 'KYC Reverify',
  });
};

export const useUploadKYCDocument = () => {
  return useMutationWithInvalidation({
    mutationFn: ({ taskId, file }: { taskId: string; file: File }) =>
      kycService.uploadDocument(taskId, file),
    invalidateKeys: [kycKeys.all],
    errorContext: 'KYC Document Upload',
  });
};

// P3 (2026-06-02): Recheck-clone — new editable Pending task from a completed one.
export const useRecheckCloneKYC = () => {
  return useMutationWithInvalidation({
    mutationFn: ({
      taskId,
      payload,
    }: {
      taskId: string;
      payload: {
        documentTypeId?: number;
        documentNumber?: string;
        documentHolderName?: string;
        documentDetails?: Record<string, string>;
        assignedTo: string;
      };
    }) => kycService.recheckClone(taskId, payload),
    invalidateKeys: [kycKeys.all],
    errorContext: 'KYC Recheck',
  });
};

// P2 (2026-06-02): attach the completion report file to the active cycle.
export const useUploadKYCReport = () => {
  return useMutationWithInvalidation({
    mutationFn: ({ taskId, file }: { taskId: string; file: File }) =>
      kycService.uploadReport(taskId, file),
    invalidateKeys: [kycKeys.all],
    errorContext: 'KYC Report Upload',
  });
};
