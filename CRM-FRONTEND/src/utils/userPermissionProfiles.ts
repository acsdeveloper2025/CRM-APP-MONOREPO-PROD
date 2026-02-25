import type { User } from '@/types/user';

const getPermissionCodes = (user?: Pick<User, 'permissionCodes' | 'permissions'> | null): string[] => {
  if (!user) {return [];}
  if (Array.isArray(user.permissionCodes)) {return user.permissionCodes;}
  if (Array.isArray(user.permissions)) {return user.permissions.filter((p): p is string => typeof p === 'string');}
  return [];
};

export const userHasPermissionCode = (
  user: Pick<User, 'permissionCodes' | 'permissions'> | null | undefined,
  code: string
): boolean => getPermissionCodes(user).includes('*') || getPermissionCodes(user).includes(code);

export const isAdminLikeUser = (user?: User | null): boolean =>
  userHasPermissionCode(user, 'permission.manage') ||
  userHasPermissionCode(user, 'role.manage') ||
  userHasPermissionCode(user, 'settings.manage');

export const isBackendScopedUser = (user?: User | null): boolean =>
  !isAdminLikeUser(user) &&
  userHasPermissionCode(user, 'case.create') &&
  (userHasPermissionCode(user, 'case.assign') || userHasPermissionCode(user, 'case.reassign'));

export const isFieldAgentUser = (user?: User | null): boolean =>
  !isAdminLikeUser(user) &&
  userHasPermissionCode(user, 'visit.start') &&
  userHasPermissionCode(user, 'visit.submit');

export const canViewAdminUserOps = (user?: User | null): boolean =>
  isAdminLikeUser(user);

export const matchesLegacyRoleAlias = (user: User | null | undefined, role: string): boolean => {
  const normalized = role.toUpperCase();
  if (normalized === 'SUPER_ADMIN' || normalized === 'ADMIN') {return isAdminLikeUser(user);}
  if (normalized === 'BACKEND_USER') {return isBackendScopedUser(user);}
  if (normalized === 'FIELD_AGENT') {return isFieldAgentUser(user);}
  if (normalized === 'MANAGER') {
    return !isAdminLikeUser(user) && userHasPermissionCode(user, 'review.view');
  }
  if (normalized === 'REPORT_PERSON') {
    return !isAdminLikeUser(user) && userHasPermissionCode(user, 'report.download');
  }
  return false;
};

export const matchesAnyLegacyRoleAlias = (
  user: User | null | undefined,
  roles: string[]
): boolean => roles.some(role => matchesLegacyRoleAlias(user, role));

export const getPrimaryRoleLabel = (user?: User | null): string => {
  if (user?.roles && user.roles.length > 0) {
    return user.roles[0];
  }
  if (user?.roleName) {
    return user.roleName;
  }
  return user?.role || 'UNKNOWN';
};
