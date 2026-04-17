import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateReportTemplatePayload) => reportTemplatesService.create(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: reportTemplateKeys.lists() });
      toast.success('Report template created');
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to create template';
      toast.error(message);
    },
  });
};

export const useUpdateReportTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateReportTemplatePayload }) =>
      reportTemplatesService.update(id, payload),
    onSuccess: (_res, variables) => {
      void qc.invalidateQueries({ queryKey: reportTemplateKeys.lists() });
      void qc.invalidateQueries({ queryKey: reportTemplateKeys.detail(variables.id) });
      toast.success('Report template updated');
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to update template';
      toast.error(message);
    },
  });
};

export const useDeactivateReportTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => reportTemplatesService.deactivate(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: reportTemplateKeys.lists() });
      toast.success('Report template deactivated');
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to deactivate template';
      toast.error(message);
    },
  });
};

export const useValidateReportTemplate = () => {
  return useMutation({
    mutationFn: (htmlContent: string) => reportTemplatesService.validate(htmlContent),
  });
};
