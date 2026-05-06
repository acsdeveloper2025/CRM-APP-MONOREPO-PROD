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
      // 2026-05-06: ship rbac permission codes inline so the FE has
      // perms before /auth/me has been called. Closes a race where
      // permission-gated UI (e.g. KYC dashboard cards) was hidden
      // because /auth/me hadn't refreshed user state yet.
      permissions?: string[];
      roles?: string[];
      assignedClients?: number[];
      assignedProducts?: number[];
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
  // 2026-05-03: random JWT ID. Without this, two concurrent refresh-token
  // calls within the same second produced identical JWTs (same payload
  // + same iat-second) → identical SHA-256 hashes → unique constraint
  // violation on `refresh_tokens_token_key` for the second insert.
  jti?: string;
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
