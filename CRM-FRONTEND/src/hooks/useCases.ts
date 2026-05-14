import { useQuery, useQueryClient } from '@tanstack/react-query';
import { casesService, type CaseListQuery, type CaseUpdateData } from '@/services/cases';
import type { CreateCaseWithMultipleTasksPayload } from '@/types/dto/case.dto';
import { toast } from 'sonner';
import { useCallback } from 'react';
import { useMutationWithInvalidation } from './useStandardizedMutation';
import { useActiveScope } from './useActiveScope';
import { logger } from '@/utils/logger';

// Query keys
// P18.A-05: scope params are part of the cache identity. Even though
// ActiveScopeProvider calls queryClient.clear() on scope change (P5),
// having scope in the key is defensive belt-and-braces — eliminates
// any race where a stale cached payload could re-resolve under a new
// scope before the clear settles, and makes refocus refetches scope-
// safe (refetchOnWindowFocus is on for useCases).
type ScopeKey = { c: number | null; p: number | null };
export const caseKeys = {
  all: ['cases'] as const,
  lists: () => [...caseKeys.all, 'list'] as const,
  list: (filters: CaseListQuery, scope: ScopeKey = { c: null, p: null }) =>
    [...caseKeys.lists(), filters, scope] as const,
  details: () => [...caseKeys.all, 'detail'] as const,
  detail: (id: string, scope: ScopeKey = { c: null, p: null }) =>
    [...caseKeys.details(), id, scope] as const,
  attachments: (id: string) => [...caseKeys.all, 'attachments', id] as const,
  history: (id: string) => [...caseKeys.all, 'history', id] as const,
  pendingReview: () => [...caseKeys.all, 'pending-review'] as const,
};

// Queries
export const useCases = (query: CaseListQuery = {}) => {
  const { selectedClientId, selectedProductId } = useActiveScope();
  return useQuery({
    queryKey: caseKeys.list(query, { c: selectedClientId, p: selectedProductId }),
    queryFn: () => casesService.getCases(query),
    refetchOnWindowFocus: true, // case status changes frequently — refresh on tab return
  });
};

export const useCase = (id: string) => {
  const { selectedClientId, selectedProductId } = useActiveScope();
  return useQuery({
    queryKey: caseKeys.detail(id, { c: selectedClientId, p: selectedProductId }),
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

// P20.A-06: useUpdateCaseStatus, useUpdateCasePriority,
// useApproveCase, useRejectCase, useRequestRework removed — their
// backing service methods on casesService POSTed to routes that don't
// exist; the workflow audit (2026-05-13) made the underlying statuses
// (APPROVED/REJECTED/REWORK_REQUIRED) non-statuses on cases. Zero
// callers across the FE. Keep useCreateCase + useUpdateCase as the
// canonical create/edit hooks.

// Mutations
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
