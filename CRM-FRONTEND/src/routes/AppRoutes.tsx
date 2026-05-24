import React from 'react';
import { Routes, Route, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PolicyAcceptanceGuard } from '@/components/PolicyAcceptanceGuard';
import { Layout } from '@/components/layout/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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
const InProgressCasesPage = React.lazy(() =>
  import('@/pages/InProgressCasesPage').then((module) => ({ default: module.InProgressCasesPage }))
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
const UserActivityPage = React.lazy(() =>
  import('@/pages/UserActivityPage').then((module) => ({ default: module.UserActivityPage }))
);
const UserSessionsPage = React.lazy(() =>
  import('@/pages/UserSessionsPage').then((module) => ({ default: module.UserSessionsPage }))
);
const UserPermissionsPage = React.lazy(() =>
  import('@/pages/UserPermissionsPage').then((module) => ({ default: module.UserPermissionsPage }))
);
// Default export needs special handling or ensure it's exported as named too. Assuming named for consistency or default logic.
const RBACAdminPage = React.lazy(() =>
  import('@/pages/RBACAdminPage').then((module) => ({ default: module.RBACAdminPage }))
);
const DepartmentsPage = React.lazy(() =>
  import('@/pages/DepartmentsPage').then((module) => ({ default: module.DepartmentsPage }))
);
const UnauthorizedPage = React.lazy(() =>
  import('@/pages/UnauthorizedPage').then((module) => ({ default: module.UnauthorizedPage }))
);
const NotificationHistoryPage = React.lazy(() =>
  import('@/pages/NotificationHistoryPage').then((module) => ({
    default: module.NotificationHistoryPage,
  }))
);
const ProfilePage = React.lazy(() => import('@/pages/ProfilePage'));
const AcceptPolicyPage = React.lazy(() => import('@/pages/AcceptPolicyPage'));
const ReportsPage = React.lazy(() =>
  import('@/pages/ReportsPage').then((module) => ({ default: module.ReportsPage }))
);
const AnalyticsOverviewPage = React.lazy(() =>
  import('@/pages/analytics/AnalyticsOverviewPage').then((module) => ({
    default: module.AnalyticsOverviewPage,
  }))
);
const AnalyticsCasesPage = React.lazy(() =>
  import('@/pages/analytics/AnalyticsCasesPage').then((module) => ({
    default: module.AnalyticsCasesPage,
  }))
);
const AnalyticsTasksPage = React.lazy(() =>
  import('@/pages/analytics/AnalyticsTasksPage').then((module) => ({
    default: module.AnalyticsTasksPage,
  }))
);
const AnalyticsAgentsPage = React.lazy(() =>
  import('@/pages/analytics/AnalyticsAgentsPage').then((module) => ({
    default: module.AnalyticsAgentsPage,
  }))
);
const MISDashboardPage = React.lazy(() =>
  import('@/pages/MISDashboardPage').then((module) => ({ default: module.MISDashboardPage }))
);
const InvoicesPage = React.lazy(() =>
  import('@/pages/InvoicesPage').then((module) => ({ default: module.InvoicesPage }))
);
const CommissionManagementPage = React.lazy(() =>
  import('@/pages/CommissionManagementPage').then((module) => ({
    default: module.CommissionManagementPage,
  }))
);
const CommissionCalculationsPage = React.lazy(() =>
  import('@/pages/billing/CommissionCalculationsPage').then((module) => ({
    default: module.CommissionCalculationsPage,
  }))
);
const CommissionStatisticsPage = React.lazy(() =>
  import('@/pages/billing/CommissionStatisticsPage').then((module) => ({
    default: module.CommissionStatisticsPage,
  }))
);
const CountriesPage = React.lazy(() =>
  import('@/pages/CountriesPage').then((module) => ({ default: module.CountriesPage }))
);
const StatesPage = React.lazy(() =>
  import('@/pages/StatesPage').then((module) => ({ default: module.StatesPage }))
);
const CitiesPage = React.lazy(() =>
  import('@/pages/CitiesPage').then((module) => ({ default: module.CitiesPage }))
);
const PincodesPage = React.lazy(() =>
  import('@/pages/PincodesPage').then((module) => ({ default: module.PincodesPage }))
);
const AreasPage = React.lazy(() =>
  import('@/pages/AreasPage').then((module) => ({ default: module.AreasPage }))
);
// FormViewerPage removed — route was unused (RBAC audit 2026-04-16)
const SystemHealthPage = React.lazy(() =>
  import('@/pages/SystemHealthPage').then((module) => ({ default: module.SystemHealthPage }))
);
// SettingsPage retired (T0 audit 2026-05-18) — Notifications folded into
// /profile/notifications; Profile/Security tabs duplicated ProfilePage;
// Preferences/Admin tabs were dead. Bookmarks redirected below.
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

const RateTypesPage = React.lazy(() =>
  import('@/pages/RateTypesPage').then((module) => ({ default: module.RateTypesPage }))
);
const RateTypeAssignmentPage = React.lazy(() =>
  import('@/pages/RateTypeAssignmentPage').then((module) => ({
    default: module.RateTypeAssignmentPage,
  }))
);
const RateAmountsPage = React.lazy(() =>
  import('@/pages/RateAmountsPage').then((module) => ({ default: module.RateAmountsPage }))
);
const ServiceZoneRulesPage = React.lazy(() =>
  import('@/pages/ServiceZoneRulesPage').then((module) => ({
    default: module.ServiceZoneRulesPage,
  }))
);
const KYCRatesPage = React.lazy(() =>
  import('@/pages/KYCRatesPage').then((module) => ({ default: module.KYCRatesPage }))
);
const RateReportPage = React.lazy(() =>
  import('@/pages/RateReportPage').then((module) => ({ default: module.RateReportPage }))
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
    { permission: 'page.field_monitoring', path: '/operations/field-monitoring' },
    { permission: 'page.rbac', path: '/user-management/rbac-administration' },
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
// Phase D Option B (2026-05-17): wraps Outlet with PolicyAcceptanceGuard
// so every protected route requires a current-version policy acceptance.
// /accept-policy is mounted OUTSIDE this layout to break the redirect loop.
//
// T1-13 (audit 2026-05-17): per-route ErrorBoundary so a render crash
// inside one page does not blank the entire shell. Keyed on the URL
// pathname so navigating to a different route remounts the boundary
// (clears any error state from the previous page).
const AuthenticatedLayout = () => {
  const location = useLocation();
  return (
    <ProtectedRoute>
      <Layout>
        <PolicyAcceptanceGuard>
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </PolicyAcceptanceGuard>
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

        {/* Phase D Option B (2026-05-17): hard policy gate. Sits OUTSIDE
            AuthenticatedLayout so PolicyAcceptanceGuard's redirect does
            not loop. Still requires auth via the page's own check. */}
        <Route path="/accept-policy" element={<AcceptPolicyPage />} />

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
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/:tab"
            element={
              <ProtectedRoute>
                <ProfilePage />
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
            path="/case-management/in-progress"
            element={
              <ProtectedRoute permission="page.cases">
                <InProgressCasesPage />
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
            path="/dedupe"
            element={
              <ProtectedRoute permission="page.cases">
                <DedupePage />
              </ProtectedRoute>
            }
          />
          <Route path="/case-management/dedupe" element={<Navigate to="/dedupe" replace />} />

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
          {/* Rate Management — 6 standalone sub-pages. Parent /rate-management
              redirects to the first child (matches Client Mgmt pattern after
              the 2026-05-22 tab strip; see project_filter_standardization_2026_05_22.md). */}
          <Route
            path="/rate-management"
            element={<Navigate to="/rate-management/rate-types" replace />}
          />
          <Route
            path="/rate-management/rate-types"
            element={
              <ProtectedRoute permission="page.masterdata">
                <RateTypesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rate-management/rate-type-assignment"
            element={
              <ProtectedRoute permission="page.masterdata">
                <RateTypeAssignmentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rate-management/rate-amounts"
            element={
              <ProtectedRoute permission="page.masterdata">
                <RateAmountsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rate-management/service-zone-rules"
            element={
              <ProtectedRoute permission="page.masterdata">
                <ServiceZoneRulesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rate-management/kyc-rates"
            element={
              <ProtectedRoute permission="page.masterdata">
                <KYCRatesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rate-management/rate-report"
            element={
              <ProtectedRoute permission="page.masterdata">
                <RateReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/location-management"
            element={<Navigate to="/location-management/countries" replace />}
          />
          <Route
            path="/location-management/countries"
            element={
              <ProtectedRoute permission="page.masterdata">
                <CountriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/location-management/states"
            element={
              <ProtectedRoute permission="page.masterdata">
                <StatesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/location-management/cities"
            element={
              <ProtectedRoute permission="page.masterdata">
                <CitiesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/location-management/pincodes"
            element={
              <ProtectedRoute permission="page.masterdata">
                <PincodesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/location-management/areas"
            element={
              <ProtectedRoute permission="page.masterdata">
                <AreasPage />
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
            element={<Navigate to="/reports-and-mis/analytics-dashboard/overview" replace />}
          />
          <Route
            path="/reports-and-mis/analytics-dashboard/overview"
            element={
              <ProtectedRoute permission="page.analytics">
                <AnalyticsOverviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports-and-mis/analytics-dashboard/cases"
            element={
              <ProtectedRoute permission="page.analytics">
                <AnalyticsCasesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports-and-mis/analytics-dashboard/tasks"
            element={
              <ProtectedRoute permission="page.analytics">
                <AnalyticsTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports-and-mis/analytics-dashboard/agents"
            element={
              <ProtectedRoute permission="page.analytics">
                <AnalyticsAgentsPage />
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
            element={<Navigate to="/billing-and-commission/invoices" replace />}
          />
          <Route
            path="/billing-and-commission/invoices"
            element={
              <ProtectedRoute permission="page.billing">
                <InvoicesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing-and-commission/commissions"
            element={<Navigate to="/billing-and-commission/commissions/calculations" replace />}
          />
          <Route
            path="/billing-and-commission/commissions/calculations"
            element={
              <ProtectedRoute permission="page.billing">
                <CommissionCalculationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing-and-commission/commissions/statistics"
            element={
              <ProtectedRoute permission="page.billing">
                <CommissionStatisticsPage />
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
            path="/user-management"
            element={<Navigate to="/user-management/users" replace />}
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
            path="/user-management/user-activity"
            element={
              <ProtectedRoute permission="page.users">
                <UserActivityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/user-sessions"
            element={
              <ProtectedRoute permission="page.users">
                <UserSessionsPage />
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
            path="/operations/field-monitoring"
            element={
              <ProtectedRoute permission="page.field_monitoring">
                <FieldMonitoringPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/operations/field-monitoring/:userId"
            element={
              <ProtectedRoute permission="page.field_monitoring">
                <FieldMonitoringPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management/departments"
            element={
              <ProtectedRoute permission="page.users">
                <DepartmentsPage />
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
            path="/admin/system-health"
            element={
              <ProtectedRoute permission="system.health">
                <SystemHealthPage />
              </ProtectedRoute>
            }
          />
          {/* /settings retired (T0 audit 2026-05-18). Notifications moved
              to /profile/notifications. Redirect preserves bookmarks. */}
          <Route path="/settings" element={<Navigate to="/profile/notifications" replace />} />
          <Route path="/settings/*" element={<Navigate to="/profile/notifications" replace />} />
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
            path="/data-entry-management/data-entry"
            element={
              <ProtectedRoute permission="page.cases">
                <DataEntryDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/data-entry-management/data-entry-mis"
            element={
              <ProtectedRoute permission="page.cases">
                <DataEntryMISPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/case-management/data-entry"
            element={<Navigate to="/data-entry-management/data-entry" replace />}
          />
          <Route
            path="/case-management/data-entry-mis"
            element={<Navigate to="/data-entry-management/data-entry-mis" replace />}
          />
        </Route>

        {/* Default routes */}
        <Route path="/" element={<DefaultRoute />} />
        <Route path="*" element={<DefaultRoute />} />
      </Routes>
    </React.Suspense>
  );
};
