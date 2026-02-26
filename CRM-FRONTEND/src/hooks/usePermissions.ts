import { useAuth } from '@/hooks/useAuth';
import { RESOURCES, ACTIONS } from '@/constants/permissions';

export interface UserPermissions {
  [resource: string]: {
    [action: string]: boolean;
  };
}

const LEGACY_TO_RBAC: Record<string, string> = {
  'users.read': 'user.view',
  'users.create': 'user.create',
  'users.update': 'user.update',
  'users.delete': 'user.delete',
  'roles.read': 'role.manage',
  'roles.create': 'role.manage',
  'roles.update': 'role.manage',
  'roles.delete': 'role.manage',
  'departments.read': 'user.view',
  'departments.create': 'role.manage',
  'departments.update': 'role.manage',
  'departments.delete': 'role.manage',
  'locations.read': 'case.view',
  'locations.create': 'settings.manage',
  'locations.update': 'settings.manage',
  'locations.delete': 'settings.manage',
  'clients.read': 'case.view',
  'clients.create': 'case.create',
  'clients.update': 'case.update',
  'clients.delete': 'case.delete',
  'products.read': 'settings.manage',
  'products.create': 'settings.manage',
  'products.update': 'settings.manage',
  'products.delete': 'settings.manage',
  'verification_types.read': 'settings.manage',
  'verification_types.create': 'settings.manage',
  'verification_types.update': 'settings.manage',
  'verification_types.delete': 'settings.manage',
  'document_types.read': 'settings.manage',
  'document_types.create': 'settings.manage',
  'document_types.update': 'settings.manage',
  'document_types.delete': 'settings.manage',
  'rate_management.read': 'settings.manage',
  'rate_management.create': 'settings.manage',
  'rate_management.update': 'settings.manage',
  'rate_management.delete': 'settings.manage',
  'cases.read': 'case.view',
  'cases.create': 'case.create',
  'cases.update': 'case.update',
  'cases.delete': 'case.delete',
  'tasks.read': 'case.assign',
  'tasks.create': 'case.assign',
  'tasks.update': 'case.assign',
  'tasks.delete': 'case.reassign',
  'forms.read': 'review.view',
  'forms.create': 'review.approve',
  'forms.update': 'review.approve',
  'forms.delete': 'review.rework',
  'reports.read': 'report.download',
  'reports.create': 'report.generate',
  'reports.update': 'report.generate',
  'reports.delete': 'report.generate',
  'billing.read': 'billing.download',
  'billing.create': 'billing.generate',
  'billing.update': 'billing.approve',
  'billing.delete': 'billing.approve',
  'commissions.read': 'billing.download',
  'commissions.create': 'billing.generate',
  'commissions.update': 'billing.approve',
  'commissions.delete': 'billing.approve',
  'analytics.read': 'dashboard.view',
  'settings.read': 'settings.manage',
  'settings.update': 'settings.manage',
  'designations.read': 'user.view',
  'designations.create': 'role.manage',
  'designations.update': 'role.manage',
  'designations.delete': 'role.manage',
  'role_management.read': 'role.manage',
};

const hasPermissionCode = (user: { permissions?: unknown; permissionCodes?: string[] } | null, code: string) => {
  if (!user) {return false;}

  const raw = user.permissionCodes || (Array.isArray(user.permissions) ? (user.permissions as string[]) : []);
  if (raw.includes('*') || raw.includes(code)) {return true;}
  return false;
};

export function usePermissions() {
  const { user } = useAuth();

  // Check if user has a specific permission
  const hasPermission = (resource: string, action: string): boolean => {
    if (!user) {return false;}

    // Prefer RBAC permission codes from /auth/me
    const requestedLegacyCode = `${resource}.${action}`;
    const mappedRbacCode = LEGACY_TO_RBAC[requestedLegacyCode];
    if (hasPermissionCode(user, requestedLegacyCode) || (mappedRbacCode && hasPermissionCode(user, mappedRbacCode))) {
      return true;
    }

    return false;
  };

  // Check multiple permissions (all must be true)
  const hasAllPermissions = (checks: Array<{ resource: string; action: string }>): boolean => {
    return checks.every(({ resource, action }) => hasPermission(resource, action));
  };

  // Check multiple permissions (at least one must be true)
  const hasAnyPermission = (checks: Array<{ resource: string; action: string }>): boolean => {
    return checks.some(({ resource, action }) => hasPermission(resource, action));
  };

  // Convenience methods for common permission checks
  const canCreate = (resource: string) => hasPermission(resource, ACTIONS.CREATE);
  const canRead = (resource: string) => hasPermission(resource, ACTIONS.READ);
  const canUpdate = (resource: string) => hasPermission(resource, ACTIONS.UPDATE);
  const canDelete = (resource: string) => hasPermission(resource, ACTIONS.DELETE);

  // Resource-specific permission checks
  const permissions = {
    users: {
      create: () => canCreate(RESOURCES.USERS),
      read: () => canRead(RESOURCES.USERS),
      update: () => canUpdate(RESOURCES.USERS),
      delete: () => canDelete(RESOURCES.USERS),
    },
    roles: {
      create: () => canCreate(RESOURCES.ROLES),
      read: () => canRead(RESOURCES.ROLES),
      update: () => canUpdate(RESOURCES.ROLES),
      delete: () => canDelete(RESOURCES.ROLES),
    },
    departments: {
      create: () => canCreate(RESOURCES.DEPARTMENTS),
      read: () => canRead(RESOURCES.DEPARTMENTS),
      update: () => canUpdate(RESOURCES.DEPARTMENTS),
      delete: () => canDelete(RESOURCES.DEPARTMENTS),
    },
    locations: {
      create: () => canCreate(RESOURCES.LOCATIONS),
      read: () => canRead(RESOURCES.LOCATIONS),
      update: () => canUpdate(RESOURCES.LOCATIONS),
      delete: () => canDelete(RESOURCES.LOCATIONS),
    },
    clients: {
      create: () => canCreate(RESOURCES.CLIENTS),
      read: () => canRead(RESOURCES.CLIENTS),
      update: () => canUpdate(RESOURCES.CLIENTS),
      delete: () => canDelete(RESOURCES.CLIENTS),
    },
    cases: {
      create: () => canCreate(RESOURCES.CASES),
      read: () => canRead(RESOURCES.CASES),
      update: () => canUpdate(RESOURCES.CASES),
      delete: () => canDelete(RESOURCES.CASES),
    },
    reports: {
      create: () => canCreate(RESOURCES.REPORTS),
      read: () => canRead(RESOURCES.REPORTS),
      update: () => canUpdate(RESOURCES.REPORTS),
      delete: () => canDelete(RESOURCES.REPORTS),
    },
    settings: {
      create: () => canCreate(RESOURCES.SETTINGS),
      read: () => canRead(RESOURCES.SETTINGS),
      update: () => canUpdate(RESOURCES.SETTINGS),
      delete: () => canDelete(RESOURCES.SETTINGS),
    },
  };

  // Get all user permissions
  const getAllPermissions = (): UserPermissions => {
    return {} as UserPermissions;
  };

  return {
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    permissions,
    getAllPermissions,
    user,
  };
}
