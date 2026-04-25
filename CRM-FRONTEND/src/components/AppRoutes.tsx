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
// FormViewerPage removed — route was unused (RBAC audit 2026-04-16)
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
const CaseDataTemplatesPage = React.lazy(() =>
  import('@/pages/CaseDataTemplatesPage').then((module) => ({
    default: module.CaseDataTemplatesPage,
  }))
);
const ReportTemplatesPage = React.lazy(() =>
  import('@/pages/ReportTemplatesPage').then((module) => ({
    default: module.ReportTemplatesPage,
  }))
);
const DataEntryDashboardPage = React.lazy(() =>
  import('@/pages/DataEntryDashboardPage').then((module) => ({
    default: module.DataEntryDashboardPage,
  }))
);
const DataEntryMISPage = React.lazy(() =>
  import('@/pages/DataEntryMISPage').then((module) => ({
    default: module.DataEntryMISPage,
  }))
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
    { permission: 'page.cases', path: '/case-management/all-cases' },
    { permission: 'page.tasks', path: '/task-management/all-tasks' },
    { permission: 'page.reports', path: '/reports-and-mis' },
    { permission: 'page.analytics', path: '/reports-and-mis/analytics-dashboard' },
    { permission: 'page.billing', path: '/billing-and-commission' },
    { permission: 'page.masterdata', path: '/client-management/clients' },
    { permission: 'page.users', path: '/user-management/users' },
    { permission: 'page.kyc', path: '/kyc-verification/all-kyc' },
    { permission: 'page.field_monitoring', path: '/user-management/field-monitoring' },
    { permission: 'page.rbac', path: '/user-management/rbac-administration' },
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
  const target = id
    ? `/case-management/create-new-case?edit=${encodeURIComponent(id)}`
    : '/case-management/create-new-case';
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
            path="/case-management/all-cases"
            element={
              <ProtectedRoute permission="page.cases">
                <CasesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/case-management/:id"
            element={
              <ProtectedRoute permission="page.cases">
                <CaseDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/case-management/:id/edit"
            element={
              <ProtectedRoute permission="page.cases">
                <LegacyCaseEditRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/case-management/completed"
            element={
              <ProtectedRoute permission="page.cases">
                <CompletedCasesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/case-management/create-new-case"
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
            path="/task-management/all-tasks"
            element={
              <ProtectedRoute permission="page.tasks">
                <AllTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/task-management/:taskId"
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
            path="/task-management/pending-tasks"
            element={
              <ProtectedRoute permission="page.tasks">
                <PendingTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/task-management/revoke-tasks"
            element={
              <ProtectedRoute permission="page.tasks">
                <RevokedTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/task-management/in-progress-tasks"
            element={
              <ProtectedRoute permission="page.tasks">
                <InProgressTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/task-management/completed-tasks"
            element={
              <ProtectedRoute permission="page.tasks">
                <CompletedTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/task-management/revisit-tasks"
            element={
              <ProtectedRoute permission="page.tasks">
                <RevisitTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/task-management/tat-monitoring"
            element={
              <ProtectedRoute permission="page.tasks">
                <TATMonitoringPage />
              </ProtectedRoute>
            }
          />
          {/* /forms route removed — FormViewerPage was unused (RBAC audit 2026-04-16) */}

          <Route
            path="/client-management/clients"
            element={
              <ProtectedRoute permission="page.masterdata">
                <ClientsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client-management/products"
            element={
              <ProtectedRoute permission="page.masterdata">
                <ProductsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client-management/verification-types"
            element={
              <ProtectedRoute permission="page.masterdata">
                <VerificationTypesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client-management/document-types"
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
            path="/rate-management/service-zone-rules"
            element={
              <ProtectedRoute permission="page.masterdata">
                <RateManagementPage defaultTab="service-zone-rules" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rate-management/rate-type-assignment"
            element={
              <ProtectedRoute permission="page.masterdata">
                <RateManagementPage defaultTab="rate-type-assignment" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rate-management/rate-amounts"
            element={
              <ProtectedRoute permission="page.masterdata">
                <RateManagementPage defaultTab="rate-assignment" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rate-management/rate-report"
            element={
              <ProtectedRoute permission="page.masterdata">
                <RateManagementPage defaultTab="rate-view-report" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rate-management/kyc-rates"
            element={
              <ProtectedRoute permission="page.masterdata">
                <RateManagementPage defaultTab="document-type-rates" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/location-management"
            element={
              <ProtectedRoute permission="page.masterdata">
                <LocationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/location-management/:tab"
            element={
              <ProtectedRoute permission="page.masterdata">
                <LocationsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports-and-mis"
            element={
              <ProtectedRoute permission="page.reports">
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports-and-mis/analytics-dashboard"
            element={
              <ProtectedRoute permission="page.analytics">
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports-and-mis/mis-dashboard"
            element={
              <ProtectedRoute permission="page.analytics">
                <MISDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/billing-and-commission"
            element={
              <ProtectedRoute permission="page.billing">
                <BillingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing-and-commission/invoices"
            element={
              <ProtectedRoute permission="page.billing">
                <BillingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing-and-commission/commissions"
            element={
              <ProtectedRoute permission="page.billing">
                <CommissionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing-and-commission/commission-management"
            element={
              <ProtectedRoute permission="page.billing">
                <CommissionManagementPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/user-management/users"
            element={
              <ProtectedRoute permission="page.users">
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/:tab"
            element={
              <ProtectedRoute permission="page.users">
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/:userId/permissions"
            element={
              <ProtectedRoute permission="page.users">
                <UserPermissionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/field-monitoring"
            element={
              <ProtectedRoute permission="page.field_monitoring">
                <FieldMonitoringPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/field-monitoring/:userId"
            element={
              <ProtectedRoute permission="page.field_monitoring">
                <FieldMonitoringPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/rbac-administration"
            element={
              <ProtectedRoute permission="page.rbac">
                <RBACAdminPage />
              </ProtectedRoute>
            }
          />

          {/* KYC Verification routes — sidebar sub-pages */}
          <Route
            path="/kyc-verification/all-kyc"
            element={
              <ProtectedRoute permission="page.kyc">
                <KYCDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kyc-verification/pending-kyc"
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
            path="/kyc-verification/completed-kyc"
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
            path="/kyc-verification/verify/:taskId"
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
          <Route
            path="/client-management/data-entry-templates"
            element={
              <ProtectedRoute permission="page.settings">
                <CaseDataTemplatesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client-management/report-templates"
            element={
              <ProtectedRoute permission="report_template.manage">
                <ReportTemplatesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/case-management/data-entry"
            element={
              <ProtectedRoute permission="page.cases">
                <DataEntryDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/case-management/data-entry-mis"
            element={
              <ProtectedRoute permission="page.cases">
                <DataEntryMISPage />
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
