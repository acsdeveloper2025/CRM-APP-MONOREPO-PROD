import { type UserRole } from './constants';

export type Role = UserRole;

export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  username: string;
  email: string;
  phone?: string;
  role: Role;
  roles?: string[];
  roleId?: number | string;
  roleName?: string;
  permissions?: unknown;
  permissionCodes?: string[];
  permissionMap?: Record<string, unknown>;
  legacyPermissions?: Record<string, unknown>;
  routeAccess?: string[];
  employeeId: string;
  designation: string;
  designationId?: number;
  designationName?: string;
  department?: string; // Legacy display field
  departmentId?: number;
  departmentName?: string;
  teamLeaderId?: string | null;
  teamLeaderName?: string | null;
  managerId?: string | null;
  managerName?: string | null;
  profilePhotoUrl?: string;
  isActive?: boolean;
  lastLogin?: string;
  lastLoginAt?: string; // Some views may still use lastLoginAt
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  // Assignment counts for BACKEND_USER role
  assignedClientsCount?: number;
  assignedProductsCount?: number;
  // Assignment counts for FIELD_AGENT role
  assignedPincodesCount?: number;
  assignedAreasCount?: number;
  // Assignment arrays for BACKEND_USER role (for filtering)
  assignedClients?: number[];
  assignedProducts?: number[];
  // Assignment arrays for FIELD_AGENT role (for filtering)
  assignedPincodes?: number[];
  assignedAreas?: number[];
  // User profile statistics (from detailed user queries)
  stats?: {
    totalCases: number;
    completedCases: number;
    averageRating: number;
    totalCommissions: number;
  };
  // Recent activity log
  recentActivity?: Array<{
    id: string;
    action: string;
    description: string;
    timestamp: string;
  }>;
}

export interface CreateUserData {
  name: string;
  username: string;
  email: string;
  password: string;
  role?: Role; // Legacy display only
  roleId?: number | string; // New role system (legacy int or RBAC UUID)
  employeeId: string;
  designation?: string; // Legacy display only
  designationId?: number; // New designation system
  department?: string; // Legacy display only
  departmentId?: number; // New department system
  profilePhotoUrl?: string;
  teamLeaderId?: string;
  managerId?: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: Role; // Legacy display only
  roleId?: number | string; // New role system (legacy int or RBAC UUID)
  employeeId?: string;
  designation?: string; // Legacy display only
  designationId?: number; // New designation system
  department?: string; // Legacy display only
  departmentId?: number; // New department system
  profilePhotoUrl?: string;
  isActive?: boolean;
  teamLeaderId?: string | null;
  managerId?: string | null;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ResetPasswordData {
  username: string;
  newPassword: string;
  confirmPassword?: string;
}

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  description?: string; // Optional if not always present
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  createdAt: string;
  userName?: string;
  // Legacy support for nested user if needed elsewhere
  user?: {
    id: string;
    name: string;
    username: string;
  };
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  newUsersThisMonth: number;
  usersByRole: {
    role: Role;
    count: number;
  }[];
  usersByDepartment: {
    department: string;
    count: number;
  }[];
  recentLogins: {
    userId: string;
    userName: string;
    lastLoginAt: string;
  }[];
}

// Role and Department Management Types
export interface Permission {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export interface RolePermissions {
  users: Permission;
  roles: Permission;
  departments: Permission;
  locations: Permission;
  clients: Permission;
  cases: Permission;
  reports: Permission;
  settings: Permission;
  products: Permission;
  verificationTypes: Permission;
  documentTypes: Permission;
  rateManagement: Permission;
  commissions: Permission;
  billing: Permission;
  forms: Permission;
  analytics: Permission;
  tasks: Permission;
  designations: Permission;
}

export interface RoleData {
  id: string;
  name: string;
  description?: string;
  permissions: RolePermissions;
  isSystemRole: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  createdByName?: string;
  updatedByName?: string;
  userCount: number;
}

export interface Department {
  id: number;
  name: string;
  description?: string;
  departmentHeadId?: string;
  departmentHeadName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  createdByName?: string;
  updatedByName?: string;
  userCount: number;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  permissions: RolePermissions;
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissions?: RolePermissions;
  isActive?: boolean;
}

export interface CreateDepartmentRequest {
  name: string;
  description?: string;
  departmentHeadId?: string;
}

export interface UpdateDepartmentRequest {
  name?: string;
  description?: string;
  departmentHeadId?: string;
  isActive?: boolean;
}

// Designation types
export interface Designation {
  id: number;
  name: string;
  description?: string;
  departmentId?: number;
  departmentName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  updatedByName?: string;
}

export interface CreateDesignationRequest {
  name: string;
  description?: string;
  departmentId?: number;
  isActive?: boolean;
}

export interface UpdateDesignationRequest {
  name?: string;
  description?: string;
  departmentId?: number;
  isActive?: boolean;
}

export interface UserSession {
  id: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
  lastActivityAt?: string;
  createdAt: string;
  expiresAt?: string;
  userName?: string;
  username?: string;
  // Legacy support for nested user
  user?: {
    id: string;
    name: string;
    username: string;
  };
}

export interface UserPermission {
  id: string;
  name: string;
  description: string;
  module: string;
  action: string;
}

export interface RolePermission {
  role: Role;
  permissions: UserPermission[];
}

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  employeeId: string;
  designation: string;
  department: string;
  profilePhotoUrl?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  stats: {
    totalCases: number;
    completedCases: number;
    pendingCases: number;
    averageRating: number;
    totalCommissions: number;
  };
  recentActivity: UserActivity[];
}

export interface BulkUserOperation {
  userIds: string[];
  operation: 'activate' | 'deactivate' | 'delete' | 'changeRole';
  data?: {
    role?: Role;
    reason?: string;
  };
}

export interface UserImportData {
  name: string;
  username: string;
  email: string;
  role: Role;
  employeeId: string;
  designation: string;
  department: string;
  password?: string;
}

export interface UserClientAssignment {
  id: number;
  clientId: number;
  clientName: string;
  clientCode: string;
  clientEmail?: string;
  clientIsActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProductAssignment {
  id: number;
  userId: string;
  productId: number;
  productName: string;
  productDescription?: string;
  assignedAt: string;
  assignedBy?: string;
  assignedByName?: string;
}

export interface UserExportData {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  employeeId: string;
  designation: string;
  department: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  totalCases: number;
  completedCases: number;
}

export interface ActivityQuery {
  page?: number;
  limit?: number;
  search?: string;
  userId?: string;
  actionType?: string;
  dateFrom?: string;
  dateTo?: string;
}
