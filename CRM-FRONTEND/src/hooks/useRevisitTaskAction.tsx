import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { usePermission } from '@/hooks/usePermissions';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { VerificationTasksService } from '@/services/verificationTasks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { logger } from '@/utils/logger';

interface BackendError {
  message?: string;
  error?: { code?: string };
}

const mapRevisitError = (err: unknown): string => {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    const body = err.response?.data as BackendError | undefined;
    const code = body?.error?.code;
    if (code === 'REVISIT_REQUIRES_COMPLETED_PARENT') {
      return 'Cannot create a revisit — the task must be COMPLETED first.';
    }
    if (code === 'REVISIT_BLOCKED_BY_ACTIVE_SIBLING') {
      return (
        body?.message ||
        'A revisit already exists for this case + verification type. Complete or revoke it before creating another.'
      );
    }
    if (code === 'CASE_NOT_IN_ACTIVE_SCOPE') {
      return 'This case is outside your active scope. Switch scope and try again.';
    }
    if (code === 'TASK_NOT_FOUND') {
      return 'Task not found. It may have been deleted.';
    }
    if (status === 403) {
      return 'You do not have permission to create a revisit.';
    }
    if (status === 422) {
      return body?.message || 'Territory or rate configuration is missing for this task.';
    }
    if (body?.message) {
      return body.message;
    }
  }
  return 'Failed to create revisit task. Please try again.';
};

interface UseRevisitTaskActionOptions {
  /**
   * After success, navigate the user to the Revisit Tasks page. Defaults to
   * false — most call sites want to stay where they are and rely on cache
   * invalidation to refresh.
   */
  navigateAfter?: boolean;
}

/**
 * Centralized revisit-task action. Handles permission gating, confirmation
 * dialog, API call, error mapping, cache invalidation, and toast.
 *
 * Returns:
 *  - `requestRevisit(task)`: call this from any menu item / button. If the
 *    user lacks `visit.revisit` permission, surfaces a toast and no-ops.
 *  - `dialog`: ReactNode that MUST be rendered once in the consuming
 *    component. It renders nothing when no task is queued.
 *  - `isPending`: true while the POST is in flight.
 */
export const useRevisitTaskAction = (options: UseRevisitTaskActionOptions = {}) => {
  const { navigateAfter = false } = options;
  const navigate = useNavigate();
  const canRevisit = usePermission('visit.revisit');
  const [pendingTask, setPendingTask] = useState<{ id: string; label?: string } | null>(null);

  const mutation = useMutationWithInvalidation({
    mutationFn: async (taskId: string) => VerificationTasksService.revisitTask(taskId),
    invalidateKeys: [
      ['verification-tasks'],
      ['all-verification-tasks'],
      ['cases'],
      ['case'],
      ['verification-tasks-for-case'],
    ],
    errorContext: 'Revisit Task',
  });

  const requestRevisit = useCallback(
    (task: { id: string; taskNumber?: string }) => {
      if (!canRevisit) {
        toast.error('You do not have permission to create a revisit.');
        return;
      }
      setPendingTask({ id: task.id, label: task.taskNumber });
    },
    [canRevisit]
  );

  const handleConfirm = useCallback(() => {
    if (!pendingTask) {
      return;
    }
    const taskId = pendingTask.id;
    setPendingTask(null);
    mutation.mutate(taskId, {
      onSuccess: () => {
        toast.success('Revisit task created. A new task has been added to the case.');
        if (navigateAfter) {
          navigate('/task-management/revisit-tasks');
        }
      },
      onError: (err) => {
        logger.error('Revisit task failed', err);
        toast.error(mapRevisitError(err));
      },
    });
  }, [pendingTask, mutation, navigate, navigateAfter]);

  const dialog = (
    <AlertDialog
      open={pendingTask !== null}
      onOpenChange={(open) => {
        if (!open) {
          setPendingTask(null);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create Revisit Task?</AlertDialogTitle>
          <AlertDialogDescription>
            This creates a NEW verification task linked to{' '}
            <strong>{pendingTask?.label || 'this task'}</strong>. The original task stays
            COMPLETED unchanged. The revisit will be billed at the same rate as the parent
            and will appear in the Revisit Tasks page where you can assign it to a field
            agent.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Create Revisit</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    requestRevisit,
    dialog,
    canRevisit,
    isPending: mutation.isPending,
  };
};
