import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
import { territoryAssignmentsService } from '@/services/territoryAssignments';
import type {
  UserTerritoryAssignments,
  TerritoryAssignment,
  AreasByPincode,
  AvailableFieldAgent,
} from '@/types/territoryAssignment';

/**
 * Hook to fetch user's territory assignments
 * @param userId User ID
 * @returns Query result with territory assignments
 */
export const useUserTerritoryAssignments = (userId?: string) => {
  return useQuery<UserTerritoryAssignments>({
    queryKey: ['userTerritoryAssignments', userId],
    queryFn: () => {
      if (!userId) {
        throw new Error('User ID is required');
      }
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

  return useStandardizedMutation({
    mutationFn: (assignments: TerritoryAssignment[]) =>
      territoryAssignmentsService.bulkSaveTerritoryAssignments(userId, assignments),
    errorContext: 'Territory Assignment Save',
    errorFallbackMessage: 'Failed to save territory assignments',
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['userTerritoryAssignments', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      toast.success(
        `Territory assignments saved! ${data.data.pincodeAssignmentsCreated} pincodes, ${data.data.areaAssignmentsCreated} areas.`
      );
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
      if (!pincodeId) {
        throw new Error('Pincode ID is required');
      }
      return territoryAssignmentsService.getAvailableFieldAgents(pincodeId, areaId);
    },
    enabled: !!pincodeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
