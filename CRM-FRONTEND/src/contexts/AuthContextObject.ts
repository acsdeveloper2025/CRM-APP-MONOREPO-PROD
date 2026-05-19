import { createContext } from 'react';
import type { AuthState, LoginRequest } from '@/types/auth';

// T1-2: login() now has three terminal states — authenticated, plain
// failure, or "second factor required" (the BE returned a challenge
// token that the caller must exchange via completeMfaLogin).
export type LoginAttemptResult =
  | { status: 'ok' }
  | { status: 'failed' }
  | { status: 'mfa-required'; mfaChallenge: string };

export interface AuthContextType extends AuthState {
  login: (credentials: LoginRequest) => Promise<LoginAttemptResult>;
  completeMfaLogin: (challenge: string, code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUserPermissions: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
