import { apiService } from '@/services/api';

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
  getPermissions() {
    return apiService.get<PermissionDefinition[]>('/rbac/permissions');
  }

  getRoles() {
    return apiService.get<RbacRole[]>('/rbac/roles');
  }

  createRole(data: { name: string; description?: string; parentRoleId?: string | null }) {
    return apiService.post<RbacRole>('/rbac/roles', data);
  }

  updateRole(id: string, data: { name?: string; description?: string; parentRoleId?: string | null }) {
    return apiService.put<RbacRole>(`/rbac/roles/${id}`, data);
  }

  deleteRole(id: string) {
    return apiService.delete(`/rbac/roles/${id}`);
  }

  getRolePermissions(id: string) {
    return apiService.get<{ roleId: string; permissions: string[]; matrix: Array<{ code: string; module: string; allowed: boolean }> }>(
      `/rbac/roles/${id}/permissions`
    );
  }

  updateRolePermissions(id: string, permissionCodes: string[]) {
    return apiService.put(`/rbac/roles/${id}/permissions`, { permissionCodes });
  }

  getRoleRoutes(id: string) {
    return apiService.get<{ roleId: string; routes: RoleRouteAccess[] }>(`/rbac/roles/${id}/routes`);
  }

  updateRoleRoutes(id: string, routes: RoleRouteAccess[]) {
    return apiService.put(`/rbac/roles/${id}/routes`, { routes });
  }
}

export const rbacAdminService = new RbacAdminService();
