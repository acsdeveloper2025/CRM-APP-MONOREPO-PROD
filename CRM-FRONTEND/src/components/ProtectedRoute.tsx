import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissionContext } from '@/contexts/PermissionContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  permission,
  fallbackPath = '/login',
}) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { hasPermissionCode } = usePermissionContext();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page with return url
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  if (permission && !hasPermissionCode(permission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
