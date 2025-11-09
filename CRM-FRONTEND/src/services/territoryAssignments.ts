import api from './api';
import type {
  UserTerritoryAssignments,
  TerritoryAssignment,
  BulkSaveTerritoryAssignmentsResponse,
  AreasByPincode,
  AvailableFieldAgent,
} from '@/types/territoryAssignment';

/**
 * Territory Assignments Service
 * Handles API calls for field agent territory assignments
 */
class TerritoryAssignmentsService {
  /**
   * Get areas for multiple pincodes in a single request
   * @param pincodeIds Array of pincode IDs
   * @returns Areas grouped by pincode ID
   */
  async getAreasByPincodes(pincodeIds: number[]): Promise<AreasByPincode> {
    if (pincodeIds.length === 0) {
      return {};
    }

    const response = await api.get<{ success: boolean; data: AreasByPincode }>(
      `/areas/by-pincodes?pincodeIds=${pincodeIds.join(',')}`
    );

    return response.data.data;
  }

  /**
   * Get user's territory assignments (pincodes and areas)
   * @param userId User ID
   * @returns User's territory assignments
   */
  async getUserTerritoryAssignments(userId: string): Promise<UserTerritoryAssignments> {
    const response = await api.get<{ success: boolean; data: UserTerritoryAssignments }>(
      `/users/${userId}/territory-assignments`
    );

    return response.data.data;
  }

  /**
   * Bulk save territory assignments
   * @param userId User ID
   * @param assignments Array of territory assignments
   * @returns Save response
   */
  async bulkSaveTerritoryAssignments(
    userId: string,
    assignments: TerritoryAssignment[]
  ): Promise<BulkSaveTerritoryAssignmentsResponse> {
    const response = await api.post<BulkSaveTerritoryAssignmentsResponse>(
      `/users/${userId}/territory-assignments/bulk`,
      { assignments }
    );

    return response.data;
  }

  /**
   * Get available field agents filtered by pincode and optionally area
   * @param pincodeId Pincode ID
   * @param areaId Optional area ID
   * @returns Available field agents
   */
  async getAvailableFieldAgents(
    pincodeId: number,
    areaId?: number
  ): Promise<AvailableFieldAgent[]> {
    const params = new URLSearchParams({ pincodeId: pincodeId.toString() });

    if (areaId) {
      params.append('areaId', areaId.toString());
    }

    const response = await api.get<{ success: boolean; data: AvailableFieldAgent[] }>(
      `/users/field-agents/available?${params.toString()}`
    );

    return response.data.data;
  }
}

export const territoryAssignmentsService = new TerritoryAssignmentsService();

