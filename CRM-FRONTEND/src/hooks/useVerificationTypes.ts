import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCRUDMutation } from './useStandardizedMutation';
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
    queryFn: () => verificationTypesService.getVerificationTypes(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get verification type by ID
export function useVerificationType(id: number) {
  return useQuery({
    queryKey: VERIFICATION_TYPES_KEYS.detail(id),
    queryFn: () => verificationTypesService.getVerificationTypeById(id.toString()),
    enabled: !!id,
  });
}

// Create verification type
export function useCreateVerificationType() {
  return useCRUDMutation({
    mutationFn: (data: CreateVerificationTypeData) => 
      verificationTypesService.createVerificationType(data),
    queryKey: VERIFICATION_TYPES_KEYS.lists(),
    resourceName: 'Verification Type',
    operation: 'create',
  });
}

// Update verification type
export function useUpdateVerificationType() {
  const queryClient = useQueryClient();

  return useCRUDMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateVerificationTypeData }) =>
      verificationTypesService.updateVerificationType(id.toString(), data),
    queryKey: VERIFICATION_TYPES_KEYS.lists(),
    resourceName: 'Verification Type',
    operation: 'update',
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: VERIFICATION_TYPES_KEYS.detail(id) });
    },
  });
}

// Delete verification type
export function useDeleteVerificationType() {
  return useCRUDMutation({
    mutationFn: (id: number) => verificationTypesService.deleteVerificationType(id.toString()),
    queryKey: VERIFICATION_TYPES_KEYS.lists(),
    resourceName: 'Verification Type',
    operation: 'delete',
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
