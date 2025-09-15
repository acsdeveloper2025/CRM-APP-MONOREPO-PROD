import { apiService } from './api';
import { User, CreateUserData, UpdateUserData } from '../types/user';

export interface GetUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface GetUsersResponse {
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const userApi = {
  // Get users with pagination and filters
  async getUsers(params: GetUsersParams = {}): Promise<GetUsersResponse> {
    const response = await apiService.get('/users', params);
    return {
      data: response.data || [],
      pagination: response.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 }
    };
  },

  // Get user by ID
  async getUserById(id: string): Promise<User> {
    const response = await apiService.get(`/users/${id}`);
    return response.data;
  },

  // Create new user
  async createUser(userData: CreateUserData): Promise<User> {
    const response = await apiService.post('/users', userData);
    return response.data;
  },

  // Update user
  async updateUser(id: string, userData: UpdateUserData): Promise<User> {
    const response = await apiService.put(`/users/${id}`, userData);
    return response.data;
  },

  // Delete user
  async deleteUser(id: string): Promise<void> {
    await apiService.delete(`/users/${id}`);
  },

  // Get field agents specifically
  async getFieldAgents(params: GetUsersParams = {}): Promise<GetUsersResponse> {
    return this.getUsers({ ...params, role: 'FIELD_AGENT' });
  },

  // Search users by name or email
  async searchUsers(query: string, limit: number = 10): Promise<User[]> {
    const response = await apiService.get('/users/search', { q: query, limit });
    return response.data;
  },

  // Get user statistics
  async getUserStats(): Promise<any> {
    const response = await apiService.get('/users/stats');
    return response.data;
  },

  // Export users
  async exportUsers(params: GetUsersParams = {}): Promise<Blob> {
    const response = await apiService.get('/users/export', params, { responseType: 'blob' });
    return response.data;
  }
};
