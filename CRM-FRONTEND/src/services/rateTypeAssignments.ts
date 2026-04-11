import { apiService } from './api';
import type { ApiResponse, PaginationQuery, PaginatedResponse } from '@/types/api';
import type { RateTypeAssignment } from '@/types/rateManagement';
import { z } from 'zod';
import { validateResponse } from './schemas/runtime';
import { GenericEntityListSchema } from './schemas/generic.schema';

// RateTypeAssignmentStatus uses rateTypeId (not id) as the key, so we
// validate with an inline schema rather than GenericEntityListSchema.
const RateTypeAssignmentStatusListSchema = z.array(
  z
    .object({
      rateTypeId: z.union([z.string(), z.number()]),
      rateTypeName: z.string().optional(),
      isAssigned: z.boolean().optional(),
    })
    .passthrough()
);

export type { RateTypeAssignment };

export interface RateTypeAssignmentStatus {
  rateTypeId: number; // Changed from string to number
  rateTypeName: string;
  rateTypeDescription?: string;
  isAssigned: boolean;
  assignmentId?: number; // Changed from string to number
  assignmentActive?: boolean;
}

export interface CreateRateTypeAssignmentData {
  clientId: number; // Changed from string to number
  productId: number; // Changed from string to number
  verificationTypeId: number; // Changed from string to number
  rateTypeId: number; // Changed from string to number
  isActive?: boolean;
}

export interface BulkAssignRateTypesData {
  clientId: number; // Changed from string to number
  productId: number; // Changed from string to number
  verificationTypeId: number; // Changed from string to number
  rateTypeIds: number[]; // Changed from string[] to number[]
}

export interface RateTypeAssignmentListQuery extends PaginationQuery {
  clientId?: number; // Changed from string to number
  productId?: number; // Changed from string to number
  verificationTypeId?: number; // Changed from string to number
  rateTypeId?: number; // Changed from string to number
  isActive?: boolean;
}

export interface AssignmentsByCombinationQuery {
  clientId: number; // Changed from string to number
  productId: number; // Changed from string to number
  verificationTypeId: number; // Changed from string to number
}

export class RateTypeAssignmentsService {
  async getRateTypeAssignments(
    query: RateTypeAssignmentListQuery = {}
  ): Promise<PaginatedResponse<RateTypeAssignment>> {
    const response = await apiService.get<RateTypeAssignment[]>('/rate-type-assignments', query);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'rateTypeAssignments',
        endpoint: 'GET /rate-type-assignments',
      });
    }
    return response as unknown as PaginatedResponse<RateTypeAssignment>;
  }

  async getAssignmentsByCombination(
    query: AssignmentsByCombinationQuery
  ): Promise<ApiResponse<RateTypeAssignmentStatus[]>> {
    const response = await apiService.get<RateTypeAssignmentStatus[]>(
      '/rate-type-assignments/by-combination',
      query
    );
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(RateTypeAssignmentStatusListSchema, response.data, {
        service: 'rateTypeAssignments',
        endpoint: 'GET /rate-type-assignments/by-combination',
      });
    }
    return response;
  }

  async bulkAssignRateTypes(data: BulkAssignRateTypesData): Promise<ApiResponse<void>> {
    return apiService.post('/rate-type-assignments/bulk-assign', data);
  }

  async createRateTypeAssignment(
    data: CreateRateTypeAssignmentData
  ): Promise<ApiResponse<RateTypeAssignment>> {
    return apiService.post('/rate-type-assignments', data);
  }

  async deleteRateTypeAssignment(id: number): Promise<ApiResponse<void>> {
    return apiService.delete(`/rate-type-assignments/${id}`);
  }

  // Helper method to get assignments for a specific combination
  async getAssignmentsForCombination(
    clientId: number,
    productId: number,
    verificationTypeId: number
  ): Promise<ApiResponse<RateTypeAssignmentStatus[]>> {
    return this.getAssignmentsByCombination({ clientId, productId, verificationTypeId });
  }

  // Helper method to assign multiple rate types to a combination
  async assignRateTypesToCombination(
    clientId: number,
    productId: number,
    verificationTypeId: number,
    rateTypeIds: number[]
  ): Promise<ApiResponse<void>> {
    return this.bulkAssignRateTypes({ clientId, productId, verificationTypeId, rateTypeIds });
  }
}

export const rateTypeAssignmentsService = new RateTypeAssignmentsService();
