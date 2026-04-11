import { BaseApiService } from './base';
import type { ApiResponse } from '@/types/api';
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
  isActive?: boolean;
}

class ServiceZoneRulesService extends BaseApiService {
  constructor() {
    super('/service-zone-rules');
  }

  async listRules(query: ServiceZoneRuleListQuery = {}): Promise<ApiResponse<ServiceZoneRule[]>> {
    const response = await this.get<ServiceZoneRule[]>('', query as Record<string, unknown>);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'serviceZoneRules',
        endpoint: 'GET /service-zone-rules',
      });
    }
    return response;
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
