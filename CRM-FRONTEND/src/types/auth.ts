import { type UserRole } from './constants';

import { type User } from './user';

export type Role = UserRole;

// Re-export User interface from user.ts to avoid duplication
export type { User };

export interface LoginRequest {
  username: string;
  password: string;
  macAddress?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    tokens: {
      accessToken: string;
      refreshToken: string;
    };
  };
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
