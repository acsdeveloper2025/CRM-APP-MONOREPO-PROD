/**
 * Lazy Import Utilities
 * 
 * Provides utilities for code splitting and lazy loading components
 * to optimize bundle size and improve performance.
 */

import { lazy, ComponentType, LazyExoticComponent } from 'react';

// ==================== Lazy Loading Utilities ====================

/**
 * Enhanced lazy loading with error boundary and loading states
 */
export function createLazyComponent<T extends ComponentType<Record<string, unknown>>>(
  importFn: () => Promise<{ default: T }>,
  displayName?: string
): LazyExoticComponent<T> {
  const LazyComponent = lazy(importFn);
  
  if (displayName) {
        (LazyComponent as unknown).displayName = displayName;
  }
  
  return LazyComponent;
}

/**
 * Preload a lazy component
 */
export function preloadComponent<T extends ComponentType<Record<string, unknown>>>(
  lazyComponent: LazyExoticComponent<T>
): void {
  // Access the _payload to trigger preloading
    const payload = (lazyComponent as unknown)._payload;
  if (payload && typeof payload._result === 'undefined') {
    payload._result = payload._init(payload._payload);
  }
}

/**
 * Create a lazy component with preloading capability
 */
export function createPreloadableLazyComponent<T extends ComponentType<Record<string, unknown>>>(
  importFn: () => Promise<{ default: T }>,
  displayName?: string
) {
  const LazyComponent = createLazyComponent(importFn, displayName);
  
  return {
    Component: LazyComponent,
    preload: () => preloadComponent(LazyComponent),
  };
}

// ==================== Page Components (Lazy Loaded) ====================

// Dashboard Pages
export const DashboardPage = createLazyComponent(
  () => import('@/pages/DashboardPage').then(module => ({ default: module.DashboardPage })),
  'DashboardPage'
);

export const AnalyticsPage = createLazyComponent(
  () => import('@/pages/AnalyticsPage').then(module => ({ default: module.AnalyticsPage })),
  'AnalyticsPage'
);

// Case Management Pages
// Case Management Pages
export const CasesListPage = createLazyComponent(
  () => import('@/pages/CasesPage').then(module => ({ default: module.CasesPage })),
  'CasesListPage'
);

export const CaseDetailPage = createLazyComponent(
  () => import('@/pages/CaseDetailPage').then(module => ({ default: module.CaseDetailPage })), 
  'CaseDetailPage'
);

export const CreateCasePage = createLazyComponent(
  () => import('@/pages/NewCasePage').then(module => ({ default: module.NewCasePage })),
  'CreateCasePage'
);

// User Management Pages
export const UsersListPage = createLazyComponent(
  () => import('@/pages/UsersPage').then(module => ({ default: module.UsersPage })),
  'UsersListPage'
);

/*
export const UserDetailPage = createLazyComponent(
  () => import('@/pages/users/UserDetailPage'),
  'UserDetailPage'
);
*/

/*
export const CreateUserPage = createLazyComponent(
  () => import('@/pages/users/CreateUserPage'),
  'CreateUserPage'
);
*/

/*
export const EditUserPage = createLazyComponent(
  () => import('@/pages/users/EditUserPage'),
  'EditUserPage'
);
*/

/*
export const UserProfilePage = createLazyComponent(
  () => import('@/pages/users/UserProfilePage'),
  'UserProfilePage'
);
*/

// Client Management Pages
export const ClientsListPage = createLazyComponent(
  () => import('@/pages/ClientsPage').then(module => ({ default: module.ClientsPage })),
  'ClientsListPage'
);

/*
export const ClientDetailPage = createLazyComponent(
  () => import('@/pages/clients/ClientDetailPage'),
  'ClientDetailPage'
);
*/

// Reports Pages
export const ReportsPage = createLazyComponent(
  () => import('@/pages/ReportsPage').then(module => ({ default: module.ReportsPage })),
  'ReportsPage'
);

/*
export const PerformanceReportPage = createLazyComponent(
  () => import('@/pages/reports/PerformanceReportPage'),
  'PerformanceReportPage'
);

export const FinancialReportPage = createLazyComponent(
  () => import('@/pages/reports/FinancialReportPage'),
  'FinancialReportPage'
);
*/

// Settings Pages
export const SettingsPage = createLazyComponent(
  () => import('@/pages/SettingsPage').then(module => ({ default: module.SettingsPage })),
  'SettingsPage'
);

export const RoleManagementPage = createLazyComponent(
  () => import('@/pages/RolePermissionsAdminPage').then(module => ({ default: module.RolePermissionsAdminPage })),
  'RolePermissionsAdminPage'
);

/*
export const SystemConfigPage = createLazyComponent(
  () => import('@/pages/settings/SystemConfigPage'),
  'SystemConfigPage'
);
*/

// Commission Management Pages
export const CommissionManagementPage = createLazyComponent(
  () => import('@/pages/CommissionManagementPage').then(module => ({ default: module.CommissionManagementPage })),
  'CommissionManagementPage'
);

export const RateManagementPage = createLazyComponent(
  () => import('@/pages/RateManagementPage').then(module => ({ default: module.RateManagementPage })),
  'RateManagementPage'
);

/*
export const TerritoryAssignmentPage = createLazyComponent(
  () => import('@/pages/commission/TerritoryAssignmentPage'),
  'TerritoryAssignmentPage'
);
*/

/*
// Form Components
export const FormViewer = createLazyComponent(
  () => import('@/components/forms/FormViewer').then(module => ({ default: module.FormViewer })),
  'FormViewer'
);

export const FormBuilder = createLazyComponent(
  () => import('@/components/forms/FormBuilder').then(module => ({ default: module.FormBuilder })),
  'FormBuilder'
);

// Chart Components
export const AdvancedChart = createLazyComponent(
  () => import('@/components/charts/AdvancedChart').then(module => ({ default: module.AdvancedChart })),
  'AdvancedChart'
);

export const DashboardCharts = createLazyComponent(
  () => import('@/components/dashboard/DashboardCharts').then(module => ({ default: module.DashboardCharts })),
  'DashboardCharts'
);

// Data Table Components
export const AdvancedDataTable = createLazyComponent(
  () => import('@/components/tables/AdvancedDataTable').then(module => ({ default: module.AdvancedDataTable })),
  'AdvancedDataTable'
);

export const ExportableTable = createLazyComponent(
  () => import('@/components/tables/ExportableTable').then(module => ({ default: module.ExportableTable })),
  'ExportableTable'
);

// Map Components
export const InteractiveMap = createLazyComponent(
  () => import('@/components/maps/InteractiveMap').then(module => ({ default: module.InteractiveMap })),
  'InteractiveMap'
);

export const LocationPicker = createLazyComponent(
  () => import('@/components/maps/LocationPicker').then(module => ({ default: module.LocationPicker })),
  'LocationPicker'
);

// File Upload Components
export const AdvancedFileUpload = createLazyComponent(
  () => import('@/components/upload/AdvancedFileUpload').then(module => ({ default: module.AdvancedFileUpload })),
  'AdvancedFileUpload'
);

export const ImageEditor = createLazyComponent(
  () => import('@/components/upload/ImageEditor').then(module => ({ default: module.ImageEditor })),
  'ImageEditor'
);
*/

// ==================== Preloadable Components ====================

// Create preloadable versions of frequently used components
export const preloadableDashboard = createPreloadableLazyComponent(
  () => import('@/pages/DashboardPage').then(module => ({ default: module.DashboardPage })),
  'DashboardPage'
);

export const preloadableCasesList = createPreloadableLazyComponent(
  () => import('@/pages/CasesPage').then(module => ({ default: module.CasesPage })),
  'CasesListPage'
);

export const preloadableUsersList = createPreloadableLazyComponent(
  () => import('@/pages/UsersPage').then(module => ({ default: module.UsersPage })),
  'UsersListPage'
);

// ==================== Route-Based Code Splitting ====================

/**
 * Route-based lazy loading configuration
 */
export const routeComponents = {
  // Dashboard routes
  '/dashboard': DashboardPage,
  '/analytics': AnalyticsPage,
  
  // Case routes
  cases: {
    list: CasesListPage,
    create: CreateCasePage,
    edit: CreateCasePage,
    detail: CaseDetailPage,
  },
  
  // User routes
  /*
  users: {
    list: UsersListPage,
    create: CreateUserPage,
    edit: EditUserPage,
    detail: UserDetailPage,
    profile: UserProfilePage,
  },
  */
  users: {
    list: UsersListPage,
    // create: CreateUserPage,
    // edit: EditUserPage,
    // detail: UserDetailPage,
    // profile: UserProfilePage,
  },
  // Client routes
  clients: {
    list: ClientsListPage,
    // detail: ClientDetailPage,
  },
  // Report routes
  reports: {
    index: ReportsPage,
    // performance: PerformanceReportPage,
    // financial: FinancialReportPage,
  },
  // Settings routes
  settings: {
    index: SettingsPage,
    roles: RoleManagementPage,
    // system: SystemConfigPage,
  },
  // Commission routes
  /*
  commission: {
    index: CommissionManagementPage,
    territory: TerritoryAssignmentPage,
  },
  */
  commission: {
    index: CommissionManagementPage,
    // territory: TerritoryAssignmentPage,
  },
} as const;

// ==================== Preloading Strategies ====================

/**
 * Preload components based on user role
 */
export function preloadByRole(role: string): void {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      // Preload admin-heavy components
      preloadableDashboard.preload();
      preloadableUsersList.preload();
      preloadComponent(SettingsPage);
      break;
      
    case 'MANAGER':
      // Preload management components
      preloadableDashboard.preload();
      preloadableCasesList.preload();
      preloadComponent(ReportsPage);
      break;
      
    case 'FIELD_AGENT':
      // Preload field agent components
      preloadableCasesList.preload();
      // preloadComponent(FormViewer);
      break;
      
    case 'BACKEND_USER':
      // Preload backend user components
      preloadableCasesList.preload();
      preloadableUsersList.preload();
      break;
      
    default:
      // Preload common components
      preloadableDashboard.preload();
      break;
  }
}

/**
 * Preload components on route hover
 */
export function preloadOnHover(routePath: string): void {
  const component = routeComponents[routePath as keyof typeof routeComponents];
    const lazyComponent = component as unknown;
  if (lazyComponent && lazyComponent._payload && lazyComponent._init) {
     preloadComponent(lazyComponent as LazyExoticComponent<Record<string, unknown>>);
  }
}

/**
 * Preload components on idle
 */
export function preloadOnIdle(): void {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      // Preload commonly used components during idle time
      // preloadComponent(FormViewer);
      // preloadComponent(AdvancedDataTable);
      // preloadComponent(DashboardCharts);
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      // preloadComponent(FormViewer);
      // preloadComponent(AdvancedDataTable);
      // preloadComponent(DashboardCharts);
    }, 2000);
  }
}

// ==================== Bundle Analysis Helpers ====================

/**
 * Log component loading for bundle analysis
 */
export function logComponentLoad(componentName: string): void {
  if (import.meta.env.DEV) {
    console.warn(`🔄 Lazy loading component: ${componentName}`);
  }
}

/**
 * Track component usage for optimization
 */
export function trackComponentUsage(componentName: string): void {
  if (import.meta.env.DEV) {
    const usage = JSON.parse(localStorage.getItem('component-usage') || '{}');
    usage[componentName] = (usage[componentName] || 0) + 1;
    localStorage.setItem('component-usage', JSON.stringify(usage));
  }
}

// ==================== Export All ====================

export default {
  // Utilities
  createLazyComponent,
  preloadComponent,
  createPreloadableLazyComponent,
  
  // Pages
  DashboardPage,
  CasesListPage,
  UsersListPage,
  // ... all other page components
  
  /*
  // Components
  FormViewer,
  AdvancedDataTable,
  DashboardCharts,
  */
  // ... all other heavy components
  
  // Strategies
  preloadByRole,
  preloadOnHover,
  preloadOnIdle,
  
  // Analysis
  logComponentLoad,
  trackComponentUsage,
};
