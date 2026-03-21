import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Alert, AlertDescription } from '@/ui/components/alert';
import { AlertTriangle } from 'lucide-react';

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
            You don&apos;t have permission to access this feature. Required permission: {resource}.{action}
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
            You don&apos;t have permission to access this feature. Required permissions: {permissionList}
            {requireAll ? ' (all required)' : ' (any required)'}
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  }

  return <>{children}</>;
}
