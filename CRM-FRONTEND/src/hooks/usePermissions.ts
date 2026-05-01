import { useAuth } from '@/hooks/useAuth';

export function usePermission(code: string): boolean {
  const { user } = useAuth();
  if (!user) {
    return false;
  }
  const raw =
    user.permissionCodes || (Array.isArray(user.permissions) ? (user.permissions as string[]) : []);
  return raw.includes('*') || raw.includes(code);
}
