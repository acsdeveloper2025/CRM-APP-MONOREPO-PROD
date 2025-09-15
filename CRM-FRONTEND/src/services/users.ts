import { apiService } from './api';
import type {
  User,
  CreateUserData,
  UpdateUserData,
  ChangePasswordData,
  ResetPasswordData,
  UserActivity,
  UserStats,
  UserSession,
  UserProfile,
  BulkUserOperation,
  UserImportData,
  UserExportData,
  RolePermission,
  UserClientAssignment,
  UserProductAssignment
} from '@/types/user';
import type { ApiResponse, PaginationQuery } from '@/types/api';
import type { Role } from '@/types/auth';

export interface UserQuery extends PaginationQuery {
  role?: Role;
  department?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: 'name' | 'username' | 'email' | 'role' | 'department' | 'createdAt' | 'lastLoginAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ActivityQuery extends PaginationQuery {
  userId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface SessionQuery extends PaginationQuery {
  userId?: string;
  isActive?: boolean;
}

export class UsersService {
  // User CRUD operations
  async getUsers(query: UserQuery = {}): Promise<ApiResponse<User[]>> {
    return apiService.get('/users', query);
  }

  async getUserById(id: string): Promise<ApiResponse<User>> {
    return apiService.get(`/users/${id}`);
  }

  async getUserProfile(id: string): Promise<ApiResponse<UserProfile>> {
    return apiService.get(`/users/${id}/profile`);
  }

  async createUser(data: CreateUserData): Promise<ApiResponse<User>> {
    return apiService.post('/users', data);
  }

  async updateUser(id: string, data: UpdateUserData): Promise<ApiResponse<User>> {
    return apiService.put(`/users/${id}`, data);
  }

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/users/${id}`);
  }

  async activateUser(id: string): Promise<ApiResponse<User>> {
    return apiService.post(`/users/${id}/activate`);
  }

  async deactivateUser(id: string, reason?: string): Promise<ApiResponse<User>> {
    return apiService.post(`/users/${id}/deactivate`, { reason });
  }

  // Password management
  async changePassword(id: string, data: ChangePasswordData): Promise<ApiResponse<void>> {
    return apiService.post(`/users/${id}/change-password`, data);
  }

  async resetPassword(data: ResetPasswordData): Promise<ApiResponse<void>> {
    return apiService.post('/users/reset-password', data);
  }

  async generateTemporaryPassword(userId: string): Promise<ApiResponse<{ temporaryPassword: string }>> {
    return apiService.post(`/users/${userId}/generate-temp-password`);
  }

  // Profile photo management
  async uploadProfilePhoto(userId: string, file: File): Promise<ApiResponse<{ profilePhotoUrl: string }>> {
    const formData = new FormData();
    formData.append('photo', file);
    
    return apiService.post(`/users/${userId}/profile-photo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async deleteProfilePhoto(userId: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/users/${userId}/profile-photo`);
  }

  // User activity and audit logs
  async getUserActivities(query: ActivityQuery = {}): Promise<ApiResponse<UserActivity[]>> {
    return apiService.get('/users/activities', query);
  }

  async getUserActivityById(userId: string, query: ActivityQuery = {}): Promise<ApiResponse<UserActivity[]>> {
    return apiService.get(`/users/${userId}/activities`, query);
  }

  // User sessions
  async getUserSessions(query: SessionQuery = {}): Promise<ApiResponse<UserSession[]>> {
    return apiService.get('/users/sessions', query);
  }

  async getUserSessionsByUser(userId: string): Promise<ApiResponse<UserSession[]>> {
    return apiService.get(`/users/${userId}/sessions`);
  }

  async terminateSession(sessionId: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/users/sessions/${sessionId}`);
  }

  async terminateAllUserSessions(userId: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/users/${userId}/sessions`);
  }

  // User statistics
  async getUserStats(): Promise<ApiResponse<UserStats>> {
    return apiService.get('/users/stats');
  }

  async getUserStatsByDepartment(department: string): Promise<ApiResponse<UserStats>> {
    return apiService.get(`/users/stats/department/${department}`);
  }

  async getUserStatsByRole(role: Role): Promise<ApiResponse<UserStats>> {
    return apiService.get(`/users/stats/role/${role}`);
  }

  // Role and permissions
  async getRolePermissions(): Promise<ApiResponse<RolePermission[]>> {
    return apiService.get('/users/roles/permissions');
  }

  async getRolePermissionsByRole(role: Role): Promise<ApiResponse<RolePermission>> {
    return apiService.get(`/users/roles/${role}/permissions`);
  }

  // Bulk operations
  async bulkUserOperation(operation: BulkUserOperation): Promise<ApiResponse<{ success: number; failed: number; errors: string[] }>> {
    return apiService.post('/users/bulk-operation', operation);
  }

  async bulkActivateUsers(userIds: string[]): Promise<ApiResponse<{ success: number; failed: number }>> {
    return this.bulkUserOperation({
      userIds,
      operation: 'activate',
    });
  }

  async bulkDeactivateUsers(userIds: string[], reason?: string): Promise<ApiResponse<{ success: number; failed: number }>> {
    return this.bulkUserOperation({
      userIds,
      operation: 'deactivate',
      data: { reason },
    });
  }

  async bulkDeleteUsers(userIds: string[]): Promise<ApiResponse<{ success: number; failed: number }>> {
    return this.bulkUserOperation({
      userIds,
      operation: 'delete',
    });
  }

  async bulkChangeRole(userIds: string[], role: Role): Promise<ApiResponse<{ success: number; failed: number }>> {
    return this.bulkUserOperation({
      userIds,
      operation: 'changeRole',
      data: { role },
    });
  }

  // Import/Export
  async importUsers(file: File): Promise<ApiResponse<{ imported: number; failed: number; errors: string[] }>> {
    const formData = new FormData();
    formData.append('file', file);
    
    return apiService.post('/users/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async exportUsers(query: UserQuery = {}, format: 'CSV' | 'EXCEL' = 'EXCEL'): Promise<Blob> {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/export?format=${format}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });
    return response.blob();
  }

  async downloadUserTemplate(): Promise<Blob> {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/import-template`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
    });
    return response.blob();
  }

  // Search and filters
  async searchUsers(query: string): Promise<ApiResponse<User[]>> {
    return apiService.get('/users/search', { q: query });
  }

  async getUsersByDepartment(department: string): Promise<ApiResponse<User[]>> {
    return this.getUsers({ department });
  }

  async getUsersByRole(role: Role): Promise<ApiResponse<User[]>> {
    return this.getUsers({ role });
  }

  async getActiveUsers(): Promise<ApiResponse<User[]>> {
    return this.getUsers({ isActive: true });
  }

  async getInactiveUsers(): Promise<ApiResponse<User[]>> {
    return this.getUsers({ isActive: false });
  }

  async getFieldUsers(): Promise<ApiResponse<User[]>> {
    return this.getUsers({ role: 'FIELD_AGENT', isActive: true });
  }

  // Department and designation management
  async getDepartments(): Promise<ApiResponse<string[]>> {
    return apiService.get('/users/departments');
  }

  async getDesignations(): Promise<ApiResponse<string[]>> {
    return apiService.get('/users/designations');
  }

  async getDepartmentStats(): Promise<ApiResponse<{ department: string; userCount: number; activeCount: number }[]>> {
    return apiService.get('/users/departments/stats');
  }

  // Client assignment management for BACKEND users
  async getUserClientAssignments(userId: string): Promise<ApiResponse<UserClientAssignment[]>> {
    return apiService.get(`/users/${userId}/client-assignments`);
  }

  async assignClientsToUser(userId: string, clientIds: number[]): Promise<ApiResponse<void>> {
    return apiService.post(`/users/${userId}/client-assignments`, { clientIds });
  }

  async removeClientAssignment(userId: string, clientId: number): Promise<ApiResponse<void>> {
    return apiService.delete(`/users/${userId}/client-assignments/${clientId}`);
  }

  // Product assignment management for BACKEND users
  async getUserProductAssignments(userId: string): Promise<ApiResponse<UserProductAssignment[]>> {
    return apiService.get(`/users/${userId}/product-assignments`);
  }

  async assignProductsToUser(userId: string, productIds: number[]): Promise<ApiResponse<void>> {
    return apiService.post(`/users/${userId}/product-assignments`, { productIds });
  }

  async removeProductAssignment(userId: string, productId: number): Promise<ApiResponse<void>> {
    return apiService.delete(`/users/${userId}/product-assignments/${productId}`);
  }
}

export const usersService = new UsersService();
