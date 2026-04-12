import React from 'react';
import { Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Layout } from '@/components/layout/Layout';

// Import all page components using React.lazy for code splitting
const LoginPage = React.lazy(() =>
  import('@/pages/LoginPage').then((module) => ({ default: module.LoginPage }))
);
const DashboardPage = React.lazy(() =>
  import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage }))
);
const CasesPage = React.lazy(() =>
  import('@/pages/CasesPage').then((module) => ({ default: module.CasesPage }))
);
const CaseDetailPage = React.lazy(() =>
  import('@/pages/CaseDetailPage').then((module) => ({ default: module.CaseDetailPage }))
);

// Unused imports removed
const CompletedCasesPage = React.lazy(() =>
  import('@/pages/CompletedCasesPage').then((module) => ({ default: module.CompletedCasesPage }))
);
const PendingTasksPage = React.lazy(() =>
  import('@/pages/PendingTasksPage').then((module) => ({ default: module.PendingTasksPage }))
);
const RevokedTasksPage = React.lazy(() =>
  import('@/pages/RevokedTasksPage').then((module) => ({ default: module.RevokedTasksPage }))
);
const InProgressTasksPage = React.lazy(() =>
  import('@/pages/InProgressTasksPage').then((module) => ({ default: module.InProgressTasksPage }))
);
const CompletedTasksPage = React.lazy(() =>
  import('@/pages/CompletedTasksPage').then((module) => ({ default: module.CompletedTasksPage }))
);
const AllTasksPage = React.lazy(() =>
  import('@/pages/AllTasksPage').then((module) => ({ default: module.AllTasksPage }))
);
const TaskDetailPage = React.lazy(() =>
  import('@/pages/TaskDetailPage').then((module) => ({ default: module.TaskDetailPage }))
);
const RevisitTasksPage = React.lazy(() =>
  import('@/pages/RevisitTasksPage').then((module) => ({ default: module.RevisitTasksPage }))
);
const TATMonitoringPage = React.lazy(() =>
  import('@/pages/TATMonitoringPage').then((module) => ({ default: module.TATMonitoringPage }))
);
const NewCasePage = React.lazy(() =>
  import('@/pages/NewCasePage').then((module) => ({ default: module.NewCasePage }))
);
const ClientsPage = React.lazy(() =>
  import('@/pages/ClientsPage').then((module) => ({ default: module.ClientsPage }))
);
const UsersPage = React.lazy(() =>
  import('@/pages/UsersPage').then((module) => ({ default: module.UsersPage }))
);
const UserPermissionsPage = React.lazy(() =>
  import('@/pages/UserPermissionsPage').then((module) => ({ default: module.UserPermissionsPage }))
);
// Default export needs special handling or ensure it's exported as named too. Assuming named for consistency or default logic.
const RBACAdminPage = React.lazy(() =>
  import('@/pages/RBACAdminPage').then((module) => ({ default: module.RBACAdminPage }))
);
const UnauthorizedPage = React.lazy(() =>
  import('@/pages/UnauthorizedPage').then((module) => ({ default: module.UnauthorizedPage }))
);
const NotificationHistoryPage = React.lazy(() =>
  import('@/pages/NotificationHistoryPage').then((module) => ({
    default: module.NotificationHistoryPage,
  }))
);
const ReportsPage = React.lazy(() =>
  import('@/pages/ReportsPage').then((module) => ({ default: module.ReportsPage }))
);
const AnalyticsPage = React.lazy(() =>
  import('@/pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage }))
);
const MISDashboardPage = React.lazy(() =>
  import('@/pages/MISDashboardPage').then((module) => ({ default: module.MISDashboardPage }))
);
const BillingPage = React.lazy(() =>
  import('@/pages/BillingPage').then((module) => ({ default: module.BillingPage }))
);
const CommissionManagementPage = React.lazy(() =>
  import('@/pages/CommissionManagementPage').then((module) => ({
    default: module.CommissionManagementPage,
  }))
);
const CommissionsPage = React.lazy(() =>
  import('@/pages/CommissionsPage').then((module) => ({ default: module.CommissionsPage }))
);
const LocationsPage = React.lazy(() =>
  import('@/pages/LocationsPage').then((module) => ({ default: module.LocationsPage }))
);
const FormViewerPage = React.lazy(() =>
  import('@/pages/FormViewerPage').then((module) => ({ default: module.FormViewerPage }))
);
const SecurityUXPage = React.lazy(() =>
  import('@/pages/SecurityUXPage').then((module) => ({ default: module.SecurityUXPage }))
);
const SettingsPage = React.lazy(() =>
  import('@/pages/SettingsPage').then((module) => ({ default: module.SettingsPage }))
);
const ProductsPage = React.lazy(() =>
  import('@/pages/ProductsPage').then((module) => ({ default: module.ProductsPage }))
);
const VerificationTypesPage = React.lazy(() =>
  import('@/pages/VerificationTypesPage').then((module) => ({
    default: module.VerificationTypesPage,
  }))
);
const DocumentTypesPage = React.lazy(() =>
  import('@/pages/DocumentTypesPage').then((module) => ({ default: module.DocumentTypesPage }))
);
const FieldMonitoringPage = React.lazy(() =>
  import('@/pages/operations/FieldMonitoringPage').then((module) => ({
    default: module.FieldMonitoringPage,
  }))
);

const RateManagementPage = React.lazy(() =>
  import('@/pages/RateManagementPage').then((module) => ({ default: module.RateManagementPage }))
);
const DedupePage = React.lazy(() =>
  import('@/pages/DedupePage').then((module) => ({ default: module.DedupePage }))
);
// KYC pages restored as sidebar section with sub-pages.
const KYCDashboardPage = React.lazy(() =>
  import('@/pages/KYCDashboardPage').then((module) => ({ default: module.KYCDashboardPage }))
);
const KYCVerificationPage = React.lazy(() =>
  import('@/pages/KYCVerificationPage').then((module) => ({ default: module.KYCVerificationPage }))
);

const resolveFirstAccessibleRoute = (permissionSet: Set<string>): string => {
  const candidates: Array<{ permission: string; path: string }> = [
    { permission: 'page.dashboard', path: '/dashboard' },
    { permission: 'page.cases', path: '/cases' },
    { permission: 'page.tasks', path: '/tasks' },
    { permission: 'page.reports', path: '/reports' },
    { permission: 'page.analytics', path: '/analytics' },
    { permission: 'page.billing', path: '/billing' },
    { permission: 'page.masterdata', path: '/clients' },
    { permission: 'page.users', path: '/users' },
    { permission: 'page.kyc', path: '/kyc' },
    { permission: 'page.fieldMonitoring', path: '/operations/field-monitoring' },
    { permission: 'page.rbac', path: '/admin/rbac' },
    { permission: 'page.settings', path: '/settings' },
  ];

  const accessible = candidates.find((candidate) => permissionSet.has(candidate.permission));
  return accessible?.path || '/unauthorized';
};

// Default route component that handles authentication-based redirects
const DefaultRoute: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const rawPermissions = Array.isArray(user?.permissions)
    ? user.permissions
    : Array.isArray(user?.permissionCodes)
      ? user.permissionCodes
      : [];
  const permissionSet = new Set(rawPermissions.map((permission) => String(permission)));

  const target = resolveFirstAccessibleRoute(permissionSet);

  // Redirect to the first accessible web module
  return <Navigate to={target} replace />;
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

const LegacyCaseEditRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const target = id ? `/cases/new?edit=${encodeURIComponent(id)}` : '/cases/new';
  return <Navigate to={target} replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
        </div>
      }
    >
      <Routes>
        {/* ... routes ... */}
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* ... rest of the routes remain same but lazy loaded components need Suspense up the tree or here ... */}
        {/* Protected routes with persistent layout */}
        <Route element={<AuthenticatedLayout />}>
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute permission="page.dashboard">
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Page access routes (page.* permissions only) */}
          <Route
            path="/cases"
            element={
              <ProtectedRoute permission="page.cases">
                <CasesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:id"
            element={
              <ProtectedRoute permission="page.cases">
                <CaseDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:id/edit"
            element={
              <ProtectedRoute permission="page.cases">
                <LegacyCaseEditRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/completed"
            element={
              <ProtectedRoute permission="page.cases">
                <CompletedCasesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/new"
            element={
              <ProtectedRoute permission="page.cases">
                <NewCasePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/case-management/dedupe"
            element={
              <ProtectedRoute permission="page.cases">
                <DedupePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/tasks"
            element={
              <ProtectedRoute permission="page.tasks">
                <AllTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/:taskId"
            element={
              <ProtectedRoute permission="page.tasks">
                <TaskDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/verification-tasks/:taskId"
            element={
              <ProtectedRoute permission="page.tasks">
                <TaskDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/pending"
            element={
              <ProtectedRoute permission="page.tasks">
                <PendingTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/revoked"
            element={
              <ProtectedRoute permission="page.tasks">
                <RevokedTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/in-progress"
            element={
              <ProtectedRoute permission="page.tasks">
                <InProgressTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/completed"
            element={
              <ProtectedRoute permission="page.tasks">
                <CompletedTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/revisit"
            element={
              <ProtectedRoute permission="page.tasks">
                <RevisitTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/tat-monitoring"
            element={
              <ProtectedRoute permission="page.tasks">
                <TATMonitoringPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/forms"
            element={
              <ProtectedRoute permission="page.tasks">
                <FormViewerPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/clients"
            element={
              <ProtectedRoute permission="page.masterdata">
                <ClientsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/products"
            element={
              <ProtectedRoute permission="page.masterdata">
                <ProductsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/verification-types"
            element={
              <ProtectedRoute permission="page.masterdata">
                <VerificationTypesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/document-types"
            element={
              <ProtectedRoute permission="page.masterdata">
                <DocumentTypesPage />
              </ProtectedRoute>
            }
          />
          {/* Rate Management — top-level section with sub-routes per tab */}
          <Route
            path="/rate-management"
            element={
              <ProtectedRoute permission="page.masterdata">
                <RateManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rate-management/rate-types"
            element={
              <ProtectedRoute permission="page.masterdata">
                <RateManagementPage defaultTab="rate-types" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rate-management/service-zones"
            element={
              <ProtectedRoute permission="page.masterdata">
                <RateManagementPage defaultTab="service-zone-rules" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rate-management/assignments"
            element={
              <ProtectedRoute permission="page.masterdata">
                <RateManagementPage defaultTab="rate-type-assignment" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rate-management/document-rates"
            element={
              <ProtectedRoute permission="page.masterdata">
                <RateManagementPage defaultTab="document-type-rates" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/locations"
            element={
              <ProtectedRoute permission="page.masterdata">
                <LocationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/locations/:tab"
            element={
              <ProtectedRoute permission="page.masterdata">
                <LocationsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute permission="page.reports">
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute permission="page.analytics">
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/mis"
            element={
              <ProtectedRoute permission="page.analytics">
                <MISDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/billing"
            element={
              <ProtectedRoute permission="page.billing">
                <BillingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices"
            element={
              <ProtectedRoute permission="page.billing">
                <BillingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissions"
            element={
              <ProtectedRoute permission="page.billing">
                <CommissionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commission-management"
            element={
              <ProtectedRoute permission="page.billing">
                <CommissionManagementPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute permission="page.users">
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users/:tab"
            element={
              <ProtectedRoute permission="page.users">
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users/:userId/permissions"
            element={
              <ProtectedRoute permission="page.users">
                <UserPermissionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/operations/field-monitoring"
            element={
              <ProtectedRoute permission="page.fieldMonitoring">
                <FieldMonitoringPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/operations/field-monitoring/:userId"
            element={
              <ProtectedRoute permission="page.fieldMonitoring">
                <FieldMonitoringPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/rbac"
            element={
              <ProtectedRoute permission="page.rbac">
                <RBACAdminPage />
              </ProtectedRoute>
            }
          />

          {/* KYC Verification routes — sidebar sub-pages */}
          <Route
            path="/kyc"
            element={
              <ProtectedRoute permission="page.kyc">
                <KYCDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kyc/pending"
            element={
              <ProtectedRoute permission="page.kyc">
                <KYCDashboardPage
                  defaultStatus="PENDING"
                  pageTitle="Pending KYC Verification"
                  pageSubtitle="KYC documents awaiting verification"
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kyc/completed"
            element={
              <ProtectedRoute permission="page.kyc">
                <KYCDashboardPage
                  defaultStatus="COMPLETED"
                  pageTitle="Completed KYC Verification"
                  pageSubtitle="KYC documents that have been verified (Passed, Failed, or Referred)"
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kyc/verify/:taskId"
            element={
              <ProtectedRoute permission="page.kyc">
                <KYCVerificationPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/security-ux"
            element={
              <ProtectedRoute permission="page.settings">
                <SecurityUXPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute permission="page.settings">
                <SettingsPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Default routes */}
        <Route path="/" element={<DefaultRoute />} />
        <Route path="*" element={<DefaultRoute />} />
      </Routes>
    </React.Suspense>
  );
};
