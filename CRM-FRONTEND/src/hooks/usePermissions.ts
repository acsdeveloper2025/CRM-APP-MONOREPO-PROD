import { useAuth } from '@/contexts/AuthContext';
import { RESOURCES, ACTIONS } from '@/constants/permissions';

export interface UserPermissions {
  [resource: string]: {
    [action: string]: boolean;
  };
}

export function usePermissions() {
  const { user } = useAuth();

  // Check if user has a specific permission
  const hasPermission = (resource: string, action: string): boolean => {
    if (!user) return false;

    // SUPER_ADMIN and ADMIN users have all permissions
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;

    // Check if user has role-based permissions
    const permissions = user.permissions as UserPermissions;
    if (!permissions) return false;

    const resourcePermissions = permissions[resource];
    if (!resourcePermissions) return false;

    return resourcePermissions[action] === true;
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

  // Check if user is admin
  const isAdmin = () => user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  // Get all user permissions
  const getAllPermissions = (): UserPermissions => {
    if (!user) return {};
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
      // Return all permissions for admin
      return Object.values(RESOURCES).reduce((acc, resource) => {
        acc[resource] = Object.values(ACTIONS).reduce((actionAcc, action) => {
          actionAcc[action] = true;
          return actionAcc;
        }, {} as { [action: string]: boolean });
        return acc;
      }, {} as UserPermissions);
    }
    return (user.permissions as UserPermissions) || {};
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
    isAdmin,
    getAllPermissions,
    user,
  };
}
