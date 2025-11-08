import { useMemo } from 'react';
import { useFieldUsers } from './useUsers';
import type { User } from '@/types/user';

interface UseFilteredFieldUsersOptions {
  pincodeId?: string | number;
  areaId?: string | number;
}

/**
 * Hook to get field users filtered by pincode and area access
 * Returns only field users who have access to BOTH the selected pincode AND area
 */
export const useFilteredFieldUsers = (options: UseFilteredFieldUsersOptions = {}) => {
  const { pincodeId, areaId } = options;
  const { data: allFieldUsers = [], isLoading, error } = useFieldUsers();

  const filteredUsers = useMemo(() => {
    // If no pincode or area is selected, return all field users
    if (!pincodeId || !areaId) {
      return allFieldUsers;
    }

    // Convert to numbers for comparison
    const selectedPincodeId = typeof pincodeId === 'string' ? parseInt(pincodeId, 10) : pincodeId;
    const selectedAreaId = typeof areaId === 'string' ? parseInt(areaId, 10) : areaId;

    // Filter field users who have access to BOTH the selected pincode AND area
    return allFieldUsers.filter((user: User) => {
      const hasPincodeAccess = user.assignedPincodes?.includes(selectedPincodeId) ?? false;
      const hasAreaAccess = user.assignedAreas?.includes(selectedAreaId) ?? false;
      
      // User must have access to BOTH pincode AND area
      return hasPincodeAccess && hasAreaAccess;
    });
  }, [allFieldUsers, pincodeId, areaId]);

  return {
    data: filteredUsers,
    isLoading,
    error,
    hasFilters: !!(pincodeId && areaId),
    isEmpty: filteredUsers.length === 0,
  };
};

