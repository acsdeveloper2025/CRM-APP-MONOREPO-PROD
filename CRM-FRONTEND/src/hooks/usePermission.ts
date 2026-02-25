import { usePermissionContext } from '@/contexts/PermissionContext';

export const usePermission = (code: string): boolean => {
  const { hasPermissionCode } = usePermissionContext();
  return hasPermissionCode(code);
};

