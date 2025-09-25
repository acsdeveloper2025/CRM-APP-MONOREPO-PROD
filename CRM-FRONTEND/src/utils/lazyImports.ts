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
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  displayName?: string
): LazyExoticComponent<T> {
  const LazyComponent = lazy(importFn);
  
  if (displayName) {
    LazyComponent.displayName = `Lazy(${displayName})`;
  }
  
  return LazyComponent;
}

/**
 * Preload a lazy component
 */
export function preloadComponent<T extends ComponentType<any>>(
  lazyComponent: LazyExoticComponent<T>
): void {
  // Access the _payload to trigger preloading
  const payload = (lazyComponent as any)._payload;
  if (payload && typeof payload._result === 'undefined') {
    payload._result = payload._init(payload._payload);
  }
}

/**
 * Create a lazy component with preloading capability
 */
export function createPreloadableLazyComponent<T extends ComponentType<any>>(
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
  () => import('@/pages/DashboardPage'),
  'DashboardPage'
);

export const AnalyticsPage = createLazyComponent(
  () => import('@/pages/AnalyticsPage'),
  'AnalyticsPage'
);

// Case Management Pages
export const CasesListPage = createLazyComponent(
  () => import('@/pages/cases/CasesListPage'),
  'CasesListPage'
);

export const CaseDetailPage = createLazyComponent(
  () => import('@/pages/cases/CaseDetailPage'),
  'CaseDetailPage'
);

export const CreateCasePage = createLazyComponent(
  () => import('@/pages/cases/CreateCasePage'),
  'CreateCasePage'
);

export const EditCasePage = createLazyComponent(
  () => import('@/pages/cases/EditCasePage'),
  'EditCasePage'
);

// User Management Pages
export const UsersListPage = createLazyComponent(
  () => import('@/pages/users/UsersListPage'),
  'UsersListPage'
);

export const UserDetailPage = createLazyComponent(
  () => import('@/pages/users/UserDetailPage'),
  'UserDetailPage'
);

export const CreateUserPage = createLazyComponent(
  () => import('@/pages/users/CreateUserPage'),
  'CreateUserPage'
);

export const EditUserPage = createLazyComponent(
  () => import('@/pages/users/EditUserPage'),
  'EditUserPage'
);

export const UserProfilePage = createLazyComponent(
  () => import('@/pages/users/UserProfilePage'),
  'UserProfilePage'
);

// Client Management Pages
export const ClientsListPage = createLazyComponent(
  () => import('@/pages/clients/ClientsListPage'),
  'ClientsListPage'
);

export const ClientDetailPage = createLazyComponent(
  () => import('@/pages/clients/ClientDetailPage'),
  'ClientDetailPage'
);

// Reports Pages
export const ReportsPage = createLazyComponent(
  () => import('@/pages/reports/ReportsPage'),
  'ReportsPage'
);

export const PerformanceReportPage = createLazyComponent(
  () => import('@/pages/reports/PerformanceReportPage'),
  'PerformanceReportPage'
);

export const FinancialReportPage = createLazyComponent(
  () => import('@/pages/reports/FinancialReportPage'),
  'FinancialReportPage'
);

// Settings Pages
export const SettingsPage = createLazyComponent(
  () => import('@/pages/settings/SettingsPage'),
  'SettingsPage'
);

export const RoleManagementPage = createLazyComponent(
  () => import('@/pages/settings/RoleManagementPage'),
  'RoleManagementPage'
);

export const SystemConfigPage = createLazyComponent(
  () => import('@/pages/settings/SystemConfigPage'),
  'SystemConfigPage'
);

// Commission Management Pages
export const CommissionManagementPage = createLazyComponent(
  () => import('@/pages/commission/CommissionManagementPage'),
  'CommissionManagementPage'
);

export const RateManagementPage = createLazyComponent(
  () => import('@/pages/commission/RateManagementPage'),
  'RateManagementPage'
);

export const TerritoryAssignmentPage = createLazyComponent(
  () => import('@/pages/commission/TerritoryAssignmentPage'),
  'TerritoryAssignmentPage'
);

// ==================== Heavy Components (Lazy Loaded) ====================

// Form Components
export const FormViewer = createLazyComponent(
  () => import('@/components/forms/FormViewer'),
  'FormViewer'
);

export const FormBuilder = createLazyComponent(
  () => import('@/components/forms/FormBuilder'),
  'FormBuilder'
);

// Chart Components
export const AdvancedChart = createLazyComponent(
  () => import('@/components/charts/AdvancedChart'),
  'AdvancedChart'
);

export const DashboardCharts = createLazyComponent(
  () => import('@/components/dashboard/DashboardCharts'),
  'DashboardCharts'
);

// Data Table Components
export const AdvancedDataTable = createLazyComponent(
  () => import('@/components/tables/AdvancedDataTable'),
  'AdvancedDataTable'
);

export const ExportableTable = createLazyComponent(
  () => import('@/components/tables/ExportableTable'),
  'ExportableTable'
);

// Map Components
export const InteractiveMap = createLazyComponent(
  () => import('@/components/maps/InteractiveMap'),
  'InteractiveMap'
);

export const LocationPicker = createLazyComponent(
  () => import('@/components/maps/LocationPicker'),
  'LocationPicker'
);

// File Upload Components
export const AdvancedFileUpload = createLazyComponent(
  () => import('@/components/upload/AdvancedFileUpload'),
  'AdvancedFileUpload'
);

export const ImageEditor = createLazyComponent(
  () => import('@/components/upload/ImageEditor'),
  'ImageEditor'
);

// ==================== Preloadable Components ====================

// Create preloadable versions of frequently used components
export const preloadableDashboard = createPreloadableLazyComponent(
  () => import('@/pages/DashboardPage'),
  'DashboardPage'
);

export const preloadableCasesList = createPreloadableLazyComponent(
  () => import('@/pages/cases/CasesListPage'),
  'CasesListPage'
);

export const preloadableUsersList = createPreloadableLazyComponent(
  () => import('@/pages/users/UsersListPage'),
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
  '/cases': CasesListPage,
  '/cases/create': CreateCasePage,
  '/cases/:id': CaseDetailPage,
  '/cases/:id/edit': EditCasePage,
  
  // User routes
  '/users': UsersListPage,
  '/users/create': CreateUserPage,
  '/users/:id': UserDetailPage,
  '/users/:id/edit': EditUserPage,
  '/profile': UserProfilePage,
  
  // Client routes
  '/clients': ClientsListPage,
  '/clients/:id': ClientDetailPage,
  
  // Report routes
  '/reports': ReportsPage,
  '/reports/performance': PerformanceReportPage,
  '/reports/financial': FinancialReportPage,
  
  // Settings routes
  '/settings': SettingsPage,
  '/settings/roles': RoleManagementPage,
  '/settings/system': SystemConfigPage,
  
  // Commission routes
  '/commission': CommissionManagementPage,
  '/commission/rates': RateManagementPage,
  '/commission/territories': TerritoryAssignmentPage,
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
      preloadComponent(FormViewer);
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
  if (component) {
    preloadComponent(component);
  }
}

/**
 * Preload components on idle
 */
export function preloadOnIdle(): void {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      // Preload commonly used components during idle time
      preloadComponent(FormViewer);
      preloadComponent(AdvancedDataTable);
      preloadComponent(DashboardCharts);
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      preloadComponent(FormViewer);
      preloadComponent(AdvancedDataTable);
      preloadComponent(DashboardCharts);
    }, 2000);
  }
}

// ==================== Bundle Analysis Helpers ====================

/**
 * Log component loading for bundle analysis
 */
export function logComponentLoad(componentName: string): void {
  if (import.meta.env.DEV) {
    console.log(`🔄 Lazy loading component: ${componentName}`);
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
  
  // Components
  FormViewer,
  AdvancedDataTable,
  DashboardCharts,
  // ... all other heavy components
  
  // Strategies
  preloadByRole,
  preloadOnHover,
  preloadOnIdle,
  
  // Analysis
  logComponentLoad,
  trackComponentUsage,
};
