import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PermissionProtectedRoute } from '@/components/auth/PermissionProtectedRoute';
import { Layout } from '@/components/layout/Layout';
import { MobileApp } from '@/components/mobile/MobileApp';

// Import all page components
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CasesPage } from '@/pages/CasesPage';
import { CaseDetailPage } from '@/pages/CaseDetailPage';

import { PendingCasesPage } from '@/pages/PendingCasesPage';
import { CompletedCasesPage } from '@/pages/CompletedCasesPage';
import { InProgressCasesPage } from '@/pages/InProgressCasesPage';
import { NewCasePage } from '@/pages/NewCasePage';
import { ClientsPage } from '@/pages/ClientsPage';
import { UsersPage } from '@/pages/UsersPage';
import { UserPermissionsPage } from '@/pages/UserPermissionsPage';
import RoleManagementPage from '@/pages/RoleManagementPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { BillingPage } from '@/pages/BillingPage';
import { CommissionManagementPage } from '@/pages/CommissionManagementPage';
import { CommissionsPage } from '@/pages/CommissionsPage';
import { LocationsPage } from '@/pages/LocationsPage';
import { RealTimePage } from '@/pages/RealTimePage';
import { FormViewerPage } from '@/pages/FormViewerPage';
import { SecurityUXPage } from '@/pages/SecurityUXPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { VerificationTypesPage } from '@/pages/VerificationTypesPage';

import { RateManagementPage } from '@/pages/RateManagementPage';



// Default route component that handles authentication-based redirects
const DefaultRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { isMobile, isTouchDevice } = useResponsive();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to mobile app for mobile devices
  if (isAuthenticated && (isMobile || isTouchDevice)) {
    return <Navigate to="/mobile" replace />;
  }

  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>


      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Mobile app route */}
      <Route
        path="/mobile"
        element={
          <ProtectedRoute>
            <MobileApp />
          </ProtectedRoute>
        }
      />

      {/* Protected routes with layout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      
      {/* Cases routes */}
      <Route
        path="/cases"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND', 'SUPER_ADMIN']}>
            <Layout>
              <CasesPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cases/:id"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND', 'SUPER_ADMIN']}>
            <Layout>
              <CaseDetailPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cases/pending"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND', 'SUPER_ADMIN']}>
            <Layout>
              <PendingCasesPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/cases/in-progress"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND', 'SUPER_ADMIN']}>
            <Layout>
              <InProgressCasesPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/cases/completed"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND', 'SUPER_ADMIN']}>
            <Layout>
              <CompletedCasesPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cases/new"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND', 'SUPER_ADMIN']}>
            <Layout>
              <NewCasePage />
            </Layout>
          </ProtectedRoute>
        }
      />



      {/* Clients routes */}
      <Route
        path="/clients"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND', 'SUPER_ADMIN']}>
            <Layout>
              <ClientsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Products routes */}
      <Route
        path="/products"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
            <Layout>
              <ProductsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Verification Types routes */}
      <Route
        path="/verification-types"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
            <Layout>
              <VerificationTypesPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Rate Management routes */}
      <Route
        path="/rate-management"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
            <Layout>
              <RateManagementPage />
            </Layout>
          </ProtectedRoute>
        }
      />


      
      {/* Admin only routes */}
      <Route
        path="/users"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
            <Layout>
              <UsersPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/users/:userId/permissions"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
            <Layout>
              <UserPermissionsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/role-management"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
            <PermissionProtectedRoute resource="roles" action="read">
              <Layout>
                <RoleManagementPage />
              </Layout>
            </PermissionProtectedRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/locations"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
            <Layout>
              <LocationsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/security-ux"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
            <Layout>
              <SecurityUXPage />
            </Layout>
          </ProtectedRoute>
        }
      />


      {/* Reports routes */}
      <Route
        path="/reports"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND', 'SUPER_ADMIN']}>
            <Layout>
              <ReportsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Analytics routes */}
      <Route
        path="/analytics"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND', 'SUPER_ADMIN']}>
            <Layout>
              <AnalyticsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Additional feature routes */}
      <Route
        path="/billing"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND', 'SUPER_ADMIN']}>
            <Layout>
              <BillingPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/commissions"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND', 'SUPER_ADMIN']}>
            <Layout>
              <CommissionsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/commission-management"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND', 'SUPER_ADMIN']}>
            <Layout>
              <CommissionManagementPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/realtime"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND', 'SUPER_ADMIN']}>
            <Layout>
              <RealTimePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms"
        element={
          <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND', 'SUPER_ADMIN']}>
            <Layout>
              <FormViewerPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Layout>
              <SettingsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Default routes */}
      <Route path="/" element={<DefaultRoute />} />
      <Route path="*" element={<DefaultRoute />} />
    </Routes>
  );
};
