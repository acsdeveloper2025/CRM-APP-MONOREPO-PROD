import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { Alert, AlertDescription } from '@/ui/components/alert';
import { AlertTriangle } from 'lucide-react';
interface PermissionProtectedRouteProps {
    children: React.ReactNode;
    resource: string;
    action: string;
    permissionCode?: string;
    fallbackPath?: string;
    showError?: boolean;
}
interface MultiplePermissionProtectedRouteProps {
    children: React.ReactNode;
    permissions: Array<{
        resource: string;
        action: string;
    }>;
    requireAll?: boolean;
    fallbackPath?: string;
    showError?: boolean;
}
// Single permission protected route
export function PermissionProtectedRoute({ children, resource, action, permissionCode, fallbackPath = '/unauthorized', showError = false, }: PermissionProtectedRouteProps) {
    const { hasPermission, user } = usePermissions();
    const { hasPermissionCode } = usePermissionContext();
    const location = useLocation();
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace/>;
    }
    const allowed = permissionCode ? hasPermissionCode(permissionCode) : hasPermission(resource, action);
    if (!allowed) {
        if (showError) {
            return (<div {...{ className: "container mx-auto py-6" }}>
          <Alert variant="destructive">
            <AlertTriangle {...{ className: "h-4 w-4" }}/>
            <AlertDescription>
              You don&apos;t have permission to access this page. Required permission: {resource}.{action}
              {permissionCode ? ` (${permissionCode})` : ''}
            </AlertDescription>
          </Alert>
        </div>);
        }
        return <Navigate to={fallbackPath} replace/>;
    }
    return <>{children}</>;
}
// Multiple permissions protected route
export function MultiplePermissionProtectedRoute({ children, permissions, requireAll = true, fallbackPath = '/unauthorized', showError = false, }: MultiplePermissionProtectedRouteProps) {
    const { hasAllPermissions, hasAnyPermission, user } = usePermissions();
    const location = useLocation();
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace/>;
    }
    const hasAccess = requireAll
        ? hasAllPermissions(permissions)
        : hasAnyPermission(permissions);
    if (!hasAccess) {
        if (showError) {
            const permissionList = permissions
                .map(({ resource, action }) => `${resource}.${action}`)
                .join(', ');
            return (<div {...{ className: "container mx-auto py-6" }}>
          <Alert variant="destructive">
            <AlertTriangle {...{ className: "h-4 w-4" }}/>
            <AlertDescription>
              You don&apos;t have permission to access this page. Required permissions: {permissionList}
              {requireAll ? ' (all required)' : ' (any required)'}
            </AlertDescription>
          </Alert>
        </div>);
        }
        return <Navigate to={fallbackPath} replace/>;
    }
    return <>{children}</>;
}
