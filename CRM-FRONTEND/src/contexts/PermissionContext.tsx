import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface PermissionContextValue {
  hasPermissionCode: (code: string) => boolean;
}

const PermissionContext = createContext<PermissionContextValue | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const value = useMemo<PermissionContextValue>(
    () => ({
      hasPermissionCode: (code: string) => {
        if (!user) {
          return false;
        }
        // 2026-06-03: read permissionCodes first (mirrors usePermission). The
        // AuthContext normalizer usually copies permissionCodes→permissions, but
        // any auth path that delivers a permissionCodes-only user would otherwise
        // make this return false and silently disable permission-gated queries
        // (e.g. the case-detail KYC tab via useKYCTasksForCase).
        const codes =
          (user as { permissionCodes?: string[] }).permissionCodes ||
          (Array.isArray(user.permissions) ? (user.permissions as string[]) : []);
        return codes.includes('*') || codes.includes(code);
      },
    }),
    [user]
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const usePermissionContext = (): PermissionContextValue => {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    throw new Error('usePermissionContext must be used within PermissionProvider');
  }
  return ctx;
};
