import type { AuthenticatedRequest } from '@/middleware/auth';

type AuthUser = NonNullable<AuthenticatedRequest['user']>;

const hasCode = (codes: string[] | undefined, code: string): boolean =>
  Boolean(codes?.includes('*') || codes?.includes(code));

export const userHasPermission = (
  user: AuthenticatedRequest['user'] | undefined,
  permissionCode: string
): boolean => hasCode(user?.permissionCodes, permissionCode);

export const userHasAnyPermission = (
  user: AuthenticatedRequest['user'] | undefined,
  permissionCodes: string[]
): boolean => permissionCodes.some(code => hasCode(user?.permissionCodes, code));

export const hasSystemScopeBypass = (user: AuthenticatedRequest['user'] | undefined): boolean =>
  userHasPermission(user, '*') || userHasPermission(user, 'settings.manage');

export const isScopedOperationsUser = (user: AuthenticatedRequest['user'] | undefined): boolean => {
  if (!user) {
    return false;
  }
  if (hasSystemScopeBypass(user)) {
    return false;
  }

  // Users with operational visibility permissions but without system-level bypass
  // must be constrained by assignment scope (client/product where applicable).
  return userHasAnyPermission(user, [
    'case.view',
    'case.assign',
    'case.reassign',
    'report.generate',
    'report.download',
    'billing.generate',
    'billing.download',
    'billing.approve',
    'dashboard.view',
  ]);
};

export const isFieldExecutionActor = (user: AuthenticatedRequest['user'] | undefined): boolean => {
  if (!user) {
    return false;
  }
  if (hasSystemScopeBypass(user)) {
    return false;
  }

  const hasVisitExecution =
    userHasPermission(user, 'visit.start') ||
    userHasPermission(user, 'visit.upload') ||
    userHasPermission(user, 'visit.submit') ||
    userHasPermission(user, 'visit.revoke') ||
    userHasPermission(user, 'visit.revisit');

  if (!hasVisitExecution) {
    return false;
  }

  // Execution actor should not also hold supervisory permissions that imply non-field access.
  return !userHasAnyPermission(user, [
    'case.assign',
    'case.reassign',
    'review.approve',
    'review.rework',
    'billing.generate',
    'billing.approve',
    'permission.manage',
    'role.manage',
  ]);
};

export const requireOwnershipOnlyForExecutionActor = (
  user: AuthenticatedRequest['user'] | undefined
): boolean => isFieldExecutionActor(user);

export const canManageScheduledReportsGlobally = (
  user: AuthenticatedRequest['user'] | undefined
): boolean => hasSystemScopeBypass(user) || userHasPermission(user, 'permission.manage');

export const getPrimaryRoleNameFromRbac = (
  roles: string[] | null | undefined
): string | undefined => {
  if (!roles || roles.length === 0) {
    return undefined;
  }

  // Compatibility ordering only; authorization must not depend on this.
  const priority = [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'BACKEND_USER',
    'FIELD_AGENT',
    'REPORT_PERSON',
  ];
  for (const role of priority) {
    if (roles.includes(role)) {
      return role;
    }
  }
  return roles[0];
};

export const getScopedUserIdForTaskLists = (
  user: AuthenticatedRequest['user'] | undefined
): string | undefined => (isFieldExecutionActor(user) ? user?.id : undefined);

export const assertAuthenticatedUser = (
  user: AuthenticatedRequest['user'] | undefined
): user is AuthUser => Boolean(user?.id);
