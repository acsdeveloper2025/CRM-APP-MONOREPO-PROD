import type { AxiosResponse } from 'axios';
import { apiService } from './api';
import { BaseApiService } from './base';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type {
  RateType,
  ServiceZoneRule,
  CreateServiceZoneRuleData,
  UpdateServiceZoneRuleData,
} from '@/types/rateManagement';
import { validateResponse } from './schemas/runtime';
import { GenericEntityListSchema } from './schemas/generic.schema';

export interface ServiceZoneRuleListQuery {
  clientId?: number;
  productId?: number;
  pincodeId?: number;
  areaId?: number;
  rateTypeId?: number;
  verificationTypeId?: number;
  // 'all' is sent verbatim so URL/cache key stays stable; BE treats it as no-filter.
  isActive?: boolean | 'true' | 'false' | 'all';
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ServiceZoneRuleStats {
  total: number;
  active: number;
  inactive: number;
  recentlyAddedCount: number;
  pincodesCoveredCount: number;
}

class ServiceZoneRulesService extends BaseApiService {
  constructor() {
    super('/service-zone-rules');
  }

  async listRules(
    query: ServiceZoneRuleListQuery = {}
  ): Promise<PaginatedResponse<ServiceZoneRule>> {
    const response = await this.get<ServiceZoneRule[]>('', query as Record<string, unknown>);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'serviceZoneRules',
        endpoint: 'GET /service-zone-rules',
      });
    }
    return response as unknown as PaginatedResponse<ServiceZoneRule>;
  }

  async getStats(): Promise<ApiResponse<ServiceZoneRuleStats>> {
    return apiService.get('/service-zone-rules/stats');
  }

  // xlsx export — mirrors listRules filters via shared BE WHERE-helper.
  async exportRules(
    query: Omit<ServiceZoneRuleListQuery, 'page' | 'limit'> = {}
  ): Promise<AxiosResponse<Blob>> {
    return apiService.getRaw<Blob>('/service-zone-rules/export', query, {
      responseType: 'blob',
    });
  }

  async listServiceZones(): Promise<ApiResponse<RateType[]>> {
    const response = await this.get<RateType[]>('/service-zones');
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'serviceZoneRules',
        endpoint: 'GET /service-zone-rules/service-zones',
      });
    }
    return response;
  }

  async createRule(data: CreateServiceZoneRuleData): Promise<ApiResponse<ServiceZoneRule>> {
    return this.post('', data);
  }

  async updateRule(
    id: number,
    data: UpdateServiceZoneRuleData
  ): Promise<ApiResponse<ServiceZoneRule>> {
    return this.put(`/${id}`, data);
  }

  async activateRule(id: number): Promise<ApiResponse<ServiceZoneRule>> {
    return this.post(`/${id}/activate`);
  }

  async deactivateRule(id: number): Promise<ApiResponse<ServiceZoneRule>> {
    return this.post(`/${id}/deactivate`);
  }
}

export const serviceZoneRulesService = new ServiceZoneRulesService();
