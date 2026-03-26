import { apiService } from './api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type {
  RoleData,
  CreateRoleRequest,
  UpdateRoleRequest,
  RolePermissions,
} from '@/types/user';

export interface RolesQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  includeInactive?: boolean;
  systemRolesOnly?: boolean;
}

type RbacRole = {
  id: string;
  name: string;
  description?: string | null;
  parentRoleId?: string | null;
  parentRoleName?: string | null;
  isSystem?: boolean;
  createdAt?: string;
  updatedAt?: string;
  userCount?: number;
};

type RbacRolePermissionsResponse = {
  roleId: string;
  permissions: string[];
};

const DEFAULT_LEGACY_PERMISSIONS: RolePermissions = {
  users: { create: false, read: false, update: false, delete: false },
  roles: { create: false, read: false, update: false, delete: false },
  departments: { create: false, read: false, update: false, delete: false },
  locations: { create: false, read: false, update: false, delete: false },
  clients: { create: false, read: false, update: false, delete: false },
  cases: { create: false, read: false, update: false, delete: false },
  reports: { create: false, read: false, update: false, delete: false },
  settings: { create: false, read: false, update: false, delete: false },
  products: { create: false, read: false, update: false, delete: false },
  verification_types: { create: false, read: false, update: false, delete: false },
  document_types: { create: false, read: false, update: false, delete: false },
  rate_management: { create: false, read: false, update: false, delete: false },
  commissions: { create: false, read: false, update: false, delete: false },
  billing: { create: false, read: false, update: false, delete: false },
  forms: { create: false, read: false, update: false, delete: false },
  analytics: { create: false, read: false, update: false, delete: false },
  tasks: { create: false, read: false, update: false, delete: false },
  designations: { create: false, read: false, update: false, delete: false },
};

const cloneDefaultPermissions = (): RolePermissions =>
  JSON.parse(JSON.stringify(DEFAULT_LEGACY_PERMISSIONS)) as RolePermissions;

const markAll = (target: { create: boolean; read: boolean; update: boolean; delete: boolean }) => {
  target.create = true;
  target.read = true;
  target.update = true;
  target.delete = true;
};

const rbacCodesToLegacyPermissions = (codes: string[]): RolePermissions => {
  const permissions = cloneDefaultPermissions();
  const set = new Set(codes);

  if (set.has('*')) {
    Object.values(permissions).forEach(markAll);
    return permissions;
  }

  if (set.has('user.create')) {permissions.users.create = true;}
  if (set.has('user.view')) {permissions.users.read = true;}
  if (set.has('user.update')) {permissions.users.update = true;}
  if (set.has('user.delete')) {permissions.users.delete = true;}

  if (set.has('role.manage')) {markAll(permissions.roles);}
  if (set.has('permission.manage')) {permissions.roles.update = true;}
  if (set.has('territory.assign')) {permissions.users.update = true;}

  if (set.has('case.create')) {permissions.cases.create = true;}
  if (set.has('case.view')) {permissions.cases.read = true;}
  if (set.has('case.update') || set.has('case.assign') || set.has('case.reassign')) {permissions.cases.update = true;}
  if (set.has('case.delete')) {permissions.cases.delete = true;}

  if (set.has('visit.start') || set.has('visit.upload') || set.has('visit.submit') || set.has('visit.revoke') || set.has('visit.revisit') || set.has('task.revoke')) {
    permissions.tasks.read = true;
    permissions.tasks.update = true;
  }
  if (set.has('task.revoke')) {permissions.tasks.delete = true;}

  if (set.has('report.generate')) {permissions.reports.create = true;}
  if (set.has('report.download')) {permissions.reports.read = true;}
  if (set.has('review.view')) {permissions.forms.read = true;}
  if (set.has('review.approve') || set.has('review.rework')) {permissions.forms.update = true;}

  if (set.has('billing.generate')) {permissions.billing.create = true;}
  if (set.has('billing.download')) {permissions.billing.read = true;}
  if (set.has('billing.approve')) {permissions.billing.update = true;}

  if (set.has('dashboard.view')) {permissions.analytics.read = true;}
  if (set.has('settings.manage')) {markAll(permissions.settings);}

  return permissions;
};

const legacyPermissionsToRbacCodes = (permissions?: Partial<RolePermissions>): string[] => {
  if (!permissions) {return [];}
  const out = new Set<string>();

  const users = permissions.users;
  if (users?.create) {out.add('user.create');}
  if (users?.read) {out.add('user.view');}
  if (users?.update) {out.add('user.update');}
  if (users?.delete) {out.add('user.delete');}

  const roles = permissions.roles;
  if (roles?.create || roles?.read || roles?.update || roles?.delete) {out.add('role.manage');}

  const cases = permissions.cases;
  if (cases?.create) {out.add('case.create');}
  if (cases?.read) {out.add('case.view');}
  if (cases?.update) {out.add('case.update');}
  if (cases?.delete) {out.add('case.delete');}

  const reports = permissions.reports;
  if (reports?.create) {out.add('report.generate');}
  if (reports?.read) {out.add('report.download');}

  const billing = permissions.billing;
  if (billing?.create) {out.add('billing.generate');}
  if (billing?.read) {out.add('billing.download');}
  if (billing?.update) {out.add('billing.approve');}

  const tasks = permissions.tasks;
  if (tasks?.read || tasks?.update || tasks?.create || tasks?.delete) {
    out.add('visit.start');
    out.add('visit.upload');
    out.add('visit.submit');
    out.add('visit.revoke');
    out.add('visit.revisit');
    out.add('task.revoke');
  }

  const forms = permissions.forms;
  if (forms?.read) {out.add('review.view');}
  if (forms?.update) {
    out.add('review.approve');
    out.add('review.rework');
  }

  const analytics = permissions.analytics;
  if (analytics?.read) {out.add('dashboard.view');}

  const settings = permissions.settings;
  if (settings?.read || settings?.create || settings?.update || settings?.delete) {
    out.add('settings.manage');
  }

  return Array.from(out);
};

const mapRbacRoleToLegacyRoleData = (
  role: RbacRole,
  permissionCodes: string[] = []
): RoleData => ({
  id: role.id,
  name: role.name,
  description: role.description || '',
  permissions: rbacCodesToLegacyPermissions(permissionCodes),
  isSystemRole: !!role.isSystem,
  isActive: true,
  createdAt: role.createdAt || new Date().toISOString(),
  updatedAt: role.updatedAt || role.createdAt || new Date().toISOString(),
  userCount: Number(role.userCount || 0),
});

class RolesService {
  private async getRolePermissionCodes(roleId: string): Promise<string[]> {
    const response = await apiService.get<RbacRolePermissionsResponse>(`/rbac/roles/${roleId}/permissions`);
    return Array.isArray(response.data?.permissions) ? response.data.permissions : [];
  }

  async getRoles(params: RolesQueryParams = {}): Promise<PaginatedResponse<RoleData>> {
    const response = await apiService.get<RbacRole[]>('/roles');
    let roles = Array.isArray(response.data) ? response.data : [];

    if (params.search) {
      const q = params.search.toLowerCase();
      roles = roles.filter(r =>
        (r.name || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)
      );
    }
    if (params.systemRolesOnly) {
      roles = roles.filter(r => !!r.isSystem);
    }

    const page = params.page || 1;
    const limit = params.limit || roles.length || 100;
    const start = (page - 1) * limit;
    const pageRoles = roles.slice(start, start + limit);

    const roleRows = await Promise.all(
      pageRoles.map(async role => {
        const permissionCodes = await this.getRolePermissionCodes(role.id);
        return mapRbacRoleToLegacyRoleData(role, permissionCodes);
      })
    );

    return {
      success: true,
      data: roleRows,
      pagination: {
        page,
        limit,
        total: roles.length,
        totalPages: Math.max(1, Math.ceil(roles.length / limit)),
      },
    } as PaginatedResponse<RoleData>;
  }

  async getRoleById(id: string): Promise<ApiResponse<RoleData>> {
    const [roleRes, permsRes] = await Promise.all([
      apiService.get<RbacRole>(`/roles/${id}`),
      apiService.get<RbacRolePermissionsResponse>(`/roles/${id}/permissions`),
    ]);
    const permissionCodes = Array.isArray(permsRes.data?.permissions) ? permsRes.data.permissions : [];
    return {
      ...roleRes,
      data: roleRes.data ? mapRbacRoleToLegacyRoleData(roleRes.data, permissionCodes) : undefined,
    } as ApiResponse<RoleData>;
  }

  async createRole(data: CreateRoleRequest): Promise<ApiResponse<RoleData>> {
    const createRes = await apiService.post<RbacRole>('/roles', {
      name: data.name,
      description: data.description,
    });
    if (createRes.data?.id) {
      await apiService.put(`/roles/${createRes.data.id}/permissions`, {
        permissionCodes: legacyPermissionsToRbacCodes(data.permissions),
      });
    }
    return this.getRoleById(String(createRes.data?.id));
  }

  async updateRole(id: string, data: UpdateRoleRequest): Promise<ApiResponse<RoleData>> {
    await apiService.put(`/roles/${id}`, {
      name: data.name,
      description: data.description,
    });
    if (data.permissions) {
      await apiService.put(`/roles/${id}/permissions`, {
        permissionCodes: legacyPermissionsToRbacCodes(data.permissions),
      });
    }
    return this.getRoleById(id);
  }

  async deleteRole(id: string): Promise<ApiResponse<void>> {
    return apiService.delete<void>(`/roles/${id}`);
  }

  async getSystemRoles(): Promise<PaginatedResponse<RoleData>> {
    return this.getRoles({ systemRolesOnly: true, limit: 100 });
  }

  async getActiveRoles(): Promise<PaginatedResponse<RoleData>> {
    return this.getRoles({ includeInactive: false, limit: 100 });
  }
}

export const rolesService = new RolesService();

