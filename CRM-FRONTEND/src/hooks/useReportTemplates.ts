import { useQuery } from '@tanstack/react-query';
import {
  useStandardizedMutation,
  useMutationWithInvalidation,
} from '@/hooks/useStandardizedMutation';
import {
  reportTemplatesService,
  type CreateReportTemplatePayload,
  type UpdateReportTemplatePayload,
} from '@/services/reportTemplates';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const reportTemplateKeys = {
  all: ['report-templates'] as const,
  lists: () => [...reportTemplateKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...reportTemplateKeys.lists(), filters] as const,
  detail: (id: number) => [...reportTemplateKeys.all, 'detail', id] as const,
  byConfig: (clientId: number | null, productId: number | null) =>
    [...reportTemplateKeys.all, 'by-config', clientId, productId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface UseReportTemplatesParams {
  clientId?: number;
  productId?: number;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const useReportTemplates = (params: UseReportTemplatesParams = {}) => {
  return useQuery({
    queryKey: reportTemplateKeys.list(params as Record<string, unknown>),
    queryFn: () => reportTemplatesService.list(params),
  });
};

export const useReportTemplate = (id: number | null) => {
  return useQuery({
    queryKey: id ? reportTemplateKeys.detail(id) : [...reportTemplateKeys.all, 'detail', 'none'],
    queryFn: () => {
      if (!id) {
        throw new Error('id is required');
      }
      return reportTemplatesService.getById(id);
    },
    enabled: !!id,
  });
};

export const useReportTemplateByConfig = (
  clientId: number | null,
  productId: number | null,
  enabled = true
) => {
  return useQuery({
    queryKey: reportTemplateKeys.byConfig(clientId, productId),
    queryFn: () => {
      if (!clientId || !productId) {
        throw new Error('clientId and productId are required');
      }
      return reportTemplatesService.getByConfig(clientId, productId);
    },
    enabled: enabled && !!clientId && !!productId,
  });
};

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const useCreateReportTemplate = () => {
  return useMutationWithInvalidation({
    mutationFn: (payload: CreateReportTemplatePayload) => reportTemplatesService.create(payload),
    invalidateKeys: [reportTemplateKeys.lists()],
    successMessage: 'Report template created',
    errorContext: 'Report Template Creation',
    errorFallbackMessage: 'Failed to create template',
  });
};

export const useUpdateReportTemplate = () => {
  return useMutationWithInvalidation<
    Awaited<ReturnType<typeof reportTemplatesService.update>>,
    unknown,
    { id: number; payload: UpdateReportTemplatePayload }
  >({
    mutationFn: ({ id, payload }) => reportTemplatesService.update(id, payload),
    invalidateKeys: [reportTemplateKeys.lists()],
    successMessage: 'Report template updated',
    errorContext: 'Report Template Update',
    errorFallbackMessage: 'Failed to update template',
  });
};

export const useDeactivateReportTemplate = () => {
  return useMutationWithInvalidation({
    mutationFn: (id: number) => reportTemplatesService.deactivate(id),
    invalidateKeys: [reportTemplateKeys.lists()],
    successMessage: 'Report template deactivated',
    errorContext: 'Report Template Deactivation',
    errorFallbackMessage: 'Failed to deactivate template',
  });
};

export const useValidateReportTemplate = () => {
  return useStandardizedMutation({
    mutationFn: (htmlContent: string) => reportTemplatesService.validate(htmlContent),
    errorContext: 'Report Template Validation',
  });
};
