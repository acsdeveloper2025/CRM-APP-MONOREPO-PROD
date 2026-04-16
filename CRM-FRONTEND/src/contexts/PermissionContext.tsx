import React, { createContext, useContext, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionContextValue {
  hasPermissionCode: (code: string) => boolean;
}

const PermissionContext = createContext<PermissionContextValue | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = usePermissions();

  const value = useMemo<PermissionContextValue>(
    () => ({
      hasPermissionCode: (code: string) => {
        if (!user) {
          return false;
        }
        const codes = Array.isArray(user.permissions) ? (user.permissions as string[]) : [];
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
