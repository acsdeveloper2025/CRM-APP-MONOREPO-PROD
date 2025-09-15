import { apiService } from './api';
import type { ApiResponse, PaginationQuery, PaginatedResponse } from '@/types/api';
import type {
  RateTypeAssignment,
  CreateRateTypeAssignmentData,
  RateTypeAssignmentQuery,
  AvailableRateType
} from '@/types/rateManagement';

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
  async getRateTypeAssignments(query: RateTypeAssignmentListQuery = {}): Promise<PaginatedResponse<RateTypeAssignment>> {
    return apiService.get('/rate-type-assignments', query);
  }

  async getAssignmentsByCombination(query: AssignmentsByCombinationQuery): Promise<ApiResponse<RateTypeAssignmentStatus[]>> {
    return apiService.get('/rate-type-assignments/by-combination', query);
  }

  async bulkAssignRateTypes(data: BulkAssignRateTypesData): Promise<ApiResponse<void>> {
    return apiService.post('/rate-type-assignments/bulk-assign', data);
  }

  async createRateTypeAssignment(data: CreateRateTypeAssignmentData): Promise<ApiResponse<RateTypeAssignment>> {
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
