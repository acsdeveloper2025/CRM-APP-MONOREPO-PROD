import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { usePermission } from '@/hooks/usePermissions';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { VerificationTasksService } from '@/services/verificationTasks';
import { revokeReasonsService } from '@/services/revokeReasons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { logger } from '@/utils/logger';

/**
 * A2.3 (audit 2026-05-25): reasons are now fetched from the
 * `/api/revoke-reasons/active` master endpoint instead of being
 * hardcoded here. The submitted `reason` is the master `label`
 * string so the existing `task_revocations.revoke_reason` TEXT
 * column keeps a human-readable value (analytics + history). The
 * BE additionally populates `revoke_reason_id` via
 * `TaskRevocationService.resolveReasonId` for forward analytics.
 *
 * The `OTHER` code is the documented escape hatch — when selected
 * the dialog reveals a free-text Textarea and the submitted
 * `reason` becomes the user-entered string (NOT 'Other').
 */

interface BackendError {
  message?: string;
  error?: { code?: string };
}

const mapRevokeError = (err: unknown): string => {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    const body = err.response?.data as BackendError | undefined;
    const code = body?.error?.code;
    if (code === 'REASON_REQUIRED') {
      return 'Please pick or enter a revoke reason.';
    }
    if (code === 'TASK_ALREADY_COMPLETED') {
      return 'Task is already completed — it cannot be revoked.';
    }
    if (code === 'TASK_SCOPE_ACCESS_DENIED') {
      return 'This task is outside your scope. Switch scope and try again.';
    }
    if (code === 'TASK_NOT_FOUND') {
      return 'Task not found. It may have been deleted.';
    }
    if (code === 'INVALID_STATUS_TRANSITION') {
      return 'Task cannot be revoked in its current status.';
    }
    if (status === 403) {
      return 'You do not have permission to revoke this task.';
    }
    if (body?.message) {
      return body.message;
    }
  }
  return 'Failed to revoke task. Please try again.';
};

/**
 * Centralized revoke-task action. Handles permission gating, reason
 * picker dialog (with free-text fallback for OTHER), API call, error
 * mapping, cache invalidation, and toast.
 *
 * Returns:
 *  - `requestRevoke(task)`: call this from any menu item / button.
 *    If the user lacks `task.revoke` permission, surfaces a toast.
 *  - `dialog`: ReactNode that MUST be rendered once in the consuming
 *    component. It renders nothing when no task is queued.
 *  - `isPending`: true while the POST is in flight.
 */
export const useRevokeTaskAction = () => {
  const canRevoke = usePermission('task.revoke');
  const [pendingTask, setPendingTask] = useState<{
    id: string;
    label?: string;
  } | null>(null);
  // Holds the selected reason CODE ('NOT_MY_AREA' / 'OTHER' / …),
  // not the label. Resolved to label string on submit.
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [otherReason, setOtherReason] = useState<string>('');

  // Fetch active reasons. Cached at the query layer; refetched only when
  // the dialog opens (the hook itself stays mounted at parent level so the
  // query is shared across consumers — e.g. VerificationTasksManager).
  const { data: reasonsResp, isLoading: reasonsLoading } = useQuery({
    queryKey: ['revoke-reasons', 'active'],
    queryFn: () => revokeReasonsService.listActive(),
    staleTime: 5 * 60 * 1000, // 5 min — reasons rarely change
  });
  const activeReasons = useMemo(() => reasonsResp?.data ?? [], [reasonsResp]);

  const mutation = useMutationWithInvalidation({
    mutationFn: async ({ taskId, reason }: { taskId: string; reason: string }) =>
      VerificationTasksService.cancelTask(taskId, reason),
    invalidateKeys: [
      ['verification-tasks'],
      ['all-verification-tasks'],
      ['cases'],
      ['case'],
      ['verification-tasks-for-case'],
    ],
    errorContext: 'Revoke Task',
  });

  const requestRevoke = useCallback(
    (task: { id: string; taskNumber?: string }) => {
      if (!canRevoke) {
        toast.error('You do not have permission to revoke tasks.');
        return;
      }
      setSelectedReason('');
      setOtherReason('');
      setPendingTask({ id: task.id, label: task.taskNumber });
    },
    [canRevoke]
  );

  const handleClose = useCallback(() => {
    setPendingTask(null);
    setSelectedReason('');
    setOtherReason('');
  }, []);

  const handleConfirm = useCallback(() => {
    if (!pendingTask) {
      return;
    }
    // When OTHER is picked, submit the free-text. Otherwise resolve the
    // selected code to the master's label so the BE stores a human-readable
    // string in task_revocations.revoke_reason (back-compat with historical
    // analytics that reads label strings).
    const matched = activeReasons.find((r) => r.code === selectedReason);
    const reason =
      selectedReason === 'OTHER' ? otherReason.trim() : matched?.label || selectedReason;
    if (!reason) {
      toast.error('Please pick or enter a revoke reason.');
      return;
    }
    const taskId = pendingTask.id;
    handleClose();
    mutation.mutate(
      { taskId, reason },
      {
        onSuccess: () => {
          toast.success('Task revoked. It will appear in the Revoke Tasks queue.');
        },
        onError: (err) => {
          logger.error('Revoke task failed', err);
          toast.error(mapRevokeError(err));
        },
      }
    );
  }, [pendingTask, selectedReason, otherReason, mutation, handleClose, activeReasons]);

  const submitDisabled =
    !selectedReason ||
    (selectedReason === 'OTHER' && otherReason.trim().length === 0) ||
    mutation.isPending;

  const dialog = (
    <Dialog
      open={pendingTask !== null}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke Task?</DialogTitle>
          <DialogDescription>
            This sends <strong>{pendingTask?.label || 'this task'}</strong> back to the Revoke Tasks
            queue. The field agent&apos;s assignment is cleared. A backend user must review,
            optionally edit the task, and reassign it. Revoked tasks are NOT billed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="revoke-reason">Reason *</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger id="revoke-reason">
                <SelectValue placeholder="Pick a reason" />
              </SelectTrigger>
              <SelectContent>
                {reasonsLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading reasons…
                  </SelectItem>
                ) : activeReasons.length === 0 ? (
                  <SelectItem value="empty" disabled>
                    No revoke reasons configured
                  </SelectItem>
                ) : (
                  activeReasons.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedReason === 'OTHER' && (
            <div className="space-y-2">
              <Label htmlFor="revoke-other-reason">Specify reason *</Label>
              <Textarea
                id="revoke-other-reason"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Explain why this task should be revoked"
                rows={3}
                maxLength={500}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={submitDisabled}>
            {mutation.isPending ? 'Revoking…' : 'Revoke Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return {
    requestRevoke,
    dialog,
    canRevoke,
    isPending: mutation.isPending,
  };
};
