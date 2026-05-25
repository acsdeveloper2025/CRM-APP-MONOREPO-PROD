/**
 * A2.3 (audit 2026-05-25): client for the revoke_reasons master.
 *
 * Replaces the hardcoded REVOKE_REASONS array in useRevokeTaskAction.tsx
 * with API-driven data. Keep the surface intentionally small — the
 * master table is tiny (<= ~20 rows ever expected) so no pagination /
 * stats / export endpoints.
 */
import { apiService } from './api';
import { ApiResponse } from '@/types/api';

export interface RevokeReason {
  id: number;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Compact shape returned by /active — used by FE/mobile dropdowns. */
export interface ActiveRevokeReason {
  id: number;
  code: string;
  label: string;
  sortOrder: number;
}

export interface CreateRevokeReasonRequest {
  code: string;
  label: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateRevokeReasonRequest {
  label?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface RevokeReasonsQueryParams {
  isActive?: 'true' | 'false' | 'all';
  sortBy?: 'sortOrder' | 'label' | 'code' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

class RevokeReasonsService {
  async listAll(params: RevokeReasonsQueryParams = {}): Promise<ApiResponse<RevokeReason[]>> {
    return apiService.get<RevokeReason[]>('/revoke-reasons', params);
  }

  async listActive(): Promise<ApiResponse<ActiveRevokeReason[]>> {
    return apiService.get<ActiveRevokeReason[]>('/revoke-reasons/active');
  }

  async getById(id: number): Promise<ApiResponse<RevokeReason>> {
    return apiService.get<RevokeReason>(`/revoke-reasons/${id}`);
  }

  async create(data: CreateRevokeReasonRequest): Promise<ApiResponse<RevokeReason>> {
    return apiService.post<RevokeReason>('/revoke-reasons', data);
  }

  async update(id: number, data: UpdateRevokeReasonRequest): Promise<ApiResponse<RevokeReason>> {
    return apiService.put<RevokeReason>(`/revoke-reasons/${id}`, data);
  }
}

export const revokeReasonsService = new RevokeReasonsService();
