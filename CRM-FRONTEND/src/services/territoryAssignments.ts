import { apiService } from './api';
import type {
  TerritoryAssignmentFilters,
  TerritoryAssignmentListResponse,
  TerritoryAssignmentDetailResponse,
  TerritoryAssignmentActionResponse,
  AssignPincodesRequest,
  AssignAreasRequest,
  FieldAgentTerritory,
  FieldAgentTerritoryDetail,
  AssignPincodesResponse,
  AssignAreasResponse
} from '@/types/territoryAssignment';
import type { ApiResponse } from '@/types/api';

export interface TerritoryAssignmentQuery extends TerritoryAssignmentFilters {
  page?: number;
  limit?: number;
}

class TerritoryAssignmentService {
  private baseUrl = '/territory-assignments';

  /**
   * Get all field agents with their territory assignments
   */
  async getFieldAgentTerritories(
    filters: TerritoryAssignmentFilters = {}
  ): Promise<ApiResponse<FieldAgentTerritory[]>> {
    try {
      const params = new URLSearchParams();
      
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.search) params.append('search', filters.search);
      if (filters.pincodeId) params.append('pincodeId', filters.pincodeId.toString());
      if (filters.cityId) params.append('cityId', filters.cityId.toString());
      if (filters.isActive !== undefined) params.append('isActive', filters.isActive.toString());
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

      const queryString = params.toString();
      const url = `${this.baseUrl}/field-agents${queryString ? `?${queryString}` : ''}`;
      
      return await apiService.get<FieldAgentTerritory[]>(url);
    } catch (error) {
      console.error('Error fetching field agent territories:', error);
      throw error;
    }
  }

  /**
   * Get specific field agent's territory assignments
   */
  async getFieldAgentTerritoryById(userId: string): Promise<ApiResponse<FieldAgentTerritoryDetail>> {
    try {
      return await apiService.get<FieldAgentTerritoryDetail>(`${this.baseUrl}/field-agents/${userId}`);
    } catch (error) {
      console.error('Error fetching field agent territory:', error);
      throw error;
    }
  }

  /**
   * Assign pincodes to a field agent
   */
  async assignPincodesToFieldAgent(
    userId: string, 
    data: AssignPincodesRequest
  ): Promise<ApiResponse<AssignPincodesResponse>> {
    try {
      return await apiService.post<AssignPincodesResponse>(
        `${this.baseUrl}/field-agents/${userId}/pincodes`,
        data
      );
    } catch (error) {
      console.error('Error assigning pincodes to field agent:', error);
      throw error;
    }
  }

  /**
   * Assign areas within pincodes to a field agent
   */
  async assignAreasToFieldAgent(
    userId: string, 
    data: AssignAreasRequest
  ): Promise<ApiResponse<AssignAreasResponse>> {
    try {
      return await apiService.post<AssignAreasResponse>(
        `${this.baseUrl}/field-agents/${userId}/areas`,
        data
      );
    } catch (error) {
      console.error('Error assigning areas to field agent:', error);
      throw error;
    }
  }

  /**
   * Remove pincode assignment from field agent
   */
  async removePincodeAssignment(userId: string, pincodeId: number): Promise<ApiResponse<void>> {
    try {
      return await apiService.delete<void>(
        `${this.baseUrl}/field-agents/${userId}/pincodes/${pincodeId}`
      );
    } catch (error) {
      console.error('Error removing pincode assignment:', error);
      throw error;
    }
  }

  /**
   * Remove area assignment from field agent
   */
  async removeAreaAssignment(
    userId: string, 
    areaId: number, 
    pincodeId: number
  ): Promise<ApiResponse<void>> {
    try {
      return await apiService.delete<void>(
        `${this.baseUrl}/field-agents/${userId}/areas/${areaId}?pincodeId=${pincodeId}`
      );
    } catch (error) {
      console.error('Error removing area assignment:', error);
      throw error;
    }
  }

  /**
   * Bulk assign territories to multiple field agents
   */
  async bulkAssignTerritories(assignments: {
    userId: string;
    pincodeIds: number[];
    areaAssignments: { pincodeId: number; areaIds: number[] }[];
  }[]): Promise<ApiResponse<{ successful: number; failed: number; errors: string[] }>> {
    try {
      const results = await Promise.allSettled(
        assignments.map(async (assignment) => {
          // First assign pincodes
          if (assignment.pincodeIds.length > 0) {
            await this.assignPincodesToFieldAgent(assignment.userId, {
              pincodeIds: assignment.pincodeIds
            });
          }

          // Then assign areas
          if (assignment.areaAssignments.length > 0) {
            await this.assignAreasToFieldAgent(assignment.userId, {
              assignments: assignment.areaAssignments
            });
          }

          return { userId: assignment.userId, success: true };
        })
      );

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;
      const errors = results
        .filter(result => result.status === 'rejected')
        .map(result => (result as PromiseRejectedResult).reason?.message || 'Unknown error');

      return {
        success: true,
        data: { successful, failed, errors },
        message: `Bulk assignment completed: ${successful} successful, ${failed} failed`
      };
    } catch (error) {
      console.error('Error in bulk territory assignment:', error);
      throw error;
    }
  }

  /**
   * Get territory assignment statistics
   */
  async getTerritoryStats(): Promise<ApiResponse<{
    totalFieldAgents: number;
    assignedFieldAgents: number;
    totalPincodes: number;
    assignedPincodes: number;
    totalAreas: number;
    assignedAreas: number;
  }>> {
    try {
      // This would need a dedicated endpoint in the backend
      // For now, we'll calculate from the field agents list
      const response = await this.getFieldAgentTerritories({ limit: 1000 });
      
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch territory data for statistics');
      }

      const fieldAgents = response.data;
      const assignedFieldAgents = fieldAgents.filter(agent => 
        agent.territoryAssignments && agent.territoryAssignments.length > 0
      ).length;

      const assignedPincodes = new Set();
      const assignedAreas = new Set();

      fieldAgents.forEach(agent => {
        agent.territoryAssignments?.forEach(territory => {
          assignedPincodes.add(territory.pincodeId);
          territory.assignedAreas?.forEach(area => {
            assignedAreas.add(`${territory.pincodeId}-${area.areaId}`);
          });
        });
      });

      return {
        success: true,
        data: {
          totalFieldAgents: fieldAgents.length,
          assignedFieldAgents,
          totalPincodes: 0, // Would need separate API call
          assignedPincodes: assignedPincodes.size,
          totalAreas: 0, // Would need separate API call
          assignedAreas: assignedAreas.size,
        },
        message: 'Territory statistics calculated successfully'
      };
    } catch (error) {
      console.error('Error calculating territory statistics:', error);
      throw error;
    }
  }

  /**
   * Validate territory assignments for conflicts
   */
  async validateTerritoryAssignments(assignments: {
    userId: string;
    pincodeId: number;
    areaIds: number[];
  }[]): Promise<ApiResponse<{
    isValid: boolean;
    conflicts: Array<{
      pincodeId: number;
      areaId: number;
      conflictingUserId: string;
      conflictingUserName: string;
    }>;
  }>> {
    try {
      // This would ideally be a backend endpoint for proper validation
      // For now, we'll do client-side validation by fetching current assignments
      const response = await this.getFieldAgentTerritories({ limit: 1000 });
      
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch current assignments for validation');
      }

      const conflicts: Array<{
        pincodeId: number;
        areaId: number;
        conflictingUserId: string;
        conflictingUserName: string;
      }> = [];

      const currentAssignments = new Map<string, { userId: string; userName: string }>();
      
      // Build current assignment map
      response.data.forEach(agent => {
        agent.territoryAssignments?.forEach(territory => {
          territory.assignedAreas?.forEach(area => {
            const key = `${territory.pincodeId}-${area.areaId}`;
            currentAssignments.set(key, {
              userId: agent.userId,
              userName: agent.userName
            });
          });
        });
      });

      // Check for conflicts
      assignments.forEach(assignment => {
        assignment.areaIds.forEach(areaId => {
          const key = `${assignment.pincodeId}-${areaId}`;
          const existing = currentAssignments.get(key);
          
          if (existing && existing.userId !== assignment.userId) {
            conflicts.push({
              pincodeId: assignment.pincodeId,
              areaId,
              conflictingUserId: existing.userId,
              conflictingUserName: existing.userName
            });
          }
        });
      });

      return {
        success: true,
        data: {
          isValid: conflicts.length === 0,
          conflicts
        },
        message: conflicts.length === 0 ? 'No conflicts found' : `${conflicts.length} conflicts detected`
      };
    } catch (error) {
      console.error('Error validating territory assignments:', error);
      throw error;
    }
  }

  /**
   * Remove all territory assignments for a field agent
   */
  async removeAllTerritoryAssignments(userId: string): Promise<ApiResponse<{
    userId: string;
    removedPincodes: number;
    removedAreas: number;
    userName: string;
  }>> {
    try {
      return await apiService.delete(`${this.baseUrl}/field-agents/${userId}/all`);
    } catch (error) {
      console.error('Error removing all territory assignments:', error);
      throw error;
    }
  }

  /**
   * Assign a single pincode with areas to a field agent (incremental assignment)
   */
  async assignSinglePincodeWithAreas(
    userId: string,
    data: { pincodeId: number; areaIds: number[] }
  ): Promise<ApiResponse<{
    userId: string;
    pincodeId: number;
    pincodeCode: string;
    assignedAreas: number;
    userName: string;
  }>> {
    try {
      return await apiService.post(`${this.baseUrl}/field-agents/${userId}/add-pincode`, data);
    } catch (error) {
      console.error('Error assigning single pincode with areas:', error);
      throw error;
    }
  }
}

export const territoryAssignmentService = new TerritoryAssignmentService();
