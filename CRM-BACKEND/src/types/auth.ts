import { Request } from 'express';

// Role enum for consistent usage
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  BACKEND_USER = 'BACKEND_USER',
  FIELD_AGENT = 'FIELD_AGENT',
  MANAGER = 'MANAGER',
  REPORT_PERSON = 'REPORT_PERSON'
}

export interface LoginRequest {
  username: string;
  password: string;
  deviceId?: string; // Optional for all user roles (device authentication)
  macAddress?: string; // Optional fallback authentication method
}

// Universal UUID-based authentication for all user roles
export interface FieldAgentUuidLoginRequest {
  authUuid: string; // UUID authentication token for any user role
  deviceId: string; // Required for device identification
  platform?: 'IOS' | 'ANDROID'; // Platform (mobile/web)
  appVersion?: string; // Application version
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      name: string;
      username: string;
      email: string;
      role: Role;
      employeeId: string;
      designation: string;
      department: string;
      profilePhotoUrl?: string;

    };
    tokens: {
      accessToken: string;
      refreshToken: string;
    };
  };
}



export interface JwtPayload {
  userId: string;
  username: string;
  role: Role;
  deviceId?: string;
  authMethod?: 'PASSWORD' | 'UUID'; // Authentication method used
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  deviceId?: string;
  authMethod?: 'PASSWORD' | 'UUID'; // Authentication method used
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: Role;
    deviceId?: string;
  };
}
