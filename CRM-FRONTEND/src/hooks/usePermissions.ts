import { useCallback, useMemo } from 'react';
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
  'verificationTypes.read': 'settings.manage',
  'verificationTypes.create': 'settings.manage',
  'verificationTypes.update': 'settings.manage',
  'verificationTypes.delete': 'settings.manage',
  'documentTypes.read': 'settings.manage',
  'documentTypes.create': 'settings.manage',
  'documentTypes.update': 'settings.manage',
  'documentTypes.delete': 'settings.manage',
  'rateManagement.read': 'settings.manage',
  'rateManagement.create': 'settings.manage',
  'rateManagement.update': 'settings.manage',
  'rateManagement.delete': 'settings.manage',
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
  'roleManagement.read': 'role.manage',
};

const hasPermissionCode = (
  user: { permissions?: unknown; permissionCodes?: string[] } | null,
  code: string
) => {
  if (!user) {
    return false;
  }

  const raw =
    user.permissionCodes || (Array.isArray(user.permissions) ? (user.permissions as string[]) : []);
  if (raw.includes('*') || raw.includes(code)) {
    return true;
  }
  return false;
};

export function usePermissions() {
  const { user } = useAuth();

  // Check if user has a specific permission
  const hasPermission = useCallback(
    (resource: string, action: string): boolean => {
      if (!user) {
        return false;
      }
      const requestedLegacyCode = `${resource}.${action}`;
      const mappedRbacCode = LEGACY_TO_RBAC[requestedLegacyCode];
      return (
        hasPermissionCode(user, requestedLegacyCode) ||
        (!!mappedRbacCode && hasPermissionCode(user, mappedRbacCode))
      );
    },
    [user]
  );

  // Check multiple permissions (all must be true)
  const hasAllPermissions = useCallback(
    (checks: Array<{ resource: string; action: string }>): boolean =>
      checks.every(({ resource, action }) => hasPermission(resource, action)),
    [hasPermission]
  );

  // Check multiple permissions (at least one must be true)
  const hasAnyPermission = useCallback(
    (checks: Array<{ resource: string; action: string }>): boolean =>
      checks.some(({ resource, action }) => hasPermission(resource, action)),
    [hasPermission]
  );

  // Convenience methods for common permission checks
  const canCreate = useCallback(
    (resource: string) => hasPermission(resource, ACTIONS.CREATE),
    [hasPermission]
  );
  const canRead = useCallback(
    (resource: string) => hasPermission(resource, ACTIONS.READ),
    [hasPermission]
  );
  const canUpdate = useCallback(
    (resource: string) => hasPermission(resource, ACTIONS.UPDATE),
    [hasPermission]
  );
  const canDelete = useCallback(
    (resource: string) => hasPermission(resource, ACTIONS.DELETE),
    [hasPermission]
  );

  // Resource-specific permission checks (memoized to prevent re-renders)
  const permissions = useMemo(
    () => ({
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
    }),
    [canCreate, canRead, canUpdate, canDelete]
  );

  // Get all user permissions
  const getAllPermissions = useCallback((): UserPermissions => {
    return {} as UserPermissions;
  }, []);

  return useMemo(
    () => ({
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
    }),
    [
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
    ]
  );
}

// Convenience hook: usePermission('page.kyc') → boolean
export function usePermission(code: string): boolean {
  const { user } = useAuth();
  if (!user) {
    return false;
  }
  const raw =
    user.permissionCodes || (Array.isArray(user.permissions) ? (user.permissions as string[]) : []);
  return raw.includes('*') || raw.includes(code);
}
