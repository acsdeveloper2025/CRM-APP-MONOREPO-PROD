import { apiService } from '@/services/api';
import { validateResponse } from './schemas/runtime';
import { GenericEntityListSchema, GenericObjectSchema } from './schemas/generic.schema';

export interface RbacRole {
  id: string;
  name: string;
  description?: string | null;
  parentRoleId?: string | null;
  parentRoleName?: string | null;
  isSystem?: boolean;
  userCount?: number;
}

export interface PermissionDefinition {
  id: string;
  code: string;
  module: string;
  description?: string | null;
}

export interface RoleRouteAccess {
  routeKey: string;
  allowed: boolean;
}

class RbacAdminService {
  async getPermissions() {
    const response = await apiService.get<PermissionDefinition[]>('/rbac/permissions');
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'rbacAdmin',
        endpoint: 'GET /rbac/permissions',
      });
    }
    return response;
  }

  async getRoles() {
    const response = await apiService.get<RbacRole[]>('/rbac/roles');
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'rbacAdmin',
        endpoint: 'GET /rbac/roles',
      });
    }
    return response;
  }

  createRole(data: { name: string; description?: string; parentRoleId?: string | null }) {
    return apiService.post<RbacRole>('/rbac/roles', data);
  }

  updateRole(
    id: string,
    data: { name?: string; description?: string; parentRoleId?: string | null }
  ) {
    return apiService.put<RbacRole>(`/rbac/roles/${id}`, data);
  }

  deleteRole(id: string) {
    return apiService.delete(`/rbac/roles/${id}`);
  }

  async getRolePermissions(id: string) {
    const response = await apiService.get<{
      roleId: string;
      permissions: string[];
      matrix: Array<{ code: string; module: string; allowed: boolean }>;
    }>(`/rbac/roles/${id}/permissions`);
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'rbacAdmin',
        endpoint: 'GET /rbac/roles/:id/permissions',
      });
    }
    return response;
  }

  updateRolePermissions(id: string, permissionCodes: string[]) {
    return apiService.put(`/rbac/roles/${id}/permissions`, { permissionCodes });
  }

  async getRoleRoutes(id: string) {
    const response = await apiService.get<{ roleId: string; routes: RoleRouteAccess[] }>(
      `/rbac/roles/${id}/routes`
    );
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'rbacAdmin',
        endpoint: 'GET /rbac/roles/:id/routes',
      });
    }
    return response;
  }

  updateRoleRoutes(id: string, routes: RoleRouteAccess[]) {
    return apiService.put(`/rbac/roles/${id}/routes`, { routes });
  }
}

export const rbacAdminService = new RbacAdminService();
