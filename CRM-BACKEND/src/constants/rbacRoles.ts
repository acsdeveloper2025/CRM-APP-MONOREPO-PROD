export const CANONICAL_RBAC_ROLE_NAMES = ['SUPER_ADMIN', 'BACKEND_USER', 'FIELD_AGENT'] as const;

export type CanonicalRbacRoleName = (typeof CANONICAL_RBAC_ROLE_NAMES)[number];

export const LEGACY_RBAC_ROLE_ALIAS_TO_CANONICAL: Readonly<Record<string, CanonicalRbacRoleName>> =
  {
    ADMIN: 'SUPER_ADMIN',
    MANAGER: 'BACKEND_USER',
    REPORT_PERSON: 'BACKEND_USER',
  };

export const LEGACY_RBAC_ROLE_NAMES = Object.keys(
  LEGACY_RBAC_ROLE_ALIAS_TO_CANONICAL
) as readonly string[];

export const ALL_ACCEPTED_RBAC_ROLE_NAMES = [
  ...CANONICAL_RBAC_ROLE_NAMES,
  ...LEGACY_RBAC_ROLE_NAMES,
] as const;

export const normalizeRbacRoleName = (
  roleName: string | null | undefined
): CanonicalRbacRoleName | undefined => {
  if (!roleName) {
    return undefined;
  }
  const normalized = roleName.trim().toUpperCase();
  if ((CANONICAL_RBAC_ROLE_NAMES as readonly string[]).includes(normalized)) {
    return normalized as CanonicalRbacRoleName;
  }
  return LEGACY_RBAC_ROLE_ALIAS_TO_CANONICAL[normalized];
};

export const isCanonicalRbacRoleName = (roleName: string | null | undefined): boolean =>
  Boolean(
    roleName &&
      (CANONICAL_RBAC_ROLE_NAMES as readonly string[]).includes(roleName.trim().toUpperCase())
  );

export const RBAC_ROLE_CANONICALIZE_SQL_CASE = `CASE
  WHEN rv.name = 'ADMIN' THEN 'SUPER_ADMIN'
  WHEN rv.name IN ('MANAGER', 'REPORT_PERSON') THEN 'BACKEND_USER'
  ELSE rv.name
END`;
