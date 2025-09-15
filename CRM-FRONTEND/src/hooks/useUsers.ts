import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService } from '@/services/users';
import type { UserQuery } from '@/services/users';
import toast from 'react-hot-toast';

// Query keys
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: UserQuery) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  fieldUsers: () => [...userKeys.all, 'field'] as const,
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

// Search users
export const useSearchUsers = (searchQuery: string) => {
  return useQuery({
    queryKey: [...userKeys.all, 'search', searchQuery],
    queryFn: () => usersService.searchUsers(searchQuery),
    select: (data) => data.data || [],
    enabled: searchQuery.length > 0,
  });
};
