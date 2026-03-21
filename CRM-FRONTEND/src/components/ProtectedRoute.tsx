import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { PageLoadingFallback } from '@/ui/components/PageLoadingFallback';

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
    return <PageLoadingFallback />;
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
