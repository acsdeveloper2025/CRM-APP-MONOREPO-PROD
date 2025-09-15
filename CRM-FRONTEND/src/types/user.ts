import { Role } from './auth';

export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  username: string;
  email: string;
  phone?: string;
  role: Role;
  roleId?: string;
  roleName?: string;
  employeeId: string;
  designation: string;
  department?: string; // Legacy display field
  departmentId?: string;
  departmentName?: string;
  profilePhotoUrl?: string;
  deviceId?: string; // Device ID for field agents
  isActive?: boolean;
  lastLogin?: string;
  lastLoginAt?: string; // Some views may still use lastLoginAt
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateUserData {
  name: string;
  username: string;
  email: string;
  password: string;
  role?: Role; // Legacy display only
  roleId?: string; // New role system
  employeeId: string;
  designation?: string; // Legacy display only
  designationId?: string; // New designation system
  department?: string; // Legacy display only
  departmentId?: string; // New department system
  deviceId?: string; // Device ID for field agents
  profilePhotoUrl?: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: Role; // Legacy display only
  roleId?: string; // New role system
  employeeId?: string;
  designation?: string; // Legacy display only
  designationId?: string; // New designation system
  department?: string; // Legacy display only
  departmentId?: string; // New department system
  deviceId?: string; // Device ID for field agents
  profilePhotoUrl?: string;
  isActive?: boolean;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ResetPasswordData {
  userId: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  timestamp: string;
  user: {
    id: string;
    name: string;
    username: string;
  };
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
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
  id: string;
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
  id: string;
  name: string;
  description?: string;
  departmentId?: string;
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
  departmentId?: string;
  isActive?: boolean;
}

export interface UpdateDesignationRequest {
  name?: string;
  description?: string;
  departmentId?: string;
  isActive?: boolean;
}

export interface UserSession {
  id: string;
  userId: string;
  deviceId?: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  lastActivityAt: string;
  createdAt: string;
  user: {
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
