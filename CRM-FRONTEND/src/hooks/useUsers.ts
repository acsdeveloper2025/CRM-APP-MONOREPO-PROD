import { useQuery } from '@tanstack/react-query';
import { usersService, type UserQuery } from '@/services/users';
import { territoryAssignmentsService } from '@/services/territoryAssignments';

// Query keys
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: UserQuery) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  fieldUsers: () => [...userKeys.all, 'field'] as const,
  availableFieldUsers: (pincodeId?: number, areaId?: number) =>
    [...userKeys.fieldUsers(), 'available', pincodeId ?? null, areaId ?? null] as const,
};

// Get users with filters
export const useUsers = (query: UserQuery = {}) => {
  return useQuery({
    queryKey: userKeys.list(query),
    queryFn: () => usersService.getUsers(query),
    select: (data) => data.data || [],
  });
};

// Get single user
export const useUser = (id: string) => {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => usersService.getUserById(id),
    select: (data) => data.data,
    enabled: !!id,
  });
};

// Get field users specifically
export const useFieldUsers = () => {
  return useQuery({
    queryKey: userKeys.fieldUsers(),
    queryFn: () => usersService.getFieldUsers(),
    select: (data) => data.data || [],
  });
};

export const useAvailableFieldUsers = (pincodeId?: number, areaId?: number) => {
  const hasPincodeId = typeof pincodeId === 'number' && Number.isFinite(pincodeId) && pincodeId > 0;

  return useQuery({
    queryKey: userKeys.availableFieldUsers(pincodeId, areaId),
    queryFn: () => territoryAssignmentsService.getAvailableFieldAgents(pincodeId as number, areaId),
    enabled: hasPincodeId,
  });
};

// Get field users by pincode
export const useFieldUsersByPincode = (pincodeCode?: string) => {
  return useQuery({
    queryKey: [...userKeys.fieldUsers(), 'by-pincode', pincodeCode],
    queryFn: () => usersService.getFieldUsersByPincode(pincodeCode as string),
    select: (data) => data.data || [],
    enabled: !!pincodeCode,
  });
};

// Search users
export const useSearchUsers = (searchQuery: string) => {
  return useQuery({
    queryKey: [...userKeys.all, 'search', searchQuery],
    queryFn: () => usersService.searchUsers(searchQuery),
    select: (data) => data.data || [],
    enabled: searchQuery.length > 0,
  });
};
