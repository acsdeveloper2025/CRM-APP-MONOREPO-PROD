// Zod schema for the User shape returned by `GET /auth/me` and other
// user-bearing endpoints. Kept intentionally permissive — the UI
// consumes User in many places with defensive optional-chaining already,
// so a brand-new field on the backend is not a contract break.
//
// Required fields are just `id`, `username`, `email`, `role`, and the
// display-name fields. Everything else is optional to match the
// historical `User` TS interface, which evolved freely as the RBAC
// system grew.

import { z } from 'zod';

export const UserSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    username: z.string().min(1),
    email: z.string(),
    phone: z.string().optional(),
    role: z.string(),
    roles: z.array(z.string()).optional(),
    roleId: z.union([z.string(), z.number()]).optional(),
    roleName: z.string().optional(),
    permissionCodes: z.array(z.string()).optional(),
    routeAccess: z.array(z.string()).optional(),
    employeeId: z.string().optional().default(''),
    // 2026-04-28 F1.1.2: designation is now FK-derived (designations.name).
    // Users without designation_id return null. Same for designationName.
    designation: z.string().nullable().optional().default(''),
    designationId: z.number().nullable().optional(),
    designationName: z.string().nullable().optional(),
    // 2026-04-28 F1.1.3: department is now FK-derived (departments.name).
    // Users without department_id return null. Same for departmentName.
    department: z.string().nullable().optional(),
    departmentId: z.number().nullable().optional(),
    departmentName: z.string().nullable().optional(),
    teamLeaderId: z.string().nullable().optional(),
    teamLeaderName: z.string().nullable().optional(),
    managerId: z.string().nullable().optional(),
    managerName: z.string().nullable().optional(),
    profilePhotoUrl: z.string().optional(),
    isActive: z.boolean().optional(),
    lastLogin: z.string().optional(),
    lastLoginAt: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    createdBy: z.string().optional(),
    updatedBy: z.string().optional(),
    assignedClientsCount: z.number().optional(),
    assignedProductsCount: z.number().optional(),
    assignedPincodesCount: z.number().optional(),
    assignedAreasCount: z.number().optional(),
    assignedClients: z.array(z.number()).optional(),
    assignedProducts: z.array(z.number()).optional(),
    assignedPincodes: z.array(z.number()).optional(),
    assignedAreas: z.array(z.number()).optional(),
  })
  // `permissions`, `permissionMap`, `legacyPermissions`, `stats`, and
  // `recentActivity` are accepted as-is — they are nested / evolving
  // shapes that the UI treats as opaque bags.
  .passthrough();

export type UserDto = z.infer<typeof UserSchema>;

// Phase B6 expansion: the users list endpoint returns an array of
// User plus pagination metadata. Kept permissive with .passthrough()
// so evolving extra fields never break validation.
export const UserListSchema = z.array(UserSchema);
