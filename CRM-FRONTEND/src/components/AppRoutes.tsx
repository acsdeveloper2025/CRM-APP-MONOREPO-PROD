import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
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

// Layout wrapper that persists across routes
const AuthenticatedLayout = () => {
  return (
    <ProtectedRoute>
      <Layout>
        <Outlet />
      </Layout>
    </ProtectedRoute>
  );
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

        {/* Protected routes with persistent layout */}
        <Route element={<AuthenticatedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          
          {/* Cases routes */}
          <Route element={<ProtectedRoute requiredRoles={['ADMIN', 'BACKEND_USER', 'SUPER_ADMIN']}><Outlet /></ProtectedRoute>}>
            <Route path="/cases" element={<CasesPage />} />
            <Route path="/cases/:id" element={<CaseDetailPage />} />
            <Route path="/cases/:id/edit" element={<EditCasePage />} />
            <Route path="/tasks/pending" element={<PendingTasksPage />} />
            <Route path="/tasks/revoked" element={<RevokedTasksPage />} />
            <Route path="/tasks/in-progress" element={<InProgressTasksPage />} />
            <Route path="/tasks/completed" element={<CompletedTasksPage />} />
            <Route path="/tasks/revisit" element={<RevisitTasksPage />} />
            <Route path="/cases/completed" element={<CompletedCasesPage />} />
            <Route path="/cases/new" element={<NewCasePage />} />
            
            {/* Task Management Routes */}
            <Route path="/tasks" element={<AllTasksPage />} />
            <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
            <Route path="/verification-tasks/:taskId" element={<TaskDetailPage />} />
            
            {/* TAT Monitoring Route */}
            <Route path="/tasks/tat-monitoring" element={
              <PermissionProtectedRoute resource="tasks" action="read">
                <TATMonitoringPage />
              </PermissionProtectedRoute>
            } />
            
            {/* Dedupe Route */}
            <Route path="/case-management/dedupe" element={
              <PermissionProtectedRoute resource="cases" action="read">
                <DedupePage />
              </PermissionProtectedRoute>
            } />
            
            {/* Clients routes */}
            <Route path="/clients" element={<ClientsPage />} />
            
            {/* Reports routes */}
            <Route path="/reports" element={<ReportsPage />} />
            
            {/* Analytics routes */}
            <Route path="/analytics" element={
              <PermissionProtectedRoute resource="analytics" action="read">
                <AnalyticsPage />
              </PermissionProtectedRoute>
            } />
            
            {/* MIS Dashboard route */}
            <Route path="/reports/mis" element={
              <PermissionProtectedRoute resource="analytics" action="read">
                <MISDashboardPage />
              </PermissionProtectedRoute>
            } />
            
            {/* Additional feature routes */}
            <Route path="/billing" element={
              <PermissionProtectedRoute resource="billing" action="read">
                <BillingPage />
              </PermissionProtectedRoute>
            } />
            <Route path="/commissions" element={
              <PermissionProtectedRoute resource="commissions" action="read">
                <CommissionsPage />
              </PermissionProtectedRoute>
            } />
            <Route path="/commission-management" element={
              <PermissionProtectedRoute resource="commissions" action="read">
                <CommissionManagementPage />
              </PermissionProtectedRoute>
            } />
            <Route path="/forms" element={
              <PermissionProtectedRoute resource="forms" action="read">
                <FormViewerPage />
              </PermissionProtectedRoute>
            } />
          </Route>

          {/* Admin routes with stricter roles */}
          <Route element={<ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}><Outlet /></ProtectedRoute>}>
            <Route path="/products" element={
              <PermissionProtectedRoute resource="products" action="read">
                <ProductsPage />
              </PermissionProtectedRoute>
            } />
            <Route path="/verification-types" element={
              <PermissionProtectedRoute resource="verification_types" action="read">
                <VerificationTypesPage />
              </PermissionProtectedRoute>
            } />
            <Route path="/document-types" element={
              <PermissionProtectedRoute resource="document_types" action="read">
                <DocumentTypesPage />
              </PermissionProtectedRoute>
            } />
            <Route path="/rate-management" element={
              <PermissionProtectedRoute resource="rate_management" action="read">
                <RateManagementPage />
              </PermissionProtectedRoute>
            } />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/:userId/permissions" element={<UserPermissionsPage />} />
            <Route path="/role-management" element={
              <PermissionProtectedRoute resource="roles" action="read">
                <RoleManagementPage />
              </PermissionProtectedRoute>
            } />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/security-ux" element={<SecurityUXPage />} />
          </Route>

          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Default routes */}
        <Route path="/" element={<DefaultRoute />} />
        <Route path="*" element={<DefaultRoute />} />
      </Routes>
    </React.Suspense>
  );
};
