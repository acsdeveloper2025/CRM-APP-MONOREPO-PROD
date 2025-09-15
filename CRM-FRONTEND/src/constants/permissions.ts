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
} as const;

// Action types for permission checking
export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

// Default permission sets for quick role creation
export const DEFAULT_PERMISSION_SETS = {
  ADMIN: {
    users: { create: true, read: true, update: true, delete: true },
    roles: { create: true, read: true, update: true, delete: true },
    departments: { create: true, read: true, update: true, delete: true },
    locations: { create: true, read: true, update: true, delete: true },
    clients: { create: true, read: true, update: true, delete: true },
    cases: { create: true, read: true, update: true, delete: true },
    reports: { create: true, read: true, update: true, delete: true },
    settings: { create: true, read: true, update: true, delete: true },
  },
  MANAGER: {
    users: { create: true, read: true, update: true, delete: false },
    roles: { create: false, read: true, update: false, delete: false },
    departments: { create: false, read: true, update: false, delete: false },
    locations: { create: true, read: true, update: true, delete: false },
    clients: { create: true, read: true, update: true, delete: false },
    cases: { create: true, read: true, update: true, delete: false },
    reports: { create: true, read: true, update: true, delete: false },
    settings: { create: false, read: true, update: false, delete: false },
  },
  FIELD_AGENT: {
    users: { create: false, read: true, update: false, delete: false },
    roles: { create: false, read: false, update: false, delete: false },
    departments: { create: false, read: true, update: false, delete: false },
    locations: { create: false, read: true, update: false, delete: false },
    clients: { create: true, read: true, update: true, delete: false },
    cases: { create: true, read: true, update: true, delete: false },
    reports: { create: false, read: true, update: false, delete: false },
    settings: { create: false, read: false, update: false, delete: false },
  },
  VIEWER: {
    users: { create: false, read: true, update: false, delete: false },
    roles: { create: false, read: false, update: false, delete: false },
    departments: { create: false, read: true, update: false, delete: false },
    locations: { create: false, read: true, update: false, delete: false },
    clients: { create: false, read: true, update: false, delete: false },
    cases: { create: false, read: true, update: false, delete: false },
    reports: { create: false, read: true, update: false, delete: false },
    settings: { create: false, read: false, update: false, delete: false },
  },
} as const;

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
} as const;

export const ACTION_LABELS = {
  create: 'Create',
  read: 'View/Read',
  update: 'Edit/Update',
  delete: 'Delete',
} as const;
