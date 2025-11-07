import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Hook to provide task mutation helpers that invalidate related queries
 * Use this to ensure statistics cards update after task operations
 */
export function useTaskMutations() {
  const queryClient = useQueryClient();

  /**
   * Call this after any task operation (create, update, assign, complete, etc.)
   * to invalidate all related queries and refresh statistics
   */
  const invalidateTaskQueries = useCallback(() => {
    // Invalidate verification tasks queries
    queryClient.invalidateQueries({ queryKey: ['verification-tasks'] });
    // Invalidate dashboard stats (affects task counts, overdue tasks, TAT stats)
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    // Invalidate case queries (task changes may affect case status)
    queryClient.invalidateQueries({ queryKey: ['cases'] });
  }, [queryClient]);

  /**
   * Call this after creating tasks
   */
  const onTasksCreated = useCallback(() => {
    invalidateTaskQueries();
  }, [invalidateTaskQueries]);

  /**
   * Call this after updating a task
   */
  const onTaskUpdated = useCallback(() => {
    invalidateTaskQueries();
  }, [invalidateTaskQueries]);

  /**
   * Call this after assigning a task
   */
  const onTaskAssigned = useCallback(() => {
    invalidateTaskQueries();
  }, [invalidateTaskQueries]);

  /**
   * Call this after completing a task
   */
  const onTaskCompleted = useCallback(() => {
    invalidateTaskQueries();
  }, [invalidateTaskQueries]);

  /**
   * Call this after starting a task
   */
  const onTaskStarted = useCallback(() => {
    invalidateTaskQueries();
  }, [invalidateTaskQueries]);

  /**
   * Call this after canceling/revoking a task
   */
  const onTaskCanceled = useCallback(() => {
    invalidateTaskQueries();
  }, [invalidateTaskQueries]);

  return {
    invalidateTaskQueries,
    onTasksCreated,
    onTaskUpdated,
    onTaskAssigned,
    onTaskCompleted,
    onTaskStarted,
    onTaskCanceled,
  };
}

