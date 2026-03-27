import { BaseApiService } from './base';
import type { ApiResponse } from '@/types/api';
import type {
  RateType,
  ServiceZoneRule,
  CreateServiceZoneRuleData,
  UpdateServiceZoneRuleData,
} from '@/types/rateManagement';

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
    return this.get('', query as Record<string, unknown>);
  }

  async listServiceZones(): Promise<ApiResponse<RateType[]>> {
    return this.get('/service-zones');
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
