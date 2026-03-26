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
  RolePermission,
  UserClientAssignment,
  UserProductAssignment
} from '@/types/user';
import type { FieldAgentAssignment } from '@/types/territoryAssignment';
import type { ApiResponse, PaginationQuery } from '@/types/api';
import type { Role } from '@/types/auth';
import { logger } from '@/utils/logger';



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
    return apiService.get<User[]>('/users', query);
  }

  async getUserById(id: string): Promise<ApiResponse<User>> {
    return apiService.get<User>(`/users/${id}`);
  }

  async getUserProfile(id: string): Promise<ApiResponse<UserProfile>> {
    return apiService.get<UserProfile>(`/users/${id}/profile`);
  }

  async createUser(data: CreateUserData): Promise<ApiResponse<User>> {
    return apiService.post<User>('/users', data);
  }

  async updateUser(id: string, data: UpdateUserData): Promise<ApiResponse<User>> {
    return apiService.put<User>(`/users/${id}`, data);
  }

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    return apiService.delete<void>(`/users/${id}`);
  }

  async activateUser(id: string): Promise<ApiResponse<User>> {
    return apiService.post<User>(`/users/${id}/activate`);
  }

  async deactivateUser(id: string, reason?: string): Promise<ApiResponse<User>> {
    return apiService.post<User>(`/users/${id}/deactivate`, { reason });
  }

  // Password management
  async changePassword(id: string, data: ChangePasswordData): Promise<ApiResponse<void>> {
    return apiService.post<void>(`/users/${id}/change-password`, data);
  }

  async resetPassword(data: ResetPasswordData): Promise<ApiResponse<void>> {
    return apiService.post<void>('/users/reset-password', data);
  }

  async generateTemporaryPassword(userId: string): Promise<ApiResponse<{ temporaryPassword: string }>> {
    return apiService.post<{ temporaryPassword: string }>(`/users/${userId}/generate-temp-password`);
  }

  // Profile photo management
  async uploadProfilePhoto(userId: string, file: File): Promise<ApiResponse<{ profilePhotoUrl: string }>> {
    const formData = new FormData();
    formData.append('photo', file);
    
    return apiService.post<{ profilePhotoUrl: string }>(`/users/${userId}/profile-photo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async deleteProfilePhoto(userId: string): Promise<ApiResponse<void>> {
    return apiService.delete<void>(`/users/${userId}/profile-photo`);
  }

  // User activity and audit logs
  async getUserActivities(query: ActivityQuery = {}): Promise<ApiResponse<UserActivity[]>> {
    return apiService.get<UserActivity[]>('/users/activities', query);
  }

  async getUserActivityById(userId: string, query: ActivityQuery = {}): Promise<ApiResponse<UserActivity[]>> {
    return apiService.get<UserActivity[]>(`/users/${userId}/activities`, query);
  }

  // User sessions
  async getUserSessions(query: SessionQuery = {}): Promise<ApiResponse<UserSession[]>> {
    return apiService.get<UserSession[]>('/users/sessions', query);
  }

  async getUserSessionsByUser(userId: string): Promise<ApiResponse<UserSession[]>> {
    return apiService.get<UserSession[]>(`/users/${userId}/sessions`);
  }

  async terminateSession(sessionId: string): Promise<ApiResponse<void>> {
    return apiService.delete<void>(`/users/sessions/${sessionId}`);
  }

  async terminateAllUserSessions(userId: string): Promise<ApiResponse<void>> {
    return apiService.delete<void>(`/users/${userId}/sessions`);
  }

  // User statistics
  async getUserStats(): Promise<ApiResponse<UserStats>> {
    return apiService.get<UserStats>('/users/stats');
  }

  async getUserStatsByDepartment(department: string): Promise<ApiResponse<UserStats>> {
    return apiService.get<UserStats>(`/users/stats/department/${department}`);
  }

  async getUserStatsByRole(role: Role): Promise<ApiResponse<UserStats>> {
    return apiService.get<UserStats>(`/users/stats/role/${role}`);
  }

  // Role and permissions
  async getRolePermissions(): Promise<ApiResponse<RolePermission[]>> {
    return apiService.get<RolePermission[]>('/users/roles/permissions');
  }

  async getRolePermissionsByRole(role: Role): Promise<ApiResponse<RolePermission>> {
    return apiService.get<RolePermission>(`/users/roles/${role}/permissions`);
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
    const response = await apiService.postRaw<Blob>(`/users/export?format=${format}`, query, {
        responseType: 'blob'
    });
    return response.data;
  }

  async downloadUserTemplate(): Promise<Blob> {
    return apiService.getBlob('/users/import-template');
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

  async getFieldUsersByPincode(pincodeCode: string): Promise<ApiResponse<User[]>> {
    try {
      // Use territory assignments API to get field agents assigned to this pincode
      const response = await apiService.get<FieldAgentAssignment[]>('/territory-assignments/field-agents', {
        pincodeId: pincodeCode,
        isActive: true,
        limit: 100
      });

      // Extract unique users from the territory assignments response
      if (response.data && Array.isArray(response.data)) {
        const users = response.data.map((assignment) => ({
          id: assignment.userId,
          name: assignment.userName,
          username: assignment.username,
          employeeId: assignment.employeeId,
          role: 'FIELD_AGENT' as Role,
          isActive: assignment.isActive,
          email: assignment.email || `${assignment.username}@example.com` // Fallback email if missing
        } as User));

        // Remove duplicates based on user ID
        const uniqueUsers = Array.from(
          new Map(users.map(user => [user.id, user])).values()
        );

        return {
          success: true,
          data: uniqueUsers,
          message: 'Field users retrieved successfully'
        };
      }

      return {
        success: true,
        data: [],
        message: 'No field users found for this pincode'
      };
    } catch (error) {
      logger.error('Error fetching field users by pincode:', error);
      throw error;
    }
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

  // Pincode assignment management for FIELD_AGENT users
  async getUserPincodeAssignments(userId: string): Promise<ApiResponse<unknown>> {
    return apiService.get(`/territory-assignments/field-agents/${userId}`);
  }

  async assignPincodesToUser(userId: string, pincodeIds: number[]): Promise<ApiResponse<void>> {
    return apiService.post(`/territory-assignments/field-agents/${userId}/pincodes`, { pincodeIds });
  }

  async removePincodeAssignment(userId: string, pincodeId: number): Promise<ApiResponse<void>> {
    return apiService.delete(`/territory-assignments/field-agents/${userId}/pincodes/${pincodeId}`);
  }

  // Area assignment management for FIELD_AGENT users
  // Areas are assigned per pincode - format: [{ pincodeId, areaIds }]
  async assignAreasToUser(
    userId: string,
    assignments: Array<{ pincodeId: number; areaIds: number[] }>
  ): Promise<ApiResponse<void>> {
    return apiService.post(`/territory-assignments/field-agents/${userId}/areas`, {
      assignments,
    });
  }
}

export const usersService = new UsersService();
