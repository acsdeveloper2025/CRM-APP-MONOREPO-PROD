import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useResponsive } from '@/hooks/useResponsive';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PermissionProtectedRoute } from '@/components/auth/PermissionProtectedRoute';
import { Layout } from '@/components/layout/Layout';
import { MobileApp } from '@/components/mobile/MobileApp';

// Import all page components using React.lazy for code splitting
const LoginPage = React.lazy(() => import('@/pages/LoginPage').then(module => ({ default: module.LoginPage })));
const DashboardPage = React.lazy(() => import('@/pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const CasesPage = React.lazy(() => import('@/pages/CasesPage').then(module => ({ default: module.CasesPage })));
const CaseDetailPage = React.lazy(() => import('@/pages/CaseDetailPage').then(module => ({ default: module.CaseDetailPage })));

// Unused imports removed: PendingCasesPage, InProgressCasesPage
const CompletedCasesPage = React.lazy(() => import('@/pages/CompletedCasesPage').then(module => ({ default: module.CompletedCasesPage })));
const PendingTasksPage = React.lazy(() => import('@/pages/PendingTasksPage').then(module => ({ default: module.PendingTasksPage })));
const RevokedTasksPage = React.lazy(() => import('@/pages/RevokedTasksPage').then(module => ({ default: module.RevokedTasksPage })));
const InProgressTasksPage = React.lazy(() => import('@/pages/InProgressTasksPage').then(module => ({ default: module.InProgressTasksPage })));
const CompletedTasksPage = React.lazy(() => import('@/pages/CompletedTasksPage').then(module => ({ default: module.CompletedTasksPage })));
const AllTasksPage = React.lazy(() => import('@/pages/AllTasksPage').then(module => ({ default: module.AllTasksPage })));
const TaskDetailPage = React.lazy(() => import('@/pages/TaskDetailPage').then(module => ({ default: module.TaskDetailPage })));
const RevisitTasksPage = React.lazy(() => import('@/pages/RevisitTasksPage').then(module => ({ default: module.RevisitTasksPage })));
const TATMonitoringPage = React.lazy(() => import('@/pages/TATMonitoringPage').then(module => ({ default: module.TATMonitoringPage })));
const NewCasePage = React.lazy(() => import('@/pages/NewCasePage').then(module => ({ default: module.NewCasePage })));
const EditCasePage = React.lazy(() => import('@/pages/EditCasePage').then(module => ({ default: module.EditCasePage })));
const ClientsPage = React.lazy(() => import('@/pages/ClientsPage').then(module => ({ default: module.ClientsPage })));
const UsersPage = React.lazy(() => import('@/pages/UsersPage').then(module => ({ default: module.UsersPage })));
const UserPermissionsPage = React.lazy(() => import('@/pages/UserPermissionsPage').then(module => ({ default: module.UserPermissionsPage })));
// Default export needs special handling or ensure it's exported as named too. Assuming named for consistency or default logic.
// Checking RoleManagementPage import: import RoleManagementPage from '@/pages/RoleManagementPage';
const RoleManagementPage = React.lazy(() => import('@/pages/RoleManagementPage')); 
const ReportsPage = React.lazy(() => import('@/pages/ReportsPage').then(module => ({ default: module.ReportsPage })));
const AnalyticsPage = React.lazy(() => import('@/pages/AnalyticsPage').then(module => ({ default: module.AnalyticsPage })));
const MISDashboardPage = React.lazy(() => import('@/pages/MISDashboardPage').then(module => ({ default: module.MISDashboardPage })));
const BillingPage = React.lazy(() => import('@/pages/BillingPage').then(module => ({ default: module.BillingPage })));
const CommissionManagementPage = React.lazy(() => import('@/pages/CommissionManagementPage').then(module => ({ default: module.CommissionManagementPage })));
const CommissionsPage = React.lazy(() => import('@/pages/CommissionsPage').then(module => ({ default: module.CommissionsPage })));
const LocationsPage = React.lazy(() => import('@/pages/LocationsPage').then(module => ({ default: module.LocationsPage })));
const FormViewerPage = React.lazy(() => import('@/pages/FormViewerPage').then(module => ({ default: module.FormViewerPage })));
const SecurityUXPage = React.lazy(() => import('@/pages/SecurityUXPage').then(module => ({ default: module.SecurityUXPage })));
const SettingsPage = React.lazy(() => import('@/pages/SettingsPage').then(module => ({ default: module.SettingsPage })));
const ProductsPage = React.lazy(() => import('@/pages/ProductsPage').then(module => ({ default: module.ProductsPage })));
const VerificationTypesPage = React.lazy(() => import('@/pages/VerificationTypesPage').then(module => ({ default: module.VerificationTypesPage })));
const DocumentTypesPage = React.lazy(() => import('@/pages/DocumentTypesPage').then(module => ({ default: module.DocumentTypesPage })));

const RateManagementPage = React.lazy(() => import('@/pages/RateManagementPage').then(module => ({ default: module.RateManagementPage })));
const DedupePage = React.lazy(() => import('@/pages/DedupePage').then(module => ({ default: module.DedupePage })));




// Default route component that handles authentication-based redirects
const DefaultRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { isMobile, isTouchDevice } = useResponsive();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
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
    <React.Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
      </div>
    }>
      <Routes>
        {/* ... routes ... */}
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* ... rest of the routes remain same but lazy loaded components need Suspense up the tree or here ... */}
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
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <Layout>
                <CasesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cases/:id"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <Layout>
                <CaseDetailPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cases/:id/edit"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <Layout>
                <EditCasePage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks/pending"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <Layout>
                <PendingTasksPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/tasks/revoked"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <Layout>
                <RevokedTasksPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/tasks/in-progress"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <Layout>
                <InProgressTasksPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/tasks/completed"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <Layout>
                <CompletedTasksPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/tasks/revisit"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <Layout>
                <RevisitTasksPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/cases/completed"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <Layout>
                <CompletedCasesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cases/new"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <Layout>
                <NewCasePage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Task Management Routes */}
        <Route
          path="/tasks"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <Layout>
                <AllTasksPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks/:taskId"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <Layout>
                <TaskDetailPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/verification-tasks/:taskId"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <Layout>
                <TaskDetailPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* TAT Monitoring Route */}
        <Route
          path="/case-management/tat-monitoring"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <PermissionProtectedRoute resource="tasks" action="read">
                <Layout>
                  <TATMonitoringPage />
                </Layout>
              </PermissionProtectedRoute>
            </ProtectedRoute>
          }
        />

        {/* Dedupe Route */}
        <Route
          path="/case-management/dedupe"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <PermissionProtectedRoute resource="cases" action="read">
                <Layout>
                  <DedupePage />
                </Layout>
              </PermissionProtectedRoute>
            </ProtectedRoute>
          }
        />

        {/* Clients routes */}
        <Route
          path="/clients"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
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
              <PermissionProtectedRoute resource="products" action="read">
                <Layout>
                  <ProductsPage />
                </Layout>
              </PermissionProtectedRoute>
            </ProtectedRoute>
          }
        />

        {/* Verification Types routes */}
        <Route
          path="/verification-types"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
              <PermissionProtectedRoute resource="verification_types" action="read">
                <Layout>
                  <VerificationTypesPage />
                </Layout>
              </PermissionProtectedRoute>
            </ProtectedRoute>
          }
        />

        {/* Document Types routes */}
        <Route
          path="/document-types"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
              <PermissionProtectedRoute resource="document_types" action="read">
                <Layout>
                  <DocumentTypesPage />
                </Layout>
              </PermissionProtectedRoute>
            </ProtectedRoute>
          }
        />

        {/* Rate Management routes */}
        <Route
          path="/rate-management"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
              <PermissionProtectedRoute resource="rate_management" action="read">
                <Layout>
                  <RateManagementPage />
                </Layout>
              </PermissionProtectedRoute>
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
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
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
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <PermissionProtectedRoute resource="analytics" action="read">
                <Layout>
                  <AnalyticsPage />
                </Layout>
              </PermissionProtectedRoute>
            </ProtectedRoute>
          }
        />

        {/* MIS Dashboard route */}
        <Route
          path="/reports/mis"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <PermissionProtectedRoute resource="analytics" action="read">
                <Layout>
                  <MISDashboardPage />
                </Layout>
              </PermissionProtectedRoute>
            </ProtectedRoute>
          }
        />

        {/* Additional feature routes */}
        <Route
          path="/billing"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <PermissionProtectedRoute resource="billing" action="read">
                <Layout>
                  <BillingPage />
                </Layout>
              </PermissionProtectedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/commissions"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <PermissionProtectedRoute resource="commissions" action="read">
                <Layout>
                  <CommissionsPage />
                </Layout>
              </PermissionProtectedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/commission-management"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <PermissionProtectedRoute resource="commissions" action="read">
                <Layout>
                  <CommissionManagementPage />
                </Layout>
              </PermissionProtectedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/forms"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}>
              <PermissionProtectedRoute resource="forms" action="read">
                <Layout>
                  <FormViewerPage />
                </Layout>
              </PermissionProtectedRoute>
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
    </React.Suspense>
  );
};
