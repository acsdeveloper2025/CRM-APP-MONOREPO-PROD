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
  data?:
    | {
        user: User;
        tokens: {
          accessToken: string;
          refreshToken: string;
        };
      }
    // T1-2: MFA-required branch. When the user must satisfy a second
    // factor, the backend returns a short-lived challenge token instead
    // of the normal access+refresh pair. The FE swaps to a code-entry
    // screen and posts to /auth/mfa/verify.
    | {
        mfaRequired: true;
        mfaChallenge: string;
      };
}

export interface MfaStatusResponse {
  enrolled: boolean;
  mfaRequiredForUser: boolean;
}

export interface MfaEnrollStartResponse {
  secret: string;
  otpauthUri: string;
}

export interface MfaEnrollVerifyResponse {
  recoveryCodes: string[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
