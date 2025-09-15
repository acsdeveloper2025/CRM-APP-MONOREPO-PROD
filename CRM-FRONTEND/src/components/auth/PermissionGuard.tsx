import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle } from 'lucide-react';

interface PermissionGuardProps {
  children: React.ReactNode;
  resource: string;
  action: string;
  fallback?: React.ReactNode;
  showError?: boolean;
}

interface MultiplePermissionGuardProps {
  children: React.ReactNode;
  permissions: Array<{ resource: string; action: string }>;
  requireAll?: boolean; // If true, all permissions must be granted. If false, any permission is sufficient
  fallback?: React.ReactNode;
  showError?: boolean;
}

// Single permission guard
export function PermissionGuard({
  children,
  resource,
  action,
  fallback,
  showError = false,
}: PermissionGuardProps) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(resource, action)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showError) {
      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this feature. Required permission: {resource}.{action}
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  }

  return <>{children}</>;
}

// Multiple permissions guard
export function MultiplePermissionGuard({
  children,
  permissions,
  requireAll = true,
  fallback,
  showError = false,
}: MultiplePermissionGuardProps) {
  const { hasAllPermissions, hasAnyPermission } = usePermissions();

  const hasAccess = requireAll
    ? hasAllPermissions(permissions)
    : hasAnyPermission(permissions);

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showError) {
      const permissionList = permissions
        .map(({ resource, action }) => `${resource}.${action}`)
        .join(', ');

      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this feature. Required permissions: {permissionList}
            {requireAll ? ' (all required)' : ' (any required)'}
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  }

  return <>{children}</>;
}

// Admin only guard
export function AdminGuard({
  children,
  fallback,
  showError = false,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
}) {
  const { isAdmin } = usePermissions();

  if (!isAdmin()) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showError) {
      return (
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            This feature is only available to administrators.
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  }

  return <>{children}</>;
}

// Role-based guard
export function RoleGuard({
  children,
  allowedRoles,
  fallback,
  showError = false,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
  fallback?: React.ReactNode;
  showError?: boolean;
}) {
  const { user } = usePermissions();

  if (!user || !allowedRoles.includes(user.role)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showError) {
      return (
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You don't have the required role to access this feature. Required roles: {allowedRoles.join(', ')}
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  }

  return <>{children}</>;
}
