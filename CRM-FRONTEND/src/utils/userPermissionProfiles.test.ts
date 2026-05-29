import { describe, it, expect } from 'vitest';
import type { User } from '@/types/user';
import {
  userHasPermissionCode,
  isAdminLikeUser,
  isBackendScopedUser,
  isSupervisoryUser,
  isFieldAgentUser,
  getPrimaryRoleLabel,
  matchesLegacyRoleAlias,
} from './userPermissionProfiles';

const u = (partial: Partial<User>): User => partial as User;

describe('userHasPermissionCode', () => {
  it('matches an exact code and is false for missing codes / null user', () => {
    const user = u({ permissionCodes: ['case.view', 'case.create'] });
    expect(userHasPermissionCode(user, 'case.view')).toBe(true);
    expect(userHasPermissionCode(user, 'billing.download')).toBe(false);
    expect(userHasPermissionCode(null, 'case.view')).toBe(false);
  });

  it('treats the * wildcard as having every permission', () => {
    const user = u({ permissionCodes: ['*'] });
    expect(userHasPermissionCode(user, 'anything.at.all')).toBe(true);
  });

  it('falls back to the legacy permissions[] array', () => {
    const user = u({ permissions: ['settings.manage'] as unknown as User['permissions'] });
    expect(userHasPermissionCode(user, 'settings.manage')).toBe(true);
  });
});

describe('role-profile predicates', () => {
  it('isAdminLikeUser requires one of the admin permissions', () => {
    expect(isAdminLikeUser(u({ permissionCodes: ['settings.manage'] }))).toBe(true);
    expect(isAdminLikeUser(u({ permissionCodes: ['role.manage'] }))).toBe(true);
    expect(isAdminLikeUser(u({ permissionCodes: ['case.view'] }))).toBe(false);
  });

  it('isBackendScopedUser needs case.create + assign/reassign and must not be admin', () => {
    expect(isBackendScopedUser(u({ permissionCodes: ['case.create', 'case.assign'] }))).toBe(true);
    expect(isBackendScopedUser(u({ permissionCodes: ['case.create'] }))).toBe(false);
    expect(
      isBackendScopedUser(u({ permissionCodes: ['settings.manage', 'case.create', 'case.assign'] }))
    ).toBe(false); // admin short-circuits
  });

  it('isFieldAgentUser is true for a non-admin FIELD_AGENT role', () => {
    expect(isFieldAgentUser(u({ roles: ['FIELD_AGENT'], permissionCodes: ['visit.start'] }))).toBe(
      true
    );
    expect(
      isFieldAgentUser(u({ roles: ['FIELD_AGENT'], permissionCodes: ['settings.manage'] }))
    ).toBe(false); // admin-like wins
  });

  it('isSupervisoryUser needs case.view + page.analytics, no visit.start, not admin/field', () => {
    expect(
      isSupervisoryUser(u({ roles: ['MANAGER'], permissionCodes: ['case.view', 'page.analytics'] }))
    ).toBe(true);
    expect(
      isSupervisoryUser(
        u({ roles: ['MANAGER'], permissionCodes: ['case.view', 'page.analytics', 'visit.start'] })
      )
    ).toBe(false);
  });
});

describe('getPrimaryRoleLabel', () => {
  it('prefers roles[0], then roleName, then role, then UNKNOWN', () => {
    expect(getPrimaryRoleLabel(u({ roles: ['ADMIN', 'X'] }))).toBe('ADMIN');
    expect(getPrimaryRoleLabel(u({ roleName: 'MANAGER' }))).toBe('MANAGER');
    expect(getPrimaryRoleLabel(u({ role: 'FIELD_AGENT' }))).toBe('FIELD_AGENT');
    expect(getPrimaryRoleLabel(u({}))).toBe('UNKNOWN');
  });
});

describe('matchesLegacyRoleAlias', () => {
  it('maps SUPER_ADMIN to admin-like users', () => {
    expect(matchesLegacyRoleAlias(u({ permissionCodes: ['settings.manage'] }), 'SUPER_ADMIN')).toBe(
      true
    );
    expect(matchesLegacyRoleAlias(u({ permissionCodes: ['case.view'] }), 'SUPER_ADMIN')).toBe(false);
  });
});
