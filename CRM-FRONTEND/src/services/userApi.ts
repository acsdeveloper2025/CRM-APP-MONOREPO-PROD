import { apiService } from './api';
import { User, CreateUserData, UpdateUserData, UserStats } from '../types/user';
import { validateResponse } from './schemas/runtime';
import { UserSchema, UserListSchema } from './schemas/user.schema';
import { GenericObjectSchema } from './schemas/generic.schema';

export interface GetUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

import { PaginatedResponse } from '@/types/api';

export const userApi = {
  // Get users with pagination and filters
  // Get users with pagination and filters
  async getUsers(params: GetUsersParams = {}): Promise<PaginatedResponse<User>> {
    const response = await apiService.get<User[]>('/users', params);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(UserListSchema, response.data, {
        service: 'userApi',
        endpoint: 'GET /users',
      });
    }
    return response as unknown as PaginatedResponse<User>;
  },

  // Get user by ID
  // Get user by ID
  async getUserById(id: string): Promise<User> {
    const response = await apiService.get<User>(`/users/${id}`);
    if (response?.success && response.data) {
      validateResponse(UserSchema, response.data, {
        service: 'userApi',
        endpoint: 'GET /users/:id',
      });
    }
    return response.data as User;
  },

  // Create new user
  // Create new user
  async createUser(userData: CreateUserData): Promise<User> {
    const response = await apiService.post<User>('/users', userData);
    return response.data as User;
  },

  // Update user
  // Update user
  async updateUser(id: string, userData: UpdateUserData): Promise<User> {
    const response = await apiService.put<User>(`/users/${id}`, userData);
    return response.data as User;
  },

  // Delete user
  // Delete user
  async deleteUser(id: string): Promise<void> {
    await apiService.delete<void>(`/users/${id}`);
  },

  // Get field agents specifically
  async getFieldAgents(params: GetUsersParams = {}): Promise<PaginatedResponse<User>> {
    return this.getUsers({ ...params, role: 'FIELD_AGENT' });
  },

  // Search users by name or email
  async searchUsers(query: string, limit: number = 10): Promise<User[]> {
    const response = await apiService.get<User[]>('/users/search', { q: query, limit });
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(UserListSchema, response.data, {
        service: 'userApi',
        endpoint: 'GET /users/search',
      });
    }
    return response.data || [];
  },

  // Get user statistics
  async getUserStats(): Promise<UserStats> {
    const response = await apiService.get<UserStats>('/users/stats');
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'userApi',
        endpoint: 'GET /users/stats',
      });
    }
    return response.data as UserStats;
  },

  // Export users
  async exportUsers(params: GetUsersParams = {}): Promise<Blob> {
    return apiService.getBlob('/users/export', params);
  },
};
