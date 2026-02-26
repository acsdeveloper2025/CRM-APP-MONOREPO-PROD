import { createContext } from 'react';
import type { AuthState, LoginRequest } from '@/types/auth';

export interface AuthContextType extends AuthState {
  login: (credentials: LoginRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUserPermissions: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
