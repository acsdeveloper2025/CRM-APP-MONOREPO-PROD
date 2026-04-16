// Combined rate management service that orchestrates all rate-related operations
import {
  rateTypesService,
  type RateType,
  type CreateRateTypeData,
  type UpdateRateTypeData,
} from './rateTypes';
import {
  rateTypeAssignmentsService,
  type RateTypeAssignmentStatus,
  type BulkAssignRateTypesData,
} from './rateTypeAssignments';
import {
  ratesService,
  type Rate,
  type AvailableRateType,
  type CreateOrUpdateRateData,
} from './rates';
import {
  documentTypeRatesService,
  type DocumentTypeRate,
  type CreateDocumentTypeRateData,
  type DocumentTypeRateStats,
} from './documentTypeRates';
import type { ApiResponse } from '@/types/api';

export interface RateManagementWorkflow {
  // Tab 1: Rate Types
  rateTypes: RateType[];

  // Tab 2: Rate Type Assignments
  selectedCombination?: {
    clientId: number;
    productId: number;
    verificationTypeId: number;
  };
  assignmentStatus: RateTypeAssignmentStatus[];

  // Tab 3: Rate Assignment
  availableRateTypes: AvailableRateType[];

  // Tab 4: Rate View/Report
  allRates: Rate[];
}

export interface CombinationSelection {
  clientId: number;
  productId: number;
  verificationTypeId: number;
}

export class RateManagementService {
  // Tab 1: Rate Types Management
  async createRateType(data: CreateRateTypeData): Promise<ApiResponse<RateType>> {
    return rateTypesService.createRateType(data);
  }

  async updateRateType(id: number, data: UpdateRateTypeData): Promise<ApiResponse<RateType>> {
    return rateTypesService.updateRateType(id, data);
  }

  async deleteRateType(id: number): Promise<ApiResponse<void>> {
    return rateTypesService.deleteRateType(id);
  }

  async getAllRateTypes(): Promise<ApiResponse<RateType[]>> {
    return rateTypesService.getActiveRateTypes();
  }

  // Tab 2: Rate Type Assignment Management
  async getAssignmentStatusForCombination(
    clientId: number,
    productId: number,
    verificationTypeId: number
  ): Promise<ApiResponse<RateTypeAssignmentStatus[]>> {
    return rateTypeAssignmentsService.getAssignmentsByCombination({
      clientId,
      productId,
      verificationTypeId,
    });
  }

  async assignRateTypesToCombination(data: BulkAssignRateTypesData): Promise<ApiResponse<void>> {
    return rateTypeAssignmentsService.bulkAssignRateTypes(data);
  }

  // Tab 3: Rate Assignment Management
  async getAvailableRateTypesForRateAssignment(
    clientId: number,
    productId: number,
    verificationTypeId: number
  ): Promise<ApiResponse<AvailableRateType[]>> {
    return ratesService.getAvailableRateTypesForAssignment({
      clientId,
      productId,
      verificationTypeId,
    });
  }

  async setRateAmount(data: CreateOrUpdateRateData): Promise<ApiResponse<void>> {
    return ratesService.createOrUpdateRate(data);
  }

  // Tab 4: Rate View/Report Management
  async getAllConfiguredRates(filters?: {
    clientId?: string;
    productId?: string;
    verificationTypeId?: string;
    search?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<Rate[]>> {
    const queryFilters = filters
      ? {
          ...filters,
          clientId: filters.clientId ? Number(filters.clientId) : undefined,
          productId: filters.productId ? Number(filters.productId) : undefined,
          verificationTypeId: filters.verificationTypeId
            ? Number(filters.verificationTypeId)
            : undefined,
        }
      : undefined;

    const response = await ratesService.getAllRates(queryFilters);
    return {
      success: response.success,
      message: response.message,
      data: response.data || [],
      error: response.error,
    };
  }

  async deleteRate(rateId: number): Promise<ApiResponse<void>> {
    return ratesService.deleteRate(rateId);
  }

  // Workflow helpers
  async initializeWorkflowForCombination(
    clientId: number,
    productId: number,
    verificationTypeId: number
  ): Promise<
    ApiResponse<{
      assignmentStatus: RateTypeAssignmentStatus[];
      availableRateTypes: AvailableRateType[];
    }>
  > {
    try {
      const [assignmentResponse, availableResponse] = await Promise.all([
        this.getAssignmentStatusForCombination(clientId, productId, verificationTypeId),
        this.getAvailableRateTypesForRateAssignment(clientId, productId, verificationTypeId),
      ]);

      if (!assignmentResponse.success) {
        return {
          success: false,
          message: assignmentResponse.message,
          error: assignmentResponse.error,
        };
      }

      if (!availableResponse.success) {
        return {
          success: false,
          message: availableResponse.message,
          error: availableResponse.error,
        };
      }

      return {
        success: true,
        message: 'Workflow initialized successfully',
        data: {
          assignmentStatus: assignmentResponse.data || [],
          availableRateTypes: availableResponse.data || [],
        },
      };
    } catch (_error) {
      return {
        success: false,
        message: 'Failed to initialize workflow',
        error: { code: 'WORKFLOW_INIT_ERROR' },
      };
    }
  }

  // Complete workflow: Assign rate types and set rates
  async completeRateSetupWorkflow(
    clientId: number,
    productId: number,
    verificationTypeId: number,
    rateTypeIds: number[],
    rates: { rateTypeId: number; amount: number; currency?: string }[]
  ): Promise<ApiResponse<void>> {
    try {
      // Step 1: Assign rate types
      const assignmentResponse = await this.assignRateTypesToCombination({
        clientId,
        productId,
        verificationTypeId,
        rateTypeIds,
      });

      if (!assignmentResponse.success) {
        return assignmentResponse;
      }

      // Step 2: Set rates for assigned rate types
      const ratePromises = rates.map((rate) =>
        this.setRateAmount({
          clientId,
          productId,
          verificationTypeId,
          rateTypeId: rate.rateTypeId,
          amount: rate.amount,
          currency: rate.currency || 'INR',
        })
      );

      const rateResponses = await Promise.all(ratePromises);
      const failedRates = rateResponses.filter((response) => !response.success);

      if (failedRates.length > 0) {
        return {
          success: false,
          message: `Failed to set ${failedRates.length} rates`,
          error: { code: 'PARTIAL_RATE_SETUP_FAILURE' },
        };
      }

      return {
        success: true,
        message: 'Rate setup workflow completed successfully',
      };
    } catch (_error) {
      return {
        success: false,
        message: 'Failed to complete rate setup workflow',
        error: { code: 'WORKFLOW_COMPLETION_ERROR' },
      };
    }
  }

  // Tab 5: Document Type Rates Management
  async getDocumentTypeRates(filters?: {
    clientId?: number;
    productId?: number;
    documentTypeId?: number;
    search?: string;
    isActive?: boolean;
  }) {
    return documentTypeRatesService.getDocumentTypeRates(filters);
  }

  async createOrUpdateDocumentTypeRate(
    data: CreateDocumentTypeRateData
  ): Promise<ApiResponse<void>> {
    return documentTypeRatesService.createOrUpdateDocumentTypeRate(data);
  }

  async deleteDocumentTypeRate(rateId: number): Promise<ApiResponse<void>> {
    return documentTypeRatesService.deleteDocumentTypeRate(rateId);
  }

  async getDocumentTypeRateStats(): Promise<ApiResponse<DocumentTypeRateStats>> {
    return documentTypeRatesService.getDocumentTypeRateStats();
  }

  // Statistics and reporting
  async getRateManagementStats(): Promise<
    ApiResponse<{
      rateTypes: { total: number; active: number; inactive: number };
      rates: { total: number; active: number; inactive: number; averageAmount: number };
      documentTypeRates?: DocumentTypeRateStats;
    }>
  > {
    try {
      const [rateTypeStats, rateStats, documentTypeRateStats] = await Promise.all([
        rateTypesService.getRateTypeStats(),
        ratesService.getRateStats(),
        documentTypeRatesService.getDocumentTypeRateStats(),
      ]);

      if (!rateTypeStats.success || !rateStats.success) {
        return {
          success: false,
          message: 'Failed to retrieve statistics',
          error: { code: 'STATS_RETRIEVAL_ERROR' },
        };
      }

      return {
        success: true,
        message: 'Statistics retrieved successfully',
        data: {
          rateTypes: rateTypeStats.data || { total: 0, active: 0, inactive: 0 },
          rates: rateStats.data || { total: 0, active: 0, inactive: 0, averageAmount: 0 },
          documentTypeRates: documentTypeRateStats.data,
        },
      };
    } catch (_error) {
      return {
        success: false,
        message: 'Failed to retrieve statistics',
        error: { code: 'STATS_ERROR' },
      };
    }
  }
}

export const rateManagementService = new RateManagementService();

// Re-export individual services for direct access if needed
export { rateTypesService, rateTypeAssignmentsService, ratesService, documentTypeRatesService };

// Re-export types
export type {
  RateType,
  CreateRateTypeData,
  UpdateRateTypeData,
  RateTypeAssignmentStatus,
  BulkAssignRateTypesData,
  Rate,
  AvailableRateType,
  CreateOrUpdateRateData,
  DocumentTypeRate,
  CreateDocumentTypeRateData,
  DocumentTypeRateStats,
};
