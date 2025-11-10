import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { territoryAssignmentsService } from '@/services/territoryAssignments';
import type {
  UserTerritoryAssignments,
  TerritoryAssignment,
  AreasByPincode,
  AvailableFieldAgent,
} from '@/types/territoryAssignment';
import toast from 'react-hot-toast';

/**
 * Hook to fetch user's territory assignments
 * @param userId User ID
 * @returns Query result with territory assignments
 */
export const useUserTerritoryAssignments = (userId?: string) => {
  return useQuery<UserTerritoryAssignments>({
    queryKey: ['userTerritoryAssignments', userId],
    queryFn: () => {
      if (!userId) {throw new Error('User ID is required');}
      return territoryAssignmentsService.getUserTerritoryAssignments(userId);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to fetch areas for multiple pincodes
 * @param pincodeIds Array of pincode IDs
 * @returns Query result with areas grouped by pincode
 */
export const useAreasByPincodes = (pincodeIds: number[]) => {
  return useQuery<AreasByPincode>({
    queryKey: ['areasByPincodes', pincodeIds],
    queryFn: () => territoryAssignmentsService.getAreasByPincodes(pincodeIds),
    enabled: pincodeIds.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook to bulk save territory assignments
 * @param userId User ID
 * @returns Mutation for saving assignments
 */
export const useBulkSaveTerritoryAssignments = (userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assignments: TerritoryAssignment[]) =>
      territoryAssignmentsService.bulkSaveTerritoryAssignments(userId, assignments),
    onSuccess: (data) => {
      // Invalidate and refetch territory assignments
      queryClient.invalidateQueries({ queryKey: ['userTerritoryAssignments', userId] });

      // Invalidate field users cache so case creation forms get updated assignments
      queryClient.invalidateQueries({ queryKey: ['users', 'field'] });

      // Invalidate specific user cache
      queryClient.invalidateQueries({ queryKey: ['user', userId] });

      toast.success(
        `Territory assignments saved! ${data.data.pincodeAssignmentsCreated} pincodes, ${data.data.areaAssignmentsCreated} areas.`
      );
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to save territory assignments';
      toast.error(message);
    },
  });
};

/**
 * Hook to fetch available field agents filtered by territory
 * @param pincodeId Pincode ID
 * @param areaId Optional area ID
 * @returns Query result with available field agents
 */
export const useAvailableFieldAgents = (pincodeId?: number, areaId?: number) => {
  return useQuery<AvailableFieldAgent[]>({
    queryKey: ['availableFieldAgents', pincodeId, areaId],
    queryFn: () => {
      if (!pincodeId) {throw new Error('Pincode ID is required');}
      return territoryAssignmentsService.getAvailableFieldAgents(pincodeId, areaId);
    },
    enabled: !!pincodeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

