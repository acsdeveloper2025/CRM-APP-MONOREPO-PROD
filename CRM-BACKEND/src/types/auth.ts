import type { Request } from 'express';

// Role enum for consistent usage
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  MANAGER = 'MANAGER',
  TEAM_LEADER = 'TEAM_LEADER',
  BACKEND_USER = 'BACKEND_USER',
  FIELD_AGENT = 'FIELD_AGENT',
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
      // 2026-04-28 F1.1.2: nullable — derived from FK; users without
      // designation_id return null.
      designation: string | null;
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
  username?: string;
  role?: Role;
  deviceId?: string;
  authMethod?: 'PASSWORD' | 'UUID'; // Authentication method used
  // F-B3.4: per-user token version. Bumped on password change /
  // logout-all to invalidate all in-flight access tokens immediately.
  tokenVersion?: number;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  deviceId?: string;
  authMethod?: 'PASSWORD' | 'UUID'; // Authentication method used
  // F-B3.4: per-user token version (mirrors JwtPayload).
  tokenVersion?: number;
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
