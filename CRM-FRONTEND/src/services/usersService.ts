/**
 * Modern Users Service
 * 
 * Refactored to use BaseApiService and eliminate code duplication.
 * Provides comprehensive user management functionality.
 */

import { BaseApiService } from './base';
import type {
  User,
  UserActivity,
  Role,
  CreateUserData,
  UpdateUserData,
  ChangePasswordData
} from '@/types/user';
import type {
  ApiResponse,
  PaginatedResponse,
  PaginationQuery,
  BulkOperationResult,
  ExportOptions
} from '@/types';

// Request/Response interfaces
export interface UserListQuery extends PaginationQuery {
  role?: Role;
  department?: string;
  designation?: string;
  isActive?: boolean;
  search?: string;
  clientId?: number;
  productId?: number;
}

export interface UserAssignmentData {
  clientIds?: number[];
  productIds?: number[];
  pincodeIds?: number[];
  areaIds?: number[];
  reason?: string;
}

export interface UserBulkUpdateData {
  role?: Role;
  department?: string;
  designation?: string;
  isActive?: boolean;
  reason?: string;
}

export interface UserStatsResponse {
  total: number;
  active: number;
  inactive: number;
  byRole: Record<Role, number>;
  byDepartment: Record<string, number>;
  recentLogins: number;
}

export interface UserActivityResponse {
  activities: UserActivity[];
  totalCount: number;
  summary: {
    totalActions: number;
    uniqueDays: number;
    mostActiveDay: string;
    commonActions: Array<{ action: string; count: number }>;
  };
}

/**
 * Modern Users Service Class
 */
export class UsersService extends BaseApiService {
  constructor() {
    super('/users');
  }

  // ==================== CRUD Operations ====================

  /**
   * Get paginated list of users with filters
   */
  async getUsers(query: UserListQuery = {}): Promise<PaginatedResponse<User>> {
    return this.getPaginated('', query);
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<ApiResponse<User>> {
    return this.get(`/${id}`);
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.get('/profile');
  }

  /**
   * Create new user
   */
  async createUser(data: CreateUserData): Promise<ApiResponse<User>> {
    return this.post('', data);
  }

  /**
   * Update user
   */
  async updateUser(id: string, data: UpdateUserData): Promise<ApiResponse<User>> {
    return this.put(`/${id}`, data);
  }

  /**
   * Update current user profile
   */
  async updateProfile(data: UpdateUserData): Promise<ApiResponse<User>> {
    return this.put('/profile', data);
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<ApiResponse<void>> {
    return this.delete(`/${id}`);
  }

  /**
   * Activate/Deactivate user
   */
  async toggleUserStatus(id: string, isActive: boolean, reason?: string): Promise<ApiResponse<User>> {
    return this.patch(`/${id}/status`, { isActive, reason });
  }

  // ==================== Authentication & Security ====================

  /**
   * Change user password
   */
  async changePassword(id: string, data: ChangePasswordData): Promise<ApiResponse<void>> {
    return this.post(`/${id}/change-password`, data);
  }

  /**
   * Reset user password
   */
  async resetPassword(id: string, newPassword: string): Promise<ApiResponse<void>> {
    return this.post(`/${id}/reset-password`, { newPassword });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string): Promise<ApiResponse<void>> {
    return this.post('/forgot-password', { email });
  }

  /**
   * Verify password reset token
   */
  async verifyResetToken(token: string): Promise<ApiResponse<{ valid: boolean; email: string }>> {
    return this.post('/verify-reset-token', { token });
  }

  // ==================== Role & Permission Management ====================

  /**
   * Update user role
   */
  async updateUserRole(id: string, role: Role, reason?: string): Promise<ApiResponse<User>> {
    return this.patch(`/${id}/role`, { role, reason });
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(id: string): Promise<ApiResponse<Record<string, Record<string, boolean>>>> {
    return this.get(`/${id}/permissions`);
  }

  /**
   * Update user permissions
   */
  async updateUserPermissions(
    id: string, 
    permissions: Record<string, Record<string, boolean>>
  ): Promise<ApiResponse<void>> {
    return this.put(`/${id}/permissions`, { permissions });
  }

  // ==================== Assignments ====================

  /**
   * Get user assignments (clients, products, territories)
   */
  async getUserAssignments(id: string): Promise<ApiResponse<{
    clients: Array<{ id: number; name: string; assignedAt: string }>;
    products: Array<{ id: number; name: string; assignedAt: string }>;
    pincodes: Array<{ id: number; code: string; assignedAt: string }>;
    areas: Array<{ id: number; name: string; assignedAt: string }>;
  }>> {
    return this.get(`/${id}/assignments`);
  }

  /**
   * Update user assignments
   */
  async updateUserAssignments(id: string, data: UserAssignmentData): Promise<ApiResponse<void>> {
    return this.put(`/${id}/assignments`, data);
  }

  /**
   * Bulk assign users to clients/products
   */
  async bulkAssignUsers(
    userIds: string[], 
    assignments: UserAssignmentData
  ): Promise<ApiResponse<BulkOperationResult>> {
    return this.bulkOperation('/bulk-assign', 'assign', userIds, assignments);
  }

  // ==================== Bulk Operations ====================

  /**
   * Bulk update users
   */
  async bulkUpdateUsers(
    userIds: string[], 
    data: UserBulkUpdateData
  ): Promise<ApiResponse<BulkOperationResult>> {
    return this.bulkOperation('/bulk-update', 'update', userIds, data);
  }

  /**
   * Bulk activate/deactivate users
   */
  async bulkToggleUserStatus(
    userIds: string[], 
    isActive: boolean, 
    reason?: string
  ): Promise<ApiResponse<BulkOperationResult>> {
    return this.bulkOperation('/bulk-status', 'toggle-status', userIds, {
      isActive,
      reason
    });
  }

  /**
   * Bulk delete users
   */
  async bulkDeleteUsers(userIds: string[], reason?: string): Promise<ApiResponse<BulkOperationResult>> {
    return this.bulkOperation('/bulk-delete', 'delete', userIds, { reason });
  }

  // ==================== Analytics & Statistics ====================

  /**
   * Get user statistics
   */
  async getUserStats(filters?: Record<string, any>): Promise<ApiResponse<UserStatsResponse>> {
    return this.get('/stats', filters);
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: Role): Promise<ApiResponse<User[]>> {
    return this.get('/by-role', { role });
  }

  /**
   * Get users by department
   */
  async getUsersByDepartment(department: string): Promise<ApiResponse<User[]>> {
    return this.get('/by-department', { department });
  }

  /**
   * Get active users
   */
  async getActiveUsers(): Promise<ApiResponse<User[]>> {
    return this.get('/active');
  }

  // ==================== Activity & History ====================

  /**
   * Get user activities
   */
  async getUserActivities(
    id: string, 
    query?: { page?: number; limit?: number; dateFrom?: string; dateTo?: string }
  ): Promise<ApiResponse<UserActivityResponse>> {
    return this.get(`/${id}/activities`, query);
  }

  /**
   * Get user login history
   */
  async getUserLoginHistory(
    id: string, 
    query?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<{
    id: string;
    loginAt: string;
    ipAddress: string;
    userAgent: string;
    location?: string;
  }>> {
    return this.getPaginated(`/${id}/login-history`, query);
  }

  // ==================== Profile & Avatar ====================

  /**
   * Upload user avatar
   */
  async uploadAvatar(id: string, file: File): Promise<ApiResponse<{ profilePhotoUrl: string }>> {
    return this.uploadFile(`/${id}/avatar`, file);
  }

  /**
   * Delete user avatar
   */
  async deleteAvatar(id: string): Promise<ApiResponse<void>> {
    return this.delete(`/${id}/avatar`);
  }

  // ==================== Export & Import ====================

  /**
   * Export users
   */
  async exportUsers(options: ExportOptions): Promise<Blob> {
    return this.exportData('/export', options.format, options.filters);
  }

  /**
   * Get export template
   */
  async getExportTemplate(format: 'excel' | 'csv'): Promise<Blob> {
    return this.exportData('/export-template', format);
  }

  /**
   * Import users from file
   */
  async importUsers(file: File): Promise<ApiResponse<{
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  }>> {
    return this.uploadFile('/import', file);
  }

  // ==================== Search & Filters ====================

  /**
   * Search users
   */
  async searchUsers(query: string, filters?: UserListQuery): Promise<ApiResponse<User[]>> {
    return this.get('/search', { query, ...filters });
  }

  /**
   * Get user filters metadata
   */
  async getFiltersMetadata(): Promise<ApiResponse<{
    roles: Role[];
    departments: Array<{ id: string; name: string }>;
    designations: Array<{ id: string; name: string }>;
    clients: Array<{ id: number; name: string }>;
    products: Array<{ id: number; name: string }>;
  }>> {
    return this.get('/filters-metadata');
  }
}

// Export singleton instance
export const usersService = new UsersService();
export default usersService;
