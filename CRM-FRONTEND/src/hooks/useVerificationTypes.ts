import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { 
  verificationTypesService, 
  VerificationType, 
  CreateVerificationTypeData, 
  UpdateVerificationTypeData 
} from '@/services/verificationTypes';
import type { PaginationQuery } from '@/types/api';

// Query keys
const VERIFICATION_TYPES_KEYS = {
  all: ['verification-types'] as const,
  lists: () => [...VERIFICATION_TYPES_KEYS.all, 'list'] as const,
  list: (params?: PaginationQuery) => [...VERIFICATION_TYPES_KEYS.lists(), params] as const,
  details: () => [...VERIFICATION_TYPES_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...VERIFICATION_TYPES_KEYS.details(), id] as const,
};

// Get all verification types
export function useVerificationTypes(params?: PaginationQuery) {
  return useQuery({
    queryKey: VERIFICATION_TYPES_KEYS.list(params),
    queryFn: () => verificationTypesService.getAll(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get verification type by ID
export function useVerificationType(id: number) {
  return useQuery({
    queryKey: VERIFICATION_TYPES_KEYS.detail(id),
    queryFn: () => verificationTypesService.getById(id),
    enabled: !!id,
  });
}

// Create verification type
export function useCreateVerificationType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVerificationTypeData) => 
      verificationTypesService.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: VERIFICATION_TYPES_KEYS.lists() });
      toast.success(response.message || 'Verification type created successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to create verification type';
      toast.error(message);
    },
  });
}

// Update verification type
export function useUpdateVerificationType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateVerificationTypeData }) =>
      verificationTypesService.update(id, data),
    onSuccess: (response, { id }) => {
      queryClient.invalidateQueries({ queryKey: VERIFICATION_TYPES_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: VERIFICATION_TYPES_KEYS.detail(id) });
      toast.success(response.message || 'Verification type updated successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to update verification type';
      toast.error(message);
    },
  });
}

// Delete verification type
export function useDeleteVerificationType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => verificationTypesService.delete(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: VERIFICATION_TYPES_KEYS.lists() });
      toast.success(response.message || 'Verification type deleted successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to delete verification type';
      toast.error(message);
    },
  });
}

// Get active verification types (helper hook)
export function useActiveVerificationTypes() {
  const { data, ...rest } = useVerificationTypes();
  
  const activeTypes = data?.data?.filter((type: VerificationType) => type.isActive) || [];
  
  return {
    data: { ...data, data: activeTypes },
    ...rest
  };
}
