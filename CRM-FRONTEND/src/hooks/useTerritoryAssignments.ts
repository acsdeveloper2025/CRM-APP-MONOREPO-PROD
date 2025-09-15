import { useState, useEffect, useCallback } from 'react';
import { territoryAssignmentService } from '@/services/territoryAssignments';
import type {
  FieldAgentTerritory,
  FieldAgentTerritoryDetail,
  TerritoryAssignmentFilters,
  AssignPincodesRequest,
  AssignAreasRequest,
  AssignPincodesResponse,
  AssignAreasResponse
} from '@/types/territoryAssignment';
import type { ApiResponse } from '@/types/api';

export interface UseTerritoryAssignmentsResult {
  fieldAgents: FieldAgentTerritory[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  fetchFieldAgents: (filters?: TerritoryAssignmentFilters) => Promise<void>;
  assignPincodes: (userId: string, data: AssignPincodesRequest) => Promise<AssignPincodesResponse>;
  assignAreas: (userId: string, data: AssignAreasRequest) => Promise<AssignAreasResponse>;
  removePincodeAssignment: (userId: string, pincodeId: number) => Promise<void>;
  removeAreaAssignment: (userId: string, areaId: number, pincodeId: number) => Promise<void>;
  refreshData: () => Promise<void>;
}

export const useTerritoryAssignments = (
  initialFilters: TerritoryAssignmentFilters = {}
): UseTerritoryAssignmentsResult => {
  const [fieldAgents, setFieldAgents] = useState<FieldAgentTerritory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);
  const [currentFilters, setCurrentFilters] = useState<TerritoryAssignmentFilters>(initialFilters);

  const fetchFieldAgents = useCallback(async (filters: TerritoryAssignmentFilters = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const mergedFilters = { ...currentFilters, ...filters };
      setCurrentFilters(mergedFilters);
      
      const response = await territoryAssignmentService.getFieldAgentTerritories(mergedFilters);
      
      if (response.success && response.data) {
        setFieldAgents(response.data);
        if (response.pagination) {
          setPagination(response.pagination);
        }
      } else {
        throw new Error(response.message || 'Failed to fetch field agent territories');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error fetching field agent territories:', err);
    } finally {
      setLoading(false);
    }
  }, [currentFilters]);

  const assignPincodes = useCallback(async (
    userId: string, 
    data: AssignPincodesRequest
  ): Promise<AssignPincodesResponse> => {
    try {
      const response = await territoryAssignmentService.assignPincodesToFieldAgent(userId, data);
      
      if (response.success && response.data) {
        // Refresh the data to show updated assignments
        await fetchFieldAgents();
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to assign pincodes');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign pincodes';
      setError(errorMessage);
      throw err;
    }
  }, [fetchFieldAgents]);

  const assignAreas = useCallback(async (
    userId: string, 
    data: AssignAreasRequest
  ): Promise<AssignAreasResponse> => {
    try {
      const response = await territoryAssignmentService.assignAreasToFieldAgent(userId, data);
      
      if (response.success && response.data) {
        // Refresh the data to show updated assignments
        await fetchFieldAgents();
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to assign areas');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign areas';
      setError(errorMessage);
      throw err;
    }
  }, [fetchFieldAgents]);

  const removePincodeAssignment = useCallback(async (
    userId: string, 
    pincodeId: number
  ): Promise<void> => {
    try {
      const response = await territoryAssignmentService.removePincodeAssignment(userId, pincodeId);
      
      if (response.success) {
        // Refresh the data to show updated assignments
        await fetchFieldAgents();
      } else {
        throw new Error(response.message || 'Failed to remove pincode assignment');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove pincode assignment';
      setError(errorMessage);
      throw err;
    }
  }, [fetchFieldAgents]);

  const removeAreaAssignment = useCallback(async (
    userId: string, 
    areaId: number, 
    pincodeId: number
  ): Promise<void> => {
    try {
      const response = await territoryAssignmentService.removeAreaAssignment(userId, areaId, pincodeId);
      
      if (response.success) {
        // Refresh the data to show updated assignments
        await fetchFieldAgents();
      } else {
        throw new Error(response.message || 'Failed to remove area assignment');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove area assignment';
      setError(errorMessage);
      throw err;
    }
  }, [fetchFieldAgents]);

  const refreshData = useCallback(async () => {
    await fetchFieldAgents(currentFilters);
  }, [fetchFieldAgents, currentFilters]);

  // Initial data fetch
  useEffect(() => {
    fetchFieldAgents(initialFilters);
  }, []); // Only run on mount

  return {
    fieldAgents,
    loading,
    error,
    pagination,
    fetchFieldAgents,
    assignPincodes,
    assignAreas,
    removePincodeAssignment,
    removeAreaAssignment,
    refreshData,
  };
};

export interface UseFieldAgentTerritoryResult {
  fieldAgent: FieldAgentTerritoryDetail | null;
  loading: boolean;
  error: string | null;
  fetchFieldAgent: (userId: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

export const useFieldAgentTerritory = (userId?: string): UseFieldAgentTerritoryResult => {
  const [fieldAgent, setFieldAgent] = useState<FieldAgentTerritoryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(userId);

  const fetchFieldAgent = useCallback(async (targetUserId: string) => {
    setLoading(true);
    setError(null);
    setCurrentUserId(targetUserId);
    
    try {
      const response = await territoryAssignmentService.getFieldAgentTerritoryById(targetUserId);
      
      if (response.success && response.data) {
        setFieldAgent(response.data);
      } else {
        throw new Error(response.message || 'Failed to fetch field agent territory');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error fetching field agent territory:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    if (currentUserId) {
      await fetchFieldAgent(currentUserId);
    }
  }, [fetchFieldAgent, currentUserId]);

  // Initial data fetch if userId is provided
  useEffect(() => {
    if (userId) {
      fetchFieldAgent(userId);
    }
  }, [userId, fetchFieldAgent]);

  return {
    fieldAgent,
    loading,
    error,
    fetchFieldAgent,
    refreshData,
  };
};

export interface UseTerritoryStatsResult {
  stats: {
    totalFieldAgents: number;
    assignedFieldAgents: number;
    totalPincodes: number;
    assignedPincodes: number;
    totalAreas: number;
    assignedAreas: number;
  } | null;
  loading: boolean;
  error: string | null;
  fetchStats: () => Promise<void>;
}

export const useTerritoryStats = (): UseTerritoryStatsResult => {
  const [stats, setStats] = useState<{
    totalFieldAgents: number;
    assignedFieldAgents: number;
    totalPincodes: number;
    assignedPincodes: number;
    totalAreas: number;
    assignedAreas: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await territoryAssignmentService.getTerritoryStats();
      
      if (response.success && response.data) {
        setStats(response.data);
      } else {
        throw new Error(response.message || 'Failed to fetch territory statistics');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error fetching territory statistics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    fetchStats,
  };
};
