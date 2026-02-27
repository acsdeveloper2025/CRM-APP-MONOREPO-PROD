export const routeKeyFromPath = (path: string): string | null => {
  if (path === '/dashboard') {return 'dashboard';}
  if (path.startsWith('/cases')) {return 'cases';}
  if (path.startsWith('/tasks') || path.startsWith('/verification-tasks')) {return 'task-board';}
  if (path.startsWith('/mobile') || path.startsWith('/users/mobile')) {return 'visit-execution';}
  if (path.startsWith('/reports') || path.startsWith('/analytics')) {return 'reports';}
  if (path.startsWith('/billing') || path.startsWith('/invoices')) {return 'billing';}
  if (path.startsWith('/commissions') || path.startsWith('/commission-management')) {return 'commission';}
  if (path.startsWith('/users') || path.startsWith('/role-management') || path.startsWith('/admin/roles-permissions')) {return 'users';}
  if (path.startsWith('/clients')) {return 'clients';}
  if (path.startsWith('/products') || path.startsWith('/verification-types') || path.startsWith('/document-types') || path.startsWith('/rate-management')) {return 'products';}
  if (path.startsWith('/territory') || path.startsWith('/locations')) {return 'territory-mapping';}
  if (path.startsWith('/settings') || path.startsWith('/security')) {return 'settings';}
  return null;
};

export const isRouteAllowed = (routeAccess: string[] | undefined, path: string): boolean => {
  if (!routeAccess || routeAccess.length === 0) {return true;}
  const key = routeKeyFromPath(path);
  if (!key) {return true;}
  return routeAccess.includes(key);
};
