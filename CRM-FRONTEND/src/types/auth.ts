export type Role = 'ADMIN' | 'BACKEND_USER' | 'FIELD_AGENT' | 'MANAGER' | 'SUPER_ADMIN' | 'REPORT_PERSON';

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  roleId?: string;
  roleName?: string;
  permissions?: {
    [resource: string]: {
      [action: string]: boolean;
    };
  };
  employeeId: string;
  designation: string;
  department: string;
  departmentId?: string;
  departmentName?: string;
  profilePhotoUrl?: string;
  isActive?: boolean;
  lastLogin?: string;
  createdAt?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  deviceId?: string;
  macAddress?: string;
}

export interface UuidLoginRequest {
  authUuid: string;
  deviceId: string;
  platform?: string;
  appVersion?: string;
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
