// Permission constants for role-based access control
export const PERMISSIONS = {
  USERS: {
    CREATE: 'users.create',
    READ: 'users.read',
    UPDATE: 'users.update',
    DELETE: 'users.delete',
  },
  ROLES: {
    CREATE: 'roles.create',
    READ: 'roles.read',
    UPDATE: 'roles.update',
    DELETE: 'roles.delete',
  },
  DEPARTMENTS: {
    CREATE: 'departments.create',
    READ: 'departments.read',
    UPDATE: 'departments.update',
    DELETE: 'departments.delete',
  },
  LOCATIONS: {
    CREATE: 'locations.create',
    READ: 'locations.read',
    UPDATE: 'locations.update',
    DELETE: 'locations.delete',
  },
  CLIENTS: {
    CREATE: 'clients.create',
    READ: 'clients.read',
    UPDATE: 'clients.update',
    DELETE: 'clients.delete',
  },
  CASES: {
    CREATE: 'cases.create',
    READ: 'cases.read',
    UPDATE: 'cases.update',
    DELETE: 'cases.delete',
  },
  REPORTS: {
    CREATE: 'reports.create',
    READ: 'reports.read',
    UPDATE: 'reports.update',
    DELETE: 'reports.delete',
  },
  SETTINGS: {
    CREATE: 'settings.create',
    READ: 'settings.read',
    UPDATE: 'settings.update',
    DELETE: 'settings.delete',
  },
  PRODUCTS: {
    CREATE: 'products.create',
    READ: 'products.read',
    UPDATE: 'products.update',
    DELETE: 'products.delete',
  },
  VERIFICATION_TYPES: {
    CREATE: 'verification_types.create',
    READ: 'verification_types.read',
    UPDATE: 'verification_types.update',
    DELETE: 'verification_types.delete',
  },
  DOCUMENT_TYPES: {
    CREATE: 'document_types.create',
    READ: 'document_types.read',
    UPDATE: 'document_types.update',
    DELETE: 'document_types.delete',
  },
  RATE_MANAGEMENT: {
    CREATE: 'rate_management.create',
    READ: 'rate_management.read',
    UPDATE: 'rate_management.update',
    DELETE: 'rate_management.delete',
  },
  COMMISSIONS: {
    CREATE: 'commissions.create',
    READ: 'commissions.read',
    UPDATE: 'commissions.update',
    DELETE: 'commissions.delete',
  },
  BILLING: {
    CREATE: 'billing.create',
    READ: 'billing.read',
    UPDATE: 'billing.update',
    DELETE: 'billing.delete',
  },
  FORMS: {
    CREATE: 'forms.create',
    READ: 'forms.read',
    UPDATE: 'forms.update',
    DELETE: 'forms.delete',
  },
  ANALYTICS: {
    CREATE: 'analytics.create',
    READ: 'analytics.read',
    UPDATE: 'analytics.update',
    DELETE: 'analytics.delete',
  },
  TASKS: {
    CREATE: 'tasks.create',
    READ: 'tasks.read',
    UPDATE: 'tasks.update',
    DELETE: 'tasks.delete',
  },
  DESIGNATIONS: {
    CREATE: 'designations.create',
    READ: 'designations.read',
    UPDATE: 'designations.update',
    DELETE: 'designations.delete',
  },
} as const;

// Resource names for permission checking
export const RESOURCES = {
  USERS: 'users',
  ROLES: 'roles',
  DEPARTMENTS: 'departments',
  LOCATIONS: 'locations',
  CLIENTS: 'clients',
  CASES: 'cases',
  REPORTS: 'reports',
  SETTINGS: 'settings',
  PRODUCTS: 'products',
  VERIFICATION_TYPES: 'verification_types',
  DOCUMENT_TYPES: 'document_types',
  RATE_MANAGEMENT: 'rate_management',
  COMMISSIONS: 'commissions',
  BILLING: 'billing',
  FORMS: 'forms',
  ANALYTICS: 'analytics',
  TASKS: 'tasks',
  DESIGNATIONS: 'designations',
} as const;

// Action types for permission checking
export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

// Default permission sets for quick role creation
// NOTE: All roles start with NO permissions by default
// Administrators must explicitly grant permissions for each role
export const DEFAULT_PERMISSION_SETS = {} as const;

// Permission labels for UI display
export const PERMISSION_LABELS = {
  users: 'User Management',
  roles: 'Role Management',
  departments: 'Department Management',
  locations: 'Location Management',
  clients: 'Client Management',
  cases: 'Case Management',
  reports: 'Reports & Analytics',
  settings: 'System Settings',
  products: 'Product Management',
  verification_types: 'Verification Types',
  document_types: 'Document Types',
  rate_management: 'Rate Management',
  commissions: 'Commission Management',
  billing: 'Billing Management',
  forms: 'Form Viewer',
  analytics: 'Analytics & MIS Dashboard',
  tasks: 'Task Management',
  designations: 'Designation Management',
} as const;

export const ACTION_LABELS = {
  create: 'Create',
  read: 'View/Read',
  update: 'Edit/Update',
  delete: 'Delete',
} as const;
