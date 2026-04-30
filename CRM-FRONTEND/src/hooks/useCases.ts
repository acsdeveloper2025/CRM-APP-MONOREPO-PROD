import { useQuery, useQueryClient } from '@tanstack/react-query';
import { casesService, type CaseListQuery, type CaseUpdateData } from '@/services/cases';
import type { CreateCaseWithMultipleTasksPayload } from '@/types/dto/case.dto';
import { toast } from 'sonner';
import { useCallback } from 'react';
import { useMutationWithInvalidation } from './useStandardizedMutation';
import { logger } from '@/utils/logger';

// Query keys
export const caseKeys = {
  all: ['cases'] as const,
  lists: () => [...caseKeys.all, 'list'] as const,
  list: (filters: CaseListQuery) => [...caseKeys.lists(), filters] as const,
  details: () => [...caseKeys.all, 'detail'] as const,
  detail: (id: string) => [...caseKeys.details(), id] as const,
  attachments: (id: string) => [...caseKeys.all, 'attachments', id] as const,
  history: (id: string) => [...caseKeys.all, 'history', id] as const,
  pendingReview: () => [...caseKeys.all, 'pending-review'] as const,
};

// Queries
export const useCases = (query: CaseListQuery = {}) => {
  return useQuery({
    queryKey: caseKeys.list(query),
    queryFn: () => casesService.getCases(query),
    refetchOnWindowFocus: true, // case status changes frequently — refresh on tab return
  });
};

export const useCase = (id: string) => {
  return useQuery({
    queryKey: caseKeys.detail(id),
    queryFn: () => casesService.getCaseById(id),
    enabled: !!id,
  });
};

export const useCaseAttachments = (id: string) => {
  return useQuery({
    queryKey: caseKeys.attachments(id),
    queryFn: () => casesService.getCaseAttachments(id),
    enabled: !!id,
  });
};

export const useCaseHistory = (id: string) => {
  return useQuery({
    queryKey: caseKeys.history(id),
    queryFn: () => casesService.getCaseHistory(id),
    enabled: !!id,
  });
};

export const usePendingReviewCases = () => {
  return useQuery({
    queryKey: caseKeys.pendingReview(),
    queryFn: () => casesService.getPendingReviewCases(),
  });
};

export const usePendingCases = () => {
  return useQuery({
    queryKey: [...caseKeys.all, 'pending'] as const,
    queryFn: () => casesService.getPendingCases(),
    refetchOnWindowFocus: true,
  });
};

// Mutations
export const useUpdateCaseStatus = () => {
  return useMutationWithInvalidation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      casesService.updateCaseStatus(id, status),
    invalidateKeys: [caseKeys.all, ['dashboard'], ['verification-tasks']],
    successMessage: 'Case status updated successfully',
    errorContext: 'Case Status Update',
    errorFallbackMessage: 'Failed to update case status',
  });
};

export const useUpdateCasePriority = () => {
  return useMutationWithInvalidation({
    mutationFn: ({ id, priority }: { id: string; priority: string }) =>
      casesService.updateCasePriority(id, priority),
    invalidateKeys: [caseKeys.all],
    successMessage: 'Case priority updated successfully',
    errorContext: 'Case Priority Update',
    errorFallbackMessage: 'Failed to update case priority',
  });
};

export const useUpdateCase = () => {
  return useMutationWithInvalidation({
    mutationFn: ({ id, data }: { id: string; data: CaseUpdateData }) =>
      casesService.updateCase(id, data),
    invalidateKeys: [caseKeys.all, ['dashboard']],
    successMessage: 'Case updated successfully',
    errorContext: 'Case Update',
    errorFallbackMessage: 'Failed to update case',
  });
};

export const useCreateCase = () => {
  return useMutationWithInvalidation({
    mutationFn: (data: CreateCaseWithMultipleTasksPayload) =>
      casesService.createCaseWithMultipleTasks(data),
    invalidateKeys: [caseKeys.all, ['dashboard'], ['verification-tasks']],
    successMessage: 'Case created and assigned successfully',
    errorContext: 'Case Creation',
    errorFallbackMessage: 'Failed to create case',
  });
};

export const useApproveCase = () => {
  return useMutationWithInvalidation({
    mutationFn: ({ id, feedback }: { id: string; feedback?: string }) =>
      casesService.approveCase(id, feedback),
    invalidateKeys: [caseKeys.all, ['dashboard'], ['verification-tasks']],
    successMessage: 'Case approved successfully',
    errorContext: 'Case Approval',
    errorFallbackMessage: 'Failed to approve case',
  });
};

export const useRejectCase = () => {
  return useMutationWithInvalidation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      casesService.rejectCase(id, reason),
    invalidateKeys: [caseKeys.all, ['dashboard'], ['verification-tasks']],
    successMessage: 'Case rejected successfully',
    errorContext: 'Case Rejection',
    errorFallbackMessage: 'Failed to reject case',
  });
};

export const useRequestRework = () => {
  return useMutationWithInvalidation({
    mutationFn: ({ id, feedback }: { id: string; feedback: string }) =>
      casesService.requestRework(id, feedback),
    invalidateKeys: [caseKeys.all, ['dashboard'], ['verification-tasks']],
    successMessage: 'Rework requested successfully',
    errorContext: 'Rework Request',
    errorFallbackMessage: 'Failed to request rework',
  });
};

// Enhanced refresh hook for comprehensive cache clearing and data refresh
export const useRefreshCases = () => {
  const queryClient = useQueryClient();

  const refreshCases = useCallback(
    async (options?: { clearCache?: boolean; preserveFilters?: boolean; showToast?: boolean }) => {
      const {
        clearCache = true,
        preserveFilters: _preserveFilters = true,
        showToast = true,
      } = options || {};

      try {
        if (showToast) {
          toast.loading('Refreshing cases...', { id: 'refresh-cases' });
        }

        if (clearCache) {
          // Clear all case-related cache entries
          queryClient.removeQueries({ queryKey: caseKeys.all });

          // Clear browser storage for cases (if any)
          try {
            const cacheKeys = Object.keys(localStorage).filter(
              (key) => key.includes('case') || key.includes('Case')
            );
            cacheKeys.forEach((key) => localStorage.removeItem(key));
          } catch (error) {
            logger.warn('Failed to clear localStorage:', error);
          }

          // Clear session storage for cases (if any)
          try {
            const sessionKeys = Object.keys(sessionStorage).filter(
              (key) => key.includes('case') || key.includes('Case')
            );
            sessionKeys.forEach((key) => sessionStorage.removeItem(key));
          } catch (error) {
            logger.warn('Failed to clear sessionStorage:', error);
          }
        }

        // Invalidate and refetch all case queries
        await queryClient.invalidateQueries({ queryKey: caseKeys.all });

        // Force refetch of all active case queries
        await queryClient.refetchQueries({ queryKey: caseKeys.all });

        if (showToast) {
          toast.success('Cases refreshed successfully', { id: 'refresh-cases' });
        }

        return true;
      } catch (error) {
        logger.error('Failed to refresh cases:', error);
        if (showToast) {
          toast.error('Failed to refresh cases', { id: 'refresh-cases' });
        }
        return false;
      }
    },
    [queryClient]
  );

  return { refreshCases };
};
