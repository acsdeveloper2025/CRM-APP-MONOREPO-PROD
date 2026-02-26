import type { AuthenticatedRequest } from '@/middleware/auth';
import {
  CANONICAL_RBAC_ROLE_NAMES,
  normalizeRbacRoleName,
  type CanonicalRbacRoleName,
} from '@/constants/rbacRoles';

type AuthUser = NonNullable<AuthenticatedRequest['user']>;

const EXECUTION_PERMISSION_CODES = [
  'visit.start',
  'visit.upload',
  'visit.submit',
  'visit.revoke',
  'visit.revisit',
] as const;

const SUPERVISORY_PERMISSION_CODES = [
  'case.assign',
  'case.reassign',
  'review.approve',
  'review.rework',
  'billing.generate',
  'billing.approve',
  'permission.manage',
  'role.manage',
] as const;

const OPERATIONAL_VISIBILITY_PERMISSION_CODES = [
  'case.view',
  'case.assign',
  'case.reassign',
  'report.generate',
  'report.download',
  'billing.generate',
  'billing.download',
  'billing.approve',
  'dashboard.view',
] as const;

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

export type PermissionCapabilityFlags = {
  systemScopeBypass: boolean;
  operationalScope: boolean;
  executionActor: boolean;
  supervisoryOrGlobal: boolean;
};

export const deriveCapabilitiesFromPermissionCodes = (
  permissionCodes: string[] | undefined
): PermissionCapabilityFlags => {
  const codes = permissionCodes || [];
  const systemScopeBypass = hasCode(codes, '*') || hasCode(codes, 'settings.manage');
  const executionPermissionPresent = EXECUTION_PERMISSION_CODES.some(code => hasCode(codes, code));
  const supervisoryPermissionPresent = SUPERVISORY_PERMISSION_CODES.some(code =>
    hasCode(codes, code)
  );

  const executionActor =
    !systemScopeBypass && executionPermissionPresent && !supervisoryPermissionPresent;
  const operationalScope =
    !systemScopeBypass &&
    OPERATIONAL_VISIBILITY_PERMISSION_CODES.some(code => hasCode(codes, code));

  return {
    systemScopeBypass,
    operationalScope,
    executionActor,
    supervisoryOrGlobal: systemScopeBypass || supervisoryPermissionPresent,
  };
};

export const hasSystemScopeBypass = (user: AuthenticatedRequest['user'] | undefined): boolean =>
  userHasPermission(user, '*') || userHasPermission(user, 'settings.manage');

export const isScopedOperationsUser = (user: AuthenticatedRequest['user'] | undefined): boolean => {
  if (!user) {
    return false;
  }
  return deriveCapabilitiesFromPermissionCodes(user.permissionCodes).operationalScope;
};

export const isFieldExecutionActor = (user: AuthenticatedRequest['user'] | undefined): boolean => {
  if (!user) {
    return false;
  }
  return deriveCapabilitiesFromPermissionCodes(user.permissionCodes).executionActor;
};

export const requireOwnershipOnlyForExecutionActor = (
  user: AuthenticatedRequest['user'] | undefined
): boolean => isFieldExecutionActor(user);

export const canManageScheduledReportsGlobally = (
  user: AuthenticatedRequest['user'] | undefined
): boolean => hasSystemScopeBypass(user) || userHasPermission(user, 'permission.manage');

export const hasSupervisoryOrGlobalCapability = (
  user: AuthenticatedRequest['user'] | undefined
): boolean =>
  Boolean(user && deriveCapabilitiesFromPermissionCodes(user.permissionCodes).supervisoryOrGlobal);

export const getPrimaryRoleNameFromRbac = (
  roles: string[] | null | undefined
): CanonicalRbacRoleName | undefined => {
  if (!roles || roles.length === 0) {
    return undefined;
  }

  // Compatibility ordering only; authorization must not depend on this.
  for (const role of CANONICAL_RBAC_ROLE_NAMES) {
    if (roles.some(current => normalizeRbacRoleName(current) === role)) {
      return role;
    }
  }
  return normalizeRbacRoleName(roles[0]);
};

export const getScopedUserIdForTaskLists = (
  user: AuthenticatedRequest['user'] | undefined
): string | undefined => (isFieldExecutionActor(user) ? user?.id : undefined);

export const assertAuthenticatedUser = (
  user: AuthenticatedRequest['user'] | undefined
): user is AuthUser => Boolean(user?.id);
